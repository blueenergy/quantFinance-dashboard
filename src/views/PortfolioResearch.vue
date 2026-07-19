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
      <div class="create-head" @click="createCollapsed = !createCollapsed">
        <div>
          <h3>创建研究任务</h3>
          <p class="muted">任务由 stock-scoring-system 后台 worker 执行，完成后可发布最佳候选策略。</p>
        </div>
        <button class="collapse-btn" type="button">{{ createCollapsed ? '展开 ▸' : '收起 ▾' }}</button>
      </div>
      <div v-show="!createCollapsed">
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
          <small class="field-hint">逗号分隔可对比多组，如 30:70,60:40</small>
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
      </div>
    </section>

    <p v-if="message" class="message">{{ message }}</p>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <section class="layout">
      <aside class="card jobs-card">
        <div class="section-header jobs-header">
          <h3>研究任务</h3>
          <div class="job-filters">
            <select v-model="statusFilter" @change="loadJobs" title="状态">
              <option value="">全部状态</option>
              <option value="pending">pending</option>
              <option value="running">running</option>
              <option value="completed">completed</option>
              <option value="failed">failed</option>
            </select>
            <select v-model="universeFilter" @change="loadJobs" title="universe">
              <option value="">全部 universe</option>
              <option v-for="universe in universeOptions" :key="universe.value" :value="universe.value">
                {{ universe.value }}
              </option>
            </select>
            <input
              v-model="growthCycleWeightFilter"
              class="weight-filter"
              placeholder="growth:cycle 如 30:70"
              @change="loadJobs"
              @keyup.enter="loadJobs"
            />
          </div>
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
          <small v-if="jobWeightLabel(job)">{{ jobWeightLabel(job) }}</small>
          <small v-if="jobElapsedLabel(job)">{{ jobElapsedLabel(job) }}</small>
          <small v-if="jobProgressStageLabel(job)" class="progress-stage">{{ jobProgressStageLabel(job) }}</small>
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
                <span v-if="selectedJob.rerun_of_job_id"> · rerun of {{ selectedJob.rerun_of_job_id }}</span>
                <span v-if="jobElapsedLabel(selectedJob)"> · {{ jobElapsedLabel(selectedJob) }}</span>
                <span v-if="jobProgressStageLabel(selectedJob)"> · {{ jobProgressStageLabel(selectedJob) }}</span>
                <span v-if="selectedJob.error_message"> · {{ selectedJob.error_message }}</span>
              </p>
            </div>
            <div class="actions">
              <button
                :disabled="rerunLoading || selectedJob.status === 'pending' || selectedJob.status === 'running'"
                :title="rerunDisabledReason"
                @click="rerunJob"
              >
                {{ rerunLoading ? '重跑中...' : '用原参数重跑' }}
              </button>
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
              <span>任务耗时</span>
              <strong>{{ jobElapsedLabel(selectedJob) || '-' }}</strong>
            </div>
            <div v-if="selectedJob.status === 'running'">
              <span>当前阶段</span>
              <strong>{{ jobProgressStageLabel(selectedJob) || '-' }}</strong>
            </div>
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
              <span>成分口径</span>
              <strong>{{ universePitQualityLabel }}</strong>
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
                    <th v-if="showScoreColumn">Score</th>
                    <th>Variant</th>
                    <th>TopN</th>
                    <th>收益</th>
                    <th>超额</th>
                    <th>Sharpe</th>
                    <th>回撤</th>
                    <th>综合分</th>
                    <th>明细</th>
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
                    <td v-if="showScoreColumn">{{ row.score_variant || row.score_column || '-' }}</td>
                    <td>{{ row.variant || '-' }}</td>
                    <td>{{ row.top_n }}</td>
                    <td>{{ pct(row.cumulative_return) }}</td>
                    <td>{{ pct(row.index_excess_cumulative_return) }}</td>
                    <td>{{ num(row.sharpe) }}</td>
                    <td>{{ pct(row.max_drawdown) }}</td>
                    <td>{{ num(row.risk_adjusted_score, 3) }}</td>
                    <td class="detail-cell">
                      <button
                        v-if="row.combo_key && row.has_detail !== false"
                        class="link-btn"
                        @click="openComboDetail(row)"
                      >
                        查看成交
                      </button>
                      <span v-else class="muted" title="该结果未生成成交明细，重跑任务后可查看">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
      </main>
    </section>

    <div v-if="comboModalOpen" class="combo-overlay" @click.self="closeComboDetail">
      <div class="combo-modal">
        <header class="combo-head">
          <div>
            <h3>{{ comboTitle }}</h3>
            <p class="muted">{{ comboSubtitle }}</p>
          </div>
          <button class="link-btn" @click="closeComboDetail">关闭 ✕</button>
        </header>

        <p v-if="comboLoading" class="muted">加载成交明细中…</p>
        <p v-else-if="comboError" class="error">{{ comboError }}</p>

        <template v-else-if="comboDetail">
          <div class="combo-cards">
            <div v-for="card in comboSummaryCards" :key="card.k" class="combo-card">
              <span class="k">{{ card.k }}</span>
              <strong class="v" :class="card.cls">{{ card.v }}</strong>
            </div>
          </div>

          <h4 class="combo-h">净值曲线（扣费净收益，复利）</h4>
          <div class="combo-chart-panel">
            <svg v-if="equityChart" :viewBox="`0 0 ${equityChart.w} ${equityChart.h}`" width="100%" preserveAspectRatio="xMidYMid meet">
              <line
                v-for="(g, gi) in equityChart.grid"
                :key="`g${gi}`"
                :x1="equityChart.padL" :y1="g.y" :x2="equityChart.w - equityChart.padR" :y2="g.y"
                stroke="#e6eaf0" stroke-width="1"
              />
              <text
                v-for="(g, gi) in equityChart.grid"
                :key="`gt${gi}`"
                :x="equityChart.padL - 6" :y="g.y + 3" fill="#94a3b8" font-size="11" text-anchor="end"
              >{{ g.label }}</text>
              <polyline v-if="equityChart.hasIdx" fill="none" stroke="#94a3b8" stroke-width="1.5" :points="equityChart.idxPoints" />
              <polyline fill="none" stroke="#0f6bdc" stroke-width="2" :points="equityChart.stratPoints" />
              <text :x="equityChart.padL" :y="equityChart.h - 8" fill="#94a3b8" font-size="11">{{ equityChart.firstDate }}</text>
              <text :x="equityChart.w - equityChart.padR" :y="equityChart.h - 8" fill="#94a3b8" font-size="11" text-anchor="end">{{ equityChart.lastDate }}</text>
            </svg>
            <p v-else class="muted">无净值数据</p>
            <div class="combo-legend">
              <span><i class="sw" style="background:#0f6bdc"></i>策略（净）</span>
              <span><i class="sw" style="background:#94a3b8"></i>指数基准</span>
            </div>
          </div>

          <h4 class="combo-h">模拟成交明细 <span class="muted">（{{ filteredTrades.length }} 笔 / 共 {{ comboTrades.length }}）</span></h4>
          <div class="combo-toolbar">
            <label>调仓日
              <select v-model="tradeDateFilter">
                <option value="">全部</option>
                <option v-for="d in tradeDates" :key="d" :value="d">{{ d }}</option>
              </select>
            </label>
            <label>代码/名称 <input v-model="tradeSymFilter" placeholder="如 600000" /></label>
            <span class="muted">点击表头排序</span>
          </div>
          <div class="combo-table-wrap">
            <table>
              <thead>
                <tr>
                  <th v-for="col in tradeCols" :key="col.k" @click="sortTrades(col.k)">
                    {{ col.t }}<span v-if="tradeSortKey === col.k">{{ tradeSortDir > 0 ? ' ▲' : ' ▼' }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(t, ti) in filteredTrades" :key="`${t.symbol}-${t.score_date}-${ti}`">
                  <td>{{ t.score_date }}</td>
                  <td>{{ t.symbol }}</td>
                  <td>{{ t.name || '' }}</td>
                  <td>{{ num(t.score_value, 1) }}</td>
                  <td>{{ t.buy_date || '' }}</td>
                  <td>{{ num(t.buy_price) }}</td>
                  <td>{{ t.sell_date || '' }}</td>
                  <td>{{ num(t.sell_price) }}</td>
                  <td>{{ money(t.quantity) }}</td>
                  <td>{{ money(t.buy_amount) }}</td>
                  <td :class="signClass(t.holding_return)">{{ pct(t.holding_return) }}</td>
                  <td :class="signClass(t.net_pnl)">{{ money(t.net_pnl) }}</td>
                  <td>{{ money(t.estimated_transaction_cost) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="muted combo-note">
            成交价口径：买入 = 调仓日「次日开盘价」(next_open)，卖出 = 持有 {{ comboMeta.horizon || comboMeta.rebalance_interval_days }} 个交易日后那天的开盘价（next_open；遇一字跌停顺延，见 sell_delayed_days），open-to-open。
            等权建仓、整手取整、含费用模型；无期内再平衡、无额外滑点。
          </p>
          <p class="muted combo-note">
            末端截断：某期需「持有期满日」的卖出价才能结算，最后一笔卖出之后若再开仓的持有期已超出回测数据窗口（如 end_date 之后），该期无法计算收益、不展示——属正常现象，不是漏单。该「未结算的最新持仓」对应实盘推荐，不在历史成交回测内。
          </p>
        </template>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  createPortfolioResearchJob,
  getPortfolioResearchComboDetail,
  getPortfolioResearchJob,
  getPortfolioResearchResults,
  listPortfolioResearchJobs,
  publishPortfolioResearchResult,
  rerunPortfolioResearchJob,
} from '../api/portfolioResearch'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const loading = ref(false)
const submitting = ref(false)
const rerunLoading = ref(false)
const publishLoading = ref(false)
const artifactLoading = ref(false)
const nameTouched = ref(false)
const jobs = ref([])
const selectedJob = ref(null)
const resultDetail = ref(null)
const selectedJobId = ref('')
const statusFilter = ref('')
const universeFilter = ref('')
const growthCycleWeightFilter = ref('')
const message = ref('')
const errorMessage = ref('')
const createCollapsed = ref(false)
const nowMs = ref(Date.now())

let clockTimer = null
let pollTimer = null

const hasActiveJobs = computed(() =>
  jobs.value.some((job) => job.status === 'running' || job.status === 'pending')
    || selectedJob.value?.status === 'running'
    || selectedJob.value?.status === 'pending',
)

const comboModalOpen = ref(false)
const comboLoading = ref(false)
const comboError = ref('')
const comboDetail = ref(null)
const tradeDateFilter = ref('')
const tradeSymFilter = ref('')
const tradeSortKey = ref('score_date')
const tradeSortDir = ref(1)

const tradeCols = [
  { k: 'score_date', t: '调仓日' },
  { k: 'symbol', t: '代码' },
  { k: 'name', t: '名称' },
  { k: 'score_value', t: '分值' },
  { k: 'buy_date', t: '买入日' },
  { k: 'buy_price', t: '买价' },
  { k: 'sell_date', t: '卖出日' },
  { k: 'sell_price', t: '卖价' },
  { k: 'quantity', t: '数量' },
  { k: 'buy_amount', t: '买入额' },
  { k: 'holding_return', t: '持有收益' },
  { k: 'net_pnl', t: '净盈亏' },
  { k: 'estimated_transaction_cost', t: '费用' },
]

const universeOptions = [
  { value: 'hs300', label: 'hs300 - 沪深300' },
  { value: 'a500', label: 'a500 - 中证A500' },
  { value: 'csi500', label: 'csi500 - 中证500' },
  { value: 'csi1000', label: 'csi1000 - 中证1000' },
  { value: 'csi2000', label: 'csi2000 - 中证2000' },
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
const showScoreColumn = computed(() => new Set(resultRows.value.map((row) => row.score_variant)).size > 1)
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
const rerunDisabledReason = computed(() => {
  const status = selectedJob.value?.status
  if (status === 'pending' || status === 'running') {
    return '任务仍在排队或运行中，完成后可重跑'
  }
  return '用原参数新建一条研究任务，不覆盖当前报告'
})
const universePitQualityLabel = computed(() => {
  const quality = selectedJob.value?.data_watermark?.universe_pit_quality
    || resultDetail.value?.data_watermark?.universe_pit_quality
  if (quality === 'point_in_time') return 'Point-in-time（当时成分）'
  if (quality === 'latest_only') return 'Latest-only（幸存者近似，需复核）'
  return '-'
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

const PROGRESS_STAGE_LABELS = {
  loading_scores: '加载评分',
  building_dataset: '构建数据集',
  running_sweep: '参数扫描',
  rendering_report: '生成报告',
  generating_combo_details: '生成组合明细',
  writing_result: '写入结果',
}

function parseJobDate(value) {
  if (!value) return null
  const text = String(value).trim()
  if (!text) return null
  const normalized = /[zZ]|[+-]\d{2}:\d{2}$/.test(text) ? text : `${text}Z`
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDurationMs(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '-'
  const totalSeconds = Math.floor(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds} 秒`
  const totalMinutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (totalMinutes < 60) {
    return seconds ? `${totalMinutes} 分 ${seconds} 秒` : `${totalMinutes} 分`
  }
  const totalHours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (totalHours < 24) {
    return minutes ? `${totalHours} 小时 ${minutes} 分` : `${totalHours} 小时`
  }
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return hours ? `${days} 天 ${hours} 小时` : `${days} 天`
}

function jobWeightLabel(job) {
  const weights = job?.params?.growth_cycle_weights
  if (Array.isArray(weights) && weights.length) {
    return weights.join(', ')
  }
  if (typeof weights === 'string' && weights.trim()) {
    return weights.trim()
  }
  return ''
}

function jobElapsedLabel(job) {
  if (!job) return ''
  const status = job.status
  const now = nowMs.value
  if (status === 'completed') {
    const start = parseJobDate(job.started_at) || parseJobDate(job.created_at)
    const end = parseJobDate(job.completed_at)
    if (!start || !end) return ''
    return `用时 ${formatDurationMs(end.getTime() - start.getTime())}`
  }
  if (status === 'running') {
    const start = parseJobDate(job.started_at) || parseJobDate(job.created_at)
    if (!start) return ''
    return `已运行 ${formatDurationMs(now - start.getTime())}`
  }
  if (status === 'pending') {
    const start = parseJobDate(job.created_at)
    if (!start) return ''
    return `排队 ${formatDurationMs(now - start.getTime())}`
  }
  if (status === 'failed') {
    const start = parseJobDate(job.started_at) || parseJobDate(job.created_at)
    const end = parseJobDate(job.completed_at) || parseJobDate(job.updated_at)
    if (!start || !end) return ''
    return `失败前运行 ${formatDurationMs(end.getTime() - start.getTime())}`
  }
  return ''
}

function jobProgressStageLabel(job) {
  if (!job || job.status !== 'running' || !job.progress_stage) return ''
  return PROGRESS_STAGE_LABELS[job.progress_stage] || job.progress_stage
}

function startActiveJobTimers() {
  if (!clockTimer) {
    clockTimer = setInterval(() => {
      nowMs.value = Date.now()
    }, 1000)
  }
  if (!pollTimer) {
    pollTimer = setInterval(() => {
      refreshAll()
    }, 30000)
  }
}

function stopActiveJobTimers() {
  if (clockTimer) {
    clearInterval(clockTimer)
    clockTimer = null
  }
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

watch(hasActiveJobs, (active) => {
  if (active) startActiveJobTimers()
  else stopActiveJobTimers()
})

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

function signClass(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number === 0) return 'mut'
  return number > 0 ? 'pos' : 'neg'
}

const comboMeta = computed(() => comboDetail.value?.meta || {})
const comboSummary = computed(() => comboDetail.value?.summary || {})
const comboTrades = computed(() => comboDetail.value?.trades || [])

const comboTitle = computed(() => {
  const m = comboMeta.value
  if (!m.construction_mode) return '组合成交明细'
  return `${m.score_variant || m.score_column || ''} · ${m.variant || m.construction_mode} · Top-${m.top_n}`
})

const comboSubtitle = computed(() => {
  const m = comboMeta.value
  const parts = []
  if (m.construction_mode) parts.push(`构建 ${m.construction_mode}`)
  if (m.max_industry_weight != null) parts.push(`行业上限 ${pct(m.max_industry_weight)}`)
  if (m.horizon) parts.push(`调仓 ${m.horizon}d`)
  if (m.index_benchmark_symbol) parts.push(`基准 ${m.index_benchmark_symbol}`)
  return parts.join(' · ')
})

const comboSummaryCards = computed(() => {
  const s = comboSummary.value
  return [
    { k: '累计收益(净)', v: pct(s.cumulative_return), cls: signClass(s.cumulative_return) },
    { k: 'Sharpe', v: num(s.sharpe), cls: '' },
    { k: '最大回撤', v: pct(s.max_drawdown), cls: 'neg' },
    { k: '超额(对指数)', v: pct(s.index_excess_cumulative_return), cls: signClass(s.index_excess_cumulative_return) },
    { k: '平均换手', v: pct(s.average_turnover), cls: '' },
    { k: '调仓期数', v: num(s.periods, 0), cls: '' },
  ]
})

const tradeDates = computed(() =>
  Array.from(new Set(comboTrades.value.map((t) => String(t.score_date)))).sort()
)

const filteredTrades = computed(() => {
  const df = tradeDateFilter.value
  const sf = tradeSymFilter.value.trim()
  let rows = comboTrades.value.slice()
  if (df) rows = rows.filter((r) => String(r.score_date) === df)
  if (sf) rows = rows.filter((r) => String(r.symbol || '').includes(sf) || String(r.name || '').includes(sf))
  const key = tradeSortKey.value
  const dir = tradeSortDir.value
  rows.sort((a, b) => {
    let x = a[key]
    let y = b[key]
    if (typeof x === 'string' || typeof y === 'string') {
      x = String(x)
      y = String(y)
      return dir * (x < y ? -1 : x > y ? 1 : 0)
    }
    x = x == null || Number.isNaN(Number(x)) ? -Infinity : Number(x)
    y = y == null || Number.isNaN(Number(y)) ? -Infinity : Number(y)
    return dir * (x - y)
  })
  return rows
})

const equityChart = computed(() => {
  const periods = comboDetail.value?.periods || []
  if (!periods.length) return null
  const w = 1100
  const h = 300
  const padL = 52
  const padR = 16
  const padT = 14
  const padB = 28
  const stratEq = [1]
  const idxEq = [1]
  for (const p of periods) {
    const r = p.portfolio_return_net ?? p.portfolio_return ?? 0
    stratEq.push(stratEq[stratEq.length - 1] * (1 + r))
    const ir = p.index_benchmark_return ?? null
    idxEq.push(idxEq[idxEq.length - 1] * (1 + (ir == null ? 0 : ir)))
  }
  const hasIdx = periods.some((p) => p.index_benchmark_return != null)
  const all = stratEq.concat(hasIdx ? idxEq : [])
  const mn = Math.min(...all)
  const mx = Math.max(...all)
  const n = stratEq.length - 1
  const X = (i) => padL + (w - padL - padR) * (n === 0 ? 0 : i / n)
  const Y = (v) => padT + (h - padT - padB) * (1 - (v - mn) / ((mx - mn) || 1))
  const poly = (arr) => arr.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')
  const ticks = 4
  const grid = []
  for (let i = 0; i <= ticks; i++) {
    const v = mn + ((mx - mn) * i) / ticks
    grid.push({ y: Y(v), label: `${v.toFixed(2)}x` })
  }
  return {
    w, h, padL, padR, grid, hasIdx,
    stratPoints: poly(stratEq),
    idxPoints: poly(idxEq),
    firstDate: periods[0].score_date,
    lastDate: periods[periods.length - 1].score_date,
  }
})

function sortTrades(key) {
  if (tradeSortKey.value === key) {
    tradeSortDir.value *= -1
  } else {
    tradeSortKey.value = key
    tradeSortDir.value = 1
  }
}

async function openComboDetail(row) {
  if (!selectedJobId.value || !row?.combo_key) return
  comboModalOpen.value = true
  comboLoading.value = true
  comboError.value = ''
  comboDetail.value = null
  tradeDateFilter.value = ''
  tradeSymFilter.value = ''
  tradeSortKey.value = 'score_date'
  tradeSortDir.value = 1
  try {
    comboDetail.value = await getPortfolioResearchComboDetail(selectedJobId.value, row.combo_key)
  } catch (err) {
    comboError.value = err?.response?.data?.detail || err.message || '加载成交明细失败'
  } finally {
    comboLoading.value = false
  }
}

function closeComboDetail() {
  comboModalOpen.value = false
  comboDetail.value = null
}

async function loadJobs() {
  loading.value = true
  errorMessage.value = ''
  try {
    const params = {}
    if (statusFilter.value) params.status = statusFilter.value
    if (universeFilter.value) params.universe_index = universeFilter.value
    const weight = String(growthCycleWeightFilter.value || '').trim()
    if (weight) params.growth_cycle_weight = weight
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

async function rerunJob() {
  if (!selectedJobId.value) return
  rerunLoading.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    const res = await rerunPortfolioResearchJob(selectedJobId.value, { force: true })
    message.value = `已用原参数创建重跑任务 ${res.data?.job_id}`
    selectedJobId.value = res.data?.job_id || ''
    await loadJobs()
    if (selectedJobId.value) await selectJob(selectedJobId.value)
  } catch (err) {
    errorMessage.value = err?.response?.data?.detail || err.message || '重跑研究任务失败'
  } finally {
    rerunLoading.value = false
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

onMounted(async () => {
  await refreshAll()
  if (hasActiveJobs.value) startActiveJobTimers()
})

onUnmounted(() => {
  stopActiveJobTimers()
})
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

.jobs-header {
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

.job-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.job-filters select,
.job-filters .weight-filter {
  min-width: 0;
  flex: 1 1 110px;
  padding: 6px 8px;
  border: 1px solid #d7dde7;
  border-radius: 8px;
  background: #fff;
  color: #172033;
  font-size: 12px;
}

.job-filters .weight-filter {
  flex: 1 1 140px;
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

.field-hint {
  font-weight: 400;
  color: #94a3b8;
  font-size: 12px;
}

.create-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}

.create-head > div {
  min-width: 0;
}

.collapse-btn {
  flex: none;
  border: 1px solid #d9e1ec;
  background: #fff;
  color: #475569;
  font-size: 13px;
  white-space: nowrap;
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

.progress-stage {
  color: #0f6bdc;
  font-weight: 600;
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

/* A股配色：盈利/上涨=红，亏损/下跌=绿 */
.pos { color: #d4380d; font-weight: 700; }
.neg { color: #389e0d; font-weight: 700; }
.mut { color: #94a3b8; }

.detail-cell {
  text-align: left;
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

.combo-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(15, 23, 42, .45);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 32px 16px;
  overflow: auto;
}

.combo-modal {
  background: #fff;
  border-radius: 14px;
  width: min(1180px, 100%);
  padding: 22px 24px 26px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, .25);
}

.combo-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.combo-head h3 {
  overflow-wrap: anywhere;
}

.combo-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin: 8px 0 18px;
}

.combo-card {
  border: 1px solid #edf0f5;
  border-radius: 10px;
  padding: 12px;
  background: #fbfcfe;
}

.combo-card .k {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.combo-card .v {
  display: block;
  font-size: 20px;
  margin-top: 3px;
}

.combo-h {
  margin: 22px 0 10px;
  padding-left: 9px;
  border-left: 4px solid #0f6bdc;
}

.combo-chart-panel {
  border: 1px solid #e6eaf0;
  border-radius: 12px;
  padding: 14px;
  background: #fff;
}

.combo-legend {
  font-size: 12px;
  color: #64748b;
  margin-top: 8px;
  display: flex;
  gap: 16px;
}

.combo-legend .sw {
  display: inline-block;
  width: 11px;
  height: 11px;
  border-radius: 2px;
  vertical-align: middle;
  margin-right: 5px;
}

.combo-toolbar {
  display: flex;
  gap: 14px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 10px;
  font-size: 13px;
}

.combo-toolbar label {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.combo-table-wrap {
  max-height: 520px;
  overflow: auto;
  border: 1px solid #e6eaf0;
  border-radius: 10px;
}

.combo-table-wrap thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  cursor: pointer;
  user-select: none;
}

.combo-note {
  margin-top: 12px;
  font-size: 12px;
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
