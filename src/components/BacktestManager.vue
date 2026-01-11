<template>
  <div 
    class="backtest-manager" 
    @mouseenter="isUserInteracting = false"
    @mousemove="handleUserActivity"
    @click="handleUserActivity"
  >
    <div class="header">
      <h2>📊 回测管理</h2>
      <button class="create-btn" @click="showCreateModal = true">
        ➕ 创建回测任务
      </button>
    </div>

    <!-- 任务列表 -->
    <div class="tasks-section">
      <div class="section-header">
        <h3>回测任务列表</h3>
        <div class="filters">
          <select v-model="statusFilter" @change="loadTasks">
            <option value="">全部状态</option>
            <option value="pending">等待中</option>
            <option value="claimed">已认领</option>
            <option value="running">运行中</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
            <option value="cancelled">已取消</option>
          </select>
          <button class="refresh-btn" @click="loadTasks">🔄 刷新</button>
        </div>
      </div>

      <div v-if="loading" class="loading">加载中...</div>
      
      <div v-else-if="tasks.length === 0" class="empty">
        暂无回测任务
      </div>

      <div v-else class="tasks-list">
        <div 
          v-for="task in tasks" 
          :key="task.task_id"
          class="task-card"
          :class="[`status-${task.status}`]"
          @click="selectTask(task)"
        >
          <div class="task-header">
            <div class="task-title">
              <div class="symbol-block">
                <div class="symbol">{{ task.symbol }}</div>
                <div v-if="task.stock_name" class="stock-name">{{ task.stock_name }}</div>
              </div>
              <span class="strategy">
                {{ task.strategy_key }}
                <template v-if="getTaskPresetName(task)"> ({{ getTaskPresetName(task) }})</template>
              </span>
            </div>
            <span class="status-badge" :class="`status-${task.status}`">
              {{ getStatusText(task.status) }}
            </span>
          </div>
          
          <div class="task-details">
            <div class="detail-item">
              <span class="label">时间范围:</span>
              <span class="value">{{ formatDate(task.start_date) }} ~ {{ formatDate(task.end_date) }}</span>
            </div>
            <div class="detail-item">
              <span class="label">初始资金:</span>
              <span class="value">{{ formatCurrency(task.initial_cash) }}</span>
            </div>
            <div class="detail-item">
              <span class="label">创建时间:</span>
              <span class="value">{{ formatDateTime(task.created_at) }}</span>
            </div>
          </div>

          <div class="task-actions" @click.stop>
            <button 
              v-if="task.status === 'completed'" 
              class="view-btn"
              @click="viewResult(task.task_id)"
            >
              📈 查看结果
            </button>
            <button 
              v-if="['pending', 'claimed', 'running'].includes(task.status)"
              class="cancel-btn"
              @click="cancelTask(task.task_id)"
            >
              ❌ 取消
            </button>
            <button
              v-if="['failed', 'cancelled'].includes(task.status)"
              class="cancel-btn"
              @click="resetTask(task.task_id)"
            >
              ♻️ 重试
            </button>
            <button 
              v-if="['completed', 'failed', 'cancelled'].includes(task.status)"
              class="delete-btn"
              @click="deleteTask(task.task_id)"
            >
              🗑️ 删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建任务模态框 -->
    <div v-if="showCreateModal" class="modal" @click.self="showCreateModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>创建回测任务</h3>
          <button class="close-btn" @click="showCreateModal = false">✕</button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label>股票代码 *</label>
            <input 
              v-model="newTask.symbol" 
              type="text" 
              placeholder="例如: 000858 或 000858.SZ"
              @blur="normalizeSymbol"
            />
            <small v-if="normalizedSymbol" class="hint">
              将使用: {{ normalizedSymbol }}
            </small>
          </div>

          <div class="form-group">
            <label>策略 *</label>
            <select v-model="newTask.strategy_key">
              <option value="">请选择策略</option>
              <option 
                v-for="strategy in availableStrategies" 
                :key="strategy.key" 
                :value="strategy.key"
              >
                {{ strategy.name }}
              </option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>开始日期 *</label>
              <input 
                v-model="newTask.start_date" 
                type="text" 
                placeholder="YYYYMMDD"
                maxlength="8"
              />
            </div>
            <div class="form-group">
              <label>结束日期 *</label>
              <input 
                v-model="newTask.end_date" 
                type="text" 
                placeholder="YYYYMMDD"
                maxlength="8"
              />
            </div>
          </div>

          <div class="form-group">
            <label>初始资金</label>
            <input 
              v-model.number="newTask.initial_cash" 
              type="number" 
              step="10000"
              min="10000"
            />
          </div>

          <!-- 使用统一的策略参数编辑器 -->
          <div v-if="newTask.strategy_key && strategyMeta[newTask.strategy_key]" class="strategy-params-section">
            <StrategyParamsEditor
              :strategy-key="newTask.strategy_key"
              :strategy-info="strategyMeta[newTask.strategy_key]"
              :presets="strategyTemplates[newTask.strategy_key] || []"
              :initial-params="newTask.strategy_params"
              :preferred-preset="createPreferredPreset"
              :show-json-preview="false"
              @update:params="(params) => newTask.strategy_params = params"
              @update:preset="(p) => newTask.preset = p"
            />
          </div>

          <div v-if="createError" class="error-message">
            {{ createError }}
          </div>
        </div>

        <div class="modal-footer">
          <button class="cancel-btn" @click="showCreateModal = false">取消</button>
          <button class="submit-btn" @click="createTask" :disabled="creating">
            {{ creating ? '创建中...' : '创建任务' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 结果查看模态框 -->
    <div v-if="showResultModal" class="modal" @click.self="showResultModal = false">
      <div class="modal-content large">
        <div class="modal-header">
          <h3>回测结果 - {{ selectedTask?.symbol }}</h3>
          <button class="close-btn" @click="showResultModal = false">✕</button>
        </div>
        
        <div class="modal-body">
          <div v-if="loadingResult" class="loading">{{ loadingResultMessage }}</div>
          <div v-else-if="resultError" class="error-message">{{ resultError }}</div>
          
          <div v-else-if="result" class="result-content">
            <!-- 策略与参数（本次回测使用） -->
            <div class="metrics-section">
              <h4>🧠 策略与参数</h4>
              <div class="task-details">
                <div class="detail-item">
                  <span class="label">策略:</span>
                  <span class="value">{{ displayStrategyKey || '-' }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">回测区间:</span>
                  <span class="value">{{ displayBacktestRange || '-' }}</span>
                </div>
              </div>

              <div class="params-block">
                <pre class="params-pre">{{ displayStrategyParamsJson }}</pre>
              </div>
            </div>

            <!-- 关键指标雷达图 -->
            <div class="metrics-section">
              <MetricsRadarChart :metrics="result.metrics" />
            </div>

            <!-- 关键指标卡片 -->
            <div class="metrics-section">
              <h4>📊 关键指标</h4>
              <div class="metrics-grid">
                <div class="metric-card">
                  <div class="metric-label">总收益</div>
                  <div class="metric-value" :class="calculateTotalProfit() >= 0 ? 'positive' : 'negative'">
                    {{ formatCurrency(calculateTotalProfit()) }}
                  </div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">总收益率</div>
                  <div class="metric-value" :class="result.metrics.total_return >= 0 ? 'positive' : 'negative'">
                    {{ formatPercent(result.metrics.total_return) }}
                  </div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">夏普比率</div>
                  <div class="metric-value">{{ result.metrics.sharpe_ratio?.toFixed(2) || 'N/A' }}</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">最大回撤</div>
                  <div class="metric-value negative">{{ formatPercent(result.metrics.max_drawdown) }}</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">胜率</div>
                  <div class="metric-value">{{ formatPercent(result.metrics.win_rate) }}</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">交易次数</div>
                  <div class="metric-value">{{ result.metrics.total_trades || 0 }}</div>
                </div>
              </div>
            </div>

            <!-- 交易记录 -->
            <div class="trades-section">
              <h4>📝 交易记录 (最近20条)</h4>
              <div class="table-wrapper">
                <table class="trades-table">
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>操作</th>
                      <th>价格</th>
                      <th>数量</th>
                      <th>手续费</th>
                      <th>盈亏</th>
                      <th>累计盈亏</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(trade, idx) in result.trades.slice(0, 20)" :key="idx">
                      <td>{{ trade.datetime }}</td>
                      <td>
                        <span class="trade-action" :class="trade.action">
                          {{ trade.action === 'buy' ? '买入' : '卖出' }}
                        </span>
                      </td>
                      <td>{{ trade.price.toFixed(2) }}</td>
                      <td>{{ trade.quantity }}</td>
                      <td>{{ trade.commission.toFixed(2) }}</td>
                      <td :class="trade.pnl >= 0 ? 'positive' : 'negative'">
                        {{ trade.pnl.toFixed(2) }}
                      </td>
                      <td :class="trade.cumulative_pnl >= 0 ? 'positive' : 'negative'">
                        {{ trade.cumulative_pnl.toFixed(2) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- 净值曲线 -->
            <div class="equity-section">
              <h4>📈 净值曲线</h4>
              <EquityCurveChart 
                v-if="result.equity_curve && result.equity_curve.length > 0"
                :equity-curve="result.equity_curve"
                :initial-cash="selectedTask?.initial_cash || 1000000"
              />
              <div v-else class="empty">暂无净值数据</div>
            </div>

            <!-- 操作区域 -->
            <div class="result-actions">
              <button class="create-btn" @click="openCreateNewBacktestFromResult">
                ➕ 创建新的回测
              </button>
              <button class="deploy-btn" @click="deployToLive(selectedTask)">
                🚀 部署到实盘
              </button>
              <button class="close-btn" @click="showResultModal = false">
                关闭
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed, onUnmounted, watch } from 'vue'
import EquityCurveChart from './EquityCurveChart.vue'
import MetricsRadarChart from './MetricsRadarChart.vue'
import StrategyParamsEditor from './StrategyParamsEditor.vue'

export default {
  name: 'BacktestManager',
  components: {
    EquityCurveChart,
    MetricsRadarChart,
    StrategyParamsEditor
  },
  setup() {
    const API_BASE = import.meta.env.VITE_API_BASE || '/api'
    
    // State
    const tasks = ref([])
    const loading = ref(false)
    const statusFilter = ref('')
    
    // 自动刷新相关
    const autoRefreshEnabled = ref(true)
    const refreshInterval = ref(null)
    const REFRESH_INTERVAL_MS = 10000 // 10秒
    const isUserInteracting = ref(false) // 用户是否正在交互
    
    // 策略元数据（从API获取）
    const strategyMeta = ref({})
    const strategyTemplates = ref({})
    const availableStrategies = ref([])
    
    const showCreateModal = ref(false)
    
    // 计算默认日期：过去一年
    const getDefaultDates = () => {
      const endDate = new Date()
      const startDate = new Date()
      startDate.setFullYear(startDate.getFullYear() - 1)
      
      return {
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0]
      }
    }
    
    const newTask = ref({
      symbol: '',
      strategy_key: '',
      ...getDefaultDates(),
      initial_cash: 1000000,
      preset: '',
      strategy_params: {}
    })
    const strategyParamsText = ref('{}')
    const creating = ref(false)
    const createError = ref('')
    const normalizedSymbol = ref('')
    const createPreferredPreset = ref('')

    // Used to seed params without being overwritten by default params watcher
    const skipDefaultParamsOnce = ref(false)
    
    const showResultModal = ref(false)
    const selectedTask = ref(null)
    const result = ref(null)
    const loadingResult = ref(false)
    const loadingResultMessage = ref('加载结果中...')
    const resultError = ref('')

    const displayStrategyKey = computed(() => {
      return (
        selectedTask.value?.strategy_key ||
        result.value?.strategy_key ||
        result.value?.strategy ||
        ''
      )
    })

    const displayStrategyParams = computed(() => {
      const params = selectedTask.value?.strategy_params ?? result.value?.strategy_params
      if (!params || typeof params !== 'object' || Array.isArray(params)) return {}
      return params
    })

    const displayStrategyParamsJson = computed(() => {
      const params = displayStrategyParams.value
      if (!params || Object.keys(params).length === 0) return '（无参数）'
      try {
        return JSON.stringify(params, null, 2)
      } catch (e) {
        return String(params)
      }
    })

    const extractParamsFromWithDesc = (paramsWithDesc) => {
      const out = {}
      if (!paramsWithDesc || typeof paramsWithDesc !== 'object') return out
      for (const [key, cfg] of Object.entries(paramsWithDesc)) {
        if (cfg && typeof cfg === 'object' && 'value' in cfg) out[key] = cfg.value
      }
      return out
    }

    const shallowEqualObject = (a, b) => {
      if (a === b) return true
      if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
      const aKeys = Object.keys(a)
      const bKeys = Object.keys(b)
      if (aKeys.length !== bKeys.length) return false
      for (const k of aKeys) {
        if (a[k] !== b[k]) return false
      }
      return true
    }

    const getTaskPresetName = (task) => {
      if (!task) return ''
      if (task.preset) return task.preset

      const strategyKey = task.strategy_key
      const presets = strategyTemplates.value?.[strategyKey]
      const taskParams = task.strategy_params
      if (!strategyKey || !Array.isArray(presets) || !taskParams || typeof taskParams !== 'object') return ''

      for (const p of presets) {
        const presetParams = extractParamsFromWithDesc(p?.params_with_desc)
        if (shallowEqualObject(taskParams, presetParams)) return p?.preset || ''
      }
      return ''
    }

    const displayBacktestStartYmd = computed(() => {
      const v =
        selectedTask.value?.start_date ||
        result.value?.start_date ||
        result.value?.equity_curve?.[0]?.date ||
        ''
      return typeof v === 'string' ? v : ''
    })

    const displayBacktestEndYmd = computed(() => {
      const curve = result.value?.equity_curve
      const lastCurveDate = Array.isArray(curve) && curve.length > 0 ? curve[curve.length - 1]?.date : ''
      const v = selectedTask.value?.end_date || result.value?.end_date || lastCurveDate || ''
      return typeof v === 'string' ? v : ''
    })

    const displayBacktestRange = computed(() => {
      const start = displayBacktestStartYmd.value
      const end = displayBacktestEndYmd.value
      if (!start && !end) return ''
      if (start && end) return `${formatDate(start)} ~ ${formatDate(end)}`
      return start ? formatDate(start) : formatDate(end)
    })

    const poolOpenListenerAttached = ref(false)

    // Methods
    const normalizeSymbol = () => {
      if (!newTask.value.symbol) {
        normalizedSymbol.value = ''
        return
      }
      
      let symbol = newTask.value.symbol.trim().toUpperCase()
      
      // 如果已经带有后缀，直接使用
      if (symbol.includes('.')) {
        normalizedSymbol.value = symbol
        return
      }
      
      // 根据代码开头自动补全后缀
      if (symbol.startsWith('6')) {
        // 6开头是上海主板
        normalizedSymbol.value = symbol + '.SH'
      } else if (symbol.startsWith('0') || symbol.startsWith('3')) {
        // 0和3开头是深圳
        normalizedSymbol.value = symbol + '.SZ'
      } else if (symbol.startsWith('8') || symbol.startsWith('4')) {
        // 8和4开头是北交所
        normalizedSymbol.value = symbol + '.BJ'
      } else {
        // 其他情况，默认不加后缀
        normalizedSymbol.value = symbol
      }
    }
    
    const loadTasks = async () => {
      loading.value = true
      try {
        const token = localStorage.getItem('access_token')
        const url = statusFilter.value 
          ? `${API_BASE}/backtest/tasks?status=${statusFilter.value}`
          : `${API_BASE}/backtest/tasks`
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (!response.ok) throw new Error('Failed to load tasks')
        
        tasks.value = await response.json()
        
        // 检查是否有运行中的任务，决定是否启动自动刷新
        const hasRunningTasks = tasks.value.some(task => 
          ['pending', 'claimed', 'running'].includes(task.status)
        )
        
        if (hasRunningTasks && autoRefreshEnabled.value && !refreshInterval.value) {
          console.log('检测到运行中的任务，启动自动刷新')
          startAutoRefresh()
        } else if (!hasRunningTasks && refreshInterval.value) {
          console.log('所有任务已完成，停止自动刷新')
          stopAutoRefresh()
        }
      } catch (error) {
        console.error('Error loading tasks:', error)
        alert('加载任务列表失败')
      } finally {
        loading.value = false
      }
    }

    // 加载策略元数据
    const loadStrategyMeta = async () => {
      try {
        const token = localStorage.getItem('access_token')
        
        // 加载策略列表
        const strategiesRes = await fetch(`${API_BASE}/strategy/strategies`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        
        if (!strategiesRes.ok) throw new Error('Failed to load strategies')
        const strategiesData = await strategiesRes.json()
        const strategies = strategiesData.strategies || []
        
        // 加载策略模板
        const templatesRes = await fetch(`${API_BASE}/strategy/templates`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        
        if (!templatesRes.ok) throw new Error('Failed to load templates')
        const templatesData = await templatesRes.json()
        
        // 处理数据
        availableStrategies.value = strategies
        strategyMeta.value = Object.fromEntries(
          strategies.map(s => [s.key, s])
        )
        strategyTemplates.value = templatesData.templates || {}
        
        console.log('策略元数据加载成功:', strategies.length, '个策略')
        console.log('策略模板数据:', strategyTemplates.value)
      } catch (error) {
        console.error('Error loading strategy metadata:', error)
        // 不阻塞界面，使用空数据
      }
    }

    // 启动自动刷新
    const startAutoRefresh = () => {
      if (refreshInterval.value) return
      
      refreshInterval.value = setInterval(() => {
        // 只有在用户不在交互时才刷新
        if (!isUserInteracting.value && !showCreateModal.value && !showResultModal.value) {
          console.log('自动刷新任务列表...')
          loadTasks()
        } else {
          console.log('用户正在交互，跳过此次刷新')
        }
      }, REFRESH_INTERVAL_MS)
    }

    // 停止自动刷新
    const stopAutoRefresh = () => {
      if (refreshInterval.value) {
        clearInterval(refreshInterval.value)
        refreshInterval.value = null
      }
    }

    // 监听策略选择变化，自动填充默认参数
    watch(() => newTask.value.strategy_key, (newStrategy) => {
      if (skipDefaultParamsOnce.value) {
        skipDefaultParamsOnce.value = false
        return
      }
      if (newStrategy && strategyMeta.value[newStrategy]) {
        // 从策略元数据获取默认参数
        const defaultParams = strategyMeta.value[newStrategy].default_params || {}
        strategyParamsText.value = JSON.stringify(defaultParams, null, 2)
        newTask.value.strategy_params = { ...defaultParams }
        console.log(`已加载 ${newStrategy} 策略的默认参数:`, defaultParams)
      } else if (!newStrategy) {
        // 清空参数
        strategyParamsText.value = '{}'
        newTask.value.strategy_params = {}
      }
    })

    const parseAnyDate = (v) => {
      if (!v) return null
      if (v instanceof Date) return isNaN(v.getTime()) ? null : v
      if (typeof v === 'string') {
        const trimmed = v.trim()
        if (!trimmed) return null
        // Support YYYYMMDD
        const dt1 = parseYmd(trimmed)
        if (dt1) return dt1
        // Support ISO-like date strings
        const dt2 = new Date(trimmed)
        return isNaN(dt2.getTime()) ? null : dt2
      }
      return null
    }

    const openCreateNewBacktestFromResult = () => {
      createError.value = ''

      const symbol = selectedTask.value?.symbol || result.value?.symbol || ''
      const strategyKey = selectedTask.value?.strategy_key || result.value?.strategy_key || ''
      const params = selectedTask.value?.strategy_params || result.value?.strategy_params || {}
      const initialCash = selectedTask.value?.initial_cash || 1000000

      createPreferredPreset.value = selectedTask.value?.preset || ''

      // Always default end date to today (do not copy from prior run)
      const endDt = new Date()

      let startDt = parseAnyDate(selectedTask.value?.start_date)
      if (!startDt) {
        startDt = new Date(endDt)
        startDt.setFullYear(startDt.getFullYear() - 1)
      }

      skipDefaultParamsOnce.value = true
      newTask.value = {
        symbol: symbol,
        strategy_key: strategyKey,
        start_date: yyyymmdd(startDt),
        end_date: yyyymmdd(endDt),
        initial_cash: initialCash,
        preset: createPreferredPreset.value || selectedTask.value?.preset || '',
        strategy_params: { ...params }
      }

      normalizeSymbol()
      showResultModal.value = false
      showCreateModal.value = true
    }

    // 处理用户活动
    let activityTimer = null
    const handleUserActivity = () => {
      isUserInteracting.value = true
      
      // 3秒内没有活动则认为用户停止交互
      if (activityTimer) clearTimeout(activityTimer)
      activityTimer = setTimeout(() => {
        isUserInteracting.value = false
      }, 3000)
    }

    const createTask = async () => {
      createError.value = ''
      
      // Validate
      if (!newTask.value.symbol || !newTask.value.strategy_key || 
          !newTask.value.start_date || !newTask.value.end_date) {
        createError.value = '请填写所有必填字段'
        return
      }
      
      // Normalize symbol before submitting
      normalizeSymbol()
      if (!normalizedSymbol.value) {
        createError.value = '股票代码格式不正确'
        return
      }
      
      // 验证策略参数（已由 StrategyParamsEditor 组件设置）
      if (!newTask.value.strategy_params || Object.keys(newTask.value.strategy_params).length === 0) {
        createError.value = '请配置策略参数'
        return
      }

      creating.value = true
      try {
        const token = localStorage.getItem('access_token')
        
        // Use normalized symbol
        const taskData = {
          ...newTask.value,
          symbol: normalizedSymbol.value
        }
        
        console.log('[DEBUG] Creating backtest task with params:', taskData.strategy_params)
        
        const response = await fetch(`${API_BASE}/backtest/tasks`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(taskData)
        })
        
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.detail || 'Failed to create task')
        }
        
        showCreateModal.value = false
        resetNewTask()
        await loadTasks()
      } catch (error) {
        createError.value = error.message
      } finally {
        creating.value = false
      }
    }

    const resetNewTask = () => {
      newTask.value = {
        symbol: '',
        strategy_key: '',
        start_date: '',
        end_date: '',
        initial_cash: 1000000,
        preset: '',
        strategy_params: {}
      }
      strategyParamsText.value = '{}'
      normalizedSymbol.value = ''
    }

    const selectTask = (task) => {
      selectedTask.value = task
    }

    const viewResult = async (taskId) => {
      // 先找到对应的 task
      const task = tasks.value.find(t => t.task_id === taskId)
      if (task) {
        selectedTask.value = task
      }
      
      showResultModal.value = true
      loadingResult.value = true
      loadingResultMessage.value = '加载结果中...'
      resultError.value = ''
      result.value = null
      
      try {
        const token = localStorage.getItem('access_token')
        const response = await fetch(`${API_BASE}/backtest/results/${taskId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (!response.ok) {
          const errBody = await response.json().catch(() => null)
          const detail = errBody?.detail || 'Failed to load result'
          throw new Error(detail)
        }
        
        result.value = await response.json()
        
        // 合并回测结果中的参数到 selectedTask，确保部署时可以获取到参数
        if (result.value.strategy_params) {
          selectedTask.value.strategy_params = result.value.strategy_params
        }
        
        // 调试日志：查看后端返回的数据
        console.log('=== 回测结果调试信息 ===');
        console.log('Strategy Params:', result.value.strategy_params);
        console.log('Selected Task Params:', selectedTask.value.strategy_params);
        console.log('Metrics:', result.value.metrics);
        console.log('Total Return:', result.value.metrics.total_return);
        console.log('Equity Curve Length:', result.value.equity_curve?.length);
        if (result.value.equity_curve && result.value.equity_curve.length > 0) {
          console.log('Initial Value:', result.value.equity_curve[0].value);
          console.log('Final Value:', result.value.equity_curve[result.value.equity_curve.length - 1].value);
          console.log('Initial Cash:', selectedTask.value?.initial_cash);
          const profit = result.value.equity_curve[result.value.equity_curve.length - 1].value - (selectedTask.value?.initial_cash || 1000000);
          console.log('Calculated Profit:', profit);
          console.log('Calculated Return:', profit / (selectedTask.value?.initial_cash || 1000000));
        }
        console.log('=========================');
      } catch (error) {
        console.error('Error loading result:', error)
        // Keep modal open; caller may be polling for completion.
        resultError.value = error.message || '加载结果失败'
      } finally {
        loadingResult.value = false
      }
    }

    const normalizeSymbolStr = (sym) => {
      if (!sym) return ''
      let s = String(sym).trim().toUpperCase()
      if (!s) return ''
      if (s.includes('.')) return s
      if (s.startsWith('6')) return s + '.SH'
      if (s.startsWith('0') || s.startsWith('3')) return s + '.SZ'
      if (s.startsWith('8') || s.startsWith('4')) return s + '.BJ'
      return s
    }

    const yyyymmdd = (d) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}${month}${day}`
    }

    const parseYmd = (ymd) => {
      if (!ymd || !/^\d{8}$/.test(ymd)) return null
      const y = Number(ymd.slice(0, 4))
      const m = Number(ymd.slice(4, 6)) - 1
      const d = Number(ymd.slice(6, 8))
      const dt = new Date(y, m, d)
      return isNaN(dt.getTime()) ? null : dt
    }

    const openExistingBacktestFromStrategyPool = async ({ symbol, strategy, preset, signalDate }) => {
      resultError.value = ''
      showResultModal.value = true
      loadingResult.value = true
      loadingResultMessage.value = '加载回测结果...'
      result.value = null

      try {
        const token = localStorage.getItem('access_token')
        const normSymbol = normalizeSymbolStr(symbol)
        if (!normSymbol) throw new Error('股票代码为空')
        if (!strategy) throw new Error('策略为空')

        // 1) Fetch existing backtest-style result from strategy pool trade history
        let url = `${API_BASE}/strategy-pool/backtest-result?symbol=${encodeURIComponent(normSymbol)}&strategy=${encodeURIComponent(strategy)}`
        if (preset) url += `&preset=${encodeURIComponent(preset)}`
        if (signalDate) url += `&end_date=${encodeURIComponent(signalDate)}`

        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
        if (!res.ok) {
          const err = await res.json().catch(() => null)
          throw new Error(err?.detail || '加载回测结果失败')
        }
        const body = await res.json()
        result.value = body

        // Prefer exact params_used from stored result; fallback to template params.
        let strategyParams = body?.strategy_params
        if (!strategyParams || Object.keys(strategyParams).length === 0) {
          let paramsUrl = `${API_BASE}/strategy-pool/params?strategy=${encodeURIComponent(strategy)}`
          if (preset) paramsUrl += `&preset=${encodeURIComponent(preset)}`
          const paramsRes = await fetch(paramsUrl, { headers: { 'Authorization': `Bearer ${token}` } })
          const paramsBody = await paramsRes.json().catch(() => null)
          strategyParams = paramsBody?.params || {}
        }

        // Build a BacktestManager-like selectedTask object for deployToLive()/prefill
        selectedTask.value = {
          symbol: normSymbol,
          strategy_key: strategy,
          strategy_params: strategyParams,
          initial_cash: 1000000,
          status: 'completed',
          preset: preset || ''
        }

        // Populate date range for display/prefill, using returned result when possible.
        if (Array.isArray(body?.equity_curve) && body.equity_curve.length > 0) {
          const start = body.equity_curve[0]?.date
          const end = body.equity_curve[body.equity_curve.length - 1]?.date
          if (start) selectedTask.value.start_date = start
          if (end) selectedTask.value.end_date = end
        } else if (signalDate) {
          selectedTask.value.end_date = signalDate
        }
        loadingResult.value = false
      } catch (e) {
        console.error('[BacktestManager] openExistingBacktestFromStrategyPool failed:', e)
        loadingResult.value = false
        resultError.value = e?.message || '加载回测结果失败'
      }
    }

    const cancelTask = async (taskId) => {
      if (!confirm('确定要取消这个任务吗？')) return
      
      try {
        const token = localStorage.getItem('access_token')
        const response = await fetch(`${API_BASE}/backtest/tasks/${taskId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (!response.ok) throw new Error('Failed to cancel task')
        
        await loadTasks()
      } catch (error) {
        console.error('Error cancelling task:', error)
        alert('取消任务失败')
      }
    }

    const resetTask = async (taskId) => {
      if (!confirm('确定要将该任务重置为等待状态再试一次吗？')) return

      try {
        const token = localStorage.getItem('access_token')
        const response = await fetch(`${API_BASE}/backtest/tasks/${taskId}/reset`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (!response.ok) {
          const errBody = await response.json().catch(() => null)
          const detail = errBody?.detail || 'Failed to reset task'
          throw new Error(detail)
        }

        await loadTasks()
      } catch (error) {
        console.error('Error resetting task:', error)
        alert(`重置任务失败：${error.message || error}`)
      }
    }

    const deleteTask = async (taskId) => {
      if (!confirm('确定要删除这个任务吗？')) return
      
      try {
        const token = localStorage.getItem('access_token')
        const response = await fetch(`${API_BASE}/backtest/tasks/${taskId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (!response.ok) throw new Error('Failed to delete task')
        
        await loadTasks()
      } catch (error) {
        console.error('Error deleting task:', error)
        alert('删除任务失败')
      }
    }

    // Formatters
    const getStatusText = (status) => {
      const map = {
        pending: '等待中',
        claimed: '已认领',
        running: '运行中',
        completed: '已完成',
        failed: '失败',
        cancelled: '已取消'
      }
      return map[status] || status
    }

    const formatDate = (dateStr) => {
      if (!dateStr || dateStr.length !== 8) return dateStr
      return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
    }

    const formatDateTime = (datetimeStr) => {
      if (!datetimeStr) return ''
      const date = new Date(datetimeStr)
      return date.toLocaleString('zh-CN')
    }

    const formatCurrency = (value) => {
      if (value === null || value === undefined) return 'N/A'
      return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    const formatPercent = (value) => {
      if (value === null || value === undefined) return 'N/A'
      return `${(value * 100).toFixed(2)}%`
    }

    const calculateTotalProfit = () => {
      if (!result.value?.equity_curve || result.value.equity_curve.length === 0) return 0
      const initialCash = selectedTask.value?.initial_cash || 1000000
      const finalValue = result.value.equity_curve[result.value.equity_curve.length - 1]?.value || initialCash
      return finalValue - initialCash
    }

    // 部署到实盘
    const deployToLive = async (task) => {
      if (!task) return
      
      const confirmed = confirm(
        `确定要将此回测配置部署到实盘吗？\n\n` +
        `股票：${task.symbol}\n` +
        `策略：${task.strategy_key}\n` +
        `参数：${JSON.stringify(task.strategy_params, null, 2)}`
      )
      
      if (!confirmed) return
      
      try {
        const token = localStorage.getItem('access_token')
        
        // 调用策略配置 API
        const response = await fetch(`${API_BASE}/user/watchlist/strategy`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            symbol: task.symbol,
            strategy: task.strategy_key,  // 后端API期望的字段名是 'strategy'
            enabled: true,
            params: task.strategy_params
          })
        })
        
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.detail || '部署失败')
        }
        
        alert('✅ 部署成功！策略已配置到实盘')
        showResultModal.value = false
      } catch (error) {
        console.error('Deploy to live error:', error)
        alert(`❌ 部署失败：${error.message}`)
      }
    }

    // Lifecycle
    const onOpenFromPool = (event) => {
      const detail = event?.detail || {}
      openExistingBacktestFromStrategyPool({
        symbol: detail.symbol,
        strategy: detail.strategy,
        preset: detail.preset,
        signalDate: detail.signalDate,
      })
    }

    onMounted(async () => {
      if (!poolOpenListenerAttached.value) {
        window.addEventListener('open-backtest-from-strategy-pool', onOpenFromPool)
        poolOpenListenerAttached.value = true
      }

      await Promise.all([
        loadStrategyMeta(),
        loadTasks()
      ])
    })

    onUnmounted(() => {
      stopAutoRefresh()
      if (poolOpenListenerAttached.value) {
        window.removeEventListener('open-backtest-from-strategy-pool', onOpenFromPool)
        poolOpenListenerAttached.value = false
      }
    })

    return {
      tasks,
      loading,
      statusFilter,
      showCreateModal,
      newTask,
      strategyParamsText,
      creating,
      createError,
      normalizedSymbol,
      createPreferredPreset,
      showResultModal,
      selectedTask,
      result,
      displayStrategyKey,
      displayStrategyParamsJson,
      displayBacktestRange,
      getTaskPresetName,
      loadingResult,
      loadingResultMessage,
      resultError,
      isUserInteracting,
      strategyMeta,
      strategyTemplates,
      availableStrategies,
      normalizeSymbol,
      loadTasks,
      loadStrategyMeta,
      createTask,
      selectTask,
      viewResult,
      cancelTask,
      resetTask,
      deleteTask,
      handleUserActivity,
      getStatusText,
      formatDate,
      formatDateTime,
      formatCurrency,
      formatPercent,
      calculateTotalProfit,
      deployToLive,
      openCreateNewBacktestFromResult
    }
  }
}
</script>

<style scoped>
.backtest-manager {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.header h2 {
  margin: 0;
  color: #2c3e50;
}

.create-btn {
  padding: 10px 20px;
  background: #409eff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.3s;
}

.create-btn:hover {
  background: #66b1ff;
}

.tasks-section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h3 {
  margin: 0;
  color: #2c3e50;
}

.filters {
  display: flex;
  gap: 10px;
}

.filters select {
  padding: 8px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
}

.refresh-btn {
  padding: 8px 16px;
  background: #f4f4f5;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.3s;
}

.refresh-btn:hover {
  background: #e9e9eb;
}

.loading, .empty {
  text-align: center;
  padding: 40px;
  color: #909399;
}

.tasks-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
}

.task-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s;
}

.task-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.task-title {
  display: flex;
  gap: 10px;
  align-items: center;
}

.symbol-block {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.stock-name {
  font-size: 14px;
  font-weight: normal;
  color: #606266;
}

.symbol {
  font-size: 12px;
  font-weight: 600;
  color: #303133;
}

.strategy {
  font-size: 12px;
  font-weight: 700;
  color: #303133;
  padding: 2px 8px;
  border-radius: 4px;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-pending {
  background: #e6f7ff;
  color: #1890ff;
}

.status-claimed {
  background: #fff7e6;
  color: #fa8c16;
}

.status-running {
  background: #e6fffb;
  color: #13c2c2;
}

.status-completed {
  background: #f6ffed;
  color: #52c41a;
}

.status-failed {
  background: #fff1f0;
  color: #f5222d;
}

.status-cancelled {
  background: #f5f5f5;
  color: #8c8c8c;
}

.task-details {
  margin-bottom: 12px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
}

.detail-item .label {
  color: #909399;
}

.detail-item .value {
  color: #606266;
}

.task-actions {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.task-actions button {
  flex: 1;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: opacity 0.3s;
}

.task-actions button:hover {
  opacity: 0.8;
}

.view-btn {
  background: #409eff;
  color: white;
}

.cancel-btn {
  background: #f56c6c;
  color: white;
}

.delete-btn {
  background: #909399;
  color: white;
}

/* Modal Styles */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-content.large {
  max-width: 1000px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e4e7ed;
}

.modal-header h3 {
  margin: 0;
  color: #2c3e50;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #909399;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  line-height: 1;
}

.close-btn:hover {
  color: #606266;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  color: #606266;
  font-size: 14px;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #409eff;
}

.form-group .hint {
  display: block;
  margin-top: 4px;
  color: #409eff;
  font-size: 12px;
}

.strategy-params-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.error-message {
  padding: 10px;
  background: #fef0f0;
  color: #f56c6c;
  border-radius: 4px;
  font-size: 13px;
  margin-top: 10px;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid #e4e7ed;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.modal-footer .cancel-btn {
  padding: 10px 20px;
  background: white;
  color: #606266;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
}

.modal-footer .submit-btn {
  padding: 10px 20px;
  background: #409eff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.modal-footer .submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Result Styles */
.result-content {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.metrics-section h4,
.trades-section h4,
.equity-section h4 {
  margin: 0 0 16px 0;
  color: #2c3e50;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.metric-card {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  text-align: center;
}

.metric-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}

.metric-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}

.metric-value.positive {
  color: #67c23a;
}

.metric-value.negative {
  color: #f56c6c;
}

.table-wrapper {
  overflow-x: auto;
}

.trades-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.trades-table th {
  background: #f4f4f5;
  padding: 10px;
  text-align: left;
  font-weight: 500;
  color: #606266;
  border-bottom: 2px solid #e4e7ed;
}

.trades-table td {
  padding: 10px;
  border-bottom: 1px solid #f0f0f0;
}

.trade-action {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.trade-action.buy {
  background: #f0f9ff;
  color: #1890ff;
}

.trade-action.sell {
  background: #fff1f0;
  color: #f5222d;
}

.trades-table .positive {
  color: #67c23a;
}

.trades-table .negative {
  color: #f56c6c;
}

.equity-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
}

.equity-section h4 {
  margin: 0 0 16px 0;
  color: #2c3e50;
}

.equity-section .empty {
  text-align: center;
  padding: 40px;
  color: #909399;
}

.result-actions {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.deploy-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s;
}

.deploy-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}
</style>
