<template>
  <div>
    <div style="margin-bottom: 10px;">
      <label>选择K线类型:</label>
      <select v-model="kType" @change="drawChart">
        <option value="day">日线</option>
        <option value="week">周线</option>
        <option value="month">月线</option>
      </select>
      <span style="margin-left: 20px; color: #666; font-size: 12px;">
        {{ props.symbol ? `${props.symbol}${props.stockName ? ` - ${props.stockName}` : ''} | ` : '' }}数据量: {{ records?.length || 0 }} 条
      </span>
      <!-- 返回按钮 -->
      <button @click="goBack" style="margin-left: 20px; background-color: #6a5acd; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
        ← 返回之前页面
      </button>
    </div>
    <div style="margin-bottom: 10px;">
      <label>起始日期：</label>
      <input type="date" v-model="startDate" @change="drawChart" />
      <label style="margin-left:10px;">结束日期：</label>
      <input type="date" v-model="endDate" @change="drawChart" />
    </div>
    <div ref="chart" style="width: 100%; height: 600px; border: 1px solid #ddd;"></div>
    <div v-if="error" style="color: red; margin-top: 10px;">
      错误: {{ error }}
    </div>
    <div style="margin-bottom: 10px;">
      <button @click="props.prevStock" :disabled="!props.hasPrev">上一个</button>
      <button @click="props.nextStock" :disabled="!props.hasNext" style="margin-left:10px;">下一个</button>
      <span style="margin-left: 20px; color: #00ff00; font-weight: bold;">
        当前股票: {{ props.symbol }}{{ props.stockName ? ` - ${props.stockName}` : '' }}
      </span>
    </div>
    <div style="color: white; font-size: 12px; margin-bottom: 5px;">
      DEBUG: watchlist长度: {{ props.watchlist?.length }} | currentIndex: {{ props.currentIndex }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
// Lazy-load ECharts to reduce initial bundle size
let echarts

const emit = defineEmits(['go-back'])

const props = defineProps({
  records: Array,
  symbol: String,
  stockName: String,
  moneyFlowRecords: Array, // 新增
  signalDates: Array,      // 新增：信号日期列表
  tradeMarkers: Array,     // 新增：交易标记（买入+卖出）
  prevStock: Function,
  nextStock: Function,
  hasPrev: Boolean,
  hasNext: Boolean,
  watchlist: Array,   
  currentIndex: Number,
  strategyFrom: String, // 策略来源
  presetFrom: String,   // 参数风格来源
  dateFrom: String      // 日期来源
})

const chart = ref(null)
const kType = ref('day')
const error = ref('')
const startDate = ref('')
const endDate = ref('')

let chartInstance = null

function groupKline(data, type) {
  if (type === 'day') return data
  const grouped = {}
  data.forEach(item => {
    const date = new Date(item.trade_date)
    let key = ''
    if (type === 'week') {
      const year = date.getFullYear()
      const week = Math.ceil((date - new Date(year, 0, 1)) / 86400000 / 7)
      key = `${year}-W${week}`
    } else if (type === 'month') {
      key = `${date.getFullYear()}-${date.getMonth() + 1}`
    }
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(item)
  })
  return Object.entries(grouped).map(([key, arr]) => ({
    trade_date: key,
    open: arr[0].open,
    high: Math.max(...arr.map(i => i.high)),
    low: Math.min(...arr.map(i => i.low)),
    close: arr[arr.length - 1].close,
    volume: arr.reduce((sum, i) => sum + i.volume, 0)
  }))
}

function getKlineData() {
  const sorted = [...props.records].sort((a, b) => new Date(normalizeDate(a.trade_date)) - new Date(normalizeDate(b.trade_date)))
  
  // ✅ 核心修复：使用 normalizeDate 进行日期比较
  let filtered = sorted
  if (startDate.value) {
    filtered = filtered.filter(r => normalizeDate(r.trade_date) >= startDate.value)
  }
  if (endDate.value) {
    filtered = filtered.filter(r => normalizeDate(r.trade_date) <= endDate.value)
  }
  
 
  
  const kline = groupKline(filtered, kType.value)
  // money_flow 数据按日期映射
  const moneyFlowMap = {}
  if (props.moneyFlowRecords) {
    props.moneyFlowRecords.forEach(mf => {
      moneyFlowMap[normalizeDate(mf.trade_date)] = mf
    })
  }
  // console.log('moneyFlowRecords:', props.moneyFlowRecords)
  // console.log('moneyFlowRecords sample:', props.moneyFlowRecords && props.moneyFlowRecords.length > 0 ? props.moneyFlowRecords[0] : '无数据')
  // console.log('kline sample:', props.records && props.records.length > 0 ? props.records[0] : '无数据')
  // console.log('moneyFlowMap keys:', Object.keys(moneyFlowMap))
  // console.log('moneyFlowMap:', moneyFlowMap)
  // console.log('kline dates:', kline.map(r => normalizeDate(r.trade_date)))
  // 计算大资金净买入金额
  const bigMoneyBars = kline.map(r => {
    const mf = moneyFlowMap[normalizeDate(r.trade_date)]
    if (mf) {
      const buy = (mf.buy_lg_amount || 0) + (mf.buy_elg_amount || 0)
      const sell = (mf.sell_lg_amount || 0) + (mf.sell_elg_amount || 0)
      return buy - sell
    }
    return 0
  })
  // 评分数据（如有），兼容 dict/number，默认用 balanced
const scoreLine = kline.map(r => {
  const cs = r.composite_score
  if (cs === undefined || cs === null) return null
  let value = null
  if (typeof cs === 'object' && cs !== null) {
    value = cs.balanced ?? null
  } else {
    value = cs
  }
  return { value, composite_score: cs }
})
  return {
    dates: kline.map(r => normalizeDate(r.trade_date)), // ✅ 确保日期格式一致
    prices: kline.map(r => r.close),
    kline,
    bigMoneyBars,
    scoreLine
  }
}

watch(() => [props.records, kType.value, props.signalDates, props.tradeMarkers], () => {
  drawChart()
})

function drawChart() {
  error.value = ''
  
  if (!chartInstance) {
    error.value = '图表容器未找到'
    return
  }
  
  if (!props.symbol) {
    error.value = '股票代码未指定'
    return
  }
  
  if (!props.records || props.records.length === 0) {
    error.value = '暂无数据'
    return
  }
  
  try {
  const { dates, kline, bigMoneyBars, scoreLine } = getKlineData()
  
  // DEBUGGING: Log tradeMarkers data
  console.log('--- Debugging Trade Markers ---');
  console.log('Received tradeMarkers:', JSON.stringify(props.tradeMarkers, null, 2));
  // console.log('Chart dates:', JSON.stringify(dates, null, 2)); // Log all dates if needed for deep debug

  // 规范化 scoreLine：统一进行四舍五入，避免在多个地方重复计算
  const normalizedScoreLine = scoreLine.map(point => {
    if (!point) return null
    if (point && typeof point.value === 'number') {
      const rounded = Math.round(point.value)
      return { ...point, value: rounded }
    }
    return point
  })
  const maxAbsBigMoney = Math.max(...bigMoneyBars.map(v => Math.abs(v)), 1)
    
    // ✅ 修复：从 K线数据中直接获取股票名称
    let stockTitle = props.symbol || ''
    
    // 尝试从K线数据中获取股票名称
    if (props.records && props.records.length > 0) {
      const firstRecord = props.records[0]
      const nameFields = ['name', 'stock_name', 'company_name', 'title']
      
      for (const field of nameFields) {
        if (firstRecord[field]) {
          stockTitle = `${props.symbol} - ${firstRecord[field]}`
          break
        }
      }
    }
    
    // 如果K线数据中没有名称，则使用传入的 stockName
    if (stockTitle === props.symbol && props.stockName) {
      stockTitle = `${props.symbol} - ${props.stockName}`
    }
    
    // console.log("stockTitle", stockTitle)
    
    const option = {
      title: { 
        text: `${stockTitle} ${kType.value === 'day' ? '日线' : kType.value === 'week' ? '周线' : '月线'}K线图`,
        left: 'center',
        textStyle: {
          color: '#00ff00',      // 亮绿色
          fontWeight: 'bold',    // 加粗
          fontSize: 16           // 可选：调整字体大小
        }
      },
      tooltip: { 
        trigger: 'axis',
        formatter: function(params) {
          let tooltip = ''
          const klineData = params.find(p => p.seriesName === 'K线')
          const volumeData = params.find(p => p.seriesName === '成交量')
          const bigMoneyData = params.find(p => p.seriesName === '大资金净买入')
          const scoreData = params.find(p => p.seriesName === '评分')

          // ✅ 添加日期显示
          const currentDate = params[0] ? params[0].axisValue : ''
          if (currentDate) {
            tooltip += `<div style="color: #666666; font-weight: bold; font-size: 14px; margin-bottom: 8px;">📅 ${currentDate}</div>`
          }

          if (klineData && klineData.data) {
            // Backend returns: [unknown, open, close, low, high]
            // Discard first element and extract OCLH
            const dataArray = Array.isArray(klineData.data) ? klineData.data : klineData.value
            if (dataArray && dataArray.length >= 5) {
              const [, open, close, low, high] = dataArray  // Skip first element
              tooltip += `<div style="border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 5px;">`
              tooltip += `开盘: <span style="color: #666666;">${open.toFixed(2)}</span><br/>`
              tooltip += `最高: <span style="color: #666666;">${high.toFixed(2)}</span><br/>`
              tooltip += `最低: <span style="color: #666666;">${low.toFixed(2)}</span><br/>`
              tooltip += `收盘: <span style="color: #666666;">${close.toFixed(2)}</span></div>`
            }
          }
          if (scoreData && scoreData.data) {
            const cs = scoreData.data.composite_score;
            if (cs && typeof cs === 'object') {
              tooltip += `<div style='color:#ffd700;font-weight:bold;'>评分(balanced): ${cs.balanced ?? '-'}<br>评分(aggressive): ${cs.aggressive ?? '-'}<br>评分(conservative): ${cs.conservative ?? '-'}</div>`;
            } else if (cs !== undefined) {
              tooltip += `<div style='color:#ffd700;font-weight:bold;'>评分: ${cs}</div>`;
            }
          }
          if (volumeData) {
            // 找到当前K线的成交金额
            const idx = volumeData.dataIndex
            const turnover = kline[idx] && kline[idx].turnover
            const volume = volumeData.data
            tooltip += `<br/><span style=\"color:#5470c6;\">●</span> 成交量: <b>${volume !== undefined && volume !== null ? volume.toLocaleString() : '-'}</b>`
            if (turnover !== undefined) {
              tooltip += `<br/><span style=\"color:#5470c6;\">●</span> 成交金额: <b>${turnover.toLocaleString()}</b>`
            }
          }
          if (bigMoneyData) {
            tooltip += `<div style="border-top: 1px solid #ccc; padding-top: 5px;">`
            tooltip += `<span style="color:#e53935;">●</span> 大资金净买入: <b style="color: ${bigMoneyData.data >= 0 ? '#ff6b6b' : '#00ff00'};">${bigMoneyData.data.toLocaleString()}</b><br/>`
            
            // ✅ 修复资金流数据查找逻辑
            const normalizedDate = normalizeDate(currentDate)
            const mf = props.moneyFlowRecords && props.moneyFlowRecords.find(m => normalizeDate(m.trade_date) === normalizedDate)
            
            if (mf) {
              const buyAmount = (mf.buy_lg_amount || 0) + (mf.buy_elg_amount || 0)
              const sellAmount = (mf.sell_lg_amount || 0) + (mf.sell_elg_amount || 0)
              tooltip += `买入(大+超大): <span style="color: #ff6b6b;">${buyAmount.toLocaleString()}</span><br/>`
              tooltip += `卖出(大+超大): <span style="color: #00ff00;">${sellAmount.toLocaleString()}</span>`
            }
            tooltip += `</div>`
          }
          return tooltip
        }
      },
      xAxis: [
        { type: 'category', data: dates, gridIndex: 0, axisLabel: { show: false } },   // K线显示时间
        { type: 'category', data: dates, gridIndex: 1, axisLabel: { show: false } },              // 成交量不显示
        { type: 'category', data: dates, gridIndex: 2, axisLabel: { show: false } }               // 大资金净买入不显示
      ],
      yAxis: [
        { type: 'value', name: '价格', gridIndex: 0 },
        { type: 'value', name: '成交量', gridIndex: 1, nameTextStyle: { padding: [-90, 0, 0, -90] }, axisLabel: { formatter: v => v >= 10000 ? (v/10000).toFixed(1)+'万' : v } },
        { type: 'value', name: '大资金净买入', gridIndex: 2, nameTextStyle: { padding: [-90, 0, 0, -90] }, axisLabel: { formatter: v => Math.abs(v) >= 10000 ? (v/10000).toFixed(2)+'亿' : v } },
        { type: 'value', name: '评分', min: 0, max: 100, position: 'right', offset: 60, axisLine: { show: true, lineStyle: { color: '#ffd700' } }, axisLabel: { color: '#ffd700' } }
      ],
      grid: [
        {
          left: '10%',
          right: '10%',
          top: '10%',
          height: '50%'      // K线
        },
        {
          left: '10%',
          right: '10%',
          top: '62%',
          height: '15%'      // 成交量
        },
        {
          left: '10%',
          right: '10%',
          top: '80%',
          height: '15%'      // 大资金净买入
        }
      ],
      series: [
        {
          type: 'candlestick',
          name: 'K线',
          // ECharts candlestick format: [open, close, low, high]
          data: kline.map(r => [r.open, r.close, r.low, r.high]),
          xAxisIndex: 0,
          yAxisIndex: 0,
          markPoint: {
            data: [
              // 原有的信号日期标记（BUY信号）
              ...(props.signalDates || []).map(d => {
                const normalized = normalizeDate(d)
                const idx = dates.indexOf(normalized)
                if (idx !== -1) {
                  return {
                    name: '信号',
                    coord: [normalized, kline[idx].high],
                    value: 'BUY',
                    itemStyle: { color: '#f44336' },
                    label: {
                      show: true,
                      position: 'top',
                      formatter: 'B',
                      fontSize: 14,
                      fontWeight: 'bold',
                      backgroundColor: '#f44336',
                      padding: [4, 6],
                      borderRadius: 4,
                      color: '#fff'
                    },
                    symbol: 'arrow',
                    symbolSize: 15,
                    symbolOffset: [0, -10]
                  }
                }
                return null
              }).filter(Boolean),
              // 新增：交易历史标记（买入+卖出）
              ...(props.tradeMarkers || []).map(tr => {
                const normalized = normalizeDate(tr.date)
                // 尝试精确匹配日期
                let idx = dates.indexOf(normalized)
                
                // 如果精确匹配失败，尝试模糊匹配（允许格式差异）
                if (idx === -1) {
                  // 移除分隔符进行比较，例如将 '2024-01-01' 和 '20240101' 都标准化为相同格式
                  const normalizedNoSep = normalized.replace(/[-]/g, '')
                  idx = dates.findIndex(date => {
                    const dateNoSep = date.replace(/[-]/g, '')
                    return dateNoSep === normalizedNoSep
                  })
                }

                // DEBUGGING: Log each marker processing
                console.log(`Processing marker: action=${tr.action}, date=${tr.date}, normalizedDate=${normalized}, foundIndex=${idx}`);
                
                if (idx !== -1) {
                  const isBuy = tr.action.toUpperCase() === 'BUY'
                  return {
                    name: isBuy ? '买入' : '卖出',
                    coord: [normalized, isBuy ? kline[idx].low : kline[idx].high],
                    value: tr.action,
                    itemStyle: { 
                      color: isBuy ? '#4CAF50' : '#FF5722'  // 绿色买入，红色卖出
                    },
                    label: {
                      show: true,
                      position: isBuy ? 'bottom' : 'top',
                      formatter: isBuy ? 'B' : 'S',
                      fontSize: 12,
                      fontWeight: 'bold',
                      backgroundColor: isBuy ? '#4CAF50' : '#FF5722',
                      padding: [3, 5],
                      borderRadius: 3,
                      color: '#fff'
                    },
                    symbol: isBuy ? 'pin' : 'arrow', // Sell symbol: arrow
                    symbolSize: isBuy ? 10 : 8,     // Sell symbol size
                    symbolRotate: isBuy ? 0 : 180,   // Point arrow down for Sell
                    symbolOffset: isBuy ? [0, 10] : [0, -8] // Adjust offset for Sell
                  }
                }
                return null
              }).filter(Boolean)
            ]
          }
        },
        {
          type: 'bar',
          name: '成交量',
          data: kline.map(r => r.volume),
          xAxisIndex: 1,
          yAxisIndex: 1,
          barWidth: 6,
          itemStyle: {
            color: function(params) {
              const index = params.dataIndex
              if (index > 0) {
                const current = kline[index]
                const previous = kline[index - 1]
                return current.close >= previous.close ? '#ef5350' : '#26a69a'
              }
              return '#ef5350'
            }
          }
        },
        {
          type: 'bar',
          name: '大资金净买入',
          data: bigMoneyBars,
          xAxisIndex: 2,
          yAxisIndex: 2,
          barWidth: 6,
          itemStyle: {
            color: params => params.data >= 0 ? '#e53935' : '#26a69a'
          },
          z: 10
        },
        {
          type: 'line',
          name: '评分',
          // 使用已规范化的数据（数值已完成 round），保持原有对象结构
          data: normalizedScoreLine,
          yAxisIndex: 3,
          xAxisIndex: 0,
          symbol: 'circle',
          showSymbol: true,
          symbolSize: 6,
          lineStyle: { color: '#ffd700', width: 2 },
          itemStyle: { color: '#ffd700' },
          smooth: true,
          z: 20,
          markPoint: {
            symbol: 'circle',
            symbolSize: 10,
            itemStyle: { color: '#ff5722' },
            label: { show: false },
            data: normalizedScoreLine
              .map((point, idx) => {
                if (point && typeof point.value === 'number') {
                  return { coord: [dates[idx], point.value], value: point.value }
                }
                if (point && point.value !== null && point.value !== undefined) {
                  return { coord: [dates[idx], point.value], value: point.value }
                }
                return null
              })
              .filter(Boolean)
          }
        },
      ]
    }
    
    chartInstance.setOption(option, true) // 第二个参数 true 表示重置
  } catch (err) {
    console.error('绘制图表时出错:', err)
    error.value = `绘制失败: ${err.message}`
  }
}

onMounted(async () => {
  // 安全访问 moneyFlowRecords
  if (props.moneyFlowRecords && props.moneyFlowRecords.length > 0) {
    console.log('moneyFlowRecords第一条:', props.moneyFlowRecords[0])
  } else {
    console.log('moneyFlowRecords: 无数据或为空')
  }

  // 初始化图表实例
  if (!echarts) {
    const mod = await import('echarts')
    echarts = mod.default || mod
  }
  chartInstance = echarts.init(chart.value)

  // ✅ 修复：设置默认日期范围为最近3个月
  if (props.records && props.records.length > 0) {
    const dates = props.records.map(r => normalizeDate(r.trade_date)).sort()
    
    // 计算3个月前的日期字符串
    const today = new Date()
    const threeMonthsAgo = new Date(today)
    threeMonthsAgo.setMonth(today.getMonth() - 3)
    const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0] // 格式: 'YYYY-MM-DD'
    
    console.log('今天:', today.toISOString().split('T')[0])
    console.log('3个月前:', threeMonthsAgoStr)
    console.log('数据日期范围:', dates[0], '到', dates[dates.length - 1])
    
    // 找到第一个大于等于3个月前的日期
    const startIdx = dates.findIndex(d => d >= threeMonthsAgoStr)
    
    let defaultStart = startIdx >= 0 ? dates[startIdx] : dates[0]
    
    // 如果有信号日期，确保起始日期不晚于信号日期
    if (props.signalDates && props.signalDates.length > 0) {
      const sDate = normalizeDate(props.signalDates[0])
      if (sDate < defaultStart) {
        defaultStart = sDate
      }
    }
    
    startDate.value = defaultStart
    endDate.value = dates[dates.length - 1]
    
    console.log('设置的日期范围:', startDate.value, '到', endDate.value)
    console.log('筛选后数据量:', dates.filter(d => d >= startDate.value && d <= endDate.value).length)
  }

  // 只有当 symbol 存在时才绘制
  if (props.symbol) {
    drawChart()
  }
})

// 新增：日期格式化函数
function normalizeDate(d) {
  if (!d) return ''
  if (typeof d === 'string') {
    if (d.length === 8 && !d.includes('-')) {
      // money_flow 格式 '20250102' -> '2025-01-02'
      return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`
    }
    if (d.includes('T')) {
      // K线格式 '2025-06-09T00:00:00' -> '2025-06-09'
      return d.split('T')[0]
    }
    if (d.length === 10 && d.includes('-')) {
      // 已经是 'YYYY-MM-DD'
      return d
    }
  }
  return d
}

// 返回来源的方法
function goBack() {
  emit('go-back', {
    strategy: props.strategyFrom,
    preset: props.presetFrom,
    date: props.dateFrom  // May be undefined if not coming from strategy pool
  })
}

// 监听 symbol 变化，当 symbol 有值时重新绘制
watch(() => props.symbol, (newSymbol) => {
  if (newSymbol && chartInstance) {
    drawChart()
  }
}, { immediate: true })
</script>