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
          <p class="muted">用生产行情跑 IC / 分位 / TopK 净收益诊断，alpha158 全集通常需要几十分钟。</p>
        </div>
        <button type="button" class="link-btn" @click="$emit('close')">关闭 ✕</button>
      </header>

      <div class="drawer-body">
        <div class="form-grid">
          <label>
            名称
            <input :value="form.name" placeholder="因子回测" @input="patchForm({ name: $event.target.value })" />
          </label>
          <label>
            universe
            <select :value="form.index_code" @change="patchForm({ index_code: $event.target.value })">
              <option v-for="option in indexOptions" :key="option.value" :value="option.value">
                {{ option.label }}
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
            因子集
            <select :value="form.factor_set" @change="patchForm({ factor_set: $event.target.value })">
              <option v-for="option in factorSetOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
          <label>
            预热天数
            <input
              :value="form.warmup_days"
              type="number"
              min="0"
              max="400"
              @input="patchForm({ warmup_days: $event.target.value })"
            />
            <span class="field-hint">滚动窗口因子需要开始日期之前的行情</span>
          </label>
        </div>

        <section class="factor-picker">
          <div class="picker-head">
            <div>
              <p class="field-label">因子范围</p>
              <p class="field-hint">{{ factorScopeHint }}</p>
            </div>
            <div class="picker-actions">
              <button type="button" class="secondary-btn" :disabled="!catalogAvailable" @click="$emit('select-visible')">
                全选当前
              </button>
              <button type="button" class="secondary-btn" :disabled="!selectedCount" @click="$emit('clear-factors')">
                清空
              </button>
            </div>
          </div>

          <p v-if="catalogLoading" class="muted">因子目录加载中...</p>
          <p v-else-if="catalogError" class="picker-warning">{{ catalogError }}</p>
          <template v-else-if="catalogAvailable">
            <input
              class="factor-search"
              :value="factorSearch"
              placeholder="搜索因子名 / 说明 / 表达式"
              @input="$emit('update:factorSearch', $event.target.value)"
            />
            <p v-if="!factorGroups.length" class="muted">没有匹配的因子。</p>
            <div v-for="group in factorGroups" :key="group.family" class="factor-family">
              <div class="family-head">
                <strong>{{ group.family }}</strong>
                <span class="muted">{{ group.factors.length }} 个</span>
                <button type="button" class="link-btn" @click="$emit('select-family', group.family)">全选</button>
              </div>
              <div class="factor-grid">
                <label
                  v-for="factor in group.factors"
                  :key="factor.name"
                  class="factor-option"
                  :class="{ picked: isFactorSelected(factor.name) }"
                  :title="factor.expression || factor.name"
                >
                  <input
                    type="checkbox"
                    :checked="isFactorSelected(factor.name)"
                    @change="$emit('toggle-factor', factor.name)"
                  />
                  <span class="factor-text">
                    <span class="factor-name">{{ factor.name }}</span>
                    <span class="factor-desc">{{ factor.description || factor.expression || '-' }}</span>
                  </span>
                </label>
              </div>
            </div>
          </template>
        </section>

        <div class="form-grid">
          <label>
            horizons
            <input :value="form.horizons" @input="patchForm({ horizons: $event.target.value })" />
            <span class="field-hint">未来收益天数，逗号分隔，如 1,5,10,20</span>
          </label>
          <label>
            Top K
            <input :value="form.top_k" @input="patchForm({ top_k: $event.target.value })" />
            <span class="field-hint">成本调整用的持仓数，如 20,50</span>
          </label>
          <label>
            分位数
            <input
              :value="form.quantiles"
              type="number"
              min="2"
              max="20"
              @input="patchForm({ quantiles: $event.target.value })"
            />
          </label>
          <label>
            最少标的数
            <input
              :value="form.min_names"
              type="number"
              min="2"
              @input="patchForm({ min_names: $event.target.value })"
            />
            <span class="field-hint">截面标的不足则跳过该交易日</span>
          </label>
          <label>
            初筛保留因子数
            <input
              :value="form.screen_top"
              type="number"
              min="1"
              @input="patchForm({ screen_top: $event.target.value })"
            />
            <span class="field-hint">超过该数量才做 IC 初筛，只对存活因子跑分位诊断</span>
          </label>
          <label>
            初筛 horizon
            <input
              :value="form.screen_horizon"
              type="number"
              min="1"
              placeholder="默认最长 horizon"
              @input="patchForm({ screen_horizon: $event.target.value })"
            />
          </label>
          <label>
            单边滑点 (bps)
            <input
              :value="form.slippage_bps"
              type="number"
              min="0"
              max="1000"
              step="1"
              @input="patchForm({ slippage_bps: $event.target.value })"
            />
          </label>
          <label>
            每次调仓换手
            <input
              :value="form.turnover"
              type="number"
              min="0.05"
              max="1"
              step="0.05"
              @input="patchForm({ turnover: $event.target.value })"
            />
            <span class="field-hint">0-1，1 表示每次全部换仓</span>
          </label>
        </div>

        <p v-if="formError" class="error">{{ formError }}</p>
      </div>

      <footer class="drawer-footer">
        <button type="button" class="secondary-btn" @click="$emit('close')">取消</button>
        <button type="button" :disabled="submitting || !canSubmit" @click="$emit('submit')">
          {{ submitting ? '提交中...' : '提交回测' }}
        </button>
      </footer>
    </aside>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  form: { type: Object, required: true },
  title: { type: String, default: '新建因子回测' },
  submitting: { type: Boolean, default: false },
  formError: { type: String, default: '' },
  indexOptions: { type: Array, default: () => [] },
  factorSetOptions: { type: Array, default: () => [] },
  catalogLoading: { type: Boolean, default: false },
  catalogError: { type: String, default: '' },
  catalogAvailable: { type: Boolean, default: false },
  factorGroups: { type: Array, default: () => [] },
  factorSearch: { type: String, default: '' },
  factorScopeHint: { type: String, default: '' },
})

const emit = defineEmits([
  'close',
  'submit',
  'update:form',
  'update:factorSearch',
  'toggle-factor',
  'select-family',
  'select-visible',
  'clear-factors',
])

const canSubmit = computed(() => Boolean(props.form.start_date && props.form.end_date))
const selectedCount = computed(() => (Array.isArray(props.form.factors) ? props.form.factors.length : 0))

function isFactorSelected(name) {
  return Array.isArray(props.form.factors) && props.form.factors.includes(name)
}

function patchForm(patch) {
  emit('update:form', { ...props.form, ...patch })
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
  width: min(680px, 100%);
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
  margin: 0;
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
  margin: 0;
  font-weight: 400;
  color: #94a3b8;
  font-size: 12px;
}

.factor-picker {
  border: 1px solid #e6eaf0;
  border-radius: 10px;
  padding: 12px 14px;
}

.picker-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.picker-actions {
  display: flex;
  gap: 8px;
}

.picker-warning {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid #fde68a;
  border-radius: 8px;
  background: #fffbeb;
  color: #92400e;
  font-size: 13px;
}

.factor-search {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 10px;
}

.factor-family {
  margin-bottom: 12px;
}

.family-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 13px;
}

.factor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 6px;
}

.factor-option {
  flex-direction: row;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid #e6eaf0;
  border-radius: 8px;
  background: #f8fafc;
  font-weight: 400;
  cursor: pointer;
}

.factor-option.picked {
  border-color: #0f6bdc;
  background: #eef6ff;
}

.factor-option input {
  width: auto;
  margin: 2px 0 0;
}

.factor-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.factor-name {
  font-weight: 700;
  color: #172033;
  font-size: 13px;
}

.factor-desc {
  color: #64748b;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.error {
  margin: 12px 0 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: #fef2f2;
  color: #b42318;
  font-size: 13px;
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
  font-size: 12px;
  padding: 6px 10px;
}

.link-btn {
  border: none;
  background: transparent;
  color: #0f6bdc;
  padding: 0;
  font-size: 12px;
}
</style>
