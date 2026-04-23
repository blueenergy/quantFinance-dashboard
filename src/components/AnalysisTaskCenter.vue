<template>
  <div class="task-center">
    <div class="header-row">
      <h3>🔬 AI分析回溯中心</h3>
      <div class="header-hint">点击「查看」跳转到对应分析页面</div>
      <button class="btn" :disabled="loading" @click="refreshList">
        {{ loading ? '刷新中...' : '刷新' }}
      </button>
    </div>

    <div class="filters">
      <select v-model="filters.status" @change="refreshList">
        <option value="">全部状态</option>
        <option value="pending">排队中</option>
        <option value="processing">处理中</option>
        <option value="completed">已完成</option>
        <option value="completed_with_parse_error">已完成(解析警告)</option>
        <option value="failed">失败</option>
      </select>
      <select v-model="filters.type" @change="refreshList">
        <option value="">常用类型（不含全球/大盘）</option>
        <option value="__all_with_market_global__">全部类型（含全球/大盘）</option>
        <option value="deep_analysis">🔬 深度分析</option>
        <option value="portfolio_analysis">💼 组合分析</option>
        <option value="etf_analysis">💰 ETF分析</option>
        <option value="hot_stock_analysis">热股分析</option>
        <option value="sector_concept_analysis">板块分析</option>
        <option value="global_analysis">全球分析</option>
        <option value="market_analysis">大盘分析</option>
        <option value="earnings_hunter">财报猎手</option>
        <option value="limit_up_feedback">涨停反馈</option>
        <option value="broken_limit_up_feedback">炸板反馈</option>
      </select>
      <input v-model.trim="filters.symbol" placeholder="按股票代码筛选" @keyup.enter="refreshList" />
      <button class="btn btn-secondary" @click="refreshList">查询</button>
    </div>

    <div v-if="error" class="error-box">{{ error }}</div>

    <div v-if="tasks.length === 0 && !loading" class="empty">暂无任务</div>

    <div class="task-list">
      <div v-for="task in tasks" :key="task.taskId" class="task-item">
        <div class="row">
          <div class="left">
            <span class="type-icon">{{ typeIcon(task.taskType) }}</span>
            <span class="symbol">{{ task.symbol || '—' }}</span>
            <span v-if="task.stockName" class="stock-name">{{ task.stockName }}</span>
            <span class="chip">{{ typeLabel(task.taskType) }}</span>
          </div>
          <div class="right-actions">
            <span class="status" :class="`status-${task.status}`">{{ statusLabel(task.status) }}</span>
            <button
              v-if="isSupported(task.taskType)"
              class="btn btn-view"
              :disabled="!['completed', 'completed_with_parse_error'].includes(task.status)"
              title="跳转到对应分析页面查看"
              @click="handleView(task)"
            >查看</button>
            <span
              v-else
              class="btn-view-disabled"
              title="该类型暂不支持从回溯中心直接跳转"
            >查看</span>
          </div>
        </div>
        <div class="summary">{{ task.summary || '暂无摘要' }}</div>
        <div class="meta">
          <span>创建: {{ formatTime(task.createdAt) }}</span>
          <span v-if="task.completedAt">完成: {{ formatTime(task.completedAt) }}</span>
          <span v-if="task.dataDate">数据日期: {{ task.dataDate }}</span>
        </div>
        <div v-if="task.error" class="task-error">错误: {{ task.error }}</div>
      </div>
    </div>

    <div v-if="hasMore" class="more-row">
      <button class="btn btn-secondary" :disabled="loading" @click="loadMore">加载更多</button>
    </div>

  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { useAnalysisTasks } from '../composables/useAnalysisTasks'
import { statusLabel } from '../adapters/analysisTaskAdapter'

const emit = defineEmits(['open-task'])

const {
  loading,
  error,
  tasks,
  page,
  hasMore,
  filters,
  loadTasks,
  startPolling,
  stopPolling,
} = useAnalysisTasks()

// Types with direct jump support in Phase 1
const SUPPORTED_TYPES = ['deep_analysis', 'portfolio_analysis', 'etf_analysis']

const TYPE_ICONS = {
  deep_analysis: '🔬',
  portfolio_analysis: '💼',
  etf_analysis: '💰',
}

const TYPE_LABELS = {
  deep_analysis: '深度分析',
  portfolio_analysis: '组合分析',
  etf_analysis: 'ETF分析',
  hot_stock_analysis: '热股分析',
  sector_concept_analysis: '板块分析',
  market_analysis: '大盘分析',
  global_analysis: '全球分析',
  earnings_hunter: '财报猎手',
  limit_up_feedback: '涨停反馈',
  broken_limit_up_feedback: '炸板反馈',
}

function typeIcon(type) {
  return TYPE_ICONS[type] || '📋'
}

function typeLabel(type) {
  return TYPE_LABELS[type] || type
}

function isSupported(type) {
  return SUPPORTED_TYPES.includes(type)
}

function formatTime(timeStr) {
  if (!timeStr) return '-'
  return new Date(timeStr).toLocaleString('zh-CN')
}

async function refreshList() {
  await loadTasks({ reset: true })
}

async function loadMore() {
  page.value += 1
  await loadTasks({ reset: false })
}

function handleView(task) {
  emit('open-task', {
    type: task.taskType,
    taskId: task.taskId,
    symbol: task.symbol || '',
  })
}

onMounted(async () => {
  await refreshList()
  startPolling()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<style scoped>
.task-center { background: #fff; padding: 18px; border-radius: 12px; border: 1px solid #e7e7e7; }
.header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 10px; flex-wrap: wrap; }
.header-row h3 { margin: 0; }
.header-hint { font-size: 12px; color: #888; flex: 1; }
.filters { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.filters input, .filters select { padding: 8px; border: 1px solid #ddd; border-radius: 6px; }
.btn { background: #5b56f0; color: #fff; border: none; border-radius: 6px; padding: 8px 12px; cursor: pointer; font-size: 13px; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary { background: #747474; }
.btn-view { background: #5b56f0; color: #fff; border: none; border-radius: 6px; padding: 4px 12px; cursor: pointer; font-size: 12px; }
.btn-view:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-view-disabled { display: inline-block; background: #e0e0e0; color: #aaa; border-radius: 6px; padding: 4px 12px; font-size: 12px; cursor: not-allowed; }
.error-box { padding: 10px; border-radius: 8px; background: #ffe8e8; color: #8d1010; margin-bottom: 10px; }
.empty { color: #888; padding: 16px 0; }
.task-list { display: flex; flex-direction: column; gap: 10px; }
.task-item { border: 1px solid #ececec; border-radius: 8px; padding: 12px; }
.row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.left { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.right-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
.type-icon { font-size: 16px; }
.symbol { font-weight: 700; }
.stock-name { color: #666; font-size: 13px; }
.chip { background: #f2f2f2; border-radius: 10px; padding: 2px 8px; font-size: 12px; }
.status { border-radius: 10px; padding: 2px 8px; font-size: 12px; white-space: nowrap; }
.status-pending { background: #f0f2ff; color: #3943d6; }
.status-processing { background: #eef8ff; color: #0d75bd; }
.status-completed { background: #ebfff0; color: #1d8c3d; }
.status-completed_with_parse_error { background: #fff8e1; color: #b7650d; }
.status-failed { background: #ffecec; color: #c53030; }
.summary { margin-top: 8px; color: #333; font-size: 13px; }
.meta { margin-top: 8px; display: flex; gap: 14px; color: #888; font-size: 12px; flex-wrap: wrap; }
.task-error { margin-top: 6px; color: #c53030; font-size: 12px; }
.more-row { margin-top: 12px; text-align: center; }
</style>