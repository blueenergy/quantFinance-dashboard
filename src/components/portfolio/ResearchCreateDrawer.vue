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
            申万行业 L1
            <select :value="form.industry_l1 || ''" @change="onIndustryChange">
              <option value="">全市场（不过滤）</option>
              <option v-for="item in industryOptions" :key="item.code" :value="item.code">
                {{ item.name }} ({{ item.code }})
              </option>
            </select>
            <small v-if="form.industry_l1" class="field-hint">单行业研究建议 Top-N 5–10；基准默认切到行业指数</small>
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
          <div v-if="(form.score_mode || 'weighted') === 'column'" class="score-spec-field">
            <span class="field-label">评分维度（可多选）</span>
            <div class="score-option-grid" role="group" aria-label="评分维度">
              <label
                v-for="option in ATOMIC_SCORE_OPTIONS"
                :key="option.value"
                class="score-option"
              >
                <input
                  type="checkbox"
                  :value="option.value"
                  :checked="selectedScoreColumns.includes(option.value)"
                  @change="toggleScoreColumn(option.value, $event.target.checked)"
                >
                <span>{{ option.label }}</span>
              </label>
            </div>
            <small class="field-hint">可同时选择多个原子维度；同一任务内并行扫参回测</small>
          </div>
          <div v-else-if="form.score_mode === 'preset'" class="score-spec-field">
            <span class="field-label">预定义组合（可多选）</span>
            <div class="score-option-grid" role="group" aria-label="预定义组合">
              <label
                v-for="preset in COMPOSITE_SCORE_PRESETS"
                :key="preset.column"
                class="score-option"
              >
                <input
                  type="checkbox"
                  :value="preset.column"
                  :checked="selectedScoreColumns.includes(preset.column)"
                  @change="toggleScoreColumn(preset.column, $event.target.checked)"
                >
                <span>{{ preset.label }}</span>
              </label>
            </div>
            <small class="field-hint">可同时选择多个预定义组合；同一任务内并行扫参回测</small>
            <div
              v-for="preset in selectedCompositePresets"
              :key="preset.column"
              class="weight-breakdown"
            >
              <strong>{{ preset.label }}</strong>
              <span>{{ preset.description }}</span>
              <span>{{ scoreWeightSummary(preset.weights) }}</span>
            </div>
          </div>
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
            选股方式
            <select
              :value="form.selection_mode || FIXED_TOP_N_SELECTION_MODE"
              @change="patchForm({ selection_mode: $event.target.value })"
            >
              <option :value="FIXED_TOP_N_SELECTION_MODE">固定 Top N</option>
              <option :value="DYNAMIC_THRESHOLD_SELECTION_MODE">动态评分阈值</option>
            </select>
          </label>
          <label>
            {{ dynamicSelection ? '阈值基准排名（Top N）' : 'Top N' }}
            <input
              :value="form.top_n_values"
              :placeholder="dynamicSelection ? '10' : '10,20,50'"
              @input="patchForm({ top_n_values: $event.target.value })"
            />
            <small v-if="dynamicSelection" class="field-hint">
              MVP 仅支持一个基准排名；动态阈值将根据历史评分确定实际持仓。
            </small>
          </label>
          <label v-if="dynamicSelection">
            threshold_lookback_days
            <input
              :value="form.threshold_lookback_days"
              type="number"
              min="1"
              step="1"
              @input="patchNumber('threshold_lookback_days', $event.target.value)"
            />
          </label>
          <label v-if="dynamicSelection">
            max_positions
            <input
              :value="form.max_positions"
              type="number"
              min="1"
              step="1"
              @input="patchNumber('max_positions', $event.target.value)"
            />
          </label>
          <label>
            rebalance_days
            <input
              :value="form.horizon"
              placeholder="10,20,30,40"
              @input="patchForm({ horizon: $event.target.value })"
            />
            <small class="field-hint">逗号分隔多档调仓间隔；每档按同长度持有期并行扫参</small>
          </label>
          <label v-if="!industryFilterActive">
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
          <label class="inline-check">
            <input
              type="checkbox"
              :checked="form.regime_always_invest !== false"
              @change="patchForm({ regime_always_invest: $event.target.checked })"
            />
            始终满仓
            <small class="field-hint">每个调仓日都按评分选股持有。可与非牛空仓同时勾选做对照，也可以只跑其中一种。</small>
          </label>
          <label class="inline-check score-spec-field">
            <input
              type="checkbox"
              :checked="Boolean(form.regime_cash)"
              @change="patchForm({ regime_cash: $event.target.checked })"
            />
            非牛空仓
            <small class="field-hint">独立仓位模式，不必和始终满仓一起跑。{{ REGIME_CASH_REMINDER }}</small>
          </label>
          <label v-if="Boolean(form.regime_cash)" class="score-spec-field">
            择时规则
            <select
              class="regime-rule-select"
              :value="form.regime_rule || DEFAULT_REGIME_RULE"
              @change="patchForm({ regime_rule: $event.target.value })"
            >
              <option
                v-for="option in regimeRuleSelectOptions(form.regime_rule)"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
            <small class="field-hint">{{ REGIME_RULE_HINT }}</small>
          </label>
        </div>
      </div>
      <footer class="drawer-footer">
        <button type="button" class="secondary-btn" @click="$emit('close')">取消</button>
        <button
          type="button"
          :disabled="submitting || !canSubmit"
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
import {
  DYNAMIC_THRESHOLD_SELECTION_MODE,
  FIXED_TOP_N_SELECTION_MODE,
  resolveScoreColumns,
} from '../../utils/portfolioResearchPayload'
import { REGIME_CASH_REMINDER, REGIME_RULE_HINT, DEFAULT_REGIME_RULE, regimeRuleSelectOptions } from '../../utils/regimeCash'

const props = defineProps({
  open: { type: Boolean, default: false },
  form: { type: Object, required: true },
  universeOptions: { type: Array, default: () => [] },
  industryOptions: { type: Array, default: () => [] },
  submitting: { type: Boolean, default: false },
  title: { type: String, default: '新建研究任务' },
  subtitle: { type: String, default: '' },
  submitLabel: { type: String, default: '提交研究任务' },
})

const emit = defineEmits(['close', 'submit', 'update:form', 'name-touched', 'universe-change'])

const selectedScoreColumns = computed(() => resolveScoreColumns(props.form))
const dynamicSelection = computed(() => (
  props.form.selection_mode === DYNAMIC_THRESHOLD_SELECTION_MODE
))
const industryFilterActive = computed(() => Boolean(String(props.form.industry_l1 || '').trim()))
const selectedCompositePresets = computed(() => (
  selectedScoreColumns.value
    .map((column) => compositeScorePreset(column))
    .filter(Boolean)
))

const canSubmit = computed(() => {
  if (!props.form.start_date || !props.form.end_date) return false
  const scoreMode = props.form.score_mode || 'weighted'
  if (scoreMode === 'column' || scoreMode === 'preset') {
    if (!selectedScoreColumns.value.length) return false
  }
  const rebalanceDays = String(props.form.horizon ?? '')
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n >= 1)
  if (!rebalanceDays.length) return false
  if (!(props.form.regime_always_invest !== false || props.form.regime_cash)) return false
  if (!dynamicSelection.value) return true
  const topNValues = String(props.form.top_n_values ?? '')
    .split(/[,，]/)
    .map((item) => Number(item.trim()))
    .filter(Number.isFinite)
  const lookbackDays = Number(props.form.threshold_lookback_days)
  const maxPositions = Number(props.form.max_positions)
  return topNValues.length === 1
    && topNValues[0] >= 1
    && Number.isInteger(lookbackDays)
    && lookbackDays >= 1
    && Number.isInteger(maxPositions)
    && maxPositions >= topNValues[0]
})

function withScoreColumns(columns) {
  const unique = [...new Set(columns.map((item) => String(item || '').trim()).filter(Boolean))]
  return {
    score_columns: unique,
    score_column: unique[0] || props.form.score_column || '',
  }
}

function patchForm(patch) {
  const next = { ...props.form, ...patch }
  emit('update:form', next)
  return next
}

function patchNumber(key, raw) {
  const number = Number.parseFloat(raw)
  patchForm({ [key]: Number.isNaN(number) ? raw : number })
}

function toggleScoreColumn(column, checked) {
  const current = selectedScoreColumns.value
  const next = checked
    ? [...current, column]
    : current.filter((item) => item !== column)
  patchForm(withScoreColumns(next))
}

function onScoreModeChange(event) {
  const scoreMode = event.target.value
  const patch = { score_mode: scoreMode }
  const current = selectedScoreColumns.value
  if (scoreMode === 'column') {
    const atomic = current.filter((column) => (
      ATOMIC_SCORE_OPTIONS.some((option) => option.value === column)
    ))
    Object.assign(patch, withScoreColumns(atomic.length ? atomic : ['fundamental_score']))
  }
  if (scoreMode === 'preset') {
    const presets = current.filter((column) => compositeScorePreset(column))
    Object.assign(patch, withScoreColumns(presets.length ? presets : ['composite_balanced_score']))
  }
  patchForm(patch)
}

function onNameInput(event) {
  emit('name-touched')
  patchForm({ name: event.target.value })
}

function onUniverseChange(event) {
  const next = patchForm({ universe_index: event.target.value })
  emit('universe-change', next.universe_index)
}

function onIndustryChange(event) {
  const industryL1 = String(event.target.value || '').trim()
  const patch = { industry_l1: industryL1 }
  if (industryL1) {
    patch.index_benchmark_symbol = industryL1
    if (!String(props.form.top_n_values || '').trim()) {
      patch.top_n_values = '5,8,10'
    }
  } else {
    patch.index_benchmark_symbol = ''
  }
  patchForm(patch)
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

label,
.field-label {
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

.score-option-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
}

.score-option {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 8px 10px;
  border: 1px solid #d9e1ec;
  border-radius: 8px;
  background: #f8fafc;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}

.score-option input {
  width: auto;
  margin: 0;
}

.inline-check {
  grid-column: 1 / -1;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.inline-check input {
  width: auto;
  margin: 0;
}

.inline-check .field-hint {
  flex: 1 1 100%;
}

.weight-breakdown {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
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
