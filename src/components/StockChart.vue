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
    <div ref="chart" style="width: 100%; height: 400px; border: 1px solid #ddd;"></div>
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
          const data = params[0]
          if (data && data.data) {
            const [open, close, low, high] = data.data
            return `${data.name}<br/>开盘: ${open}<br/>收盘: ${close}<br/>最低: ${low}<br/>最高: ${high}`
          }
          return ''
        }
      },
      xAxis: { 
        type: 'category', 
        data: dates,
        axisLabel: {
          rotate: 45
        }
      },
      yAxis: { type: 'value', name: '价格' },
      series: [{
        type: 'candlestick',
        name: 'K线',
        data: kline.map(r => [r.open, r.close, r.low, r.high])
      }],
      grid: {
        bottom: 80
      }
    }
    
    chartInstance.setOption(option)
  } catch (err) {
    console.error('绘制图表时出错:', err)
    error.value = `绘制失败: ${err.message}`
  }
}
</script>