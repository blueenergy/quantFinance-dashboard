<template>
  <div class="strategy-pool">
    <div class="controls-card">
      <div class="control-group">
        <label>选择策略:</label>
        <select v-model="selectedStrategy" @change="fetchDates">
          <option v-for="strat in strategies" :key="strat.key" :value="strat.key">
            {{ strat.name }}
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
            <div class="analysis-section" v-if="getStrategyReason(stock.strategy)">
              <div class="analysis-label">买入原因分析:</div>
              <div class="analysis-text">{{ getStrategyReason(stock.strategy) }}</div>
            </div>
          </div>
          <div class="stock-footer">
            <button class="view-btn">查看图表</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'

const emit = defineEmits(['view-chart'])

const strategies = ref([
  { key: 'hidden_dragon', name: '潜龙低吸' },
  { key: 'turtle', name: '海龟交易' },
  { key: 'single_yang', name: '单阳不破' }
])

const selectedStrategy = ref('hidden_dragon')
const selectedDate = ref('')
const availableDates = ref([])
const stocks = ref([])
const loading = ref(false)
const error = ref(null)

const strategyParams = {
  hidden_dragon: {
    limit_up_rate: 0.095,
    min_boom_days: 1,
    max_callback_days: 20,
    entry_ma_period: 60,
    ma_proximity_pct: 0.01,
    volume_shrink_pct: 0.6,
    stop_loss_pct: 0.05,
    trailing_stop_pct: 0.05
  },
  single_yang: {
    big_yang_rate: 0.05,
    vol_expand_rate: 1.5,
    max_consolidate_days: 8,
    breakout_vol_rate: 1.2,
    position_pct: 0.3,
    stop_loss_pct: 0.05
  },
  turtle: {
    entry_window: 55,
    exit_window: 10,
    risk_pct: 0.03,
    atr_window: 20,
    max_units: 4
  }
}

const currentParams = computed(() => strategyParams[selectedStrategy.value])

const getParamLabel = (key) => {
  const labels = {
    limit_up_rate: '涨停阈值',
    min_boom_days: '最少爆发天数',
    max_callback_days: '最大回调天数',
    entry_ma_period: '入场参考均线',
    ma_proximity_pct: '贴近均线比例',
    volume_shrink_pct: '缩量比例',
    stop_loss_pct: '止损比例',
    trailing_stop_pct: '移动止损比例',
    big_yang_rate: '大阳涨幅阈值',
    vol_expand_rate: '放量倍数',
    max_consolidate_days: '最大整理天数',
    breakout_vol_rate: '突破放量倍数',
    position_pct: '单笔仓位',
    entry_window: '入场突破窗口',
    exit_window: '离场突破窗口',
    risk_pct: '风险比例',
    atr_window: 'ATR回看周期',
    max_units: '最大加仓单元'
  }
  return labels[key] || key
}

const formatParamValue = (key, val) => {
  if (key.includes('pct') || key.includes('rate')) {
    return (val * 100).toFixed(1) + '%'
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

const fetchDates = async () => {
  try {
    loading.value = true
    error.value = null
    console.log('[StrategyPool] Fetching dates for strategy:', selectedStrategy.value)
    const res = await axios.get(`/api/strategy-pool/dates?strategy=${selectedStrategy.value}`)
    console.log('[StrategyPool] Dates response:', res.data)
    if (res.data.success) {
      availableDates.value = res.data.dates
      
      // 如果有日期且当前选择的日期不在列表中，默认选第一个
      if (availableDates.value.length > 0) {
        if (!selectedDate.value || !availableDates.value.includes(selectedDate.value)) {
          selectedDate.value = availableDates.value[0]
        }
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
    console.log('[StrategyPool] Fetching stocks for:', { date: selectedDate.value, strategy: selectedStrategy.value })
    const res = await axios.get(`/api/strategy-pool/stocks?date=${selectedDate.value}&strategy=${selectedStrategy.value}`)
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
  await fetchDates()
  // 注意：fetchDates 内部修改 selectedDate 会触发下面的 watch，从而调用 fetchStocks
}

const viewChart = (stock) => {
  emit('view-chart', {
    symbol: stock.symbol,
    signalDate: stock.date,
    strategy: stock.strategy
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

onMounted(async () => {
  await fetchDates()
})

// 监听日期变化，自动获取股票
watch(selectedDate, (newDate) => {
  if (newDate) {
    fetchStocks()
  }
})

// 监听策略变化，更新日期列表
watch(selectedStrategy, async () => {
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
</style>
