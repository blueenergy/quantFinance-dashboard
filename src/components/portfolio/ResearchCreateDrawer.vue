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
            评分模式
            <select :value="form.score_mode || 'weighted'" @change="patchForm({ score_mode: $event.target.value })">
              <option value="column">单维 / 单评分列</option>
              <option value="weighted">多维加权配方</option>
            </select>
          </label>
          <label v-if="(form.score_mode || 'weighted') === 'column'">
            评分列
            <select :value="form.score_column" @change="patchForm({ score_column: $event.target.value })">
              <option v-for="option in scoreColumnOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <small class="field-hint">六维原子分或已有 composite 评分</small>
          </label>
          <label v-else class="score-spec-field">
            多维加权配方
            <textarea
              :value="form.score_specs"
              rows="3"
              placeholder="growth:30,cycle:70&#10;fundamental:60,value:40"
              @input="patchForm({ score_specs: $event.target.value })"
            />
            <small class="field-hint">每行一组配方；维度以逗号分隔。纯 growth+cycle 自动走兼容路径。</small>
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

const scoreColumnOptions = [
  { value: 'technical_score', label: '技术 technical' },
  { value: 'fundamental_score', label: '基本面 fundamental' },
  { value: 'value_score', label: '价值 value' },
  { value: 'growth_score', label: '成长 growth' },
  { value: 'money_flow_score', label: '资金 money flow' },
  { value: 'cycle_score', label: '周期 cycle' },
  { value: 'composite_score', label: '综合 composite' },
  { value: 'composite_balanced_score', label: '综合·均衡' },
  { value: 'composite_aggressive_score', label: '综合·进取' },
  { value: 'composite_conservative_score', label: '综合·保守' },
  { value: 'composite_defensive_score', label: '综合·防御' },
  { value: 'composite_value_oriented_score', label: '综合·价值' },
  { value: 'composite_trading_oriented_score', label: '综合·交易' },
  { value: 'composite_growth_oriented_score', label: '综合·成长' },
  { value: 'composite_cycle_oriented_score', label: '综合·周期' },
  { value: 'composite_growth_cycle_score', label: '综合·成长周期' },
]

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
select,
textarea {
  border: 1px solid #d9e1ec;
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
}

.score-spec-field {
  grid-column: 1 / -1;
}

textarea {
  resize: vertical;
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
