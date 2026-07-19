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

function renderRadar() {
  const items = props.scoreItems.filter((item) => item.score != null)
  if (!radarRef.value || !items.length) {
    radarChart?.clear()
    return
  }
  if (!radarChart) radarChart = echarts.init(radarRef.value)
  radarChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    radar: {
      indicator: items.map((item) => ({ name: item.label, max: 100 })),
      radius: '62%',
      splitLine: { lineStyle: { color: 'rgba(148,163,184,.35)' } },
      splitArea: { areaStyle: { color: ['rgba(15,23,42,.25)', 'rgba(30,41,59,.35)'] } },
      axisName: { color: '#cbd5e1' },
      axisLine: { lineStyle: { color: 'rgba(148,163,184,.35)' } },
    },
    series: [{
      type: 'radar',
      data: [{
        name: '评分',
        value: items.map((item) => Number(item.score || 0)),
        areaStyle: { color: 'rgba(96,165,250,.25)' },
        lineStyle: { color: '#60a5fa', width: 2 },
        itemStyle: { color: '#93c5fd' },
      }],
    }],
  })
  radarChart.resize()
}

async function renderActiveRadar() {
  if (!props.active) return
  await nextTick()
  renderRadar()
}

watch(
  [() => props.scoreItems, () => props.active],
  renderActiveRadar,
  { deep: true },
)

onMounted(renderActiveRadar)

onBeforeUnmount(() => {
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
  color: #f8fafc;
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
  background: rgba(96, 165, 250, .12);
  border: 1px solid rgba(96, 165, 250, .24);
  border-radius: 999px;
  color: #bfdbfe;
  padding: 5px 10px;
}
.analysis-summary ul {
  color: #cbd5e1;
  margin: 12px 0 0;
  padding-left: 18px;
}
.status-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.status-grid div {
  background: rgba(30, 41, 59, .78);
  border-radius: 14px;
  padding: 14px;
}
.status-grid span {
  color: #94a3b8;
  display: block;
  font-size: 12px;
}
.status-grid strong {
  color: #f8fafc;
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
