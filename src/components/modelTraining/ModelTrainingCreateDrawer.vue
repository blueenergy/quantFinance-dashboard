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
            <select :value="form.index_code" @change="patch({ index_code: $event.target.value })">
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
            高级：指定 Parquet / snapshot
          </label>
          <template v-if="form.showAdvanced">
            <label>
              parquet_path（可选 s3://）
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
import { ML_UNIVERSE_OPTIONS, MODEL_KIND_OPTIONS } from '../../utils/modelTrainingView'

defineProps({
  open: { type: Boolean, default: false },
  form: { type: Object, required: true },
  submitting: { type: Boolean, default: false },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  submitLabel: { type: String, default: '提交' },
})

const emit = defineEmits(['close', 'submit', 'update:form'])

const universeOptions = ML_UNIVERSE_OPTIONS
const modelKindOptions = MODEL_KIND_OPTIONS

function patch(partial) {
  emit('update:form', partial)
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
