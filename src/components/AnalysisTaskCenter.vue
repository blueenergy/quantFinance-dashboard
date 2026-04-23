<template>
  <div class="task-center">
    <div class="header-row">
      <h3>AI分析回溯中心</h3>
      <button class="btn" :disabled="loading" @click="refreshList">
        {{ loading ? '刷新中...' : '刷新' }}
      </button>
    </div>

    <div class="filters">
      <select v-model="filters.status" @change="refreshList">
        <option value="">全部状态</option>
        <option value="pending">pending</option>
        <option value="processing">processing</option>
        <option value="completed">completed</option>
        <option value="completed_with_parse_error">completed_with_parse_error</option>
        <option value="failed">failed</option>
      </select>
      <select v-model="filters.type" @change="refreshList">
        <option value="">常用类型（不含全球/大盘）</option>
        <option value="__all_with_market_global__">全部类型（含全球/大盘）</option>
        <option value="deep_analysis">深度分析</option>
        <option value="portfolio_analysis">组合分析</option>
        <option value="hot_stock_analysis">热股分析</option>
        <option value="sector_concept_analysis">板块分析</option>
        <option value="etf_analysis">ETF分析</option>
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
      <div v-for="task in tasks" :key="task.taskId" class="task-item" @click="openTask(task.taskId)">
        <div class="row">
          <div class="left">
            <span class="symbol">{{ task.symbol }}</span>
            <span v-if="task.stockName" class="stock-name">{{ task.stockName }}</span>
            <span class="chip">{{ task.taskType }}</span>
          </div>
          <span class="status" :class="`status-${task.status}`">{{ statusLabel(task.status) }}</span>
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

    <div v-if="selectedTask" class="modal-overlay" @click="closeDetail">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <div>
            <h4>{{ selectedTask.symbol || '-' }} · {{ selectedTask.taskType }}</h4>
            <p class="muted">
              状态: {{ statusLabel(selectedTask.status) }}
              <span v-if="selectedTask.dataDate"> · 数据日期: {{ selectedTask.dataDate }}</span>
            </p>
          </div>
          <button class="btn btn-secondary" @click="closeDetail">关闭</button>
        </div>

        <div class="modal-block">
          <h5>基础结果（analysis_tasks.result）</h5>
          <pre>{{ pretty(selectedTask.baseResult) }}</pre>
        </div>

        <div class="modal-block" v-if="selectedResolved?.extra_result">
          <h5>补全结果（业务集合聚合）</h5>
          <p v-if="selectedResolved.data_date" class="muted">按数据日期对齐: {{ selectedResolved.data_date }}</p>
          <pre>{{ pretty(selectedResolved.extra_result) }}</pre>
        </div>

        <div class="modal-block">
          <h5>版本时间线</h5>
          <div v-if="revisions.length === 0" class="muted">暂无版本记录</div>
          <ul v-else class="revisions">
            <li v-for="rev in revisions" :key="rev.id">
              <span>#{{ rev.revision_no }}</span>
              <span>{{ rev.status }}</span>
              <span>{{ formatTime(rev.created_at) }}</span>
              <span v-if="rev.feedback">反馈: {{ rev.feedback }}</span>
            </li>
          </ul>
        </div>

        <div class="modal-block">
          <h5>反馈重跑</h5>
          <textarea
            v-model.trim="feedbackText"
            rows="4"
            placeholder="请输入你的改进意见，系统将基于反馈重新分析"
          />
          <div class="action-row">
            <button class="btn" :disabled="feedbackSubmitting || !feedbackText" @click="submitFeedbackAndRerun">
              {{ feedbackSubmitting ? '提交中...' : '提交反馈并重跑' }}
            </button>
            <span v-if="feedbackResult" class="feedback-ok">{{ feedbackResult }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useAnalysisTasks } from '../composables/useAnalysisTasks'
import { statusLabel } from '../adapters/analysisTaskAdapter'

const {
  loading,
  error,
  tasks,
  page,
  hasMore,
  filters,
  selectedTask,
  selectedResolved,
  revisions,
  loadTasks,
  loadTaskDetail,
  submitFeedback,
  startPolling,
  stopPolling,
  resetDetail
} = useAnalysisTasks()

const feedbackText = ref('')
const feedbackSubmitting = ref(false)
const feedbackResult = ref('')

function formatTime(timeStr) {
  if (!timeStr) return '-'
  return new Date(timeStr).toLocaleString('zh-CN')
}

function pretty(value) {
  if (!value) return '暂无'
  return JSON.stringify(value, null, 2)
}

async function refreshList() {
  await loadTasks({ reset: true })
}

async function loadMore() {
  page.value += 1
  await loadTasks({ reset: false })
}

async function openTask(taskId) {
  feedbackText.value = ''
  feedbackResult.value = ''
  await loadTaskDetail(taskId)
}

function closeDetail() {
  resetDetail()
  feedbackText.value = ''
  feedbackResult.value = ''
}

async function submitFeedbackAndRerun() {
  if (!selectedTask.value?.taskId || !feedbackText.value) return
  feedbackSubmitting.value = true
  feedbackResult.value = ''
  try {
    const resp = await submitFeedback(selectedTask.value.taskId, feedbackText.value)
    feedbackResult.value = `已创建新任务: ${resp?.new_task_id || ''}`
    await refreshList()
    if (selectedTask.value?.taskId) {
      await loadTaskDetail(selectedTask.value.taskId)
    }
  } finally {
    feedbackSubmitting.value = false
  }
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
.header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.header-row h3 { margin: 0; }
.filters { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.filters input, .filters select { padding: 8px; border: 1px solid #ddd; border-radius: 6px; }
.btn { background: #5b56f0; color: #fff; border: none; border-radius: 6px; padding: 8px 12px; cursor: pointer; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary { background: #747474; }
.error-box { padding: 10px; border-radius: 8px; background: #ffe8e8; color: #8d1010; margin-bottom: 10px; }
.empty { color: #888; padding: 16px 0; }
.task-list { display: flex; flex-direction: column; gap: 10px; }
.task-item { border: 1px solid #ececec; border-radius: 8px; padding: 12px; cursor: pointer; }
.task-item:hover { border-color: #c8c7ff; }
.row { display: flex; justify-content: space-between; align-items: center; }
.left { display: flex; gap: 8px; align-items: center; }
.symbol { font-weight: 700; }
.stock-name { color: #666; font-size: 13px; }
.chip { background: #f2f2f2; border-radius: 10px; padding: 2px 8px; font-size: 12px; }
.status { border-radius: 10px; padding: 2px 8px; font-size: 12px; }
.status-pending { background: #f0f2ff; color: #3943d6; }
.status-processing { background: #eef8ff; color: #0d75bd; }
.status-completed { background: #ebfff0; color: #1d8c3d; }
.status-failed { background: #ffecec; color: #c53030; }
.summary { margin-top: 8px; color: #333; font-size: 13px; }
.meta { margin-top: 8px; display: flex; gap: 14px; color: #888; font-size: 12px; }
.task-error { margin-top: 6px; color: #c53030; font-size: 12px; }
.more-row { margin-top: 12px; text-align: center; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.42); display: flex; justify-content: center; align-items: center; z-index: 30; }
.modal-content { width: min(960px, 92vw); max-height: 88vh; overflow-y: auto; background: #fff; border-radius: 12px; padding: 16px; }
.modal-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.modal-header h4 { margin: 0; }
.muted { color: #777; font-size: 13px; }
.modal-block { margin-top: 14px; }
.modal-block h5 { margin: 0 0 8px; }
pre { margin: 0; white-space: pre-wrap; word-break: break-word; background: #f7f7f7; border-radius: 8px; padding: 10px; max-height: 280px; overflow: auto; }
.revisions { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; }
textarea { width: 100%; border: 1px solid #ddd; border-radius: 8px; padding: 8px; font-family: inherit; }
.action-row { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
.feedback-ok { color: #1d8c3d; font-size: 13px; }
</style>