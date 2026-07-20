<template>
  <div
    v-if="open"
    class="drawer-overlay"
    @click.self="$emit('close')"
  >
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
            <input :value="form.name" @input="onNameInput" />
          </label>
          <label>
            universe
            <select :value="form.universe_index" @change="onUniverseChange">
              <option v-for="universe in universeOptions" :key="universe.value" :value="universe.value">
                {{ universe.label }}
              </option>
            </select>
          </label>
          <label>
            start_date
            <input :value="form.start_date" type="date" @input="patchForm({ start_date: $event.target.value })" />
          </label>
          <label>
            end_date
            <input :value="form.end_date" type="date" @input="patchForm({ end_date: $event.target.value })" />
          </label>
          <label>
            score_column
            <input :value="form.score_column" @input="patchForm({ score_column: $event.target.value })" />
          </label>
          <label>
            growth:cycle 权重
            <input
              :value="form.growth_cycle_weights"
              placeholder="30:70,40:60"
              @input="patchForm({ growth_cycle_weights: $event.target.value })"
            />
            <small class="field-hint">逗号分隔可对比多组，如 30:70,60:40</small>
          </label>
          <label>
            Top N
            <input
              :value="form.top_n_values"
              placeholder="10,20,50"
              @input="patchForm({ top_n_values: $event.target.value })"
            />
          </label>
          <label>
            rebalance_days
            <input
              :value="form.horizon"
              type="number"
              min="1"
              @input="patchNumber('horizon', $event.target.value)"
            />
          </label>
          <label>
            active caps
            <input
              :value="form.active_caps"
              placeholder="0.2,0.25,0.3"
              @input="patchForm({ active_caps: $event.target.value })"
            />
          </label>
          <label>
            legacy transaction_cost
            <input
              :value="form.transaction_cost"
              type="number"
              min="0"
              step="0.0001"
              @input="patchNumber('transaction_cost', $event.target.value)"
            />
          </label>
          <label>
            buy commission
            <input
              :value="form.buy_commission_rate"
              type="number"
              min="0"
              step="0.00001"
              @input="patchNumber('buy_commission_rate', $event.target.value)"
            />
          </label>
          <label>
            sell commission
            <input
              :value="form.sell_commission_rate"
              type="number"
              min="0"
              step="0.00001"
              @input="patchNumber('sell_commission_rate', $event.target.value)"
            />
          </label>
          <label>
            min commission
            <input
              :value="form.min_commission"
              type="number"
              min="0"
              step="0.1"
              @input="patchNumber('min_commission', $event.target.value)"
            />
          </label>
          <label>
            stamp tax
            <input
              :value="form.stamp_tax_rate"
              type="number"
              min="0"
              step="0.00001"
              @input="patchNumber('stamp_tax_rate', $event.target.value)"
            />
          </label>
          <label>
            initial capital
            <input
              :value="form.initial_capital"
              type="number"
              min="0"
              step="10000"
              @input="patchNumber('initial_capital', $event.target.value)"
            />
          </label>
          <label>
            浮动止盈
            <input
              :value="form.trailing_stop_pcts"
              placeholder="0,0.1,0.15,0.2"
              @input="patchForm({ trailing_stop_pcts: $event.target.value })"
            />
            <small class="field-hint">逗号分隔多档 A/B，0 表示关闭；与 CLI --trailing-stop-pcts 一致</small>
          </label>
        </div>
      </div>
      <footer class="drawer-footer">
        <button type="button" class="secondary-btn" @click="$emit('close')">取消</button>
        <button
          type="button"
          :disabled="submitting || !form.start_date || !form.end_date"
          @click="$emit('submit')"
        >
          {{ submitting ? '提交中...' : submitLabel }}
        </button>
      </footer>
    </aside>
  </div>
</template>

<script setup>
const props = defineProps({
  open: { type: Boolean, default: false },
  form: { type: Object, required: true },
  universeOptions: { type: Array, default: () => [] },
  submitting: { type: Boolean, default: false },
  title: { type: String, default: '新建研究任务' },
  subtitle: { type: String, default: '' },
  submitLabel: { type: String, default: '提交研究任务' },
})

const emit = defineEmits(['close', 'submit', 'update:form', 'name-touched', 'universe-change'])

function patchForm(patch) {
  const next = { ...props.form, ...patch }
  emit('update:form', next)
  return next
}

function patchNumber(key, raw) {
  const number = Number.parseFloat(raw)
  patchForm({ [key]: Number.isNaN(number) ? raw : number })
}

function onNameInput(event) {
  patchForm({ name: event.target.value })
  emit('name-touched')
}

function onUniverseChange(event) {
  const next = patchForm({ universe_index: event.target.value })
  emit('universe-change', next.universe_index)
}
</script>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(15, 23, 42, .4);
  display: flex;
  justify-content: flex-end;
}

.drawer-panel {
  width: min(640px, 100%);
  height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 24px rgba(15, 23, 42, .12);
}

.drawer-head,
.drawer-footer {
  flex: none;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid #eef2f7;
}

.drawer-footer {
  border-bottom: 0;
  border-top: 1px solid #eef2f7;
  justify-content: flex-end;
}

.drawer-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px 20px 20px;
}

.drawer-head h3 {
  margin: 0 0 4px;
}

.muted {
  color: #64748b;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin: 14px 0;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}

input,
select {
  border: 1px solid #d9e1ec;
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
}

.field-hint {
  font-weight: 400;
  color: #94a3b8;
  font-size: 12px;
}

button {
  border: 1px solid #0f6bdc;
  background: #0f6bdc;
  color: #fff;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font: inherit;
}

button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.secondary-btn {
  border-color: #d9e1ec;
  background: #fff;
  color: #334155;
}

.link-btn {
  border: none;
  background: transparent;
  color: #0f6bdc;
  padding: 2px 4px;
  cursor: pointer;
  font: inherit;
  text-decoration: underline;
}

@media (max-width: 900px) {
  .drawer-panel {
    width: 100%;
  }
}
</style>
