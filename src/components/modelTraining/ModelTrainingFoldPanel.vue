<template>
  <section class="fold-panel">
    <div class="section-header">
      <div>
        <h4>Walk-forward 折间 IC</h4>
        <p class="muted">
          每折测试窗上的 Spearman IC；柱长为相对尺度，非收益率。
        </p>
      </div>
    </div>
    <div v-if="!foldRows.length" class="muted">暂无折报告。</div>
    <div v-else class="fold-chart">
      <p class="legend legend-top" role="note">
        <span class="legend-item">
          <span class="swatch model" aria-hidden="true" />
          <strong>蓝色</strong>：本任务所选模型（Ridge / LGBM 等）
        </span>
        <span class="legend-item">
          <span class="swatch baseline" aria-hidden="true" />
          <strong>灰色</strong>：规则基线（特征截面 z-score 等权，<em>晋升门禁对比对象</em>）
        </span>
      </p>
      <div v-for="row in foldRows" :key="row.foldId" class="fold-row">
        <span class="fold-label">折 {{ row.foldId }}</span>
        <div class="bars">
          <div class="bar-group">
            <span class="bar-tag bar-tag-model">模型</span>
            <div
              class="bar bar-model"
              :style="{ width: `${barWidthPct(row.modelIc, chartMaxIc)}%` }"
              :title="`模型 IC ${formatIc(row.modelIc)}`"
            />
            <span class="bar-value">{{ formatIc(row.modelIc) }}</span>
          </div>
          <div class="bar-group">
            <span class="bar-tag bar-tag-baseline">基线</span>
            <div
              class="bar bar-baseline"
              :style="{ width: `${barWidthPct(row.baselineIc, chartMaxIc)}%` }"
              :title="`规则基线 IC ${formatIc(row.baselineIc)}`"
            />
            <span class="bar-value">{{ formatIc(row.baselineIc) }}</span>
          </div>
        </div>
      </div>
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

.bar-tag {
  flex: none;
  width: 36px;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
}

.bar-tag-model {
  color: #0f6bdc;
}

.bar-tag-baseline {
  color: #475569;
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
  flex-wrap: wrap;
  gap: 12px 20px;
  align-items: flex-start;
}

.legend-top {
  margin: 0 0 14px;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  line-height: 1.45;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  max-width: 100%;
}

.legend-item em {
  font-style: normal;
  color: #0f172a;
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
