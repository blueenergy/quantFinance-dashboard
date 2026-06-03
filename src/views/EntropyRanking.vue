<template>
  <section class="entropy-ranking">
    <header class="page-header">
      <div>
        <p class="eyebrow">Entropy Factor</p>
        <h2>熵值因子排名</h2>
        <p class="subtitle">内部熵减（基本面改善）× 外部熵减（筹码集中）× 未拉升门控</p>
      </div>
      <button :disabled="loading" @click="refresh">刷新</button>
    </header>

    <section class="filters card">
      <label>
        截面日期
        <select v-model="selectedDate" @change="loadRankings">
          <option v-for="date in dates" :key="date" :value="date">{{ date }}</option>
        </select>
      </label>
      <label>
        指数
        <select v-model="indexCode" @change="loadRankings">
          <option value="csi1000">中证1000</option>
          <option value="csi500">中证500</option>
          <option value="hs300">沪深300</option>
          <option value="a500">中证A500</option>
          <option value="star50">科创50</option>
        </select>
      </label>
      <label>
        数量
        <select v-model.number="limit" @change="loadRankings">
          <option :value="50">50</option>
          <option :value="100">100</option>
          <option :value="200">200</option>
          <option :value="500">500</option>
        </select>
      </label>
    </section>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <p v-if="loading" class="muted">加载中...</p>

    <section class="card table-card">
      <table>
        <thead>
          <tr>
            <th>排名</th>
            <th>代码</th>
            <th>名称</th>
            <th>行业</th>
            <th>最终熵值</th>
            <th>原始熵值</th>
            <th>1个月后</th>
            <th>2个月后</th>
            <th>3个月后</th>
            <th>未拉升</th>
            <th>胜率</th>
            <th>因子数</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, idx) in rows"
            :key="`${row.symbol}-${row.score_date}`"
            :class="{ selected: selectedSymbol === row.symbol }"
            @click="selectSymbol(row.symbol)"
          >
            <td>{{ idx + 1 }}</td>
            <td class="mono">{{ row.symbol }}</td>
            <td>{{ row.name || '-' }}</td>
            <td>{{ row.industry || '-' }}</td>
            <td>{{ num(row.final_entropy_score) }}</td>
            <td>{{ num(row.entropy_score) }}</td>
            <td :class="returnClass(row.future_return_1m_pct)">{{ signedPct(row.future_return_1m_pct) }}</td>
            <td :class="returnClass(row.future_return_2m_pct)">{{ signedPct(row.future_return_2m_pct) }}</td>
            <td :class="returnClass(row.future_return_3m_pct)">{{ signedPct(row.future_return_3m_pct) }}</td>
            <td>{{ num(row.not_lifted_gate) }}</td>
            <td>{{ pct(row.winner_rate) }}</td>
            <td>{{ num(row.factors_used, 0) }}</td>
          </tr>
          <tr v-if="!loading && !rows.length">
            <td colspan="12" class="empty">暂无熵值排名数据，请先生成 entropy_scores。</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="selectedSymbol" class="card history-card">
      <h3>{{ selectedSymbol }} 历史熵值</h3>
      <div class="history-list">
        <span v-for="row in historyRows" :key="row.score_date">
          {{ row.score_date }}：{{ num(row.final_entropy_score) }}
        </span>
      </div>
    </section>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { getEntropyDates, getEntropyRankings, getSymbolEntropyHistory } from '../api/entropy'

const dates = ref([])
const selectedDate = ref('')
const indexCode = ref('csi1000')
const limit = ref(100)
const rows = ref([])
const historyRows = ref([])
const selectedSymbol = ref('')
const loading = ref(false)
const errorMessage = ref('')

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
  const number = Number(value)
  return `${number > 0 ? '+' : ''}${number.toFixed(1)}%`
}

function returnClass(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return ''
  const number = Number(value)
  if (number > 0) return 'return-positive'
  if (number < 0) return 'return-negative'
  return ''
}

async function loadDates() {
  const res = await getEntropyDates({ limit: 80 })
  dates.value = res?.data || []
  if (!selectedDate.value && dates.value.length) {
    selectedDate.value = dates.value[0]
  }
}

async function loadRankings() {
  if (!selectedDate.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await getEntropyRankings({
      score_date: selectedDate.value,
      index_code: indexCode.value,
      limit: limit.value,
    })
    rows.value = res?.data?.rows || []
    if (selectedSymbol.value) {
      await selectSymbol(selectedSymbol.value)
    }
  } catch (err) {
    errorMessage.value = err?.message || '加载熵值排名失败'
  } finally {
    loading.value = false
  }
}

async function selectSymbol(symbol) {
  selectedSymbol.value = symbol
  const res = await getSymbolEntropyHistory(symbol, { limit: 120 })
  historyRows.value = res?.data || []
}

async function refresh() {
  await loadDates()
  await loadRankings()
}

onMounted(refresh)
</script>

<style scoped>
.entropy-ranking {
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

button,
select {
  color: #111827;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
}

button {
  cursor: pointer;
}

.filters {
  display: flex;
  gap: 16px;
  padding: 16px;
  margin-bottom: 16px;
}

.filters label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: #475569;
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
  padding: 10px 12px;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
  white-space: nowrap;
}

th {
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
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

.return-positive {
  color: #dc2626;
  font-weight: 600;
}

.return-negative {
  color: #16a34a;
  font-weight: 600;
}

.error {
  color: #b91c1c;
}

.history-card {
  margin-top: 16px;
  padding: 16px;
}

.history-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 12px;
  color: #475569;
}
</style>
