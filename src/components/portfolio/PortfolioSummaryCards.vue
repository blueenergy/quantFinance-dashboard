<template>
  <section v-if="positionSummary" class="summary-cards">
    <div class="card">
      <div class="label">持仓市值</div>
      <div class="value">{{ money(positionSummary.total_market_value) }}</div>
    </div>
    <div class="card">
      <div class="label">已实现盈亏</div>
      <div class="value">{{ signedMoney(pnlSummary.realized) }}</div>
    </div>
    <div class="card">
      <div class="label">总盈亏</div>
      <div class="value" :title="totalPnlTitle">
        {{ signedMoney(pnlSummary.total) }}
      </div>
    </div>
    <div class="card">
      <div class="label">持仓标的数</div>
      <div class="value">{{ positionSummary.holding_count }}</div>
    </div>
  </section>
</template>

<script setup>
defineProps({
  positionSummary: { type: Object, default: null },
  pnlSummary: {
    type: Object,
    default: () => ({ realized: 0, unrealized: 0, total: 0 }),
  },
  totalPnlTitle: { type: String, default: '' },
})

function money(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) : '-'
}

function signedMoney(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  const formatted = Math.abs(number).toLocaleString('zh-CN', { maximumFractionDigits: 0 })
  return `${number >= 0 ? '+' : '-'}${formatted}`
}
</script>

<style scoped>
.summary-cards {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  margin: 16px 0;
}

.card {
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 12px 14px;
}

.label {
  color: #374151;
  font-size: 12px;
  font-weight: 500;
}

.value {
  color: #111827;
  font-size: 18px;
  font-weight: 700;
  margin-top: 6px;
}
</style>
