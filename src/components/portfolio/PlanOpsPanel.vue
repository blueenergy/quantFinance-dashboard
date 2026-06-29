<template>
  <section v-if="visible" class="plan-ops-card">
    <div class="plan-ops-header">
      <div>
        <h3>计划执行操作</h3>
        <p class="muted">
          当前操作 plan：<code>{{ shortPlanId(planId) }}</code>
          · {{ planStatus || '-' }}
          · {{ executionModeLabel }}
        </p>
        <p class="plan-id-row">
          <span class="label">完整 plan_id</span>
          <code>{{ planId || '-' }}</code>
          <button type="button" class="link-button" :disabled="!planId" @click="$emit('copy-plan-id', planId)">
            复制
          </button>
        </p>
      </div>
      <span class="funding-badge" :class="`mode-${executionVenue}`">
        {{ executionVenueLabel }}
      </span>
    </div>

    <p v-if="scoreSnapshotStale" class="watermark-warning">
      评分快照 {{ overlay?.score_snapshot_date || '-' }}，最新评分 {{ overlay?.latest_score_date || '-' }}
      <template v-if="overlay?.score_snapshot_age_days != null">（已过期 {{ overlay.score_snapshot_age_days }} 天）</template>
      · 排名与价格可能已变化，发布时将按最新价重算股数
    </p>

    <div v-if="isPaper" class="plan-ops-actions">
      <button
        type="button"
        :disabled="paperExecuteLoading || !canExecutePaperNow"
        :title="paperExecuteReadyText"
        @click="$emit('execute-paper')"
      >
        {{ paperExecuteLoading ? '执行中…' : '立即执行 Paper' }}
      </button>
      <span class="muted">{{ paperExecuteReadyText }}</span>
    </div>

    <div v-else class="plan-ops-actions">
      <select :value="selectedLiveAccountId" @change="$emit('update:selectedLiveAccountId', $event.target.value)">
        <option value="">请选择账户</option>
        <option v-for="account in liveAccountOptions" :key="account.id" :value="account.id">
          {{ account.label }}
        </option>
      </select>
      <template v-if="!hasPublishedLiveSignals">
        <button
          type="button"
          :disabled="livePublishLoading || !selectedLiveAccountId || !canPublishLiveSignals"
          @click="$emit('preview-publish')"
        >
          {{ livePublishLoading ? '预检中…' : '实盘预检' }}
        </button>
        <button
          type="button"
          :disabled="livePublishLoading || !selectedLiveAccountId || !canPublishLiveSignals || livePublishBlockers.length"
          @click="$emit('confirm-publish')"
        >
          确认发布
        </button>
      </template>
      <template v-else>
        <input
          :value="remainderReason"
          class="reason-input"
          type="text"
          placeholder="补单原因（可选）"
          @input="$emit('update:remainderReason', $event.target.value)"
        >
        <button type="button" :disabled="remainderLoading || !selectedLiveAccountId" @click="$emit('preview-remainder')">
          {{ remainderLoading ? '预检中…' : '缺口预检' }}
        </button>
        <button
          type="button"
          :disabled="remainderLoading || !selectedLiveAccountId || !remainderActionableCount || remainderBlockers.length"
          @click="$emit('confirm-remainder')"
        >
          确认补单
        </button>
      </template>
    </div>

    <div class="plan-ops-actions cancel-plan-row">
      <button
        type="button"
        class="danger"
        :disabled="cancelPlanLoading || !canCancelCurrentPlan"
        :title="cancelPlanReadyText"
        @click="$emit('cancel-plan')"
      >
        {{ cancelPlanLoading ? '作废中…' : '作废当前计划' }}
      </button>
      <span class="muted">{{ cancelPlanReadyText }}</span>
    </div>

    <div v-if="pendingItems.length" class="pending-plan-items">
      <div class="pending-plan-header">
        <div>
          <h4>待发布/待执行计划标的</h4>
          <p class="muted">当前 approved plan 的目标列表；发布/执行前请确认买卖方向和目标股数。</p>
        </div>
        <div class="pending-plan-side">
          <div class="pending-plan-summary">
            <span class="tag-buy">买 {{ pendingSummary.buy }}</span>
            <span class="tag-sell">卖 {{ pendingSummary.sell }}</span>
            <span class="tag-hold">持有 {{ pendingSummary.hold }}</span>
          </div>
          <button
            type="button"
            class="secondary"
            :disabled="llmRiskLoading || !planId || !pendingItems.length"
            @click="$emit('rerun-llm-risk')"
          >
            {{ llmRiskLoading ? 'LLM 风控运行中…' : '运行 LLM 风控' }}
          </button>
        </div>
      </div>
      <PlanItemsTable mode="pending" :items="pendingItems" :overlay="overlay" compact />
    </div>

    <div v-if="remainderPreview" class="risk-report">
      <p>
        可补 {{ remainderActionableCount }} 项，阻断 {{ remainderPreview.risk_report?.blocked_count ?? 0 }} 条，
        可用现金 {{ money(remainderPreview.available_cash) }}
        <span v-if="remainderPreview.account_synced === false" class="warning-text">账户未同步持仓，无法补单</span>
      </p>
      <p v-if="remainderBlockers.length" class="warning-text">
        {{ remainderBlockers.slice(0, 8).join(' / ') }}
      </p>
      <div v-if="remainderRows.length" class="table-wrap compact risk-report-table">
        <table>
          <thead>
            <tr>
              <th>股票</th>
              <th>方向</th>
              <th>目标</th>
              <th>账户持仓</th>
              <th>缺口</th>
              <th>补单量</th>
              <th>预估金额</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in remainderRows" :key="row.symbol" :class="{ blocked: !row.actionable }">
              <td>{{ row.name || row.symbol }}</td>
              <td>{{ row.action || '-' }}</td>
              <td>{{ row.target_shares ?? '-' }}</td>
              <td>{{ row.account_current_shares ?? '-' }}</td>
              <td>{{ row.gap_shares ?? 0 }}</td>
              <td>{{ row.topup_shares ?? 0 }}</td>
              <td>{{ money(row.estimated_amount) }}</td>
              <td class="risk-reasons">
                <span v-if="!row.reasons?.length">-</span>
                <span
                  v-for="reason in row.reasons"
                  v-else
                  :key="`${row.symbol}-${reason}`"
                  class="risk-chip"
                  :title="reason"
                >
                  {{ remainderReasonText(reason) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup>
import PlanItemsTable from './PlanItemsTable.vue'
import { money, remainderReasonText } from '../../composables/usePortfolioPlanFormat'

const props = defineProps({
  visible: { type: Boolean, default: false },
  planId: { type: String, default: '' },
  planStatus: { type: String, default: '' },
  executionModeLabel: { type: String, default: '' },
  executionVenue: { type: String, default: '' },
  executionVenueLabel: { type: String, default: '' },
  overlay: { type: Object, default: null },
  scoreSnapshotStale: { type: Boolean, default: false },
  isPaper: { type: Boolean, default: false },
  canExecutePaperNow: { type: Boolean, default: false },
  paperExecuteReadyText: { type: String, default: '' },
  paperExecuteLoading: { type: Boolean, default: false },
  selectedLiveAccountId: { type: String, default: '' },
  liveAccountOptions: { type: Array, default: () => [] },
  canPublishLiveSignals: { type: Boolean, default: false },
  hasPublishedLiveSignals: { type: Boolean, default: false },
  livePublishLoading: { type: Boolean, default: false },
  livePublishBlockers: { type: Array, default: () => [] },
  canCancelCurrentPlan: { type: Boolean, default: false },
  cancelPlanReadyText: { type: String, default: '' },
  cancelPlanLoading: { type: Boolean, default: false },
  pendingItems: { type: Array, default: () => [] },
  pendingSummary: { type: Object, default: () => ({ buy: 0, sell: 0, hold: 0 }) },
  llmRiskLoading: { type: Boolean, default: false },
  remainderPreview: { type: Object, default: null },
  remainderRows: { type: Array, default: () => [] },
  remainderActionableCount: { type: Number, default: 0 },
  remainderBlockers: { type: Array, default: () => [] },
  remainderLoading: { type: Boolean, default: false },
  remainderReason: { type: String, default: '' },
})

defineEmits([
  'copy-plan-id',
  'execute-paper',
  'preview-publish',
  'confirm-publish',
  'preview-remainder',
  'confirm-remainder',
  'cancel-plan',
  'rerun-llm-risk',
  'update:selectedLiveAccountId',
  'update:remainderReason',
])

function shortPlanId(planId) {
  const text = String(planId || '')
  if (!text) return '-'
  if (text.length <= 28) return text
  return `${text.slice(0, 18)}…${text.slice(-8)}`
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

.watermark-warning {
  color: #9a6700;
  font-size: 13px;
}

.plan-ops-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.plan-ops-actions select,
.plan-ops-actions input {
  border: 1px solid #111827;
  border-radius: 4px;
  color: #111827;
  min-height: 36px;
  padding: 8px 10px;
}

.reason-input {
  min-width: 220px;
}

.cancel-plan-row {
  margin-top: 10px;
}

.pending-plan-items {
  background: #f8fafc;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  margin-top: 12px;
  padding: 12px;
}

.pending-plan-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 10px;
}

.pending-plan-header h4 {
  color: #111827;
  font-size: 14px;
  margin: 0 0 4px;
}

.pending-plan-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pending-plan-side {
  align-items: flex-end;
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.risk-report {
  background: #f8fafc;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  margin-top: 12px;
  padding: 12px;
}

.risk-report p {
  margin: 0 0 8px;
}

.warning-text {
  color: #b45309;
  font-size: 13px;
}

.table-wrap {
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  overflow-x: auto;
}

.table-wrap.compact table {
  font-size: 13px;
}

table {
  border-collapse: collapse;
  width: 100%;
}

th,
td {
  border-bottom: 1px solid #e5e7eb;
  color: #111827;
  padding: 10px 12px;
  text-align: left;
}

th {
  background: #f3f4f6;
  color: #111827;
  font-size: 13px;
  font-weight: 600;
}

tbody tr:hover td {
  background: #f9fafb;
}

.risk-chip {
  background: #fee2e2;
  border: 1px solid #fca5a5;
  border-radius: 4px;
  color: #991b1b;
  display: inline-block;
  font-size: 11px;
  margin-right: 4px;
  padding: 1px 4px;
}

tr.blocked {
  background: #fff5f5;
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
