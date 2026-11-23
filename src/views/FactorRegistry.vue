<template>
  <section class="factor-registry">
    <header class="page-header">
      <div>
        <p class="eyebrow">Factor Registry</p>
        <h2>📚 因子注册表</h2>
        <p class="subtitle">
          有哪些因子、各自经过什么检验、结果怎么看，以及它们如何组合成模型。
          数据来自 quant_trading.factor_registry / factor_tests 与 quant_ml.models。
        </p>
      </div>
      <button type="button" class="secondary-btn" :disabled="loading" @click="refresh">刷新</button>
    </header>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <section class="summary-grid">
      <div v-for="card in summaryCards" :key="card.key" class="summary-card">
        <span class="summary-value">{{ card.value }}</span>
        <span class="summary-label">{{ card.label }}</span>
      </div>
    </section>

    <div class="view-switch">
      <button type="button" :class="{ active: view === 'factors' }" @click="view = 'factors'">因子</button>
      <button type="button" :class="{ active: view === 'models' }" @click="openModels">模型候选</button>
    </div>

    <template v-if="view === 'factors'">
      <section class="filters card">
        <label>
          状态
          <select v-model="statusFilter" @change="loadFactors">
            <option value="">全部</option>
            <option v-for="item in statuses" :key="item" :value="item">{{ item }}</option>
          </select>
        </label>
        <label>
          来源
          <select v-model="sourceFilter" @change="loadFactors">
            <option value="">全部</option>
            <option v-for="item in sourceOptions" :key="item" :value="item">{{ item }}</option>
          </select>
        </label>
        <label class="search-field">
          搜索
          <input v-model.trim="search" type="search" placeholder="因子 id 或名称" @keyup.enter="loadFactors" />
        </label>
        <label class="toggle-field">
          <input v-model="testedOnly" type="checkbox" @change="loadFactors" />
          只看有测试的
        </label>
      </section>

      <div class="split">
        <section class="card table-card">
          <table>
            <thead>
              <tr>
                <th>因子</th>
                <th>来源</th>
                <th>状态</th>
                <th>覆盖</th>
                <th>测试</th>
                <th>最新判决</th>
                <th>日期</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in factors"
                :key="row.factor_id"
                :class="{ selected: row.factor_id === selectedId }"
                @click="selectFactor(row.factor_id)"
              >
                <td>
                  <code>{{ row.factor_id }}</code>
                  <small v-if="row.family">{{ row.family }}</small>
                </td>
                <td>{{ row.source }}</td>
                <td><span class="pill" :class="row.status">{{ row.status }}</span></td>
                <td>{{ pct(row.coverage) }}</td>
                <td>{{ row.tests }}</td>
                <td>
                  {{ row.latest || '-' }}
                  <small v-if="row.latest_type">({{ row.latest_type }})</small>
                </td>
                <td>{{ row.as_of || '-' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="!loading && !factors.length" class="muted empty">没有匹配的因子。</p>
          <p v-if="loading" class="muted empty">加载中...</p>
        </section>

        <aside class="card detail-card">
          <template v-if="detail">
            <h3>{{ detail.registry._id }}</h3>
            <p class="muted">
              {{ detail.registry.source }} · {{ detail.registry.family || '未分组' }} ·
              <span class="pill" :class="detail.registry.status">{{ detail.registry.status }}</span>
            </p>
            <p v-if="detail.registry.formula" class="formula">{{ detail.registry.formula }}</p>
            <p v-if="detail.registry.description" class="muted">{{ detail.registry.description }}</p>
            <p v-if="detail.registry.aliases?.length" class="muted">
              aliases: {{ detail.registry.aliases.join(', ') }}
            </p>

            <section v-if="coverageRows.length" class="coverage">
              <h4>覆盖率</h4>
              <p class="muted">
                总体 {{ pct(detail.registry.coverage?.pct) }}
                （{{ detail.registry.coverage?.non_null }} / {{ detail.registry.coverage?.total }}）
              </p>
              <div class="coverage-bars">
                <div v-for="item in coverageRows" :key="item.year" class="coverage-row">
                  <span>{{ item.year }}</span>
                  <span class="bar"><i :style="{ width: `${Math.round(item.pct * 100)}%` }" /></span>
                  <span class="coverage-pct">{{ pct(item.pct) }}</span>
                </div>
              </div>
            </section>

            <section>
              <h4>检验证据（最近 {{ detail.tests.length }} 条）</h4>
              <table class="tests">
                <thead>
                  <tr><th>类型</th><th>阶段</th><th>判决</th><th>口径</th><th>日期</th><th>指标</th></tr>
                </thead>
                <tbody>
                  <tr v-for="test in detail.tests" :key="test._id">
                    <td>{{ test.test_type }}</td>
                    <td>{{ test.stage }}</td>
                    <td><span class="pill" :class="test.verdict">{{ test.verdict }}</span></td>
                    <td class="protocol">
                      {{ test.protocol?.pool || '-' }} · {{ test.protocol?.window || '-' }} ·
                      h{{ test.protocol?.horizon ?? '-' }}
                    </td>
                    <td>{{ test.as_of || '-' }}</td>
                    <td>{{ metricText(test) }}</td>
                  </tr>
                </tbody>
              </table>
              <p v-if="!detail.tests.length" class="muted">还没有测试记录。</p>
            </section>

            <section v-if="detail.used_by_models?.length">
              <h4>被哪些模型使用</h4>
              <div class="model-chips">
                <span v-for="model in detail.used_by_models" :key="model.model_id" class="model-chip">
                  {{ model.model_id }} <small>{{ model.state }}</small>
                </span>
              </div>
            </section>
          </template>
          <p v-else class="muted empty">选择左侧因子查看定义、测试证据和模型使用。</p>
        </aside>
      </div>
    </template>

    <template v-else>
      <section class="filters card">
        <label>
          模型状态
          <select v-model="modelStateFilter" @change="loadModels">
            <option value="">全部</option>
            <option v-for="item in modelStates" :key="item" :value="item">{{ item }}</option>
          </select>
        </label>
        <span class="muted">模型按 state 排序；factor_status 是每个特征在注册表里的状态。</span>
      </section>

      <section class="card table-card">
        <table>
          <thead>
            <tr><th>模型</th><th>状态</th><th>类型</th><th>特征</th><th>因子状态</th></tr>
          </thead>
          <tbody>
            <tr v-for="model in models" :key="model.model_id">
              <td>
                <code>{{ model.model_id }}</code>
                <small v-if="model.display_name">{{ model.display_name }}</small>
              </td>
              <td><span class="pill" :class="model.state">{{ model.state }}</span></td>
              <td>{{ model.model_type || '-' }}</td>
              <td>
                <span v-for="f in model.features" :key="`${f.factor_id}-${f.name}`" class="feature-chip">
                  {{ f.name }}
                  <small v-if="f.factor_id">· {{ model.factor_status?.[f.factor_id] || '-' }}</small>
                </span>
              </td>
              <td>{{ Object.keys(model.factor_status || {}).length }} 个因子</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!loading && !models.length" class="muted empty">没有匹配的模型。</p>
      </section>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  getFactorRegistryDetail,
  getFactorRegistrySummary,
  listFactorRegistry,
  listModelCandidates,
} from '../api/factorRegistry'

const statuses = ['candidate', 'confirmed', 'in_use', 'inconclusive', 'screened', 'no_increment', 'rejected', 'untested']
const modelStates = ['live', 'shadow', 'validated', 'research', 'retired', 'rejected']

const view = ref('factors')
const loading = ref(false)
const errorMessage = ref('')
const summary = ref(null)
const factors = ref([])
const detail = ref(null)
const models = ref([])
const selectedId = ref('')
const statusFilter = ref('')
const sourceFilter = ref('')
const modelStateFilter = ref('')
const search = ref('')
const testedOnly = ref(false)

const summaryCards = computed(() => {
  const s = summary.value || {}
  const board = s.statuses || {}
  return [
    { key: 'total', label: '注册因子', value: s.total ?? '-' },
    { key: 'candidate', label: '候选', value: (board.candidate || 0) + (board.confirmed || 0) },
    { key: 'in_use', label: '在用', value: board.in_use || 0 },
    { key: 'rejected', label: '已否', value: board.rejected || 0 },
    { key: 'untested', label: '未测试', value: s.untested ?? '-' },
  ]
})

const sourceOptions = computed(() => Object.keys(summary.value?.sources || {}).sort())

const coverageRows = computed(() => {
  const byYear = detail.value?.registry?.coverage?.by_year || {}
  return Object.entries(byYear)
    .filter(([, value]) => value != null)
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([year, value]) => ({ year, pct: Number(value) }))
})

function pct(value) {
  if (value == null || Number.isNaN(Number(value))) return '-'
  return `${(Number(value) * 100).toFixed(1)}%`
}

function metricText(test) {
  const m = test.metrics || {}
  const n = (value, digits = 4) => (value == null || Number.isNaN(Number(value)) ? '-' : Number(value).toFixed(digits))
  const p = (value) => (value == null ? '-' : `${(Number(value) * 100).toFixed(2)}%`)
  switch (test.test_type) {
    case 'long_only':
    case 'long_only_oos':
    case 'long_only_group':
      return `net ${p(m.net_ann)}`
    case 'delta_ic':
    case 'delta_ic_group':
      return `ΔIC ${n(m.delta_ic)} t ${n(m.delta_t, 2)} MDE ${n(m.mde80)}`
    case 'quantile':
      return `spread ${n(m.top_minus_bottom_spread)}`
    case 'ic_screen':
      return `IC ${n(m.ic_mean)} t ${n(m.t_stat, 2)}`
    case 'nonoverlap':
    case 'nonoverlap_screen':
      return `IC ${n(m.ic_mean)} t_non ${n(m.nonoverlap_t, 2)} MDE ${n(m.mde80)}`
    case 'ic_nonoverlap':
      return `IC ${n(m.ic_mean)} t ${n(m.nonoverlap_t ?? m.nw_t, 2)} MDE ${n(m.mde80)}`
    default:
      return ''
  }
}

async function loadSummary() {
  const res = await getFactorRegistrySummary()
  summary.value = res || null
}

async function loadFactors() {
  loading.value = true
  errorMessage.value = ''
  try {
    const params = { limit: 500 }
    if (statusFilter.value) params.status = statusFilter.value
    if (sourceFilter.value) params.source = sourceFilter.value
    if (search.value) params.q = search.value
    if (testedOnly.value) params.tested = true
    const res = await listFactorRegistry(params)
    factors.value = res?.rows || []
  } catch (error) {
    errorMessage.value = error?.response?.data?.detail || '因子列表加载失败'
  } finally {
    loading.value = false
  }
}

async function selectFactor(factorId) {
  selectedId.value = factorId
  detail.value = null
  try {
    const res = await getFactorRegistryDetail(factorId)
    detail.value = res || null
  } catch (error) {
    errorMessage.value = error?.response?.data?.detail || '因子详情加载失败'
  }
}

async function loadModels() {
  loading.value = true
  errorMessage.value = ''
  try {
    const params = { limit: 200 }
    if (modelStateFilter.value) params.state = modelStateFilter.value
    const res = await listModelCandidates(params)
    models.value = res?.rows || []
  } catch (error) {
    errorMessage.value = error?.response?.data?.detail || '模型候选加载失败'
  } finally {
    loading.value = false
  }
}

function openModels() {
  view.value = 'models'
  if (!models.value.length) loadModels()
}

async function refresh() {
  await Promise.all([loadSummary(), loadFactors()])
  if (view.value === 'models') await loadModels()
}

onMounted(refresh)
</script>

<style scoped>
.factor-registry {
  box-sizing: border-box;
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
  padding: 28px 32px 40px;
  color: #172033;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #64748b;
  font-size: 12px;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.subtitle {
  margin: 0;
  color: #64748b;
  max-width: 960px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
}

.summary-value {
  font-size: 24px;
  font-weight: 650;
}

.summary-label {
  color: #64748b;
  font-size: 12px;
}

.view-switch {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 16px;
  border-radius: 10px;
  background: #eef2f7;
}

.view-switch button {
  border: 0;
  background: transparent;
  padding: 7px 16px;
  border-radius: 8px;
  cursor: pointer;
  color: #475569;
}

.view-switch button.active {
  background: #fff;
  color: #172033;
  box-shadow: 0 1px 2px rgb(15 23 42 / 8%);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
}

.filters label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #475569;
  font-size: 12px;
}

.filters select,
.filters input[type='search'] {
  min-width: 160px;
  padding: 7px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
}

.toggle-field {
  flex-direction: row !important;
  align-items: center;
  gap: 6px !important;
  padding-bottom: 7px;
}

.split {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(360px, 1fr);
  gap: 16px;
  align-items: start;
}

.table-card {
  padding: 8px 12px 12px;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th,
td {
  padding: 8px 8px;
  border-bottom: 1px solid #eef2f7;
  text-align: left;
  vertical-align: top;
}

th {
  color: #64748b;
  font-weight: 600;
  font-size: 12px;
  white-space: nowrap;
}

tbody tr {
  cursor: pointer;
}

tbody tr:hover {
  background: #f8fafc;
}

tbody tr.selected {
  background: #eef6ff;
}

code {
  display: block;
  font-size: 12px;
}

td small,
td .small {
  display: block;
  color: #94a3b8;
  font-size: 11px;
}

.pill {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  background: #f1f5f9;
  color: #475569;
  white-space: nowrap;
}

.pill.candidate,
.pill.confirmed,
.pill.live {
  background: #dcfce7;
  color: #166534;
}

.pill.in_use,
.pill.shadow {
  background: #dbeafe;
  color: #1d4ed8;
}

.pill.inconclusive,
.pill.validated {
  background: #fef3c7;
  color: #92400e;
}

.pill.no_increment {
  background: #ffedd5;
  color: #9a3412;
}

.pill.rejected,
.pill.retired {
  background: #fee2e2;
  color: #991b1b;
}

.pill.screened,
.pill.untested,
.pill.research {
  background: #f1f5f9;
  color: #475569;
}

.detail-card {
  padding: 16px;
}

.detail-card h3 {
  margin: 0 0 4px;
  font-size: 16px;
}

.detail-card h4 {
  margin: 16px 0 8px;
  font-size: 13px;
}

.formula {
  padding: 8px 10px;
  border-radius: 8px;
  background: #f8fafc;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  word-break: break-all;
}

.coverage-bars {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.coverage-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 52px;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #64748b;
}

.coverage-row .bar {
  height: 6px;
  border-radius: 999px;
  background: #eef2f7;
  overflow: hidden;
}

.coverage-row .bar i {
  display: block;
  height: 100%;
  background: #60a5fa;
}

.coverage-pct {
  text-align: right;
}

.tests td {
  font-size: 12px;
}

.protocol {
  color: #64748b;
  white-space: nowrap;
}

.model-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.model-chip,
.feature-chip {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 8px;
  background: #f1f5f9;
  font-size: 11px;
  color: #334155;
}

.feature-chip {
  margin: 0 1px 2px 0;
}

.feature-chip small {
  color: #94a3b8;
}

.muted {
  color: #64748b;
}

.empty {
  padding: 16px 4px;
}

.error {
  padding: 8px 12px;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
}

@media (max-width: 1080px) {
  .split {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .factor-registry {
    padding: 16px;
  }

  .page-header {
    flex-direction: column;
  }
}
</style>
