<template>
  <div class="portfolio-overview">
    <header class="overview-header">
      <h2>组合总览（实盘 · 跨调仓）</h2>
      <p class="muted">
        按策略参数血缘（params_hash）合并多期 plan 的 live 成交与持仓盈亏；净值曲线由各 plan 的日更
        <code>portfolio_live_equity</code> 按日期拼接（见下方说明）。
      </p>
    </header>

    <section class="toolbar">
      <label class="field">
        <span>选择组合</span>
        <select v-model="selectedLatestPlanId" :disabled="loadingList || !portfolios.length">
          <option value="">请选择</option>
          <option v-for="p in portfolios" :key="`${p.strategy_template_id}-${p.params_hash}`" :value="p.latest_plan_id">
            {{ p.strategy_name || p.strategy_template_id }} · {{ p.last_base_date || '-' }}
            （{{ p.plan_count }} 期 plan{{ p.securities_account_id ? ` · 账户 ${p.securities_account_id.slice(-6)}` : '' }}）
          </option>
        </select>
      </label>
      <button type="button" :disabled="!selectedLatestPlanId || loadingDetail" @click="refreshDetail">
        <span v-if="loadingDetail" class="spinner" />
        {{ loadingDetail ? '加载中…' : '刷新' }}
      </button>
    </section>

    <p v-if="message" class="message" :class="{ error: messageIsError }">{{ message }}</p>

    <template v-if="selectedLatestPlanId">
      <section v-if="equityCaveat" class="caveat-box">
        <strong>说明：</strong>{{ equityCaveat }}
      </section>

      <section class="chart-section">
        <h3>净值曲线（血缘拼接）</h3>
        <div v-if="!equityRows.length" class="muted">暂无净值数据。</div>
        <div v-else class="equity-chart" aria-label="Lineage live equity">
          <svg viewBox="0 0 640 220" preserveAspectRatio="none">
            <polyline :points="equityChart.points" />
            <text x="36" y="22">{{ money(equityChart.max) }}</text>
            <text x="36" y="186">{{ money(equityChart.min) }}</text>
            <text
              v-for="label in equityChart.labels"
              :key="label.text"
              :x="label.x"
              :y="label.y"
              :text-anchor="label.anchor"
            >
              {{ label.text }}
            </text>
          </svg>
          <p v-if="equityChart.latestReturn != null" class="chart-meta">
            区间收益：<strong>{{ signedPct(equityChart.latestReturn) }}</strong>
          </p>
        </div>
      </section>

      <section class="summary-cards" v-if="positionSummary">
        <div class="card">
          <div class="label">持仓市值</div>
          <div class="value">{{ money(positionSummary.total_market_value) }}</div>
        </div>
        <div class="card">
          <div class="label">已实现盈亏</div>
          <div class="value">{{ signedMoney(positionSummary.total_realized_pnl) }}</div>
        </div>
        <div class="card">
          <div class="label">浮动盈亏</div>
          <div class="value">{{ signedMoney(positionSummary.total_unrealized_pnl) }}</div>
        </div>
        <div class="card">
          <div class="label">持仓标的数</div>
          <div class="value">{{ positionSummary.holding_count }}</div>
        </div>
      </section>

      <section>
        <h3>组合持仓（按成交流水重算）</h3>
        <div v-if="!positionRows.length" class="muted">暂无持仓或尚无成交。</div>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>代码</th>
                <th>数量</th>
                <th>均价</th>
                <th>现价</th>
                <th>市值</th>
                <th>已实现</th>
                <th>浮动</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in positionRows" :key="row.symbol">
                <td>{{ row.symbol }}</td>
                <td>{{ row.shares }}</td>
                <td>{{ num(row.avg_cost) }}</td>
                <td>{{ num(row.last_price) }}</td>
                <td>{{ money(row.market_value) }}</td>
                <td>{{ signedMoney(row.realized_pnl) }}</td>
                <td>{{ signedMoney(row.unrealized_pnl) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3>完整成交流水</h3>
        <div v-if="!executionRows.length" class="muted">暂无成交记录。</div>
        <div v-else class="table-wrap compact">
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>代码</th>
                <th>方向</th>
                <th>数量</th>
                <th>价格</th>
                <th>来源 plan</th>
                <th>调仓日</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in executionRows" :key="`${row.order_id}-${idx}`">
                <td>{{ row.display_time || row.timestamp || '-' }}</td>
                <td>{{ row.symbol || '-' }}</td>
                <td>{{ (row.side || row.action || '-').toString().toUpperCase() }}</td>
                <td>{{ row.filled_size || row.quantity || row.size || '-' }}</td>
                <td>{{ num(row.filled_price || row.price) }}</td>
                <td class="truncate" :title="row.source_plan_id">{{ row.source_plan_id || row.plan_id || '-' }}</td>
                <td>{{ row.source_plan_base_date || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import {
  getLineageLiveEquity,
  getLineageLiveExecutions,
  getLineageLivePositions,
  listLivePortfolios,
} from '../api/portfolioPlans'

const portfolios = ref([])
const selectedLatestPlanId = ref('')
const loadingList = ref(false)
const loadingDetail = ref(false)
const message = ref('')
const messageIsError = ref(false)

const equityRows = ref([])
const equityCaveat = ref('')
const positionRows = ref([])
const positionSummary = ref(null)
const executionRows = ref([])

const equityChart = computed(() => {
  const rows = equityRows.value
  if (!rows.length) return { points: '', labels: [], min: 0, max: 0, latestReturn: null }
  const values = rows.map((row) => Number(row.equity))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const width = 640
  const height = 220
  const pad = 28
  const points = rows
    .map((row, index) => {
      const x = rows.length === 1 ? width / 2 : pad + (index * (width - pad * 2)) / (rows.length - 1)
      const y = height - pad - ((row.equity - min) * (height - pad * 2)) / span
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const first = rows[0].equity
  const latest = rows[rows.length - 1].equity
  return {
    points,
    min,
    max,
    latestReturn: first ? latest / first - 1 : null,
    labels: [
      { text: rows[0].date, x: pad, y: height - 6, anchor: 'start' },
      { text: rows[rows.length - 1].date, x: width - pad, y: height - 6, anchor: 'end' },
    ],
  }
})

function money(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) : '-'
}

function num(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(4) : '-'
}

function signedMoney(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  const formatted = Math.abs(number).toLocaleString('zh-CN', { maximumFractionDigits: 0 })
  return `${number >= 0 ? '+' : '-'}${formatted}`
}

function signedPct(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return `${number >= 0 ? '+' : ''}${(number * 100).toFixed(2)}%`
}

function formatApiDetail(detail) {
  if (!detail) return ''
  if (typeof detail === 'string') return detail
  if (typeof detail === 'object' && detail.message) return String(detail.message)
  try {
    return JSON.stringify(detail)
  } catch {
    return String(detail)
  }
}

async function loadPortfolios() {
  loadingList.value = true
  message.value = ''
  messageIsError.value = false
  try {
    const res = await listLivePortfolios()
    portfolios.value = res.data?.portfolios || []
    if (!portfolios.value.length) {
      message.value = '当前没有已发布实盘的组合血缘（或暂无 params_hash）。'
    }
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '加载组合列表失败'
    messageIsError.value = true
  } finally {
    loadingList.value = false
  }
}

async function refreshDetail() {
  const planId = selectedLatestPlanId.value
  if (!planId) return
  loadingDetail.value = true
  message.value = ''
  messageIsError.value = false
  try {
    const [eqRes, posRes, exRes] = await Promise.all([
      getLineageLiveEquity(planId),
      getLineageLivePositions(planId),
      getLineageLiveExecutions(planId),
    ])
    equityRows.value = (eqRes.data?.rows || []).map((row) => ({
      ...row,
      equity: Number(row.equity),
    }))
    equityCaveat.value = eqRes.data?.caveat || ''
    positionRows.value = posRes.data?.positions || []
    positionSummary.value = posRes.data?.summary || null
    executionRows.value = exRes.data?.executions || []
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '加载详情失败'
    messageIsError.value = true
  } finally {
    loadingDetail.value = false
  }
}

watch(selectedLatestPlanId, (id) => {
  if (id) refreshDetail()
  else {
    equityRows.value = []
    equityCaveat.value = ''
    positionRows.value = []
    positionSummary.value = null
    executionRows.value = []
  }
})

onMounted(() => {
  loadPortfolios()
})
</script>

<style scoped>
/* Align contrast with PortfolioPlans.vue: #111827 body, #374151 secondary */
.portfolio-overview {
  background: #fff;
  box-sizing: border-box;
  color: #111827;
  line-height: 1.5;
  margin: 0 auto;
  max-width: 1200px;
  padding: 24px;
  width: 100%;
}

.overview-header h2 {
  color: #111827;
  font-size: 20px;
  margin: 0 0 8px;
}

.muted {
  color: #374151;
  font-size: 13px;
  margin: 0;
}

.muted code {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  color: #111827;
  font-size: 12px;
  padding: 1px 6px;
}

.toolbar {
  align-items: flex-end;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 20px 0 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.field span {
  color: #111827;
  font-weight: 600;
}

.field select,
button {
  background: #fff;
  border: 1px solid #111827;
  border-radius: 4px;
  color: #111827;
  padding: 8px 10px;
}

.field select {
  min-width: 420px;
}

.field select:disabled,
button:disabled {
  border-color: #9ca3af;
  color: #6b7280;
  cursor: not-allowed;
  opacity: 1;
}

.message {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  color: #111827;
  font-size: 14px;
  padding: 10px 12px;
}

.message.error {
  background: #fef2f2;
  border-color: #b91c1c;
  color: #7f1d1d;
}

.caveat-box {
  background: #fffbeb;
  border: 1px solid #d97706;
  border-radius: 6px;
  color: #422006;
  font-size: 13px;
  line-height: 1.55;
  margin-bottom: 16px;
  padding: 12px 14px;
}

.caveat-box strong {
  color: #1c1917;
}

.chart-section h3,
section h3 {
  color: #111827;
  font-size: 15px;
  font-weight: 600;
  margin: 20px 0 8px;
}

.equity-chart {
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 10px;
}

.equity-chart svg {
  height: 220px;
  width: 100%;
}

.equity-chart polyline {
  fill: none;
  stroke: #1d4ed8;
  stroke-width: 2.5;
}

.equity-chart text {
  fill: #374151;
  font-size: 12px;
}

.chart-meta {
  color: #374151;
  font-size: 13px;
  margin: 10px 0 0;
}

.chart-meta strong {
  color: #111827;
}

.summary-cards {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  margin: 16px 0;
}

.summary-cards .card {
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 12px 14px;
}

.summary-cards .label {
  color: #374151;
  font-size: 12px;
  font-weight: 500;
}

.summary-cards .value {
  color: #111827;
  font-size: 18px;
  font-weight: 700;
  margin-top: 6px;
}

.table-wrap {
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  overflow-x: auto;
}

.table-wrap.compact table {
  font-size: 13px;
}

table {
  border-collapse: collapse;
  width: 100%;
}

th,
td {
  border-bottom: 1px solid #e5e7eb;
  color: #111827;
  padding: 10px 12px;
  text-align: left;
}

th {
  background: #f3f4f6;
  color: #111827;
  font-size: 13px;
  font-weight: 600;
}

tbody tr:hover td {
  background: #f9fafb;
}

.truncate {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spinner {
  animation: spin 0.8s linear infinite;
  border: 2px solid #d1d5db;
  border-radius: 50%;
  border-top-color: #111827;
  display: inline-block;
  height: 12px;
  margin-right: 6px;
  vertical-align: middle;
  width: 12px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

button {
  cursor: pointer;
  font-weight: 500;
}
</style>
