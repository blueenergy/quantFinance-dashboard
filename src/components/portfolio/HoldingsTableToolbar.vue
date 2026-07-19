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
