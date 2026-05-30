<template>
  <section class="portfolio-plans">
    <header class="page-header">
      <div>
        <p class="eyebrow">Portfolio Plans</p>
        <h2>组合交易计划</h2>
        <p class="subtitle">查看指数增强策略的交易计划、人工审核状态和 paper trading 净值。</p>
      </div>
      <button :disabled="loading" @click="refreshAll">刷新</button>
    </header>

    <section class="toolbar">
      <label>
        策略
        <select v-model="selectedStrategyId" @change="loadPlans">
          <option value="">全部策略</option>
          <option v-for="strategy in strategies" :key="strategy.strategy_id" :value="strategy.strategy_id">
            {{ strategy.name || strategy.strategy_id }}
          </option>
        </select>
      </label>
      <label>
        状态
        <select v-model="statusFilter" @change="loadPlans">
          <option value="">全部</option>
          <option value="generated">generated</option>
          <option value="needs_review">needs_review</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
          <option value="executed_paper">executed_paper</option>
          <option value="partially_executed">partially_executed</option>
        </select>
      </label>
    </section>

    <section class="card generate-card">
      <div>
        <h3>生成交易计划</h3>
        <p class="muted">从当前可用 strategy 生成新的 plan，生成后仍需人工审核。</p>
      </div>
      <label>
        策略
        <select v-model="generateForm.strategy_id" @change="loadPlanGenerationWatermark">
          <option value="">请选择 strategy</option>
          <option v-for="strategy in availableStrategies" :key="strategy.strategy_id" :value="strategy.strategy_id">
            {{ strategy.name || strategy.strategy_id }}
          </option>
        </select>
      </label>
      <label>
        base_date
        <input v-model="generateForm.base_date" type="date" @change="loadPlanGenerationWatermark" />
      </label>
      <label>
        mode
        <select v-model="generateForm.mode">
          <option value="auto">auto</option>
          <option value="monitor">monitor</option>
          <option value="rebalance">rebalance</option>
        </select>
      </label>
      <label class="inline-check">
        <input v-model="generateForm.force" type="checkbox" />
        force
      </label>
      <button :disabled="generateLoading || !generateForm.strategy_id || !generateForm.base_date" @click="generatePlan">
        {{ generateLoading ? '提交中...' : '生成 plan' }}
      </button>
      <p v-if="currentGenerationTask" class="task-status">
        任务 {{ currentGenerationTask.task_id }}：{{ currentGenerationTask.status }}
        <span v-if="currentGenerationTask.plan_id"> / plan {{ currentGenerationTask.plan_id }}</span>
        <span v-if="currentGenerationTask.error_message"> / {{ currentGenerationTask.error_message }}</span>
      </p>
    </section>

    <p v-if="message" class="message">{{ message }}</p>

    <section class="card watermark-card">
      <div class="task-list-header">
        <div>
          <h3>Plan 生成数据水位</h3>
          <p class="muted">确认当前 base_date 对应评分数据是否可用于生成 plan。</p>
        </div>
        <button :disabled="watermarkLoading || !generateForm.strategy_id" @click="loadPlanGenerationWatermark">
          刷新水位
        </button>
      </div>
      <p v-if="watermarkLoading" class="muted">正在加载数据水位...</p>
      <p v-else-if="!planGenerationWatermark" class="muted">请选择 strategy 后查看评分水位。</p>
      <template v-else>
        <div class="watermark-grid">
          <div>
            <span>universe</span>
            <strong>{{ planGenerationWatermark.universe_index || '-' }}</strong>
          </div>
          <div>
            <span>base_date 评分</span>
            <strong>{{ targetScoringRunText }}</strong>
            <small v-if="planGenerationWatermark.target_scoring_run?.updated_at">
              updated {{ planGenerationWatermark.target_scoring_run.updated_at }}
            </small>
          </div>
          <div>
            <span>最近完成评分</span>
            <strong>{{ latestCompletedScoringText }}</strong>
          </div>
          <div>
            <span>最新可用评分数据</span>
            <strong>{{ latestAvailableScoreText }}</strong>
            <small>{{ latestAvailableScoreMeta }}</small>
          </div>
          <div>
            <span>最近评分 run</span>
            <strong>{{ latestScoringRunText }}</strong>
          </div>
        </div>
        <p v-if="planGenerationWatermark.target_is_running" class="watermark-warning">
          当前 base_date 的评分仍在运行，plan generation worker 会等待，避免使用半成品评分。
        </p>
      </template>
    </section>

    <section class="card worker-status-card">
      <div class="task-list-header">
        <div>
          <h3>Plan 生成 Worker</h3>
          <p class="muted">展示 quant-scorer 最近一次 heartbeat，辅助判断任务是否有人消费。</p>
        </div>
        <button :disabled="workerStatusLoading" @click="loadWorkerStatus">刷新 worker</button>
      </div>
      <p v-if="workerStatusLoading" class="muted">正在加载 worker 状态...</p>
      <p v-else-if="!workerStatuses.length" class="muted">暂无 worker heartbeat。</p>
      <div v-else class="worker-status-grid">
        <div v-for="worker in workerStatuses" :key="worker.worker_id" class="worker-status-row">
          <span>{{ worker.worker_id }}</span>
          <strong>{{ worker.status }}</strong>
          <small>last_seen: {{ worker.last_seen_at || '-' }}</small>
          <small v-if="worker.current_task_id">current_task: {{ worker.current_task_id }}</small>
          <small v-else-if="worker.last_task_id">last_task: {{ worker.last_task_id }}</small>
          <small v-if="worker.last_message">{{ worker.last_message }}</small>
        </div>
      </div>
    </section>

    <section class="card task-list-card">
      <div class="task-list-header">
        <div>
          <h3>最近生成任务</h3>
          <p class="muted">
            {{ generationTasks.length }} 条最近任务
            <span v-if="latestGenerationTask">
              · 最新 {{ latestGenerationTask.status }} / {{ latestGenerationTask.strategy_id }} / {{ latestGenerationTask.base_date }}
            </span>
          </p>
        </div>
        <div class="task-list-actions">
          <button @click="generationTasksExpanded = !generationTasksExpanded">
            {{ generationTasksExpanded ? '折叠' : '展开' }}
          </button>
          <button :disabled="tasksLoading" @click="loadGenerationTasks">刷新任务</button>
        </div>
      </div>
      <template v-if="generationTasksExpanded">
        <p v-if="tasksLoading" class="muted">正在加载任务...</p>
        <p v-else-if="!generationTasks.length" class="muted">暂无生成任务。</p>
        <div v-else class="table-wrap compact generation-task-table">
          <table>
            <thead>
              <tr>
                <th>created_at</th>
                <th>status</th>
                <th>strategy</th>
                <th>base_date</th>
                <th>mode</th>
                <th>attempts</th>
                <th>worker</th>
                <th>plan/error</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="task in generationTasks"
                :key="task.task_id"
                :class="{ active: currentGenerationTask?.task_id === task.task_id }"
                @click="currentGenerationTask = task"
              >
                <td>{{ task.created_at || '-' }}</td>
                <td>{{ task.status || '-' }}</td>
                <td class="truncate" :title="task.strategy_id">{{ task.strategy_id || '-' }}</td>
                <td>{{ task.base_date || '-' }}</td>
                <td>{{ task.mode || '-' }}</td>
                <td>{{ task.attempts ?? 0 }}</td>
                <td class="truncate" :title="task.worker_id">{{ task.worker_id || '-' }}</td>
                <td class="truncate" :title="task.plan_id || task.error_message || task.task_id">
                  {{ task.plan_id || task.error_message || task.task_id }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>

    <div class="layout">
      <aside class="card plan-list">
        <h3>计划列表</h3>
        <p v-if="loading" class="muted">正在加载...</p>
        <button
          v-for="plan in plans"
          :key="plan.plan_id"
          class="plan-row"
          :class="{ active: selectedPlanId === plan.plan_id }"
          @click="selectPlan(plan.plan_id)"
        >
          <span>
            <strong>{{ plan.base_date }}</strong>
            <small>{{ plan.strategy_id }}</small>
          </span>
          <em>{{ plan.plan_type }} / {{ plan.status }}</em>
        </button>
        <p v-if="!loading && !plans.length" class="muted">暂无计划。</p>
      </aside>

      <main class="card detail">
        <template v-if="selectedDetail">
          <div class="detail-header">
            <div>
              <h3>{{ selectedDetail.plan.strategy_name || selectedDetail.plan.strategy_id }}</h3>
              <p class="muted">
                {{ selectedDetail.plan.base_date }} → {{ selectedDetail.plan.execute_date || '-' }}
                · {{ selectedDetail.plan.plan_type }} · {{ selectedDetail.plan.status }}
              </p>
            </div>
            <div v-if="selectedDetail.plan.status === 'needs_review'" class="actions">
              <button :disabled="actionLoading" @click="review('approved')">审核通过</button>
              <button class="danger" :disabled="actionLoading" @click="review('rejected')">驳回</button>
            </div>
          </div>

          <div class="metrics">
            <div><span>买入</span><strong>{{ selectedDetail.plan.summary?.buy_count ?? 0 }}</strong></div>
            <div><span>卖出</span><strong>{{ selectedDetail.plan.summary?.sell_count ?? 0 }}</strong></div>
            <div><span>持有</span><strong>{{ selectedDetail.plan.summary?.hold_count ?? 0 }}</strong></div>
            <div><span>跳过</span><strong>{{ selectedDetail.plan.summary?.skip_count ?? 0 }}</strong></div>
            <div><span>换手</span><strong>{{ pct(selectedDetail.plan.summary?.estimated_turnover) }}</strong></div>
            <div><span>权益</span><strong>{{ money(selectedDetail.plan.summary?.equity) }}</strong></div>
          </div>

          <label class="review-comment" v-if="selectedDetail.plan.status === 'needs_review'">
            审核备注
            <textarea v-model="reviewComment" rows="2" placeholder="记录审核意见或风险确认" />
          </label>

          <section v-if="selectedDetail.plan.status === 'approved' || selectedDetail.execution_status" class="execution-status">
            <h4>后台执行状态</h4>
            <p v-if="selectedDetail.plan.status === 'approved'" class="muted">
              已审核，等待后台在开盘价就绪后自动执行。
            </p>
            <div class="status-grid">
              <div>
                <span>execute_date</span>
                <strong>{{ executionStatus.execute_date || '-' }}</strong>
                <small v-if="executionStatus.uses_runtime_execute_date">
                  后台将按运行日期 {{ executionStatus.effective_execute_date || '-' }} 检查
                </small>
              </div>
              <div>
                <span>开盘价是否就绪</span>
                <strong>{{ executionStatus.open_price_ready ? '已就绪' : '未就绪' }}</strong>
                <small v-if="!executionStatus.open_price_ready">
                  缺失 {{ executionStatus.missing_open_price_count ?? 0 }} 个
                </small>
              </div>
              <div>
                <span>后台执行状态</span>
                <strong>{{ executionStatus.backend_execution_status || '-' }}</strong>
              </div>
              <div>
                <span>最近一次执行结果</span>
                <strong>{{ latestExecutionText }}</strong>
                <small v-if="executionStatus.execution_count">累计 {{ executionStatus.execution_count }} 条成交记录</small>
              </div>
            </div>
            <p v-if="executionStatus.missing_open_price_examples?.length" class="muted">
              缺失示例：{{ executionStatus.missing_open_price_examples.join(', ') }}
            </p>
          </section>

          <section>
            <h4>目标持仓与交易明细</h4>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>代码</th>
                    <th>名称</th>
                    <th>行业</th>
                    <th>动作</th>
                    <th>当前股数</th>
                    <th>目标股数</th>
                    <th>预估价</th>
                    <th>候选出现</th>
                    <th>风险</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in selectedDetail.items" :key="`${item.symbol}-${item.rank}`">
                    <td>{{ item.rank ?? '-' }}</td>
                    <td>{{ item.symbol }}</td>
                    <td>{{ item.name || '-' }}</td>
                    <td>{{ item.industry || '-' }}</td>
                    <td>{{ item.action }}</td>
                    <td>{{ item.current_shares ?? 0 }}</td>
                    <td>{{ item.target_shares ?? 0 }}</td>
                    <td>{{ num(item.estimated_price) }}</td>
                    <td>{{ item.candidate_appearances ?? 0 }}</td>
                    <td>{{ (item.blockers || []).join(', ') || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h4>Paper 净值</h4>
            <div v-if="realtimeEquity" class="realtime-equity">
              <div>
                <span>实时估算权益</span>
                <strong>{{ money(realtimeEquity.equity) }}</strong>
              </div>
              <div>
                <span>较最新落库净值</span>
                <strong>{{ signedMoney(realtimeEquity.change) }} / {{ signedPct(realtimeEquity.change_pct) }}</strong>
              </div>
              <div>
                <span>实时市值</span>
                <strong>{{ money(realtimeEquity.market_value) }}</strong>
              </div>
              <div>
                <span>现金</span>
                <strong>{{ money(realtimeEquity.cash) }}</strong>
              </div>
              <div>
                <span>更新时间</span>
                <strong>{{ realtimeEquity.latest_update || '-' }}</strong>
              </div>
            </div>
            <p v-if="!equityRows.length" class="muted">暂无 paper 净值。</p>
            <template v-else>
              <div class="equity-summary">
                <div>
                  <span>最新权益</span>
                  <strong>{{ money(equityRows[equityRows.length - 1]?.equity) }}</strong>
                </div>
                <div>
                  <span>累计收益</span>
                  <strong>{{ signedPct(equityChart.latestReturn) }}</strong>
                </div>
                <div>
                  <span>最近变化</span>
                  <strong>{{ signedMoney(equityRows[equityRows.length - 1]?.change) }}</strong>
                </div>
              </div>
              <div class="equity-chart" aria-label="Paper equity curve">
                <svg viewBox="0 0 640 220" role="img">
                  <line x1="28" y1="28" x2="28" y2="192" />
                  <line x1="28" y1="192" x2="612" y2="192" />
                  <polyline :points="equityChart.points" />
                  <circle
                    v-for="point in equityChart.points.split(' ')"
                    :key="point"
                    :cx="point.split(',')[0]"
                    :cy="point.split(',')[1]"
                    r="3"
                  />
                  <text x="36" y="22">{{ money(equityChart.max) }}</text>
                  <text x="36" y="186">{{ money(equityChart.min) }}</text>
                  <text
                    v-for="label in equityChart.labels"
                    :key="label.text"
                    :x="label.x"
                    :y="label.y"
                    :text-anchor="label.anchor"
                  >
                    {{ label.text }}
                  </text>
                </svg>
              </div>
              <div class="table-wrap compact">
                <table>
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>权益</th>
                      <th>日变化</th>
                      <th>日变化率</th>
                      <th>现金</th>
                      <th>市值</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="point in equityRows.slice().reverse()" :key="point.date">
                      <td>{{ point.date }}</td>
                      <td>{{ money(point.equity) }}</td>
                      <td>{{ signedMoney(point.change) }}</td>
                      <td>{{ signedPct(point.changePct) }}</td>
                      <td>{{ money(point.cash) }}</td>
                      <td>{{ money(point.market_value) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
          </section>

          <section>
            <h4>Paper 成交</h4>
            <p v-if="!executions.length" class="muted">暂无 paper 成交。</p>
            <div v-else class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th class="col-date">日期</th>
                    <th class="col-symbol">代码</th>
                    <th class="col-name">名称</th>
                    <th>动作</th>
                    <th>数量</th>
                    <th>买入价格</th>
                    <th>当前价格</th>
                    <th>涨跌幅</th>
                    <th>金额</th>
                    <th>阻塞原因</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="execution in executions" :key="execution.execution_id">
                    <td class="col-date">{{ execution.execute_date || '-' }}</td>
                    <td class="col-symbol">{{ execution.symbol || '-' }}</td>
                    <td class="col-name">{{ execution.name || '-' }}</td>
                    <td>{{ execution.action || '-' }}</td>
                    <td>{{ execution.quantity ?? 0 }}</td>
                    <td>{{ num(execution.price) }}</td>
                    <td>{{ num(currentPriceForExecution(execution)) }}</td>
                    <td>{{ executionReturnPct(execution) }}</td>
                    <td>{{ money(execution.amount) }}</td>
                    <td>{{ execution.blocker || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
        <p v-else class="muted">请选择一份计划。</p>
      </main>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  approvePortfolioPlan,
  generatePortfolioPlan,
  getPortfolioPlan,
  getPortfolioPlanExecutions,
  getPortfolioPlanGenerationTask,
  getPortfolioPlanGenerationWatermark,
  getPortfolioStrategyEquity,
  getPortfolioStrategyRealtimeEquity,
  listPortfolioPlanGenerationTasks,
  listPortfolioPlans,
  listPortfolioStrategies,
  listPortfolioWorkerStatus,
  rejectPortfolioPlan,
} from '../api/portfolioPlans'

const strategies = ref([])
const plans = ref([])
const selectedStrategyId = ref('')
const statusFilter = ref('')
const selectedPlanId = ref('')
const selectedDetail = ref(null)
const equity = ref([])
const realtimeEquity = ref(null)
const executions = ref([])
const loading = ref(false)
const actionLoading = ref(false)
const generateLoading = ref(false)
const tasksLoading = ref(false)
const watermarkLoading = ref(false)
const workerStatusLoading = ref(false)
const currentGenerationTask = ref(null)
const generationTasks = ref([])
const generationTasksExpanded = ref(false)
const planGenerationWatermark = ref(null)
const workerStatuses = ref([])
const message = ref('')
const reviewComment = ref('')
let realtimeTimer = null
let generationTaskTimer = null

const generateForm = ref({
  strategy_id: '',
  base_date: todayInputDate(),
  mode: 'auto',
  force: false,
})

const executionStatus = computed(() => selectedDetail.value?.execution_status || {})

const latestExecutionText = computed(() => {
  const latest = executionStatus.value.latest_execution_result
  if (!latest) return '暂无'
  const action = latest.action || 'unknown'
  const symbol = latest.symbol || '-'
  const quantity = latest.quantity ?? 0
  const blocker = latest.blocker ? ` / ${latest.blocker}` : ''
  return `${latest.execute_date || '-'} ${action} ${symbol} ${quantity}${blocker}`
})

const realtimePriceBySymbol = computed(() => {
  const rows = realtimeEquity.value?.positions || []
  return Object.fromEntries(rows.map((row) => [row.symbol, row.realtime_price]))
})

const availableStrategies = computed(() => strategies.value.filter((strategy) => strategy.status !== 'disabled'))

const latestGenerationTask = computed(() => generationTasks.value[0] || null)

const targetScoringRunText = computed(() => scoringRunText(planGenerationWatermark.value?.target_scoring_run))
const latestCompletedScoringText = computed(() => scoringRunText(planGenerationWatermark.value?.latest_completed_scoring_run))
const latestScoringRunText = computed(() => scoringRunText(planGenerationWatermark.value?.latest_scoring_run))
const latestAvailableScoreText = computed(() => {
  const watermark = planGenerationWatermark.value
  if (!watermark?.latest_available_score_date) return '暂无记录'
  return `${watermark.latest_available_score_date} / ${watermark.latest_available_score_count ?? 0} 条`
})
const latestAvailableScoreMeta = computed(() => {
  const scope = planGenerationWatermark.value?.latest_available_score_scope
  if (scope === 'index_codes') return '按当前 universe 匹配'
  if (scope === 'global') return '全局最新 fallback'
  return '-'
})

const equityRows = computed(() => {
  return [...equity.value]
    .filter((point) => Number.isFinite(Number(point.equity)))
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    .map((point, index, rows) => {
      const value = Number(point.equity)
      const previous = index > 0 ? Number(rows[index - 1].equity) : NaN
      const change = Number.isFinite(previous) ? value - previous : null
      const changePct = Number.isFinite(previous) && previous !== 0 ? change / previous : null
      return { ...point, equity: value, change, changePct }
    })
})

const equityChart = computed(() => {
  const rows = equityRows.value
  if (!rows.length) return { points: '', labels: [], min: 0, max: 0, latestReturn: null }
  const values = rows.map((row) => row.equity)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const width = 640
  const height = 220
  const pad = 28
  const points = rows
    .map((row, index) => {
      const x = rows.length === 1 ? width / 2 : pad + (index * (width - pad * 2)) / (rows.length - 1)
      const y = height - pad - ((row.equity - min) * (height - pad * 2)) / span
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const first = rows[0].equity
  const latest = rows[rows.length - 1].equity
  return {
    points,
    min,
    max,
    latestReturn: first ? latest / first - 1 : null,
    labels: [
      { text: rows[0].date, x: pad, y: height - 6, anchor: 'start' },
      { text: rows[rows.length - 1].date, x: width - pad, y: height - 6, anchor: 'end' },
    ],
  }
})

function pct(value) {
  const number = Number(value)
  return Number.isFinite(number) ? `${(number * 100).toFixed(2)}%` : '-'
}

function money(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) : '-'
}

function num(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : '-'
}

function signedMoney(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  const formatted = Math.abs(number).toLocaleString('zh-CN', { maximumFractionDigits: 0 })
  return `${number >= 0 ? '+' : '-'}${formatted}`
}

function signedPct(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return `${number >= 0 ? '+' : ''}${(number * 100).toFixed(2)}%`
}

function currentPriceForExecution(execution) {
  return realtimePriceBySymbol.value[execution?.symbol]
}

function executionReturnPct(execution) {
  const entry = Number(execution?.price)
  const current = Number(currentPriceForExecution(execution))
  if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(current)) return '-'
  return signedPct(current / entry - 1)
}

function todayInputDate() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function scoringRunText(run) {
  if (!run) return '暂无记录'
  const scoreDate = run.score_date || '-'
  const status = run.status || 'unknown'
  return `${scoreDate} / ${status}`
}

async function refreshAll() {
  await loadStrategies()
  if (!generateForm.value.strategy_id && availableStrategies.value.length) {
    generateForm.value.strategy_id = availableStrategies.value[0].strategy_id
  }
  await loadPlanGenerationWatermark()
  await loadWorkerStatus()
  await loadGenerationTasks()
  await loadPlans()
}

async function loadStrategies() {
  const res = await listPortfolioStrategies()
  strategies.value = res.data || []
}

async function loadPlans() {
  loading.value = true
  message.value = ''
  try {
    const params = {}
    if (selectedStrategyId.value) params.strategy_id = selectedStrategyId.value
    if (statusFilter.value) params.status = statusFilter.value
    const res = await listPortfolioPlans(params)
    plans.value = res.data || []
    if (plans.value.length && !plans.value.some((plan) => plan.plan_id === selectedPlanId.value)) {
      await selectPlan(plans.value[0].plan_id)
    }
  } catch (error) {
    message.value = error.response?.data?.detail || error.message || '加载计划失败'
  } finally {
    loading.value = false
  }
}

async function loadGenerationTasks() {
  tasksLoading.value = true
  try {
    const res = await listPortfolioPlanGenerationTasks({ limit: 20 })
    generationTasks.value = res.data || []
  } catch (error) {
    message.value = error.response?.data?.detail || error.message || '加载生成任务失败'
  } finally {
    tasksLoading.value = false
  }
}

async function loadWorkerStatus() {
  workerStatusLoading.value = true
  try {
    const res = await listPortfolioWorkerStatus({ worker_type: 'portfolio_plan_generator', limit: 20 })
    workerStatuses.value = res.data || []
  } catch (error) {
    message.value = error.response?.data?.detail || error.message || '加载 worker 状态失败'
  } finally {
    workerStatusLoading.value = false
  }
}

async function loadPlanGenerationWatermark() {
  if (!generateForm.value.strategy_id) {
    planGenerationWatermark.value = null
    return
  }
  watermarkLoading.value = true
  try {
    const res = await getPortfolioPlanGenerationWatermark({
      strategy_id: generateForm.value.strategy_id,
      base_date: generateForm.value.base_date,
    })
    planGenerationWatermark.value = res.data || null
  } catch (error) {
    message.value = error.response?.data?.detail || error.message || '加载数据水位失败'
  } finally {
    watermarkLoading.value = false
  }
}

async function generatePlan() {
  if (!generateForm.value.strategy_id || !generateForm.value.base_date) return
  generateLoading.value = true
  message.value = ''
  try {
    const payload = {
      strategy_id: generateForm.value.strategy_id,
      base_date: generateForm.value.base_date,
      mode: generateForm.value.mode,
      force: generateForm.value.force,
    }
    const res = await generatePortfolioPlan(payload)
    currentGenerationTask.value = res.data
    await loadPlanGenerationWatermark()
    await loadGenerationTasks()
    selectedStrategyId.value = generateForm.value.strategy_id
    statusFilter.value = ''
    message.value = `已提交生成任务 ${res.data?.task_id || ''}`
    startGenerationTaskPolling(res.data?.task_id)
  } catch (error) {
    message.value = error.response?.data?.detail || error.message || '生成计划失败'
  } finally {
    generateLoading.value = false
  }
}

function startGenerationTaskPolling(taskId) {
  if (!taskId) return
  if (generationTaskTimer) window.clearInterval(generationTaskTimer)
  pollGenerationTask(taskId)
  generationTaskTimer = window.setInterval(() => pollGenerationTask(taskId), 3000)
}

async function pollGenerationTask(taskId) {
  try {
    const res = await getPortfolioPlanGenerationTask(taskId)
    currentGenerationTask.value = res.data
    if (['completed', 'failed'].includes(res.data?.status)) {
      if (generationTaskTimer) {
        window.clearInterval(generationTaskTimer)
        generationTaskTimer = null
      }
      await loadPlanGenerationWatermark()
      await loadWorkerStatus()
      await loadGenerationTasks()
      await loadPlans()
      if (res.data.status === 'completed' && res.data.plan_id) {
        await selectPlan(res.data.plan_id)
        message.value = `已生成计划 ${res.data.plan_id}`
      } else if (res.data.status === 'failed') {
        message.value = res.data.error_message || '生成计划失败'
      }
    }
  } catch (error) {
    message.value = error.response?.data?.detail || error.message || '查询生成任务失败'
  }
}

async function selectPlan(planId) {
  selectedPlanId.value = planId
  reviewComment.value = ''
  const res = await getPortfolioPlan(planId)
  selectedDetail.value = res.data
  await loadEquity()
  await loadRealtimeEquity()
  await loadExecutions()
}

async function loadEquity() {
  const strategyId = selectedDetail.value?.plan?.strategy_id
  if (!strategyId) {
    equity.value = []
    return
  }
  const res = await getPortfolioStrategyEquity(strategyId)
  equity.value = res.data || []
}

async function loadRealtimeEquity() {
  const strategyId = selectedDetail.value?.plan?.strategy_id
  if (!strategyId) {
    realtimeEquity.value = null
    return
  }
  const res = await getPortfolioStrategyRealtimeEquity(strategyId)
  realtimeEquity.value = res.data || null
}

async function loadExecutions() {
  if (!selectedPlanId.value) {
    executions.value = []
    return
  }
  const res = await getPortfolioPlanExecutions(selectedPlanId.value)
  executions.value = res.data || []
}

async function review(decision) {
  if (!selectedPlanId.value) return
  actionLoading.value = true
  try {
    const payload = { comment: reviewComment.value }
    if (decision === 'approved') {
      await approvePortfolioPlan(selectedPlanId.value, payload)
    } else {
      await rejectPortfolioPlan(selectedPlanId.value, payload)
    }
    await selectPlan(selectedPlanId.value)
    await loadPlans()
  } finally {
    actionLoading.value = false
  }
}

onMounted(() => {
  refreshAll()
  realtimeTimer = window.setInterval(() => {
    if (selectedDetail.value?.plan?.strategy_id) {
      loadRealtimeEquity()
    }
  }, 60000)
})

onUnmounted(() => {
  if (realtimeTimer) window.clearInterval(realtimeTimer)
  if (generationTaskTimer) window.clearInterval(generationTaskTimer)
})
</script>

<style scoped>
.portfolio-plans {
  background: #fff;
  box-sizing: border-box;
  color: #111827;
  display: flex;
  flex-direction: column;
  gap: 16px;
  line-height: 1.5;
  margin: 0 auto;
  max-width: 1440px;
  padding: 24px;
  width: 100%;
}

.page-header,
.toolbar,
.detail-header,
.metrics,
.layout {
  display: flex;
  gap: 12px;
}

.page-header,
.detail-header {
  align-items: center;
  justify-content: space-between;
}

.eyebrow,
.muted {
  color: #374151;
  font-size: 13px;
}

.subtitle {
  color: #111827;
  margin-top: 4px;
}

h2,
h3,
h4,
p {
  margin: 0;
}

button,
input,
select,
textarea {
  background: #fff;
  border: 1px solid #111827;
  border-radius: 4px;
  color: #111827;
  padding: 8px 10px;
}

button {
  background: #fff;
  color: #111827;
  cursor: pointer;
}

button:disabled {
  color: #6b7280;
  cursor: not-allowed;
}

button.danger {
  border-color: #111827;
  color: #111827;
}

.card {
  background: #fff;
  border: 1px solid #111827;
  border-radius: 4px;
  color: #111827;
  padding: 14px;
}

.generate-card {
  align-items: end;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(220px, 1fr) minmax(220px, 1.2fr) minmax(160px, 0.7fr) minmax(140px, 0.6fr) auto auto;
}

.generate-card label,
.toolbar label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.generate-card .inline-check {
  align-items: center;
  flex-direction: row;
  gap: 6px;
  padding-bottom: 8px;
}

.task-status {
  grid-column: 1 / -1;
}

.task-list-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-list-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.task-list-actions {
  display: flex;
  gap: 8px;
}

.generation-task-table tbody tr {
  cursor: pointer;
}

.generation-task-table tbody tr.active {
  background: #f3f4f6;
}

.truncate {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.worker-status-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.watermark-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.watermark-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.watermark-grid div {
  border: 1px solid #111827;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
}

.watermark-grid span,
.watermark-grid small {
  color: #374151;
}

.watermark-warning {
  background: #f3f4f6;
  border: 1px solid #111827;
  border-radius: 4px;
  padding: 10px;
}

.worker-status-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.worker-status-row {
  border: 1px solid #111827;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
}

.worker-status-row span,
.worker-status-row small {
  color: #374151;
  overflow-wrap: anywhere;
}

.plan-list {
  flex: 0 0 340px;
}

.detail {
  flex: 1;
  overflow: hidden;
}

.plan-row {
  background: #fff;
  border: 1px solid #111827;
  color: #111827;
  display: block;
  margin-top: 8px;
  text-align: left;
  width: 100%;
}

.plan-row.active {
  background: #f3f4f6;
  border-color: #111827;
}

.plan-row span,
.plan-row small,
.plan-row em {
  display: block;
}

.plan-row small,
.plan-row em {
  color: #111827;
  font-style: normal;
}

.metrics {
  flex-wrap: wrap;
  margin: 14px 0;
}

.metrics div {
  background: #fff;
  border: 1px solid #111827;
  border-radius: 4px;
  color: #111827;
  padding: 10px 12px;
}

.metrics span {
  color: #111827;
  display: block;
  font-size: 12px;
}

.execution-status {
  margin-bottom: 14px;
}

.status-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin-top: 8px;
}

.status-grid div {
  border: 1px solid #111827;
  border-radius: 4px;
  min-width: 0;
  overflow-wrap: anywhere;
  padding: 8px 10px;
  word-break: break-word;
}

.status-grid span,
.status-grid small {
  display: block;
  font-size: 12px;
  line-height: 1.4;
}

.status-grid strong {
  display: block;
  line-height: 1.4;
  white-space: normal;
}

.message {
  color: #111827;
}

.review-comment {
  display: block;
  margin-bottom: 14px;
}

.review-comment textarea {
  display: block;
  margin-top: 6px;
  width: 100%;
}

.table-wrap {
  overflow: auto;
}

table {
  border-collapse: collapse;
  font-size: 13px;
  min-width: 980px;
  width: 100%;
}

th,
td {
  border: 1px solid #111827;
  color: #111827;
  padding: 8px 10px;
  text-align: left;
  white-space: nowrap;
}

th {
  background: #f3f4f6;
  color: #111827;
  font-weight: 700;
}

.col-date {
  max-width: 86px;
  width: 86px;
}

.col-symbol {
  max-width: 92px;
  width: 92px;
}

.col-name {
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 90px;
}

.equity-summary,
.realtime-equity {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.equity-summary div,
.realtime-equity div {
  background: #fff;
  border: 1px solid #111827;
  border-radius: 4px;
  color: #111827;
  padding: 8px 10px;
}

.equity-summary span,
.realtime-equity span {
  display: block;
  font-size: 12px;
}

.equity-chart {
  border: 1px solid #111827;
  margin-bottom: 10px;
  overflow: hidden;
}

.equity-chart svg {
  background: #fff;
  display: block;
  height: 260px;
  width: 100%;
}

.equity-chart line {
  stroke: #111827;
  stroke-width: 1;
}

.equity-chart polyline {
  fill: none;
  stroke: #111827;
  stroke-width: 3;
}

.equity-chart circle {
  fill: #111827;
}

.equity-chart text {
  fill: #111827;
  font-size: 12px;
}

.table-wrap.compact table {
  min-width: 720px;
}

@media (max-width: 768px) {
  .portfolio-plans {
    padding: 12px;
  }
}
</style>
