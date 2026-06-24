<template>
  <div class="portfolio-overview">
    <header class="overview-header">
      <h2>组合总览（实盘 + 纸面）</h2>
      <p class="muted">
        按策略参数血缘（params_hash）合并多期 plan；实盘需有 live 成交回报才标为实盘，纸面展示 paper 净值与观察周期。
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
            [{{ fundingModeLabel(p.funding_mode) }}] {{ portfolioOptionLabel(p) }}
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
      <section class="portfolio-identity-card">
        <h3>组合标识</h3>
        <div class="identity-grid">
          <div>
            <span class="label">策略</span>
            <strong>{{ selectedPortfolio.strategy_name || selectedPortfolio.strategy_template_id }}</strong>
            <small>{{ selectedPortfolio.strategy_template_id }}</small>
          </div>
          <div>
            <span class="label">参数摘要</span>
            <strong>{{ selectedPortfolio.param_summary || '-' }}</strong>
            <small>
              universe {{ selectedPortfolio.universe_index || '-' }}
              · Top{{ selectedPortfolio.top_n ?? '-' }}
              · {{ selectedPortfolio.rebalance_days ?? '-' }} 日调仓
              · {{ selectedPortfolio.construction_mode || '-' }}
            </small>
          </div>
          <div>
            <span class="label">params_hash</span>
            <strong :title="selectedPortfolio.params_hash">{{ selectedPortfolio.params_hash_short || '-' }}</strong>
            <small>完整：{{ selectedPortfolio.params_hash || '-' }}</small>
          </div>
          <div>
            <span class="label">维护区间</span>
            <strong>{{ selectedPortfolio.first_base_date || '-' }} → {{ selectedPortfolio.last_base_date || '-' }}</strong>
            <small>{{ selectedPortfolio.plan_count }} 期 plan · 最新 {{ selectedPortfolio.latest_plan_type || '-' }} / {{ selectedPortfolio.latest_plan_status || '-' }}</small>
          </div>
          <div v-if="selectedPortfolio.funding_mode === 'paper'">
            <span class="label">纸面快照</span>
            <strong>{{ selectedPortfolio.paper_snapshot_date || '无快照' }}</strong>
            <small>持仓 {{ selectedPortfolio.paper_holding_count ?? 0 }} 只 · 权益 {{ money(selectedPortfolio.paper_equity) }}</small>
          </div>
          <div v-if="selectedPortfolio.paper_execution_mode">
            <span class="label">纸面执行</span>
            <strong>{{ paperExecutionModeLabel(selectedPortfolio.paper_execution_mode) }}</strong>
            <small v-if="selectedPortfolio.paper_execution_mode === 'auto_shadow'">调仓日自动批准，次日开盘价执行</small>
          </div>
        </div>
      </section>

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
        <p class="timeline-hint muted">调仓节点可展开查看买卖明细；观察日折叠段仅显示漂移摘要。</p>
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
              <div class="timeline-node-head">
                <button
                  v-if="timelineTradeItems(entry.node).length"
                  type="button"
                  class="timeline-expand"
                  :aria-expanded="expandedTimelinePlanId === entry.node.plan_id"
                  @click="toggleTimelineDetail(entry.node.plan_id)"
                >
                  {{ expandedTimelinePlanId === entry.node.plan_id ? '▾' : '▸' }}
                </button>
                <strong>{{ entry.node.date }}</strong>
                <span class="node-type">{{ entry.node.node_type === 'rebalance' ? '调仓' : '观察' }}</span>
                <span>{{ entry.node.today_state }}</span>
                <span v-if="entry.node.drift_brief?.buy_count">
                  买 {{ entry.node.drift_brief.buy_count }}
                </span>
                <span v-if="entry.node.drift_brief?.sell_count">
                  卖 {{ entry.node.drift_brief.sell_count }}
                </span>
                <span v-if="entry.node.drift_brief?.estimated_turnover != null">
                  换手 {{ pct(entry.node.drift_brief.estimated_turnover) }}
                </span>
              </div>
              <div
                v-if="expandedTimelinePlanId === entry.node.plan_id && timelineTradeItems(entry.node).length"
                class="timeline-trade-detail"
              >
                <p v-if="entry.node.drift_brief?.mode === 'drift'" class="timeline-detail-note">
                  观察日未执行，以下为若今日调仓的理论买卖。
                </p>
                <div class="table-wrap compact">
                  <table>
                    <thead>
                      <tr>
                        <th>方向</th>
                        <th>代码</th>
                        <th>名称</th>
                        <th>变动股数</th>
                        <th>持仓 → 目标</th>
                        <th>估算金额</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in timelineTradeItems(entry.node)" :key="`${entry.node.plan_id}-${row.symbol}`">
                        <td>
                          <span class="action-tag" :class="row.action === 'buy' ? 'tag-buy' : 'tag-sell'">
                            {{ row.action === 'buy' ? '买' : '卖' }}
                          </span>
                        </td>
                        <td>{{ row.symbol }}</td>
                        <td>{{ row.name || '-' }}</td>
                        <td>{{ formatShareDelta(row.delta_shares) }}</td>
                        <td>{{ row.current_shares }} → {{ row.target_shares }}</td>
                        <td>{{ money(row.estimated_amount) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
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
        <div v-else class="equity-chart" aria-label="Lineage equity curve" @mouseleave="onChartLeave">
          <svg
            class="equity-svg"
            :viewBox="`0 0 ${equityChart.width} ${equityChart.height}`"
            @mousemove="onChartMove"
          >
            <defs>
              <linearGradient :id="equityGradId" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" :stop-color="equityChart.up ? 'rgba(220,38,38,0.30)' : 'rgba(22,163,74,0.30)'" />
                <stop offset="100%" stop-color="rgba(0,0,0,0)" />
              </linearGradient>
            </defs>
            <g class="grid">
              <line
                v-for="tick in equityChart.yTicks"
                :key="`grid-${tick.y}`"
                :x1="equityChart.plotLeft"
                :x2="equityChart.plotRight"
                :y1="tick.y"
                :y2="tick.y"
              />
              <text
                v-for="tick in equityChart.yTicks"
                :key="`yl-${tick.y}`"
                class="axis-label"
                :x="equityChart.plotLeft - 8"
                :y="tick.y + 4"
                text-anchor="end"
              >{{ tick.label }}</text>
            </g>
            <g v-if="equityChart.baselineY != null">
              <line
                class="baseline"
                :x1="equityChart.plotLeft"
                :x2="equityChart.plotRight"
                :y1="equityChart.baselineY"
                :y2="equityChart.baselineY"
              />
              <text class="baseline-label" :x="equityChart.plotRight" :y="equityChart.baselineY - 6" text-anchor="end">
                成本线 {{ moneyShort(equityChart.baseline) }}
              </text>
            </g>
            <path v-if="equityChart.areaPath" class="area" :d="equityChart.areaPath" :fill="`url(#${equityGradId})`" />
            <polyline class="line" :class="equityChart.up ? 'up' : 'down'" :points="equityChart.linePoints" />
            <text
              v-for="tick in equityChart.xTicks"
              :key="`xl-${tick.x}`"
              class="axis-label"
              :x="tick.x"
              :y="equityChart.height - 8"
              :text-anchor="tick.anchor"
            >{{ tick.text }}</text>
            <g v-if="hoverPoint">
              <line
                class="crosshair"
                :x1="hoverPoint.x"
                :x2="hoverPoint.x"
                :y1="equityChart.plotTop"
                :y2="equityChart.plotBottom"
              />
              <circle class="dot" :cx="hoverPoint.x" :cy="hoverPoint.y" r="4.5" />
            </g>
          </svg>
          <div v-if="hoverPoint" class="equity-tip" :style="hoverPoint.tipStyle">
            <div class="tip-date">{{ hoverPoint.date }}</div>
            <div class="tip-row"><span>账户总额</span><strong>{{ money(hoverPoint.equity) }}</strong></div>
            <div class="tip-row">
              <span>当日盈亏</span>
              <strong :class="signClass(hoverPoint.dayPnl)">{{ signedMoney(hoverPoint.dayPnl) }} · {{ signedPct(hoverPoint.dayPct) }}</strong>
            </div>
            <div class="tip-row">
              <span>累计盈亏</span>
              <strong :class="signClass(hoverPoint.cumPnl)">{{ signedMoney(hoverPoint.cumPnl) }} · {{ signedPct(hoverPoint.cumPct) }}</strong>
            </div>
          </div>
          <p v-if="equityChart.latestReturn != null" class="chart-meta">
            区间收益：<strong :class="signClass(equityChart.latestReturn)">{{ signedPct(equityChart.latestReturn) }}</strong>
            <span class="chart-meta-hint">· 悬浮查看每日净值与盈亏</span>
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
                <th>买入日</th>
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
                <td>{{ row.buy_date || '-' }}</td>
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
        <div v-if="!tradeDetailRows.length" class="muted">暂无成交记录。</div>
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
        <p v-if="tradeDetailRows.length" class="muted combo-note">
          成交明细按 <strong>FIFO（先进先出）</strong> 将每笔卖出与对应买入批次配对，一行为一段往返；未平仓部分以“持有中”行按最新价估算浮动盈亏。
          <template v-if="isLivePortfolio">
            上方汇总卡片的「已实现盈亏」按<strong>加权平均成本法</strong>计算，与本表净盈亏合计在分批建仓/部分卖出时口径不同，全部平仓后两者一致。
          </template>
          <template v-else>
            纸面成交来自各调仓日开盘价模拟执行（portfolio_paper_executions），不含佣金。
          </template>
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
  getLineagePaperExecutions,
  getLineagePaperPositions,
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
const expandedTimelinePlanId = ref(null)

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

function portfolioOptionLabel(portfolio) {
  const name = portfolio.strategy_name || portfolio.strategy_template_id || '组合'
  const params = portfolio.param_summary || '参数未记录'
  const range = portfolio.first_base_date && portfolio.last_base_date
    ? `${portfolio.first_base_date}→${portfolio.last_base_date}`
    : (portfolio.last_base_date || '-')
  const hash = portfolio.params_hash_short || (portfolio.params_hash ? portfolio.params_hash.slice(0, 8) : '--------')
  const holdings = portfolio.funding_mode === 'paper'
    ? ` · 持仓${portfolio.paper_holding_count ?? 0}`
    : ''
  const account = portfolio.securities_account_id
    ? ` · 账户${portfolio.securities_account_id.slice(-6)}`
    : ''
  return `${name} · ${params} · ${range}（${portfolio.plan_count}期${holdings}${account} · #${hash}）`
}

function fundingModeLabel(mode) {
  if (mode === 'live') return '实盘'
  if (mode === 'paper') return '纸面'
  return mode || '-'
}

function paperExecutionModeLabel(mode) {
  if (mode === 'auto_shadow') return '自动跟跑'
  if (mode === 'manual_review') return '人工审核'
  return mode || '-'
}

function timelineEntryClass(entry) {
  if (entry.type === 'monitor_fold') return 'timeline-item timeline-fold'
  const node = entry.node
  if (node.action_required) return 'timeline-item timeline-strong'
  if (node.node_type === 'rebalance') return 'timeline-item timeline-strong'
  return 'timeline-item'
}

function timelineTradeItems(node) {
  return node?.drift_brief?.items || []
}

function toggleTimelineDetail(planId) {
  expandedTimelinePlanId.value = expandedTimelinePlanId.value === planId ? null : planId
}

function formatShareDelta(value) {
  const n = Number(value || 0)
  if (!Number.isFinite(n) || n === 0) return '0'
  return n > 0 ? `+${n}` : String(n)
}

const openBuyDateBySymbol = computed(() => {
  const map = {}
  for (const t of tradeRows.value) {
    if (t.status !== 'open' || !t.buy_date) continue
    const keys = [t.symbol, String(t.symbol || '').split('.')[0]]
    for (const key of keys) {
      if (!key) continue
      if (!map[key] || t.buy_date < map[key]) map[key] = t.buy_date
    }
  }
  return map
})

const latestHoldingRows = computed(() => (
  positionRows.value
    .filter((row) => Number(row.shares) > 0)
    .map((row) => ({
      ...row,
      buy_date:
        openBuyDateBySymbol.value[row.symbol] ||
        openBuyDateBySymbol.value[String(row.symbol || '').split('.')[0]] ||
        row.buy_date ||
        '',
    }))
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

const hoverIndex = ref(null)
const equityGradId = `equityFill-${Math.random().toString(36).slice(2, 8)}`

function moneyShort(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  const abs = Math.abs(n)
  if (abs >= 1e8) return `${(n / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${(n / 1e4).toFixed(1)}万`
  return n.toFixed(0)
}

function shortDate(value) {
  const text = String(value || '')
  if (/^\d{8}$/.test(text)) return `${text.slice(4, 6)}-${text.slice(6, 8)}`
  return text
}

const equityChart = computed(() => {
  const rows = equityRowsForChart.value
  const width = 720
  const height = 260
  const plotLeft = 58
  const plotRight = width - 18
  const plotTop = 18
  const plotBottom = height - 28
  const empty = {
    width, height, plotLeft, plotRight, plotTop, plotBottom,
    linePoints: '', areaPath: '', coords: [], yTicks: [], xTicks: [],
    min: 0, max: 0, baseline: null, baselineY: null, up: true, latestReturn: null,
  }
  if (!rows.length) return empty

  const values = rows.map((row) => Number(row.equity)).filter((v) => Number.isFinite(v))
  if (!values.length) return empty
  const baselineRaw = Number(bookEquity.value?.initial_capital)
  const baseline = Number.isFinite(baselineRaw) && baselineRaw > 0 ? baselineRaw : values[0]

  let min = Math.min(...values, baseline)
  let max = Math.max(...values, baseline)
  if (max === min) { max += 1; min -= 1 }
  const headroom = (max - min) * 0.08
  min -= headroom
  max += headroom
  const span = max - min || 1

  const xAt = (index) =>
    rows.length === 1 ? (plotLeft + plotRight) / 2 : plotLeft + (index * (plotRight - plotLeft)) / (rows.length - 1)
  const yAt = (equity) => plotBottom - ((equity - min) * (plotBottom - plotTop)) / span

  const coords = rows.map((row, index) => {
    const equity = Number(row.equity)
    const prev = index > 0 ? Number(rows[index - 1].equity) : equity
    const dayPnl = index > 0 ? equity - prev : 0
    const dayPct = index > 0 && prev ? equity / prev - 1 : 0
    return {
      x: xAt(index),
      y: yAt(equity),
      date: row.date,
      equity,
      dayPnl,
      dayPct,
      cumPnl: equity - baseline,
      cumPct: baseline ? equity / baseline - 1 : 0,
    }
  })

  const linePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const areaPath = coords.length > 1
    ? `M ${coords[0].x.toFixed(1)},${plotBottom} ` +
      coords.map((c) => `L ${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ') +
      ` L ${coords[coords.length - 1].x.toFixed(1)},${plotBottom} Z`
    : ''

  const tickCount = 4
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const value = min + (span * i) / tickCount
    return { value, y: yAt(value), label: moneyShort(value) }
  })

  const labelCount = Math.min(rows.length, 5)
  const xTicks = Array.from({ length: labelCount }, (_, i) => {
    const index = labelCount === 1 ? 0 : Math.round((i * (rows.length - 1)) / (labelCount - 1))
    const c = coords[index]
    const anchor = i === 0 ? 'start' : i === labelCount - 1 ? 'end' : 'middle'
    return { x: c.x, text: shortDate(c.date), anchor }
  })

  const first = values[0]
  const latest = values[values.length - 1]
  return {
    width, height, plotLeft, plotRight, plotTop, plotBottom,
    linePoints, areaPath, coords, yTicks, xTicks,
    min, max,
    baseline,
    baselineY: yAt(baseline),
    up: latest >= baseline,
    latestReturn: first ? latest / first - 1 : null,
  }
})

const hoverPoint = computed(() => {
  const chart = equityChart.value
  const i = hoverIndex.value
  if (i == null || !chart.coords[i]) return null
  const c = chart.coords[i]
  const leftPct = Math.max(14, Math.min(86, (c.x / chart.width) * 100))
  return { ...c, tipStyle: { left: `${leftPct}%` } }
})

function onChartMove(event) {
  const chart = equityChart.value
  const n = chart.coords.length
  if (!n) { hoverIndex.value = null; return }
  const rect = event.currentTarget.getBoundingClientRect()
  if (!rect.width) return
  const frac = (event.clientX - rect.left) / rect.width
  const left = chart.plotLeft / chart.width
  const right = chart.plotRight / chart.width
  const t = Math.max(0, Math.min(1, (frac - left) / (right - left || 1)))
  hoverIndex.value = Math.round(t * (n - 1))
}

function onChartLeave() {
  hoverIndex.value = null
}

function money(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) : '-'
}

function num(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : '-'
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
      const [eqRes, posRes, planRes, exRes] = await Promise.all([
        getPortfolioPlanLineageEquity(planId),
        getLineagePaperPositions(planId),
        getPortfolioPlan(planId),
        getLineagePaperExecutions(planId),
      ])
      const rows = eqRes.data?.rows || []
      equityRows.value = rows.map((row) => ({
        ...row,
        equity: Number(row.equity),
      }))
      const snapshotDate = posRes.data?.as_of_date
      equityCaveat.value = snapshotDate
        ? `纸面净值由各 plan 日更 portfolio_paper_equity 拼接；最新持仓快照 ${snapshotDate}（plan ${posRes.data?.source_plan_id || '-'}）。`
        : '纸面净值由各 plan 日更 portfolio_paper_equity 拼接；当前血缘暂无 paper 持仓快照。'
      const latestRow = rows[rows.length - 1]
      const summary = posRes.data?.summary || {}
      bookEquity.value = latestRow || summary.equity
        ? {
            equity: Number(summary.equity || latestRow?.equity || 0),
            initial_capital: Number(
              eqRes.data?.initial_capital ||
              planRes.data?.plan?.params_snapshot?.initial_capital ||
              selectedPortfolio.value?.initial_capital ||
              rows[0]?.equity ||
              0,
            ),
            cash: Number(summary.cash || latestRow?.cash || 0),
            realized_pnl: 0,
            unrealized_pnl: Number(summary.total_unrealized_pnl || 0),
          }
        : null
      positionRows.value = posRes.data?.positions || []
      positionSummary.value = summary.holding_count != null
        ? summary
        : {
            total_market_value: positionRows.value.reduce((sum, row) => sum + Number(row.market_value || 0), 0),
            total_realized_pnl: 0,
            total_unrealized_pnl: 0,
            holding_count: positionRows.value.length,
          }
      tradeRows.value = exRes.data?.trades || []
    }
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '加载详情失败'
    messageIsError.value = true
  } finally {
    loadingDetail.value = false
  }
}

watch(selectedPortfolioKey, (key) => {
  expandedTimelinePlanId.value = null
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

.portfolio-identity-card {
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  margin-bottom: 16px;
  padding: 14px 16px;
}

.portfolio-identity-card h3 {
  font-size: 15px;
  margin: 0 0 12px;
}

.identity-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

.identity-grid .label {
  color: #64748b;
  display: block;
  font-size: 12px;
  margin-bottom: 4px;
}

.identity-grid strong {
  color: #0f172a;
  display: block;
  font-size: 14px;
}

.identity-grid small {
  color: #64748b;
  display: block;
  font-size: 12px;
  margin-top: 4px;
  word-break: break-all;
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
  display: block;
  font-size: 13px;
  padding: 10px 12px;
}

.timeline-node-head {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.timeline-expand {
  background: transparent;
  border: none;
  color: #1d4ed8;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
}

.timeline-hint {
  font-size: 12px;
  margin: -4px 0 8px;
}

.timeline-trade-detail {
  margin-top: 10px;
  width: 100%;
}

.timeline-detail-note {
  color: #92400e;
  font-size: 12px;
  margin: 0 0 8px;
}

.action-tag {
  border-radius: 3px;
  color: #fff;
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  min-width: 20px;
  text-align: center;
}

.action-tag.tag-buy {
  background: #dc2626;
}

.action-tag.tag-sell {
  background: #16a34a;
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
  position: relative;
}

.equity-chart .equity-svg {
  width: 100%;
  height: auto;
  display: block;
  cursor: crosshair;
}

.equity-chart polyline.line {
  fill: none;
  stroke-width: 2.25;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.equity-chart polyline.line.up {
  stroke: #dc2626;
}

.equity-chart polyline.line.down {
  stroke: #16a34a;
}

.equity-chart .grid line {
  stroke: #eef2f7;
  stroke-width: 1;
}

.equity-chart .axis-label {
  fill: #94a3b8;
  font-size: 11px;
}

.equity-chart .baseline {
  stroke: #94a3b8;
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.equity-chart .baseline-label {
  fill: #94a3b8;
  font-size: 11px;
}

.equity-chart .crosshair {
  stroke: #94a3b8;
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.equity-chart .dot {
  fill: #fff;
  stroke: #1d4ed8;
  stroke-width: 2;
}

.equity-tip {
  position: absolute;
  top: 14px;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.94);
  color: #f8fafc;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.5;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.25);
  z-index: 2;
}

.equity-tip .tip-date {
  font-weight: 600;
  margin-bottom: 4px;
  color: #e2e8f0;
}

.equity-tip .tip-row {
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.equity-tip .tip-row span {
  color: #94a3b8;
}

.equity-tip .tip-row strong {
  font-weight: 600;
  color: #f8fafc;
}

.equity-tip .tip-row strong.positive {
  color: #f87171;
}

.equity-tip .tip-row strong.negative {
  color: #4ade80;
}

.chart-meta {
  color: #374151;
  font-size: 13px;
  margin: 10px 0 0;
}

.chart-meta strong {
  color: #111827;
}

.chart-meta strong.positive {
  color: #dc2626;
}

.chart-meta strong.negative {
  color: #16a34a;
}

.chart-meta-hint {
  color: #94a3b8;
  margin-left: 6px;
}

/* A-share convention: profit red, loss green. */
.positive {
  color: #dc2626;
}

.negative {
  color: #16a34a;
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
