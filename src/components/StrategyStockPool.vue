<template>
  <div class="strategy-pool">
    <div class="controls-card">
      <div class="control-group">
        <label>选择策略:</label>
        <select v-model="selectedStrategy" @change="onStrategyChange">
          <option v-for="strat in strategies" :key="strat.key" :value="strat.key">
            {{ strat.name }}
          </option>
        </select>
      </div>
      
      <div class="control-group" v-if="availablePresets.length > 0">
        <label>参数风格:</label>
        <select v-model="selectedPreset">
          <option v-for="preset in availablePresets" :key="preset" :value="preset">
            {{ getPresetLabel(preset) }}
          </option>
        </select>
      </div>
      
      <div class="control-group">
        <label>选择日期:</label>
        <select v-model="selectedDate">
          <option v-if="availableDates.length === 0" value="">-- 无可用日期 --</option>
          <option v-for="date in availableDates" :key="date" :value="date">
            {{ formatDisplayDate(date) }}
          </option>
        </select>
      </div>

      <div class="refresh-btn">
        <button @click="refreshData" :disabled="loading">
          <span v-if="loading">加载中...</span>
          <span v-else>刷新数据</span>
        </button>
      </div>
    </div>

    <div class="strategy-info-card" v-if="currentParams">
      <div class="info-header">
        <span class="info-title">🛠️ 当前策略运行参数: {{ strategies.find(s => s.key === selectedStrategy)?.name }}</span>
      </div>
      <div class="params-grid">
        <div v-for="(val, key) in currentParams" :key="key" class="param-item">
          <span class="param-label">{{ getParamLabel(key) }}:</span>
          <span class="param-value">{{ formatParamValue(key, val) }}</span>
        </div>
      </div>
    </div>

    <div v-if="error" class="error-msg">
      {{ error }}
    </div>

    <div class="pool-content">
      <div v-if="loading" class="loading-state">
        正在获取策略信号...
      </div>
      <div v-else-if="stocks.length === 0" class="empty-state">
        该日期暂无选股信号
      </div>
      <div v-else class="stock-grid">
        <div v-for="stock in stocks" :key="stock.symbol" class="stock-card" @click="viewChart(stock)">
          <div class="stock-header">
            <span class="stock-name">{{ stock.name || '未知' }}</span>
            <span class="stock-symbol">{{ stock.symbol }}</span>
          </div>
          <div class="stock-body">
            <div class="info-row">
              <span class="label">信号日期:</span>
              <span class="value">{{ formatDisplayDate(stock.date) }}</span>
            </div>
            <div class="info-row">
              <span class="label">操作动作:</span>
              <span class="value action-buy">买入 (BUY)</span>
            </div>
            <!-- Future extension: buy price and analysis -->
            <div class="info-row" v-if="stock.price">
              <span class="label">建议股价:</span>
              <span class="value price-tag">{{ stock.price.toFixed(2) }}</span>
            </div>
            <!-- Historical Performance Metrics -->
            <div class="hist-metrics" v-if="stock.hist_win_rate !== undefined">
              <div class="metrics-title">历史回测表现（360天）</div>
              <div class="metrics-grid">
                <div class="metric-item">
                  <span class="metric-label">胜率:</span>
                  <span class="metric-value" :class="getWinRateClass(stock.hist_win_rate)">{{ formatPercentage(stock.hist_win_rate) }}</span>
                </div>
                <div class="metric-item">
                  <span class="metric-label">总回报:</span>
                  <span class="metric-value" :class="getReturnClass(stock.hist_return)">{{ formatPercentage(stock.hist_return) }}</span>
                </div>
                <div class="metric-item">
                  <span class="metric-label">交易次数:</span>
                  <span class="metric-value">{{ stock.hist_total_trades || 0 }}次</span>
                </div>
                <div class="metric-item">
                  <span class="metric-label">夏普率:</span>
                  <span class="metric-value">{{ formatSharpe(stock.hist_sharpe_ratio) }}</span>
                </div>
              </div>
            </div>
            <div class="analysis-section" v-if="getStrategyReason(stock.strategy)">
              <div class="analysis-label">买入原因分析:</div>
              <div class="analysis-text">{{ getStrategyReason(stock.strategy) }}</div>
            </div>
          </div>
          <div class="stock-footer">
            <button class="view-btn" @click.stop="viewChart(stock)">查看图表</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 图表模态框 -->
    <div v-if="showChartModal" class="modal-overlay" @click="closeChartModal">
      <div class="chart-modal" @click.stop @dblclick="toggleFullscreen">
        <div class="modal-header">
          <h3>{{ selectedStock?.name || selectedStock?.symbol }} ({{ selectedStock?.symbol }}) - 策略图表</h3>
          <div class="modal-controls">
            <span class="strategy-info">策略: {{ selectedStock?.strategy || selectedStrategy }}</span>
            <span class="preset-info" v-if="selectedStock?.preset || selectedPreset">参数风格: {{ getPresetLabel(selectedStock?.preset || selectedPreset) }}</span>
            <button class="fullscreen-btn" @click="toggleFullscreen" title="全屏切换">
              {{ isFullscreen ? '❐' : '☐' }}
            </button>
            <button class="close-modal" @click="closeChartModal">✕</button>
          </div>
        </div>
        <div class="chart-container" :class="{ fullscreen: isFullscreen }">
          <div v-if="chartLoading" class="chart-loading">
            <div class="spinner"></div>
            图表数据加载中...
          </div>
          <div v-else-if="chartError" class="chart-error">
            {{ chartError }}
          </div>
          <StockChart
            v-else
            :symbol="selectedStock?.symbol"
            :signal-dates="[selectedStock?.date]"
            :strategy-from="selectedStock?.strategy || selectedStrategy"
            :preset-from="selectedStock?.preset || selectedPreset"
            :date-from="selectedStock?.date"
            style="width: 100%; height: 100%;"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import axios from 'axios'
import StockChart from './StockChart.vue'

const emit = defineEmits(['view-chart'])

// 监听来自App的策略上下文恢复事件
const restoreContext = (event) => {
  const { strategy, preset, date } = event.detail
  if (strategy) {
    // 更新策略选择
    selectedStrategy.value = strategy
    
    // 更新参数风格（如果提供）
    if (preset) {
      selectedPreset.value = preset
    }
    
    // 更新日期（如果提供）
    if (date) {
      selectedDate.value = date
    }
    
    // 重新加载相关数据
    fetchDates()
  }
}

// 组件挂载时添加事件监听器
onMounted(() => {
  window.addEventListener('restore-strategy-context', restoreContext)

  // Make loading observable immediately (important for UX + unit tests)
  loading.value = true

  ;(async () => {
    try {
      await fetchPresets()
      await fetchParams()
      await fetchDates()
    } finally {
      loading.value = false
    }
  })()
})

// 组件卸载时移除事件监听器
onUnmounted(() => {
  window.removeEventListener('restore-strategy-context', restoreContext)
})

const strategies = ref([
  { key: 'hidden_dragon', name: '潜龙低吸' },
  { key: 'turtle', name: '海龟交易' },
  { key: 'single_yang', name: '单阳不破' }
])

const selectedStrategy = ref('hidden_dragon')
const selectedPreset = ref('')  // Will be populated when presets are fetched
const availablePresets = ref([])
const selectedDate = ref('')
const availableDates = ref([])
const stocks = ref([])
const loading = ref(false)
const error = ref(null)

const backendParams = ref(null)

const currentParams = computed(() => {
  if (!backendParams.value) return null
  if (typeof backendParams.value !== 'object') return null
  if (Array.isArray(backendParams.value)) return null
  if (Object.keys(backendParams.value).length === 0) return null
  return backendParams.value
})

// 图表模态框相关变量
const showChartModal = ref(false)
const selectedStock = ref(null)
const chartLoading = ref(false)
const chartError = ref(null)
const isFullscreen = ref(false)

// 查看图表：交给 App.vue 统一跳转（将从策略股池跳到回测模块展示）
const viewChart = (stock) => {
  emit('view-chart', {
    symbol: stock.symbol,
    signalDate: stock.date,
    strategy: stock.strategy || selectedStrategy.value,
    preset: stock.preset || selectedPreset.value
  })
}

const closeChartModal = () => {
  showChartModal.value = false
  selectedStock.value = null
}

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
}

const getParamLabel = (key) => {
  const labels = {
    limit_up_rate: '涨停阈值',
    min_boom_days: '最少爆发天数',
    max_callback_days: '最大回调天数',
    entry_ma_period: '入场参考均线',
    ma_proximity_pct: '贴近均线比例',
    volume_shrink_pct: '缩量比例',
    stop_loss_pct: '止损比例',
    stop_loss_mode: '止损模式',
    take_profit_pct: '止盈比例',
    trailing_stop_pct: '移动止损比例',
    ma_break_tolerance: '破位容忍度',
    ma_break_days: '破位确认天数',
    exit_ma_period: '离场参考均线',
    big_yang_rate: '大阳涨幅阈值',
    vol_expand_rate: '放量倍数',
    max_consolidate_days: '最大整理天数',
    breakout_vol_rate: '突破放量倍数',
    position_pct: '单笔仓位',
    entry_window: '入场突破窗口',
    exit_window: '离场突破窗口',
    risk_pct: '风险比例',
    atr_window: 'ATR回看周期',
    max_units: '最大加仓单元',
    add_step_mult: '加仓步长(ATR倍数)',
    trailing_stop_mult: '移动止损(ATR倍数)',
    exit_mode: '离场模式'
  }
  return labels[key] || key
}

const formatParamValue = (key, val) => {
  if (key.includes('pct') || key.includes('rate')) {
    return (val * 100).toFixed(1) + '%'
  }
  if (key.endsWith('_days')) {
    return val + '日'
  }
  if (key.includes('ma_period') || key.includes('window')) {
    return val + '日'
  }
  return val
}

const formatDisplayDate = (dateStr) => {
  if (!dateStr || dateStr.length !== 8) return dateStr
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
}

const formatTime = (dtStr) => {
  if (!dtStr) return 'N/A'
  if (dtStr.includes(' ')) return dtStr.split(' ')[1]
  return dtStr
}

const formatPercentage = (val) => {
  if (val === null || val === undefined) return 'N/A'
  return (val * 100).toFixed(1) + '%'
}

const formatSharpe = (val) => {
  if (val === null || val === undefined || val === 0) return 'N/A'
  return val.toFixed(2)
}

const getWinRateClass = (winRate) => {
  if (winRate >= 0.6) return 'metric-excellent'
  if (winRate >= 0.5) return 'metric-good'
  if (winRate >= 0.4) return 'metric-fair'
  return 'metric-poor'
}

const getReturnClass = (ret) => {
  if (ret >= 0.1) return 'metric-excellent'
  if (ret >= 0.05) return 'metric-good'
  if (ret >= 0) return 'metric-fair'
  return 'metric-poor'
}

const getPresetLabel = (preset) => {
  const labels = {
    'default': '标准',
    'conservative': '保守（高胜率）',
    'aggressive': '激进（高频交易）',
    'dragon_conservative': '保守',
    'dragon_default': '标准',
    'dragon_aggressive': '激进',
    'yang_conservative': '保守',
    'yang_default': '标准',
    'yang_aggressive': '激进',
    'turtle_conservative': '保守',
    'turtle_standard': '标准',
    'turtle_classic': '经典',
    'turtle_aggressive': '激进'
  }
  return labels[preset] || preset
}

const fetchParams = async () => {
  if (!selectedStrategy.value) {
    backendParams.value = null
    return
  }

  try {
    console.log('[StrategyPool] Fetching params for:', { strategy: selectedStrategy.value, preset: selectedPreset.value })
    let url = `/api/strategy-pool/params?strategy=${selectedStrategy.value}`
    if (selectedPreset.value) {
      url += `&preset=${selectedPreset.value}`
    }

    const res = await axios.get(url)
    console.log('[StrategyPool] Params response:', res.data)

    if (res.data && res.data.success && res.data.found && res.data.params) {
      backendParams.value = res.data.params
    } else {
      backendParams.value = null
    }
  } catch (err) {
    console.error('Failed to fetch params:', err)
    backendParams.value = null
  }
}

const fetchPresets = async () => {
  if (!selectedStrategy.value) return
  
  try {
    console.log('[StrategyPool] Fetching presets for strategy:', selectedStrategy.value)
    const res = await axios.get(`/api/strategy-pool/presets?strategy=${selectedStrategy.value}`)
    console.log('[StrategyPool] Presets response:', res.data)
    if (res.data.success) {
      availablePresets.value = res.data.presets || []
      // Ensure selectedPreset is always a valid choice for the current strategy.
      if (availablePresets.value.length === 0) {
        selectedPreset.value = ''
        return
      }

      if (!selectedPreset.value || !availablePresets.value.includes(selectedPreset.value)) {
        selectedPreset.value = availablePresets.value[0]
      }
    }
  } catch (err) {
    console.error('Failed to fetch presets:', err)
    availablePresets.value = []
    selectedPreset.value = ''
  }
}

const fetchDates = async () => {
  try {
    loading.value = true
    error.value = null
    console.log('[StrategyPool] Fetching dates for strategy:', selectedStrategy.value, 'preset:', selectedPreset.value)
    
    let url = `/api/strategy-pool/dates?strategy=${selectedStrategy.value}`
    if (selectedPreset.value) {
      url += `&preset=${selectedPreset.value}`
    }
    
    const res = await axios.get(url)
    console.log('[StrategyPool] Dates response:', res.data)
    if (res.data.success) {
      availableDates.value = res.data.dates
      
      // Always select the most recent date for the new strategy/preset
      // regardless of the current selected date
      if (availableDates.value.length > 0) {
        selectedDate.value = availableDates.value[0]  // Most recent date for this strategy/preset
      } else {
        selectedDate.value = ''
        stocks.value = []
      }
    }
  } catch (err) {
    console.error('Failed to fetch dates:', err)
    error.value = '获取可用日期失败，请检查网络或登录状态'
  } finally {
    loading.value = false
  }
}

const fetchStocks = async () => {
  if (!selectedDate.value) {
    stocks.value = []
    return
  }
  
  try {
    loading.value = true
    error.value = null
    console.log('[StrategyPool] Fetching stocks for:', { 
      date: selectedDate.value, 
      strategy: selectedStrategy.value,
      preset: selectedPreset.value 
    })
    
    let url = `/api/strategy-pool/stocks?date=${selectedDate.value}&strategy=${selectedStrategy.value}`
    if (selectedPreset.value) {
      url += `&preset=${selectedPreset.value}`
    }
    
    const res = await axios.get(url)
    console.log('[StrategyPool] Stocks response:', res.data)
    if (res.data.success) {
      stocks.value = res.data.stocks
    }
  } catch (err) {
    console.error('Failed to fetch stocks:', err)
    error.value = '获取选股池数据失败'
  } finally {
    loading.value = false
  }
}

const refreshData = async () => {
  await fetchPresets()
  await fetchParams()
  await fetchDates()
  // 注意：fetchDates 内部修改 selectedDate 会触发下面的 watch，从而调用 fetchStocks
}

const onStrategyChange = async () => {
  // When strategy changes, fetch presets first, then dates
  await fetchPresets()
  await fetchParams()
  await fetchDates()
  // Force reload stocks even if date unchanged
  if (selectedDate.value) {
    await fetchStocks()
  }
}

// The viewChart function is now defined above in the modal section
// Emitting the event is no longer needed since we show the chart inline
const emitViewChartEvent = (stock) => {
  emit('view-chart', {
    symbol: stock.symbol,
    signalDate: stock.date,
    strategy: stock.strategy,
    preset: stock.preset || selectedPreset.value  // Pass preset for trade history lookup
  })
}

const getStrategyReason = (strategy) => {
  const reasons = {
    'hidden_dragon': '前板龙头回调：该股前期出现强力涨停（龙抬头），近期缩量回调至支撑均线，形态符合潜龙低吸标准，看好二次起爆。',
    'turtle': '趋势突破：价格突破过去20日（或50日）最高价，进入强趋势通道，符合海龟交易法则入场信号。',
    'single_yang': '单阳不破：前期出现一根大阳线，随后价格在阳线实体范围内缩量整理，显示主力控盘力度强，蓄势待发。'
  }
  return reasons[strategy] || '符合策略量化选股标准。'
}

// 监听日期变化，自动获取股票
watch(selectedDate, (newDate) => {
  if (newDate) {
    fetchStocks()
  }
})

// 监听策略变化，更新日期列表
watch(selectedStrategy, onStrategyChange)

// 监听 preset 变化，更新日期和股票
watch(selectedPreset, async () => {
  await fetchParams()
  await fetchDates()
  // 强制重新加载股票，即使日期没变
  if (selectedDate.value) {
    await fetchStocks()
  }
})
</script>

<style scoped>
.strategy-pool {
  padding: 10px;
  color: #e6e6fa;
}

.controls-card {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  background: rgba(30, 30, 63, 0.6);
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 15px;
  border: 1px solid rgba(138, 43, 226, 0.3);
  align-items: center;
}

.strategy-info-card {
  background: rgba(138, 43, 226, 0.1);
  border: 1px solid rgba(138, 43, 226, 0.3);
  border-radius: 12px;
  padding: 15px 20px;
  margin-bottom: 25px;
}

.info-header {
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(138, 43, 226, 0.2);
  padding-bottom: 8px;
}

.info-title {
  color: #b19cd9;
  font-weight: 600;
  font-size: 15px;
}

.params-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 15px;
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.param-label {
  font-size: 12px;
  color: #94a3b8;
}

.param-value {
  font-size: 14px;
  color: #fff;
  font-weight: 600;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.control-group label {
  font-weight: 600;
  color: #b19cd9;
}

select {
  padding: 8px 12px;
  background: rgba(15, 15, 35, 0.8);
  border: 1px solid rgba(138, 43, 226, 0.5);
  border-radius: 6px;
  color: white;
  outline: none;
}

.refresh-btn button {
  padding: 8px 20px;
  background: linear-gradient(135deg, #8a2be2 0%, #9370db 100%);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  transition: all 0.3s;
}

.refresh-btn button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(138, 43, 226, 0.4);
}

.refresh-btn button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.stock-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.stock-card {
  background: rgba(42, 42, 94, 0.6);
  border-radius: 12px;
  border: 1px solid rgba(138, 43, 226, 0.2);
  padding: 15px;
  transition: all 0.3s;
  cursor: pointer;
  display: flex;
  flex-direction: column;
}

.stock-card:hover {
  transform: translateY(-5px);
  border-color: #8a2be2;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
  background: rgba(50, 50, 110, 0.8);
}

.stock-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  border-bottom: 1px solid rgba(138, 43, 226, 0.2);
  padding-bottom: 10px;
}

.stock-name {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
}

.stock-symbol {
  font-family: monospace;
  background: rgba(138, 43, 226, 0.2);
  padding: 2px 8px;
  border-radius: 4px;
  color: #b19cd9;
}

.stock-body {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.label {
  color: #94a3b8;
}

.value {
  font-weight: 500;
}

.price-tag {
  color: #fbbf24;
  font-weight: 700;
  font-size: 16px;
}

.analysis-section {
  margin-top: 15px;
  background: rgba(138, 43, 226, 0.1);
  padding: 12px;
  border-radius: 6px;
  border-left: 3px solid rgba(138, 43, 226, 0.6);
}

.hist-metrics {
  margin-top: 12px;
  background: rgba(75, 192, 192, 0.1);
  padding: 10px;
  border-radius: 6px;
  border: 1px solid rgba(75, 192, 192, 0.3);
}

.metrics-title {
  font-size: 12px;
  color: #4bc0c0;
  font-weight: 600;
  margin-bottom: 8px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.metric-item {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.metric-label {
  color: #94a3b8;
}

.metric-value {
  font-weight: 600;
  color: #fff;
}

.metric-excellent {
  color: #10b981 !important;
}

.metric-good {
  color: #3b82f6 !important;
}

.metric-fair {
  color: #f59e0b !important;
}

.metric-poor {
  color: #ef4444 !important;
}

.analysis-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed rgba(138, 43, 226, 0.2);
}

.analysis-label {
  font-size: 12px;
  color: #b19cd9;
  margin-bottom: 4px;
}

.analysis-text {
  font-size: 13px;
  color: #e6e6fa;
  line-height: 1.5;
  background: rgba(138, 43, 226, 0.1);
  padding: 8px;
  border-radius: 4px;
}

.action-buy {
  color: #4ade80;
  font-weight: 700;
}

.stock-footer {
  margin-top: 15px;
  text-align: center;
}

.view-btn {
  width: 100%;
  padding: 8px;
  background: rgba(138, 43, 226, 0.15);
  border: 1px solid rgba(138, 43, 226, 0.4);
  border-radius: 6px;
  color: #b19cd9;
  cursor: pointer;
  transition: all 0.2s;
}

.stock-card:hover .view-btn {
  background: #8a2be2;
  color: white;
  border-color: #8a2be2;
}

.empty-state, .loading-state {
  text-align: center;
  padding: 100px;
  background: rgba(30, 30, 63, 0.3);
  border-radius: 12px;
  color: #b19cd9;
  font-size: 18px;
}

.error-msg {
  background: rgba(220, 38, 38, 0.2);
  border: 1px solid rgba(220, 38, 38, 0.5);
  color: #f87171;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 20px;
}


/* 图表模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(5px);
}

.chart-modal {
  width: 90vw;
  height: 85vh;
  max-width: 1400px;
  max-height: 90vh;
  background: rgba(26, 26, 58, 0.95);
  border-radius: 12px;
  border: 1px solid rgba(138, 43, 226, 0.5);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: rgba(138, 43, 226, 0.2);
  border-bottom: 1px solid rgba(138, 43, 226, 0.3);
}

.modal-header h3 {
  margin: 0;
  color: #e6e6fa;
  font-size: 16px;
}

.modal-controls {
  display: flex;
  align-items: center;
  gap: 15px;
}

.strategy-info, .preset-info {
  font-size: 12px;
  color: #b19cd9;
  background: rgba(138, 43, 226, 0.2);
  padding: 4px 8px;
  border-radius: 4px;
}

.fullscreen-btn, .close-modal {
  background: rgba(138, 43, 226, 0.3);
  border: 1px solid rgba(138, 43, 226, 0.5);
  color: #e6e6fa;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.fullscreen-btn:hover, .close-modal:hover {
  background: rgba(138, 43, 226, 0.5);
  transform: scale(1.05);
}

.chart-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
}

.chart-container.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw !important;
  height: 100vh !important;
  z-index: 1001;
  border-radius: 0;
}

.chart-loading, .chart-error {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #e6e6fa;
  font-size: 16px;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(138, 43, 226, 0.3);
  border-top: 3px solid #8a2be2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
