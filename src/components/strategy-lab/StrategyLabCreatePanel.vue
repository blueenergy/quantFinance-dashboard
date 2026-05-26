<template>
  <section class="card">
    <div class="section-title-row compact">
      <div>
        <h3>批量实验配置</h3>
        <p class="subtitle">这组配置可用于创建单次批量实验，也可作为自动迭代 Loop 的第 1 轮输入。</p>
      </div>
      <button type="button" class="mini-btn" @click="emit('update:expanded', !expanded)">
        {{ expanded ? '收起配置' : '展开配置' }}
      </button>
    </div>
    <div v-if="!expanded" class="panel-summary">
      <span>{{ targetModeLabel }}</span>
      <span>{{ form.strategy_key }} / {{ form.preset || 'default' }}</span>
      <span>{{ form.start_date }} - {{ form.end_date }}</span>
      <span>初始资金 {{ money(form.initial_cash) }}</span>
      <span v-if="form.target_mode === 'single_etf'">资金使用率 {{ pct(normalizedEtfPositionPct()) }}</span>
    </div>
    <div v-show="expanded" class="panel-body">
      <div class="form-grid">
        <label>
          实验名
          <input v-model="form.name" placeholder="中证1000 海龟保守参数" />
        </label>
        <label>
          实验对象
          <select v-model="form.target_mode">
            <option value="index">指数成分股</option>
            <option value="single_etf">单个 ETF</option>
            <option value="manual">自定义标的列表</option>
            <option value="strategy_pool">策略选股池</option>
          </select>
        </label>
        <label v-if="form.target_mode === 'index'">
          指数
          <input v-model="form.universe_value" placeholder="例如 csi1000" />
        </label>
        <label v-else-if="form.target_mode === 'single_etf'">
          ETF
          <select v-model="form.etf_symbol" @focus="loadEtfOptions">
            <option value="">请选择 ETF</option>
            <option v-for="etf in etfOptions" :key="etf.ts_code" :value="etf.ts_code">
              {{ etf.ts_code }} · {{ etf.name || 'ETF' }}
            </option>
          </select>
          <input v-model="etfSearchModel" placeholder="搜索 ETF 代码/名称，如 512100 或 中证1000" @keyup.enter="searchEtfOptions" />
          <div class="inline-actions">
            <button type="button" class="mini-btn" :disabled="etfOptionsLoading" @click="searchEtfOptions">
              {{ etfOptionsLoading ? '搜索中…' : '搜索 ETF' }}
            </button>
            <span v-if="etfOptionsMessage" class="muted">{{ etfOptionsMessage }}</span>
          </div>
          <small>直接对 ETF 本身跑回测，不展开指数成分股；也可搜索后从下拉选择。</small>
        </label>
        <label v-else-if="form.target_mode === 'strategy_pool'">
          选股池
          <input v-model="form.universe_value" placeholder="例如 dragon_default" />
        </label>
        <label v-else>
          标的类型
          <select v-model="form.asset_type">
            <option value="stock">股票</option>
            <option value="etf">ETF</option>
          </select>
        </label>
        <label>
          策略
          <select v-model="form.strategy_key">
            <option v-if="!usableStrategies.length" value="">策略加载失败，请刷新</option>
            <option v-for="strategy in usableStrategies" :key="strategy.key" :value="strategy.key">
              {{ strategy.name || strategy.key }}（{{ strategy.key }}）
            </option>
          </select>
          <small v-if="strategyLoadError">{{ strategyLoadError }}，已使用本地默认列表</small>
        </label>
        <label>
          Preset
          <select v-model="form.preset">
            <option value="">默认参数</option>
            <option v-for="preset in selectedPresets" :key="preset.preset" :value="preset.preset">
              {{ preset.description || preset.preset }}
            </option>
          </select>
        </label>
        <label>
          初始资金
          <input v-model.number="form.initial_cash" type="number" />
        </label>
        <label v-if="form.target_mode === 'single_etf'">
          资金使用率
          <input v-model.number="form.etf_position_pct" type="number" min="0.01" max="1" step="0.01" />
          <small>单 ETF 建仓时使用的账户资金比例，例如 0.95 表示尽量使用 95% 资金。</small>
        </label>
        <label v-if="form.target_mode !== 'single_etf'">
          测试数量限制
          <input v-model.number="form.limit_symbols" type="number" min="0" />
          <small>0 表示跑完整股票池</small>
        </label>
        <label>
          开始日期
          <input v-model="form.start_date" placeholder="20240101" />
        </label>
        <label>
          结束日期
          <input v-model="form.end_date" placeholder="20241231" />
        </label>
      </div>
      <label v-if="form.target_mode === 'manual'" class="full">
        自定义标的（逗号/空格/换行分隔）
        <textarea v-model="symbolsText" rows="3" placeholder="000001.SZ, 000858.SZ"></textarea>
      </label>
      <div class="params-table-wrap full">
        <button type="button" class="collapse-toggle" @click="emit('update:paramsExpanded', !paramsExpanded)">
          <span class="collapse-chevron" :class="{ expanded: paramsExpanded }">▸</span>
          <strong>策略参数</strong>
          <span class="muted">（{{ createParamTableRows.length }} 项）</span>
        </button>
        <div v-show="paramsExpanded" class="collapse-body">
          <table class="params-table" v-if="createParamTableRows.length">
            <thead>
              <tr>
                <th>参数</th>
                <th>默认值</th>
                <th>实验值</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in createParamTableRows"
                :key="row.key"
                :class="{
                  'param-row-changed': row.changed && row.hasCurrent,
                  'param-row-new': row.isNew,
                }"
              >
                <td class="param-name">
                  <span class="param-key">{{ row.key }}</span>
                  <small v-if="createParamLabel(row.key) !== row.key" class="param-desc">
                    {{ createParamLabel(row.key) }}
                  </small>
                </td>
                <td class="param-current">{{ formatParamDisplay(row.currentValue) }}</td>
                <td class="param-next">
                  <input
                    :value="formatParamDisplay(row.nextValue)"
                    @change="setCreateFormParam(row.key, $event.target.value, row.currentValue)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <p v-else class="muted">选择 Preset 或策略后将显示可编辑参数；也可先选策略再改实验值。</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  expanded: { type: Boolean, required: true },
  paramsExpanded: { type: Boolean, required: true },
  form: { type: Object, required: true },
  targetModeLabel: { type: String, required: true },
  usableStrategies: { type: Array, required: true },
  strategyLoadError: { type: String, default: '' },
  selectedPresets: { type: Array, required: true },
  etfOptions: { type: Array, required: true },
  etfSearch: { type: String, default: '' },
  etfOptionsLoading: { type: Boolean, default: false },
  etfOptionsMessage: { type: String, default: '' },
  symbolsText: { type: String, default: '' },
  createParamTableRows: { type: Array, required: true },
  loadEtfOptions: { type: Function, required: true },
  searchEtfOptions: { type: Function, required: true },
  normalizedEtfPositionPct: { type: Function, required: true },
  pct: { type: Function, required: true },
  money: { type: Function, required: true },
  createParamLabel: { type: Function, required: true },
  formatParamDisplay: { type: Function, required: true },
  setCreateFormParam: { type: Function, required: true },
})

const emit = defineEmits([
  'update:expanded',
  'update:paramsExpanded',
  'update:etfSearch',
  'update:symbolsText',
])

const etfSearchModel = computed({
  get: () => props.etfSearch,
  set: (value) => emit('update:etfSearch', value),
})

const symbolsText = computed({
  get: () => props.symbolsText,
  set: (value) => emit('update:symbolsText', value),
})
</script>

<style scoped>
.card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
  padding: 16px;
}

.section-title-row {
  align-items: flex-start;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.section-title-row.compact {
  align-items: center;
}

.subtitle,
.muted,
.param-desc {
  color: #64748b;
}

.subtitle {
  margin-top: 6px;
}

.panel-summary {
  align-items: center;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 12px;
  padding: 10px 12px;
}

.panel-summary span,
.muted {
  font-size: 13px;
}

.panel-body,
.form-grid,
.full,
.params-table-wrap {
  margin-top: 12px;
}

.form-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

label {
  color: #334155;
  display: flex;
  flex-direction: column;
  font-size: 13px;
  gap: 6px;
}

input,
select,
textarea {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
}

button {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  padding: 8px 12px;
}

.mini-btn {
  font-size: 12px;
  padding: 4px 8px;
}

.inline-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.collapse-toggle {
  align-items: center;
  background: transparent;
  border: none;
  color: #334155;
  display: inline-flex;
  gap: 8px;
  padding: 0;
  text-align: left;
  width: fit-content;
}

.collapse-chevron {
  color: #64748b;
  display: inline-block;
  font-size: 12px;
  line-height: 1;
  transition: transform 0.15s ease;
}

.collapse-chevron.expanded {
  transform: rotate(90deg);
}

.collapse-body {
  margin-top: 4px;
}

.params-table-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.params-table {
  border-collapse: collapse;
  font-size: 13px;
  width: 100%;
}

.params-table th,
.params-table td {
  border-bottom: 1px solid #e2e8f0;
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
}

.params-table th {
  background: #f1f5f9;
  color: #475569;
  font-weight: 600;
}

.param-name {
  min-width: 140px;
}

.param-key {
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.param-desc {
  display: block;
  margin-top: 2px;
}

.param-current {
  color: #475569;
  min-width: 100px;
}

.param-next input {
  width: 100%;
}

.param-row-changed {
  background: #fffbeb;
}

.param-row-changed .param-next input {
  border-color: #f59e0b;
}

.param-row-new {
  background: #eff6ff;
}

.param-row-new .param-next input {
  border-color: #2563eb;
}
</style>
