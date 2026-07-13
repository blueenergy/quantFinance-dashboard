<template>
  <div class="worker-groups-monitor">
    <div class="monitor-header">
      <h3>📦 Worker 组状态</h3>
      <button @click="refreshData" :disabled="loading" class="refresh-btn">
        {{ loading ? '刷新中...' : '🔄 刷新' }}
      </button>
    </div>

    <!-- 组统计卡片 -->
    <div class="stats-cards" v-if="summary">
      <div class="stat-card">
        <div class="stat-icon">▶️</div>
        <div class="stat-content">
          <div class="stat-label">运行中</div>
          <div class="stat-value">{{ summary.running_groups }}</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">⏸️</div>
        <div class="stat-content">
          <div class="stat-label">已停止</div>
          <div class="stat-value">{{ summary.stopped_groups }}</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <div class="stat-label">总组数</div>
          <div class="stat-value">{{ summary.total_groups }}</div>
        </div>
      </div>
    </div>

    <!-- 组列表 -->
    <div class="groups-list" v-if="groups && groups.length > 0">
      <table class="groups-table">
        <thead>
          <tr>
            <th>组ID</th>
            <th>节点</th>
            <th>用户</th>
            <th>模式</th>
            <th>股票代码</th>
            <th>期望状态</th>
            <th>当前状态</th>
            <th>最后更新</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="group in groups" :key="group.group_id" :class="getGroupClass(group)">
            <td><code>{{ group.group_id }}</code></td>
            <td><code>{{ group.node_id }}</code></td>
            <td>{{ group.user_id }}</td>
            <td>
              <span :class="['mode-badge', group.mode]">
                {{ getModeText(group.mode) }}
              </span>
            </td>
            <td>
              <div class="symbols-list">
                <span v-for="symbol in group.symbols" :key="symbol" class="symbol-tag">
                  {{ symbol }}
                </span>
                <span v-if="group.symbols.length > 3" class="more-count">
                  +{{ group.symbols.length - 3 }}
                </span>
              </div>
            </td>
            <td>
              <span :class="['state-badge', group.desired_state]">
                {{ getStateText(group.desired_state) }}
              </span>
            </td>
            <td>
              <span :class="['state-badge', group.current_state]">
                {{ getStateText(group.current_state) }}
              </span>
              <span v-if="group.desired_state !== group.current_state" class="sync-indicator">
                ⚠️ 不同步
              </span>
            </td>
            <td>{{ formatTime(group.updated_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="!loading" class="empty-state">
      <p>暂无 Worker 组</p>
    </div>

    <div v-if="loading && !groups" class="loading-state">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import request from '../utils/request'
import { useVisibilityAwarePolling } from '../composables/useVisibilityAwarePolling.js'

const loading = ref(false)
const groups = ref([])
const summary = ref(null)

const getModeText = (mode) => {
  const map = {
    live: '实盘',
    backtest: '回测',
    replay: '复盘'
  }
  return map[mode] || mode
}

const getStateText = (state) => {
  if (!state) return '-'
  const map = {
    running: '运行中',
    stopped: '已停止',
    pending: '待启动',
    stopping: '停止中',
    error: '错误'
  }
  return map[state] || state
}

const getGroupClass = (group) => {
  const isRunning = group.current_state === 'running'
  const isSynced = group.desired_state === group.current_state
  
  return {
    'group-running': isRunning,
    'group-stopped': group.current_state === 'stopped',
    'group-out-of-sync': !isSynced
  }
}

const formatTime = (timestamp) => {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const refreshData = async () => {
  loading.value = true
  try {
    console.log('[WorkerGroupsMonitor] Fetching worker groups...')
    
    const data = await request.get('/admin/worker-groups/status')
    
    console.log('[WorkerGroupsMonitor] Response:', data)
    
    if (data.success) {
      groups.value = data.data.groups || []
      summary.value = data.data.summary || {}
      console.log('[WorkerGroupsMonitor] Loaded groups:', groups.value.length)
    } else {
      console.error('[WorkerGroupsMonitor] API returned success=false:', data)
    }
  } catch (error) {
    console.error('[WorkerGroupsMonitor] Failed to fetch worker groups:', error)
    console.error('[WorkerGroupsMonitor] Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    })
  } finally {
    loading.value = false
  }
}

const shellActiveTab = inject('shellActiveTab', null)
const isAdminTabActive = computed(() => shellActiveTab?.value === 'admin')
useVisibilityAwarePolling(refreshData, 30000, isAdminTabActive)
</script>

<style scoped>
.worker-groups-monitor {
  padding: 20px;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.monitor-header h3 {
  margin: 0;
  color: #2c3e50;
}

.refresh-btn {
  padding: 8px 16px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.refresh-btn:hover:not(:disabled) {
  background: #2980b9;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-icon {
  font-size: 32px;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 13px;
  color: #7f8c8d;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #2c3e50;
}

.groups-table {
  width: 100%;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.groups-table thead {
  background: #f8f9fa;
}

.groups-table th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  border-bottom: 2px solid #dee2e6;
}

.groups-table td {
  padding: 12px;
  border-bottom: 1px solid #dee2e6;
}

.groups-table tbody tr:hover {
  background: #f8f9fa;
}

.group-running {
  background: rgba(46, 204, 113, 0.05);
}

.group-stopped {
  background: rgba(149, 165, 166, 0.05);
}

.group-out-of-sync {
  border-left: 3px solid #f39c12;
}

.mode-badge,
.state-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.mode-badge.live {
  background: #d1ecf1;
  color: #0c5460;
}

.mode-badge.backtest {
  background: #fff3cd;
  color: #856404;
}

.state-badge.running {
  background: #d4edda;
  color: #155724;
}

.state-badge.stopped {
  background: #e2e3e5;
  color: #383d41;
}

.state-badge.pending,
.state-badge.stopping {
  background: #fff3cd;
  color: #856404;
}

.state-badge.error {
  background: #f8d7da;
  color: #721c24;
}

.symbols-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: 300px;
}

.symbol-tag {
  display: inline-block;
  padding: 2px 6px;
  background: #e7f3ff;
  border-radius: 3px;
  font-size: 12px;
  color: #0066cc;
  font-family: 'Monaco', 'Courier New', monospace;
}

.more-count {
  font-size: 12px;
  color: #6c757d;
  font-weight: 500;
}

.sync-indicator {
  margin-left: 8px;
  font-size: 11px;
  color: #f39c12;
}

.empty-state,
.loading-state {
  text-align: center;
  padding: 60px 20px;
  color: #95a5a6;
}

.loading-spinner {
  margin: 0 auto 16px;
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

code {
  background: #f8f9fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 13px;
}
</style>
