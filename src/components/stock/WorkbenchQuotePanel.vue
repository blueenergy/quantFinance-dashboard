<template>
  <section class="panel-grid">
    <article class="workbench-card">
      <div class="card-title-row">
        <h3>行情估值</h3>
        <div class="analysis-actions">
          <span class="muted">
            {{ quoteSectionDate || '暂无日期' }}
            <template v-if="loading"> · 刷新中…</template>
          </span>
          <button
            type="button"
            class="text-link-button"
            :disabled="loading"
            @click="$emit('refresh')"
          >
            刷新行情
          </button>
        </div>
      </div>
      <div class="financial-metrics">
        <div v-for="metric in quoteMetrics" :key="metric.label">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
        </div>
      </div>
    </article>

    <article class="workbench-card">
      <div class="card-title-row">
        <h3>资金流</h3>
        <span class="muted">{{ latestMoneyFlow?.trade_date || '暂无日期' }}</span>
      </div>
      <div v-if="latestMoneyFlow" class="financial-metrics">
        <div v-for="metric in moneyFlowMetrics" :key="metric.label">
          <span>{{ metric.label }}</span>
          <strong :class="metric.className">{{ metric.value }}</strong>
        </div>
      </div>
      <div v-else class="muted-block">暂无该股票的资金流数据。</div>
    </article>

    <article class="workbench-card">
      <div class="card-title-row">
        <h3>进场风险 / 高位派发</h3>
        <span
          class="entry-risk-badge"
          :class="`entry-risk-${entryRiskSeverity}`"
        >
          {{ entryRiskSeverityLabel }}
        </span>
      </div>
      <div v-if="entryRisk.status === 'ok'" class="entry-risk-narrative">
        <div v-for="metric in entryRiskNarrativeRows" :key="metric.label">
          <span>{{ metric.label }}</span>
          <strong :class="metric.className">{{ metric.value }}</strong>
        </div>
      </div>
      <div v-else class="muted-block">{{ entryRisk.summary || '暂无足够样本计算进场风险。' }}</div>
      <p v-if="entryRisk.summary" class="entry-risk-summary">{{ entryRisk.summary }}</p>
      <div v-if="entryRisk.status === 'ok'" class="entry-risk-explain">
        <strong>判断逻辑</strong>
        <p>
          `mainflow20` 是近20日主力净流 / 近20日成交额，按成交规模归一；
          `派发风险值 = hipos120 × (-mainflow20)`，只在主力净流出时才代表风险。
          因此绝对流出金额很大但成交额也很大时，风险值可能仍然不高。
        </p>
        <p>
          初始参考阈值：派发风险值低于 0.02 通常只作观察；0.02-0.05 需要结合高位和涨幅复核；
          大于 0.05 且 hipos120 接近 0.97、mainflow20 为负时，可作为高位派发警觉信号。
          后续会用历史候选池分位数和未来20日表现进一步标定。
        </p>
      </div>
    </article>
  </section>

  <section class="workbench-card">
    <div class="card-title-row">
      <h3>{{ quoteKlineTitle }}</h3>
      <div class="quote-kline-actions">
        <div class="quote-kline-tf">
          <button
            v-for="item in quoteKlineTfOptions"
            :key="item.value"
            type="button"
            :class="{ on: quoteKlineTf === item.value }"
            @click="quoteKlineTf = item.value"
          >
            {{ item.label }}
          </button>
        </div>
        <span class="muted">最近 {{ quoteKlineRows.length }} 根</span>
      </div>
    </div>
    <StockKLineChart
      v-if="quoteKlineRows.length"
      :records="quoteKlineRows"
      :tf="quoteKlineTf"
    />
    <details v-if="quoteKlineRows.length" class="quote-details">
      <summary>展开最近 10 根{{ quoteKlineShortLabel }}行情明细</summary>
      <div class="quote-table-wrap">
        <table class="quote-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>收盘</th>
              <th>涨跌幅</th>
              <th>最高</th>
              <th>最低</th>
              <th>成交额</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in quoteKlineRows.slice(0, 10)" :key="row.trade_date">
              <td>
                {{ row.trade_date }}
                <span v-if="row.is_partial" class="partial-kline-tag">未完</span>
              </td>
              <td>{{ fmtNumber(row.close) }}</td>
              <td :class="pctClass(row.pct_chg ?? row.pct_change)">{{ fmtPct(row.pct_chg ?? row.pct_change) }}</td>
              <td>{{ fmtNumber(row.high) }}</td>
              <td>{{ fmtNumber(row.low) }}</td>
              <td>{{ fmtKlineAmount(row) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
    <div v-else-if="quoteKlineIsLoading" class="muted-block">正在加载{{ quoteKlineShortLabel }}行情…</div>
    <div v-else class="muted-block">暂无该股票的{{ quoteKlineShortLabel }}行情。</div>
  </section>

  <section class="workbench-card">
    <div class="card-title-row">
      <h3>主力资金趋势</h3>
      <span class="muted">金额单位：万元，展示按亿/万自动换算</span>
    </div>
    <MoneyFlowPanel
      :latest="latestMoneyFlow"
      :history="activeMoneyFlowHistory"
      :summary="moneyFlowSummary"
      :period="quoteKlineTf"
      :kline-rows="quoteKlineRows"
      :loading="moneyFlowIsLoading"
    />
  </section>
</template>

<script setup>
import MoneyFlowPanel from '../MoneyFlowPanel.vue'
import StockKLineChart from '../StockKLineChart.vue'
import {
  fmtKlineAmount,
  fmtNumber,
  fmtPct,
  pctClass,
} from '../../utils/workbenchFormat'

defineProps({
  quoteSectionDate: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  quoteMetrics: { type: Array, default: () => [] },
  latestMoneyFlow: { type: Object, default: null },
  moneyFlowMetrics: { type: Array, default: () => [] },
  entryRisk: { type: Object, default: () => ({}) },
  entryRiskSeverity: { type: String, default: 'none' },
  entryRiskSeverityLabel: { type: String, default: '' },
  entryRiskNarrativeRows: { type: Array, default: () => [] },
  quoteKlineTfOptions: { type: Array, default: () => [] },
  quoteKlineTitle: { type: String, default: '' },
  quoteKlineShortLabel: { type: String, default: '' },
  quoteKlineRows: { type: Array, default: () => [] },
  quoteKlineIsLoading: { type: Boolean, default: false },
  activeMoneyFlowHistory: { type: Array, default: () => [] },
  moneyFlowSummary: { type: Object, default: () => ({}) },
  moneyFlowIsLoading: { type: Boolean, default: false },
})

defineEmits(['refresh'])

const quoteKlineTf = defineModel('quoteKlineTf', {
  type: String,
  default: '1d',
})
</script>

<style scoped>
.panel-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, .8fr);
}
.workbench-card {
  background: rgba(15, 23, 42, 0.76);
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 18px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
  margin-bottom: 16px;
  padding: 20px;
}
h3 {
  margin: 0;
}
.card-title-row,
.analysis-actions,
.quote-kline-actions {
  align-items: center;
  display: flex;
  justify-content: space-between;
}
.card-title-row {
  gap: 12px;
  margin-bottom: 14px;
}
.analysis-actions,
.quote-kline-actions {
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}
.muted,
.muted-block {
  color: #94a3b8;
}
.muted-block {
  background: rgba(30, 41, 59, .56);
  border-radius: 12px;
  padding: 18px;
}
.text-link-button {
  background: transparent;
  border: 0;
  color: #93c5fd;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
}
.text-link-button:hover {
  color: #bfdbfe;
}
.text-link-button:disabled {
  cursor: default;
  opacity: .55;
}
.financial-metrics {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.financial-metrics div {
  background: rgba(30, 41, 59, .78);
  border-radius: 14px;
  padding: 14px;
}
.financial-metrics span {
  color: #94a3b8;
  display: block;
  font-size: 12px;
}
.financial-metrics strong {
  color: #f8fafc;
  display: block;
  font-size: 22px;
  margin: 4px 0;
}
.financial-metrics strong.is-up {
  color: #ef4444;
}
.financial-metrics strong.is-down {
  color: #22c55e;
}
.quote-kline-actions {
  gap: 10px;
}
.quote-kline-tf {
  background: rgba(15, 23, 42, .72);
  border: 1px solid rgba(148, 163, 184, .18);
  border-radius: 999px;
  display: inline-flex;
  gap: 4px;
  padding: 3px;
}
.quote-kline-tf button {
  background: transparent;
  border: 0;
  border-radius: 999px;
  color: #94a3b8;
  cursor: pointer;
  font-size: 12px;
  padding: 5px 10px;
}
.quote-kline-tf button:hover {
  color: #dbeafe;
}
.quote-kline-tf button.on {
  background: rgba(37, 99, 235, .88);
  color: #fff;
}
.entry-risk-badge {
  border: 1px solid rgba(148, 163, 184, .28);
  border-radius: 999px;
  color: #cbd5e1;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
}
.entry-risk-high {
  background: rgba(239, 68, 68, .14);
  border-color: rgba(239, 68, 68, .35);
  color: #fca5a5;
}
.entry-risk-medium {
  background: rgba(234, 179, 8, .14);
  border-color: rgba(234, 179, 8, .35);
  color: #fde68a;
}
.entry-risk-low {
  background: rgba(59, 130, 246, .14);
  border-color: rgba(59, 130, 246, .35);
  color: #bfdbfe;
}
.entry-risk-none {
  background: rgba(34, 197, 94, .12);
  border-color: rgba(34, 197, 94, .32);
  color: #bbf7d0;
}
.entry-risk-narrative {
  display: grid;
  gap: 10px;
}
.entry-risk-narrative div {
  background: rgba(15, 23, 42, .46);
  border: 1px solid rgba(148, 163, 184, .14);
  border-radius: 12px;
  padding: 10px 12px;
}
.entry-risk-narrative span {
  color: #94a3b8;
  display: block;
  font-size: 12px;
  margin-bottom: 4px;
}
.entry-risk-narrative strong {
  color: #f8fafc;
  font-size: 14px;
  line-height: 1.5;
}
.entry-risk-text-high {
  color: #fca5a5 !important;
}
.entry-risk-text-medium {
  color: #fde68a !important;
}
.entry-risk-text-low {
  color: #bfdbfe !important;
}
.entry-risk-summary,
.entry-risk-explain {
  color: #cbd5e1;
  font-size: 13px;
  line-height: 1.6;
  margin: 12px 0 0;
}
.quote-table-wrap {
  margin-top: 14px;
  overflow-x: auto;
}
.quote-details {
  background: rgba(15, 23, 42, .36);
  border: 1px solid rgba(148, 163, 184, .14);
  border-radius: 12px;
  margin-top: 14px;
  padding: 10px 12px;
}
.quote-details summary {
  color: #bfdbfe;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}
.quote-table {
  border-collapse: collapse;
  min-width: 680px;
  width: 100%;
}
.quote-table th,
.quote-table td {
  border-bottom: 1px solid rgba(148, 163, 184, .16);
  color: #cbd5e1;
  font-size: 13px;
  padding: 10px 8px;
  text-align: right;
  white-space: nowrap;
}
.quote-table th:first-child,
.quote-table td:first-child {
  text-align: left;
}
.quote-table th {
  color: #94a3b8;
  font-weight: 600;
}
.quote-table td.is-up {
  color: #ef4444;
}
.quote-table td.is-down {
  color: #22c55e;
}
.partial-kline-tag {
  background: rgba(96, 165, 250, .14);
  border: 1px solid rgba(96, 165, 250, .34);
  border-radius: 999px;
  color: #bfdbfe;
  display: inline-flex;
  font-size: 11px;
  margin-left: 6px;
  padding: 1px 6px;
}
@media (max-width: 980px) {
  .panel-grid {
    grid-template-columns: 1fr;
  }
}
</style>
