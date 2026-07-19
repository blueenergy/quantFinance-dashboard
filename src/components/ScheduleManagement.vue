<template>
  <div class="scheduler-management">
    <div class="header">
      <h2>后台调度任务配置</h2>
      <button class="refresh-btn" @click="fetchJobs" :disabled="loading">
        <span v-if="loading">加载中...</span>
        <span v-else>刷新任务状态</span>
      </button>
    </div>

    <div v-if="error" class="error-msg">{{ error }}</div>

    <table v-if="jobs.length > 0" class="scheduler-table">
      <thead>
        <tr>
          <th>任务名称</th>
          <th>内部ID</th>
          <th>调度类型</th>
          <th>当前状态</th>
          <th>下次运行时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="job in jobs" :key="job.job_id">
          <td>{{ job.name }}</td>
          <td><code>{{ job.job_id }}</code></td>
          <td>
            <span v-if="job.type === 'interval'">间隔 ({{ job.config.seconds }}秒)</span>
            <span v-else-if="job.type === 'cron'">定时 ({{ formatCron(job.config) }})</span>
            <span v-else>{{ job.type }}</span>
          </td>
          <td>
            <span :class="['status-badge', job.is_running ? 'online' : 'offline']">
              {{ job.is_running ? '运行中' : '未挂载' }}
            </span>
            <span v-if="!job.is_active" class="status-badge disabled">已禁用</span>
          </td>
          <td>{{ formatTime(job.next_run_time) }}</td>
          <td>
            <button class="edit-btn" @click="openEditModal(job)">修改规则</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else-if="!loading" class="empty-state">暂无调度任务数据</div>

    <!-- Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <h3>修改任务 - {{ editingJob.name }}</h3>
        
        <div class="form-group row">
          <label>启用状态:</label>
          <label class="switch">
            <input type="checkbox" v-model="editForm.is_active">
            <span class="slider round"></span>
          </label>
        </div>

        <div v-if="editingJob.type === 'interval'" class="form-group">
          <label>间隔秒数:</label>
          <input type="number" v-model="editForm.config.seconds" min="10">
        </div>

        <div v-if="editingJob.type === 'cron'" class="cron-editor">
          <div class="form-group">
            <label>小时 (0-23):</label>
            <input type="number" v-model="editForm.config.hour" min="0" max="23">
          </div>
          <div class="form-group">
            <label>分钟 (0-59):</label>
            <input type="number" v-model="editForm.config.minute" min="0" max="59">
          </div>
          <div class="form-group">
            <label>周几 (如 mon-fri, *):</label>
            <input type="text" v-model="editForm.config.day_of_week">
          </div>
        </div>

        <div class="modal-actions">
          <button class="cancel-btn" @click="closeModal">取消</button>
          <button class="save-btn" @click="saveJob" :disabled="saving">
            {{ saving ? '保存中...' : '确认并使之生效' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import request from '../utils/request'

const jobs = ref([])
const loading = ref(false)
const error = ref('')
const showModal = ref(false)
const saving = ref(false)
const editingJob = ref(null)

const editForm = ref({
  is_active: true,
  config: {}
})

const fetchJobs = async () => {
  loading.value = true
  error.value = ''
  try {
    const body = await request({ method: 'get', url: '/admin/scheduler/jobs' })
    if (body.success) {
      jobs.value = body.data
    } else {
      error.value = body.detail || '获取数据失败'
    }
  } catch (err) {
    console.error('Fetch error:', err)
    error.value = err.response?.data?.detail || err.message || '网络或接口错误'
    if (err.response?.status === 401 || err.response?.status === 403) {
      error.value = '您没有管理员权限查看任务调度。'
    }
  } finally {
    loading.value = false
  }
}

const openEditModal = (job) => {
  editingJob.value = job
  editForm.value = {
    is_active: job.is_active,
    config: { ...job.config }
  }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  editingJob.value = null
}

const saveJob = async () => {
  if (!editingJob.value) return
  saving.value = true
  
  try {
    const payload = {
      is_active: editForm.value.is_active,
      config: editForm.value.config
    }
    
    // Type casting
    if (editingJob.value.type === 'interval') {
      payload.config.seconds = parseInt(payload.config.seconds)
    } else if (editingJob.value.type === 'cron') {
      payload.config.hour = parseInt(payload.config.hour)
      payload.config.minute = parseInt(payload.config.minute)
    }

    const body = await request({
      method: 'put',
      url: `/admin/scheduler/jobs/${editingJob.value.job_id}`,
      data: payload,
    })
    
    if (body.success) {
      closeModal()
      fetchJobs() // refresh the list
    } else {
      alert(body.detail || '保存失败')
    }
  } catch (err) {
    alert(err.response?.data?.detail || err.message || '保存报错')
  } finally {
    saving.value = false
  }
}

const formatCron = (config) => {
  return `${config.hour.toString().padStart(2, '0')}:${config.minute.toString().padStart(2, '0')} (${config.day_of_week || '*'})`
}

const formatTime = (isoString) => {
  if (!isoString) return '未排期'
  const d = new Date(isoString)
  return d.toLocaleString()
}

onMounted(() => {
  fetchJobs()
})
</script>

<style scoped>
.scheduler-management {
  padding: 20px;
  background: var(--surface-color, #1e1e2d);
  border-radius: 8px;
  color: #e1e1e6;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

h2 {
  margin: 0;
  font-size: 1.25rem;
  color: #fff;
}

.refresh-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: #2563eb;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.scheduler-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--surface-light, #252538);
  border-radius: 8px;
  overflow: hidden;
}

.scheduler-table th, .scheduler-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border-color, #3a3a5a);
}

.scheduler-table th {
  background: rgba(0,0,0,0.2);
  color: #a1a1aa;
  font-weight: 600;
}

code {
  background: rgba(255,255,255,0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
  color: #fca5a5;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: bold;
  margin-right: 8px;
}
.status-badge.online { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #059669; }
.status-badge.offline { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #dc2626; }
.status-badge.disabled { background: rgba(107, 114, 128, 0.2); color: #9ca3af; border: 1px solid #4b5563; }

.edit-btn {
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  color: #fff;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
}
.edit-btn:hover { background: rgba(255,255,255,0.2); }

.error-msg {
  background: rgba(239, 68, 68, 0.1);
  border-left: 4px solid #ef4444;
  color: #fca5a5;
  padding: 12px;
  margin-bottom: 16px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #a1a1aa;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: #1e1e2d;
  padding: 24px;
  border-radius: 8px;
  width: 400px;
  border: 1px solid #3a3a5a;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
}

.modal h3 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #fff;
  border-bottom: 1px solid #3a3a5a;
  padding-bottom: 12px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  color: #d1d5db;
}

.form-group input[type="number"], .form-group input[type="text"] {
  width: 100%;
  padding: 8px 12px;
  background: #13131a;
  border: 1px solid #3a3a5a;
  color: white;
  border-radius: 4px;
  box-sizing: border-box;
}

.cron-editor {
  background: rgba(0,0,0,0.2);
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 16px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.save-btn {
  background: #10b981;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}
.save-btn:hover { background: #059669; }
.cancel-btn {
  background: transparent;
  color: #9ca3af;
  border: 1px solid #4b5563;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}
.cancel-btn:hover { background: rgba(255,255,255,0.05); color: #fff; }

/* Switch Toggle CSS */
.switch { position: relative; display: inline-block; width: 44px; height: 24px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #4b5563; transition: .4s; }
.slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; }
input:checked + .slider { background-color: #10b981; }
input:checked + .slider:before { transform: translateX(20px); }
.slider.round { border-radius: 24px; }
.slider.round:before { border-radius: 50%; }
</style>
