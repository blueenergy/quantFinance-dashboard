<template>
  <section v-if="timelineData" class="cycle-card" :class="{ 'needs-action': timelineData.action_required }">
    <div class="cycle-card-header">
      <div>
        <h3>当前周期状态</h3>
        <p class="cycle-state">{{ timelineData.today_state }}</p>
      </div>
      <span class="funding-badge" :class="`mode-${executionVenue}`">{{ executionVenueLabel }}</span>
    </div>
    <div class="cycle-metrics">
      <div>
        <span class="label">调仓进度</span>
        <strong>{{ timelineData.current_cycle?.elapsed_trading_days ?? 0 }} / {{ timelineData.current_cycle?.rebalance_days ?? '-' }} 交易日</strong>
        <div class="progress-bar"><div class="progress-fill" :style="{ width: `${cycleProgressPct}%` }" /></div>
      </div>
      <div>
        <span class="label">预计下次调仓</span>
        <strong>{{ timelineData.current_cycle?.next_rebalance_estimate || '-' }}</strong>
      </div>
      <div>
        <span class="label">理论漂移换手</span>
        <strong>{{ pct(timelineData.latest_drift_summary?.estimated_turnover) }}</strong>
        <small>买 {{ timelineData.latest_drift_summary?.buy_count ?? 0 }} / 卖 {{ timelineData.latest_drift_summary?.sell_count ?? 0 }}</small>
      </div>
      <div>
        <span class="label">需处理</span>
        <strong>{{ timelineData.action_required ? '是' : '否' }}</strong>
      </div>
    </div>
    <p v-if="timelineData.latest_drift_summary?.non_executable_reason === 'monitor_no_trade'" class="monitor-hint">
      未到调仓周期，本日不交易；上方漂移为若今日调仓的理论变化。
    </p>
    <div v-if="timelineData.action_required || latestPlanId" class="cycle-actions">
      <p v-if="pendingActionPlan" class="action-banner">
        待审批计划：<strong>{{ pendingActionPlan.date }}</strong> · {{ pendingActionPlan.today_state }}
        <span class="muted">请在下方「待审批计划复核」核对标的与 AI 风控后批准/拒绝。</span>
      </p>
      <button
        type="button"
        class="secondary"
        :disabled="forceRebalanceSubmitting || !operationPlanId || Boolean(forceRebalanceBlockReason)"
        :title="forceRebalanceBlockReason || ''"
        @click="$emit('force-rebalance')"
      >
        {{ forceRebalanceSubmitting ? '提交中…' : '立即调仓 / 强制建仓' }}
      </button>
      <span v-if="forceRebalanceBlockReason" class="warning-text">{{ forceRebalanceBlockReason }}</span>
      <span v-else class="muted">重新生成一份强制调仓计划；不会执行当前已有 plan。</span>
    </div>
  </section>
</template>

<script setup>
defineProps({
  timelineData: { type: Object, default: null },
  executionVenue: { type: String, default: '' },
  executionVenueLabel: { type: String, default: '' },
  cycleProgressPct: { type: Number, default: 0 },
  pendingActionPlan: { type: Object, default: null },
  latestPlanId: { type: String, default: '' },
  operationPlanId: { type: String, default: '' },
  forceRebalanceSubmitting: { type: Boolean, default: false },
  forceRebalanceBlockReason: { type: String, default: '' },
})

defineEmits(['force-rebalance'])

function pct(value) {
  const number = Number(value)
  return Number.isFinite(number) ? `${(number * 100).toFixed(2)}%` : '-'
}
</script>

<style scoped>
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
  color: #111827;
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

.cycle-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

.action-banner {
  align-items: center;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0;
  padding: 10px 12px;
}

.muted {
  color: #374151;
  font-size: 13px;
  margin: 0;
}

.warning-text {
  color: #b45309;
  font-size: 13px;
  font-weight: 600;
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

button.secondary {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
}

button:disabled {
  border-color: #9ca3af;
  color: #6b7280;
  cursor: not-allowed;
  opacity: 1;
}
</style>
