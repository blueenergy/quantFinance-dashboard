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

    <p v-if="message" class="message">{{ message }}</p>

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
            <div v-else-if="selectedDetail.plan.status === 'approved'" class="actions">
              <button :disabled="actionLoading" @click="executePaper">执行 Paper</button>
            </div>
          </div>

          <div class="metrics">
            <div><span>买入</span><strong>{{ selectedDetail.plan.summary?.buy_count ?? 0 }}</strong></div>
            <div><span>卖出</span><strong>{{ selectedDetail.plan.summary?.sell_count ?? 0 }}</strong></div>
            <div><span>持有</span><strong>{{ selectedDetail.plan.summary?.hold_count ?? 0 }}</strong></div>
            <div><span>换手</span><strong>{{ pct(selectedDetail.plan.summary?.estimated_turnover) }}</strong></div>
            <div><span>权益</span><strong>{{ money(selectedDetail.plan.summary?.equity) }}</strong></div>
          </div>

          <label class="review-comment" v-if="selectedDetail.plan.status === 'needs_review'">
            审核备注
            <textarea v-model="reviewComment" rows="2" placeholder="记录审核意见或风险确认" />
          </label>

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
            <p v-if="!equity.length" class="muted">暂无 paper 净值。</p>
            <div v-else class="equity-list">
              <span v-for="point in equity.slice(-8)" :key="point.date">
                {{ point.date }}: {{ money(point.equity) }}
              </span>
            </div>
          </section>

          <section>
            <h4>Paper 成交</h4>
            <p v-if="!executions.length" class="muted">暂无 paper 成交。</p>
            <div v-else class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>代码</th>
                    <th>动作</th>
                    <th>数量</th>
                    <th>价格</th>
                    <th>金额</th>
                    <th>阻塞原因</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="execution in executions" :key="execution.execution_id">
                    <td>{{ execution.execute_date || '-' }}</td>
                    <td>{{ execution.symbol || '-' }}</td>
                    <td>{{ execution.action || '-' }}</td>
                    <td>{{ execution.quantity ?? 0 }}</td>
                    <td>{{ num(execution.price) }}</td>
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
import { onMounted, ref } from 'vue'
import {
  approvePortfolioPlan,
  executePortfolioPlanPaper,
  getPortfolioPlan,
  getPortfolioPlanExecutions,
  getPortfolioStrategyEquity,
  listPortfolioPlans,
  listPortfolioStrategies,
  rejectPortfolioPlan,
} from '../api/portfolioPlans'

const strategies = ref([])
const plans = ref([])
const selectedStrategyId = ref('')
const statusFilter = ref('')
const selectedPlanId = ref('')
const selectedDetail = ref(null)
const equity = ref([])
const executions = ref([])
const loading = ref(false)
const actionLoading = ref(false)
const message = ref('')
const reviewComment = ref('')

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

async function refreshAll() {
  await loadStrategies()
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

async function selectPlan(planId) {
  selectedPlanId.value = planId
  reviewComment.value = ''
  const res = await getPortfolioPlan(planId)
  selectedDetail.value = res.data
  await loadEquity()
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

async function executePaper() {
  if (!selectedPlanId.value) return
  actionLoading.value = true
  try {
    await executePortfolioPlanPaper(selectedPlanId.value)
    await selectPlan(selectedPlanId.value)
    await loadPlans()
  } catch (error) {
    message.value = error.response?.data?.detail || error.message || '执行 paper 失败'
  } finally {
    actionLoading.value = false
  }
}

onMounted(refreshAll)
</script>

<style scoped>
.portfolio-plans {
  background: #fff;
  color: #111827;
  display: flex;
  flex-direction: column;
  gap: 16px;
  line-height: 1.5;
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

.equity-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.equity-list span {
  background: #fff;
  border: 1px solid #111827;
  border-radius: 4px;
  color: #111827;
  padding: 6px 8px;
}
</style>
