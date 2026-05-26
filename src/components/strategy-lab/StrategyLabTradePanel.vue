<template>
  <section class="trade-panel">
    <div class="section-title-row compact">
      <div>
        <h4>交易列表</h4>
        <p class="muted" v-if="selectedTradeResult">
          {{ selectedTradeResult.symbol }} · {{ selectedTradeResult.strategy_key }} ·
          {{ selectedTradeResult.trades?.length || 0 }} 笔交易
        </p>
        <p class="muted" v-if="selectedTradeResult?.metrics">
          账户收益 {{ pct(selectedTradeResult.metrics.total_return) }} ·
          投入资金收益 {{ pct(selectedTradeResult.metrics.invested_return) }} ·
          实际投入 {{ money(selectedTradeResult.metrics.invested_cash) }} ·
          资金使用率 {{ pct(selectedTradeResult.metrics.capital_utilization) }}
        </p>
      </div>
      <button
        v-if="selectedTradeResult"
        type="button"
        class="mini-btn"
        @click="emit('update:selectedTradeResult', null)"
      >
        收起
      </button>
    </div>
    <p v-if="tradeResultLoading" class="muted">正在加载交易列表...</p>
    <p v-else-if="tradeResultMessage" class="message">{{ tradeResultMessage }}</p>
    <div v-else-if="selectedTradeResult" class="table-wrap trade-table-wrap">
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>方向</th>
            <th>价格</th>
            <th>数量</th>
            <th>PnL</th>
            <th>手续费</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(trade, idx) in selectedTradeResult.trades || []" :key="`${trade.datetime}-${idx}`">
            <td>{{ trade.datetime || '-' }}</td>
            <td>{{ trade.action || '-' }}</td>
            <td>{{ num(trade.price) }}</td>
            <td>{{ trade.quantity ?? '-' }}</td>
            <td>{{ num(trade.pnl) }}</td>
            <td>{{ num(trade.commission) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="!(selectedTradeResult.trades || []).length" class="muted">该回测没有交易记录。</p>
    </div>
    <p v-else class="muted">请先在「回测结果」中点击某行的「查看交易」。</p>
  </section>
</template>

<script setup>
defineProps({
  selectedTradeResult: { type: Object, default: null },
  tradeResultLoading: { type: Boolean, default: false },
  tradeResultMessage: { type: String, default: '' },
  pct: { type: Function, required: true },
  money: { type: Function, required: true },
  num: { type: Function, required: true },
})

const emit = defineEmits(['update:selectedTradeResult'])
</script>

<style scoped>
.trade-panel {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 12px;
  margin-top: 16px;
  padding: 12px;
}

.section-title-row {
  align-items: flex-start;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.section-title-row.compact {
  align-items: center;
}

h4,
p {
  margin: 0;
}

.muted {
  color: #64748b;
  font-size: 13px;
  margin-top: 8px;
}

.message {
  color: #2563eb;
}

button {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  padding: 8px 12px;
}

.mini-btn {
  font-size: 12px;
  padding: 4px 8px;
}

.table-wrap {
  margin-top: 12px;
  overflow: auto;
}

.trade-table-wrap {
  margin-top: 8px;
}

table {
  border-collapse: collapse;
  font-size: 13px;
  width: 100%;
}

th,
td {
  border-bottom: 1px solid #e2e8f0;
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
}

th {
  background: #f1f5f9;
  color: #475569;
  font-weight: 600;
}
</style>
