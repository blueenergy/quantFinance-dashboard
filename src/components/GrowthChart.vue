<template>
  <div class="growth-chart-wrap">
    <div ref="chartAbsRef" class="growth-chart growth-chart--abs"></div>
    <div ref="chartRateRef" class="growth-chart growth-chart--rate"></div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import {
  GridComponent, TooltipComponent, LegendComponent,
  DataZoomComponent, MarkLineComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent,
  LegendComponent, DataZoomComponent, MarkLineComponent, CanvasRenderer])

const props = defineProps({
  series: { type: Array, default: () => [] }, // financial_chart_data
})

const chartAbsRef = ref(null)
const chartRateRef = ref(null)
let chartAbs = null
let chartRate = null
let roAbs = null
let roRate = null

const COLORS = {
  revenue:   '#60a5fa',  // blue
  netProfit: '#34d399',  // green
  revenueYoy:      '#93c5fd',
  netprofitYoy:    '#6ee7b7',
  dtNetprofitYoy:  '#a5f3fc',
  grossMargin:     '#fbbf24',
  roe:             '#f472b6',
  zero:            'rgba(148,163,184,0.3)',
}

function yuan(v) {
  if (v == null) return null
  const abs = Math.abs(v)
  if (abs >= 1e8) return +(v / 1e8).toFixed(2)
  return +(v / 1e6).toFixed(2)
}
function yuanUnit(series) {
  const maxAbs = Math.max(...series.map(d => Math.abs(d.revenue || d.net_profit || 0)).filter(Boolean))
  return maxAbs >= 1e8 ? '亿元' : '百万元'
}

function buildAbsOption(series) {
  const unit = yuanUnit(series)
  const divisor = unit === '亿元' ? 1e8 : 1e6
  const labels = series.map(d => d.period)
  return {
    backgroundColor: 'transparent',
    textStyle: { color: '#94a3b8', fontSize: 11 },
    legend: {
      data: ['营收', '归母净利润'],
      textStyle: { color: '#94a3b8', fontSize: 11 },
      top: 6,
      right: 8,
      itemWidth: 14,
      itemHeight: 10,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      formatter(params) {
        let s = `<b>${params[0].name}</b><br/>`
        params.forEach(p => {
          s += `${p.marker}${p.seriesName}：${p.value == null ? '—' : p.value + unit}<br/>`
        })
        return s
      },
    },
    grid: { top: 48, bottom: 40, left: 60, right: 16, containLabel: false },
    xAxis: {
      type: 'category', data: labels,
      axisLabel: { color: '#94a3b8', fontSize: 10, rotate: labels.length > 7 ? 30 : 0 },
      axisLine: { lineStyle: { color: '#334155' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value', name: unit,
      nameTextStyle: { color: '#64748b', fontSize: 10, padding: [0, 4, 0, 0] },
      axisLabel: { color: '#94a3b8', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(51,65,85,0.6)' } },
    },
    series: [
      {
        name: '营收', type: 'bar', barMaxWidth: 32, barGap: '20%',
        data: series.map(d => d.revenue != null ? +(d.revenue / divisor).toFixed(2) : null),
        itemStyle: { color: COLORS.revenue, borderRadius: [3, 3, 0, 0] },
      },
      {
        name: '归母净利润', type: 'bar', barMaxWidth: 32, barGap: '20%',
        data: series.map(d => d.net_profit != null ? +(d.net_profit / divisor).toFixed(2) : null),
        itemStyle: { color: COLORS.netProfit, borderRadius: [3, 3, 0, 0] },
      },
    ],
  }
}

function buildRateOption(series) {
  const labels = series.map(d => d.period)
  const makeZeroLine = () => ({
    silent: true,
    data: [{ yAxis: 0, lineStyle: { color: COLORS.zero, type: 'dashed', width: 1 } }],
  })
  return {
    backgroundColor: 'transparent',
    textStyle: { color: '#94a3b8', fontSize: 11 },
    legend: {
      data: ['营收YoY%', '净利YoY%', '扣非净利YoY%', '毛利率%', 'ROE%'],
      textStyle: { color: '#94a3b8', fontSize: 10 },
      top: 6,
      right: 8,
      itemWidth: 14,
      itemHeight: 10,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      formatter(params) {
        let s = `<b>${params[0].name}</b><br/>`
        params.forEach(p => {
          s += `${p.marker}${p.seriesName}：${p.value == null ? '—' : p.value + '%'}<br/>`
        })
        return s
      },
    },
    grid: { top: 56, bottom: 40, left: 60, right: 16, containLabel: false },
    xAxis: {
      type: 'category', data: labels,
      axisLabel: { color: '#94a3b8', fontSize: 10, rotate: labels.length > 7 ? 30 : 0 },
      axisLine: { lineStyle: { color: '#334155' } },
      axisTick: { show: false },
    },
    yAxis: { type: 'value', name: '%', nameTextStyle: { color: '#64748b', fontSize: 10 }, axisLabel: { color: '#94a3b8', fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(51,65,85,0.6)' } } },
    series: [
      {
        name: '营收YoY%', type: 'line', smooth: true,
        data: series.map(d => d.tr_yoy),
        lineStyle: { color: COLORS.revenueYoy, width: 2 },
        itemStyle: { color: COLORS.revenueYoy },
        markLine: makeZeroLine(),
        connectNulls: true,
      },
      {
        name: '净利YoY%', type: 'line', smooth: true,
        data: series.map(d => d.netprofit_yoy),
        lineStyle: { color: COLORS.netprofitYoy, width: 2 },
        itemStyle: { color: COLORS.netprofitYoy },
        connectNulls: true,
      },
      {
        name: '扣非净利YoY%', type: 'line', smooth: true,
        data: series.map(d => d.dt_netprofit_yoy),
        lineStyle: { color: COLORS.dtNetprofitYoy, width: 2, type: 'dashed' },
        itemStyle: { color: COLORS.dtNetprofitYoy },
        connectNulls: true,
      },
      {
        name: '毛利率%', type: 'line', smooth: true,
        data: series.map(d => d.grossprofit_margin),
        lineStyle: { color: COLORS.grossMargin, width: 2 },
        itemStyle: { color: COLORS.grossMargin },
        connectNulls: true,
      },
      {
        name: 'ROE%', type: 'line', smooth: true,
        data: series.map(d => d.roe),
        lineStyle: { color: COLORS.roe, width: 2 },
        itemStyle: { color: COLORS.roe },
        connectNulls: true,
      },
    ],
  }
}

function initChart(el, optFn) {
  if (!el) return { inst: null, ro: null }
  const inst = echarts.init(el, null, { renderer: 'canvas' })
  inst.setOption(optFn(props.series), { notMerge: true })
  const ro = new ResizeObserver(() => { inst.resize() })
  ro.observe(el)
  return { inst, ro }
}

function renderCharts() {
  if (!props.series || props.series.length === 0) return
  nextTick(() => {
    if (chartAbsRef.value && !chartAbs) {
      const r = initChart(chartAbsRef.value, buildAbsOption)
      chartAbs = r.inst; roAbs = r.ro
    } else if (chartAbs) {
      chartAbs.setOption(buildAbsOption(props.series), { notMerge: true })
    }
    if (chartRateRef.value && !chartRate) {
      const r = initChart(chartRateRef.value, buildRateOption)
      chartRate = r.inst; roRate = r.ro
    } else if (chartRate) {
      chartRate.setOption(buildRateOption(props.series), { notMerge: true })
    }
  })
}

function resizeCharts() {
  chartAbs?.resize()
  chartRate?.resize()
}

onMounted(() => {
  renderCharts()
  window.addEventListener('resize', resizeCharts)
})

watch(() => props.series, renderCharts, { deep: true })

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts)
  roAbs?.disconnect()
  roRate?.disconnect()
  chartAbs?.dispose()
  chartRate?.dispose()
})
</script>

<style scoped>
.growth-chart-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 4px;
}
.growth-chart {
  width: 100%;
  height: 260px;
  min-width: 0;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.6);
}
</style>
