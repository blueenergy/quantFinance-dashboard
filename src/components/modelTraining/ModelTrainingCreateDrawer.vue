<template>
  <div v-if="open" class="drawer-overlay" @click.self="$emit('close')">
    <aside
      class="drawer-panel"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      @keydown.esc.stop="$emit('close')"
    >
      <header class="drawer-head">
        <div>
          <h3>{{ title }}</h3>
          <p class="muted">{{ subtitle }}</p>
        </div>
        <button type="button" class="link-btn" @click="$emit('close')">关闭 ✕</button>
      </header>
      <div class="drawer-body">
        <div class="form-grid">
          <label>
            名称
            <input :value="form.name" @input="patch({ name: $event.target.value })" />
          </label>
          <label>
            指数池
            <select :value="form.index_code" @change="onIndexChange($event.target.value)">
              <option v-for="u in universeOptions" :key="u.value" :value="u.value">{{ u.label }}</option>
            </select>
          </label>
          <label>
            模型
            <select :value="form.model_kind" @change="patch({ model_kind: $event.target.value })">
              <option v-for="m in modelKindOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
          </label>
          <label>
            数据快照
            <select :value="form.snapshot_id || ''" :disabled="snapshotsLoading" @change="onSnapshotSelect($event.target.value)">
              <option value="">默认（合成数据，不读 S3）</option>
              <option
                v-for="s in snapshotsForIndex"
                :key="s.snapshot_id"
                :value="s.snapshot_id"
              >
                {{ formatDatasetSnapshotLabel(s) }}
              </option>
            </select>
          </label>
          <p v-if="snapshotsLoading" class="field-hint">正在加载 quant_ml 快照列表…</p>
          <p v-else-if="!snapshotsForIndex.length && snapshots.length" class="field-hint">
            当前指数暂无已注册快照；可切换指数或先运行物化 Job。
          </p>
          <p v-else-if="!snapshots.length && !snapshotsLoading" class="field-hint">
            暂无快照记录（materialize 需带 --register-mongo）。
          </p>
          <label>
            训练窗口（交易日）
            <input
              type="number"
              min="5"
              max="500"
              :value="form.train_days"
              @input="patch({ train_days: Number($event.target.value) })"
            />
          </label>
          <label>
            测试窗口（交易日）
            <input
              type="number"
              min="1"
              max="120"
              :value="form.test_days"
              @input="patch({ test_days: Number($event.target.value) })"
            />
          </label>
          <label>
            Purge（交易日）
            <input
              type="number"
              min="0"
              max="120"
              :value="form.purge_days"
              @input="patch({ purge_days: Number($event.target.value) })"
            />
          </label>
          <label class="checkbox-row">
            <input
              type="checkbox"
              :checked="form.showAdvanced"
              @change="patch({ showAdvanced: $event.target.checked })"
            />
            高级：手动编辑 Parquet / snapshot
          </label>
          <template v-if="form.showAdvanced">
            <label>
              parquet_path（s3://）
              <input :value="form.parquet_path" @input="patch({ parquet_path: $event.target.value })" />
            </label>
            <label>
              snapshot_id
              <input :value="form.snapshot_id" @input="patch({ snapshot_id: $event.target.value })" />
            </label>
          </template>
        </div>
      </div>
      <footer class="drawer-foot">
        <button type="button" :disabled="submitting" @click="$emit('submit')">{{ submitLabel }}</button>
      </footer>
    </aside>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  ML_UNIVERSE_OPTIONS,
  MODEL_KIND_OPTIONS,
  formatDatasetSnapshotLabel,
} from '../../utils/modelTrainingView'

const props = defineProps({
  open: { type: Boolean, default: false },
  form: { type: Object, required: true },
  snapshots: { type: Array, default: () => [] },
  snapshotsLoading: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  submitLabel: { type: String, default: '提交' },
})

const emit = defineEmits(['close', 'submit', 'update:form'])

const universeOptions = ML_UNIVERSE_OPTIONS
const modelKindOptions = MODEL_KIND_OPTIONS

const snapshotsForIndex = computed(() => {
  const code = props.form.index_code
  return (props.snapshots || []).filter((s) => !code || s.index_code === code)
})

function patch(partial) {
  emit('update:form', partial)
}

function onIndexChange(indexCode) {
  const snap = (props.snapshots || []).find((s) => s.snapshot_id === props.form.snapshot_id)
  if (snap && snap.index_code && snap.index_code !== indexCode) {
    patch({
      index_code: indexCode,
      snapshot_id: '',
      parquet_path: '',
      showAdvanced: false,
    })
    return
  }
  patch({ index_code: indexCode })
}

function onSnapshotSelect(snapshotId) {
  const id = String(snapshotId || '').trim()
  if (!id) {
    patch({ snapshot_id: '', parquet_path: '', showAdvanced: false })
    return
  }
  const row = (props.snapshots || []).find((s) => s.snapshot_id === id)
  if (!row) {
    patch({ snapshot_id: id, showAdvanced: true })
    return
  }
  patch({
    snapshot_id: row.snapshot_id,
    parquet_path: row.parquet_path || '',
    index_code: row.index_code || props.form.index_code,
    showAdvanced: true,
  })
}
</script>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  justify-content: flex-end;
}

.drawer-panel {
  width: min(480px, 100%);
  height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(15, 23, 42, 0.12);
}

.drawer-head,
.drawer-foot {
  padding: 16px 20px;
  border-bottom: 1px solid #e6eaf0;
}

.drawer-foot {
  border-bottom: none;
  border-top: 1px solid #e6eaf0;
}

.drawer-body {
  flex: 1;
  overflow: auto;
  padding: 16px 20px;
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: #334155;
}

input,
select {
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.checkbox-row {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.muted {
  color: #64748b;
  font-size: 13px;
  margin: 4px 0 0;
}

.field-hint {
  color: #64748b;
  font-size: 12px;
  margin: -6px 0 0;
}

.link-btn {
  border: none;
  background: none;
  color: #0f6bdc;
  cursor: pointer;
}

.drawer-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.drawer-foot button {
  width: 100%;
  padding: 10px 14px;
  border: none;
  border-radius: 8px;
  background: #0f6bdc;
  color: #fff;
  cursor: pointer;
}

.drawer-foot button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
