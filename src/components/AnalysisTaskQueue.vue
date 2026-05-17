<template>
  <div class="task-queue-page">
    <div class="queue-header">
      <div>
        <h3>分析任务队列</h3>
        <p>查看当前全局排队概况，以及你提交的分析任务进度。等待时间为估算值，实际耗时取决于 LLM 响应速度。</p>
      </div>
      <button class="btn-base btn-sm btn-gradient-blue" :disabled="loading" @click="fetchQueue">
        {{ loading ? '刷新中...' : '刷新' }}
      </button>
    </div>

    <div class="queue-stats">
      <div class="stat-card">
        <span class="stat-label">全局排队中</span>
        <strong>{{ summary.pending_count ?? 0 }}</strong>
      </div>
      <div class="stat-card">
        <span class="stat-label">处理中</span>
        <strong>{{ summary.processing_count ?? 0 }}</strong>
      </div>
      <div class="stat-card">
        <span class="stat-label">估算并行度</span>
        <strong>{{ summary.estimated_parallelism ?? 1 }}</strong>
        <small>{{ summary.parallelism_source || '配置值' }}</small>
      </div>
      <div class="stat-card">
        <span class="stat-label">深度分析平均耗时</span>
        <strong>{{ formatDuration(summary.default_average_duration_seconds) }}</strong>
      </div>
    </div>

    <div v-if="error" class="queue-error">{{ error }}</div>
    <div v-else-if="!items.length && !loading" class="queue-empty">暂无分析任务</div>

    <section v-if="!error && processingTasks.length" class="processing-panel">
      <div class="panel-header">
        <h4>处理中任务明细</h4>
        <span>超过 {{ summary.processing_stale_minutes || 60 }} 分钟会标记为可能卡住</span>
      </div>
      <table class="queue-table compact">
        <thead>
          <tr>
            <th>任务</th>
            <th>用户</th>
            <th>Worker</th>
            <th>已运行</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in processingTasks" :key="task.task_id">
            <td>
              <div class="task-title">{{ taskTypeLabel(task.task_type) }}</div>
              <div class="task-subtitle">{{ task.symbol || task.stock_name || task.task_id }}</div>
            </td>
            <td>{{ task.created_by_username || task.created_by_user_id || '-' }}</td>
            <td>{{ task.worker_id || '-' }}</td>
            <td>{{ task.processing_age_minutes == null ? '-' : `${task.processing_age_minutes} 分钟` }}</td>
            <td>
              <span :class="['status-pill', task.stale ? 'failed' : 'processing']">
                {{ task.stale ? '可能卡住' : '处理中' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <table v-if="!error && items.length" class="queue-table">
      <thead>
        <tr>
          <th>任务</th>
          <th>状态</th>
          <th>创建时间</th>
          <th>前方任务</th>
          <th>预计等待</th>
          <th>Worker</th>
          <th v-if="hasOwnerColumn">用户</th>
          <th>摘要</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.task_id">
          <td>
            <div class="task-title">{{ taskTypeLabel(item.task_type) }}</div>
            <div class="task-subtitle">{{ item.symbol || item.stock_name || item.task_id }}</div>
          </td>
          <td><span :class="['status-pill', item.status]">{{ statusLabel(item.status) }}</span></td>
          <td>{{ formatTime(item.created_at) }}</td>
          <td>{{ item.status === 'pending' ? item.queue_ahead : '-' }}</td>
          <td>{{ item.wait_hint || formatDuration(item.estimated_wait_seconds) }}</td>
          <td>{{ item.worker_id || '-' }}</td>
          <td v-if="hasOwnerColumn">{{ item.created_by_username || item.created_by_user_id || '-' }}</td>
          <td class="summary-cell">{{ item.result_summary || item.error || '-' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import axios from 'axios'

const loading = ref(false)
const error = ref('')
const summary = ref({})
const items = ref([])
const processingTasks = ref([])
let pollTimer = null

const hasRunningTasks = computed(() => items.value.some(item => ['pending', 'processing'].includes(item.status)))
const hasOwnerColumn = computed(() => items.value.some(item => item.created_by_username || item.created_by_user_id))

function authHeaders() {
  const token = localStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function statusLabel(status) {
  return {
    pending: '排队中',
    processing: '分析中',
    completed: '已完成',
    completed_with_parse_error: '解析异常',
    failed: '失败',
  }[status] || status || '未知'
}

function taskTypeLabel(type) {
  return {
    deep_analysis: '个股深度分析',
    portfolio_analysis: '组合分析',
    market_analysis: 'AI大盘分析',
    global_analysis: '全球市场分析',
    sector_concept_analysis: '板块概念分析',
    hot_stock_analysis: '热股分析',
    etf_analysis: 'ETF分析',
  }[type] || type || '分析任务'
}

function formatTime(value) {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 16)
}

function formatDuration(seconds) {
  const n = Number(seconds)
  if (!Number.isFinite(n) || n <= 0) return '-'
  const minutes = Math.max(1, Math.round(n / 60))
  if (minutes < 60) return `约 ${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const remain = minutes % 60
  return remain ? `约 ${hours} 小时 ${remain} 分钟` : `约 ${hours} 小时`
}

async function fetchQueue() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await axios.get('/api/analysis-tasks/queue', {
      headers: authHeaders(),
      params: { limit: 80 },
    })
    summary.value = data?.global || {}
    items.value = Array.isArray(data?.items) ? data.items : []
    processingTasks.value = Array.isArray(data?.processing_tasks) ? data.processing_tasks : []
    resetPolling()
  } catch (err) {
    error.value = err.response?.data?.detail || err.message || '任务队列加载失败'
  } finally {
    loading.value = false
  }
}

function resetPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(fetchQueue, hasRunningTasks.value ? 8000 : 30000)
}

onMounted(fetchQueue)
onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
.task-queue-page { background:#fff; padding:16px; border-radius:8px; }
.queue-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:14px; }
.queue-header h3 { margin:0 0 6px; font-size:20px; }
.queue-header p { margin:0; color:#64748b; font-size:13px; }
.queue-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; margin-bottom:14px; }
.stat-card { border:1px solid #e2e8f0; border-radius:8px; padding:12px; background:#f8fafc; }
.stat-label { display:block; color:#64748b; font-size:12px; margin-bottom:5px; }
.stat-card strong { font-size:20px; color:#0f172a; }
.stat-card small { display:block; color:#94a3b8; font-size:11px; margin-top:4px; }
.processing-panel { margin:0 0 14px; border:1px solid #bfdbfe; border-radius:8px; overflow:hidden; }
.panel-header { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:10px 12px; background:#eff6ff; border-bottom:1px solid #bfdbfe; }
.panel-header h4 { margin:0; font-size:15px; color:#1e3a8a; }
.panel-header span { color:#64748b; font-size:12px; }
.queue-error, .queue-empty { padding:18px; text-align:center; color:#64748b; border:1px dashed #cbd5e1; border-radius:8px; }
.queue-error { color:#b91c1c; background:#fef2f2; border-color:#fecaca; }
.queue-table { width:100%; border-collapse:collapse; }
.queue-table th, .queue-table td { border:1px solid #e2e8f0; padding:8px 10px; font-size:13px; vertical-align:top; }
.queue-table th { background:#f1f5f9; color:#334155; }
.queue-table.compact { margin:0; }
.task-title { font-weight:700; color:#0f172a; }
.task-subtitle { color:#64748b; font-size:12px; margin-top:2px; }
.status-pill { display:inline-block; padding:3px 8px; border-radius:999px; font-size:12px; background:#e2e8f0; color:#334155; }
.status-pill.pending { background:#fef3c7; color:#92400e; }
.status-pill.processing { background:#dbeafe; color:#1d4ed8; }
.status-pill.completed { background:#dcfce7; color:#15803d; }
.status-pill.completed_with_parse_error, .status-pill.failed { background:#fee2e2; color:#b91c1c; }
.summary-cell { max-width:360px; color:#475569; }
</style>
