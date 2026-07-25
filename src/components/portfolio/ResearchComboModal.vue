<template>
  <div v-if="open" class="combo-overlay" @click.self="emit('close')">
    <div class="combo-modal">
      <header class="combo-head">
        <div>
          <h3>{{ comboTitle }}</h3>
          <p class="muted">{{ comboSubtitle }}</p>
          <div v-if="detail" class="combo-params">
            <span><strong>移动止盈</strong>{{ comboTrailingStopLabel }}</span>
            <span><strong>成交价</strong>后复权 · next_open</span>
            <span v-if="comboTrailingStopEnabled">
              <strong>卖出规则</strong>峰值回撤触发后次日开盘卖，否则持满
              {{ comboMeta.horizon || comboMeta.rebalance_interval_days }} 日
            </span>
          </div>
        </div>
        <button class="link-btn" @click="emit('close')">关闭 ✕</button>
      </header>

      <p v-if="loading" class="muted">加载成交明细中…</p>
      <p v-else-if="error" class="error">{{ error }}</p>

      <template v-else-if="detail">
        <div class="combo-cards">
          <div v-for="card in comboSummaryCards" :key="card.k" class="combo-card">
            <span class="k">{{ card.k }}</span>
            <strong class="v" :class="card.cls">{{ card.v }}</strong>
          </div>
        </div>

        <template v-if="yearlyReturnRows.length">
          <h4 class="combo-h">分年收益</h4>
          <div class="combo-yearly-wrap">
            <table class="combo-yearly-table">
              <thead>
                <tr>
                  <th>年份</th>
                  <th>组合收益</th>
                  <th>指数超额</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in yearlyReturnRows" :key="row.year">
                  <td>{{ row.year }}</td>
                  <td :class="signClass(row.portfolioReturn)">{{ pct(row.portfolioReturn) }}</td>
                  <td :class="signClass(row.indexExcess)">{{ pct(row.indexExcess) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <h4 class="combo-h">净值曲线（扣费净收益，复利）</h4>
        <p v-if="equityChart && equityChart.dataGaps.length" class="combo-gap-warning">
          ⚠️ 检测到数据缺口，缺口区间内无调仓、账户总值保持不变（并非曲线错误）：
          <span v-for="gap in equityChart.dataGaps" :key="`${gap.fromDate}-${gap.toDate}`" class="gap-chip">
            {{ gap.fromDate }} → {{ gap.toDate }}（约 {{ gap.days }} 天）
          </span>
        </p>
        <div class="combo-chart-panel">
          <svg
            v-if="equityChart"
            :viewBox="`0 0 ${equityChart.w} ${equityChart.h}`"
            width="100%"
            preserveAspectRatio="xMidYMid meet"
            @mousemove="handleChartPointerMove"
            @mouseleave="chartHover = null"
          >
            <line
              v-for="(gridLine, index) in equityChart.grid"
              :key="`g${index}`"
              :x1="equityChart.padL"
              :y1="gridLine.y"
              :x2="equityChart.w - equityChart.padR"
              :y2="gridLine.y"
              stroke="#e6eaf0"
              stroke-width="1"
            />
            <text
              v-for="(gridLine, index) in equityChart.grid"
              :key="`gt${index}`"
              :x="equityChart.padL - 6"
              :y="gridLine.y + 3"
              fill="#94a3b8"
              font-size="11"
              text-anchor="end"
            >{{ gridLine.label }}</text>
            <line
              v-for="(tick, index) in equityChart.axisTicks"
              :key="`xg${index}`"
              :x1="tick.x"
              :y1="equityChart.padT"
              :x2="tick.x"
              :y2="equityChart.h - equityChart.padB"
              stroke="#f1f5f9"
              stroke-width="1"
            />
            <polyline
              v-if="equityChart.hasIdx"
              fill="none"
              stroke="#94a3b8"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              :points="equityChart.idxSmoothPoints"
            />
            <polyline
              fill="none"
              stroke="#0f6bdc"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              :points="equityChart.stratSmoothPoints"
            />
            <g v-if="chartHover" pointer-events="none">
              <line
                :x1="chartHover.x"
                :y1="equityChart.padT"
                :x2="chartHover.x"
                :y2="equityChart.h - equityChart.padB"
                stroke="#64748b"
                stroke-width="1"
                stroke-dasharray="4 4"
              />
              <circle
                :cx="chartHover.x"
                :cy="chartHover.y"
                r="4"
                fill="#0f6bdc"
                stroke="#fff"
                stroke-width="2"
              />
              <g :transform="`translate(${chartHover.tooltipX} ${chartHover.tooltipY})`">
                <rect width="190" height="48" rx="6" fill="#172033" opacity=".94" />
                <text x="10" y="19" fill="#fff" font-size="12">{{ chartHover.date }}</text>
                <text x="10" y="37" fill="#fff" font-size="12">
                  账户总值：{{ money(chartHover.accountValue) }}
                </text>
              </g>
            </g>
            <text
              v-for="(tick, index) in equityChart.axisTicks"
              :key="`xt${index}`"
              :x="tick.x"
              :y="equityChart.h - 8"
              fill="#94a3b8"
              font-size="11"
              :text-anchor="tick.anchor"
              :transform="tick.rotate ? `rotate(${tick.rotate} ${tick.x} ${equityChart.h - 8})` : undefined"
            >{{ tick.label }}</text>
          </svg>
          <p v-else class="muted">无净值数据</p>
          <div class="combo-legend">
            <span><i class="sw" style="background:#0f6bdc"></i>策略（净）</span>
            <span><i class="sw" style="background:#94a3b8"></i>指数基准</span>
          </div>
        </div>

        <h4 class="combo-h">
          模拟成交明细
          <span class="muted">（{{ filteredTrades.length }} 笔 / 共 {{ comboTrades.length }}）</span>
        </h4>
        <div class="combo-toolbar">
          <label>
            调仓日
            <select v-model="tradeDateFilter">
              <option value="">全部</option>
              <option v-for="date in tradeDates" :key="date" :value="date">{{ date }}</option>
            </select>
          </label>
          <label>
            代码/名称
            <input v-model="tradeSymFilter" placeholder="如 600000" />
          </label>
          <span class="muted">点击表头排序</span>
        </div>
        <div class="combo-table-wrap">
          <table>
            <thead>
              <tr>
                <th v-for="col in tradeCols" :key="col.k" @click="sortTrades(col.k)">
                  {{ col.t }}<span v-if="tradeSortKey === col.k">{{ tradeSortDir > 0 ? ' ▲' : ' ▼' }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(trade, index) in filteredTrades" :key="`${trade.symbol}-${trade.score_date}-${index}`" :class="{ 'open-trade-row': trade.is_unrealized }">
                <td>
                  <span v-if="trade.is_unrealized" class="tag-open">未平仓</span>
                  <span v-else class="muted">已平仓</span>
                </td>
                <td>{{ trade.score_date }}</td>
                <td>{{ trade.symbol }}</td>
                <td>{{ trade.name || '' }}</td>
                <td>{{ num(trade.score_value, 1) }}</td>
                <td>{{ trade.buy_date || '' }}</td>
                <td>{{ num(trade.buy_price) }}</td>
                <td>{{ trade.is_unrealized ? '持有中' : (trade.sell_date || '') }}</td>
                <td>{{ trade.is_unrealized ? num(trade.mark_price) : num(trade.sell_price) }}</td>
                <td>{{ money(trade.quantity) }}</td>
                <td>{{ money(trade.buy_amount) }}</td>
                <td :class="signClass(trade.holding_return)">{{ pct(trade.holding_return) }}</td>
                <td :class="signClass(trade.net_pnl)">{{ money(trade.net_pnl) }}</td>
                <td>{{ money(trade.estimated_transaction_cost) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="muted combo-note">
          <template v-if="comboTrailingStopEnabled">
            移动止盈（{{ comboTrailingStopLabel }}）：持仓期内跟踪最高价，若某日收盘价 ≤
            峰值×(1−止盈比例)，则于次日开盘价卖出；否则持有满
            {{ comboMeta.horizon || comboMeta.rebalance_interval_days }}
            个交易日后按开盘价卖出（next_open；遇一字跌停顺延，见 sell_delayed_days）。价格为后复权 OHLC。
          </template>
          <template v-else>
            成交价口径：买入 = 调仓日「次日开盘价」(next_open)，卖出 = 持有
            {{ comboMeta.horizon || comboMeta.rebalance_interval_days }}
            个交易日后那天的开盘价（next_open；遇一字跌停顺延，见 sell_delayed_days），open-to-open。价格为后复权 OHLC。
          </template>
          等权建仓、整手取整、含费用模型；无期内再平衡、无额外滑点。
        </p>
        <p class="muted combo-note">
          末端未平仓：持有期未满、无法取得正式卖出价的调仓期，会以数据窗口内最后可用开盘价（next_open 口径）mark-to-market 显示为「未平仓」，浮盈浮亏为估算值（已预扣一次卖出费，含印花税）。该持仓对应实盘推荐，不计入上方净值曲线与累计收益。
        </p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import {
  buildComboSummaryCards,
  buildEquityChart,
  buildYearlyReturnRows,
  filterAndSortTrades,
  money,
  num,
  pct,
  signClass,
} from '../../utils/portfolioResearchView'
import { formatAxisValue, resolveComboTrailingStopPct } from '../../utils/sweepResultView'

const props = defineProps({
  open: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  detail: { type: Object, default: null },
  contextRow: { type: Object, default: null },
})

const emit = defineEmits(['close'])

const tradeDateFilter = ref('')
const tradeSymFilter = ref('')
const tradeSortKey = ref('score_date')
const tradeSortDir = ref(1)

const tradeCols = [
  { k: 'status', t: '状态' },
  { k: 'score_date', t: '调仓日' },
  { k: 'symbol', t: '代码' },
  { k: 'name', t: '名称' },
  { k: 'score_value', t: '分值' },
  { k: 'buy_date', t: '买入日' },
  { k: 'buy_price', t: '买价' },
  { k: 'sell_date', t: '卖出日' },
  { k: 'sell_price', t: '卖价' },
  { k: 'quantity', t: '数量' },
  { k: 'buy_amount', t: '买入额' },
  { k: 'holding_return', t: '持有收益' },
  { k: 'net_pnl', t: '净盈亏' },
  { k: 'estimated_transaction_cost', t: '费用' },
]

const comboMeta = computed(() => props.detail?.meta || {})
const comboTrades = computed(() => props.detail?.trades || [])
const comboTitle = computed(() => {
  const meta = comboMeta.value
  if (!meta.construction_mode) return '组合成交明细'
  return `${meta.score_variant || meta.score_column || ''} · ${meta.variant || meta.construction_mode} · Top-${meta.top_n}`
})
const comboSubtitle = computed(() => {
  const meta = comboMeta.value
  const parts = []
  if (meta.construction_mode) parts.push(`构建 ${meta.construction_mode}`)
  if (meta.max_industry_weight != null) parts.push(`行业上限 ${pct(meta.max_industry_weight)}`)
  if (meta.horizon) parts.push(`调仓 ${meta.horizon}d`)
  if (meta.index_benchmark_symbol) parts.push(`基准 ${meta.index_benchmark_symbol}`)
  return parts.join(' · ')
})
const comboTrailingStopPct = computed(() => resolveComboTrailingStopPct({
  meta: comboMeta.value,
  row: props.contextRow,
  comboKey: comboMeta.value?.combo_key || props.contextRow?.combo_key,
}))
const comboTrailingStopLabel = computed(() =>
  formatAxisValue('trailing_stop_pct', comboTrailingStopPct.value))
const comboTrailingStopEnabled = computed(() => comboTrailingStopPct.value != null)
const comboSummaryCards = computed(() => buildComboSummaryCards(props.detail?.summary))
const yearlyReturnRows = computed(() => buildYearlyReturnRows(props.detail?.summary))
const tradeDates = computed(() =>
  Array.from(new Set(comboTrades.value.map((trade) => String(trade.score_date)))).sort())
const filteredTrades = computed(() => filterAndSortTrades(comboTrades.value, {
  dateFilter: tradeDateFilter.value,
  symFilter: tradeSymFilter.value,
  sortKey: tradeSortKey.value,
  sortDir: tradeSortDir.value,
}))
const comboInitialCapital = computed(() => (
  props.detail?.meta?.fees?.initial_capital ??
  props.detail?.summary?.initial_capital ??
  1_000_000
))
const equityChart = computed(() => buildEquityChart(
  props.detail?.periods || [],
  props.detail?.trades || [],
  comboInitialCapital.value,
))
const chartHover = ref(null)

watch(() => [props.open, props.contextRow?.combo_key], ([open]) => {
  if (!open) return
  tradeDateFilter.value = ''
  tradeSymFilter.value = ''
  tradeSortKey.value = 'score_date'
  tradeSortDir.value = 1
})

function sortTrades(key) {
  if (tradeSortKey.value === key) {
    tradeSortDir.value *= -1
  } else {
    tradeSortKey.value = key
    tradeSortDir.value = 1
  }
}

function handleChartPointerMove(event) {
  const chart = equityChart.value
  if (!chart?.hoverPoints?.length) return
  const rect = event.currentTarget.getBoundingClientRect()
  if (!rect.width) return
  const viewX = ((event.clientX - rect.left) / rect.width) * chart.w
  const point = chart.hoverPoints.reduce((nearest, candidate) => (
    Math.abs(candidate.x - viewX) < Math.abs(nearest.x - viewX) ? candidate : nearest
  ))
  const tooltipWidth = 190
  const tooltipHeight = 48
  chartHover.value = {
    ...point,
    tooltipX: point.x + tooltipWidth + 12 <= chart.w
      ? point.x + 10
      : point.x - tooltipWidth - 10,
    tooltipY: Math.max(
      chart.padT,
      Math.min(point.y - tooltipHeight - 8, chart.h - chart.padB - tooltipHeight),
    ),
  }
}
</script>

<style scoped>
.combo-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(15, 23, 42, .45);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 32px 16px;
  overflow: auto;
}

.combo-modal {
  background: #fff;
  border-radius: 14px;
  width: min(1180px, 100%);
  padding: 22px 24px 26px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, .25);
  color: #172033;
}

.combo-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.combo-head h3 {
  margin: 0 0 8px;
  overflow-wrap: anywhere;
}

.combo-params {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 8px;
  font-size: 13px;
  color: #334155;
}

.combo-params strong {
  color: #64748b;
  font-weight: 600;
  margin-right: 4px;
}

.combo-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin: 8px 0 18px;
}

.combo-card {
  border: 1px solid #edf0f5;
  border-radius: 10px;
  padding: 12px;
  background: #fbfcfe;
}

.combo-card .k {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.combo-card .v {
  display: block;
  font-size: 20px;
  margin-top: 3px;
}

.combo-yearly-wrap {
  border: 1px solid #e6eaf0;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 8px;
}

.combo-yearly-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.combo-yearly-table th,
.combo-yearly-table td {
  padding: 9px 12px;
  border-bottom: 1px solid #edf0f5;
  text-align: right;
}

.combo-yearly-table th:first-child,
.combo-yearly-table td:first-child {
  text-align: left;
}

.combo-yearly-table th {
  background: #f8fafc;
  color: #475569;
}

.combo-h {
  margin: 22px 0 10px;
  padding-left: 9px;
  border-left: 4px solid #0f6bdc;
}

.combo-gap-warning {
  margin: 0 0 10px;
  padding: 8px 12px;
  border: 1px solid #fbcfa4;
  border-radius: 8px;
  background: #fff7ed;
  color: #9a3412;
  font-size: 12px;
  line-height: 1.6;
}

.combo-gap-warning .gap-chip {
  display: inline-block;
  margin: 2px 6px 0 0;
  padding: 1px 8px;
  border-radius: 999px;
  background: #ffedd5;
  color: #c2410c;
  font-weight: 600;
  white-space: nowrap;
}

.combo-chart-panel {
  border: 1px solid #e6eaf0;
  border-radius: 12px;
  padding: 14px;
  background: #fff;
}

.combo-legend {
  font-size: 12px;
  color: #64748b;
  margin-top: 8px;
  display: flex;
  gap: 16px;
}

.combo-legend .sw {
  display: inline-block;
  width: 11px;
  height: 11px;
  border-radius: 2px;
  vertical-align: middle;
  margin-right: 5px;
}

.combo-toolbar {
  display: flex;
  gap: 14px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 10px;
  font-size: 13px;
}

.combo-toolbar label {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
}

.combo-toolbar input,
.combo-toolbar select {
  border: 1px solid #d9e1ec;
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
}

.combo-table-wrap {
  max-height: 520px;
  overflow: auto;
  border: 1px solid #e6eaf0;
  border-radius: 10px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th,
td {
  padding: 9px 10px;
  border-bottom: 1px solid #edf0f5;
  text-align: right;
  white-space: nowrap;
}

th:nth-child(3),
td:nth-child(3),
th:nth-child(4),
td:nth-child(4) {
  text-align: left;
}

th {
  background: #f8fafc;
  color: #475569;
}

.combo-table-wrap thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  cursor: pointer;
  user-select: none;
}

.combo-note {
  margin-top: 12px;
  font-size: 12px;
}

.tag-open {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: #fff7ed;
  color: #c2410c;
  font-size: 11px;
  font-weight: 700;
}

.open-trade-row td {
  background: #fffbf5;
}

.link-btn {
  border: none;
  background: transparent;
  color: #0f6bdc;
  padding: 2px 4px;
  cursor: pointer;
  font: inherit;
  text-decoration: underline;
}

.muted {
  color: #64748b;
}

.error {
  color: #b91c1c;
}

/* A股配色：盈利/上涨=红，亏损/下跌=绿 */
.pos { color: #d4380d; font-weight: 700; }
.neg { color: #389e0d; font-weight: 700; }
.mut { color: #94a3b8; }
</style>
