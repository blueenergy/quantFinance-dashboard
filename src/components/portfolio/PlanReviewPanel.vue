<template>
  <section v-if="visible" class="plan-ops-card plan-review-card">
    <div class="plan-ops-header">
      <div>
        <h3>待审批计划复核</h3>
        <p class="muted">
          最新 plan：<code>{{ shortPlanId(planId) }}</code> · 待审批 ·
          请先核对下方买/卖/持有方向与 AI 风控，再决定批准或拒绝。
        </p>
        <p class="plan-id-row">
          <span class="label">完整 plan_id</span>
          <code>{{ planId || '-' }}</code>
          <button type="button" class="link-button" :disabled="!planId" @click="$emit('copy-plan-id', planId)">复制</button>
        </p>
      </div>
      <div class="pending-plan-summary">
        <span class="tag-buy">买 {{ summary.buy }}</span>
        <span class="tag-sell">卖 {{ summary.sell }}</span>
        <span class="tag-hold">持有 {{ summary.hold }}</span>
      </div>
    </div>

    <p v-if="scoreSnapshotStale" class="watermark-warning">
      评分快照 {{ overlay?.score_snapshot_date || '-' }}，最新评分 {{ overlay?.latest_score_date || '-' }}
      <template v-if="overlay?.score_snapshot_age_days != null">（已过期 {{ overlay.score_snapshot_age_days }} 天）</template>
      · 排名与价格可能已变化，批准后将按最新价重算股数
    </p>

    <p v-if="riskSummary.high" class="warning-text plan-review-risk-warning">
      AI 风控发现 {{ riskSummary.high }} 个高风险标的，批准前请重点确认。
    </p>
    <p v-if="llmRiskSummary?.run_id" class="llm-risk-summary" :class="`status-${llmRiskSummary.status || 'completed'}`">
      LLM风控：{{ llmRiskStatusText(llmRiskSummary.status) }}
      · {{ llmRiskSummary.industry_count || 0 }}行业 / {{ llmRiskSummary.symbol_count || 0 }}标的
      <span v-if="llmRiskSummary.status === 'completed_with_failures'"> · 部分行业失败，已展示可用结果</span>
    </p>

    <PlanItemsTable
      mode="pending"
      :items="items"
      :overlay="overlay"
      compact
    />

    <div class="plan-ops-actions plan-review-actions">
      <button type="button" :disabled="approveSubmitting || rejectSubmitting || !planId" @click="$emit('approve')">
        {{ approveSubmitting ? '审批中…' : '批准计划' }}
      </button>
      <button type="button" class="secondary" :disabled="reviewAiRiskLoading" @click="$emit('rerun-ai-risk')">
        {{ reviewAiRiskLoading ? 'AI 风控复检中…' : '运行 AI 风控复检' }}
      </button>
      <button type="button" class="secondary" :disabled="reviewLlmRiskLoading || !planId" @click="$emit('rerun-llm-risk')">
        {{ reviewLlmRiskLoading ? 'LLM 风控运行中…' : '运行 LLM 风控' }}
      </button>
      <button type="button" class="danger" :disabled="approveSubmitting || rejectSubmitting || !planId" @click="$emit('reject')">
        {{ rejectSubmitting ? '拒绝中…' : '拒绝计划' }}
      </button>
    </div>
  </section>
</template>

<script setup>
import PlanItemsTable from './PlanItemsTable.vue'

defineProps({
  visible: { type: Boolean, default: false },
  planId: { type: String, default: '' },
  items: { type: Array, default: () => [] },
  overlay: { type: Object, default: null },
  scoreSnapshotStale: { type: Boolean, default: false },
  summary: { type: Object, default: () => ({ buy: 0, sell: 0, hold: 0 }) },
  riskSummary: { type: Object, default: () => ({ high: 0, medium: 0, low: 0 }) },
  llmRiskSummary: { type: Object, default: null },
  approveSubmitting: { type: Boolean, default: false },
  rejectSubmitting: { type: Boolean, default: false },
  reviewAiRiskLoading: { type: Boolean, default: false },
  reviewLlmRiskLoading: { type: Boolean, default: false },
})

defineEmits(['approve', 'reject', 'rerun-ai-risk', 'rerun-llm-risk', 'copy-plan-id'])

function shortPlanId(planId) {
  const text = String(planId || '')
  if (!text) return '-'
  if (text.length <= 28) return text
  return `${text.slice(0, 18)}…${text.slice(-8)}`
}

function llmRiskStatusText(status) {
  if (status === 'completed_with_failures') return '部分完成'
  if (status === 'failed') return '失败'
  if (status === 'running') return '运行中'
  return '完成'
}
</script>

<style scoped>
.plan-ops-card {
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  margin-bottom: 16px;
  padding: 14px 16px;
}

.plan-review-card {
  background: #fffdf7;
  border-color: #f59e0b;
}

.plan-ops-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 12px;
}

.plan-ops-header h3 {
  color: #111827;
  font-size: 15px;
  margin: 0 0 4px;
}

.muted {
  color: #374151;
  font-size: 13px;
  margin: 0;
}

.plan-id-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0 0;
}

.plan-id-row .label {
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
}

.plan-id-row code {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  color: #0f172a;
  font-size: 12px;
  padding: 2px 6px;
}

.link-button {
  background: transparent;
  border: 0;
  color: #2563eb;
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
}

.pending-plan-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pending-plan-summary span {
  border-radius: 999px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  white-space: nowrap;
}

.pending-plan-summary .tag-buy {
  background: #dc2626;
}

.pending-plan-summary .tag-sell {
  background: #16a34a;
}

.pending-plan-summary .tag-hold {
  background: #64748b;
}

.watermark-warning {
  color: #9a6700;
  font-size: 13px;
}

.warning-text {
  color: #b45309;
  font-size: 13px;
  font-weight: 600;
}

.plan-review-risk-warning {
  margin: 8px 0 8px;
}

.llm-risk-summary {
  background: #eef2ff;
  border: 1px solid #818cf8;
  border-radius: 6px;
  color: #3730a3;
  font-size: 12px;
  font-weight: 600;
  margin: 8px 0;
  padding: 6px 8px;
}

.llm-risk-summary.status-completed_with_failures {
  background: #fffbeb;
  border-color: #f59e0b;
  color: #92400e;
}

.llm-risk-summary.status-failed {
  background: #fef2f2;
  border-color: #f87171;
  color: #991b1b;
}

.plan-ops-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.plan-review-actions {
  margin-top: 12px;
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
