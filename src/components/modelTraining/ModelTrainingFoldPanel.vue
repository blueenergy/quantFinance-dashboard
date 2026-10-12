<template>
  <section class="fold-panel">
    <div class="section-header">
      <div>
        <h4>Walk-forward 折间 IC</h4>
        <p class="muted">Spearman IC（测试折）；柱长为相对尺度，非收益率。</p>
      </div>
    </div>
    <div v-if="!foldRows.length" class="muted">暂无折报告。</div>
    <div v-else class="fold-chart">
      <div v-for="row in foldRows" :key="row.foldId" class="fold-row">
        <span class="fold-label">折 {{ row.foldId }}</span>
        <div class="bars">
          <div class="bar-group" title="模型">
            <div
              class="bar bar-model"
              :style="{ width: `${barWidthPct(row.modelIc, chartMaxIc)}%` }"
            />
            <span class="bar-value">{{ formatIc(row.modelIc) }}</span>
          </div>
          <div class="bar-group" title="规则基线">
            <div
              class="bar bar-baseline"
              :style="{ width: `${barWidthPct(row.baselineIc, chartMaxIc)}%` }"
            />
            <span class="bar-value">{{ formatIc(row.baselineIc) }}</span>
          </div>
        </div>
      </div>
      <p class="legend">
        <span class="swatch model" /> 模型
        <span class="swatch baseline" /> 规则基线
      </p>
    </div>
    <table v-if="foldRows.length" class="fold-table">
      <thead>
        <tr>
          <th>折</th>
          <th>模型 mean IC</th>
          <th>基线 mean IC</th>
          <th>模型 IC IR</th>
          <th>测试日数</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in foldRows" :key="`t-${row.foldId}`">
          <td>{{ row.foldId }}</td>
          <td>{{ formatIc(row.modelIc) }}</td>
          <td>{{ formatIc(row.baselineIc) }}</td>
          <td>{{ formatIc(row.modelIr) }}</td>
          <td>{{ row.modelDays ?? '-' }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<script setup>
import { barWidthPct, formatIc } from '../../utils/modelTrainingView'

defineProps({
  foldRows: { type: Array, default: () => [] },
  chartMaxIc: { type: Number, default: 0.01 },
})
</script>

<style scoped>
.fold-panel {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e6eaf0;
}

.section-header h4 {
  margin: 0 0 4px;
}

.muted {
  color: #64748b;
  font-size: 13px;
}

.fold-chart {
  margin: 16px 0;
}

.fold-row {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
}

.fold-label {
  font-size: 13px;
  color: #475569;
}

.bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bar-group {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 18px;
}

.bar {
  height: 12px;
  border-radius: 4px;
  min-width: 2px;
  max-width: 100%;
}

.bar-model {
  background: #0f6bdc;
}

.bar-baseline {
  background: #94a3b8;
}

.bar-value {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: #334155;
  flex: none;
}

.legend {
  font-size: 12px;
  color: #64748b;
  display: flex;
  gap: 16px;
  align-items: center;
}

.swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  margin-right: 4px;
}

.swatch.model {
  background: #0f6bdc;
}

.swatch.baseline {
  background: #94a3b8;
}

.fold-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.fold-table th,
.fold-table td {
  border: 1px solid #e6eaf0;
  padding: 8px 10px;
  text-align: left;
}

.fold-table th {
  background: #f8fafc;
}
</style>
