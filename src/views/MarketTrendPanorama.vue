<template>
  <div class="trend-panorama">
    <header class="tp-header">
      <div>
        <h2 class="tp-title">市场趋势全景图</h2>
        <p class="tp-sub">宽基指数 + 申万行业 · 0–100 趋势强度分（相对自身历史）</p>
      </div>
      <div class="tp-header-right">
        <span v-if="asOf" class="tp-asof">数据截至 {{ formatDate(asOf) }}</span>
        <button type="button" class="tp-btn" :disabled="loading" @click="load">
          {{ loading ? '加载中…' : '刷新' }}
        </button>
      </div>
    </header>

    <section class="tp-controls" aria-label="筛选">
      <div class="tp-control-group">
        <span class="tp-control-label">区间</span>
        <button
          v-for="opt in dayOptions"
          :key="opt"
          type="button"
          class="tp-chip"
          :class="{ active: days === opt }"
          :disabled="loading"
          @click="setDays(opt)"
        >{{ opt }}日</button>
      </div>

      <div class="tp-control-group">
        <span class="tp-control-label">分组</span>
        <button
          v-for="g in groupOptions"
          :key="g.key"
          type="button"
          class="tp-chip"
          :class="{ active: activeGroups.includes(g.key) }"
          @click="toggleGroup(g.key)"
        >{{ g.name }}</button>
      </div>

      <div class="tp-control-group">
        <span class="tp-control-label">排序</span>
        <button
          type="button"
          class="tp-chip"
          :class="{ active: sortMode === 'fixed' }"
          @click="sortMode = 'fixed'"
        >固定顺序</button>
        <button
          type="button"
          class="tp-chip"
          :class="{ active: sortMode === 'latest' }"
          @click="sortMode = 'latest'"
        >按最新分</button>
      </div>
    </section>

    <section class="tp-legend" aria-label="色阶图例">
      <span class="tp-legend-end">弱 0</span>
      <span class="tp-legend-bar" :style="{ background: legendGradient }"></span>
      <span class="tp-legend-end">100 强</span>
      <span class="tp-legend-note">50 = 自身历史中性；颜色只编码分数，不编码涨跌幅</span>
    </section>

    <div v-if="loading && !data" class="tp-state">趋势数据加载中…</div>
    <div v-else-if="error" class="tp-state is-error">{{ error }}</div>
    <div v-else-if="!visibleColumns.length" class="tp-state">暂无数据</div>
    <div v-else class="tp-scroll">
      <table class="tp-table" aria-label="市场趋势分矩阵">
        <thead>
          <tr class="tp-group-row">
            <th class="tp-date-col" rowspan="2" scope="col">日期</th>
            <th
              v-for="g in visibleGroups"
              :key="g.key"
              :colspan="g.items.length"
              class="tp-group-head"
              scope="colgroup"
            >{{ g.name }}</th>
          </tr>
          <tr class="tp-name-row">
            <th
              v-for="item in visibleColumns"
              :key="item.code"
              class="tp-name-cell"
              scope="col"
              :title="`${item.name}（${item.code}）`"
            >{{ item.name }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.date">
            <th class="tp-date-col" scope="row">{{ formatDate(row.date) }}</th>
            <td
              v-for="item in visibleColumns"
              :key="item.code"
              class="tp-cell"
              :style="trendCellStyle(item.scores[row.idx])"
              :title="cellTitle(item, row)"
            >{{ formatTrendScore(item.scores[row.idx]) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <footer class="tp-notes">
      <p><strong>分数口径（trend-v1）：</strong>MA20 偏离、MA60 偏离、MA20 的 10 日斜率、20 日收益、60 日收益，各自做 750 个交易日滚动分位后取均值。</p>
      <p><strong>怎么读：</strong>分数是「相对自身历史」的强弱——0 表示自身近三年最弱，100 表示最强。不同资产之间的分数不是同一把绝对尺子。</p>
      <p><strong>边界：</strong>分数变化慢，用于观察趋势；它没有经过交易规则验证，不构成买卖信号。</p>
      <p><strong>数据：</strong>宽基来自 <code>index_prices</code>（2005 起）；申万 L1/主题来自 <code>sw_daily</code>（2016-07 起，SW2021 分类，历史为回填序列）。</p>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { fetchMarketTrendPanorama } from '../api/marketTrend'
import { formatTrendScore, trendCellStyle, trendLegendGradient } from '../utils/trendHeatmapScale'

const dayOptions = [30, 60, 120]
const groupOptions = [
  { key: 'broad', name: '宽基' },
  { key: 'sw1', name: '申万一级' },
  { key: 'theme', name: '主题' },
]

const data = ref(null)
const loading = ref(false)
const error = ref('')
const days = ref(60)
const sortMode = ref('fixed')
const activeGroups = ref(groupOptions.map((g) => g.key))

const legendGradient = trendLegendGradient()
const asOf = computed(() => data.value?.as_of || '')

const dateIndex = computed(() => data.value?.dates || [])

const rows = computed(() => {
  // 后端按日期升序返回；表格按最新在上展示，idx 指回原数组
  return dateIndex.value.map((date, idx) => ({ date, idx })).reverse()
})

const visibleGroups = computed(() => {
  const byKey = Object.fromEntries((data.value?.groups || []).map((g) => [g.key, g]))
  return groupOptions
    .filter((opt) => activeGroups.value.includes(opt.key) && byKey[opt.key]?.items?.length)
    .map((opt) => {
      const group = byKey[opt.key]
      const items = sortMode.value === 'latest'
        ? [...group.items].sort((a, b) => (b.latest ?? -1) - (a.latest ?? -1))
        : group.items
      return { ...group, items }
    })
})

const visibleColumns = computed(() => visibleGroups.value.flatMap((g) => g.items))

function formatDate(raw) {
  const value = String(raw || '')
  if (value.length !== 8) return value
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
}

function formatDelta(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  const rounded = Math.round(n * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded}`
}

function cellTitle(item, row) {
  const score = item.scores[row.idx]
  const head = `${item.name} ${formatDate(row.date)}`
  if (score == null) return `${head}\n无评分（历史不足）`
  return `${head}\n趋势分 ${Math.round(score)}\n5日变化 ${formatDelta(item.chg5[row.idx])}\n20日变化 ${formatDelta(item.chg20[row.idx])}`
}

function toggleGroup(key) {
  const current = activeGroups.value
  activeGroups.value = current.includes(key)
    ? current.filter((k) => k !== key)
    : [...current, key]
}

let requestId = 0

async function load() {
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const payload = await fetchMarketTrendPanorama({ days: days.value, include_themes: true })
    if (id !== requestId) return
    data.value = payload
  } catch (err) {
    if (id !== requestId) return
    error.value = err?.message || '趋势数据加载失败'
  } finally {
    if (id === requestId) loading.value = false
  }
}

function setDays(value) {
  if (days.value === value) return
  days.value = value
  load()
}

onMounted(load)
</script>

<style scoped>
.trend-panorama {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  color: var(--text-primary, #172033);
}

.tp-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.tp-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.tp-sub {
  margin: 4px 0 0;
  color: var(--text-muted, #64748b);
  font-size: 13px;
}

.tp-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tp-asof {
  color: var(--text-subtle, #475569);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.tp-btn {
  border: 1px solid var(--surface-border, #dbe3ef);
  background: #fff;
  color: var(--text-primary, #172033);
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 13px;
  cursor: pointer;
}

.tp-btn:disabled {
  cursor: default;
  opacity: 0.6;
}

.tp-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 10px 12px;
  background: var(--surface-bg-muted, #f9fafb);
  border: 1px solid var(--surface-border, #dbe3ef);
  border-radius: 10px;
}

.tp-control-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tp-control-label {
  color: var(--text-muted, #64748b);
  font-size: 12px;
}

.tp-chip {
  border: 1px solid var(--surface-border, #dbe3ef);
  background: #fff;
  color: var(--text-subtle, #475569);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}

.tp-chip.active {
  border-color: #256abf;
  background: #e9f1fc;
  color: #184f95;
  font-weight: 600;
}

.tp-chip:disabled {
  cursor: default;
  opacity: 0.6;
}

.tp-legend {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--text-muted, #64748b);
}

.tp-legend-bar {
  width: 180px;
  height: 10px;
  border-radius: 999px;
  border: 1px solid var(--surface-border, #dbe3ef);
}

.tp-legend-end {
  font-variant-numeric: tabular-nums;
}

.tp-legend-note {
  margin-left: 6px;
  color: var(--text-subtle, #475569);
}

.tp-state {
  padding: 32px 12px;
  text-align: center;
  color: var(--text-muted, #64748b);
  border: 1px dashed var(--surface-border, #dbe3ef);
  border-radius: 10px;
}

.tp-state.is-error {
  color: #b42318;
  border-color: #fda29b;
  background: #fff7f6;
}

.tp-scroll {
  overflow: auto;
  max-height: calc(100vh - 250px);
  border: 1px solid var(--surface-border, #dbe3ef);
  border-radius: 10px;
  background: #fff;
}

.tp-table {
  border-collapse: separate;
  border-spacing: 2px;
  width: max-content;
  min-width: 100%;
  font-variant-numeric: tabular-nums;
}

.tp-table th,
.tp-table td {
  box-sizing: border-box;
}

.tp-group-row th {
  position: sticky;
  top: 0;
  z-index: 3;
  background: #fff;
  color: var(--text-muted, #64748b);
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  padding: 4px 0;
  border-bottom: 1px solid var(--surface-border, #dbe3ef);
}

.tp-name-row th {
  position: sticky;
  top: 26px;
  z-index: 3;
  background: #fff;
  color: var(--text-primary, #172033);
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  padding: 4px 4px;
  min-width: 54px;
  max-width: 74px;
  line-height: 1.2;
  vertical-align: bottom;
}

.tp-date-col {
  position: sticky;
  left: 0;
  z-index: 4;
  background: #fff;
  color: var(--text-subtle, #475569);
  font-size: 11px;
  font-weight: 500;
  text-align: right;
  padding: 0 8px;
  min-width: 84px;
  white-space: nowrap;
}

thead .tp-date-col {
  z-index: 5;
  top: 0;
  text-align: left;
  vertical-align: middle;
}

.tp-name-cell {
  border-radius: 4px;
}

.tp-cell {
  height: 28px;
  min-width: 54px;
  padding: 0 4px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  border-radius: 4px;
  cursor: default;
}

tbody tr:hover .tp-cell {
  box-shadow: inset 0 0 0 2px #172033;
}

.tp-notes {
  margin: 4px 0 0;
  padding: 12px 14px;
  border-left: 3px solid #256abf;
  background: var(--surface-bg-muted, #f9fafb);
  border-radius: 0 8px 8px 0;
  color: var(--text-subtle, #475569);
  font-size: 12px;
  line-height: 1.7;
}

.tp-notes p {
  margin: 0 0 4px;
}

.tp-notes p:last-child {
  margin-bottom: 0;
}

.tp-notes code {
  background: #eef2f7;
  border-radius: 4px;
  padding: 0 4px;
  font-size: 11px;
}

@media (max-width: 720px) {
  .trend-panorama {
    padding: 10px;
  }

  .tp-scroll {
    max-height: calc(100vh - 220px);
  }

  .tp-cell {
    min-width: 46px;
    height: 26px;
  }

  .tp-name-row th {
    min-width: 46px;
    font-size: 10px;
  }
}
</style>
