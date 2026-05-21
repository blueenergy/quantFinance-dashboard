<template>
  <div class="strategy-lab">
    <header class="lab-header">
      <div>
        <p class="eyebrow">Strategy Lab</p>
        <h2>策略实验室</h2>
        <p class="subtitle">批量回测、横截面排名、AI 复盘和下一轮实验生成。</p>
      </div>
      <button class="primary" :disabled="loading" @click="loadBatches">刷新</button>
    </header>

    <section class="card">
      <h3>创建批量实验</h3>
      <div class="form-grid">
        <label>
          实验名
          <input v-model="form.name" placeholder="中证1000 海龟保守参数" />
        </label>
        <label>
          股票池
          <select v-model="form.universe_type">
            <option value="manual">手工 symbols</option>
            <option value="index">指数成分</option>
            <option value="strategy_pool">策略股池</option>
          </select>
        </label>
        <label>
          股票池值
          <input v-model="form.universe_value" placeholder="例如 csi1000" />
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
        <label>
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
      <label class="full">
        手工 symbols（逗号/空格/换行分隔）
        <textarea v-model="symbolsText" rows="3" placeholder="000001.SZ, 000858.SZ"></textarea>
      </label>
      <label class="full">
        策略参数 JSON
        <textarea v-model="paramsText" rows="3" placeholder='{"period": 20}'></textarea>
      </label>
      <div class="actions">
        <button class="primary" :disabled="submitting" @click="submitBatch">创建实验</button>
        <span v-if="message" class="message">{{ message }}</span>
      </div>
    </section>

    <section class="layout">
      <aside class="card batch-list">
        <h3>实验列表</h3>
        <button
          v-for="batch in batches"
          :key="batch.batch_id"
          class="batch-row"
          :class="{ active: selectedBatchId === batch.batch_id }"
          @click="selectBatch(batch.batch_id)"
        >
          <strong>{{ batch.name }}</strong>
          <span>{{ batch.universe_type }} {{ batch.universe_value || '' }}</span>
          <small>{{ batch.strategy_key }} · {{ batch.status }}</small>
        </button>
      </aside>

      <main class="card details" v-if="selectedBatch">
        <div class="detail-header">
          <div>
            <h3>{{ selectedBatch.name }}</h3>
            <p>{{ selectedBatch.strategy_key }} / {{ selectedBatch.preset || 'default' }} · {{ selectedBatch.start_date }} - {{ selectedBatch.end_date }}</p>
          </div>
          <div class="detail-actions">
            <button @click="loadSelected">刷新详情</button>
            <button @click="retryFailed">重试失败</button>
            <button @click="queueReview">AI 复盘</button>
            <button @click="createNextExperiment">下一轮实验</button>
            <button class="danger" @click="cancelSelected">取消</button>
          </div>
        </div>

        <div class="metrics">
          <div><span>状态</span><strong>{{ selectedBatch.status }}</strong></div>
          <div><span>总数</span><strong>{{ summary.total || selectedBatch.symbols_count || 0 }}</strong></div>
          <div><span>完成</span><strong>{{ summary.completed || 0 }}</strong></div>
          <div><span>失败</span><strong>{{ summary.failed || 0 }}</strong></div>
          <div><span>平均收益</span><strong>{{ pct(summary.avg_total_return) }}</strong></div>
          <div><span>中位收益</span><strong>{{ pct(summary.median_total_return) }}</strong></div>
        </div>

        <div class="table-toolbar">
          <select v-model="resultStatus" @change="loadResults">
            <option value="">全部状态</option>
            <option value="completed">完成</option>
            <option value="failed">失败</option>
            <option value="pending">待执行</option>
          </select>
          <select v-model="sortBy" @change="loadResults">
            <option value="total_return">总收益</option>
            <option value="max_drawdown">最大回撤</option>
            <option value="sharpe_ratio">夏普</option>
            <option value="win_rate">胜率</option>
            <option value="total_trades">交易次数</option>
          </select>
        </div>

        <section class="review-panel" v-if="latestReview">
          <h4>AI 复盘</h4>
          <p>{{ latestReview.review?.summary || '复盘已完成' }}</p>
          <div class="review-grid">
            <div>
              <strong>主要发现</strong>
              <ul>
                <li v-for="item in latestReview.review?.main_findings || []" :key="item">{{ item }}</li>
              </ul>
            </div>
            <div>
              <strong>下一轮实验</strong>
              <ul>
                <li v-for="item in latestReview.review?.next_experiments || []" :key="item.name || item.hypothesis">
                  {{ item.name || item.hypothesis || item }}
                </li>
              </ul>
            </div>
          </div>
        </section>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>名称</th>
                <th>状态</th>
                <th>总收益</th>
                <th>最大回撤</th>
                <th>夏普</th>
                <th>胜率</th>
                <th>交易</th>
                <th>错误</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in results" :key="row.task_id">
                <td>{{ row.symbol }}</td>
                <td>{{ row.stock_name || '-' }}</td>
                <td>{{ row.status }}</td>
                <td>{{ pct(row.total_return) }}</td>
                <td>{{ pct(row.max_drawdown) }}</td>
                <td>{{ num(row.sharpe_ratio) }}</td>
                <td>{{ pct(row.win_rate) }}</td>
                <td>{{ row.total_trades ?? '-' }}</td>
                <td class="error">{{ row.error_message || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>

      <main class="card empty" v-else>
        请选择一个实验，或先创建新的批量实验。
      </main>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  cancelBatch,
  createBatch,
  getBatch,
  getBatchResults,
  listBatchReviews,
  listBatches,
  listStrategies,
  listStrategyTemplates,
  requestBatchReview,
  retryFailedBatch,
  rerunBatch,
} from '../api/strategyLab'

const batches = ref([])
const selectedBatch = ref(null)
const selectedBatchId = ref('')
const results = ref([])
const reviews = ref([])
const strategies = ref([])
const strategyTemplates = ref({})
const strategyLoadError = ref('')
const loading = ref(false)
const submitting = ref(false)
const message = ref('')
const symbolsText = ref('')
const paramsText = ref('{}')
const resultStatus = ref('')
const sortBy = ref('total_return')

function defaultDateRange() {
  const end = new Date()
  const start = new Date()
  start.setFullYear(start.getFullYear() - 1)
  const fmt = (date) => date.toISOString().slice(0, 10).replace(/-/g, '')
  return { start: fmt(start), end: fmt(end) }
}

const defaultDates = defaultDateRange()

const form = reactive({
  name: '',
  universe_type: 'index',
  universe_value: 'csi1000',
  strategy_key: 'turtle',
  preset: 'turtle_conservative',
  start_date: defaultDates.start,
  end_date: defaultDates.end,
  initial_cash: 1000000,
  limit_symbols: 2,
})

const summary = computed(() => selectedBatch.value?.summary || {})
const latestReview = computed(() => reviews.value[0] || null)
const usableStrategies = computed(() => strategies.value.filter((item) => item.allow_backtest !== false && item.can_use !== false))
const selectedPresets = computed(() => strategyTemplates.value[form.strategy_key] || [])

const fallbackStrategies = [
  { key: 'turtle', name: '海龟交易法', allow_backtest: true, can_use: true },
  { key: 'grid', name: '网格策略', allow_backtest: true, can_use: true },
  { key: 'hidden_dragon', name: '潜龙低吸', allow_backtest: true, can_use: true },
  { key: 'single_yang', name: '单阳不破', allow_backtest: true, can_use: true },
  { key: 'boll', name: '布林带策略', allow_backtest: true, can_use: true },
  { key: 'mean_reversion', name: '均值回归', allow_backtest: true, can_use: true },
  { key: 'momentum_reversal', name: '动量反转', allow_backtest: true, can_use: true },
  { key: 'atr_breakout', name: 'ATR突破', allow_backtest: true, can_use: true },
  { key: 'volume_mfi_breakout', name: '量价突破', allow_backtest: true, can_use: true },
  { key: 'sma_cross', name: '双均线交叉', allow_backtest: true, can_use: true },
  { key: 'triple_sma', name: '三均线交叉', allow_backtest: true, can_use: true },
]

const fallbackTemplates = {
  turtle: [
    { preset: 'turtle_conservative', description: '保守参数', params_with_desc: {} },
    { preset: 'turtle_standard', description: '标准参数', params_with_desc: {} },
    { preset: 'turtle_aggressive', description: '激进参数', params_with_desc: {} },
  ],
  hidden_dragon: [
    { preset: 'dragon_conservative', description: '保守参数', params_with_desc: {} },
    { preset: 'dragon_default', description: '默认参数', params_with_desc: {} },
    { preset: 'dragon_aggressive', description: '激进参数', params_with_desc: {} },
  ],
  single_yang: [
    { preset: 'yang_conservative', description: '保守参数', params_with_desc: {} },
    { preset: 'yang_default', description: '默认参数', params_with_desc: {} },
    { preset: 'yang_aggressive', description: '激进参数', params_with_desc: {} },
  ],
}

function extractPresetParams(paramsWithDesc) {
  const out = {}
  if (!paramsWithDesc || typeof paramsWithDesc !== 'object') return out
  for (const [key, cfg] of Object.entries(paramsWithDesc)) {
    if (cfg && typeof cfg === 'object' && 'value' in cfg) out[key] = cfg.value
  }
  return out
}

function applyPresetParams() {
  const preset = selectedPresets.value.find((item) => item.preset === form.preset)
  const params = preset ? extractPresetParams(preset.params_with_desc) : {}
  paramsText.value = JSON.stringify(params, null, 2)
}

function parseSymbols(text) {
  return text.split(/[\s,，]+/).map((item) => item.trim()).filter(Boolean)
}

function parseParams(text) {
  const trimmed = text.trim()
  if (!trimmed) return {}
  return JSON.parse(trimmed)
}

function pct(value) {
  return typeof value === 'number' ? `${(value * 100).toFixed(2)}%` : '-'
}

function num(value) {
  return typeof value === 'number' ? value.toFixed(2) : '-'
}

async function loadBatches() {
  loading.value = true
  try {
    batches.value = await listBatches({ limit: 50 })
    if (!selectedBatchId.value && batches.value.length) {
      await selectBatch(batches.value[0].batch_id)
    }
  } finally {
    loading.value = false
  }
}

async function loadStrategyMeta() {
  strategyLoadError.value = ''
  try {
    const strategyPayload = await listStrategies()
    const loaded = strategyPayload.strategies || []
    strategies.value = loaded.length ? loaded : fallbackStrategies
  } catch (error) {
    strategyLoadError.value = error?.message || '策略列表加载失败'
    strategies.value = fallbackStrategies
  }

  try {
    const templatesPayload = await listStrategyTemplates()
    strategyTemplates.value = templatesPayload.templates || fallbackTemplates
  } catch (error) {
    strategyLoadError.value = strategyLoadError.value || error?.message || '策略模板加载失败'
    strategyTemplates.value = fallbackTemplates
  }

  if (!usableStrategies.value.some((item) => item.key === form.strategy_key) && usableStrategies.value.length) {
    form.strategy_key = usableStrategies.value[0].key
  }
  if (!form.preset && selectedPresets.value.length) {
    const defaultPreset = selectedPresets.value.find((item) => item.is_default) || selectedPresets.value[0]
    form.preset = defaultPreset.preset || ''
  }
  applyPresetParams()
}

async function selectBatch(batchId) {
  selectedBatchId.value = batchId
  await loadSelected()
}

async function loadSelected() {
  if (!selectedBatchId.value) return
  selectedBatch.value = await getBatch(selectedBatchId.value)
  await Promise.all([loadResults(), loadReviews()])
}

async function loadResults() {
  if (!selectedBatchId.value) return
  const payload = await getBatchResults(selectedBatchId.value, {
    status: resultStatus.value || undefined,
    sort_by: sortBy.value,
    order: 'desc',
    limit: 300,
  })
  results.value = payload.rows || []
}

async function loadReviews() {
  if (!selectedBatchId.value) return
  reviews.value = await listBatchReviews(selectedBatchId.value, { limit: 5 })
}

async function submitBatch() {
  submitting.value = true
  message.value = ''
  try {
    const created = await createBatch({
      ...form,
      symbols: parseSymbols(symbolsText.value),
      strategy_params: parseParams(paramsText.value),
    })
    message.value = `已创建 ${created.created_tasks} 个子任务`
    await loadBatches()
    await selectBatch(created.batch_id)
  } catch (error) {
    message.value = error?.response?.data?.detail || error.message || '创建失败'
  } finally {
    submitting.value = false
  }
}

async function cancelSelected() {
  if (!selectedBatchId.value) return
  await cancelBatch(selectedBatchId.value)
  await loadSelected()
}

async function retryFailed() {
  if (!selectedBatchId.value) return
  await retryFailedBatch(selectedBatchId.value)
  await loadSelected()
}

async function queueReview() {
  if (!selectedBatchId.value) return
  const result = await requestBatchReview(selectedBatchId.value, {
    objective: '提高收益并控制回撤',
    include_top_n: 20,
    include_bottom_n: 20,
    include_failures: true,
  })
  message.value = `AI 复盘已入队：${result.analysis_task_id}`
  await loadReviews()
}

async function createNextExperiment() {
  if (!selectedBatchId.value) return
  const result = await rerunBatch(selectedBatchId.value, {
    name: `${selectedBatch.value?.name || selectedBatchId.value} 下一轮`,
    strategy_params: parseParams(paramsText.value),
  })
  message.value = `下一轮实验已创建：${result.batch_id}`
  await loadBatches()
  await selectBatch(result.batch_id)
}

watch(() => form.strategy_key, () => {
  const defaultPreset = selectedPresets.value.find((item) => item.is_default) || selectedPresets.value[0]
  form.preset = defaultPreset?.preset || ''
  applyPresetParams()
})

watch(() => form.preset, applyPresetParams)

onMounted(async () => {
  await loadStrategyMeta()
  await loadBatches()
})
</script>

<style scoped>
.strategy-lab {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.lab-header,
.detail-header,
.actions,
.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.eyebrow {
  color: #64748b;
  font-size: 12px;
  letter-spacing: 0.08em;
  margin: 0;
  text-transform: uppercase;
}

h2,
h3,
p {
  margin: 0;
}

.subtitle {
  color: #64748b;
  margin-top: 6px;
}

.card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
  padding: 16px;
}

.form-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  margin-top: 12px;
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

.full {
  margin-top: 12px;
}

button {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  padding: 8px 12px;
}

.primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

.danger {
  color: #b91c1c;
}

.layout {
  display: grid;
  gap: 16px;
  grid-template-columns: 300px minmax(0, 1fr);
}

.batch-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.batch-row {
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
}

.batch-row.active {
  border-color: #2563eb;
  background: #eff6ff;
}

.batch-row span,
.batch-row small {
  color: #64748b;
}

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.metrics {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  margin: 16px 0;
}

.metrics div {
  background: #f8fafc;
  border-radius: 10px;
  padding: 10px;
}

.metrics span {
  color: #64748b;
  display: block;
  font-size: 12px;
}

.table-wrap {
  margin-top: 12px;
  overflow: auto;
}

.review-panel {
  background: #f8fafc;
  border-radius: 12px;
  margin-top: 16px;
  padding: 12px;
}

.review-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin-top: 10px;
}

table {
  border-collapse: collapse;
  min-width: 900px;
  width: 100%;
}

th,
td {
  border-bottom: 1px solid #e2e8f0;
  padding: 8px;
  text-align: left;
}

th {
  color: #475569;
  font-size: 12px;
}

.error {
  color: #b91c1c;
  max-width: 320px;
}

.empty {
  color: #64748b;
}

.message {
  color: #2563eb;
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
