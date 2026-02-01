<template>
  <div class="live-logs-container">
    <div class="header">
      <h2>🚀 Live Strategy Logs</h2>
      <div class="symbol-selector">
        <label for="symbol-input">Select Symbol:</label>
        <select v-model="selectedSymbol" @change="switchSymbol" id="symbol-input">
          <option value="">-- Select a symbol --</option>
          <option v-for="sym in activeSymbols" :key="sym" :value="sym">
            {{ sym }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="selectedSymbol" class="logs-section">
      <!-- Live Log Stream -->
      <div class="log-stream-section">
        <div class="stream-header">
          <h3>📊 Live Log Stream</h3>
          <span class="update-indicator" :class="{ 'updating': isUpdating }">
            {{ isUpdating ? '🔄 Receiving...' : '✓ Connected' }}
          </span>
        </div>

        <div class="log-stream" ref="logStream">
          <div
            v-for="(entry, index) in logHistory"
            :key="`${entry.timestamp}-${index}`"
            class="log-entry"
          >
            <span class="entry-time">{{ formatDateTime(entry.timestamp) }}</span>
            <span class="entry-level" :class="`level-${entry.level}`">{{ entry.level }}</span>
            <span class="entry-message">{{ entry.message }}</span>
          </div>

          <div v-if="logHistory.length === 0" class="empty-state">
            Waiting for execution logs... 🎯
          </div>
        </div>
      </div>

      <!-- Other sections can be kept or removed as needed -->
      
    </div>

    <div v-else class="empty-placeholder">
      <div class="placeholder-content">
        <div class="icon">🎯</div>
        <p>Select a symbol to view live strategy execution logs</p>
        <div v-if="activeSymbols.length === 0" class="loading">
          Loading active symbols...
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LiveStrategyLogs',
  data() {
    return {
      selectedSymbol: '',
      activeSymbols: [],
      currentLog: {},
      logHistory: [],
      stats: null,
      strateggyMessages: [],
      selectedMessageFilter: 'all',
      messageFilters: ['all', 'analysis', 'signal', 'buy', 'sell', 'alert', 'warning', 'error'],
      ws: null,
      isConnected: false,
      isUpdating: false,
      reconnectAttempts: 0,
      maxReconnectAttempts: 5,
      pollInterval: null,
      messagesRefreshInterval: null,
      API_BASE: import.meta.env.VITE_API_BASE || '/api',
      
      // Direct WebSocket connection settings
      useDirectWebSocket: true,  // 设置为 true 使用直接 WebSocket 连接
      workerWebSocketUrl: null,  // Worker 的 WebSocket URL
      
      // 获取 Worker 信息的 API - 三种方式设置（优先级从高到低）：
      // 1. .env 文件: VITE_WORKER_API=http://remote-server:5000/api/workers
      // 2. 代码硬编码: apiWorkerUrl: 'http://192.168.1.100:5000/api/workers'
      // 3. 后端代理（默认）: '/api/workers'
      apiWorkerUrl: this.getWorkerApiUrl()
    }
  },
  mounted() {
    this.loadActiveSymbols()
    this.setupPolling()
  },
  beforeUnmount() {
    this.disconnectWebSocket()
    if (this.pollInterval) clearInterval(this.pollInterval)
    if (this.messagesRefreshInterval) clearInterval(this.messagesRefreshInterval)
  },
  methods: {
    getWorkerApiUrl() {
      // 三种方式设置 Worker API URL（优先级从高到低）
      
      // 方式 1: 环境变量 .env 文件
      if (import.meta.env.VITE_WORKER_API) {
        console.log('✅ Using VITE_WORKER_API from .env:', import.meta.env.VITE_WORKER_API)
        return import.meta.env.VITE_WORKER_API
      }
      
      // 方式 2: 代码硬编码（如果没有 .env 文件，修改这里）
      // 例如: 'http://192.168.1.100:5000/api/workers'
      const hardcodedUrl = null  // 改为你的 URL 字符串来硬编码
      if (hardcodedUrl) {
        console.log('✅ Using hardcoded Worker API URL:', hardcodedUrl)
        return hardcodedUrl
      }
      
      // 方式 3: 后端 API 代理（默认，不需要额外配置）
      console.log('ℹ️  Using backend API proxy: /api/workers')
      return '/api/workers'
    },

    async loadActiveSymbols() {
      try {
        const response = await fetch(`${this.API_BASE}/live-logs/symbols`, {
          headers: this.getAuthHeaders()
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const data = await response.json()
        this.activeSymbols = data.symbols || []

        if (this.activeSymbols.length > 0 && !this.selectedSymbol) {
          this.selectedSymbol = this.activeSymbols[0]
          this.switchSymbol()
        }
      } catch (error) {
        console.error('Failed to load active symbols:', error)
      }
    },

    switchSymbol() {
      if (this.selectedSymbol) {
        this.disconnectWebSocket()
        this.logHistory = []
        this.currentLog = {}
        this.strateggyMessages = []
        
        if (this.useDirectWebSocket) {
          // 直接连接 Worker 的 WebSocket
          this.fetchWorkerWebSocketUrl()
        } else {
          // 使用后端 API 代理
          this.connectWebSocket()
        }
        
        this.loadStats()
        this.loadMessages()
        
        if (this.messagesRefreshInterval) clearInterval(this.messagesRefreshInterval)
        this.messagesRefreshInterval = setInterval(() => {
          this.loadMessages()
        }, 5000)
      }
    },

    async fetchWorkerWebSocketUrl() {
      try {
        // 从 API 获取所有 Workers 的信息，找到匹配当前 symbol 的 Worker
        const response = await fetch(this.apiWorkerUrl, {
          headers: this.getAuthHeaders()
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const data = await response.json()
        const workers = data.workers || {}
        
        // 查找匹配当前 symbol 的 Worker
        let foundWorker = null
        for (const [key, worker] of Object.entries(workers)) {
          if (worker.stats && worker.stats.symbol === this.selectedSymbol) {
            foundWorker = worker
            break
          }
        }

        if (foundWorker && foundWorker.log_stream_url) {
          this.workerWebSocketUrl = foundWorker.log_stream_url
          console.log(`Found Worker WebSocket URL for ${this.selectedSymbol}: ${this.workerWebSocketUrl}`)
          this.connectDirectWebSocket()
        } else {
          console.warn(`No Worker found for symbol ${this.selectedSymbol}`)
          // 降级到后端 API 代理
          this.useDirectWebSocket = false
          this.connectWebSocket()
        }
      } catch (error) {
        console.error('Failed to fetch Worker WebSocket URL:', error)
        // 降级到后端 API 代理
        this.useDirectWebSocket = false
        this.connectWebSocket()
      }
    },

    connectDirectWebSocket() {
      if (!this.workerWebSocketUrl) return

      try {
        this.ws = new WebSocket(this.workerWebSocketUrl)

        this.ws.onopen = () => {
          console.log(`✅ Direct WebSocket connected: ${this.workerWebSocketUrl}`)
          this.isConnected = true
          this.reconnectAttempts = 0
        }

        this.ws.onmessage = (event) => {
          try {
            const logData = JSON.parse(event.data)
            
            // 处理来自 quant-strategy-manager 的日志格式
            const logEntry = {
              timestamp: new Date(logData.timestamp).getTime() / 1000,
              level: logData.level,
              message: logData.message,
              logger: logData.logger_name,
              module: logData.module
            }

            this.logHistory.push(logEntry)
            this.isUpdating = true

            // 保持历史记录在合理的大小
            if (this.logHistory.length > 200) {
              this.logHistory.shift()
            }

            // 自动滚动到底部
            const streamEl = this.$refs.logStream
            if (streamEl) {
              const isScrolledToBottom = streamEl.scrollHeight - streamEl.clientHeight <= streamEl.scrollTop + 20
              if (isScrolledToBottom) {
                this.$nextTick(() => {
                  this.scrollToBottom()
                })
              }
            }

            setTimeout(() => {
              this.isUpdating = false
            }, 300)
          } catch (error) {
            console.error('Failed to parse log message:', error)
          }
        }

        this.ws.onerror = (error) => {
          console.error('❌ Direct WebSocket error:', error)
          this.isConnected = false
        }

        this.ws.onclose = () => {
          console.log(`Direct WebSocket disconnected`)
          this.isConnected = false
          this.attemptReconnect()
        }
      } catch (error) {
        console.error('Failed to connect to direct WebSocket:', error)
      }
    },

    connectWebSocket() {
      if (!this.selectedSymbol) return

      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsUrl = `${protocol}//${window.location.host}/api/ws/strategy-logs/${this.selectedSymbol}`

        this.ws = new WebSocket(wsUrl)

        this.ws.onopen = () => {
          console.log(`WebSocket connected for ${this.selectedSymbol}`)
          this.isConnected = true
          this.reconnectAttempts = 0
        }

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            // Handle historical logs, replacing current history
            if (message.type === 'history') {
              this.logHistory = message.data || [];
              this.scrollToBottom();
            }
            
            // Handle a new streamed log entry by appending it
            if (message.type === 'stream') {
              this.logHistory.push(message.data);
              this.isUpdating = true;

              // Keep the history to a reasonable size
              if (this.logHistory.length > 200) {
                this.logHistory.shift(); // Remove the oldest entry
              }
              
              // Scroll to bottom only if user is already near the bottom
              const streamEl = this.$refs.logStream;
              const isScrolledToBottom = streamEl.scrollHeight - streamEl.clientHeight <= streamEl.scrollTop + 20;
              if (isScrolledToBottom) {
                this.$nextTick(() => {
                  this.scrollToBottom();
                });
              }

              setTimeout(() => { this.isUpdating = false; }, 300);
            }

          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.isConnected = false
        }

        this.ws.onclose = () => {
          console.log(`WebSocket disconnected for ${this.selectedSymbol}`)
          this.isConnected = false
          this.attemptReconnect()
        }
      } catch (error) {
        console.error('Failed to connect WebSocket:', error)
      }
    },

    attemptReconnect() {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`)
        setTimeout(() => this.connectWebSocket(), delay)
      }
    },

    disconnectWebSocket() {
      if (this.ws) {
        this.ws.close()
        this.ws = null
        this.isConnected = false
      }
    },

    setupPolling() {
      this.pollInterval = setInterval(() => {
        this.loadActiveSymbols()
      }, 30000)
    },

    async loadStats() {
      if (!this.selectedSymbol) return

      try {
        const response = await fetch(`${this.API_BASE}/live-logs/stats?symbol=${this.selectedSymbol}`, {
          headers: this.getAuthHeaders()
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const data = await response.json()
        this.stats = data.data || null
      } catch (error) {
        console.error('Failed to load stats:', error)
      }
    },

    getAuthHeaders() {
      const token = localStorage.getItem('access_token')
      return {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    },

    formatPrice(price) {
      if (!price) return '0.00'
      return parseFloat(price).toFixed(2)
    },

    formatTime(dateStr) {
      if (!dateStr) return '--:--'
      try {
        const match = dateStr.match(/(\d{2}):(\d{2}):(\d{2})/)
        if (match) {
          return `${match[1]}:${match[2]}`
        }
      } catch (e) {}
      return dateStr
    },

    formatDateTime(timestamp) {
      if (!timestamp) return 'N/A'
      try {
        const date = new Date(timestamp * 1000)
        return date.toLocaleTimeString()
      } catch (e) {
        return 'N/A'
      }
    },

    async loadMessages() {
      if (!this.selectedSymbol) return

      try {
        const response = await fetch(`${this.API_BASE}/live-logs/messages?symbol=${this.selectedSymbol}&limit=30`, {
          headers: this.getAuthHeaders()
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const data = await response.json()
        this.strateggyMessages = data.data || []
      } catch (error) {
        console.error('Failed to load messages:', error)
      }
    },

    getMessageIcon(messageType) {
      const icons = {
        'analysis': '🔍',
        'signal': '🚨',
        'buy': '🟢',
        'sell': '🔴',
        'alert': '⚠️',
        'warning': '⚡',
        'error': '❌',
        'info': 'ℹ️'
      }
      return icons[messageType] || '📝'
    },

    formatValue(val) {
      if (typeof val === 'number') {
        return val.toFixed(2)
      }
      return String(val)
    },
    scrollToBottom() {
      const streamEl = this.$refs.logStream;
      if (streamEl) {
        streamEl.scrollTop = streamEl.scrollHeight;
      }
    }
  },
  computed: {
    filteredMessages() {
      if (this.selectedMessageFilter === 'all') {
        return this.strateggyMessages
      }
      return this.strateggyMessages.filter(msg => msg.message_type === this.selectedMessageFilter)
    }
  }
}
</script>

<style scoped>
.live-logs-container {
  padding: 20px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  min-height: calc(100vh - 100px);
  border-radius: 12px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header h2 {
  margin: 0;
  color: #333;
  font-size: 24px;
}

.symbol-selector {
  display: flex;
  align-items: center;
  gap: 10px;
}

.symbol-selector label {
  color: #666;
  font-weight: 500;
}

.symbol-selector select {
  padding: 8px 12px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.symbol-selector select:hover {
  border-color: #2196F3;
}

.symbol-selector select:focus {
  outline: none;
  border-color: #2196F3;
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
}

.logs-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
}

.metric-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  border-left: 4px solid #2196F3;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.metric-label {
  font-size: 12px;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
  font-weight: 600;
}

.metric-value {
  font-size: 32px;
  font-weight: bold;
  color: #2196F3;
  margin-bottom: 4px;
}

.metric-unit {
  font-size: 11px;
  color: #666;
  text-transform: uppercase;
}

.log-stream-section {
  margin-top: 20px;
}

.stream-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 2px solid #eee;
}

.stream-header h3 {
  margin: 0;
  color: #333;
}

.update-indicator {
  font-size: 12px;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: 12px;
  background-color: #e8f5e9;
  color: #4CAF50;
  transition: all 0.3s ease;
}

.update-indicator.updating {
  background-color: #ffecb3;
  color: #FF9800;
}

.log-stream {
  background: #0d1117; /* Dark background for logs */
  color: #c9d1d9;
  padding: 15px;
  border-radius: 8px;
  height: 60vh; /* Taller log view */
  overflow-y: auto;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 13px;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
  scroll-behavior: smooth;
}

.log-entry {
  display: flex;
  align-items: flex-start;
  gap: 15px;
  padding: 6px 10px;
  border-radius: 4px;
  transition: background-color 0.2s;
  white-space: pre-wrap;
  word-break: break-word;
}

.log-entry:hover {
  background-color: #161b22;
}

.log-entry .entry-time {
  color: #8b949e;
  font-weight: 600;
}

.log-entry .entry-level {
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  text-transform: uppercase;
}

.log-entry .entry-level.level-INFO { background-color: #2196F3; color: white; }
.log-entry .entry-level.level-WARNING { background-color: #FFC107; color: #333; }
.log-entry .entry-level.level-ERROR { background-color: #F44336; color: white; }
.log-entry .entry-level.level-DEBUG { background-color: #9C27B0; color: white; }


.log-entry .entry-message {
  flex-grow: 1;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #8b949e;
  font-style: italic;
}

/* Remove old metric cards and log history display */
.metrics-grid,
.log-stream .log-entry .entry-calls,
.log-stream .log-entry .entry-bars,
.log-stream .log-entry .entry-price,
.log-stream .log-entry .entry-bar-time {
  display: none;
}

</style>
