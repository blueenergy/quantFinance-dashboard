<template>
  <div class="live-logs-container">
    <div class="header">
      <h2>🚀 Live Strategy Execution</h2>
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
      <!-- Metrics Cards -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Call Count</div>
          <div class="metric-value">{{ currentLog.call_count || 0 }}</div>
          <div class="metric-unit">executions</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Data Bars</div>
          <div class="metric-value">{{ currentLog.data_bars || 0 }}</div>
          <div class="metric-unit">bars</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Latest Bar</div>
          <div class="metric-value">{{ formatTime(currentLog.latest_bar) }}</div>
          <div class="metric-unit">{{ currentLog.mode === 'live' ? 'LIVE 🟢' : 'BACKTEST' }}</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Current Price</div>
          <div class="metric-value">¥{{ formatPrice(currentLog.price) }}</div>
          <div class="metric-unit">{{ currentLog.strategy }}</div>
        </div>
      </div>

      <!-- Live Log Stream -->
      <div class="log-stream-section">
        <div class="stream-header">
          <h3>📊 Live Execution Stream</h3>
          <span class="update-indicator" :class="{ 'updating': isUpdating }">
            {{ isUpdating ? '🔄 Updating...' : '✓ Connected' }}
          </span>
        </div>

        <div class="log-stream">
          <div
            v-for="(entry, index) in logHistory"
            :key="`${entry.timestamp}-${index}`"
            class="log-entry"
            :class="{ 'latest': index === 0 }"
          >
            <span class="entry-time">{{ formatDateTime(entry.timestamp) }}</span>
            <span class="entry-calls">{{ entry.call_count }}x</span>
            <span class="entry-bars">{{ entry.data_bars }} bars</span>
            <span class="entry-price">¥{{ formatPrice(entry.price) }}</span>
            <span class="entry-bar-time">{{ formatTime(entry.latest_bar) }}</span>
          </div>

          <div v-if="logHistory.length === 0" class="empty-state">
            Waiting for execution logs... 🎯
          </div>
        </div>
      </div>

      <!-- Statistics -->
      <div class="stats-section" v-if="stats">
        <h3>📈 Statistics</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Total Logs:</span>
            <span class="stat-value">{{ stats.total_logs || 0 }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Avg Calls:</span>
            <span class="stat-value">{{ (stats.avg_call_count || 0).toFixed(0) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Max Calls:</span>
            <span class="stat-value">{{ stats.max_call_count || 0 }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Avg Bars:</span>
            <span class="stat-value">{{ (stats.avg_data_bars || 0).toFixed(0) }}</span>
          </div>
        </div>
      </div>

      <!-- Strategy Messages/Alerts Section (NEW) -->
      <div class="messages-section">
        <div class="messages-header">
          <h3>💬 Strategy Messages & Analysis</h3>
          <div class="message-filters">
            <button
              v-for="filter in messageFilters"
              :key="filter"
              :class="['filter-btn', { active: selectedMessageFilter === filter }]"
              @click="selectedMessageFilter = filter"
            >
              {{ filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1) }}
            </button>
          </div>
        </div>

        <div class="messages-stream">
          <div
            v-for="(msg, index) in filteredMessages"
            :key="`${msg.timestamp}-${index}`"
            :class="['message-item', `msg-${msg.message_type}`]"
          >
            <div class="message-header">
              <span class="msg-type-badge" :class="`badge-${msg.message_type}`">
                {{ getMessageIcon(msg.message_type) }} {{ msg.message_type }}
              </span>
              <span class="msg-time">{{ formatDateTime(msg.timestamp) }}</span>
              <span class="msg-bar">Bar #{{ msg.bar_index }}</span>
            </div>
            <div class="message-content">
              <p class="message-text">{{ msg.message }}</p>
              <div v-if="msg.data && Object.keys(msg.data).length > 0" class="message-data">
                <span v-for="(val, key) in msg.data" :key="key" class="data-item">
                  <strong>{{ key }}:</strong> {{ formatValue(val) }}
                </span>
              </div>
            </div>
            <div class="message-footer">
              <span class="msg-price">Price: ¥{{ formatPrice(msg.current_price) }}</span>
            </div>
          </div>

          <div v-if="filteredMessages.length === 0" class="empty-messages">
            No messages yet for this symbol 🤐
          </div>
        </div>
      </div>
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
      API_BASE: import.meta.env.VITE_API_BASE || '/api'
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
        this.connectWebSocket()
        this.loadStats()
        this.loadMessages()
        
        if (this.messagesRefreshInterval) clearInterval(this.messagesRefreshInterval)
        this.messagesRefreshInterval = setInterval(() => {
          this.loadMessages()
        }, 5000)
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
            const message = JSON.parse(event.data)

            if (message.type === 'init' || message.type === 'update') {
              const data = message.data || {}
              this.currentLog = data
              this.isUpdating = true

              if (data.timestamp) {
                this.logHistory.unshift({
                  ...data,
                  timestamp: data.timestamp
                })

                if (this.logHistory.length > 50) {
                  this.logHistory.pop()
                }
              }

              setTimeout(() => {
                this.isUpdating = false
              }, 500)
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
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
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.stream-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 2px solid #f0f0f0;
  background: #fafafa;
}

.stream-header h3 {
  margin: 0;
  color: #333;
  font-size: 16px;
}

.update-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #4CAF50;
  font-weight: 600;
}

.update-indicator.updating {
  color: #FF9800;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.log-stream {
  max-height: 400px;
  overflow-y: auto;
  display: flex;
  flex-direction: column-reverse;
}

.log-entry {
  display: grid;
  grid-template-columns: 120px 80px 100px 100px 1fr;
  gap: 12px;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid #f0f0f0;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #666;
  transition: all 0.2s ease;
}

.log-entry:hover {
  background-color: #f9f9f9;
}

.log-entry.latest {
  background-color: #e3f2fd;
  font-weight: 600;
  border-left: 3px solid #2196F3;
}

.entry-time {
  color: #999;
}

.entry-calls {
  color: #2196F3;
  font-weight: 600;
}

.entry-bars {
  color: #4CAF50;
}

.entry-price {
  color: #FF9800;
  font-weight: 600;
}

.entry-bar-time {
  color: #666;
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: #999;
  font-size: 14px;
}

.stats-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.stats-section h3 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #333;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 6px;
  border-left: 3px solid #2196F3;
}

.stat-label {
  font-size: 11px;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #2196F3;
}

.empty-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  background: white;
  border-radius: 8px;
}

.placeholder-content {
  text-align: center;
  color: #999;
}

.placeholder-content .icon {
  font-size: 48px;
  margin-bottom: 10px;
}

.placeholder-content p {
  margin: 10px 0;
  font-size: 14px;
}

.placeholder-content .loading {
  font-size: 12px;
  color: #2196F3;
  margin-top: 15px;
}

/* Scrollbar styling */
.log-stream::-webkit-scrollbar {
  width: 6px;
}

.log-stream::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.log-stream::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.log-stream::-webkit-scrollbar-thumb:hover {
  background: #a0a0a0;
}

@media (max-width: 768px) {
  .header {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }

  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .log-entry {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .entry-time,
  .entry-calls,
  .entry-bars,
  .entry-price,
  .entry-bar-time {
    display: inline;
  }

  .entry-time::after {
    content: ' | ';
    margin: 0 4px;
    color: #ddd;
  }
}

/* Messages Section Styles */
.messages-section {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.messages-header {
  padding: 15px 20px;
  border-bottom: 2px solid #f0f0f0;
  background: #fafafa;
}

.messages-header h3 {
  margin: 0 0 12px 0;
  color: #333;
  font-size: 16px;
}

.message-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #666;
}

.filter-btn:hover {
  border-color: #2196F3;
  color: #2196F3;
}

.filter-btn.active {
  background: #2196F3;
  color: white;
  border-color: #2196F3;
}

.messages-stream {
  max-height: 500px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.message-item {
  padding: 15px 20px;
  border-bottom: 1px solid #f0f0f0;
  transition: all 0.2s ease;
}

.message-item:hover {
  background-color: #f9f9f9;
}

.message-item.msg-buy {
  border-left: 4px solid #4CAF50;
  background-color: #f1f8f5;
}

.message-item.msg-sell {
  border-left: 4px solid #f44336;
  background-color: #fef5f5;
}

.message-item.msg-signal {
  border-left: 4px solid #FF9800;
  background-color: #fff8f1;
}

.message-item.msg-analysis {
  border-left: 4px solid #2196F3;
  background-color: #f0f7ff;
}

.message-item.msg-alert,
.message-item.msg-warning {
  border-left: 4px solid #FFC107;
  background-color: #fffbf0;
}

.message-item.msg-error {
  border-left: 4px solid #f44336;
  background-color: #ffebee;
}

.message-header {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.msg-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  background: white;
  border: 1px solid #ddd;
}

.badge-buy {
  color: #4CAF50;
  border-color: #4CAF50;
}

.badge-sell {
  color: #f44336;
  border-color: #f44336;
}

.badge-signal {
  color: #FF9800;
  border-color: #FF9800;
}

.badge-analysis {
  color: #2196F3;
  border-color: #2196F3;
}

.badge-alert,
.badge-warning {
  color: #FFC107;
  border-color: #FFC107;
}

.badge-error {
  color: #f44336;
  border-color: #f44336;
}

.msg-time {
  font-size: 12px;
  color: #999;
}

.msg-bar {
  font-size: 11px;
  color: #2196F3;
  font-weight: 600;
}

.message-content {
  margin: 8px 0;
}

.message-text {
  margin: 0;
  font-size: 14px;
  color: #333;
  font-weight: 500;
  line-height: 1.4;
}

.message-data {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.data-item {
  font-size: 12px;
  color: #666;
  font-family: 'Courier New', monospace;
}

.data-item strong {
  color: #333;
}

.message-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  font-size: 11px;
  color: #999;
}

.msg-price {
  font-weight: 600;
  color: #2196F3;
}

.empty-messages {
  padding: 40px 20px;
  text-align: center;
  color: #999;
  font-size: 14px;
}

.messages-stream::-webkit-scrollbar {
  width: 6px;
}

.messages-stream::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.messages-stream::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.messages-stream::-webkit-scrollbar-thumb:hover {
  background: #a0a0a0;
}
</style>
