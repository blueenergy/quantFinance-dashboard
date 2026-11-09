<template>
  <div class="strategy-workers-page">
    <div class="page-header">
      <h1>🚀 策略运行</h1>
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

    <!-- 统计 -->
    <div class="workers-stats">
      <div class="stat-card">
        <div class="stat-icon">📋</div>
        <div class="stat-content">
          <div class="stat-value">{{ cards.length }}</div>
          <div class="stat-label">策略配置</div>
        </div>
      </div>

      <div class="stat-card active">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <div class="stat-value">{{ activeWorkers }}</div>
          <div class="stat-label">运行中</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">⚙️</div>
        <div class="stat-content">
          <div class="stat-value">{{ inactiveCount }}</div>
          <div class="stat-label">已停止 / 未运行</div>
        </div>
      </div>
    </div>

    <!-- 策略列表 -->
    <div class="workers-section">
      <h2>策略列表</h2>

      <div v-if="loading && cards.length === 0" class="loading-state">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>

      <div v-else-if="cards.length === 0" class="empty-state">
        <p>📭 暂无策略配置</p>
        <p class="hint">在「策略配置」页添加策略后，这里会出现启停入口</p>
      </div>

      <div v-else class="workers-grid">
        <div
          v-for="card in cards"
          :key="card.key"
          class="worker-card"
          :class="{ alive: card.running, failed: card.state === '未运行' }"
        >
          <!-- 卡片头部 -->
          <div class="worker-header">
            <div class="worker-status" :class="statusClassFor(card)">
              {{ statusText(card) }}
            </div>
            <span
              v-if="accountWarning(card)"
              class="account-hint"
              :title="accountWarning(card)"
            >
              ⚠️ 未绑定账户
            </span>
            <div class="worker-engine">{{ card.worker?.stats?.engine || 'vnpy' }}</div>
          </div>

          <!-- 标的信息 -->
          <div class="worker-info">
            <div class="worker-symbol">{{ card.symbol }}</div>
            <div class="worker-strategy">{{ strategyName(card) }}</div>
            <div class="worker-account">{{ accountText(card) }}</div>
          </div>

          <!-- 状态 -->
          <div class="worker-stats">
            <div class="stat-item">
              <span class="label">状态:</span>
              <span class="value">{{ card.state }}</span>
            </div>
            <div class="stat-item" v-if="managedQty(card) !== null">
              <span class="label">策略管理:</span>
              <span class="value">{{ fmtQty(managedQty(card)) }} 股</span>
            </div>
            <div class="stat-item" v-if="coreQty(card) > 0">
              <span class="label">底仓:</span>
              <span class="value">{{ fmtQty(coreQty(card)) }} 股</span>
            </div>
            <div
              class="stat-item"
              v-if="card.running && card.worker?.stats?.bars_processed !== undefined"
            >
              <span class="label">处理K线:</span>
              <span class="value">{{ card.worker.stats.bars_processed }}</span>
            </div>
            <div class="stat-item" v-if="entryPrice(card)">
              <span class="label">入场价:</span>
              <span class="value">¥{{ entryPrice(card) }}</span>
            </div>
          </div>

          <!-- 操作 -->
          <div class="worker-actions">
            <template v-if="card.running">
              <button
                class="action-btn stop"
                :disabled="actionBusy[card.key]"
                @click="stopCard(card)"
              >
                {{ actionBusy[card.key] ? '⏳ 停止中...' : '⏹ 停止' }}
              </button>
              <button
                v-if="card.worker?.log_stream_url"
                class="log-btn realtime"
                title="打开实时日志流（WebSocket）"
                @click="openLogStream(card)"
              >
                📺 实时日志
              </button>
              <button
                class="log-btn history"
                title="查看历史日志文件"
                @click="openHistoryLogs(card)"
              >
                📜 历史日志
              </button>
            </template>

            <template v-else-if="card.enabled">
              <button
                class="action-btn retry"
                :disabled="actionBusy[card.key]"
                @click="startCard(card)"
              >
                {{ actionBusy[card.key] ? '⏳ 启动中...' : '🔁 重试启动' }}
              </button>
            </template>

            <template v-else>
              <button
                class="action-btn start"
                :disabled="actionBusy[card.key]"
                @click="startCard(card)"
              >
                {{ actionBusy[card.key] ? '⏳ 启动中...' : '▶ 启动' }}
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import request from '../utils/request'
import { getWatchlistStrategies, getStrategyPositionGuard } from '../api/user'
import { useStrategyPositionGuard } from '../composables/strategyPositionGuard'
import { notifyDisableResult } from '../utils/strategyDisableOutcome'

export default {
  name: 'StrategyWorkers',

  setup() {
    const { saveStrategyWithGuard, startStrategyWithGuard } = useStrategyPositionGuard()
    return { saveStrategyWithGuard, startStrategyWithGuard }
  },

  data() {
    return {
      loading: false,
      cards: [],
      activeWorkers: 0,
      deploymentMode: '',
      statusMessage: '正在连接...',
      statusClass: 'connecting',
      autoRefreshInterval: null,
      actionBusy: {},
    }
  },

  computed: {
    inactiveCount() {
      return this.cards.filter(card => !card.running).length
    },
  },

  mounted() {
    this.refreshWorkers()
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
      const apiUrl = import.meta.env.VITE_WORKER_API || '/api/strategy/workers'
      const token = localStorage.getItem('access_token')

      let workerData = { workers: {}, deployment_mode: '' }
      let managerOk = true
      try {
        const response = await fetch(apiUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        workerData = await response.json()
      } catch (error) {
        managerOk = false
        this.statusMessage = `❌ 策略管理器不可用: ${error.message}`
        this.statusClass = 'error'
      }

      let configs = []
      try {
        const response = await getWatchlistStrategies()
        configs = response?.data || []
      } catch (error) {
        console.error('Failed to load watchlist strategies:', error)
      }

      const workers = Object.entries(workerData.workers || {}).map(([key, worker]) => ({
        key,
        ...worker,
      }))
      const guards = managerOk
        ? await Promise.all(
            configs.map(config => (
              getStrategyPositionGuard(config.symbol, config.strategy_key).catch(() => null)
            )),
          )
        : configs.map(() => null)
      const guardMap = {}
      configs.forEach((config, index) => {
        guardMap[`${config.symbol}|${config.strategy_key}`] = guards[index]
      })

      this.cards = this.buildCards(configs, workers, guardMap)
      this.activeWorkers = this.cards.filter(card => card.running).length
      this.deploymentMode = workerData.deployment_mode || ''

      if (managerOk) {
        this.statusMessage = '✅ 连接正常'
        this.statusClass = 'connected'
      }
      this.loading = false
    },

    buildCards(configs, workers, guardMap) {
      const workerMap = {}
      workers.forEach(worker => {
        const symbol = worker.stats?.symbol
        const strategy = worker.stats?.strategy
        if (symbol && strategy) workerMap[`${symbol}|${strategy}`] = worker
      })

      const cards = configs.map(config => {
        const key = `${config.symbol}|${config.strategy_key}`
        const worker = workerMap[key] || null
        const guard = guardMap[key] || null
        const running = !!worker && !!worker.alive
        let state = '已停止'
        if (running) state = '运行中'
        else if (config.enabled) state = '未运行'
        return {
          key,
          symbol: config.symbol,
          strategy_key: config.strategy_key,
          enabled: !!config.enabled,
          worker,
          guard,
          running,
          state,
        }
      })

      const configKeys = new Set(cards.map(card => card.key))
      workers.forEach(worker => {
        const key = `${worker.stats?.symbol}|${worker.stats?.strategy}`
        if (!worker.stats?.symbol || configKeys.has(key)) return
        cards.push({
          key,
          symbol: worker.stats.symbol,
          strategy_key: worker.stats.strategy,
          enabled: true,
          worker,
          guard: null,
          running: !!worker.alive,
          state: worker.alive ? '运行中' : '已停止',
        })
      })

      const rank = { 运行中: 0, 未运行: 1, 已停止: 2 }
      return cards.sort((a, b) => rank[a.state] - rank[b.state])
    },

    statusClassFor(card) {
      if (card.running) return 'online'
      if (card.state === '未运行') return 'failed'
      return 'stopped'
    },

    statusText(card) {
      if (card.running) return '🟢 运行中'
      if (card.state === '未运行') return '🟠 未运行'
      return '⚪ 已停止'
    },

    accountWarning(card) {
      const bound = card.guard?.account?.bound
      if (bound === false) return '未绑定证券账户：只生成观察信号，不会下单'
      if (bound === undefined && card.worker?.stats?.account_bound === false) {
        return '未绑定证券账户：只生成观察信号，不会下单'
      }
      return ''
    },

    accountText(card) {
      const account = card.guard?.account
      if (account?.bound) {
        return `${account.account_id || '—'}（${account.broker || '未知券商'}）`
      }
      if (card.worker?.stats?.account_bound === false) return '未绑定账户（仅信号）'
      if (card.guard?.account?.bound === false) return '未绑定账户'
      return '—'
    },

    strategyName(card) {
      return card.guard?.strategy_name || card.strategy_key
    },

    managedQty(card) {
      if (card.running && card.worker?.stats?.position !== undefined) {
        return card.worker.stats.position
      }
      const value = card.guard?.position?.managed_qty
      if (value === null || value === undefined) return null
      const number = Number(value)
      return Number.isFinite(number) ? number : null
    },

    coreQty(card) {
      const value = Number(card.guard?.position?.core_qty)
      return Number.isFinite(value) ? value : 0
    },

    entryPrice(card) {
      const value = card.worker?.stats?.entry_price || card.guard?.position?.entry_price
      if (!Number(value)) return ''
      return Number(value).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
    },

    fmtQty(value) {
      if (value === null || value === undefined) return '—'
      return Number(value).toLocaleString('zh-CN')
    },

    async stopCard(card) {
      this.actionBusy = { ...this.actionBusy, [card.key]: true }
      try {
        const result = await this.saveStrategyWithGuard({
          symbol: card.symbol,
          strategy: card.strategy_key,
          enabled: false,
        })
        if (result?.cancelled) return
        notifyDisableResult(result)
        if (result && result.worker_reload === false) {
          alert('配置已写入；策略管理器未即时确认，最多 60 秒内停止。')
        }
        await this.refreshWorkers()
      } catch (error) {
        alert(error?.message || '停止策略失败')
      } finally {
        this.actionBusy = { ...this.actionBusy, [card.key]: false }
      }
    },

    async startCard(card) {
      this.actionBusy = { ...this.actionBusy, [card.key]: true }
      try {
        const result = await this.startStrategyWithGuard({
          symbol: card.symbol,
          strategy: card.strategy_key,
        })
        if (result?.cancelled) return
        if (result && result.worker_reload === false) {
          alert('配置已启用；策略管理器未即时确认，最多 60 秒内启动。')
        }
        await this.refreshWorkers()
      } catch (error) {
        alert(error?.message || '启动策略失败')
      } finally {
        this.actionBusy = { ...this.actionBusy, [card.key]: false }
      }
    },

    openLogStream(card) {
      const url = card.worker?.log_stream_url
      if (!url) return
      let wsUrl = url
      if (wsUrl.includes('0.0.0.0')) {
        wsUrl = wsUrl.replace('0.0.0.0', window.location.hostname)
      }
      const viewerUrl = `/log-viewer.html?ws=${encodeURIComponent(wsUrl)}&symbol=${card.symbol}`
      window.open(viewerUrl, '_blank', 'width=1400,height=900')
    },

    async openHistoryLogs(card) {
      const workerKey = card.worker?.key
      if (!workerKey) {
        alert('该策略当前未运行，暂无历史日志入口')
        return
      }
      const logPath = `/strategy/workers/${workerKey}/logs`
      try {
        const token = localStorage.getItem('access_token')
        if (!token) {
          alert('❌ 请先登录')
          return
        }
        const body = await request.get(logPath, { params: { tail: 1000 } })
        const logWindow = window.open('', '_blank')
        logWindow.document.write(`
          <html>
            <head><title>历史日志 - ${workerKey}</title></head>
            <body style="margin:0;padding:20px;font-family:monospace;background:#1e1e1e;color:#d4d4d4;">
              <pre style="white-space:pre-wrap;word-wrap:break-word;">${body}</pre>
            </body>
          </html>
        `)
        logWindow.document.close()
      } catch (reqError) {
        const status = reqError.response?.status
        const detail = reqError.response?.data?.detail
        if (status === 404) {
          alert(`📂 历史日志暂不可用\n\n${detail || '日志文件尚未生成'}\n\n💡 建议：请先使用「实时日志」功能`)
        } else if (status === 401 || status === 403) {
          alert(`❌ 认证失败 (HTTP ${status})\n\n请重新登录`)
        } else if (status) {
          alert(`❌ 获取日志失败 (HTTP ${status})\n\n${detail || '请稍后重试'}`)
        } else {
          alert(`❌ 请求失败: ${reqError.message}\n\n请检查网络连接`)
        }
      }
    },
  },
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
  background: rgba(0, 0, 0, 0.1);
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
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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

.loading-state,
.empty-state {
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
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
}

.worker-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 2px solid #e0e0e0;
}

.worker-card.alive {
  border-color: #4CAF50;
}

.worker-card.failed {
  border-color: #FB8C00;
}

.worker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 15px;
}

.worker-status {
  font-size: 14px;
  padding: 4px 12px;
  border-radius: 20px;
  background: #eceff1;
  color: #546e7a;
  white-space: nowrap;
}

.worker-status.online {
  background: #e8f5e9;
  color: #2e7d32;
}

.worker-status.failed {
  background: #fff3e0;
  color: #e65100;
}

.account-hint {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 4px;
  background: #fff3e0;
  color: #e65100;
  white-space: nowrap;
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

.worker-account {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
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

.action-btn {
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

.action-btn.start {
  background: #4CAF50;
}

.action-btn.start:hover:not(:disabled) {
  background: #43a047;
}

.action-btn.stop {
  background: #e53935;
}

.action-btn.stop:hover:not(:disabled) {
  background: #d32f2f;
}

.action-btn.retry {
  background: #FB8C00;
}

.action-btn.retry:hover:not(:disabled) {
  background: #F57C00;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

@media (max-width: 600px) {
  .workers-grid {
    grid-template-columns: 1fr;
  }
}
</style>
