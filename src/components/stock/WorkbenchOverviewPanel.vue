<template>
  <section class="panel-grid panel-grid--overview">
    <article class="workbench-card">
      <div class="card-title-row">
        <h3>评分雷达</h3>
        <span class="muted">按维度展示最新量化评分</span>
      </div>
      <div ref="radarRef" class="score-radar"></div>
    </article>

    <article class="workbench-card">
      <h3>AI 研究摘要</h3>
      <div v-if="deepAnalysis" class="analysis-summary">
        <p class="summary-line">{{ analysisSummary }}</p>
        <div class="summary-meta">
          <span>模式：{{ deepAnalysis.analysis_mode || 'classic' }}</span>
          <span>时间：{{ deepAnalysis.created_at || '-' }}</span>
        </div>
        <ul v-if="analysisPoints.length">
          <li v-for="(point, idx) in analysisPoints" :key="idx">{{ point }}</li>
        </ul>
      </div>
      <div v-else class="muted-block">暂无该股票的 AI 深度分析记录。</div>
    </article>

    <article class="workbench-card">
      <div class="card-title-row">
        <h3>行情资金快照</h3>
        <button type="button" class="text-link-button" @click="$emit('goto-panel', 'quote')">
          查看详情
        </button>
      </div>
      <div class="financial-metrics">
        <div v-for="metric in overviewQuoteMetrics" :key="metric.label">
          <span>{{ metric.label }}</span>
          <strong :class="metric.className">{{ metric.value }}</strong>
        </div>
      </div>
      <div v-if="!quoteDataAvailable" class="muted-block">
        暂无行情资金分区数据。
      </div>
    </article>

    <article class="workbench-card">
      <h3>核心状态</h3>
      <div class="status-grid">
        <div v-for="item in statusItems" :key="item.label">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
    </article>
  </section>
</template>

<script setup>
import * as echarts from 'echarts'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { waitForChartDom } from '../../utils/chartDom'

const props = defineProps({
  scoreItems: { type: Array, default: () => [] },
  deepAnalysis: { type: Object, default: null },
  analysisSummary: { type: String, default: '' },
  analysisPoints: { type: Array, default: () => [] },
  overviewQuoteMetrics: { type: Array, default: () => [] },
  statusItems: { type: Array, default: () => [] },
  quoteDataAvailable: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
})

defineEmits(['goto-panel'])

const radarRef = ref(null)
let radarChart = null
let resizeObserver = null

async function ensureRadarChart() {
  if (!radarRef.value) return null
  if (!radarChart) {
    const ready = await waitForChartDom(radarRef.value)
    if (!ready || !radarRef.value) return null
    radarChart = echarts.init(radarRef.value)
    if (typeof ResizeObserver !== 'undefined' && !resizeObserver) {
      resizeObserver = new ResizeObserver(() => radarChart?.resize())
      resizeObserver.observe(radarRef.value)
    }
  }
  return radarChart
}

async function renderRadar() {
  const items = props.scoreItems.filter((item) => item.score != null)
  if (!radarRef.value || !items.length) {
    radarChart?.clear()
    return
  }
  const chart = await ensureRadarChart()
  if (!chart) return
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    radar: {
      indicator: items.map((item) => ({ name: item.label, max: 100 })),
      radius: '62%',
      splitLine: { lineStyle: { color: '#cbd5e1' } },
      splitArea: { areaStyle: { color: ['#f8fafc', '#ffffff'] } },
      axisName: { color: '#475569' },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
    },
    series: [{
      type: 'radar',
      data: [{
        name: '评分',
        value: items.map((item) => Number(item.score || 0)),
        areaStyle: { color: 'rgba(37,99,235,.18)' },
        lineStyle: { color: '#2563eb', width: 2 },
        itemStyle: { color: '#3b82f6' },
      }],
    }],
  })
  chart.resize()
}

async function renderActiveRadar() {
  if (!props.active) return
  await nextTick()
  await renderRadar()
}

watch(
  [() => props.scoreItems, () => props.active],
  renderActiveRadar,
  { deep: true },
)

onMounted(renderActiveRadar)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  radarChart?.dispose()
  radarChart = null
})
</script>

<style scoped>
.panel-grid.panel-grid--overview {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1.1fr) minmax(300px, .9fr);
}
.score-radar {
  height: 360px;
  min-height: 360px;
}
.summary-line {
  color: var(--text-primary);
  font-size: 18px;
  line-height: 1.7;
}
.summary-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}
.summary-meta span {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  color: #1d4ed8;
  padding: 5px 10px;
}
.analysis-summary ul {
  color: var(--text-subtle);
  margin: 12px 0 0;
  padding-left: 18px;
}
.status-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.status-grid div {
  background: var(--surface-bg-muted);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 14px;
}
.status-grid span {
  color: var(--text-muted);
  display: block;
  font-size: 12px;
}
.status-grid strong {
  color: var(--text-primary);
  display: block;
  font-size: 22px;
  margin: 4px 0;
}
@media (max-width: 980px) {
  .panel-grid.panel-grid--overview {
    grid-template-columns: 1fr;
  }
}
</style>
