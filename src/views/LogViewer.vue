<template>
  <div class="log-viewer">
    <div class="log-header">
      <h2>📺 实时日志 - {{ symbol }}</h2>
      <div class="header-controls">
        <span class="ws-status" :class="wsStatusClass">{{ wsStatusText }}</span>
        <button @click="toggleAutoScroll" :class="{ active: autoScroll }">
          {{ autoScroll ? '🔒 自动滚动' : '🔓 手动滚动' }}
        </button>
        <button @click="clearLogs">🗑️ 清空</button>
        <button @click="reconnect">🔄 重连</button>
      </div>
    </div>

    <div class="log-info">
      <div class="info-item">
        <span class="label">WebSocket:</span>
        <code class="ws-url">{{ wsUrl }}</code>
      </div>
      <div class="info-item">
        <span class="label">总消息:</span>
        <span class="value">{{ messageCount }}</span>
      </div>
      <div class="info-item" v-if="historyCount > 0">
        <span class="label">历史:</span>
        <span class="value">📜 {{ historyCount }}</span>
      </div>
      <div class="info-item">
        <span class="label">连接时长:</span>
        <span class="value">{{ connectionDuration }}</span>
      </div>
    </div>

    <div class="log-container" ref="logContainer">
      <div v-if="logs.length === 0" class="empty-state">
        <p v-if="wsStatus === 'connecting'">⏳ 正在连接...</p>
        <p v-else-if="wsStatus === 'error'">❌ 连接失败</p>
        <p v-else>📭 暂无日志消息</p>
      </div>
      
      <div 
        v-for="(log, index) in logs" 
        :key="index"
        class="log-entry"
        :class="getLogClass(log)"
      >
        <span class="log-time">{{ formatTime(log.timestamp) }}</span>
        <span class="log-level" v-if="log.level">{{ log.level }}</span>
        <span v-if="log.isHistory" class="history-badge" title="历史日志">📜</span>
        <span class="log-message">{{ log.message }}</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LogViewer',
  data() {
    return {
      wsUrl: '',
      symbol: '',
      ws: null,
      wsStatus: 'disconnected', // disconnected, connecting, connected, error
      logs: [],
      messageCount: 0,
      autoScroll: true,
      connectionStartTime: null,
      connectionDuration: '00:00',
      durationInterval: null,
      historyCount: 0, // 📜 历史日志数量
      receivingHistory: false, // 是否正在接收历史日志
    }
  },
  computed: {
    wsStatusClass() {
      return {
        'status-connected': this.wsStatus === 'connected',
        'status-connecting': this.wsStatus === 'connecting',
        'status-error': this.wsStatus === 'error',
        'status-disconnected': this.wsStatus === 'disconnected',
      }
    },
    wsStatusText() {
      const statusMap = {
        'connected': '🟢 已连接',
        'connecting': '🟡 连接中',
        'error': '🔴 连接失败',
        'disconnected': '⚫ 未连接',
      }
      return statusMap[this.wsStatus] || '未知'
    }
  },
  mounted() {
    // 从 URL 参数获取 WebSocket URL 和 symbol
    const params = new URLSearchParams(window.location.search)
    this.wsUrl = params.get('ws') || ''
    this.symbol = params.get('symbol') || '未知'
    
    // 修复 WebSocket URL 中的 0.0.0.0
    if (this.wsUrl.includes('0.0.0.0')) {
      const currentHost = window.location.hostname
      this.wsUrl = this.wsUrl.replace('0.0.0.0', currentHost)
      console.log(`Fixed WebSocket URL to: ${this.wsUrl}`)
    }
    
    if (this.wsUrl) {
      this.connect()
    } else {
      this.wsStatus = 'error'
      this.logs.push({
        timestamp: new Date(),
        level: 'ERROR',
        message: '未提供 WebSocket URL'
      })
    }
  },
  beforeUnmount() {
    this.disconnect()
    if (this.durationInterval) {
      clearInterval(this.durationInterval)
    }
  },
  methods: {
    connect() {
      this.wsStatus = 'connecting'
      this.connectionStartTime = Date.now()
      
      // 启动时长计时器
      this.durationInterval = setInterval(() => {
        if (this.connectionStartTime) {
          const duration = Math.floor((Date.now() - this.connectionStartTime) / 1000)
          const minutes = Math.floor(duration / 60)
          const seconds = duration % 60
          this.connectionDuration = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        }
      }, 1000)
      
      try {
        this.ws = new WebSocket(this.wsUrl)
        
        this.ws.onopen = () => {
          this.wsStatus = 'connected'
          this.receivingHistory = true // 开始接收历史日志
          this.addLog('INFO', '✅ WebSocket 连接成功')
          console.log('✅ WebSocket connected:', this.wsUrl)
        }
        
        this.ws.onmessage = (event) => {
          this.messageCount++
          console.log('📨 Received WebSocket message:', event.data)
          
          try {
            // 尝试解析 JSON
            const data = JSON.parse(event.data)
            const isHistory = this.receivingHistory
            
            // 添加日志（可能带历史标记）
            this.addLog(
              data.level || 'INFO', 
              data.message || event.data, 
              data.timestamp,
              isHistory
            )
            
            // 统计历史日志
            if (isHistory) {
              this.historyCount++
              // 假设历史日志在开始时一次性发送，设置一个小延迟后认为历史日志接收完毕
              clearTimeout(this._historyTimeout)
              this._historyTimeout = setTimeout(() => {
                this.receivingHistory = false
                if (this.historyCount > 0) {
                  this.addLog('INFO', `📜 已加载 ${this.historyCount} 条历史日志`, null, false)
                }
              }, 500)
            }
          } catch (e) {
            // 如果不是 JSON，直接显示原始消息
            this.addLog('INFO', event.data)
          }
        }
        
        this.ws.onerror = (error) => {
          this.wsStatus = 'error'
          console.error('❌ WebSocket error:', error)
          this.addLog('ERROR', `❌ WebSocket 错误: ${error.message || '连接失败'}`)
        }
        
        this.ws.onclose = () => {
          this.wsStatus = 'disconnected'
          this.addLog('WARN', '⚠️ WebSocket 连接已关闭')
          if (this.durationInterval) {
            clearInterval(this.durationInterval)
          }
        }
      } catch (error) {
        this.wsStatus = 'error'
        this.addLog('ERROR', `连接失败: ${error.message}`)
      }
    },
    
    disconnect() {
      if (this.ws) {
        this.ws.close()
        this.ws = null
      }
    },
    
    reconnect() {
      this.addLog('INFO', '🔄 重新连接...')
      this.disconnect()
      setTimeout(() => {
        this.connect()
      }, 500)
    },
    
    addLog(level, message, timestamp = null, isHistory = false) {
      this.logs.push({
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        level,
        message,
        isHistory // 📜 标记是否为历史日志
      })
      
      // 限制日志数量，避免内存占用过高
      if (this.logs.length > 1000) {
        this.logs = this.logs.slice(-1000)
      }
      
      // 自动滚动到底部
      if (this.autoScroll) {
        this.$nextTick(() => {
          const container = this.$refs.logContainer
          if (container) {
            container.scrollTop = container.scrollHeight
          }
        })
      }
    },
    
    clearLogs() {
      this.logs = []
      this.messageCount = 0
      this.historyCount = 0
    },
    
    toggleAutoScroll() {
      this.autoScroll = !this.autoScroll
    },
    
    formatTime(timestamp) {
      if (!timestamp) return ''
      const date = new Date(timestamp)
      return date.toLocaleTimeString('zh-CN', { hour12: false })
    },
    
    getLogClass(log) {
      const level = (log.level || '').toUpperCase()
      return {
        'log-error': level === 'ERROR',
        'log-warn': level === 'WARN' || level === 'WARNING',
        'log-info': level === 'INFO',
        'log-debug': level === 'DEBUG',
      }
    }
  }
}
</script>

<style scoped>
.log-viewer {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: 'Consolas', 'Monaco', monospace;
}

.log-header {
  padding: 15px 20px;
  background: #252526;
  border-bottom: 1px solid #3e3e42;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.log-header h2 {
  margin: 0;
  font-size: 18px;
  color: #fff;
}

.header-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.ws-status {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 600;
}

.status-connected {
  background: #1e4620;
  color: #4ec9b0;
}

.status-connecting {
  background: #4a3c1a;
  color: #dcdcaa;
}

.status-error {
  background: #5a1d1d;
  color: #f48771;
}

.status-disconnected {
  background: #333;
  color: #888;
}

.header-controls button {
  padding: 6px 12px;
  background: #3c3c3c;
  color: #ccc;
  border: 1px solid #555;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.header-controls button:hover {
  background: #4e4e4e;
  border-color: #666;
}

.header-controls button.active {
  background: #0e639c;
  border-color: #1177bb;
  color: #fff;
}

.log-info {
  padding: 10px 20px;
  background: #2d2d30;
  border-bottom: 1px solid #3e3e42;
  display: flex;
  gap: 30px;
  font-size: 12px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-item .label {
  color: #888;
}

.info-item .value {
  color: #4ec9b0;
  font-weight: 600;
}

.ws-url {
  color: #ce9178;
  background: #1e1e1e;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
}

.log-container {
  flex: 1;
  overflow-y: auto;
  padding: 10px 20px;
  font-size: 13px;
  line-height: 1.6;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
  font-size: 16px;
}

.log-entry {
  padding: 4px 0;
  display: flex;
  gap: 12px;
  border-bottom: 1px solid #2d2d30;
}

.log-time {
  color: #608b4e;
  min-width: 80px;
  flex-shrink: 0;
}

.log-level {
  min-width: 60px;
  flex-shrink: 0;
  font-weight: 600;
}

.history-badge {
  font-size: 10px;
  opacity: 0.6;
  flex-shrink: 0;
  cursor: help;
}

.log-message {
  flex: 1;
  word-break: break-word;
}

.log-error {
  background: rgba(244, 135, 113, 0.1);
}

.log-error .log-level {
  color: #f48771;
}

.log-warn {
  background: rgba(220, 220, 170, 0.1);
}

.log-warn .log-level {
  color: #dcdcaa;
}

.log-info .log-level {
  color: #4ec9b0;
}

.log-debug .log-level {
  color: #569cd6;
}

/* 滚动条样式 */
.log-container::-webkit-scrollbar {
  width: 10px;
}

.log-container::-webkit-scrollbar-track {
  background: #1e1e1e;
}

.log-container::-webkit-scrollbar-thumb {
  background: #424242;
  border-radius: 5px;
}

.log-container::-webkit-scrollbar-thumb:hover {
  background: #4e4e4e;
}
</style>
