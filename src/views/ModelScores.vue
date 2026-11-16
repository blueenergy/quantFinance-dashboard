<template>
  <section class="model-scores">
    <header class="page-header">
      <div>
        <p class="eyebrow">Model Scores</p>
        <h2>🧮 模型评分</h2>
        <p class="subtitle">
          每日模型横截面排序（quant_ml.model_predictions）。不同模型的分数量纲不可比，这里一律用排名与分位；
          跨股票池不可对比，同一日期下无数据的模型会置灰。
        </p>
      </div>
      <button type="button" :disabled="loading" @click="refresh">刷新</button>
    </header>

    <section class="filters card">
      <label>
        股票池
        <select v-model="universe" @change="onUniverseChange">
          <option v-for="group in universeGroups" :key="group.indexCode" :value="group.indexCode">
            {{ group.label }}（{{ group.models.length }}）
          </option>
        </select>
      </label>
      <label>
        截面日期
        <select v-model="selectedDate" @change="loadDaily">
          <option value="">最新</option>
          <option v-for="date in dateOptions" :key="date" :value="date">{{ date }}</option>
        </select>
      </label>
      <label>
        Top N
        <select v-model.number="topN" @change="loadDaily">
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
      </label>
      <label class="search-field">
        搜索
        <input v-model.trim="search" type="search" placeholder="代码或名称" />
      </label>
      <label class="toggle-field">
        <input v-model="onlyTop" type="checkbox" />
        只看 Top {{ topN }}
      </label>
    </section>

    <section class="card models-card">
      <div class="models-head">
        <h3>模型选择</h3>
        <span class="muted">最多 {{ MAX_COMPARE_MODELS }} 个 · 已选 {{ selectedModelIds.length }}</span>
      </div>
      <div class="models-grid">
        <label
          v-for="model in universeModels"
          :key="model.model_id"
          class="model-option"
          :class="{ selected: selectedModelIds.includes(model.model_id), stale: !model.recent }"
        >
          <input
            type="checkbox"
            :value="model.model_id"
            :checked="selectedModelIds.includes(model.model_id)"
            :disabled="!canToggle(model.model_id)"
            @change="toggleModel(model.model_id, $event.target.checked)"
          />
          <span class="model-id">{{ model.model_id }}</span>
          <span class="model-meta">
            {{ model.shadow ? 'shadow' : 'research' }} · {{ coverageLabel(model) }}
            <template v-if="!model.recent"> · 历史</template>
          </span>
        </label>
      </div>
      <p v-if="!universeModels.length" class="muted">该股票池暂无模型预测。</p>
    </section>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <p v-if="loading" class="muted">加载中...</p>

    <template v-if="payload">
      <section class="card status-card">
        <div class="status-line">
          <strong>{{ payload.trade_date }}</strong>
          <span class="muted">{{ payload.universe ? universeLabel(payload.universe) : '-' }}</span>
          <span class="muted">共 {{ payload.total_symbols }} 只 · 显示 {{ payload.rows.length }}</span>
        </div>
        <div class="status-models">
          <div
            v-for="model in payload.models"
            :key="model.model_id"
            class="status-model"
            :class="{ unavailable: !model.available }"
          >
            <span class="model-id">{{ model.model_id }}</span>
            <span v-if="model.available" class="muted">
              {{ model.rows }} 只 · 写入 {{ shortTime(model.created_at) }}
              <template v-if="model.prev_trade_date"> · 对比 {{ model.prev_trade_date }}</template>
            </span>
            <span v-else class="warn">该日无数据</span>
            <span v-if="model.available" class="stats">
              p50 {{ formatScore(model.stats?.p50) }} · p90 {{ formatScore(model.stats?.p90) }}
            </span>
          </div>
        </div>
      </section>

      <section v-if="comparisonPairs.length" class="card compare-card">
        <h3>模型对比</h3>
        <table class="correlation-table">
          <thead>
            <tr>
              <th>模型 A</th>
              <th>模型 B</th>
              <th>共同股票</th>
              <th>秩相关</th>
              <th>Top {{ payload.top_n }} 重合</th>
              <th>Jaccard</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pair in comparisonPairs" :key="`${pair.left}|${pair.right}`">
              <td class="mono">{{ pair.left }}</td>
              <td class="mono">{{ pair.right }}</td>
              <td>{{ pair.common_symbols }}</td>
              <td :class="correlationClass(pair.spearman)">
                {{ pair.spearman === null ? '-' : pair.spearman.toFixed(3) }}
              </td>
              <td>{{ pair.top_n_overlap }} / {{ pair.top_n }}</td>
              <td>{{ pair.top_n_jaccard === null ? '-' : pair.top_n_jaccard.toFixed(3) }}</td>
            </tr>
          </tbody>
        </table>

        <div v-for="pair in comparisonPairs" :key="`d-${pair.left}|${pair.right}`" class="disagreements">
          <div class="disagreement-pair">
            <h4>Top {{ payload.top_n }} 分歧 · {{ pair.left }} vs {{ pair.right }}</h4>
            <div class="disagreement-columns">
              <div>
                <span class="muted">只在 {{ pair.left }}</span>
                <div class="chips">
                  <span v-for="item in pair.onlyLeft" :key="item.symbol" class="chip">
                    {{ item.symbol }} {{ item.name || '' }}
                  </span>
                  <span v-if="!pair.onlyLeft.length" class="muted">无</span>
                </div>
              </div>
              <div>
                <span class="muted">只在 {{ pair.right }}</span>
                <div class="chips">
                  <span v-for="item in pair.onlyRight" :key="item.symbol" class="chip">
                    {{ item.symbol }} {{ item.name || '' }}
                  </span>
                  <span v-if="!pair.onlyRight.length" class="muted">无</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="card table-card">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th class="rank-col">综合</th>
                <th>代码</th>
                <th>名称</th>
                <th>行业</th>
                <th class="mark-col">标记</th>
                <th v-for="model in availableModels" :key="model.model_id" class="model-col">
                  <span class="model-col-title">{{ model.model_id }}</span>
                  <span class="model-col-sub">{{ model.prev_trade_date ? 'Δ vs ' + model.prev_trade_date : '无前值' }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in filteredRows"
                :key="row.symbol"
                :class="{ 'in-top': row.best_rank !== null && row.best_rank <= payload.top_n }"
              >
                <td class="rank-col">{{ row.avg_rank ?? '-' }}</td>
                <td class="mono">{{ row.symbol }}</td>
                <td>{{ row.name || '-' }}</td>
                <td>{{ row.industry || '-' }}</td>
                <td class="mark-col">
                  <span v-if="row.in_positions" title="当前持仓">💼</span>
                  <span v-if="row.in_watchlist" title="自选">⭐</span>
                </td>
                <td v-for="model in availableModels" :key="model.model_id" class="model-col">
                  <template v-if="row.models[model.model_id]">
                    <span class="rank">#{{ row.models[model.model_id].rank }}</span>
                    <span class="pct">{{ row.models[model.model_id].pct }}%</span>
                    <span
                      class="delta"
                      :class="rankDeltaClass(row.models[model.model_id].delta_rank)"
                    >
                      {{ formatRankDelta(row.models[model.model_id].delta_rank) }}
                    </span>
                  </template>
                  <span v-else class="muted">-</span>
                </td>
              </tr>
              <tr v-if="!filteredRows.length">
                <td :colspan="5 + availableModels.length" class="empty">没有符合条件的数据。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { getDailyModelScores, listModelScoreModels } from '../api/modelScores'
import {
  MAX_COMPARE_MODELS,
  coverageLabel,
  formatRankDelta,
  formatScore,
  groupModelsByUniverse,
  pickDefaultModels,
  rankDeltaClass,
  sharedTradeDates,
  universeLabel,
} from '../utils/modelScoresView'

const catalog = ref([])
const universe = ref('')
const selectedModelIds = ref([])
const selectedDate = ref('')
const topN = ref(20)
const search = ref('')
const onlyTop = ref(false)
const payload = ref(null)
const loading = ref(false)
const errorMessage = ref('')

const universeGroups = computed(() => groupModelsByUniverse(catalog.value))
const universeModels = computed(
  () => universeGroups.value.find((group) => group.indexCode === universe.value)?.models || [],
)
const availableModels = computed(() => (payload.value?.models || []).filter((model) => model.available))
const dateOptions = computed(() => sharedTradeDates(catalog.value, selectedModelIds.value))

const comparisonPairs = computed(() => {
    const data = payload.value
    if (!data) return []
    return (data.correlation || []).map((pair, index) => {
      const disagreement = (data.disagreements || [])[index] || {}
      return {
        ...pair,
        onlyLeft: disagreement.only_left || [],
        onlyRight: disagreement.only_right || [],
      }
    })
  })

const filteredRows = computed(() => {
  let rows = payload.value?.rows || []
  const term = search.value.toLowerCase()
  if (term) {
    rows = rows.filter(
      (row) =>
        String(row.symbol).toLowerCase().includes(term) ||
        String(row.name || '').toLowerCase().includes(term),
    )
  }
  if (onlyTop.value) {
    const limit = Number(payload.value?.top_n || topN.value)
    rows = rows.filter((row) => row.avg_rank !== null && row.avg_rank <= limit)
  }
  return rows
})

function canToggle(modelId) {
  if (selectedModelIds.value.includes(modelId)) return true
  return selectedModelIds.value.length < MAX_COMPARE_MODELS
}

function toggleModel(modelId, checked) {
  if (checked) {
    if (selectedModelIds.value.length >= MAX_COMPARE_MODELS) return
    selectedModelIds.value = [...selectedModelIds.value, modelId]
  } else {
    selectedModelIds.value = selectedModelIds.value.filter((id) => id !== modelId)
  }
  if (!selectedModelIds.value.length) {
    const fallback = universeModels.value[0]?.model_id
    selectedModelIds.value = fallback ? [fallback] : []
  }
  resetStaleDate()
  loadDaily()
}

function onUniverseChange() {
  const defaults = pickDefaultModels(
    catalog.value.filter((model) => (model.index_code || 'unknown') === universe.value),
  )
  selectedModelIds.value = defaults.length
    ? defaults
    : universeModels.value[0]?.model_id
      ? [universeModels.value[0].model_id]
      : []
  resetStaleDate()
  loadDaily()
}

function resetStaleDate() {
  // A date that only one of the selected models covers would grey the others
  // out silently; drop back to "最新" whenever the shared set changes.
  if (selectedDate.value && !dateOptions.value.includes(selectedDate.value)) {
    selectedDate.value = ''
  }
}

function shortTime(value) {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(5, 16)
}

function correlationClass(value) {
  if (value === null || value === undefined) return ''
  if (value >= 0.9) return 'corr-high'
  if (value >= 0.75) return 'corr-mid'
  return 'corr-low'
}

async function loadCatalog() {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await listModelScoreModels()
    catalog.value = res?.data?.models || []
    const defaults = pickDefaultModels(catalog.value)
    const first = defaults[0]
    const group = catalog.value.find((model) => model.model_id === first)
    universe.value = group?.index_code || universeGroups.value[0]?.indexCode || ''
    selectedModelIds.value = defaults
    if (!selectedModelIds.value.length && universeModels.value.length) {
      selectedModelIds.value = [universeModels.value[0].model_id]
    }
  } catch (err) {
    errorMessage.value = err?.message || '加载模型列表失败'
  } finally {
    loading.value = false
  }
}

async function loadDaily() {
  if (!selectedModelIds.value.length) {
    payload.value = null
    return
  }
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await getDailyModelScores({
      model_ids: selectedModelIds.value.join(','),
      date: selectedDate.value || undefined,
      top_n: topN.value,
      limit: 400,
    })
    payload.value = res?.data || null
  } catch (err) {
    payload.value = null
    errorMessage.value = err?.response?.data?.detail || err?.message || '加载模型评分失败'
  } finally {
    loading.value = false
  }
}

async function refresh() {
  await loadCatalog()
  await loadDaily()
}

onMounted(refresh)

</script>

<style scoped>
.model-scores {
  padding: 24px;
  color: #1f2937;
}

.page-header,
.card {
  background: var(--surface-bg);
  color: #1f2937;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  margin-bottom: 16px;
}

.eyebrow {
  margin: 0 0 4px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}

h2,
h3,
h4,
.subtitle {
  margin: 0;
}

.subtitle,
.muted {
  color: #64748b;
  font-size: 13px;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-end;
  padding: 16px 20px;
  margin-bottom: 16px;
}

.filters label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: #475569;
}

.filters select,
.filters input[type='search'] {
  min-width: 140px;
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
}

.search-field input {
  min-width: 180px;
}

.toggle-field {
  flex-direction: row !important;
  align-items: center;
  gap: 8px !important;
}

.models-card {
  padding: 16px 20px;
  margin-bottom: 16px;
}

.models-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
}

.models-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 8px;
}

.model-option {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  gap: 2px 8px;
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  cursor: pointer;
}

.model-option input {
  grid-row: span 2;
  align-self: center;
}

.model-option.selected {
  border-color: #2563eb;
  background: #eff6ff;
}

.model-option.stale {
  opacity: 0.65;
}

.model-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: #0f172a;
  overflow-wrap: anywhere;
}

.model-meta {
  font-size: 12px;
  color: #64748b;
}

.status-card {
  padding: 14px 20px;
  margin-bottom: 16px;
}

.status-line {
  display: flex;
  gap: 12px;
  align-items: baseline;
  margin-bottom: 8px;
}

.status-models {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-model {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: baseline;
  font-size: 13px;
}

.status-model.unavailable {
  color: #b45309;
}

.warn {
  color: #b45309;
}

.stats {
  color: #475569;
}

.compare-card {
  padding: 16px 20px;
  margin-bottom: 16px;
}

.correlation-table {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0 16px;
  font-size: 13px;
}

.correlation-table th,
.correlation-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
}

.corr-high {
  color: #047857;
  font-weight: 600;
}

.corr-mid {
  color: #b45309;
}

.corr-low {
  color: #b91c1c;
  font-weight: 600;
}

.disagreements {
  margin-top: 12px;
}

.disagreement-pair h4 {
  margin-bottom: 6px;
  font-size: 13px;
  color: #334155;
}

.disagreement-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.chip {
  padding: 2px 8px;
  border-radius: 999px;
  background: #f1f5f9;
  font-size: 12px;
  color: #334155;
}

.table-card {
  padding: 0;
  overflow: hidden;
}

.table-scroll {
  overflow-x: auto;
}

.table-card table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table-card th,
.table-card td {
  padding: 8px 10px;
  border-bottom: 1px solid #eef2f7;
  white-space: nowrap;
  text-align: left;
}

.table-card thead th {
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
  position: sticky;
  top: 0;
}

.model-col {
  min-width: 150px;
}

.model-col-title {
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}

.model-col-sub {
  display: block;
  font-size: 11px;
  color: #94a3b8;
  font-weight: 400;
}

.rank-col {
  width: 56px;
}

.mark-col {
  width: 64px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.rank {
  font-weight: 600;
}

.pct {
  margin-left: 6px;
  color: #64748b;
  font-size: 12px;
}

.delta {
  margin-left: 6px;
  font-size: 12px;
  color: #94a3b8;
}

.rank-up {
  color: #047857;
}

.rank-down {
  color: #b91c1c;
}

tr.in-top td:first-child {
  border-left: 3px solid #2563eb;
}

.empty {
  text-align: center;
  color: #64748b;
}

.error {
  color: #b91c1c;
  margin: 0 0 12px;
}

@media (max-width: 720px) {
  .model-scores {
    padding: 12px;
  }

  .disagreement-columns {
    grid-template-columns: 1fr;
  }

  .filters {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
