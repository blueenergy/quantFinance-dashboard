<template>
  <div class="score-detail-view">
    <div v-if="loading" class="detail-loading">
      正在加载 {{ categoryLabel }} 详情...
    </div>

    <div v-else-if="errorMessage" class="detail-empty">
      {{ errorMessage }}
    </div>

    <template v-else-if="isComposite">
      <div class="score-hero">
        <div ref="gaugeRef" class="gauge-chart" />
        <div class="score-hero-meta">
          <div class="hero-total" :style="{ color: scoreColor(compositeTotal) }">
            {{ compositeTotal != null ? compositeTotal.toFixed(1) : '—' }}
          </div>
          <div class="hero-label">综合得分</div>
          <div v-if="strategyLabel" class="hero-strategy">策略：{{ strategyLabel }}</div>
        </div>
      </div>

      <div ref="radarRef" class="radar-chart" />

      <div class="contrib-section">
        <h5 class="section-title">加权贡献</h5>
        <div
          v-for="dim in compositeDimensions"
          :key="dim.key || dim.name"
          class="contrib-row"
        >
          <span class="contrib-name">{{ dim.name }}</span>
          <div class="contrib-bar-wrap">
            <div
              class="contrib-bar"
              :style="{
                width: `${Math.min(100, Math.max(0, dim.score || 0))}%`,
                background: scoreColor(dim.score),
              }"
            />
          </div>
          <span class="contrib-score">{{ dim.score?.toFixed?.(1) ?? '—' }}</span>
          <span class="contrib-weight">
            {{ dim.weight != null ? `${(dim.weight * 100).toFixed(0)}%` : '—' }}
          </span>
          <span class="contrib-value">
            +{{ dim.contribution?.toFixed?.(1) ?? '—' }}
          </span>
        </div>
      </div>

      <details v-if="compositeDimensions.length" class="raw-section">
        <summary class="raw-section-summary">维度明细表</summary>
        <table class="raw-table">
          <thead>
            <tr>
              <th>维度</th>
              <th>得分</th>
              <th>权重</th>
              <th>贡献</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="dim in compositeDimensions" :key="dim.key || dim.name">
              <td>{{ dim.name }}</td>
              <td>{{ dim.score?.toFixed?.(1) ?? '—' }}</td>
              <td>{{ dim.weight != null ? `${(dim.weight * 100).toFixed(1)}%` : '—' }}</td>
              <td>{{ dim.contribution?.toFixed?.(2) ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </details>

      <details v-if="compositeRawFields.length" class="raw-section">
        <summary class="raw-section-summary">原始字段</summary>
        <table class="raw-table">
          <tbody>
            <tr v-for="row in compositeRawFields" :key="row.key">
              <th>{{ row.key }}</th>
              <td>
                <ul v-if="row.type === 'array' && row.items?.length" class="raw-array-list">
                  <li v-for="(item, i) in row.items" :key="i">{{ item }}</li>
                </ul>
                <pre v-else-if="row.type === 'object'" class="raw-inline-object">{{ row.display }}</pre>
                <span v-else class="raw-scalar">{{ row.display }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </details>
    </template>

    <template v-else-if="isIndustryRs">
      <div class="score-hero score-hero--compact industry-rs-hero">
        <div class="score-hero-meta">
          <div class="hero-total" :style="{ color: scoreColor(industryRsScore) }">
            {{ industryRsScore != null ? Number(industryRsScore).toFixed(1) : '—' }}
          </div>
          <div class="hero-label">{{ categoryLabel }}</div>
          <div class="hero-strategy reference-badge">仅供参考，不参与综合分与组合选股</div>
        </div>
      </div>
      <IndustryRsBreakdown :details="props.details" />
    </template>

    <template v-else>
      <div class="score-hero score-hero--compact">
        <div ref="gaugeRef" class="gauge-chart gauge-chart--sm" />
        <div class="score-hero-meta">
          <div class="hero-total" :style="{ color: scoreColor(categoryTotal) }">
            {{ categoryTotal != null ? categoryTotal.toFixed(1) : '—' }}
          </div>
          <div class="hero-label">{{ categoryLabel }}</div>
        </div>
      </div>

      <div v-if="categoryParsed.topLevelFields.length" class="top-level-extras">
        <h5 class="section-title">补充说明</h5>
        <div
          v-for="field in categoryParsed.topLevelFields"
          :key="field.key"
          class="top-level-item"
        >
          <span class="top-level-key">{{ field.key }}</span>
          <div class="top-level-value">
            <ul v-if="field.type === 'array' && field.items?.length" class="raw-array-list">
              <li v-for="(item, i) in field.items" :key="i">{{ item }}</li>
            </ul>
            <pre v-else-if="field.type === 'object'" class="raw-inline-object">{{ field.display }}</pre>
            <span v-else class="raw-scalar">{{ field.display }}</span>
          </div>
        </div>
      </div>

      <div v-if="categoryParsed.subModules.length" ref="barRef" class="bar-chart" />

      <div v-if="categoryParsed.subModules.length" class="submodule-section">
        <h5 class="section-title">子模块明细</h5>
        <details
          v-for="mod in categoryParsed.subModules"
          :key="mod.name"
          class="submodule-card"
          open
        >
          <summary class="submodule-summary">
            <span class="submodule-name">{{ mod.name }}</span>
            <span
              v-if="mod.score != null"
              class="submodule-score"
              :style="{ color: scoreColor(mod.score) }"
            >
              {{ mod.score.toFixed(1) }}
            </span>
            <span v-if="mod.weight != null" class="submodule-weight">
              权重 {{ (mod.weight * 100).toFixed(0) }}%
            </span>
          </summary>
          <div class="submodule-body">
            <div v-if="mod.signals.length" class="chip-row">
              <span
                v-for="sig in mod.signals"
                :key="sig.key"
                class="signal-chip"
                :class="{
                  positive: sig.positive === true,
                  negative: sig.positive === false,
                  neutral: sig.positive == null,
                }"
              >
                <strong>{{ sig.key }}:</strong> {{ sig.text }}
              </span>
            </div>
            <div v-if="mod.metrics.length" class="metric-row">
              <span
                v-for="metric in mod.metrics"
                :key="metric.key"
                class="metric-badge"
              >
                <strong>{{ metric.key }}</strong> {{ metric.value }}
              </span>
            </div>
            <details v-if="mod.rawFields.length" class="raw-fold">
              <summary class="raw-fold-summary">
                全部原始指标 ({{ mod.rawFields.length }})
              </summary>
              <table class="raw-table raw-table--compact">
                <tbody>
                  <tr v-for="row in mod.rawFields" :key="row.key">
                    <th>{{ row.key }}</th>
                    <td>
                <ul v-if="row.type === 'array' && row.items?.length" class="raw-array-list">
                  <li v-for="(item, i) in row.items" :key="i">{{ item }}</li>
                </ul>
                <pre v-else-if="row.type === 'object'" class="raw-inline-object">{{ row.display }}</pre>
                <span v-else class="raw-scalar">{{ row.display }}</span>
              </td>
                  </tr>
                </tbody>
              </table>
            </details>
          </div>
        </details>
      </div>

      <div v-else class="detail-empty">暂无 {{ categoryLabel }} 详情</div>
    </template>

    <details
      v-if="!loading && !errorMessage && !isIndustryRs && details && Object.keys(details).length"
      class="raw-section raw-section--json"
    >
      <summary class="raw-section-summary">查看完整 JSON</summary>
      <pre class="raw-json">{{ prettyJson }}</pre>
    </details>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import IndustryRsBreakdown from './IndustryRsBreakdown.vue'
import {
  extractCompositeRawFields,
  extractCompositeTotal,
  normalizeCategoryDetails,
  normalizeComposite,
  scoreColor,
  translateScoreCategory,
} from '../../utils/scoreDetail.js'

const props = defineProps({
  category: { type: String, default: '' },
  details: { type: Object, default: null },
  weights: { type: Object, default: () => ({}) },
  dimensions: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  maximized: { type: Boolean, default: false },
})

const gaugeRef = ref(null)
const radarRef = ref(null)
const barRef = ref(null)

let echarts = null
let gaugeChart = null
let radarChart = null
let barChart = null
let resizeObserver = null

const isComposite = computed(() => props.category === 'composite')
const isIndustryRs = computed(() => props.category === 'industry_rs')
const categoryLabel = computed(() => translateScoreCategory(props.category))

const industryRsScore = computed(() => {
  const d = props.details
  if (!d || typeof d !== 'object') return null
  const raw = d.score ?? d['行业相对强度']
  if (raw == null || raw === '' || Number.isNaN(Number(raw))) return null
  return Number(raw)
})

const compositeDimensions = computed(() => (
  normalizeComposite(props.dimensions, props.details)
))

const compositeTotal = computed(() => extractCompositeTotal(props.details))

const strategyLabel = computed(() => {
  const s = props.details?.['当前策略']
  return typeof s === 'string' ? s : ''
})

const categoryParsed = computed(() => (
  normalizeCategoryDetails(props.details, props.weights)
))

const compositeRawFields = computed(() => extractCompositeRawFields(props.details))

const prettyJson = computed(() => {
  try {
    return JSON.stringify(props.details ?? {}, null, 2)
  } catch {
    return '{}'
  }
})

const categoryTotal = computed(() => categoryParsed.value.total)

const errorMessage = computed(() => {
  if (props.details && typeof props.details === 'object' && props.details['错误']) {
    return String(props.details['错误'])
  }
  return categoryParsed.value.error
})

async function ensureEcharts() {
  if (!echarts) {
    const mod = await import('echarts')
    echarts = mod.default || mod
  }
  return echarts
}

function disposeCharts() {
  gaugeChart?.dispose()
  radarChart?.dispose()
  barChart?.dispose()
  gaugeChart = null
  radarChart = null
  barChart = null
}

function buildGaugeOption(score, title) {
  const value = score != null ? Number(score) : 0
  return {
    backgroundColor: 'transparent',
    series: [{
      type: 'gauge',
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 100,
      splitNumber: 5,
      radius: '90%',
      axisLine: {
        lineStyle: {
          width: 10,
          color: [[0.5, '#ef4444'], [0.6, '#f97316'], [0.7, '#eab308'], [0.8, '#84cc16'], [1, '#22c55e']],
        },
      },
      pointer: { show: true, length: '55%', width: 4 },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      detail: { show: false },
      title: { show: false },
      data: [{ value, name: title }],
    }],
  }
}

function buildRadarOption(dimensions) {
  const items = dimensions.filter((d) => d.score != null)
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    radar: {
      indicator: items.map((d) => ({ name: d.name, max: 100 })),
      radius: '62%',
      splitLine: { lineStyle: { color: 'rgba(148,163,184,.35)' } },
      splitArea: { areaStyle: { color: ['rgba(15,23,42,.08)', 'rgba(30,41,59,.12)'] } },
      axisName: { color: '#475569', fontSize: 12 },
      axisLine: { lineStyle: { color: 'rgba(148,163,184,.35)' } },
    },
    series: [{
      type: 'radar',
      data: [{
        name: '维度得分',
        value: items.map((d) => Number(d.score || 0)),
        areaStyle: { color: 'rgba(96,165,250,.22)' },
        lineStyle: { color: '#3b82f6', width: 2 },
        itemStyle: { color: '#60a5fa' },
      }],
    }],
  }
}

function buildBarOption(subModules) {
  const items = [...subModules].filter((m) => m.score != null).reverse()
  return {
    backgroundColor: 'transparent',
    grid: { left: 100, right: 24, top: 12, bottom: 12 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    xAxis: {
      type: 'value',
      max: 100,
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,.2)' } },
    },
    yAxis: {
      type: 'category',
      data: items.map((m) => m.name),
      axisLabel: { color: '#334155', fontSize: 12 },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [{
      type: 'bar',
      data: items.map((m) => ({
        value: m.score,
        itemStyle: { color: scoreColor(m.score), borderRadius: [0, 4, 4, 0] },
      })),
      barMaxWidth: 18,
    }],
  }
}

async function renderCharts() {
  if (props.loading || isIndustryRs.value) return
  await nextTick()
  const lib = await ensureEcharts()

  if (gaugeRef.value) {
    if (!gaugeChart) gaugeChart = lib.init(gaugeRef.value)
    const score = isComposite.value ? compositeTotal.value : categoryTotal.value
    gaugeChart.setOption(buildGaugeOption(score, categoryLabel.value), true)
    gaugeChart.resize()
  }

  if (isComposite.value && radarRef.value && compositeDimensions.value.length) {
    if (!radarChart) radarChart = lib.init(radarRef.value)
    radarChart.setOption(buildRadarOption(compositeDimensions.value), true)
    radarChart.resize()
  }

  if (!isComposite.value && barRef.value && categoryParsed.value.subModules.length) {
    if (!barChart) barChart = lib.init(barRef.value)
    barChart.setOption(buildBarOption(categoryParsed.value.subModules), true)
    barChart.resize()
  }
}

function setupResizeObserver() {
  if (resizeObserver || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(() => {
    gaugeChart?.resize()
    radarChart?.resize()
    barChart?.resize()
  })
  const nodes = [gaugeRef.value, radarRef.value, barRef.value].filter(Boolean)
  nodes.forEach((node) => resizeObserver.observe(node))
}

watch(
  () => [
    props.loading,
    props.category,
    props.details,
    props.weights,
    props.dimensions,
    props.maximized,
  ],
  async () => {
    if (props.loading) {
      disposeCharts()
      return
    }
    disposeCharts()
    await renderCharts()
    setupResizeObserver()
  },
  { deep: true, immediate: true },
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  disposeCharts()
})
</script>

<style scoped>
.score-detail-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-loading,
.detail-empty {
  padding: 24px 12px;
  text-align: center;
  color: #64748b;
}

.score-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 4px;
}

.score-hero--compact {
  padding-bottom: 0;
}

.gauge-chart {
  width: 140px;
  height: 110px;
  flex-shrink: 0;
}

.gauge-chart--sm {
  width: 120px;
  height: 96px;
}

.score-hero-meta {
  flex: 1;
  min-width: 0;
}

.hero-total {
  font-size: 2rem;
  font-weight: 800;
  line-height: 1.1;
}

.hero-label {
  font-size: 0.95rem;
  color: #64748b;
  margin-top: 4px;
}

.hero-strategy {
  font-size: 0.85rem;
  color: #94a3b8;
  margin-top: 6px;
}

.reference-badge {
  color: #5c6bc0;
  font-weight: 500;
}

.industry-rs-hero {
  padding-bottom: 4px;
}

.radar-chart {
  width: 100%;
  height: 280px;
}

.bar-chart {
  width: 100%;
  height: 220px;
}

.section-title {
  margin: 0 0 10px;
  font-size: 0.9rem;
  font-weight: 700;
  color: #334155;
}

.contrib-section {
  border-top: 1px solid #e2e8f0;
  padding-top: 12px;
}

.contrib-row {
  display: grid;
  grid-template-columns: 72px 1fr 40px 40px 44px;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  font-size: 0.82rem;
}

.contrib-name {
  color: #334155;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.contrib-bar-wrap {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.contrib-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.contrib-score,
.contrib-weight,
.contrib-value {
  text-align: right;
  color: #64748b;
  font-variant-numeric: tabular-nums;
}

.contrib-value {
  color: #3b82f6;
  font-weight: 600;
}

.submodule-section {
  border-top: 1px solid #e2e8f0;
  padding-top: 8px;
}

.submodule-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 8px;
  background: #f8fafc;
}

.submodule-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  list-style: none;
}

.submodule-summary::-webkit-details-marker {
  display: none;
}

.submodule-name {
  flex: 1;
  font-weight: 700;
  color: #1e293b;
}

.submodule-score {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.submodule-weight {
  font-size: 0.78rem;
  color: #94a3b8;
}

.submodule-body {
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chip-row,
.metric-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.signal-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 0.78rem;
  line-height: 1.3;
  background: #e2e8f0;
  color: #334155;
}

.signal-chip.positive {
  background: #dcfce7;
  color: #166534;
}

.signal-chip.negative {
  background: #fee2e2;
  color: #991b1b;
}

.signal-chip.neutral {
  background: #fef3c7;
  color: #92400e;
}

.metric-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.78rem;
  background: #fff;
  border: 1px solid #e2e8f0;
  color: #475569;
}

.metric-badge strong {
  color: #1e293b;
  margin-right: 4px;
}

.top-level-extras {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
  background: #f8fafc;
}

.top-level-item {
  display: grid;
  grid-template-columns: minmax(100px, 34%) 1fr;
  gap: 8px 12px;
  padding: 6px 0;
  border-bottom: 1px dashed #e2e8f0;
  font-size: 0.82rem;
}

.top-level-item:last-child {
  border-bottom: none;
}

.top-level-key {
  font-weight: 700;
  color: #334155;
}

.top-level-value {
  color: #475569;
  min-width: 0;
}

.raw-section {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fafbfc;
  overflow: hidden;
}

.raw-section--json {
  margin-top: 4px;
}

.raw-section-summary {
  padding: 10px 12px;
  font-size: 0.85rem;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
  list-style: none;
  user-select: none;
}

.raw-section-summary::-webkit-details-marker {
  display: none;
}

.raw-section[open] .raw-section-summary {
  border-bottom: 1px solid #e2e8f0;
  background: #f1f5f9;
}

.raw-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.raw-table th,
.raw-table td {
  padding: 8px 12px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid #eef2f7;
}

.raw-table thead th {
  background: #f1f5f9;
  color: #64748b;
  font-weight: 600;
}

.raw-table tbody th {
  width: 34%;
  color: #334155;
  font-weight: 600;
  background: #f8fafc;
}

.raw-table--compact th {
  width: 38%;
  font-size: 0.78rem;
}

.raw-fold {
  margin-top: 4px;
  border-top: 1px dashed #e2e8f0;
  padding-top: 8px;
}

.raw-fold-summary {
  font-size: 0.78rem;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  list-style: none;
  margin-bottom: 6px;
}

.raw-fold-summary::-webkit-details-marker {
  display: none;
}

.raw-array-list {
  margin: 0;
  padding-left: 18px;
  color: #475569;
}

.raw-array-list li {
  margin: 2px 0;
}

.raw-inline-object,
.raw-json {
  margin: 0;
  padding: 10px 12px;
  font-size: 0.75rem;
  line-height: 1.45;
  color: #334155;
  background: #fff;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 320px;
  overflow: auto;
}

.raw-scalar {
  color: #1e293b;
  word-break: break-word;
}
</style>
