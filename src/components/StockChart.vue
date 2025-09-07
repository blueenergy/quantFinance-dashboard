<template>
  <div>
    <div style="margin-bottom: 10px;">
      <label>选择K线类型：</label>
      <select v-model="kType" @change="drawChart">
        <option value="day">日线</option>
        <option value="week">周线</option>
        <option value="month">月线</option>
      </select>
      <span style="margin-left: 20px; color: #666; font-size: 12px;">
        {{ props.symbol ? `股票代码: ${props.symbol} | ` : '' }}数据量: {{ records?.length || 0 }} 条
      </span>
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
      <span style="margin-left: 20px;">当前股票: {{ props.symbol }}</span>
    </div>
    <div style="color: white; font-size: 12px; margin-bottom: 5px;">
      DEBUG: watchlist长度: {{ props.watchlist?.length }} | currentIndex: {{ props.currentIndex }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  records: Array,
  symbol: String,
  moneyFlowRecords: Array, // 新增
  prevStock: Function,
  nextStock: Function,
  hasPrev: Boolean,
  hasNext: Boolean,
  watchlist: Array,   
  currentIndex: Number
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
  const sorted = [...props.records].sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date))
  // 按日期范围筛选
  let filtered = sorted
  if (startDate.value) {
    filtered = filtered.filter(r => new Date(r.trade_date) >= new Date(startDate.value))
  }
  if (endDate.value) {
    filtered = filtered.filter(r => new Date(r.trade_date) <= new Date(endDate.value))
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
  return {
    dates: kline.map(r => r.trade_date),
    prices: kline.map(r => r.close),
    kline,
    bigMoneyBars
  }
}

watch(() => [props.records, kType.value], () => {
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
    //chartInstance = echarts.init(chart.value)
    const { dates, kline, bigMoneyBars } = getKlineData()
    const maxAbsBigMoney = Math.max(...bigMoneyBars.map(v => Math.abs(v)), 1)
    const option = {
      title: { 
        text: `${props.symbol || ''} ${kType.value === 'day' ? '日线' : kType.value === 'week' ? '周线' : '月线'}K线图`,
        left: 'center'
      },
      tooltip: { 
        trigger: 'axis',
        formatter: function(params) {
          let tooltip = ''
          const klineData = params.find(p => p.seriesName === 'K线')
          const volumeData = params.find(p => p.seriesName === '成交量')
          const bigMoneyData = params.find(p => p.seriesName === '大资金净买入')

          if (klineData && klineData.data) {
            const [open, close, low, high] = klineData.data
            tooltip += `${klineData.name}<br/>开盘: ${open}<br/>收盘: ${close}<br/>最低: ${low}<br/>最高: ${high}`
          }
          if (volumeData) {
            // 找到当前K线的成交金额
            const idx = volumeData.dataIndex
            const turnover = kline[idx] && kline[idx].turnover
            tooltip += `<br/><span style="color:#5470c6;">●</span> 成交量: <b>${volumeData.data.toLocaleString()}</b>`
            if (turnover !== undefined) {
              tooltip += `<br/><span style="color:#5470c6;">●</span> 成交金额: <b>${turnover.toLocaleString()}</b>`
            }
          }
          if (bigMoneyData) {
            tooltip += `<br/><span style="color:#e53935;">●</span> 大资金净买入: <b>${bigMoneyData.data.toLocaleString()}</b>`
            const mf = props.moneyFlowRecords && props.moneyFlowRecords.find(m => m.trade_date == bigMoneyData.axisValue)
            if (mf) {
              tooltip += `<br/>买入(大+超大): ${((mf.buy_lg_amount||0)+(mf.buy_elg_amount||0)).toLocaleString()}`
              tooltip += `<br/>卖出(大+超大): ${((mf.sell_lg_amount||0)+(mf.sell_elg_amount||0)).toLocaleString()}`
            }
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
        { type: 'value',
          name: '成交量',
          gridIndex: 1, 
          nameTextStyle: {
            padding: [-90, 0, 0, -90] // 上右下左，左侧加30像素
          },
          axisLabel: { formatter: v => v >= 10000 ? (v/10000).toFixed(1)+'万' : v } },
        {
          type: 'value',
          name: '大资金净买入',
          gridIndex: 2,
          nameTextStyle: {
            padding: [-90, 0, 0, -90] // 上右下左，左侧加30像素
          },
          axisLabel: {
            formatter: v => Math.abs(v) >= 10000 ? (v/10000).toFixed(2)+'亿' : v
          }
        }
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
          data: kline.map(r => [r.open, r.close, r.low, r.high]),
          xAxisIndex: 0,
          yAxisIndex: 0
        },
        {
          type: 'bar',
          name: '成交量',
          data: kline.map(r => r.volume),
          xAxisIndex: 1,
          yAxisIndex: 1,
          barWidth: 10,
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
          barWidth: 10,
          itemStyle: {
            color: params => params.data >= 0 ? '#e53935' : '#26a69a'
          },
          z: 10
        }
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
  chartInstance = echarts.init(chart.value)

  // 设置默认日期范围（只有当有记录时）
  if (props.records && props.records.length > 0) {
    const dates = props.records.map(r => normalizeDate(r.trade_date)).sort()
    const today = new Date()
    const threeMonthsAgo = new Date(today)
    threeMonthsAgo.setMonth(today.getMonth() - 3)

    const startIdx = dates.findIndex(d => {
      const dObj = d.includes('-') ? new Date(d) : new Date(d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8))
      return dObj >= threeMonthsAgo
    })
    startDate.value = startIdx >= 0 ? dates[startIdx] : dates[0]
    endDate.value = dates[dates.length - 1]
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

// 监听 symbol 变化，当 symbol 有值时重新绘制
watch(() => props.symbol, (newSymbol) => {
  if (newSymbol && chartInstance) {
    drawChart()
  }
}, { immediate: true })
</script>