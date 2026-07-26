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
            <select :value="form.score_mode || 'weighted'" @change="onScoreModeChange">
              <option value="column">单维评分</option>
              <option value="preset">预定义多维组合</option>
              <option value="weighted">自定义多维加权</option>
            </select>
          </label>
          <label v-if="(form.score_mode || 'weighted') === 'column'">
            单一维度
            <select :value="form.score_column" @change="patchForm({ score_column: $event.target.value })">
              <option v-for="option in ATOMIC_SCORE_OPTIONS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <small class="field-hint">只使用一个原子维度排序，不包含任何综合分</small>
          </label>
          <label v-else-if="form.score_mode === 'preset'" class="score-spec-field">
            预定义组合
            <select :value="form.score_column" @change="patchForm({ score_column: $event.target.value })">
              <option v-for="preset in COMPOSITE_SCORE_PRESETS" :key="preset.column" :value="preset.column">
                {{ preset.label }}
              </option>
            </select>
            <div v-if="selectedCompositePreset" class="weight-breakdown">
              <strong>{{ selectedCompositePreset.label }}</strong>
              <span>{{ selectedCompositePreset.description }}</span>
              <span>{{ scoreWeightSummary(selectedCompositePreset.weights) }}</span>
            </div>
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
import { computed } from 'vue'
import {
  ATOMIC_SCORE_OPTIONS,
  COMPOSITE_SCORE_PRESETS,
  compositeScorePreset,
  scoreWeightSummary,
} from '../../utils/scoreUtils'

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

const selectedCompositePreset = computed(() => compositeScorePreset(props.form.score_column))

function patchForm(patch) {
  const next = { ...props.form, ...patch }
  emit('update:form', next)
  return next
}

function patchNumber(key, raw) {
  const number = Number.parseFloat(raw)
  patchForm({ [key]: Number.isNaN(number) ? raw : number })
}

function onScoreModeChange(event) {
  const scoreMode = event.target.value
  const patch = { score_mode: scoreMode }
  if (scoreMode === 'column' && !ATOMIC_SCORE_OPTIONS.some((option) => option.value === props.form.score_column)) {
    patch.score_column = 'fundamental_score'
  }
  if (scoreMode === 'preset' && !compositeScorePreset(props.form.score_column)) {
    patch.score_column = 'composite_balanced_score'
  }
  patchForm(patch)
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

.weight-breakdown {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #eff6ff;
  color: #334155;
  font-weight: 400;
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
