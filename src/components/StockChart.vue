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
        数据量: {{ records?.length || 0 }} 条
      </span>
    </div>
    <div ref="chart" style="width: 100%; height: 600px; border: 1px solid #ddd;"></div>
    <div v-if="error" style="color: red; margin-top: 10px;">
      错误: {{ error }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  records: Array
})

const chart = ref(null)
const kType = ref('day')
const error = ref('')

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
  const kline = groupKline(sorted, kType.value)
  return {
    dates: kline.map(r => r.trade_date),
    prices: kline.map(r => r.close),
    kline
  }
}

onMounted(() => {
  drawChart()
})

watch(() => [props.records, kType.value], () => {
  drawChart()
})

function drawChart() {
  error.value = ''
  
  if (!chart.value) {
    error.value = '图表容器未找到'
    return
  }
  
  if (!props.records || props.records.length === 0) {
    error.value = '暂无数据'
    return
  }
  
  try {
    const chartInstance = echarts.init(chart.value)
    const { dates, kline } = getKlineData()
    
    const option = {
      title: { text: `${kType.value === 'day' ? '日线' : kType.value === 'week' ? '周线' : '月线'}K线图` },
      tooltip: { 
        trigger: 'axis',
        formatter: function(params) {
          const data = params.find(p => p.seriesName === 'K线')
          const volumeData = params.find(p => p.seriesName === '成交量')
          if (data && data.data) {
            const [open, close, low, high] = data.data
            let tooltip = `${data.name}<br/>开盘: ${open}<br/>收盘: ${close}<br/>最低: ${low}<br/>最高: ${high}`
            if (volumeData) {
              tooltip += `<br/>成交量: ${volumeData.data.toLocaleString()}`
            }
            return tooltip
          }
          return ''
        }
      },
      xAxis: [
        { 
          type: 'category', 
          data: dates,
          axisLabel: {
            rotate: 45
          },
          gridIndex: 0
        },
        { 
          type: 'category', 
          data: dates,
          axisLabel: {
            show: false
          },
          gridIndex: 1
        }
      ],
      yAxis: [
        { 
          type: 'value', 
          name: '价格',
          gridIndex: 0
        },
        {
          type: 'value',
          name: '成交量',
          gridIndex: 1,
          axisLabel: {
            formatter: function(value) {
              if (value >= 10000) {
                return (value / 10000).toFixed(1) + '万'
              }
              return value
            }
          }
        }
      ],
      grid: [
        {
          left: '10%',
          right: '10%',
          top: '10%',
          height: '60%'
        },
        {
          left: '10%',
          right: '10%',
          top: '75%',
          height: '20%'
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
        }
      ]
    }
    
    chartInstance.setOption(option)
  } catch (err) {
    console.error('绘制图表时出错:', err)
    error.value = `绘制失败: ${err.message}`
  }
}
</script>