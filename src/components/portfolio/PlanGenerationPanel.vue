<template>
  <section class="card generate-card">
    <div class="task-list-header">
      <div>
        <h3>生成交易计划</h3>
        <p class="muted">从当前可用 strategy 生成新的 plan，生成后仍需人工审核。</p>
      </div>
      <button type="button" @click="$emit('toggle')">{{ expanded ? '折叠' : '展开' }}</button>
    </div>
    <div v-if="expanded" class="generate-form-body">
      <label>
        策略
        <select :value="form.strategy_template_id" @change="$emit('strategy-change', $event.target.value)">
          <option value="">请选择 strategy</option>
          <option v-for="strategy in strategies" :key="strategy.strategy_template_id" :value="strategy.strategy_template_id">
            {{ strategyLabel(strategy) }}
          </option>
        </select>
      </label>
      <label>
        base_date
        <input :value="form.base_date" type="date" @change="$emit('field-change', 'base_date', $event.target.value); $emit('watermark-refresh')" />
      </label>
      <label>
        mode
        <select :value="form.mode" @change="$emit('field-change', 'mode', $event.target.value)">
          <option value="auto">auto</option>
          <option value="monitor">monitor</option>
          <option value="rebalance">rebalance</option>
        </select>
      </label>
      <label class="inline-check">
        <input :checked="form.force" type="checkbox" @change="$emit('field-change', 'force', $event.target.checked)" />
        force
      </label>
      <div v-if="selectedStrategy" class="strategy-param-card">
        <div class="strategy-param-header">
          <div>
            <strong>本次 plan 参数</strong>
            <p class="muted">先选择策略模板和参数预设，再按本次计划需要调整参数；系统会把最终参数快照写入 plan。</p>
          </div>
          <span class="editable-badge">内部唯一键：params_hash</span>
        </div>
        <label>
          参数预设
          <select :value="form.preset_id" @change="$emit('preset-change', $event.target.value)">
            <option v-for="preset in presets" :key="preset.preset_id" :value="preset.preset_id">
              {{ presetLabel(preset) }}
            </option>
          </select>
        </label>
        <div v-if="selectedPreset" class="preset-evidence">
          <strong>推荐依据</strong>
          <span>evidence：{{ selectedPreset.evidence_count ?? evidenceRows.length }} 条</span>
          <span>区间：{{ selectedPreset.data_window?.start_date || '-' }} → {{ selectedPreset.data_window?.end_date || '-' }}</span>
          <span>超额：{{ pct(selectedPreset.backtest_summary?.index_excess_cumulative_return) }}</span>
          <span>Sharpe：{{ num(selectedPreset.backtest_summary?.sharpe) }}</span>
          <span>回撤：{{ pct(selectedPreset.backtest_summary?.max_drawdown) }}</span>
        </div>
        <div v-if="evidenceRows.length" class="preset-evidence-list">
          <strong>Evidence 明细</strong>
          <p v-for="evidence in evidenceRows" :key="evidence.research_result_id || evidence.research_job_id">
            <span>{{ evidence.data_window?.start_date || '-' }} → {{ evidence.data_window?.end_date || '-' }}</span>
            <span>超额 {{ pct(evidence.best_row?.index_excess_cumulative_return) }}</span>
            <span>Sharpe {{ num(evidence.best_row?.sharpe) }}</span>
            <span>回撤 {{ pct(evidence.best_row?.max_drawdown) }}</span>
          </p>
        </div>
        <div class="strategy-param-grid editable">
          <label>
            universe
            <select :value="form.params.universe_index" @change="updateParam('universe_index', $event.target.value)">
              <option v-for="universe in universeOptions" :key="universe.value" :value="universe.value">{{ universe.label }}</option>
            </select>
          </label>
          <label>top_n<input :value="form.params.top_n" type="number" min="1" @input="updateNumber('top_n', $event.target.value)" /></label>
          <label>rebalance_days<input :value="form.params.rebalance_days" type="number" min="1" @input="updateNumber('rebalance_days', $event.target.value)" /></label>
          <label>
            construction_mode
            <select :value="form.params.construction_mode" @change="updateParam('construction_mode', $event.target.value)">
              <option value="top_n">top_n</option>
              <option value="industry_capped">industry_capped</option>
              <option value="industry_neutral">industry_neutral</option>
            </select>
          </label>
          <label>growth_weight<input :value="form.params.growth_weight" type="number" min="0" max="1" step="0.05" @input="$emit('growth-change', $event.target.value)" /></label>
          <label>cycle_weight<input :value="form.params.cycle_weight" type="number" min="0" max="1" step="0.05" @input="$emit('cycle-change', $event.target.value)" /></label>
          <label>industry cap<input :value="form.params.max_industry_weight" type="number" min="0" max="1" step="0.05" @input="updateNumber('max_industry_weight', $event.target.value)" /></label>
          <label>cash_buffer<input :value="form.params.cash_buffer" type="number" min="0" max="1" step="0.01" @input="updateNumber('cash_buffer', $event.target.value)" /></label>
          <label>
            浮动止盈
            <input :value="form.params.trailing_stop_pct" type="number" min="0" max="1" step="0.01" placeholder="0.15" @input="updateNumber('trailing_stop_pct', $event.target.value)" />
            <small class="field-hint">峰值回撤比例，0 或留空关闭；回测已支持，实盘监控二期</small>
          </label>
          <label>buy commission<input :value="form.params.buy_commission_rate" type="number" min="0" step="0.00001" @input="updateNumber('buy_commission_rate', $event.target.value)" /></label>
          <label>sell commission<input :value="form.params.sell_commission_rate" type="number" min="0" step="0.00001" @input="updateNumber('sell_commission_rate', $event.target.value)" /></label>
          <label>min commission<input :value="form.params.min_commission" type="number" min="0" step="0.1" @input="updateNumber('min_commission', $event.target.value)" /></label>
          <label>stamp tax<input :value="form.params.stamp_tax_rate" type="number" min="0" step="0.00001" @input="updateNumber('stamp_tax_rate', $event.target.value)" /></label>
          <label>initial_capital<input :value="form.params.initial_capital" type="number" min="1" step="10000" @input="updateNumber('initial_capital', $event.target.value)" /></label>
        </div>
      </div>
      <button :disabled="loading || !form.strategy_template_id || !form.base_date" @click="$emit('generate')">
        {{ loading ? '提交中...' : '生成 plan' }}
      </button>
      <p v-if="task" class="task-status">
        任务 {{ task.task_id }}：{{ task.status }}
        <span v-if="task.plan_id"> / plan {{ task.plan_id }}</span>
        <span v-if="task.error_message"> / {{ task.error_message }}</span>
      </p>
    </div>
  </section>
</template>

<script setup>
import { num, pct } from '../../composables/usePortfolioPlanFormat'

defineProps({
  expanded: { type: Boolean, default: false },
  form: { type: Object, required: true },
  strategies: { type: Array, default: () => [] },
  selectedStrategy: { type: Object, default: null },
  presets: { type: Array, default: () => [] },
  selectedPreset: { type: Object, default: null },
  evidenceRows: { type: Array, default: () => [] },
  universeOptions: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  task: { type: Object, default: null },
  strategyLabel: { type: Function, required: true },
})

const emit = defineEmits([
  'toggle', 'strategy-change', 'field-change', 'preset-change', 'param-change',
  'growth-change', 'cycle-change', 'watermark-refresh', 'generate',
])

function presetLabel(preset) {
  const defaultText = preset.is_default ? '默认 · ' : ''
  const source = preset.source === 'portfolio_research' ? '组合研究 · ' : ''
  const evidenceText = preset.evidence_count ? ` · evidence ${preset.evidence_count}` : ''
  return `${defaultText}${source}${preset.name || preset.preset_id}${evidenceText}`
}

function updateParam(key, value) {
  emit('param-change', key, value)
}

function updateNumber(key, value) {
  emit('param-change', key, value === '' ? null : Number(value))
}
</script>
