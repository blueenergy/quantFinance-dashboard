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
        <button
          type="button"
          class="link-btn"
          :disabled="benchLlmRiskLoading || !benchData?.bench?.length"
          @click="$emit('load-bench-llm-risk')"
        >
          {{ benchLlmRiskLoading ? 'LLM 风控运行中…' : '运行 LLM 风控' }}
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
                <div class="risk-tags">
                  <span
                    v-if="benchRowRisk(row)"
                    class="risk-badge"
                    :class="`risk-${riskDisplaySeverity(benchRowRisk(row))}`"
                    :title="aiRiskTitle(benchRowRisk(row))"
                  >
                    {{ riskSeverityLabel(riskDisplaySeverity(benchRowRisk(row))) }}
                  </span>
                  <span v-else class="muted">-</span>
                  <span
                    v-if="benchRowRisk(row)?.llm"
                    class="llm-risk-tag"
                    :class="`risk-${benchRowRisk(row).llm.severity || 'none'}`"
                    :title="llmRiskTitle(benchRowRisk(row))"
                  >LLM</span>
                  <button
                    v-if="benchRowRisk(row)?.llm"
                    type="button"
                    class="llm-risk-copy"
                    :title="llmCopyTitle(benchRowRisk(row))"
                    @click.stop="copyLlmRisk(benchRowRisk(row), row.symbol)"
                  >
                    {{ copiedLlmRiskSymbol === row.symbol ? '已复制' : '复制' }}
                  </button>
                </div>
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
import { ref } from 'vue'
import { aiRiskTitle, llmRiskTitle, num, riskDisplaySeverity, riskSeverityLabel } from '../../composables/usePortfolioPlanFormat'
import { copyTextToClipboard } from '../../utils/clipboard'

const props = defineProps({
  visible: { type: Boolean, default: false },
  starter: { type: Object, default: null },
  benchData: { type: Object, default: null },
  benchRisk: { type: Object, default: null },
  benchRiskBySymbol: { type: Object, default: () => ({}) },
  benchRiskLoading: { type: Boolean, default: false },
  benchLlmRiskLoading: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

defineEmits(['close', 'load-bench-risk', 'load-bench-llm-risk', 'preview-swap'])

const copiedLlmRiskSymbol = ref('')

function llmCopyTitle(risk) {
  return `${llmRiskTitle(risk)}\n\n点击复制完整 LLM 风控文本`
}

let copiedResetTimer = null
async function copyLlmRisk(risk, symbol) {
  const ok = await copyTextToClipboard(llmRiskTitle(risk))
  if (!ok) return
  copiedLlmRiskSymbol.value = symbol
  if (copiedResetTimer) clearTimeout(copiedResetTimer)
  copiedResetTimer = setTimeout(() => {
    if (copiedLlmRiskSymbol.value === symbol) copiedLlmRiskSymbol.value = ''
  }, 2000)
}

function symbolRisk(map, symbol) {
  const text = String(symbol || '')
  return map?.[text] || map?.[text.split('.')[0]] || null
}

function benchRowRisk(row) {
  const rowRisk = row?.ai_risk || null
  const keyedRisk = symbolRisk(props.benchRiskBySymbol, row?.symbol)
  const merged = { ...(keyedRisk || {}), ...(rowRisk || {}) }
  if (rowRisk?.llm || keyedRisk?.llm) merged.llm = rowRisk?.llm || keyedRisk?.llm
  return Object.keys(merged).length ? merged : null
}
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

.risk-tags {
  align-items: center;
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}

.llm-risk-tag {
  background: #eef2ff;
  border: 1px solid #818cf8;
  border-radius: 999px;
  color: #3730a3;
  cursor: help;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
  padding: 1px 5px;
}

.llm-risk-tag.risk-high {
  background: #fee2e2;
  border-color: #f87171;
  color: #b91c1c;
}

.llm-risk-tag.risk-medium {
  background: #ffedd5;
  border-color: #fb923c;
  color: #c2410c;
}

.llm-risk-tag.risk-low {
  background: #fef9c3;
  border-color: #facc15;
  color: #854d0e;
}

.llm-risk-tag.risk-none {
  background: #ecfdf5;
  border-color: #34d399;
  color: #047857;
}

.llm-risk-copy {
  background: #fff;
  border: 1px solid #c7d2fe;
  border-radius: 999px;
  color: #4338ca;
  cursor: pointer;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
  padding: 1px 5px;
}

.llm-risk-copy:hover {
  background: #eef2ff;
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
