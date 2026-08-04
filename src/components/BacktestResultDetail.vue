<template>
  <div class="backtest-result-detail">
    <div v-if="loading" class="state-message">{{ loadingMessage }}</div>
    <div v-else-if="error" class="state-message error">{{ error }}</div>

    <div v-else-if="result" class="result-content">
      <section class="metrics-section">
        <h4>策略与参数</h4>
        <div class="task-details">
          <div class="detail-item">
            <span class="label">标的</span>
            <span class="value">{{ displaySymbol || '-' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">策略</span>
            <span class="value">{{ displayStrategyKey || '-' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">预设</span>
            <span class="value">{{ displayPreset || '-' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">回测区间</span>
            <span class="value">{{ displayBacktestRange || '-' }}</span>
          </div>
        </div>
        <div class="params-block">
          <pre class="params-pre">{{ displayStrategyParamsJson }}</pre>
        </div>
      </section>

      <section v-if="result.metrics" class="metrics-section">
        <MetricsRadarChart :metrics="result.metrics" />
      </section>

      <section class="metrics-section">
        <h4>关键指标</h4>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">总收益</div>
            <div class="metric-value" :class="totalProfit >= 0 ? 'positive' : 'negative'">
              {{ formatCurrency(totalProfit) }}
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-label">总收益率</div>
            <div
              class="metric-value"
              :class="(metrics.total_return ?? 0) >= 0 ? 'positive' : 'negative'"
            >
              {{ formatPercent(metrics.total_return) }}
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-label">夏普比率</div>
            <div class="metric-value">
              {{ formatNumber(metrics.sharpe_ratio) }}
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-label">最大回撤</div>
            <div class="metric-value negative">{{ formatPercent(metrics.max_drawdown) }}</div>
            <div v-if="metrics.max_drawdown_len != null" class="metric-hint">
              持续 {{ Math.round(metrics.max_drawdown_len) }} 根 K 线
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-label">胜率</div>
            <div class="metric-value">{{ formatPercent(metrics.win_rate) }}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">平仓回合</div>
            <div class="metric-value" :title="'买入→卖出算 1 次；详情买卖明细按委托笔数统计'">
              {{ metrics.total_trades ?? 0 }}
            </div>
          </div>
        </div>
      </section>

      <section v-if="hasRiskAdjustedMetrics" class="metrics-section">
        <h4>风险调整</h4>
        <div class="metrics-grid">
          <div v-if="metrics.calmar_ratio != null" class="metric-card">
            <div class="metric-label">Calmar</div>
            <div class="metric-value">{{ formatNumber(metrics.calmar_ratio) }}</div>
          </div>
          <div v-if="metrics.sortino_ratio != null" class="metric-card">
            <div class="metric-label">Sortino</div>
            <div class="metric-value">{{ formatNumber(metrics.sortino_ratio) }}</div>
          </div>
          <div v-if="metrics.sqn != null" class="metric-card">
            <div class="metric-label">SQN</div>
            <div class="metric-value">{{ formatNumber(metrics.sqn) }}</div>
          </div>
          <div v-if="metrics.ulcer_index != null" class="metric-card">
            <div class="metric-label">Ulcer 指数</div>
            <div class="metric-value">{{ formatNumber(metrics.ulcer_index) }}</div>
          </div>
        </div>
      </section>

      <section v-if="hasBenchmarkMetrics" class="metrics-section">
        <h4>相对基准</h4>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">基准收益</div>
            <div
              class="metric-value"
              :class="(metrics.benchmark_return ?? 0) >= 0 ? 'positive' : 'negative'"
            >
              {{ formatPercent(metrics.benchmark_return) }}
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-label">超额收益</div>
            <div
              class="metric-value"
              :class="(metrics.excess_return ?? 0) >= 0 ? 'positive' : 'negative'"
            >
              {{ formatPercent(metrics.excess_return) }}
            </div>
          </div>
        </div>
      </section>

      <section v-if="hasCapitalMetrics" class="metrics-section">
        <h4>资金效率</h4>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">投入资金收益</div>
            <div
              class="metric-value"
              :class="(metrics.invested_return ?? 0) >= 0 ? 'positive' : 'negative'"
            >
              {{ formatPercent(metrics.invested_return) }}
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-label">资金使用率</div>
            <div class="metric-value">{{ formatPercent(metrics.capital_utilization) }}</div>
          </div>
        </div>
      </section>

      <section class="trades-section">
        <h4>买卖明细（最近 {{ tradePreview.length }} / {{ trades.length }} 笔委托）</h4>
        <div v-if="tradePreview.length" class="table-wrapper">
          <table class="trades-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作</th>
                <th>价格</th>
                <th>数量</th>
                <th>手续费</th>
                <th>盈亏</th>
                <th>累计盈亏</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(trade, idx) in tradePreview" :key="`${trade.datetime}-${idx}`">
                <td>{{ trade.datetime }}</td>
                <td>
                  <span class="trade-action" :class="trade.action">
                    {{ trade.action === 'buy' ? '买入' : '卖出' }}
                  </span>
                </td>
                <td>{{ formatNumber(trade.price) }}</td>
                <td>{{ trade.quantity }}</td>
                <td>{{ formatNumber(trade.commission) }}</td>
                <td :class="(trade.pnl ?? 0) >= 0 ? 'positive' : 'negative'">
                  {{ formatNumber(trade.pnl) }}
                </td>
                <td :class="(trade.cumulative_pnl ?? 0) >= 0 ? 'positive' : 'negative'">
                  {{ formatNumber(trade.cumulative_pnl) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="empty">暂无交易记录</p>
      </section>

      <section class="equity-section">
        <h4>净值曲线</h4>
        <EquityCurveChart
          v-if="equityCurve.length"
          :equity-curve="equityCurve"
          :initial-cash="initialCash"
        />
        <p v-else class="empty">暂无净值数据</p>
      </section>

      <div v-if="$slots.actions" class="result-actions">
        <slot name="actions" />
      </div>
    </div>

    <div v-else class="state-message">暂无结果</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import EquityCurveChart from './EquityCurveChart.vue'
import MetricsRadarChart from './MetricsRadarChart.vue'

const props = defineProps({
  result: { type: Object, default: null },
  meta: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
  loadingMessage: { type: String, default: '加载结果中…' },
  error: { type: String, default: '' },
  tradeLimit: { type: Number, default: 20 },
})

const metrics = computed(() => props.result?.metrics || {})
const trades = computed(() => (Array.isArray(props.result?.trades) ? props.result.trades : []))
const tradePreview = computed(() => trades.value.slice(0, props.tradeLimit))
const equityCurve = computed(() =>
  Array.isArray(props.result?.equity_curve) ? props.result.equity_curve : [],
)

const initialCash = computed(() => {
  const value = props.meta?.initial_cash ?? props.result?.initial_cash ?? 1000000
  const n = Number(value)
  return Number.isFinite(n) ? n : 1000000
})

const displaySymbol = computed(
  () => props.meta?.symbol || props.result?.symbol || '',
)

const displayStrategyKey = computed(
  () =>
    props.meta?.strategy_key ||
    props.result?.strategy_key ||
    props.result?.strategy ||
    '',
)

const displayPreset = computed(
  () => props.meta?.preset || props.result?.preset || '',
)

const displayStrategyParams = computed(() => {
  const params = props.meta?.strategy_params ?? props.result?.strategy_params
  if (!params || typeof params !== 'object' || Array.isArray(params)) return {}
  return params
})

const displayStrategyParamsJson = computed(() => {
  const params = displayStrategyParams.value
  if (!Object.keys(params).length) return '（无参数）'
  try {
    return JSON.stringify(params, null, 2)
  } catch {
    return String(params)
  }
})

const displayBacktestStartYmd = computed(() => {
  const v =
    props.meta?.start_date ||
    props.result?.start_date ||
    equityCurve.value[0]?.date ||
    ''
  return typeof v === 'string' ? v : ''
})

const displayBacktestEndYmd = computed(() => {
  const lastCurveDate =
    equityCurve.value.length > 0 ? equityCurve.value[equityCurve.value.length - 1]?.date : ''
  const v = props.meta?.end_date || props.result?.end_date || lastCurveDate || ''
  return typeof v === 'string' ? v : ''
})

const displayBacktestRange = computed(() => {
  const start = displayBacktestStartYmd.value
  const end = displayBacktestEndYmd.value
  if (!start && !end) return ''
  if (start && end) return `${formatDate(start)} ~ ${formatDate(end)}`
  return start ? formatDate(start) : formatDate(end)
})

const totalProfit = computed(() => {
  if (!equityCurve.value.length) return 0
  const finalValue = equityCurve.value[equityCurve.value.length - 1]?.value
  if (finalValue == null) return 0
  return Number(finalValue) - initialCash.value
})

const hasRiskAdjustedMetrics = computed(() =>
  ['calmar_ratio', 'sortino_ratio', 'sqn', 'ulcer_index'].some(
    (key) => metrics.value[key] != null,
  ),
)

const hasBenchmarkMetrics = computed(
  () => metrics.value.benchmark_return != null || metrics.value.excess_return != null,
)

const hasCapitalMetrics = computed(
  () => metrics.value.invested_return != null || metrics.value.capital_utilization != null,
)

function formatDate(dateStr) {
  if (!dateStr || String(dateStr).length !== 8) return dateStr
  const s = String(dateStr)
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A'
  return `¥${Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A'
  return `${(Number(value) * 100).toFixed(2)}%`
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return Number(value).toFixed(2)
}
</script>

<style scoped>
.backtest-result-detail {
  min-width: 0;
}

.state-message {
  padding: 24px;
  text-align: center;
  color: #64748b;
}

.state-message.error {
  color: #b91c1c;
  background: #fef2f2;
  border-radius: 8px;
}

.result-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.metrics-section h4,
.trades-section h4,
.equity-section h4 {
  margin: 0 0 12px;
  color: #0f172a;
  font-size: 15px;
}

.task-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px 16px;
  margin-bottom: 12px;
}

.detail-item {
  display: flex;
  gap: 8px;
  font-size: 13px;
}

.detail-item .label {
  color: #64748b;
  flex-shrink: 0;
}

.detail-item .value {
  color: #0f172a;
  font-weight: 600;
  word-break: break-all;
}

.params-block {
  background: #0f172a;
  border-radius: 10px;
  padding: 12px;
  overflow: auto;
  max-height: 220px;
}

.params-pre {
  margin: 0;
  color: #e2e8f0;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.metric-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px;
  text-align: center;
}

.metric-label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 8px;
}

.metric-value {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

.metric-value.positive {
  color: #15803d;
}

.metric-value.negative {
  color: #b91c1c;
}

.metric-hint {
  margin-top: 6px;
  font-size: 11px;
  color: #94a3b8;
}

.table-wrapper {
  overflow-x: auto;
}

.trades-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.trades-table th {
  background: #f8fafc;
  padding: 10px;
  text-align: left;
  font-weight: 600;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
}

.trades-table td {
  padding: 10px;
  border-bottom: 1px solid #f1f5f9;
  white-space: nowrap;
}

.trade-action {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.trade-action.buy {
  background: #eff6ff;
  color: #1d4ed8;
}

.trade-action.sell {
  background: #fef2f2;
  color: #b91c1c;
}

.positive {
  color: #15803d;
}

.negative {
  color: #b91c1c;
}

.equity-section {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
}

.empty {
  margin: 0;
  text-align: center;
  padding: 24px;
  color: #94a3b8;
}

.result-actions {
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
</style>
