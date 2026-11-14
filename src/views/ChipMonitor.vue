<template>
  <section class="chip-monitor">
    <header class="page-header">
      <div>
        <p class="eyebrow">Chip Monitor</p>
        <h2>🧩 筹码监控</h2>
        <p class="subtitle">自选 + 持仓 A 股 · 获利盘 / 集中度 / 筹码峰 / 熵（描述性风险提示，非 alpha 验证）</p>
      </div>
      <button :disabled="loading" @click="load">刷新</button>
    </header>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <p v-if="loading" class="muted">加载中...</p>
    <p v-else-if="dataDate" class="muted">数据截至 {{ dataDate }} · {{ rows.length }} 只 · 点击行查看历史曲线</p>

    <section class="card table-card">
      <table>
        <thead>
          <tr>
            <th v-for="col in columns" :key="col.key" class="sortable" @click="sortBy(col.key)">
              {{ col.label }}<span v-if="sortKey === col.key">{{ sortDir === 1 ? ' ▲' : ' ▼' }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in sortedRows"
            :key="row.symbol"
            :class="{ selected: selectedSymbol === row.symbol }"
            @click="selectedSymbol = row.symbol"
          >
            <td class="mono">{{ row.symbol }}</td>
            <td>{{ row.name || '-' }}</td>
            <td>{{ row.industry || '-' }}</td>
            <td>{{ num(row.close, 2) }}</td>
            <td>{{ num(row.wavg, 2) }}</td>
            <td>{{ pct(row.winner) }}</td>
            <td>{{ num(row.dispersion, 3) }}</td>
            <td>{{ signedPct(row.peak_dev) }}</td>
            <td>{{ pct(row.peak_share) }}</td>
            <td>{{ num(row.s_chip, 3) }}</td>
            <td>{{ num(row.entropy_change_20, 3) }}</td>
            <td>
              <span v-for="flag in row.flags" :key="flag" class="badge">{{ flag }}</span>
              <span v-if="!row.flags || !row.flags.length" class="muted">—</span>
            </td>
          </tr>
          <tr v-if="!loading && !rows.length">
            <td colspan="12" class="empty">暂无筹码数据（等待 cyq_chips 增量任务运行）</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="selectedSymbol" class="card history-card">
      <h3>{{ selectedName }} {{ selectedSymbol }} 历史</h3>
      <div class="spark-list">
        <div v-for="def in sparkDefs" :key="def.key" class="spark-row">
          <span class="spark-label">{{ def.label }}</span>
          <svg :viewBox="`0 0 ${SPARK_W} ${SPARK_H}`" preserveAspectRatio="none" class="spark">
            <polyline :points="sparkPoints(def)" :stroke="def.color" fill="none" stroke-width="1.4" />
          </svg>
          <span class="spark-value">{{ def.format(lastValue(def.key)) }}</span>
        </div>
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { getChipMonitorLatest } from '../api/chipMonitor'

const SPARK_W = 720
const SPARK_H = 48

const columns = [
  { key: 'symbol', label: '代码' },
  { key: 'name', label: '名称' },
  { key: 'industry', label: '行业' },
  { key: 'close', label: '现价' },
  { key: 'wavg', label: '筹码均价' },
  { key: 'winner', label: '获利盘' },
  { key: 'dispersion', label: '集中度' },
  { key: 'peak_dev', label: '主峰偏离' },
  { key: 'peak_share', label: '主峰占比' },
  { key: 's_chip', label: '熵' },
  { key: 'entropy_change_20', label: '20日熵变' },
  { key: 'flags', label: '提示' },
]

const rows = ref([])
const histories = ref({})
const dataDate = ref('')
const loading = ref(false)
const errorMessage = ref('')
const selectedSymbol = ref('')
const sortKey = ref('winner')
const sortDir = ref(-1)

const selectedName = computed(() => {
  const row = rows.value.find((item) => item.symbol === selectedSymbol.value)
  return row ? row.name || '' : ''
})

const sparkDefs = computed(() => [
  { key: 'winner', label: '获利盘 %', lo: 0, hi: 100, color: '#c2410c', format: (v) => pct(v) },
  { key: 'dispersion', label: '集中度', lo: 0, hi: 0.4, color: '#1d4ed8', format: (v) => num(v, 3) },
  { key: 's_chip', label: '熵 0–1', lo: 0, hi: 1, color: '#0f766e', format: (v) => num(v, 3) },
  { key: 'peak_dev', label: '主峰偏离', lo: -0.3, hi: 0.3, color: '#7c3aed', format: (v) => signedPct(v) },
])

const sortedRows = computed(() => {
  const key = sortKey.value
  const dir = sortDir.value
  return [...rows.value].sort((a, b) => {
    if (key === 'symbol' || key === 'name' || key === 'industry') {
      return dir * String(a[key] || '').localeCompare(String(b[key] || ''))
    }
    const av = a[key] === null || a[key] === undefined ? -Infinity : Number(a[key])
    const bv = b[key] === null || b[key] === undefined ? -Infinity : Number(b[key])
    return dir * (av - bv)
  })
})

function num(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return Number(value).toFixed(digits)
}

function pct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return `${Number(value).toFixed(1)}%`
}

function signedPct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  const number = Number(value) * 100
  return `${number > 0 ? '+' : ''}${number.toFixed(1)}%`
}

function sortBy(key) {
  if (sortKey.value === key) {
    sortDir.value = -sortDir.value
  } else {
    sortKey.value = key
    sortDir.value = key === 'symbol' || key === 'name' || key === 'industry' ? 1 : -1
  }
}

function seriesForSelected() {
  return histories.value[selectedSymbol.value] || []
}

function sparkPoints(def) {
  const series = seriesForSelected()
  if (series.length < 2) return ''
  return series
    .map((item, index) => {
      const value = item[def.key]
      if (value === null || value === undefined || Number.isNaN(Number(value))) return null
      const x = (index / (series.length - 1)) * SPARK_W
      const ratio = (Number(value) - def.lo) / (def.hi - def.lo)
      const y = Math.max(0, Math.min(SPARK_H, SPARK_H - ratio * SPARK_H))
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .filter(Boolean)
    .join(' ')
}

function lastValue(key) {
  const series = seriesForSelected()
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const value = series[i][key]
    if (value !== null && value !== undefined && !Number.isNaN(Number(value))) return value
  }
  return null
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await getChipMonitorLatest({ history: 240 })
    const data = res?.data || {}
    rows.value = data.rows || []
    histories.value = data.history || {}
    dataDate.value = data.date || ''
    if (!selectedSymbol.value && rows.value.length) {
      selectedSymbol.value = rows.value[0].symbol
    }
  } catch (err) {
    errorMessage.value = err?.message || '加载筹码监控失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.chip-monitor {
  padding: 24px;
  color: #1f2937;
}

.page-header,
.card {
  background: #fff;
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
  gap: 12px;
  flex-wrap: wrap;
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
.subtitle {
  margin: 0;
}

.subtitle,
.muted {
  color: #64748b;
}

button {
  color: #111827;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
}

.table-card {
  overflow: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 8px 10px;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
  white-space: nowrap;
  font-size: 12px;
}

th {
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
  position: sticky;
  top: 0;
}

th.sortable {
  cursor: pointer;
  user-select: none;
}

tbody tr {
  cursor: pointer;
}

tbody tr:hover,
tbody tr.selected {
  background: #eff6ff;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.empty {
  text-align: center;
  color: #64748b;
}

.badge {
  display: inline-block;
  background: #fef3c7;
  color: #92400e;
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 11px;
  margin-right: 4px;
}

.error {
  color: #b91c1c;
}

.history-card {
  margin-top: 16px;
  padding: 16px;
}

.spark-list {
  margin-top: 12px;
}

.spark-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.spark-label {
  width: 82px;
  font-size: 11px;
  color: #6b7280;
  flex: none;
}

.spark {
  flex: 1;
  height: 44px;
  display: block;
}

.spark-value {
  width: 64px;
  text-align: right;
  font-size: 11px;
  color: #374151;
  flex: none;
}
</style>
