<template>
  <div v-if="visible" class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-card modal-wide">
      <h3>替补换股</h3>
      <p class="muted">
        换下 <strong>{{ starter?.symbol }}</strong>（{{ starter?.name || '-' }}），从替补席选择上场球员。
        仅本次生效，预览确认后立即下单。
      </p>
      <div class="bench-risk-bar">
        <span v-if="benchRisk" class="bench-risk-summary">
          AI风控：<b class="risk-high">{{ benchRisk.high || 0 }}高</b>
          / <b class="risk-medium">{{ benchRisk.medium || 0 }}中</b>
          / <b class="risk-low">{{ benchRisk.low || 0 }}低</b>
        </span>
        <span v-else class="muted">未体检；高风险候选上场前会二次确认。</span>
        <button
          type="button"
          class="link-btn"
          :disabled="benchRiskLoading || !benchData?.bench?.length"
          @click="$emit('load-bench-risk')"
        >
          {{ benchRiskLoading ? 'AI 风控运行中…' : '运行 AI 风控' }}
        </button>
      </div>
      <div v-if="benchData?.bench?.length" class="table-wrap">
        <table class="lineup-table">
          <thead>
            <tr>
              <th>排名</th>
              <th>代码</th>
              <th>名称</th>
              <th>分数</th>
              <th>最新收盘</th>
              <th>AI风控</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in benchData.bench" :key="row.symbol">
              <td>{{ row.rank }}</td>
              <td>{{ row.symbol }}</td>
              <td>{{ row.name || '-' }}</td>
              <td>{{ num(row.score_value) }}</td>
              <td>{{ num(row.latest_close) }}</td>
              <td>
                <span
                  v-if="benchRiskBySymbol[row.symbol]"
                  class="risk-badge"
                  :class="`risk-${benchRiskBySymbol[row.symbol].severity}`"
                  :title="aiRiskTitle(benchRiskBySymbol[row.symbol])"
                >
                  {{ riskSeverityLabel(benchRiskBySymbol[row.symbol].severity) }}
                </span>
                <span v-else class="muted">-</span>
              </td>
              <td>
                <button type="button" class="link-btn" :disabled="submitting" @click="$emit('preview-swap', row)">
                  替补上场
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="muted">替补席为空，无法换股。</p>
      <p v-if="error" class="modal-error">{{ error }}</p>
      <div class="modal-actions">
        <button type="button" @click="$emit('close')">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { aiRiskTitle, num, riskSeverityLabel } from '../../composables/usePortfolioPlanFormat'

defineProps({
  visible: { type: Boolean, default: false },
  starter: { type: Object, default: null },
  benchData: { type: Object, default: null },
  benchRisk: { type: Object, default: null },
  benchRiskBySymbol: { type: Object, default: () => ({}) },
  benchRiskLoading: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

defineEmits(['close', 'load-bench-risk', 'preview-swap'])
</script>

<style scoped>
.modal-backdrop {
  align-items: center;
  background: rgba(17, 24, 39, 0.45);
  display: flex;
  inset: 0;
  justify-content: center;
  position: fixed;
  z-index: 50;
}

.modal-card {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  max-width: 520px;
  padding: 20px;
  width: calc(100% - 32px);
}

.modal-wide {
  max-width: 760px;
}

.modal-card h3 {
  color: #111827;
  margin-top: 0;
}

.muted {
  color: #374151;
  font-size: 13px;
  margin: 0;
}

.bench-risk-bar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: space-between;
  margin: 8px 0;
}

.bench-risk-summary {
  font-size: 12px;
}

.bench-risk-summary .risk-high {
  color: #dc2626;
}

.bench-risk-summary .risk-medium {
  color: #c2410c;
}

.bench-risk-summary .risk-low {
  color: #a16207;
}

.table-wrap {
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  overflow-x: auto;
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

.risk-badge {
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
}

.risk-badge.risk-high {
  background: #fee2e2;
  color: #dc2626;
}

.risk-badge.risk-medium {
  background: #ffedd5;
  color: #c2410c;
}

.risk-badge.risk-low {
  background: #fef9c3;
  color: #a16207;
}

.risk-badge.risk-none {
  background: #ecfdf5;
  color: #047857;
}

.modal-error {
  color: #b91c1c;
  font-weight: 600;
  margin: 8px 0 0;
}

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
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

.link-btn {
  background: none;
  border: none;
  color: #c2410c;
  cursor: pointer;
  padding: 0;
}

button:disabled {
  border-color: #9ca3af;
  color: #6b7280;
  cursor: not-allowed;
  opacity: 1;
}
</style>
