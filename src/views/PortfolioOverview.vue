<template>
  <div class="portfolio-overview">
    <header class="overview-header">
      <h2>组合总览（实盘 + 纸面）</h2>
      <p class="muted">
        按策略参数血缘（params_hash）合并多期 plan；实盘展示 live 成交与持仓，纸面展示 paper 净值与观察周期。
      </p>
    </header>

    <section class="toolbar">
      <label class="field">
        <span>选择组合</span>
        <select v-model="selectedPortfolioKey" :disabled="loadingList || !portfolios.length">
          <option value="">请选择</option>
          <option
            v-for="p in portfolios"
            :key="portfolioKey(p)"
            :value="portfolioKey(p)"
          >
            [{{ fundingModeLabel(p.funding_mode) }}] {{ p.strategy_name || p.strategy_template_id }} · {{ p.last_base_date || '-' }}
            （{{ p.plan_count }} 期{{ p.securities_account_id ? ` · 账户 ${p.securities_account_id.slice(-6)}` : '' }}）
          </option>
        </select>
      </label>
      <button type="button" :disabled="!selectedPortfolioKey || loadingDetail" @click="refreshDetail">
        <span v-if="loadingDetail" class="spinner" />
        {{ loadingDetail ? '加载中…' : '刷新' }}
      </button>
    </section>

    <p v-if="message" class="message" :class="{ error: messageIsError }">{{ message }}</p>

    <template v-if="selectedPortfolioKey && selectedPortfolio">
      <section v-if="timelineData" class="cycle-card" :class="{ 'needs-action': timelineData.action_required }">
        <div class="cycle-card-header">
          <div>
            <h3>当前周期状态</h3>
            <p class="cycle-state">{{ timelineData.today_state }}</p>
          </div>
          <span class="funding-badge" :class="`mode-${selectedPortfolio.funding_mode}`">
            {{ fundingModeLabel(selectedPortfolio.funding_mode) }}
          </span>
        </div>
        <div class="cycle-metrics">
          <div>
            <span class="label">调仓进度</span>
            <strong>
              {{ timelineData.current_cycle?.elapsed_trading_days ?? 0 }}
              / {{ timelineData.current_cycle?.rebalance_days ?? '-' }} 交易日
            </strong>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${cycleProgressPct}%` }" />
            </div>
          </div>
          <div>
            <span class="label">预计下次调仓</span>
            <strong>{{ timelineData.current_cycle?.next_rebalance_estimate || '-' }}</strong>
          </div>
          <div>
            <span class="label">理论漂移换手</span>
            <strong>{{ pct(timelineData.latest_drift_summary?.estimated_turnover) }}</strong>
            <small>
              买 {{ timelineData.latest_drift_summary?.buy_count ?? 0 }}
              / 卖 {{ timelineData.latest_drift_summary?.sell_count ?? 0 }}
            </small>
          </div>
          <div>
            <span class="label">需处理</span>
            <strong>{{ timelineData.action_required ? '是' : '否' }}</strong>
          </div>
        </div>
        <p v-if="timelineData.latest_drift_summary?.non_executable_reason === 'monitor_no_trade'" class="monitor-hint">
          未到调仓周期，本日不交易；上方漂移为若今日调仓的理论变化。
        </p>
      </section>

      <section v-if="foldedTimeline.length" class="timeline-section">
        <h3>观察 / 调仓时间线</h3>
        <ul class="timeline-list">
          <li
            v-for="(entry, idx) in foldedTimeline"
            :key="entry.type === 'monitor_fold' ? `fold-${entry.end}-${idx}` : entry.node.plan_id"
            :class="timelineEntryClass(entry)"
          >
            <template v-if="entry.type === 'monitor_fold'">
              <strong>{{ entry.end }} ~ {{ entry.start }}</strong>
              <span>观察 {{ entry.count }} 次</span>
              <span v-if="entry.maxDrift > 0">最大漂移换手 {{ pct(entry.maxDrift) }}</span>
            </template>
            <template v-else>
              <strong>{{ entry.node.date }}</strong>
              <span class="node-type">{{ entry.node.node_type === 'rebalance' ? '调仓' : '观察' }}</span>
              <span>{{ entry.node.today_state }}</span>
              <span v-if="entry.node.drift_brief?.estimated_turnover != null">
                漂移 {{ pct(entry.node.drift_brief.estimated_turnover) }}
              </span>
            </template>
          </li>
        </ul>
      </section>

      <section v-if="equityCaveat" class="caveat-box">
        <strong>说明：</strong>{{ equityCaveat }}
      </section>

      <section class="summary-cards" v-if="bookEquity">
        <div class="card">
          <div class="label">连续权益（一本账）</div>
          <div class="value">{{ money(bookEquity.equity) }}</div>
        </div>
        <div class="card">
          <div class="label">初始本金</div>
          <div class="value">{{ money(bookEquity.initial_capital) }}</div>
        </div>
        <div class="card">
          <div class="label">可用现金</div>
          <div class="value">{{ money(bookEquity.cash) }}</div>
        </div>
        <div class="card">
          <div class="label">累计盈亏</div>
          <div class="value">{{ signedMoney(Number(bookEquity.realized_pnl || 0) + Number(bookEquity.unrealized_pnl || 0)) }}</div>
        </div>
      </section>

      <section class="chart-section">
        <h3>净值曲线（账户整体权益 · 日频）</h3>
        <div v-if="!equityRowsForChart.length" class="muted">暂无净值数据。</div>
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
          <p v-if="equityRows.length === 0 && equityRowsForChart.length" class="muted chart-note">
            当前暂无账户日权益快照；这里用一本账当前权益生成一个估算点。
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
        <h3>最新持仓</h3>
        <div v-if="!latestHoldingRows.length" class="muted">暂无当前持仓。</div>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>代码</th>
                <th>名称</th>
                <th>数量</th>
                <th>均价</th>
                <th>现价</th>
                <th>市值</th>
                <th>已实现</th>
                <th>浮动</th>
                <th>浮动%</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in latestHoldingRows" :key="row.symbol">
                <td>{{ row.symbol }}</td>
                <td>{{ row.name || '-' }}</td>
                <td>{{ row.shares }}</td>
                <td>{{ num(row.avg_cost) }}</td>
                <td>{{ num(row.last_price) }}</td>
                <td>{{ money(row.market_value) }}</td>
                <td>{{ signedMoney(row.realized_pnl) }}</td>
                <td>{{ signedMoney(row.unrealized_pnl) }}</td>
                <td :class="signClass(row.unrealized_pnl_pct)">{{ signedPct(row.unrealized_pnl_pct) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3>{{ isLivePortfolio ? '实盘成交明细' : '纸面成交明细' }}</h3>
        <div v-if="!isLivePortfolio" class="muted">纸面 FIFO 成交明细将在后续版本补齐；当前请使用计划页查看单次 paper 执行记录。</div>
        <div v-else-if="!tradeDetailRows.length" class="muted">暂无成交记录。</div>
        <div v-else class="table-wrap compact">
          <table>
            <thead>
              <tr>
                <th>调仓日</th>
                <th>代码</th>
                <th>名称</th>
                <th>买入日</th>
                <th>买价</th>
                <th>卖出日</th>
                <th>卖价</th>
                <th>数量</th>
                <th>买入额</th>
                <th>持有收益</th>
                <th>净盈亏</th>
                <th>费用</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in tradeDetailRows" :key="`${row.trade_id || row.buy_order_id || row.symbol}-${idx}`" :class="{ 'open-trade': row.status === 'open' }">
                <td>{{ row.rebalance_date || '-' }}</td>
                <td>{{ row.symbol || '-' }}</td>
                <td>{{ row.name || '-' }}</td>
                <td>{{ row.buy_date || '-' }}</td>
                <td>{{ num(row.buy_price) }}</td>
                <td>{{ row.sell_date || '-' }}</td>
                <td>
                  <span v-if="row.status === 'open'" class="badge-open">持有中</span>
                  <span v-else>{{ num(row.sell_price) }}</span>
                </td>
                <td>{{ money(row.quantity) }}</td>
                <td>{{ money(row.buy_amount) }}</td>
                <td :class="signClass(row.holding_return)">{{ pct(row.holding_return) }}</td>
                <td :class="signClass(row.net_pnl)">{{ signedMoney(row.net_pnl) }}</td>
                <td>{{ money(row.fee) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="totals-row">
                <td colspan="8">合计（{{ tradeTotals.count }} 笔 · 已平 {{ tradeTotals.closedCount }} / 持有 {{ tradeTotals.openCount }}）</td>
                <td>{{ money(tradeTotals.buyAmount) }}</td>
                <td></td>
                <td :class="signClass(tradeTotals.netPnl)">{{ signedMoney(tradeTotals.netPnl) }}</td>
                <td>{{ money(tradeTotals.fee) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p v-if="isLivePortfolio" class="muted combo-note">
          成交明细按 <strong>FIFO（先进先出）</strong> 将每笔卖出与对应买入批次配对，一行为一段往返；未平仓部分以“持有中”行按最新价估算浮动盈亏。
          上方汇总卡片的「已实现盈亏」按<strong>加权平均成本法</strong>计算，与本表净盈亏合计在分批建仓/部分卖出时口径不同，全部平仓后两者一致。
        </p>
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
  getPortfolioPlan,
  getPortfolioPlanLineageEquity,
  getPortfolioPlanLineageTimeline,
  listPortfolios,
} from '../api/portfolioPlans'

const portfolios = ref([])
const selectedPortfolioKey = ref('')
const loadingList = ref(false)
const loadingDetail = ref(false)
const message = ref('')
const messageIsError = ref(false)

const equityRows = ref([])
const equityCaveat = ref('')
const bookEquity = ref(null)
const positionRows = ref([])
const positionSummary = ref(null)
const tradeRows = ref([])
const timelineData = ref(null)

const selectedPortfolio = computed(() => (
  portfolios.value.find((row) => portfolioKey(row) === selectedPortfolioKey.value) || null
))

const selectedLatestPlanId = computed(() => selectedPortfolio.value?.latest_plan_id || '')

const isLivePortfolio = computed(() => selectedPortfolio.value?.funding_mode === 'live')

const cycleProgressPct = computed(() => {
  const cycle = timelineData.value?.current_cycle
  if (!cycle?.rebalance_days) return 0
  const elapsed = Number(cycle.elapsed_trading_days || 0)
  return Math.min(100, Math.round((elapsed / cycle.rebalance_days) * 100))
})

const foldedTimeline = computed(() => {
  const nodes = timelineData.value?.timeline || []
  const folded = []
  let monitorRun = null
  for (const node of nodes) {
    const isPassiveMonitor = node.node_type === 'monitor' && !node.action_required
    if (isPassiveMonitor) {
      const drift = Number(node.drift_brief?.estimated_turnover || 0)
      if (!monitorRun) {
        monitorRun = {
          type: 'monitor_fold',
          start: node.date,
          end: node.date,
          count: 1,
          maxDrift: drift,
        }
      } else {
        monitorRun.end = node.date
        monitorRun.count += 1
        monitorRun.maxDrift = Math.max(monitorRun.maxDrift, drift)
      }
      continue
    }
    if (monitorRun) {
      folded.push(monitorRun)
      monitorRun = null
    }
    folded.push({ type: 'node', node })
  }
  if (monitorRun) folded.push(monitorRun)
  return folded
})

function portfolioKey(portfolio) {
  return `${portfolio.strategy_template_id}:${portfolio.params_hash}`
}

function fundingModeLabel(mode) {
  if (mode === 'live') return '实盘'
  if (mode === 'paper') return '纸面'
  return mode || '-'
}

function timelineEntryClass(entry) {
  if (entry.type === 'monitor_fold') return 'timeline-item timeline-fold'
  const node = entry.node
  if (node.action_required) return 'timeline-item timeline-strong'
  if (node.node_type === 'rebalance') return 'timeline-item timeline-strong'
  return 'timeline-item'
}

const latestHoldingRows = computed(() => (
  positionRows.value
    .filter((row) => Number(row.shares) > 0)
    .sort((a, b) => Number(b.market_value || 0) - Number(a.market_value || 0))
))

const equityRowsForChart = computed(() => {
  if (equityRows.value.length) return equityRows.value
  const currentEquity = Number(bookEquity.value?.equity)
  if (!Number.isFinite(currentEquity) || currentEquity <= 0) return []
  return [{ date: '当前估算', equity: currentEquity, estimated: true }]
})

const tradeDetailRows = computed(() => tradeRows.value)

const tradeTotals = computed(() => {
  const rows = tradeDetailRows.value
  let netPnl = 0
  let fee = 0
  let buyAmount = 0
  let closedCount = 0
  let openCount = 0
  for (const row of rows) {
    const pnl = Number(row.net_pnl)
    if (Number.isFinite(pnl)) netPnl += pnl
    const f = Number(row.fee)
    if (Number.isFinite(f)) fee += f
    const amt = Number(row.buy_amount)
    if (Number.isFinite(amt)) buyAmount += amt
    if (row.status === 'open') openCount += 1
    else closedCount += 1
  }
  return { count: rows.length, closedCount, openCount, netPnl, fee, buyAmount }
})

const equityChart = computed(() => {
  const rows = equityRowsForChart.value
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
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) : '-'
}

function num(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(4) : '-'
}

function signedMoney(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  const formatted = Math.abs(number).toLocaleString('zh-CN', { maximumFractionDigits: 0 })
  return `${number >= 0 ? '+' : '-'}${formatted}`
}

function signedPct(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return `${number >= 0 ? '+' : ''}${(number * 100).toFixed(2)}%`
}

function pct(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  return Number.isFinite(number) ? `${(number * 100).toFixed(2)}%` : '-'
}

function signClass(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number === 0) return ''
  return number > 0 ? 'positive' : 'negative'
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
  const previousKey = selectedPortfolioKey.value
  try {
    const res = await listPortfolios()
    portfolios.value = res.data?.portfolios || []
    if (!portfolios.value.length) {
      selectedPortfolioKey.value = ''
      message.value = '当前没有已执行的实盘或纸面组合血缘。'
      return
    }
    if (previousKey && portfolios.value.some((row) => portfolioKey(row) === previousKey)) {
      selectedPortfolioKey.value = previousKey
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
    const timelineRes = await getPortfolioPlanLineageTimeline(planId, { limit: 120 })
    timelineData.value = timelineRes.data || null

    if (isLivePortfolio.value) {
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
      bookEquity.value = eqRes.data?.current_book_equity || null
      positionRows.value = posRes.data?.positions || []
      positionSummary.value = posRes.data?.summary || null
      tradeRows.value = exRes.data?.trades || []
    } else {
      const [eqRes, planRes] = await Promise.all([
        getPortfolioPlanLineageEquity(planId),
        getPortfolioPlan(planId),
      ])
      const rows = eqRes.data?.rows || []
      equityRows.value = rows.map((row) => ({
        ...row,
        equity: Number(row.equity),
      }))
      equityCaveat.value = '纸面净值由各 plan 日更 portfolio_paper_equity / 持仓快照按日期拼接。'
      const latestRow = rows[rows.length - 1]
      bookEquity.value = latestRow
        ? {
            equity: Number(latestRow.equity || 0),
            initial_capital: Number(planRes.data?.plan?.summary?.baseline_equity || planRes.data?.plan?.summary?.equity || 0),
            cash: Number(latestRow.cash || 0),
            realized_pnl: 0,
            unrealized_pnl: 0,
          }
        : null
      const items = planRes.data?.items || []
      positionRows.value = items
        .filter((item) => Number(item.current_shares) > 0)
        .map((item) => ({
          symbol: item.symbol,
          name: item.name,
          shares: item.current_shares,
          avg_cost: item.estimated_price,
          last_price: item.estimated_price,
          market_value: Number(item.current_shares || 0) * Number(item.estimated_price || 0),
          realized_pnl: 0,
          unrealized_pnl: 0,
          unrealized_pnl_pct: 0,
        }))
      positionSummary.value = {
        total_market_value: positionRows.value.reduce((sum, row) => sum + Number(row.market_value || 0), 0),
        total_realized_pnl: 0,
        total_unrealized_pnl: 0,
        holding_count: positionRows.value.length,
      }
      tradeRows.value = []
    }
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '加载详情失败'
    messageIsError.value = true
  } finally {
    loadingDetail.value = false
  }
}

watch(selectedPortfolioKey, (key) => {
  if (key) refreshDetail()
  else {
    timelineData.value = null
    equityRows.value = []
    equityCaveat.value = ''
    bookEquity.value = null
    positionRows.value = []
    positionSummary.value = null
    tradeRows.value = []
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

.cycle-card {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  margin-bottom: 16px;
  padding: 14px 16px;
}

.cycle-card.needs-action {
  background: #fffbeb;
  border-color: #d97706;
}

.cycle-card-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 12px;
}

.cycle-card-header h3 {
  font-size: 15px;
  margin: 0 0 4px;
}

.cycle-state {
  color: #1e293b;
  font-size: 14px;
  font-weight: 600;
  margin: 0;
}

.funding-badge {
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
}

.funding-badge.mode-live {
  background: #dbeafe;
  color: #1d4ed8;
}

.funding-badge.mode-paper {
  background: #ecfdf5;
  color: #047857;
}

.cycle-metrics {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

.cycle-metrics .label {
  color: #64748b;
  display: block;
  font-size: 12px;
  margin-bottom: 4px;
}

.cycle-metrics strong {
  color: #0f172a;
  font-size: 15px;
}

.cycle-metrics small {
  color: #64748b;
  display: block;
  font-size: 12px;
  margin-top: 4px;
}

.progress-bar {
  background: #e2e8f0;
  border-radius: 999px;
  height: 6px;
  margin-top: 8px;
  overflow: hidden;
}

.progress-fill {
  background: #2563eb;
  height: 100%;
}

.monitor-hint {
  color: #475569;
  font-size: 13px;
  margin: 12px 0 0;
}

.timeline-section {
  margin-bottom: 16px;
}

.timeline-list {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.timeline-item {
  border-bottom: 1px solid #e5e7eb;
  color: #64748b;
  display: flex;
  flex-wrap: wrap;
  font-size: 13px;
  gap: 10px;
  padding: 10px 12px;
}

.timeline-item:last-child {
  border-bottom: none;
}

.timeline-item strong {
  color: #0f172a;
}

.timeline-fold {
  background: #f8fafc;
}

.timeline-strong {
  background: #fff;
  color: #1e293b;
  font-weight: 500;
}

.timeline-strong .node-type {
  color: #1d4ed8;
  font-weight: 600;
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

.open-trade td {
  background: #f8fafc;
}

.badge-open {
  background: #eff6ff;
  border: 1px solid #93c5fd;
  border-radius: 4px;
  color: #1d4ed8;
  font-size: 12px;
  padding: 1px 6px;
  white-space: nowrap;
}

.totals-row td {
  background: #f3f4f6;
  border-top: 2px solid #d1d5db;
  font-weight: 700;
}

.combo-note {
  margin-top: 8px;
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
