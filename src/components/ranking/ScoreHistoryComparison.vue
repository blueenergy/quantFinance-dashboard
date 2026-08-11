<template>
  <div v-if="rows.length" class="score-history-comparison">
    <h5 class="section-title">历史评分对比</h5>
    <p class="comparison-note">
      基于最近 {{ rows.length }} 次评分记录（{{ categoryLabel }}）
    </p>
    <div class="comparison-chart-wrap">
      <svg
        class="comparison-chart"
        :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
        preserveAspectRatio="none"
      >
        <polyline
          :points="linePoints"
          fill="none"
          stroke="#3b82f6"
          stroke-width="2"
          vector-effect="non-scaling-stroke"
        />
      </svg>
    </div>
    <table class="comparison-table">
      <thead>
        <tr>
          <th>日期</th>
          <th>得分</th>
          <th>较上期</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, idx) in displayRows" :key="row.score_date">
          <td>{{ formatDate(row.score_date) }}</td>
          <td>{{ row.score?.toFixed?.(1) ?? '—' }}</td>
          <td :class="deltaClass(row.delta)">{{ formatDelta(row.delta) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { buildScoreHistoryComparison, translateScoreCategory } from '../../utils/scoreDetail.js'

const props = defineProps({
  history: { type: Array, default: () => [] },
  category: { type: String, default: 'composite' },
  limit: { type: Number, default: 12 },
})

const categoryLabel = computed(() => translateScoreCategory(props.category))

const rows = computed(() => buildScoreHistoryComparison(props.history, props.category))

const displayRows = computed(() => {
  const sliced = rows.value.slice(-props.limit).reverse()
  return sliced.map((row, idx) => {
    const prev = sliced[idx + 1]
    const delta = prev && row.score != null && prev.score != null
      ? row.score - prev.score
      : null
    return { ...row, delta }
  })
})

const chartWidth = 280
const chartHeight = 64

const linePoints = computed(() => {
  const chron = [...rows.value].slice(-props.limit)
  if (chron.length < 2) return ''
  const scores = chron.map((r) => r.score)
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const range = max - min || 1
  return scores
    .map((v, i) => {
      const x = (i / (scores.length - 1)) * chartWidth
      const y = chartHeight - ((v - min) / range) * (chartHeight - 6) - 3
      return `${x},${y}`
    })
    .join(' ')
})

function formatDate(raw) {
  const s = String(raw || '')
  if (s.length === 8) return `${s.slice(4, 6)}-${s.slice(6, 8)}`
  return s
}

function formatDelta(delta) {
  if (delta == null || Number.isNaN(Number(delta))) return '—'
  const n = Number(delta)
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}`
}

function deltaClass(delta) {
  if (delta == null) return ''
  if (delta > 0) return 'delta-pos'
  if (delta < 0) return 'delta-neg'
  return ''
}
</script>

<style scoped>
.score-history-comparison {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  background: #fff;
}

.section-title {
  margin: 0 0 4px;
  font-size: 0.9rem;
  font-weight: 700;
  color: #334155;
}

.comparison-note {
  margin: 0 0 8px;
  font-size: 0.78rem;
  color: #94a3b8;
}

.comparison-chart-wrap {
  margin-bottom: 10px;
}

.comparison-chart {
  width: 100%;
  height: 64px;
  display: block;
  background: #f8fafc;
  border-radius: 6px;
}

.comparison-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
}

.comparison-table th,
.comparison-table td {
  padding: 6px 8px;
  text-align: left;
  border-top: 1px solid #eef2f7;
}

.comparison-table thead th {
  color: #64748b;
  font-weight: 600;
}

.delta-pos {
  color: #166534;
}

.delta-neg {
  color: #991b1b;
}
</style>
