<template>
  <div class="minute-kline-container">
    <!-- 控制面板 -->
    <div class="controls">
      <div class="control-row">
        <label>日期选择:</label>
        <input type="date" v-model="selectedDate" @change="fetchData" />
        <button @click="fetchData" :disabled="loading" class="refresh-btn">
          {{ loading ? '加载中...' : '刷新数据' }}
        </button>
      </div>
      
      <div class="info-row">
        <span class="info-item">
          <strong>股票:</strong> {{ props.symbol || '-' }}
        </span>
        <span class="info-item">
          <strong>K线数量:</strong> {{ minuteBars.length }} 条
        </span>
        <span class="info-item">
          <strong>信号数量:</strong> {{ tradeSignals.length }} 个
        </span>
        <span class="info-item" v-if="error" style="color: red;">
          {{ error }}
        </span>
      </div>
    </div>

    <!-- 图表容器 -->
    <div ref="chartRef" class="chart-container"></div>

    <!-- 股票切换按钮 -->
    <div class="stock-navigation" v-if="watchlist && watchlist.length > 1">
      <button @click="props.prevStock" :disabled="!props.hasPrev" class="nav-btn">
        ← 上一个
      </button>
      <span class="stock-info">
        当前: {{ props.symbol }}{{ props.stockName ? ` - ${props.stockName}` : '' }}
        ({{ currentIndex + 1 }} / {{ watchlist.length }})
      </span>
      <button @click="props.nextStock" :disabled="!props.hasNext" class="nav-btn">
        下一个 →
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import axios from 'axios'

const props = defineProps({
  symbol: {
    type: String,
    required: true
  },
  stockName: {
    type: String,
    default: ''
  },
  // 添加股票切换功能
  prevStock: Function,
  nextStock: Function,
  hasPrev: Boolean,
  hasNext: Boolean,
  watchlist: Array,
  currentIndex: Number
})

// Lazy-load ECharts
let echarts = null
const chartRef = ref(null)
let chartInstance = null

// 数据状态
const minuteBars = ref([])
const tradeSignals = ref([])
const selectedDate = ref(getTodayDate())
const loading = ref(false)
const error = ref('')

// 获取今天日期（YYYY-MM-DD格式）
function getTodayDate() {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

// 格式化时间戳为可读时间
function formatTimestamp(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp * 1000)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

// 格式化trade_date（YYYYMMDDHHMM -> HH:MM）
function formatTradeDate(tradeDate) {
  if (!tradeDate || tradeDate.length < 12) return ''
  const hour = tradeDate.substring(8, 10)
  const minute = tradeDate.substring(10, 12)
  return `${hour}:${minute}`
}

// 获取数据
async function fetchData() {
  if (!props.symbol || !selectedDate.value) {
    error.value = '请选择股票和日期'
    return
  }

  loading.value = true
  error.value = ''

  try {
    // 将日期转为YYYYMMDD格式
    const dateStr = selectedDate.value.replace(/-/g, '')
    
    // 并行获取分钟K线和交易信号
    const [barsRes, signalsRes] = await Promise.all([
      axios.get('/api/minute-bars/', {
        params: {
          symbol: props.symbol,
          start_date: dateStr,
          end_date: dateStr,
          limit: 500
        }
      }),
      axios.get('/api/trade-signals/', {
        params: {
          symbol: props.symbol,
          start_date: selectedDate.value,
          end_date: selectedDate.value,
          limit: 200
        }
      })
    ])

    minuteBars.value = barsRes.data.data || []
    tradeSignals.value = signalsRes.data.data || []

    console.log(`加载完成: ${minuteBars.value.length}条K线, ${tradeSignals.value.length}个信号`)
    
    // 绘制图表
    drawChart()

  } catch (err) {
    console.error('数据加载失败:', err)
    error.value = err.response?.data?.detail || err.message || '加载失败'
  } finally {
    loading.value = false
  }
}

// 绘制图表
async function drawChart() {
  if (!chartInstance) {
    if (!echarts) {
      const mod = await import('echarts')
      echarts = mod.default || mod
    }
    chartInstance = echarts.init(chartRef.value)
    window.addEventListener('resize', handleResize)
  }

  if (!minuteBars.value || minuteBars.value.length === 0) {
    chartInstance.clear()
    return
  }

  // 准备数据
  const times = minuteBars.value.map(bar => formatTradeDate(bar.trade_date))
  const klineData = minuteBars.value.map(bar => [bar.open, bar.close, bar.low, bar.high])
  const volumeData = minuteBars.value.map(bar => bar.volume || 0)

  // 准备信号标记点
  const buyMarkers = []
  const sellMarkers = []

  tradeSignals.value.forEach(signal => {
    // 根据timestamp找到对应的K线索引
    const signalDate = new Date(signal.timestamp * 1000)
    const signalTimeStr = `${signalDate.getHours().toString().padStart(2, '0')}:${signalDate.getMinutes().toString().padStart(2, '0')}`
    
    console.log(`处理信号: ${signal.action}, 时间=${signalTimeStr}, 价格=${signal.price}`)
    
    // 查找最接近的时间点
    let closestIndex = -1
    let minDiff = Infinity
    
    times.forEach((time, idx) => {
      const diff = Math.abs(time.localeCompare(signalTimeStr))
      if (diff < minDiff) {
        minDiff = diff
        closestIndex = idx
      }
    })
    
    if (closestIndex !== -1) {
      console.log(`信号匹配到K线索引: ${closestIndex}, 时间=${times[closestIndex]}`)
      
      const marker = {
        name: signal.action === 'buy' ? '买入' : '卖出',
        coord: [closestIndex, signal.price],
        value: `${signal.action === 'buy' ? '买' : '卖'}\n¥${signal.price.toFixed(2)}`,
        symbol: signal.action === 'buy' ? 'triangle' : 'pin',
        symbolSize: 20,
        itemStyle: {
          color: signal.action === 'buy' ? '#26a69a' : '#ef5350'
        },
        label: {
          show: true,
          position: signal.action === 'buy' ? 'bottom' : 'top',
          formatter: '{c}',
          fontSize: 11,
          color: '#fff',
          backgroundColor: signal.action === 'buy' ? '#26a69a' : '#ef5350',
          padding: [4, 8],
          borderRadius: 4
        }
      }
      
      if (signal.action === 'buy') {
        buyMarkers.push(marker)
      } else {
        sellMarkers.push(marker)
      }
    } else {
      console.warn(`信号未找到匹配的K线: ${signalTimeStr}`)
    }
  })
  
  console.log(`总共添加 ${buyMarkers.length} 个买入信号, ${sellMarkers.length} 个卖出信号`)

  // ECharts配置
  const option = {
    title: {
      text: `${props.symbol}${props.stockName ? ' - ' + props.stockName : ''} 分钟K线 (${selectedDate.value})`,
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      },
      formatter: function (params) {
        let result = `<strong>${params[0].axisValue}</strong><br/>`
        params.forEach(param => {
          if (param.seriesName === 'K线') {
            const data = param.data
            result += `开: ${data[1]}<br/>收: ${data[2]}<br/>低: ${data[3]}<br/>高: ${data[4]}<br/>`
          } else if (param.seriesName === '成交量') {
            result += `成交量: ${param.data}<br/>`
          }
        })
        return result
      }
    },
    legend: {
      data: ['K线', '成交量', '买入', '卖出'],
      top: 30
    },
    grid: [
      {
        left: '8%',
        right: '8%',
        top: '15%',
        height: '60%'
      },
      {
        left: '8%',
        right: '8%',
        top: '78%',
        height: '15%'
      }
    ],
    xAxis: [
      {
        type: 'category',
        data: times,
        scale: true,
        boundaryGap: false,
        axisLine: { onZero: false },
        splitLine: { show: false },
        min: 'dataMin',
        max: 'dataMax',
        axisPointer: { label: { show: true } },
        axisLabel: {
          rotate: 45,
          interval: Math.floor(times.length / 10)  // 只显示部分标签
        }
      },
      {
        type: 'category',
        gridIndex: 1,
        data: times,
        scale: true,
        boundaryGap: false,
        axisLine: { onZero: false },
        splitLine: { show: false },
        axisLabel: { show: false }
      }
    ],
    yAxis: [
      {
        scale: true,
        splitArea: { show: true }
      },
      {
        scale: true,
        gridIndex: 1,
        splitNumber: 2,
        axisLabel: { show: false },
        splitLine: { show: false }
      }
    ],
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: [0, 1],
        start: 0,
        end: 100
      },
      {
        show: true,
        xAxisIndex: [0, 1],
        type: 'slider',
        top: '93%',
        start: 0,
        end: 100
      }
    ],
    series: [
      {
        name: 'K线',
        type: 'candlestick',
        data: klineData,
        itemStyle: {
          color: '#ef5350',
          color0: '#26a69a',
          borderColor: '#ef5350',
          borderColor0: '#26a69a'
        },
        markPoint: {
          symbol: 'pin',
          symbolSize: 50,
          data: [
            ...buyMarkers.map(m => ({
              name: m.name,
              coord: m.coord,
              value: m.value,
              symbol: m.symbol,
              symbolSize: m.symbolSize,
              itemStyle: m.itemStyle,
              label: m.label
            })),
            ...sellMarkers.map(m => ({
              name: m.name,
              coord: m.coord,
              value: m.value,
              symbol: m.symbol,
              symbolSize: m.symbolSize,
              itemStyle: m.itemStyle,
              label: m.label
            }))
          ]
        }
      },
      {
        name: '成交量',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumeData,
        itemStyle: {
          color: function(params) {
            const index = params.dataIndex
            if (index === 0) return '#ef5350'
            const current = klineData[index]
            const previous = klineData[index - 1]
            return current[1] >= previous[1] ? '#ef5350' : '#26a69a'
          }
        }
      }
    ]
  }

  chartInstance.setOption(option)
}

function handleResize() {
  if (chartInstance) {
    chartInstance.resize()
  }
}

// 监听symbol变化
watch(() => props.symbol, (newSymbol) => {
  if (newSymbol) {
    console.log('股票切换到:', newSymbol, props.stockName)
    fetchData()
  }
})

// 监听stockName变化，更新图表标题
watch(() => props.stockName, () => {
  if (chartInstance && minuteBars.value.length > 0) {
    console.log('更新图表标题:', props.symbol, props.stockName)
    chartInstance.setOption({
      title: {
        text: `${props.symbol}${props.stockName ? ' - ' + props.stockName : ''} 分钟K线 (${selectedDate.value})`
      }
    })
  }
})

onMounted(async () => {
  if (props.symbol) {
    fetchData()
  }
})

onBeforeUnmount(() => {
  if (chartInstance) {
    window.removeEventListener('resize', handleResize)
    chartInstance.dispose()
  }
})
</script>

<style scoped>
.minute-kline-container {
  width: 100%;
  padding: 10px;
  background: #fff;
  border-radius: 4px;
}

.controls {
  margin-bottom: 15px;
  padding: 10px;
  background: #f5f5f5;
  border-radius: 4px;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.control-row label {
  font-weight: bold;
  font-size: 14px;
}

.control-row input[type="date"] {
  padding: 5px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.refresh-btn {
  padding: 5px 15px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.refresh-btn:hover:not(:disabled) {
  background: #1976D2;
}

.refresh-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.info-row {
  display: flex;
  gap: 20px;
  font-size: 13px;
  color: #666;
}

.info-item strong {
  color: #333;
}

.chart-container {
  width: 100%;
  height: 600px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.stock-navigation {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-top: 15px;
  padding: 10px;
  background: #f5f5f5;
  border-radius: 4px;
}

.nav-btn {
  padding: 8px 20px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.3s;
}

.nav-btn:hover:not(:disabled) {
  background: #1976D2;
}

.nav-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.stock-info {
  font-size: 14px;
  font-weight: bold;
  color: #333;
}
</style>
