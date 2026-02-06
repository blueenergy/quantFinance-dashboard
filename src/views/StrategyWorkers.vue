<template>
  <div class="strategy-workers-page">
    <div class="page-header">
      <h1>🤖 策略 Workers 监控</h1>
      <button @click="refreshWorkers" :disabled="loading" class="refresh-btn">
        {{ loading ? '⏳ 刷新中...' : '🔄 刷新' }}
      </button>
    </div>

    <!-- API 状态 -->
    <div class="api-status" :class="statusClass">
      <div class="status-indicator"></div>
      <span>{{ statusMessage }}</span>
      <span v-if="deploymentMode" class="deployment-mode">{{ deploymentMode }}</span>
    </div>

    <!-- Workers 统计 -->
    <div class="workers-stats">
      <div class="stat-card">
        <div class="stat-icon">👷</div>
        <div class="stat-content">
          <div class="stat-value">{{ totalWorkers }}</div>
          <div class="stat-label">总 Workers</div>
        </div>
      </div>
      
      <div class="stat-card active">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <div class="stat-value">{{ activeWorkers }}</div>
          <div class="stat-label">活跃中</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">⚙️</div>
        <div class="stat-content">
          <div class="stat-value">{{ activeConfigs }}</div>
          <div class="stat-label">配置数</div>
        </div>
      </div>
    </div>

    <!-- Workers 列表 -->
    <div class="workers-section">
      <h2>Workers 列表</h2>
      
      <div v-if="loading && workers.length === 0" class="loading-state">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>
      
      <div v-else-if="workers.length === 0" class="empty-state">
        <p>📭 暂无活跃的 Workers</p>
        <p class="hint">在 MongoDB 的 watchlist_strategies 集合中添加策略配置</p>
      </div>
      
      <div v-else class="workers-grid">
        <div 
          v-for="worker in workers" 
          :key="worker.key"
          class="worker-card"
          :class="{ 'alive': worker.alive }"
        >
          <!-- Worker 头部 -->
          <div class="worker-header">
            <div class="worker-status" :class="{ 'online': worker.alive }">
              {{ worker.alive ? '🟢 在线' : '🔴 离线' }}
            </div>
            <div class="worker-engine">{{ worker.stats.engine || 'vnpy' }}</div>
          </div>
          
          <!-- Worker 信息 -->
          <div class="worker-info">
            <div class="worker-symbol">{{ worker.stats.symbol }}</div>
            <div class="worker-strategy">{{ worker.stats.strategy }}</div>
          </div>
          
          <!-- Worker 状态 -->
          <div class="worker-stats">
            <div class="stat-item">
              <span class="label">状态:</span>
              <span class="value">{{ worker.stats.state || 'unknown' }}</span>
            </div>
            <div class="stat-item" v-if="worker.stats.position !== undefined">
              <span class="label">仓位:</span>
              <span class="value">{{ worker.stats.position }}</span>
            </div>
            <div class="stat-item" v-if="worker.stats.bars_processed !== undefined">
              <span class="label">处理K线:</span>
              <span class="value">{{ worker.stats.bars_processed }}</span>
            </div>
            <div class="stat-item" v-if="worker.stats.entry_price">
              <span class="label">入场价:</span>
              <span class="value">¥{{ worker.stats.entry_price }}</span>
            </div>
          </div>
          
          <!-- 日志流按钮 -->
          <div class="worker-actions">
            <button 
              v-if="worker.log_stream_url" 
              @click="openLogStream(worker)"
              class="log-btn realtime"
              title="打开实时日志流（WebSocket）- 只显示当前新产生的日志"
            >
              📺 实时日志
            </button>
            <button 
              @click="openHistoryLogs(worker)"
              class="log-btn history"
              title="查看历史日志文件 - 可能需要等待 Worker 运行一段时间后才能生成"
            >
              📜 历史日志
            </button>
            <span v-if="!worker.log_stream_url" class="no-stream" title="此 Worker 未启用实时日志流">
              ⚠️ 无实时流
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { authService } from '../services/auth.js'

export default {
  name: 'StrategyWorkers',
  data() {
    return {
      authService,  // 添加到 data 中以便在模板中使用
      loading: false,
      workers: [],
      totalWorkers: 0,
      activeWorkers: 0,
      activeConfigs: 0,
      deploymentMode: '',
      statusMessage: '正在连接...',
      statusClass: 'connecting',
      autoRefreshInterval: null,
    }
  },
  mounted() {
    this.refreshWorkers()
    // 每30秒自动刷新
    this.autoRefreshInterval = setInterval(() => {
      this.refreshWorkers()
    }, 30000)
  },
  beforeUnmount() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval)
    }
  },
  methods: {
    async refreshWorkers() {
      this.loading = true
      try {
        const apiUrl = import.meta.env.VITE_WORKER_API || '/api/strategy/workers'
        
        // 从 localStorage 获取 token
        const token = localStorage.getItem('access_token')
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {}
        
        const response = await fetch(apiUrl, { headers })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        
        const data = await response.json()
        
        // 解析 workers 数据
        this.totalWorkers = data.total_workers || 0
        this.activeConfigs = data.active_configs || 0
        this.deploymentMode = data.deployment_mode || ''
        
        // 转换 workers 对象为数组
        this.workers = Object.entries(data.workers || {}).map(([key, worker]) => ({
          key,
          ...worker
        }))
        
        // 计算活跃 workers
        this.activeWorkers = this.workers.filter(w => w.alive).length
        
        this.statusMessage = '✅ 连接正常'
        this.statusClass = 'connected'
      } catch (error) {
        console.error('Failed to fetch workers:', error)
        this.statusMessage = `❌ 连接失败: ${error.message}`
        this.statusClass = 'error'
      } finally {
        this.loading = false
      }
    },
    
    openLogStream(worker) {
      if (worker.log_stream_url) {
        // 修复 WebSocket URL 中的 0.0.0.0
        let wsUrl = worker.log_stream_url
        if (wsUrl.includes('0.0.0.0')) {
          // 替换为当前主机地址
          const currentHost = window.location.hostname
          wsUrl = wsUrl.replace('0.0.0.0', currentHost)
          console.log(`Fixed WebSocket URL: ${worker.log_stream_url} -> ${wsUrl}`)
        }
        
        // 打开日志查看器页面
        const url = `/log-viewer.html?ws=${encodeURIComponent(wsUrl)}&symbol=${worker.stats.symbol}`
        window.open(url, '_blank', 'width=1400,height=900')
      }
    },
    
    async openHistoryLogs(worker) {
      const apiUrl = import.meta.env.VITE_WORKER_API || '/api/strategy/workers'
      const baseUrl = apiUrl.replace('/workers', '')
      const logUrl = `${baseUrl}/workers/${worker.key}/logs?tail=1000`
      
      try {
        // 获取 token
        const token = localStorage.getItem('access_token')
        if (!token) {
          alert('❌ 请先登录')
          return
        }
        
        console.log('📋 准备打开历史日志:', logUrl)
        console.log('🔑 使用 token:', token.substring(0, 20) + '...')
        
        // 使用 axios 检查日志是否存在（会自动带上 Authorization header）
        const axios = (await import('axios')).default
        
        try {
          const response = await axios.get(logUrl, {
            headers: {
              'Authorization': `Bearer ${token}`
            },
            validateStatus: (status) => status < 500  // 不要在 4xx 时抛出异常
          })
          
          if (response.status === 200) {
            // 日志存在，构建带 token 的 URL（通过 query 参数或新标签页）
            console.log('✅ 日志可用，打开新标签页')
            
            // 方案1: 直接在新标签页打开（浏览器会自动带上 cookie，但不会带 token）
            // 所以我们需要用另一种方式
            
            // 方案2: 创建一个临时页面来显示日志内容
            const logWindow = window.open('', '_blank')
            logWindow.document.write(`
              <html>
                <head><title>历史日志 - ${worker.key}</title></head>
                <body style="margin:0;padding:20px;font-family:monospace;background:#1e1e1e;color:#d4d4d4;">
                  <pre style="white-space:pre-wrap;word-wrap:break-word;">${response.data}</pre>
                </body>
              </html>
            `)
            logWindow.document.close()
          } else if (response.status === 404) {
            // 日志文件不存在
            const errorMessage = response.data?.detail || '日志文件尚未生成'
            alert(
              `📂 历史日志暂不可用\n\n` +
              `${errorMessage}\n\n` +
              `💡 建议：请先使用「实时日志」功能`
            )
          } else if (response.status === 401 || response.status === 403) {
            // 认证/授权失败
            alert(`❌ 认证失败 (HTTP ${response.status})\n\n请重新登录`)
          } else {
            alert(`❌ 获取日志失败 (HTTP ${response.status})\n\n${response.data?.detail || '请稍后重试'}`)
          }
        } catch (axiosError) {
          console.error('Axios request failed:', axiosError)
          alert(`❌ 请求失败: ${axiosError.message}\n\n请检查网络连接`)
        }
      } catch (error) {
        console.error('Error opening history logs:', error)
        alert(
          `❌ 无法打开历史日志\n\n` +
          `错误: ${error.message}\n\n` +
          `请检查网络连接或稍后重试`
        )
      }
    }
  }
}
</script>

<style scoped>
.strategy-workers-page {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h1 {
  margin: 0;
  font-size: 28px;
}

.refresh-btn {
  padding: 10px 20px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.refresh-btn:hover:not(:disabled) {
  background: #45a049;
}

.refresh-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.api-status {
  padding: 12px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.api-status.connected {
  background: #e8f5e9;
  color: #2e7d32;
}

.api-status.connecting {
  background: #fff3e0;
  color: #e65100;
}

.api-status.error {
  background: #ffebee;
  color: #c62828;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: currentColor;
}

.deployment-mode {
  margin-left: auto;
  font-size: 12px;
  padding: 4px 8px;
  background: rgba(0,0,0,0.1);
  border-radius: 4px;
}

.workers-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  gap: 15px;
}

.stat-card.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.stat-icon {
  font-size: 32px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
}

.stat-label {
  font-size: 14px;
  opacity: 0.8;
}

.workers-section h2 {
  margin-bottom: 20px;
}

.loading-state, .empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.hint {
  font-size: 12px;
  margin-top: 10px;
}

.workers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.worker-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border: 2px solid #e0e0e0;
}

.worker-card.alive {
  border-color: #4CAF50;
}

.worker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.worker-status {
  font-size: 14px;
  padding: 4px 12px;
  border-radius: 20px;
  background: #ffebee;
  color: #c62828;
}

.worker-status.online {
  background: #e8f5e9;
  color: #2e7d32;
}

.worker-engine {
  font-size: 12px;
  padding: 4px 8px;
  background: #f5f5f5;
  border-radius: 4px;
  color: #666;
}

.worker-info {
  margin-bottom: 15px;
}

.worker-symbol {
  font-size: 24px;
  font-weight: bold;
  color: #1976d2;
  margin-bottom: 5px;
}

.worker-strategy {
  font-size: 14px;
  color: #666;
}

.worker-stats {
  background: #f9f9f9;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 15px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
}

.stat-item .label {
  color: #666;
}

.stat-item .value {
  font-weight: 600;
  color: #333;
}

.worker-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.log-btn {
  flex: 1;
  min-width: 120px;
  padding: 10px;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.log-btn.realtime {
  background: #2196F3;
}

.log-btn.realtime:hover {
  background: #1976d2;
}

.log-btn.history {
  background: #FF9800;
}

.log-btn.history:hover {
  background: #F57C00;
}

.no-stream {
  flex: 1;
  text-align: center;
  color: #999;
  font-size: 11px;
  padding: 10px;
}
</style>
