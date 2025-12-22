<template>
  <div class="worker-monitor">
    <!-- Header with refresh status -->
    <div class="monitor-header">
      <h3>🤖 Worker 工作台</h3>
      <div class="header-right">
        <span class="market-status" :class="marketStatusClass">
          {{ marketStatusText }}
        </span>
        <span class="last-update">{{ lastUpdateText }}</span>
        <button @click="refreshData" class="refresh-btn" :disabled="loading">
          {{ loading ? '⏳' : '🔄' }}
        </button>
      </div>
    </div>

    <!-- Active Workers Section -->
    <div class="section active-workers-section">
      <h4>🏃 活跃 Worker ({{ activeWorkers.length }})</h4>
      
      <div v-if="activeWorkers.length === 0" class="empty-state">
        <p v-if="marketStatus === 'closed'">📴 市场已休市，Worker 已休息</p>
        <p v-else>⏸️ 暂无活跃 Worker</p>
      </div>
      
      <div v-else class="workers-grid">
        <div 
          v-for="worker in activeWorkers" 
          :key="worker.worker_id"
          class="worker-card"
        >
          <div class="worker-header">
            <span class="worker-symbol">{{ worker.symbol }}</span>
            <span class="worker-status-badge" :class="getWorkerStatusClass(worker)">
              {{ getWorkerStatusText(worker) }}
            </span>
          </div>
          <div class="worker-details">
            <div class="detail-row">
              <span class="label">策略:</span>
              <span class="value">{{ worker.strategy }}</span>
            </div>
            <div class="detail-row">
              <span class="label">运行时长:</span>
              <span class="value">{{ formatUptime(worker.uptime_seconds) }}</span>
            </div>
            <div v-if="worker.metrics && worker.metrics.last_scan_time" class="detail-row">
              <span class="label">最后扫描:</span>
              <span class="value">{{ formatTimestamp(worker.metrics.last_scan_time) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Today's Summary Section -->
    <div class="section summary-section">
      <h4>📊 今日工作汇总</h4>
      
      <div class="summary-stats">
        <div class="stat-card">
          <div class="stat-icon">🔍</div>
          <div class="stat-content">
            <div class="stat-value">{{ todaySummary.total_scans }}</div>
            <div class="stat-label">市场扫描</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">📈</div>
          <div class="stat-content">
            <div class="stat-value">{{ todaySummary.total_analyses }}</div>
            <div class="stat-label">深度分析</div>
          </div>
        </div>
        
        <div class="stat-card highlight">
          <div class="stat-icon">⚡</div>
          <div class="stat-content">
            <div class="stat-value">{{ todaySummary.signals_generated }}</div>
            <div class="stat-label">信号生成</div>
          </div>
        </div>
        
        <div class="stat-card success">
          <div class="stat-icon">✅</div>
          <div class="stat-content">
            <div class="stat-value">{{ todaySummary.trades_executed }}</div>
            <div class="stat-label">交易执行</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Activity Timeline Section -->
    <div class="section timeline-section">
      <h4>⏱️ 活动时间轴</h4>
      
      <div v-if="timeline.length === 0" class="empty-state">
        <p>暂无活动记录</p>
      </div>
      
      <div v-else class="timeline-chart">
        <div 
          v-for="entry in timeline" 
          :key="entry.hour"
          class="timeline-bar"
        >
          <div class="bar-label">{{ entry.hour }}</div>
          <div class="bar-container">
            <div 
              class="bar scan-bar" 
              :style="{ height: getBarHeight(entry.scans, maxActivity) + '%' }"
              :title="`${entry.scans} 次扫描`"
            ></div>
            <div 
              class="bar signal-bar" 
              :style="{ height: getBarHeight(entry.signals, maxActivity) + '%' }"
              :title="`${entry.signals} 个信号`"
            ></div>
          </div>
          <div class="bar-value">
            <span v-if="entry.scans" class="scan-count">{{ entry.scans }}</span>
            <span v-if="entry.signals" class="signal-count">{{ entry.signals }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Activities Section -->
    <div class="section activities-section">
      <h4>📝 最近活动 ({{ recentActivities.length }})</h4>
      
      <div v-if="recentActivities.length === 0" class="empty-state">
        <p>暂无最近活动</p>
      </div>
      
      <div v-else class="activities-list">
        <div 
          v-for="activity in recentActivities.slice(0, 10)" 
          :key="activity._id"
          class="activity-item"
        >
          <div class="activity-icon">{{ getActivityIcon(activity.activity_type) }}</div>
          <div class="activity-content">
            <div class="activity-title">
              <span class="activity-type">{{ getActivityTypeText(activity.activity_type) }}</span>
              <span v-if="activity.symbol" class="activity-symbol">{{ activity.symbol }}</span>
            </div>
            <div class="activity-meta">
              <span v-if="activity.strategy">{{ activity.strategy }}</span>
              <span class="activity-time">{{ formatActivityTime(activity.timestamp) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import axios from 'axios'

export default {
  name: 'WorkerMonitor',
  setup() {
    const loading = ref(false)
    const lastUpdate = ref(null)
    const activeWorkers = ref([])
    const marketStatus = ref('unknown')
    const todaySummary = ref({
      total_scans: 0,
      total_analyses: 0,
      signals_generated: 0,
      trades_executed: 0
    })
    const timeline = ref([])
    const recentActivities = ref([])
    
    let refreshInterval = null

    const marketStatusClass = computed(() => {
      return {
        'status-open': marketStatus.value === 'open',
        'status-closed': marketStatus.value === 'closed'
      }
    })

    const marketStatusText = computed(() => {
      return marketStatus.value === 'open' ? '🟢 市场开盘' : '🔴 市场休市'
    })

    const lastUpdateText = computed(() => {
      if (!lastUpdate.value) return ''
      const now = new Date()
      const diff = Math.floor((now - lastUpdate.value) / 1000)
      if (diff < 60) return `${diff}秒前更新`
      if (diff < 3600) return `${Math.floor(diff / 60)}分钟前更新`
      return `${Math.floor(diff / 3600)}小时前更新`
    })

    const maxActivity = computed(() => {
      if (timeline.value.length === 0) return 1
      return Math.max(...timeline.value.map(t => Math.max(t.scans, t.signals)))
    })

    const fetchWorkerStatus = async () => {
      try {
        const response = await axios.get('/api/worker/status')
        if (response.data.success) {
          activeWorkers.value = response.data.data.active_workers
          marketStatus.value = response.data.data.market_status
        }
      } catch (error) {
        console.error('Failed to fetch worker status:', error)
      }
    }

    const fetchTodayActivity = async () => {
      try {
        const response = await axios.get('/api/worker/activity/today')
        if (response.data.success) {
          todaySummary.value = response.data.data.summary
          timeline.value = response.data.data.timeline
          recentActivities.value = response.data.data.activities
        }
      } catch (error) {
        console.error('Failed to fetch today activity:', error)
      }
    }

    const refreshData = async () => {
      if (loading.value) return
      loading.value = true
      
      try {
        await Promise.all([
          fetchWorkerStatus(),
          fetchTodayActivity()
        ])
        lastUpdate.value = new Date()
      } finally {
        loading.value = false
      }
    }

    const getWorkerStatusClass = (worker) => {
      const ageSeconds = worker.status_age_seconds || 0
      if (ageSeconds > 180) return 'status-warning'  // >3min没心跳
      if (worker.status === 'error') return 'status-error'
      return 'status-ok'
    }

    const getWorkerStatusText = (worker) => {
      const ageSeconds = worker.status_age_seconds || 0
      if (ageSeconds > 180) return '⚠️ 超时'
      if (worker.status === 'error') return '❌ 错误'
      if (worker.status === 'idle') return '💤 空闲'
      return '✅ 运行中'
    }

    const formatUptime = (seconds) => {
      if (!seconds) return '0秒'
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      const secs = seconds % 60
      
      if (hours > 0) return `${hours}h ${minutes}m`
      if (minutes > 0) return `${minutes}m ${secs}s`
      return `${secs}s`
    }

    const formatTimestamp = (ts) => {
      if (!ts) return '-'
      const date = new Date(ts * 1000)
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }

    const formatActivityTime = (ts) => {
      if (!ts) return ''
      const date = new Date(ts * 1000)
      const now = new Date()
      const diff = Math.floor((now - date) / 1000)
      
      if (diff < 60) return '刚刚'
      if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }

    const getBarHeight = (value, max) => {
      if (!max || max === 0) return 0
      return Math.max(5, (value / max) * 100)  // Minimum 5% for visibility
    }

    const getActivityIcon = (type) => {
      const icons = {
        scan: '🔍',
        analysis: '📊',
        signal_check: '⚡',
        order_submitted: '📮'
      }
      return icons[type] || '📝'
    }

    const getActivityTypeText = (type) => {
      const texts = {
        scan: '市场扫描',
        analysis: '深度分析',
        signal_check: '信号检查',
        order_submitted: '订单提交'
      }
      return texts[type] || type
    }

    onMounted(() => {
      refreshData()
      // Auto-refresh every 30 seconds
      refreshInterval = setInterval(refreshData, 30000)
    })

    onUnmounted(() => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    })

    return {
      loading,
      lastUpdate,
      activeWorkers,
      marketStatus,
      todaySummary,
      timeline,
      recentActivities,
      marketStatusClass,
      marketStatusText,
      lastUpdateText,
      maxActivity,
      refreshData,
      getWorkerStatusClass,
      getWorkerStatusText,
      formatUptime,
      formatTimestamp,
      formatActivityTime,
      getBarHeight,
      getActivityIcon,
      getActivityTypeText
    }
  }
}
</script>

<style scoped>
.worker-monitor {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #e0e0e0;
}

.monitor-header h3 {
  margin: 0;
  font-size: 24px;
  color: #333;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.market-status {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}

.status-open {
  background: #d4edda;
  color: #155724;
}

.status-closed {
  background: #f8d7da;
  color: #721c24;
}

.last-update {
  font-size: 12px;
  color: #666;
}

.refresh-btn {
  padding: 8px 16px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.refresh-btn:hover:not(:disabled) {
  background: #2980b9;
  transform: translateY(-1px);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.section h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #333;
  font-weight: 600;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

/* Active Workers Grid */
.workers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.worker-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 8px;
  padding: 16px;
  transition: transform 0.2s;
}

.worker-card:hover {
  transform: translateY(-2px);
}

.worker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.worker-symbol {
  font-size: 18px;
  font-weight: 700;
}

.worker-status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.2);
}

.status-ok { background: rgba(39, 174, 96, 0.3); }
.status-warning { background: rgba(243, 156, 18, 0.3); }
.status-error { background: rgba(231, 76, 60, 0.3); }

.worker-details {
  font-size: 13px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  opacity: 0.9;
}

.detail-row .label {
  font-weight: 500;
}

/* Summary Stats */
.summary-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 2px solid transparent;
  transition: all 0.3s;
}

.stat-card:hover {
  border-color: #3498db;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.2);
}

.stat-card.highlight {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.stat-card.success {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
}

.stat-icon {
  font-size: 32px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
}

.stat-label {
  font-size: 13px;
  opacity: 0.8;
  margin-top: 4px;
}

/* Timeline Chart */
.timeline-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  height: 200px;
  padding: 16px 0;
}

.timeline-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 40px;
}

.bar-label {
  font-size: 11px;
  color: #666;
  margin-bottom: 8px;
}

.bar-container {
  flex: 1;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 2px;
  position: relative;
}

.bar {
  width: 45%;
  min-height: 4px;
  border-radius: 4px 4px 0 0;
  transition: all 0.3s;
}

.scan-bar {
  background: linear-gradient(180deg, #3498db, #2980b9);
}

.signal-bar {
  background: linear-gradient(180deg, #e74c3c, #c0392b);
}

.bar:hover {
  opacity: 0.8;
}

.bar-value {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  font-size: 10px;
}

.scan-count {
  color: #3498db;
  font-weight: 600;
}

.signal-count {
  color: #e74c3c;
  font-weight: 600;
}

/* Activities List */
.activities-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.activity-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  transition: all 0.2s;
}

.activity-item:hover {
  background: #e9ecef;
}

.activity-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.activity-content {
  flex: 1;
  min-width: 0;
}

.activity-title {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
}

.activity-type {
  font-weight: 600;
  color: #333;
  font-size: 14px;
}

.activity-symbol {
  padding: 2px 8px;
  background: #667eea;
  color: white;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.activity-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #666;
}

.activity-time {
  color: #999;
}
</style>
