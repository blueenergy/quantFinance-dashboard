<template>
  <div class="holdings-header">
    <h3>最新持仓</h3>
    <div class="holdings-actions">
      <button type="button" :disabled="!selectedLatestPlanId || riskLoading" @click="$emit('load-risk')">
        {{ riskLoading ? '体检中…' : '风控体检' }}
      </button>
      <button type="button" :disabled="!hasManualChanges" @click="$emit('open-manual')">
        提交手动调仓
      </button>
      <button
        type="button"
        class="danger"
        :disabled="!hasHoldings || liquidateSubmitting"
        @click="$emit('open-liquidate')"
      >
        {{ isLivePortfolio ? '实盘一键清仓' : '纸面一键清仓' }}
      </button>
      <button
        v-if="isLivePortfolio"
        type="button"
        :disabled="externalManualSubmitting"
        @click="$emit('open-external-manual')"
      >
        {{ externalManualSubmitting ? '补录中…' : '补录 miniQMT 手工操作' }}
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  selectedLatestPlanId: { type: String, default: '' },
  riskLoading: { type: Boolean, default: false },
  hasManualChanges: { type: Boolean, default: false },
  hasHoldings: { type: Boolean, default: false },
  liquidateSubmitting: { type: Boolean, default: false },
  isLivePortfolio: { type: Boolean, default: false },
  externalManualSubmitting: { type: Boolean, default: false },
})

defineEmits(['load-risk', 'open-manual', 'open-liquidate', 'open-external-manual'])
</script>

<style scoped>
.holdings-header {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 8px;
}

h3 {
  color: #111827;
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}

.holdings-actions {
  display: flex;
  gap: 8px;
}

button {
  background: #fff;
  border: 1px solid #111827;
  border-radius: 4px;
  color: #111827;
  cursor: pointer;
  font-weight: 500;
  padding: 8px 10px;
}

button.danger {
  background: #dc2626;
  border-color: #dc2626;
  color: #fff;
}

button:disabled {
  border-color: #9ca3af;
  color: #6b7280;
  cursor: not-allowed;
  opacity: 1;
}
</style>
