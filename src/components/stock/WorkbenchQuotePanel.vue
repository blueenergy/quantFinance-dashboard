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
.quote-kline-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
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
</style>
