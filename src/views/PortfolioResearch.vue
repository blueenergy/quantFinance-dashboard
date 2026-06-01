<template>
  <section class="portfolio-research">
    <header class="page-header">
      <div>
        <p class="eyebrow">Portfolio Research</p>
        <h2>组合研究</h2>
        <p class="subtitle">用生产数据复跑组合策略研究，筛选可行参数并保存为组合交易计划可消费的参数预设。</p>
      </div>
      <button :disabled="loading" @click="refreshAll">刷新</button>
    </header>

    <section class="card create-card">
      <div>
        <h3>创建研究任务</h3>
        <p class="muted">任务由 stock-scoring-system 后台 worker 执行，完成后可发布最佳候选策略。</p>
      </div>
      <div class="form-grid">
        <label>
          名称
          <input v-model="form.name" @input="nameTouched = true" />
        </label>
        <label>
          universe
          <select v-model="form.universe_index" @change="syncDefaultName">
            <option v-for="universe in universeOptions" :key="universe.value" :value="universe.value">
              {{ universe.label }}
            </option>
          </select>
        </label>
        <label>
          start_date
          <input v-model="form.start_date" type="date" />
        </label>
        <label>
          end_date
          <input v-model="form.end_date" type="date" />
        </label>
        <label>
          score_column
          <input v-model="form.score_column" />
        </label>
        <label>
          growth:cycle 权重
          <input v-model="form.growth_cycle_weights" placeholder="30:70,40:60" />
        </label>
        <label>
          Top N
          <input v-model="form.top_n_values" placeholder="10,20,50" />
        </label>
        <label>
          rebalance_days
          <input v-model.number="form.horizon" type="number" min="1" />
        </label>
        <label>
          active caps
          <input v-model="form.active_caps" placeholder="0.2,0.25,0.3" />
        </label>
        <label>
          legacy transaction_cost
          <input v-model.number="form.transaction_cost" type="number" min="0" step="0.0001" />
        </label>
        <label>
          buy commission
          <input v-model.number="form.buy_commission_rate" type="number" min="0" step="0.00001" />
        </label>
        <label>
          sell commission
          <input v-model.number="form.sell_commission_rate" type="number" min="0" step="0.00001" />
        </label>
        <label>
          min commission
          <input v-model.number="form.min_commission" type="number" min="0" step="0.1" />
        </label>
        <label>
          stamp tax
          <input v-model.number="form.stamp_tax_rate" type="number" min="0" step="0.00001" />
        </label>
        <label>
          initial capital
          <input v-model.number="form.initial_capital" type="number" min="0" step="10000" />
        </label>
      </div>
      <button :disabled="submitting || !form.start_date || !form.end_date" @click="createJob">
        {{ submitting ? '提交中...' : '提交研究任务' }}
      </button>
    </section>

    <p v-if="message" class="message">{{ message }}</p>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <section class="layout">
      <aside class="card jobs-card">
        <div class="section-header">
          <h3>研究任务</h3>
          <select v-model="statusFilter" @change="loadJobs">
            <option value="">全部</option>
            <option value="pending">pending</option>
            <option value="running">running</option>
            <option value="completed">completed</option>
            <option value="failed">failed</option>
          </select>
        </div>
        <p v-if="loading" class="muted">加载中...</p>
        <p v-else-if="!jobs.length" class="muted">暂无研究任务。</p>
        <button
          v-for="job in jobs"
          :key="job.job_id"
          class="job-row"
          :class="{ active: selectedJobId === job.job_id }"
          @click="selectJob(job.job_id)"
        >
          <strong>{{ job.name || job.job_id }}</strong>
          <span>{{ job.status }} · {{ job.universe_index || job.params?.universe_index || '-' }}</span>
          <small>{{ compactDate(job.start_date) }} → {{ compactDate(job.end_date) }}</small>
          <small v-if="job.best_row">best {{ pct(job.best_row.index_excess_cumulative_return) }} excess</small>
        </button>
      </aside>

      <main class="card detail-card">
        <p v-if="!selectedJob" class="muted">请选择一个研究任务。</p>
        <template v-else>
          <div class="section-header">
            <div>
              <h3>{{ selectedJob.name || selectedJob.job_id }}</h3>
              <p class="muted">
                {{ selectedJob.status }} · {{ selectedJob.job_id }}
                <span v-if="selectedJob.error_message"> · {{ selectedJob.error_message }}</span>
              </p>
            </div>
            <div class="actions">
              <button
                v-if="selectedJob.result_id"
                :disabled="artifactLoading"
                @click="openArtifact(selectedJob.job_id)"
              >
                {{ artifactLoading ? '打开中...' : '打开 HTML 报告' }}
              </button>
            </div>
          </div>

          <div class="info-grid">
            <div>
              <span>评分数据水位</span>
              <strong>{{ selectedJob.data_watermark?.stock_scores_max_date || '-' }}</strong>
            </div>
            <div>
              <span>可回测收益水位</span>
              <strong>{{ selectedJob.data_watermark?.backtest_score_max_date || selectedJob.data_watermark?.stock_scores_max_date || '-' }}</strong>
            </div>
            <div>
              <span>dataset rows</span>
              <strong>{{ selectedJob.data_watermark?.dataset_rows ?? '-' }}</strong>
            </div>
            <div>
              <span>已保存预设</span>
              <strong>{{ publishedPresetLabel }}</strong>
            </div>
            <div>
              <span>发布动作</span>
              <strong>{{ publishActionLabel }}</strong>
            </div>
          </div>

          <section class="research-params">
            <div class="section-header">
              <div>
                <h4>研究参数</h4>
                <p class="muted">创建研究任务时使用的参数。</p>
              </div>
            </div>
            <div class="config-grid">
              <span v-for="row in researchParamRows" :key="row.key">
                <strong>{{ row.label }}</strong>{{ row.value }}
              </span>
            </div>
          </section>

          <section v-if="candidateConfig" class="candidate">
            <div class="section-header">
              <div>
                <h4>候选策略配置</h4>
                <p class="muted">{{ candidateConfig.name || candidateConfig.preset_id }}</p>
              </div>
              <div class="actions">
                <button :disabled="publishLoading || hasPublishedPreset" @click="publish('draft')">
                  保存为 draft 预设
                </button>
                <button :disabled="publishLoading || hasPublishedPreset" @click="publish('enabled')">
                  保存并启用预设
                </button>
              </div>
            </div>
            <p v-if="hasPublishedPreset" class="muted">
              该研究结果已经保存为参数预设，不能重复启用。
            </p>
            <div class="config-grid">
              <span><strong>top_n</strong>{{ candidateConfig.top_n ?? '-' }}</span>
              <span><strong>rebalance</strong>{{ candidateConfig.rebalance_days ? `${candidateConfig.rebalance_days}d` : '-' }}</span>
              <span><strong>mode</strong>{{ candidateConfig.construction_mode || '-' }}</span>
              <span><strong>industry cap</strong>{{ pct(candidateConfig.max_industry_weight) }}</span>
              <span><strong>growth</strong>{{ pct(candidateConfig.growth_weight) }}</span>
              <span><strong>cycle</strong>{{ pct(candidateConfig.cycle_weight) }}</span>
              <span><strong>benchmark</strong>{{ candidateConfig.index_benchmark_symbol || '-' }}</span>
              <span><strong>initial capital</strong>{{ money(candidateConfig.initial_capital) }}</span>
              <span><strong>cash buffer</strong>{{ pct(candidateConfig.cash_buffer) }}</span>
              <span><strong>execution price</strong>{{ candidateConfig.execution_price || '-' }}</span>
            </div>
          </section>

          <section>
            <h4>结果排行</h4>
            <p v-if="!resultRows.length" class="muted">暂无结果。任务完成后会显示。</p>
            <div v-else class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Score</th>
                    <th>Variant</th>
                    <th>TopN</th>
                    <th>收益</th>
                    <th>超额</th>
                    <th>Sharpe</th>
                    <th>回撤</th>
                    <th>综合分</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, idx) in resultRows.slice(0, 30)"
                    :key="`${row.score_variant}-${row.variant}-${row.top_n}-${idx}`"
                    :class="{ 'selected-result-row': isSelectedResultRow(row, idx) }"
                  >
                    <td>
                      {{ idx + 1 }}
                      <span v-if="isSelectedResultRow(row, idx)" class="selected-badge">已选</span>
                    </td>
                    <td>{{ row.score_variant || row.score_column || '-' }}</td>
                    <td>{{ row.variant || '-' }}</td>
                    <td>{{ row.top_n }}</td>
                    <td>{{ pct(row.cumulative_return) }}</td>
                    <td>{{ pct(row.index_excess_cumulative_return) }}</td>
                    <td>{{ num(row.sharpe) }}</td>
                    <td>{{ pct(row.max_drawdown) }}</td>
                    <td>{{ num(row.risk_adjusted_score, 3) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
      </main>
    </section>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  createPortfolioResearchJob,
  getPortfolioResearchJob,
  getPortfolioResearchResults,
  listPortfolioResearchJobs,
  publishPortfolioResearchResult,
} from '../api/portfolioResearch'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const loading = ref(false)
const submitting = ref(false)
const publishLoading = ref(false)
const artifactLoading = ref(false)
const nameTouched = ref(false)
const jobs = ref([])
const selectedJob = ref(null)
const resultDetail = ref(null)
const selectedJobId = ref('')
const statusFilter = ref('')
const message = ref('')
const errorMessage = ref('')

const universeOptions = [
  { value: 'hs300', label: 'hs300 - 沪深300' },
  { value: 'a500', label: 'a500 - 中证A500' },
  { value: 'csi500', label: 'csi500 - 中证500' },
  { value: 'csi1000', label: 'csi1000 - 中证1000' },
  { value: 'star50', label: 'star50 - 科创50' },
]

const form = ref({
  name: defaultResearchName('csi1000'),
  universe_index: 'csi1000',
  start_date: '2023-01-01',
  end_date: todayInputDate(),
  score_column: 'composite_growth_cycle_score',
  growth_cycle_weights: '30:70',
  top_n_values: '10,20,50',
  horizon: 20,
  active_caps: '0.2,0.25,0.3,0.4',
  transaction_cost: 0.001,
  buy_commission_rate: 0.0001,
  sell_commission_rate: 0.0001,
  min_commission: 5,
  stamp_tax_rate: 0.0005,
  transfer_fee_rate: 0,
  initial_capital: 1_000_000,
})

const resultRows = computed(() => resultDetail.value?.rows || [])
const candidateConfig = computed(() => resultDetail.value?.candidate_strategy_config || selectedJob.value?.candidate_strategy_config)
const researchParamRows = computed(() => buildResearchParamRows(selectedJob.value))
const publishedPresetId = computed(() => resultDetail.value?.published_preset_id || selectedJob.value?.published_preset_id || '')
const publishedStatus = computed(() => resultDetail.value?.published_status || selectedJob.value?.published_status || '')
const publishAction = computed(() => resultDetail.value?.publish_action || selectedJob.value?.publish_action || '')
const hasPublishedPreset = computed(() => Boolean(publishedPresetId.value))
const publishedPresetLabel = computed(() => {
  if (!publishedPresetId.value) return '-'
  return publishedStatus.value ? `${publishedPresetId.value} (${publishedStatus.value})` : publishedPresetId.value
})
const publishActionLabel = computed(() => {
  const labels = {
    preset_published: '新建 preset',
    evidence_attached: '作为 evidence 附加',
  }
  return labels[publishAction.value] || '-'
})

function universeName(value) {
  const option = universeOptions.find((item) => item.value === value)
  return option?.label || value || 'universe'
}

function defaultResearchName(universeValue) {
  return `${universeName(universeValue)} growth-cycle research`
}

function syncDefaultName() {
  if (nameTouched.value) return
  form.value.name = defaultResearchName(form.value.universe_index)
}

function todayInputDate() {
  return new Date().toISOString().slice(0, 10)
}

function parseCsvNumbers(value, mapper = Number) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map(mapper)
}

function compactDate(value) {
  if (!value) return '-'
  const text = String(value)
  if (text.length === 8) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
  return text
}

function pct(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return `${(number * 100).toFixed(2)}%`
}

function num(value, digits = 2) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return number.toFixed(digits)
}

function money(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return number.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

function formatList(value, formatter = (item) => item) {
  if (Array.isArray(value)) {
    return value.map(formatter).join(', ')
  }
  if (value === undefined || value === null || value === '') return '-'
  return formatter(value)
}

function formatBool(value) {
  if (value === undefined || value === null) return '-'
  return value ? 'true' : 'false'
}

function buildResearchParamRows(job) {
  if (!job) return []
  const params = job.params || {}
  const rows = [
    { key: 'start_date', label: 'start_date', value: compactDate(params.start_date || job.start_date) },
    { key: 'end_date', label: 'end_date', value: compactDate(params.end_date || job.end_date) },
    { key: 'universe_index', label: 'universe', value: universeName(params.universe_index || job.universe_index) },
    { key: 'score_column', label: 'score_column', value: params.score_column || '-' },
    { key: 'growth_cycle_weights', label: 'growth:cycle 权重', value: formatList(params.growth_cycle_weights) },
    { key: 'top_n_values', label: 'Top N', value: formatList(params.top_n_values) },
    { key: 'horizon', label: 'horizon', value: params.horizon ?? '-' },
    { key: 'rebalance_interval_days', label: 'rebalance intervals', value: formatList(params.rebalance_interval_days, (item) => `${item}d`) },
    { key: 'active_caps', label: 'active caps', value: formatList(params.active_caps, pct) },
    { key: 'transaction_cost', label: 'legacy transaction_cost', value: pct(params.transaction_cost) },
    { key: 'buy_commission_rate', label: 'buy commission', value: pct(params.buy_commission_rate) },
    { key: 'sell_commission_rate', label: 'sell commission', value: pct(params.sell_commission_rate) },
    { key: 'stamp_tax_rate', label: 'stamp tax', value: pct(params.stamp_tax_rate) },
    { key: 'index_benchmark_symbol', label: 'benchmark', value: params.index_benchmark_symbol || '-' },
    { key: 'cash_buffer', label: 'cash_buffer', value: pct(params.cash_buffer) },
    { key: 'initial_capital', label: 'initial_capital', value: money(params.initial_capital) },
    { key: 'force', label: 'force', value: formatBool(params.force) },
  ]
  return rows.map((row) => ({ ...row, value: row.value || '-' }))
}

function isSelectedResultRow(row, idx) {
  return idx === 0
}

async function loadJobs() {
  loading.value = true
  errorMessage.value = ''
  try {
    const params = {}
    if (statusFilter.value) params.status = statusFilter.value
    const res = await listPortfolioResearchJobs(params)
    jobs.value = res.data || []
    if (selectedJobId.value && jobs.value.some((job) => job.job_id === selectedJobId.value)) {
      selectedJob.value = jobs.value.find((job) => job.job_id === selectedJobId.value)
    } else if (selectedJobId.value) {
      selectedJobId.value = ''
      selectedJob.value = null
      resultDetail.value = null
    }
  } catch (err) {
    errorMessage.value = err?.response?.data?.detail || err.message || '加载研究任务失败'
  } finally {
    loading.value = false
  }
}

async function selectJob(jobId) {
  selectedJobId.value = jobId
  resultDetail.value = null
  const jobRes = await getPortfolioResearchJob(jobId)
  selectedJob.value = jobRes.data
  if (selectedJob.value?.result_id || selectedJob.value?.status === 'completed') {
    try {
      const resultRes = await getPortfolioResearchResults(jobId)
      resultDetail.value = resultRes.data
    } catch (err) {
      if (selectedJob.value?.status === 'completed') {
        errorMessage.value = err?.response?.data?.detail || err.message || '加载研究结果失败'
      }
    }
  }
}

async function createJob() {
  submitting.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    const payload = {
      ...form.value,
      name: form.value.name || defaultResearchName(form.value.universe_index),
      growth_cycle_weights: parseCsvNumbers(form.value.growth_cycle_weights, String),
      top_n_values: parseCsvNumbers(form.value.top_n_values, Number),
      active_caps: parseCsvNumbers(form.value.active_caps, Number),
      rebalance_interval_days: [Number(form.value.horizon)],
    }
    const res = await createPortfolioResearchJob(payload)
    message.value = `已创建研究任务 ${res.data?.job_id}`
    selectedJobId.value = res.data?.job_id || ''
    await loadJobs()
    if (selectedJobId.value) await selectJob(selectedJobId.value)
  } catch (err) {
    errorMessage.value = err?.response?.data?.detail || err.message || '创建研究任务失败'
  } finally {
    submitting.value = false
  }
}

async function publish(status) {
  if (!resultDetail.value?.result_id) return
  publishLoading.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    const res = await publishPortfolioResearchResult(resultDetail.value.result_id, { status })
    if (res.data?.attached_to_existing) {
      message.value = `参数已存在，已作为 evidence 附加到预设 ${res.data?.preset?.preset_id}`
    } else {
      message.value = `已保存参数预设 ${res.data?.preset?.preset_id}`
    }
    await selectJob(selectedJobId.value)
    await loadJobs()
  } catch (err) {
    errorMessage.value = err?.response?.data?.detail || err.message || '发布策略失败'
  } finally {
    publishLoading.value = false
  }
}

async function openArtifact(jobId) {
  artifactLoading.value = true
  errorMessage.value = ''
  try {
    const token = localStorage.getItem('access_token')
    const response = await fetch(`${API_BASE}/portfolio-research/jobs/${jobId}/artifact`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || `HTTP ${response.status}`)
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (err) {
    errorMessage.value = err.message || '打开报告失败'
  } finally {
    artifactLoading.value = false
  }
}

async function refreshAll() {
  await loadJobs()
  if (selectedJobId.value) await selectJob(selectedJobId.value)
}

onMounted(refreshAll)
</script>

<style scoped>
.portfolio-research {
  box-sizing: border-box;
  color: #172033;
  margin: 0 auto;
  max-width: 1680px;
  padding: 28px 32px 40px;
  width: 100%;
}

.page-header,
.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.page-header > div,
.section-header > div {
  min-width: 0;
}

.section-header h3,
.section-header h4,
.section-header .muted {
  overflow-wrap: anywhere;
  word-break: break-word;
}

.eyebrow {
  margin: 0 0 4px;
  color: #64748b;
  font-size: 12px;
  letter-spacing: .08em;
  text-transform: uppercase;
}

h2,
h3,
h4 {
  margin: 0 0 8px;
}

.subtitle,
.muted,
small {
  color: #64748b;
}

.card {
  background: #fff;
  border: 1px solid #e6eaf0;
  border-radius: 14px;
  padding: 22px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
}

.create-card {
  margin-bottom: 20px;
}

.form-grid,
.info-grid {
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

button {
  border: 1px solid #0f6bdc;
  border-radius: 8px;
  padding: 8px 12px;
  background: #0f6bdc;
  color: #fff;
  cursor: pointer;
  text-decoration: none;
}

button:disabled {
  cursor: not-allowed;
  opacity: .55;
}

.layout {
  display: grid;
  grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
  gap: 20px;
}

.job-row {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
  border: 1px solid #e6eaf0;
  background: #fbfcfe;
  color: #172033;
  text-align: left;
}

.job-row.active {
  border-color: #0f6bdc;
  background: #eef6ff;
}

.info-grid > div {
  border: 1px solid #edf0f5;
  border-radius: 10px;
  padding: 12px;
  background: #fbfcfe;
  min-width: 0;
}

.info-grid span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.info-grid strong {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.detail-card,
.jobs-card {
  min-width: 0;
}

.job-row strong,
.job-row span,
.job-row small {
  overflow-wrap: anywhere;
  word-break: break-word;
}

.candidate,
.research-params {
  margin: 20px 0;
  padding: 18px;
  border: 1px solid #e6eaf0;
  border-radius: 12px;
  background: #fbfcfe;
  min-width: 0;
}

.candidate .section-header,
.research-params .section-header {
  align-items: flex-start;
  flex-wrap: wrap;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}

.config-grid span {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid #edf0f5;
  border-radius: 10px;
  background: #fff;
  color: #172033;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.config-grid strong {
  display: block;
  margin-bottom: 4px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid #e6eaf0;
  border-radius: 10px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th,
td {
  padding: 9px 10px;
  border-bottom: 1px solid #edf0f5;
  text-align: right;
  white-space: nowrap;
}

th:nth-child(2),
td:nth-child(2),
th:nth-child(3),
td:nth-child(3) {
  text-align: left;
}

th {
  background: #f8fafc;
  color: #475569;
}

.selected-result-row td {
  background: #fff7ed;
  border-bottom-color: #fed7aa;
}

.selected-result-row td:first-child {
  color: #c2410c;
  font-weight: 800;
}

.selected-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 2px 6px;
  border-radius: 999px;
  background: #f97316;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.message {
  color: #047857;
}

.error {
  color: #b91c1c;
}

@media (max-width: 900px) {
  .portfolio-research {
    padding: 18px;
  }

  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
