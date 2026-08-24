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

    <details class="strategy-info-card" v-if="currentParams">
      <summary class="info-header">
        <span class="info-title">当前策略参数: {{ strategies.find(s => s.key === selectedStrategy)?.name }}</span>
      </summary>
      <div class="params-grid">
        <div v-for="(val, key) in currentParams" :key="key" class="param-item">
          <span class="param-label">{{ getParamLabel(key) }}:</span>
          <span class="param-value">{{ formatParamValue(key, val) }}</span>
        </div>
      </div>
    </details>

    <div v-if="error" class="error-msg">
      {{ error }}
    </div>

    <div class="pool-content">
      <div v-if="loading && stocks.length === 0" class="loading-state">
        正在获取策略信号...
      </div>
      <div v-else-if="stocks.length === 0" class="empty-state">
        该日期暂无选股信号
      </div>
      <div v-else class="pool-workspace">
        <div class="pool-list">
          <div
            v-for="stock in stocks"
            :key="stock.symbol"
            class="pool-row"
            :class="{ selected: isSelected(stock) }"
            role="button"
            tabindex="0"
            @click="onSelectStock(stock)"
            @keydown.enter.prevent="onSelectStock(stock)"
          >
            <div class="pool-row-head">
              <span class="stock-name">{{ stock.name || '未知' }}</span>
              <span class="stock-symbol">{{ stock.symbol }}</span>
            </div>
            <div class="pool-row-meta">
              <span class="action-buy">买入</span>
              <span v-if="stock.price" class="price-tag">{{ stock.price.toFixed(2) }}</span>
              <span v-if="stock.hist_win_rate !== undefined" class="muted-metric">
                胜率 {{ formatPercentage(stock.hist_win_rate) }}
              </span>
            </div>
            <button type="button" class="row-backtest-btn" @click.stop="openBacktestDetail(stock)">
              完整回测
            </button>
          </div>
        </div>

        <section class="pool-chart-pane">
          <header class="chart-pane-head">
            <div>
              <h2 class="chart-title">
                {{ selectedStock?.name || 'K 线验真' }}
                <span v-if="selectedStock?.symbol" class="chart-symbol">{{ selectedStock.symbol }}</span>
              </h2>
              <p class="chart-disclaimer">{{ chartDisclaimer || '含信号日之后走势，仅供事后验证。' }}</p>
            </div>
            <button
              type="button"
              class="view-btn chart-backtest-btn"
              :disabled="!selectedStock"
              @click="selectedStock && openBacktestDetail(selectedStock)"
            >
              查看完整回测
            </button>
          </header>

          <div v-if="forwardReturns?.horizons?.length" class="forward-strip">
            <span class="forward-label">事后收益</span>
            <span
              v-for="item in forwardReturns.horizons"
              :key="item.days"
              class="forward-item"
              :class="forwardClass(item)"
            >
              +{{ item.days }}日
              {{ formatForwardReturn(item) }}
            </span>
          </div>

          <div v-if="chartError" class="error-msg">{{ chartError }}</div>
          <div v-if="chartLoading" class="chart-loading">加载 K 线与买卖点…</div>
          <StockKLineChart
            v-else-if="chartRecords.length"
            :records="chartRecords"
            :markers="chartMarkers"
            :chart-meta="chartMeta"
          />
          <div v-else class="chart-empty">选择左侧股票查看日 K 与历史买卖点</div>
        </section>
      </div>
    </div>

    <BacktestResultDetailModal
      :open="detailOpen"
      :title="detailTitle"
      :subtitle="detailSubtitle"
      :result="detailResult"
      :meta="detailMeta"
      :loading="detailLoading"
      :loading-message="detailLoadingMessage"
      :error="detailError"
      @close="closeBacktestDetail"
    >
      <template #actions>
        <BacktestDeployActions :payload="detailDeployPayload" />
        <button type="button" class="action-close-btn" @click="closeBacktestDetail">关闭</button>
      </template>
    </BacktestResultDetailModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { loadStrategyPoolBacktestDetail } from '../api/strategyPool'
import { useStrategyPoolChart } from '../composables/useStrategyPoolChart'
import request from '../utils/request'
import BacktestDeployActions from './BacktestDeployActions.vue'
import BacktestResultDetailModal from './BacktestResultDetailModal.vue'
import StockKLineChart from './StockKLineChart.vue'

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

const {
  selectedStock,
  loading: chartLoading,
  error: chartError,
  records: chartRecords,
  markers: chartMarkers,
  forwardReturns,
  disclaimer: chartDisclaimer,
  chartMeta,
  selectStock,
  clear: clearChart,
} = useStrategyPoolChart()

const backendParams = ref(null)

const currentParams = computed(() => {
  if (!backendParams.value) return null
  if (typeof backendParams.value !== 'object') return null
  if (Array.isArray(backendParams.value)) return null
  if (Object.keys(backendParams.value).length === 0) return null
  return backendParams.value
})

// 回测详情（本地弹窗，不再跳转回测管理）
const detailOpen = ref(false)
const detailLoading = ref(false)
const detailLoadingMessage = ref('加载回测结果…')
const detailError = ref('')
const detailResult = ref(null)
const detailMeta = ref({})

const detailTitle = computed(() => {
  const symbol = detailMeta.value.symbol || detailResult.value?.symbol
  return symbol ? `回测结果 · ${symbol}` : '回测结果'
})

const detailSubtitle = computed(() => {
  const parts = [detailMeta.value.strategy_key, detailMeta.value.preset].filter(Boolean)
  return parts.join(' · ')
})

const detailDeployPayload = computed(() => ({
  symbol: detailMeta.value.symbol,
  strategy_key: detailMeta.value.strategy_key,
  strategy_params: detailMeta.value.strategy_params || {},
  asset_type: detailMeta.value.asset_type || 'stock',
}))

async function openBacktestDetail(stock) {
  if (!stock) return
  detailOpen.value = true
  detailLoading.value = true
  detailLoadingMessage.value = '加载回测结果…'
  detailError.value = ''
  detailResult.value = null
  detailMeta.value = {
    symbol: stock.symbol,
    strategy_key: stock.strategy || selectedStrategy.value,
    preset: stock.preset || selectedPreset.value || '',
  }

  try {
    const { result, meta } = await loadStrategyPoolBacktestDetail({
      symbol: stock.symbol,
      strategy: stock.strategy || selectedStrategy.value,
      preset: stock.preset || selectedPreset.value,
      signalDate: stock.date,
    })
    detailResult.value = result
    detailMeta.value = meta
  } catch (err) {
    detailError.value = err?.response?.data?.detail || err?.message || '加载回测结果失败'
  } finally {
    detailLoading.value = false
  }
}

function closeBacktestDetail() {
  detailOpen.value = false
  detailLoading.value = false
  detailError.value = ''
  detailResult.value = null
  detailMeta.value = {}
}

function isSelected(stock) {
  return Boolean(stock?.symbol && selectedStock.value?.symbol === stock.symbol)
}

function onSelectStock(stock) {
  selectStock(stock, {
    strategy: selectedStrategy.value,
    preset: selectedPreset.value,
  })
}

function formatForwardReturn(item) {
  if (!item?.available || item.return == null) return '—'
  const pct = item.return * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

function forwardClass(item) {
  if (!item?.available || item.return == null) return 'forward-na'
  if (item.return > 0) return 'forward-pos'
  if (item.return < 0) return 'forward-neg'
  return 'forward-flat'
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

const formatPercentage = (val) => {
  if (val === null || val === undefined) return 'N/A'
  return (val * 100).toFixed(1) + '%'
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
    let url = `/strategy-pool/params?strategy=${selectedStrategy.value}`
    if (selectedPreset.value) {
      url += `&preset=${selectedPreset.value}`
    }

    const body = await request({ method: 'get', url })
    console.log('[StrategyPool] Params response:', body)

    if (body && body.success && body.found && body.params) {
      backendParams.value = body.params
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
    const body = await request({
      method: 'get',
      url: `/strategy-pool/presets?strategy=${selectedStrategy.value}`,
    })
    console.log('[StrategyPool] Presets response:', body)
    if (body.success) {
      availablePresets.value = body.presets || []
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
    
    let url = `/strategy-pool/dates?strategy=${selectedStrategy.value}`
    if (selectedPreset.value) {
      url += `&preset=${selectedPreset.value}`
    }
    
    const body = await request({ method: 'get', url })
    console.log('[StrategyPool] Dates response:', body)
    if (body.success) {
      availableDates.value = body.dates
      
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
    clearChart()
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
    
    let url = `/strategy-pool/stocks?date=${selectedDate.value}&strategy=${selectedStrategy.value}`
    if (selectedPreset.value) {
      url += `&preset=${selectedPreset.value}`
    }
    
    const body = await request({ method: 'get', url })
    console.log('[StrategyPool] Stocks response:', body)
    if (body.success) {
      stocks.value = body.stocks
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

watch(stocks, (list) => {
  if (!Array.isArray(list) || list.length === 0) {
    clearChart()
    return
  }
  const current = selectedStock.value
  const match = current && list.find((stock) => stock.symbol === current.symbol)
  onSelectStock(match || list[0])
})

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
  cursor: pointer;
  list-style: none;
}

.strategy-info-card summary::-webkit-details-marker {
  display: none;
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

.pool-workspace {
  display: grid;
  grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.pool-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 640px;
  overflow: auto;
}

.pool-row {
  text-align: left;
  background: rgba(42, 42, 94, 0.6);
  border-radius: 10px;
  border: 1px solid rgba(138, 43, 226, 0.2);
  padding: 10px 12px;
  color: inherit;
  cursor: pointer;
}

.pool-row.selected {
  border-color: #c4b5fd;
  background: rgba(76, 29, 149, 0.55);
}

.pool-row-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.pool-row-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
  font-size: 12px;
  align-items: center;
}

.muted-metric {
  color: #94a3b8;
}

.row-backtest-btn {
  margin-top: 8px;
  width: 100%;
  padding: 4px 8px;
  background: transparent;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 6px;
  color: #cbd5e1;
  cursor: pointer;
  font-size: 12px;
}

.pool-chart-pane {
  background: rgba(15, 23, 42, 0.45);
  border: 1px solid rgba(138, 43, 226, 0.25);
  border-radius: 12px;
  padding: 12px;
  min-height: 480px;
}

.chart-pane-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 10px;
}

.chart-title {
  margin: 0;
  font-size: 18px;
  color: #fff;
}

.chart-symbol {
  margin-left: 8px;
  font-family: monospace;
  font-size: 13px;
  color: #c4b5fd;
}

.chart-disclaimer {
  margin: 4px 0 0;
  color: #fbbf24;
  font-size: 12px;
}

.chart-backtest-btn {
  width: auto;
  padding: 8px 14px;
}

.forward-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
  font-size: 13px;
}

.forward-label {
  color: #94a3b8;
}

.forward-pos { color: #4ade80; font-weight: 700; }
.forward-neg { color: #f87171; font-weight: 700; }
.forward-flat, .forward-na { color: #94a3b8; }

.chart-loading,
.chart-empty {
  min-height: 380px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #b19cd9;
}

@media (max-width: 960px) {
  .pool-workspace {
    grid-template-columns: 1fr;
  }
  .pool-list {
    max-height: 280px;
  }
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


.action-close-btn {
  padding: 10px 20px;
  background: #f4f4f5;
  color: #606266;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.action-close-btn:hover {
  background: #e9e9eb;
}
</style>
