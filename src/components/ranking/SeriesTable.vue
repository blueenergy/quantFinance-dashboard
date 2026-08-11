<template>
  <div v-if="seriesList.length" class="series-table-block">
    <div
      v-for="series in seriesList"
      :key="series.name"
      class="series-block"
    >
      <div class="series-header">
        <span class="series-name">{{ series.name }}</span>
        <span v-if="series.unit" class="series-unit">单位：{{ series.unit }}</span>
        <span v-if="series.source" class="series-source">{{ series.source }}</span>
      </div>
      <div class="sparkline-wrap">
        <svg
          v-if="series.points.length > 1"
          class="sparkline"
          :viewBox="`0 0 ${sparkWidth} ${sparkHeight}`"
          preserveAspectRatio="none"
        >
          <polyline
            :points="sparkPoints(series.points)"
            fill="none"
            stroke="#3b82f6"
            stroke-width="2"
            vector-effect="non-scaling-stroke"
          />
        </svg>
      </div>
      <table class="series-table">
        <thead>
          <tr>
            <th>期间</th>
            <th>报告期</th>
            <th>数值</th>
            <th>同比</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(pt, idx) in series.points" :key="idx">
            <td>{{ pt.period || '—' }}</td>
            <td>{{ formatEndDate(pt.end_date) }}</td>
            <td>{{ formatSeriesValue(pt.value, series.unit) }}</td>
            <td :class="yoyClass(pt.yoy)">{{ formatYoyValue(pt.yoy) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { formatSeriesValue, formatYoyValue } from '../../utils/scoreDetail.js'

defineProps({
  seriesList: { type: Array, default: () => [] },
})

const sparkWidth = 120
const sparkHeight = 32

function formatEndDate(raw) {
  const s = String(raw || '')
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return s || '—'
}

function yoyClass(yoy) {
  if (yoy == null || Number.isNaN(Number(yoy))) return ''
  const n = Number(yoy)
  if (n > 0) return 'yoy-pos'
  if (n < 0) return 'yoy-neg'
  return ''
}

function sparkPoints(points) {
  const values = points
    .map((pt) => Number(pt.value))
    .filter((v) => !Number.isNaN(v))
  if (values.length < 2) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * sparkWidth
      const y = sparkHeight - ((v - min) / range) * (sparkHeight - 4) - 2
      return `${x},${y}`
    })
    .join(' ')
}
</script>

<style scoped>
.series-table-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.series-block {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.series-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #f1f5f9;
  border-bottom: 1px solid #e2e8f0;
}

.series-name {
  font-weight: 700;
  color: #1e293b;
  font-size: 0.85rem;
}

.series-unit,
.series-source {
  font-size: 0.75rem;
  color: #64748b;
}

.sparkline-wrap {
  padding: 6px 10px 0;
}

.sparkline {
  width: 100%;
  height: 32px;
  display: block;
}

.series-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
}

.series-table th,
.series-table td {
  padding: 6px 10px;
  text-align: left;
  border-top: 1px solid #eef2f7;
}

.series-table thead th {
  background: #f8fafc;
  color: #64748b;
  font-weight: 600;
}

.yoy-pos {
  color: #166534;
}

.yoy-neg {
  color: #991b1b;
}
</style>
