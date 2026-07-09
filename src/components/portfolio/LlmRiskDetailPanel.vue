<template>
  <Teleport to="body">
    <div v-if="detail" class="llm-popover-backdrop" @click="$emit('close')">
      <div
        class="llm-detail-panel"
        :class="{ 'llm-detail-panel--floating': Boolean(detail.pos) }"
        :style="panelStyle"
        @click.stop
      >
        <div class="llm-detail-head">
          <span class="llm-detail-title">
            {{ isOpportunity ? 'LLM 机会详情' : 'LLM 风控详情' }}<template v-if="detail.symbol"> · {{ detail.name || detail.symbol }}</template>
          </span>
          <div class="llm-detail-tools">
            <span class="llm-font-label">字号</span>
            <button type="button" class="llm-font-btn" :disabled="fontPx <= min" @click="$emit('dec')">A−</button>
            <span class="llm-font-size">{{ fontPx }}px</span>
            <button type="button" class="llm-font-btn" :disabled="fontPx >= max" @click="$emit('inc')">A+</button>
            <button type="button" class="llm-detail-copy" @click="$emit('copy')">
              {{ copied ? '已复制 ✓' : '复制全文' }}
            </button>
            <button type="button" class="llm-detail-close" @click="$emit('close')">关闭</button>
          </div>
        </div>

        <pre class="llm-detail-body" :style="{ fontSize: fontPx + 'px', maxHeight: bodyMaxHeight }">{{ detail.text }}</pre>

        <div v-if="findings.length" class="llm-findings">
          <div v-for="finding in findings" :key="finding.finding_key || finding.summary" class="llm-finding-card">
            <div class="llm-finding-head">
              <span class="llm-finding-sev" :class="isOpportunity ? `opportunity-${finding.strength || 'none'}` : `risk-${finding.severity || 'none'}`">
                {{ isOpportunity ? strengthLabel(finding.strength) : severityLabel(finding.severity) }}
              </span>
              <span class="llm-finding-cat">{{ finding.category || 'other' }}</span>
              <span v-if="finding.resolution_mode" class="llm-finding-mode">{{ finding.resolution_mode }}</span>
            </div>
            <p class="llm-finding-summary">{{ finding.summary || finding.subject || finding.finding_key }}</p>
            <p v-if="finding.detail" class="llm-finding-detail">{{ finding.detail }}</p>
            <p v-if="finding.suggested_resolution?.reason" class="llm-suggested">
              <strong>LLM 建议解除：</strong>{{ finding.suggested_resolution.reason }}
            </p>
            <p v-if="finding.suggested_closure?.reason" class="llm-suggested">
              <strong>LLM 建议关闭：</strong>{{ finding.suggested_closure.reason }}
            </p>
            <div v-if="finding.finding_key" class="llm-finding-actions">
              <template v-if="isOpportunity">
                <button
                  type="button"
                  class="llm-action-btn llm-action-btn--primary"
                  :disabled="actionBusy"
                  @click="$emit('realize-opportunity', finding)"
                >
                  标记兑现
                </button>
                <button
                  type="button"
                  class="llm-action-btn"
                  :disabled="actionBusy"
                  @click="$emit('invalidate-opportunity', finding)"
                >
                  标记落空
                </button>
              </template>
              <button
                v-else-if="finding.suggested_resolution"
                type="button"
                class="llm-action-btn llm-action-btn--primary"
                :disabled="actionBusy"
                @click="$emit('confirm-resolution', finding)"
              >
                确认解除
              </button>
              <button
                v-if="!isOpportunity"
                type="button"
                class="llm-action-btn"
                :disabled="actionBusy"
                @click="$emit('resolve', finding)"
              >
                手动解除
              </button>
            </div>
          </div>
        </div>

        <div v-if="detail.symbol" class="llm-manual-add">
          <button type="button" class="llm-action-btn" @click="showAddForm = !showAddForm">
            {{ showAddForm ? '收起' : (isOpportunity ? '手动添加机会' : '手动添加风险') }}
          </button>
          <form v-if="showAddForm" class="llm-add-form" @submit.prevent="submitManualAdd">
            <label>
              {{ isOpportunity ? '强度' : '严重度' }}
              <select v-model="addForm.severity">
                <option value="low">{{ isOpportunity ? '弱' : '低' }}</option>
                <option value="medium">中</option>
                <option value="high">{{ isOpportunity ? '强' : '高' }}</option>
              </select>
            </label>
            <label>
              摘要
              <input v-model.trim="addForm.summary" type="text" maxlength="500" required :placeholder="isOpportunity ? '简要描述机会' : '简要描述风险'">
            </label>
            <label>
              详情
              <textarea v-model.trim="addForm.detail" rows="3" maxlength="4000" placeholder="可选补充说明" />
            </label>
            <button type="submit" class="llm-action-btn llm-action-btn--primary" :disabled="actionBusy || !addForm.summary">
              提交
            </button>
          </form>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'

const props = defineProps({
  detail: { type: Object, default: null },
  fontPx: { type: Number, default: 15 },
  min: { type: Number, default: 12 },
  max: { type: Number, default: 30 },
  copied: { type: Boolean, default: false },
  actionBusy: { type: Boolean, default: false },
})

const emit = defineEmits([
  'inc',
  'dec',
  'copy',
  'close',
  'confirm-resolution',
  'resolve',
  'realize-opportunity',
  'invalidate-opportunity',
  'manual-add',
])

const showAddForm = ref(false)
const addForm = reactive({
  severity: 'medium',
  summary: '',
  detail: '',
})

watch(() => props.detail?.key, () => {
  showAddForm.value = false
  addForm.severity = 'medium'
  addForm.summary = ''
  addForm.detail = ''
})

const findings = computed(() => {
  const source = isOpportunity.value ? props.detail?.opportunity : props.detail?.risk
  const llm = source?.llm || source
  return Array.isArray(llm?.findings) ? llm.findings : []
})

const isOpportunity = computed(() => props.detail?.mode === 'opportunity')

const panelStyle = computed(() => {
  const pos = props.detail?.pos
  if (!pos) return {}
  return {
    top: `${pos.top}px`,
    left: `${pos.left}px`,
    width: `${pos.width}px`,
  }
})

const bodyMaxHeight = computed(() => {
  const pos = props.detail?.pos
  return pos?.maxHeight ? `${Math.max(80, pos.maxHeight - 56)}px` : '200px'
})

function severityLabel(severity) {
  if (severity === 'high') return '高'
  if (severity === 'medium') return '中'
  if (severity === 'low') return '低'
  return '正常'
}

function strengthLabel(strength) {
  if (strength === 'high') return '强'
  if (strength === 'medium') return '中'
  if (strength === 'low') return '弱'
  return '无'
}

function submitManualAdd() {
  if (!addForm.summary.trim()) return
  emit('manual-add', {
    severity: addForm.severity,
    strength: addForm.severity,
    summary: addForm.summary.trim(),
    detail: addForm.detail.trim(),
  })
}
</script>

<style scoped>
.llm-popover-backdrop {
  background: transparent;
  inset: 0;
  position: fixed;
  z-index: 3000;
}

.llm-detail-panel {
  background: #f8faff;
  border: 1px solid #818cf8;
  border-radius: 8px;
  margin: 10px;
  max-height: 90vh;
  overflow: auto;
  padding: 10px 12px;
}

.llm-detail-panel--floating {
  box-shadow: 0 12px 32px rgba(30, 41, 59, 0.28);
  margin: 0;
  position: fixed;
}

.llm-detail-head {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: space-between;
}

.llm-detail-title {
  color: #3730a3;
  font-size: 13px;
  font-weight: 700;
}

.llm-detail-tools {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.llm-font-label {
  color: #64748b;
  font-size: 12px;
}

.llm-font-btn,
.llm-detail-copy,
.llm-detail-close,
.llm-action-btn {
  background: #fff;
  border: 1px solid #c7d2fe;
  border-radius: 6px;
  color: #4338ca;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  padding: 2px 8px;
}

.llm-font-btn:disabled,
.llm-action-btn:disabled {
  color: #9ca3af;
  cursor: not-allowed;
  opacity: 0.7;
}

.llm-font-btn:not(:disabled):hover,
.llm-detail-copy:hover,
.llm-detail-close:hover,
.llm-action-btn:not(:disabled):hover {
  background: #eef2ff;
}

.llm-detail-close {
  border-color: #cbd5e1;
  color: #475569;
}

.llm-font-size {
  color: #334155;
  font-size: 12px;
  min-width: 34px;
  text-align: center;
}

.llm-detail-body {
  color: #1f2937;
  font-family: inherit;
  line-height: 1.65;
  margin: 8px 0 0;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.llm-findings {
  border-top: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  padding-top: 8px;
}

.llm-finding-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 8px 10px;
}

.llm-finding-head {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;
}

.llm-finding-sev {
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
}

.llm-finding-sev.risk-high { background: #fee2e2; color: #b91c1c; }
.llm-finding-sev.risk-medium { background: #ffedd5; color: #c2410c; }
.llm-finding-sev.risk-low { background: #fef9c3; color: #a16207; }
.llm-finding-sev.risk-none { background: #f1f5f9; color: #64748b; }
.llm-finding-sev.opportunity-high { background: #dcfce7; color: #15803d; }
.llm-finding-sev.opportunity-medium { background: #e0f2fe; color: #0369a1; }
.llm-finding-sev.opportunity-low { background: #ecfccb; color: #4d7c0f; }
.llm-finding-sev.opportunity-none { background: #f1f5f9; color: #64748b; }

.llm-finding-cat,
.llm-finding-mode {
  color: #64748b;
  font-size: 11px;
}

.llm-finding-summary {
  font-size: 13px;
  font-weight: 600;
  margin: 0;
}

.llm-finding-detail,
.llm-suggested {
  color: #475569;
  font-size: 12px;
  margin: 4px 0 0;
}

.llm-finding-actions,
.llm-manual-add {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.llm-action-btn--primary {
  background: #4338ca;
  border-color: #4338ca;
  color: #fff;
}

.llm-action-btn--primary:not(:disabled):hover {
  background: #3730a3;
}

.llm-add-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
  width: 100%;
}

.llm-add-form label {
  color: #334155;
  display: flex;
  flex-direction: column;
  font-size: 12px;
  gap: 2px;
}

.llm-add-form input,
.llm-add-form textarea,
.llm-add-form select {
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-size: 12px;
  padding: 4px 6px;
}
</style>
