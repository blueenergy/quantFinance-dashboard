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
      <div class="collapsible-block full">
        <button type="button" class="collapse-toggle" @click="createParamsExpanded = !createParamsExpanded">
          <span class="collapse-chevron" :class="{ expanded: createParamsExpanded }">▸</span>
          <span>策略参数 JSON</span>
        </button>
        <textarea
          v-show="createParamsExpanded"
          v-model="paramsText"
          rows="3"
          placeholder='{"period": 20}'
        ></textarea>
      </div>
      <div class="actions">
        <button class="primary" :disabled="submitting" @click="submitBatch">创建实验</button>
        <span v-if="createMessage" class="message">{{ createMessage }}</span>
      </div>
    </section>

    <section class="card loop-panel">
      <h3>自动迭代 Loop</h3>
      <p class="subtitle">由调度器每 45 秒推进：批量完成 → AI 复盘 → 应用建议参数 → 再测，直到达到停止规则或最大轮数。</p>
      <div class="form-grid">
        <label>
          最大轮数
          <input v-model.number="loopForm.max_iterations" type="number" min="1" max="20" />
        </label>
        <label>
          复盘目标
          <input v-model="loopForm.objective" placeholder="提高收益并控制回撤" />
        </label>
        <label>
          最低完成率
          <input v-model.number="loopForm.min_completion_rate" type="number" min="0" max="1" step="0.05" />
        </label>
      </div>
      <div class="actions">
        <button class="primary" :disabled="loopSubmitting" @click="startAutoLoop">从上方配置启动</button>
        <button :disabled="!selectedBatchId || loopSubmitting" @click="startAutoLoopFromBatch">从当前实验启动</button>
        <button :disabled="!selectedLoopId" @click="refreshSelectedLoop">刷新 Loop</button>
      </div>
      <div class="loop-layout" v-if="loops.length">
        <aside class="loop-list">
          <button
            v-for="loop in loops"
            :key="loop.loop_id"
            class="batch-row"
            :class="{ active: selectedLoopId === loop.loop_id }"
            @click="selectLoop(loop.loop_id)"
          >
            <strong>{{ loop.name || loop.loop_id }}</strong>
            <small>{{ loop.status }} · 第 {{ loop.current_iteration }}/{{ loop.max_iterations }} 轮 · {{ loop.current_step }}</small>
          </button>
        </aside>
        <div class="loop-detail" v-if="selectedLoop">
          <div class="detail-actions">
            <button v-if="selectedLoop.status === 'running'" @click="pauseSelectedLoop">暂停</button>
            <button v-if="selectedLoop.status === 'paused'" @click="resumeSelectedLoop">继续</button>
            <button @click="cancelSelectedLoop">取消</button>
            <button @click="advanceSelectedLoop">手动推进</button>
          </div>
          <p v-if="selectedLoop.stop_reason" class="message">停止原因：{{ selectedLoop.stop_reason }}</p>
          <ul class="loop-timeline">
            <li v-for="entry in selectedLoop.iterations || []" :key="`${entry.iteration}-${entry.batch_id}`">
              第 {{ entry.iteration }} 轮 · {{ entry.batch_id }}
              <span v-if="entry.decision"> · {{ entry.decision }}</span>
              <span v-if="entry.decision_reason">（{{ entry.decision_reason }}）</span>
              <span v-if="entry.child_batch_id"> → {{ entry.child_batch_id }}</span>
            </li>
          </ul>
        </div>
      </div>
      <p v-else class="muted">暂无自动迭代任务</p>
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
            <button @click="() => createNextExperiment()">下一轮实验</button>
            <button class="danger" @click="deleteSelectedBatch">删除实验</button>
            <button
              v-if="canCancelBatch"
              class="danger"
              title="终止尚未完成的子任务（排队中/执行中），不会撤销已完成的回测结果"
              @click="cancelSelected"
            >
              终止未完成任务
            </button>
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

        <section class="batch-config-panel">
          <h4>本实验 · 下一轮配置</h4>
          <p class="muted">选中实验的配置仅在此展示；应用 AI 建议不会改动上方「创建批量实验」公共区域。</p>
          <div class="form-grid">
            <label>
              当前实验名
              <input :value="selectedBatch.name" readonly />
            </label>
            <label>
              下一轮实验名
              <input v-model="batchDraft.name" placeholder="基于当前实验生成下一轮" />
            </label>
            <label>
              策略
              <input :value="batchDraft.strategy_key" readonly />
            </label>
            <label>
              Preset
              <select v-model="batchDraft.preset">
                <option value="">默认参数</option>
                <option v-for="preset in batchPresets" :key="preset.preset" :value="preset.preset">
                  {{ preset.description || preset.preset }}
                </option>
              </select>
            </label>
            <label>
              股票池
              <input :value="batchUniverseLabel" readonly />
            </label>
            <label>
              日期区间
              <input :value="`${selectedBatch.start_date} - ${selectedBatch.end_date}`" readonly />
            </label>
          </div>
          <label v-if="batchSymbolsDisplay" class="full">
            Symbols（{{ selectedBatch.symbols_count || 0 }} 只）
            <textarea :value="batchSymbolsDisplay" rows="2" readonly></textarea>
          </label>
          <div class="params-table-wrap full">
            <button type="button" class="collapse-toggle" @click="batchParamsExpanded = !batchParamsExpanded">
              <span class="collapse-chevron" :class="{ expanded: batchParamsExpanded }">▸</span>
              <strong>策略参数</strong>
              <span class="muted">（{{ batchParamTableRows.length }} 项）</span>
            </button>
            <div v-show="batchParamsExpanded" class="collapse-body">
              <table class="params-table" v-if="batchParamTableRows.length">
                <thead>
                  <tr>
                    <th>参数</th>
                    <th>当前值</th>
                    <th>下一轮值</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in batchParamTableRows"
                    :key="row.key"
                    :class="{
                      'param-row-changed': row.changed && row.hasCurrent,
                      'param-row-new': row.isNew,
                    }"
                  >
                    <td class="param-name">
                      <span class="param-key">{{ row.key }}</span>
                      <small v-if="paramLabel(row.key) !== row.key" class="param-desc">{{ paramLabel(row.key) }}</small>
                    </td>
                    <td class="param-current">{{ formatParamDisplay(row.currentValue) }}</td>
                    <td class="param-next">
                      <input
                        :value="formatParamDisplay(row.nextValue)"
                        @change="setBatchNextParam(row.key, $event.target.value, row.currentValue)"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-else class="muted">当前实验未记录策略参数。</p>
            </div>
          </div>
          <p v-if="batchMessage" class="message">{{ batchMessage }}</p>
        </section>

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
                <li v-for="item in latestReview.review?.next_experiments || []" :key="item.name || item.hypothesis || item">
                  <span>{{ item.name || item.hypothesis || item }}</span>
                  <button class="mini-btn" @click="applyReviewSuggestion(item)">应用到本实验</button>
                  <button class="mini-btn primary-mini" @click="applyReviewSuggestion(item, true)">应用并测试</button>
                </li>
              </ul>
            </div>
          </div>
          <div class="suggestion-list" v-if="latestReview.review?.parameter_suggestions?.length">
            <strong>参数建议</strong>
            <div
              v-for="item in latestReview.review.parameter_suggestions"
              :key="item.name || item.rationale || JSON.stringify(item)"
              class="suggestion-row"
            >
              <span>{{ item.name || '参数组合' }}：{{ item.rationale || item.suggested_values || item }}</span>
              <button class="mini-btn" @click="applyReviewSuggestion(item)">应用到本实验</button>
              <button class="mini-btn primary-mini" @click="applyReviewSuggestion(item, true)">应用并测试</button>
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
                <th>操作</th>
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
                <td>
                  <button
                    class="mini-btn danger-mini"
                    :disabled="row.status === 'running' || row.status === 'claimed'"
                    title="删除该股票的回测任务及结果"
                    @click="() => deleteResultRow(row)"
                  >
                    删除
                  </button>
                </td>
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
  deleteBatch,
  deleteBacktestTask,
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
  listLoops,
  createLoop,
  getLoop,
  pauseLoop,
  resumeLoop,
  cancelLoop,
  advanceLoop,
} from '../api/strategyLab'
import {
  applySuggestionToParams,
  buildParamTableRows,
  coerceParamsDict,
  coerceParamValue,
  formatParamDisplay,
  isExperimentReviewItem,
  normalizeStrategies,
  normalizeTemplateGroups,
  filterValidParamDict,
  isPlainParamsObject,
  resolveParamLabel,
} from '../utils/strategyLabParams'

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
const suppressPresetApply = ref(false)
const createMessage = ref('')
const batchMessage = ref('')
const symbolsText = ref('')
const paramsText = ref('{}')
const createParamsExpanded = ref(true)
const batchParamsExpanded = ref(true)
const batchDraft = reactive({
  name: '',
  strategy_key: '',
  preset: '',
  nextParams: {},
})
const resultStatus = ref('')
const sortBy = ref('total_return')
const loops = ref([])
const selectedLoop = ref(null)
const selectedLoopId = ref('')
const loopSubmitting = ref(false)
const loopForm = reactive({
  max_iterations: 3,
  objective: '提高收益并控制回撤',
  min_completion_rate: 0.5,
})

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

const canCancelBatch = computed(() => {
  const batch = selectedBatch.value
  if (!batch) return false
  const status = (batch.status || '').toLowerCase()
  if (status === 'pending' || status === 'running') return true
  const counts = summary.value?.status_counts || {}
  const active =
    (counts.pending || 0) + (counts.claimed || 0) + (counts.running || 0)
  return active > 0
})
const latestReview = computed(() => reviews.value[0] || null)
const usableStrategies = computed(() => strategies.value.filter((item) => item.allow_backtest !== false))
const selectedPresets = computed(() => strategyTemplates.value[form.strategy_key] || [])
const batchPresets = computed(() => strategyTemplates.value[batchDraft.strategy_key] || [])

const batchUniverseLabel = computed(() => {
  const batch = selectedBatch.value
  if (!batch) return ''
  if (batch.universe_type === 'manual') return '手工 symbols'
  if (batch.universe_type === 'index') return `指数成分 ${batch.universe_value || ''}`
  if (batch.universe_type === 'strategy_pool') return `策略股池 ${batch.universe_value || ''}`
  if (batch.universe_type === 'watchlist') return `观察列表 ${batch.universe_value || ''}`
  return `${batch.universe_type || ''} ${batch.universe_value || ''}`.trim()
})

const batchSymbolsDisplay = computed(() => {
  const batch = selectedBatch.value
  if (!batch || batch.universe_type !== 'manual') return ''
  const preview = batch.symbols_preview || []
  if (!preview.length) return ''
  const joined = preview.join(', ')
  const total = batch.symbols_count || preview.length
  if (total > preview.length) {
    return `${joined} … 等共 ${total} 只`
  }
  return joined
})

const batchParamsWithDesc = computed(() => {
  const preset = batchPresets.value.find((item) => item.preset === batchDraft.preset)
  return preset?.params_with_desc || {}
})

const batchParamTableRows = computed(() =>
  buildParamTableRows(selectedBatch.value?.strategy_params || {}, batchDraft.nextParams || {})
)

function paramLabel(key) {
  return resolveParamLabel(key, batchParamsWithDesc.value)
}

function setBatchNextParam(key, raw, hint) {
  batchDraft.nextParams[key] = coerceParamValue(raw, hint)
}

function getBatchNextParamsForSubmit(override) {
  if (isPlainParamsObject(override)) {
    return coerceParamsDict(override, selectedBatch.value?.strategy_params || {})
  }
  return coerceParamsDict(batchDraft.nextParams, selectedBatch.value?.strategy_params || {})
}

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

function initBatchDraft(batch) {
  if (!batch) return
  batchDraft.name = `${batch.name || batch.batch_id || '批量实验'} 下一轮`
  batchDraft.strategy_key = batch.strategy_key || ''
  batchDraft.preset = batch.preset || ''
  batchDraft.nextParams = filterValidParamDict(batch.strategy_params || {})
  batchParamsExpanded.value = true
  batchMessage.value = ''
}

async function applyReviewSuggestion(item, createImmediately = false) {
  if (!selectedBatch.value) return
  const beforeParams = { ...batchDraft.nextParams }
  const { patch, mergedParams, hasPatch } = applySuggestionToParams(beforeParams, item)
  if (!hasPatch) {
    batchMessage.value = '该建议没有可应用的有效参数（请检查参数名是否为单个字段）'
    return
  }

  if (item && typeof item === 'object') {
    if (item.strategy_key) batchDraft.strategy_key = item.strategy_key
    if (item.preset !== undefined) batchDraft.preset = item.preset || ''
    if (isExperimentReviewItem(item)) {
      batchDraft.name = item.name || item.hypothesis || batchDraft.name
    }
  }

  batchDraft.nextParams = { ...mergedParams }
  const addedKeys = Object.keys(patch).join(', ')
  batchMessage.value = `已合并到本实验：${addedKeys}`
  if (createImmediately) {
    await createNextExperiment(getBatchNextParamsForSubmit(mergedParams), batchDraft.name)
  }
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
  } catch (error) {
    createMessage.value = error?.response?.data?.detail || error.message || '历史实验列表加载失败'
  } finally {
    loading.value = false
  }
}

async function loadStrategyMeta() {
  strategyLoadError.value = ''
  try {
    const strategyPayload = await listStrategies()
    strategies.value = normalizeStrategies(strategyPayload.strategies, fallbackStrategies)
  } catch (error) {
    strategyLoadError.value = error?.message || '策略列表加载失败'
    strategies.value = normalizeStrategies([], fallbackStrategies)
  }

  try {
    const templatesPayload = await listStrategyTemplates()
    strategyTemplates.value = normalizeTemplateGroups(templatesPayload.templates, fallbackTemplates)
  } catch (error) {
    strategyLoadError.value = strategyLoadError.value || error?.message || '策略模板加载失败'
    strategyTemplates.value = normalizeTemplateGroups({}, fallbackTemplates)
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
  try {
    await loadSelected()
  } catch (error) {
    batchMessage.value = error?.response?.data?.detail || error.message || '实验详情加载失败'
  }
}

async function loadSelected() {
  if (!selectedBatchId.value) return
  selectedBatch.value = await getBatch(selectedBatchId.value)
  initBatchDraft(selectedBatch.value)
  await Promise.allSettled([loadResults(), loadReviews()])
}

async function loadResults() {
  if (!selectedBatchId.value) return
  try {
    const payload = await getBatchResults(selectedBatchId.value, {
      status: resultStatus.value || undefined,
      sort_by: sortBy.value,
      order: 'desc',
      limit: 300,
    })
    results.value = payload.rows || []
  } catch (error) {
    results.value = []
    batchMessage.value = error?.response?.data?.detail || error.message || '批量结果加载失败'
  }
}

async function loadReviews() {
  if (!selectedBatchId.value) return
  try {
    reviews.value = await listBatchReviews(selectedBatchId.value, { limit: 5 })
  } catch (error) {
    reviews.value = []
    batchMessage.value = error?.response?.data?.detail || error.message || 'AI 复盘加载失败'
  }
}

async function submitBatch() {
  submitting.value = true
  createMessage.value = ''
  try {
    const created = await createBatch({
      ...form,
      symbols: parseSymbols(symbolsText.value),
      strategy_params: parseParams(paramsText.value),
    })
    createMessage.value = `已创建 ${created.created_tasks} 个子任务`
    await loadBatches()
    await selectBatch(created.batch_id)
  } catch (error) {
    createMessage.value = error?.response?.data?.detail || error.message || '创建失败'
  } finally {
    submitting.value = false
  }
}

async function deleteSelectedBatch() {
  if (!selectedBatchId.value || !selectedBatch.value) return
  const name = selectedBatch.value.name || selectedBatchId.value
  const ok = window.confirm(
    `确定删除实验「${name}」吗？\n将永久删除该批次的所有子任务与回测结果，且不可恢复。`
  )
  if (!ok) return
  try {
    const result = await deleteBatch(selectedBatchId.value)
    const n = result?.deleted_tasks ?? 0
    createMessage.value = `已删除实验（${n} 个子任务）`
    selectedBatchId.value = ''
    selectedBatch.value = null
    results.value = []
    reviews.value = []
    await loadBatches()
  } catch (error) {
    batchMessage.value = error?.response?.data?.detail || error.message || '删除实验失败'
  }
}

async function deleteResultRow(row) {
  if (!row?.task_id) return
  const label = row.stock_name || row.symbol || row.task_id
  const ok = window.confirm(`确定删除 ${label} 的回测结果吗？`)
  if (!ok) return
  try {
    const result = await deleteBacktestTask(row.task_id)
    batchMessage.value =
      result?.message?.includes('cancelled') || result?.message?.includes('取消')
        ? `已取消运行中的任务：${label}`
        : `已删除：${label}`
    await loadSelected()
  } catch (error) {
    batchMessage.value = error?.response?.data?.detail || error.message || '删除失败'
  }
}

async function cancelSelected() {
  if (!selectedBatchId.value || !canCancelBatch.value) return
  const ok = window.confirm(
    '将终止本实验中尚未完成的子任务（排队中/执行中）。已完成的回测结果不会被撤销。确定继续？'
  )
  if (!ok) return
  try {
    const result = await cancelBatch(selectedBatchId.value)
    const n = result?.cancelled_tasks ?? 0
    batchMessage.value =
      n > 0 ? `已终止 ${n} 个未完成任务` : (result?.message || '没有可终止的任务')
    await loadSelected()
  } catch (error) {
    batchMessage.value = error?.response?.data?.detail || error.message || '终止失败'
  }
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
  batchMessage.value = `AI 复盘已入队：${result.analysis_task_id}`
  await loadReviews()
}

function buildLoopBatchConfig(nameSuffix = '') {
  return {
    name: form.name ? `${form.name}${nameSuffix}` : `Strategy Lab loop ${nameSuffix}`,
    symbols: parseSymbols(symbolsText.value),
    asset_type: 'stock',
    universe_type: form.universe_type,
    universe_value: form.universe_value,
    strategy_key: form.strategy_key,
    preset: form.preset || null,
    strategy_params: parseParams(paramsText.value),
    start_date: form.start_date,
    end_date: form.end_date,
    initial_cash: form.initial_cash,
    limit_symbols: form.limit_symbols,
  }
}

function buildLoopPayload(extra = {}) {
  return {
    max_iterations: loopForm.max_iterations,
    objective: loopForm.objective,
    stop_rules: { min_completion_rate: loopForm.min_completion_rate },
    review_options: {
      objective: loopForm.objective,
      include_top_n: 20,
      include_bottom_n: 20,
      include_failures: true,
    },
    ...extra,
  }
}

async function loadLoops() {
  try {
    loops.value = await listLoops({ limit: 30 })
    if (!selectedLoopId.value && loops.value.length) {
      await selectLoop(loops.value[0].loop_id)
    }
  } catch (error) {
    createMessage.value = error?.response?.data?.detail || error.message || 'Loop 列表加载失败'
  }
}

async function selectLoop(loopId) {
  selectedLoopId.value = loopId
  await refreshSelectedLoop()
}

async function refreshSelectedLoop() {
  if (!selectedLoopId.value) return
  selectedLoop.value = await getLoop(selectedLoopId.value)
}

async function startAutoLoop() {
  loopSubmitting.value = true
  createMessage.value = ''
  try {
    const created = await createLoop(buildLoopPayload({
      name: form.name ? `${form.name} 自动迭代` : undefined,
      batch_config: buildLoopBatchConfig(' 自动迭代'),
    }))
    createMessage.value = `自动迭代已启动：${created.loop_id}`
    await loadLoops()
    await selectLoop(created.loop_id)
    if (created.current_batch_id) {
      await selectBatch(created.current_batch_id)
    }
  } catch (error) {
    createMessage.value = error?.response?.data?.detail || error.message || '启动 Loop 失败'
  } finally {
    loopSubmitting.value = false
  }
}

async function startAutoLoopFromBatch() {
  if (!selectedBatchId.value) return
  loopSubmitting.value = true
  try {
    const created = await createLoop(buildLoopPayload({
      name: `${selectedBatch.value?.name || selectedBatchId.value} 自动迭代`,
      source_batch_id: selectedBatchId.value,
    }))
    batchMessage.value = `已从当前实验启动 Loop：${created.loop_id}`
    await loadLoops()
    await selectLoop(created.loop_id)
  } catch (error) {
    batchMessage.value = error?.response?.data?.detail || error.message || '启动 Loop 失败'
  } finally {
    loopSubmitting.value = false
  }
}

async function pauseSelectedLoop() {
  if (!selectedLoopId.value) return
  await pauseLoop(selectedLoopId.value)
  await refreshSelectedLoop()
  await loadLoops()
}

async function resumeSelectedLoop() {
  if (!selectedLoopId.value) return
  await resumeLoop(selectedLoopId.value)
  await refreshSelectedLoop()
  await loadLoops()
}

async function cancelSelectedLoop() {
  if (!selectedLoopId.value) return
  await cancelLoop(selectedLoopId.value)
  await refreshSelectedLoop()
  await loadLoops()
}

async function advanceSelectedLoop() {
  if (!selectedLoopId.value) return
  const result = await advanceLoop(selectedLoopId.value)
  batchMessage.value = `手动推进：${result.action}`
  await refreshSelectedLoop()
  await loadLoops()
  if (selectedLoop.value?.current_batch_id) {
    await selectBatch(selectedLoop.value.current_batch_id)
  }
}

async function createNextExperiment(paramsOverride = null, nameOverride = '') {
  if (!selectedBatchId.value) return
  const strategyParams = getBatchNextParamsForSubmit(
    isPlainParamsObject(paramsOverride) ? paramsOverride : null
  )
  const experimentName =
    typeof nameOverride === 'string' && nameOverride
      ? nameOverride
      : batchDraft.name || `${selectedBatch.value?.name || selectedBatchId.value} 下一轮`
  const result = await rerunBatch(selectedBatchId.value, {
    name: experimentName,
    strategy_key: batchDraft.strategy_key || selectedBatch.value?.strategy_key,
    preset: batchDraft.preset || null,
    strategy_params: strategyParams,
    start_date: selectedBatch.value?.start_date,
    end_date: selectedBatch.value?.end_date,
    initial_cash: selectedBatch.value?.initial_cash,
  })
  batchMessage.value = `下一轮实验已创建：${result.batch_id}`
  await loadBatches()
  await selectBatch(result.batch_id)
}

watch(() => form.strategy_key, () => {
  if (suppressPresetApply.value) return
  const defaultPreset = selectedPresets.value.find((item) => item.is_default) || selectedPresets.value[0]
  form.preset = defaultPreset?.preset || ''
  applyPresetParams()
})

watch(() => form.preset, () => {
  if (suppressPresetApply.value) return
  applyPresetParams()
})

onMounted(async () => {
  await loadStrategyMeta()
  await Promise.allSettled([loadBatches(), loadLoops()])
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

.loop-panel .loop-layout {
  display: grid;
  gap: 12px;
  grid-template-columns: 240px 1fr;
  margin-top: 12px;
}

.loop-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.loop-timeline {
  margin: 12px 0 0;
  padding-left: 18px;
  color: #334155;
  font-size: 13px;
}

.muted {
  color: #64748b;
  font-size: 13px;
  margin-top: 8px;
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

.batch-config-panel {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-top: 16px;
  padding: 12px;
}

.batch-config-panel h4 {
  margin-bottom: 4px;
}

.collapsible-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.collapse-toggle {
  align-items: center;
  background: transparent;
  border: none;
  color: #334155;
  cursor: pointer;
  display: inline-flex;
  gap: 8px;
  padding: 0;
  text-align: left;
  width: fit-content;
}

.collapse-toggle:hover {
  color: #2563eb;
}

.collapse-toggle strong {
  font-weight: 600;
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
  margin-top: 12px;
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
  color: #64748b;
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

.param-diff {
  background: #f8fafc;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  margin-top: 12px;
  padding: 12px;
}

.param-diff-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.diff-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.diff-summary.muted {
  color: #64748b;
}

.diff-chip {
  border-radius: 999px;
  font-size: 12px;
  padding: 4px 8px;
}

.diff-chip.added {
  background: #dcfce7;
  color: #166534;
}

.diff-chip.changed {
  background: #fef3c7;
  color: #92400e;
}

.diff-chip.removed {
  background: #fee2e2;
  color: #991b1b;
}

.diff-panels {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  margin-top: 12px;
}

.diff-panels h4 {
  color: #334155;
  margin: 0 0 6px;
}

.diff-panels pre {
  background: #0f172a;
  border-radius: 10px;
  color: #e2e8f0;
  font-size: 12px;
  margin: 0;
  max-height: 260px;
  overflow: auto;
  padding: 10px;
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

.mini-btn {
  font-size: 12px;
  padding: 4px 8px;
}

.danger-mini {
  border-color: #fecaca;
  color: #b91c1c;
}

.danger-mini:disabled {
  color: #94a3b8;
  border-color: #e2e8f0;
  cursor: not-allowed;
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
