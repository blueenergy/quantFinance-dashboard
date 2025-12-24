<template>
  <div class="worker-nodes-monitor">
    <div class="monitor-header">
      <h3>🖥️ Worker 节点状态</h3>
      <button @click="refreshData" :disabled="loading" class="refresh-btn">
        {{ loading ? '刷新中...' : '🔄 刷新' }}
      </button>
    </div>

    <!-- 节点统计卡片 -->
    <div class="stats-cards" v-if="summary">
      <div class="stat-card">
        <div class="stat-icon">🟢</div>
        <div class="stat-content">
          <div class="stat-label">在线节点</div>
          <div class="stat-value">{{ summary.online_nodes }}</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">⚙️</div>
        <div class="stat-content">
          <div class="stat-label">总节点数</div>
          <div class="stat-value">{{ summary.total_nodes }}</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">📦</div>
        <div class="stat-content">
          <div class="stat-label">活跃进程</div>
          <div class="stat-value">{{ summary.total_processes }}</div>
        </div>
      </div>
    </div>

    <!-- 节点列表 -->
    <div class="nodes-list" v-if="nodes && nodes.length > 0">
      <table class="nodes-table">
        <thead>
          <tr>
            <th>节点ID</th>
            <th>主机名</th>
            <th>状态</th>
            <th>标签</th>
            <th>最近心跳</th>
            <th>进程数</th>
            <th>容量</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="node in nodes" :key="node.node_id" :class="getNodeClass(node)">
            <td><code>{{ node.node_id }}</code></td>
            <td>{{ node.host }}</td>
            <td>
              <span :class="['status-badge', node.status]">
                {{ getStatusText(node.status) }}
              </span>
            </td>
            <td>
              <span v-for="(value, key) in node.labels" :key="key" class="label-tag">
                {{ key }}: {{ value }}
              </span>
            </td>
            <td>{{ formatHeartbeat(node.last_heartbeat) }}</td>
            <td>{{ node.process_count || 0 }}</td>
            <td>
              <div class="capacity-info" v-if="node.capacity">
                {{ node.capacity.cpu_cores }}核 / {{ (node.capacity.memory_mb / 1024).toFixed(1) }}GB
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="!loading" class="empty-state">
      <p>暂无节点注册</p>
    </div>

    <div v-if="loading && !nodes" class="loading-state">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const loading = ref(false)
const nodes = ref([])
const summary = ref(null)

const getStatusText = (status) => {
  const map = {
    online: '在线',
    offline: '离线',
    unknown: '未知'
  }
  return map[status] || status
}

const getNodeClass = (node) => {
  return {
    'node-online': node.status === 'online',
    'node-offline': node.status === 'offline'
  }
}

const formatHeartbeat = (timestamp) => {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  const now = new Date()
  const diff = Math.floor((now - date) / 1000)
  
  if (diff < 60) return `${diff}秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  return `${Math.floor(diff / 86400)}天前`
}

const refreshData = async () => {
  loading.value = true
  try {
    const token = localStorage.getItem('token')
    const resp = await axios.get(`${API_BASE}/api/admin/worker-nodes/status`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (resp.data.success) {
      nodes.value = resp.data.data.nodes || []
      summary.value = resp.data.data.summary || {}
    }
  } catch (error) {
    console.error('Failed to fetch worker nodes:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refreshData()
  // Auto-refresh every 30 seconds
  const interval = setInterval(refreshData, 30000)
  return () => clearInterval(interval)
})
</script>

<style scoped>
.worker-nodes-monitor {
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

.nodes-table {
  width: 100%;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.nodes-table thead {
  background: #f8f9fa;
}

.nodes-table th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  border-bottom: 2px solid #dee2e6;
}

.nodes-table td {
  padding: 12px;
  border-bottom: 1px solid #dee2e6;
}

.nodes-table tbody tr:hover {
  background: #f8f9fa;
}

.node-online {
  background: rgba(46, 204, 113, 0.05);
}

.node-offline {
  background: rgba(231, 76, 60, 0.05);
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.online {
  background: #d4edda;
  color: #155724;
}

.status-badge.offline {
  background: #f8d7da;
  color: #721c24;
}

.label-tag {
  display: inline-block;
  padding: 2px 8px;
  margin-right: 4px;
  background: #e9ecef;
  border-radius: 3px;
  font-size: 12px;
  color: #495057;
}

.capacity-info {
  font-size: 13px;
  color: #6c757d;
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
