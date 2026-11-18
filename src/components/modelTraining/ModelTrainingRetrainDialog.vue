<template>
  <div v-if="open" class="retrain-overlay" @click.self="$emit('close')">
    <aside class="retrain-panel" role="dialog" aria-modal="true" aria-label="重训新版本">
      <header class="retrain-head">
        <div>
          <h3>重训新版本</h3>
          <p class="muted">
            复制来源任务的完整 recipe（feature_names / model_params / data_source / walk-forward 窗口），
            只生成新的 model_id。
          </p>
        </div>
        <button type="button" class="link-btn" @click="$emit('close')">关闭 ✕</button>
      </header>
      <div class="retrain-body">
        <div class="source-line">
          <strong>来源任务</strong>
          <span>{{ job?.name || job?.job_id || '-' }}</span>
          <small class="mono">{{ job?.job_id || '-' }}</small>
          <small v-if="job?.params?.model_id">原 model_id: {{ job.params.model_id }}</small>
        </div>
        <label>
          新 model_id（必填，不能与已有模型重名）
          <input v-model="modelId" placeholder="例如 csi1000-clean-raw5-202611" />
        </label>
        <label>
          family_id（可选）
          <input v-model="familyId" placeholder="例如 csi1000-clean-raw5" />
        </label>
        <label>
          截止日期（可选）
          <input v-model="endDate" placeholder="YYYYMMDD；留空 = 最新交易日" />
          <small class="field-hint">留空时后端解析 quant_data.volume_price 最新日期。</small>
        </label>
        <label>
          任务名称（可选）
          <input v-model="name" placeholder="留空自动生成" />
        </label>
        <p v-if="localError" class="error">{{ localError }}</p>
        <p v-if="error" class="error">{{ error }}</p>
      </div>
      <footer class="retrain-foot">
        <button type="button" class="secondary-btn" :disabled="submitting" @click="$emit('close')">取消</button>
        <button type="button" :disabled="submitting" @click="submit">
          {{ submitting ? '提交中...' : '创建重训任务' }}
        </button>
      </footer>
    </aside>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  job: { type: Object, default: null },
  submitting: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['close', 'submit'])

const modelId = ref('')
const familyId = ref('')
const endDate = ref('')
const name = ref('')
const localError = ref('')

function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
}

function resetFromJob(job) {
  const params = job?.params || {}
  const base = String(params.model_id || '').trim()
  modelId.value = base ? `${base}-${currentPeriod()}` : ''
  familyId.value = String(params.family_id || '').trim()
  endDate.value = ''
  name.value = ''
  localError.value = ''
}

watch(
  () => props.open,
  (open) => {
    if (open) resetFromJob(props.job)
  },
  { immediate: true },
)

function submit() {
  localError.value = ''
  const newModelId = String(modelId.value || '').trim()
  if (!newModelId) {
    localError.value = '新 model_id 必填'
    return
  }
  emit('submit', {
    model_id: newModelId,
    family_id: String(familyId.value || '').trim() || undefined,
    end_date: String(endDate.value || '').trim() || undefined,
    name: String(name.value || '').trim() || undefined,
  })
}
</script>

<style scoped>
.retrain-overlay {
  position: fixed;
  z-index: 3000;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, .45);
}

.retrain-panel {
  width: min(560px, 100%);
  max-height: min(86dvh, 720px);
  overflow: auto;
  padding: 18px;
  border-radius: 14px;
  background: #fff;
  color: #172033;
  box-shadow: 0 20px 50px rgba(15, 23, 42, .22);
}

.retrain-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.retrain-head h3 {
  margin: 0 0 4px;
}

.retrain-head p {
  margin: 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
}

.link-btn {
  border: none;
  background: none;
  color: #64748b;
  font: inherit;
  cursor: pointer;
}

.retrain-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.source-line {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 9px 10px;
  border: 1px solid #e6eaf0;
  border-radius: 9px;
  background: #f8fafc;
  font-size: 12px;
}

.source-line strong,
.source-line span {
  color: #172033;
}

.source-line small {
  color: #64748b;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #475569;
  font-size: 12px;
}

input {
  padding: 8px 9px;
  border: 1px solid #d7dde7;
  border-radius: 8px;
  background: #fff;
  color: #172033;
  font: inherit;
  font-size: 13px;
}

.field-hint {
  color: #94a3b8;
  font-size: 11px;
}

.retrain-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.retrain-foot button {
  padding: 8px 12px;
  border: 1px solid #0f6bdc;
  border-radius: 8px;
  background: #0f6bdc;
  color: #fff;
  font: inherit;
  cursor: pointer;
}

.retrain-foot button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.retrain-foot .secondary-btn {
  border-color: #d7dde7;
  background: #fff;
  color: #334155;
}

.error {
  margin: 0;
  color: #b91c1c;
  font-size: 12px;
}

.mono {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  overflow-wrap: anywhere;
}
</style>
