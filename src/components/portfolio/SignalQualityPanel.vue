<template>
  <details v-if="rows.length" class="signal-quality card" open>
    <summary>
      信号质量（IC / ICIR）
      <span class="muted">信号层指标，与 TopN / 调仓 / 成本无关</span>
    </summary>
    <p class="muted hint">
      非重叠 t 按 horizon 抽样；MDE80 = 2.8 × se。IC 好不等于 TopN 能赚钱。
    </p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="col-text">评分</th>
            <th>Horizon</th>
            <th>IC 均值</th>
            <th>ICIR</th>
            <th>正比率</th>
            <th>非重叠 t</th>
            <th>MDE80</th>
            <th>N(非重叠)</th>
            <th>观测</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="`${row.scoreColumn}-${row.horizon}`">
            <td class="col-text">{{ row.scoreLabel }}</td>
            <td>{{ row.horizon }}d</td>
            <td :class="signClass(row.icMean)">{{ num(row.icMean, 4) }}</td>
            <td>{{ num(row.icIr, 3) }}</td>
            <td>{{ pct(row.positiveRatio) }}</td>
            <td>{{ num(row.tNonoverlap, 2) }}</td>
            <td>{{ num(row.mde80, 4) }}</td>
            <td>{{ num(row.nNonoverlap, 0) }}</td>
            <td>{{ num(row.observations, 0) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </details>
</template>

<script setup>
import { computed } from 'vue'
import { buildSignalQualityRows } from '../../utils/sweepResultView'
import { pct, signClass } from '../../utils/portfolioResearchView'

const props = defineProps({
  signalQuality: { type: Object, default: () => ({}) },
  params: { type: Object, default: () => ({}) },
  num: { type: Function, required: true },
})

const rows = computed(() => buildSignalQualityRows(props.signalQuality, props.params))
</script>

<style scoped>
.signal-quality {
  padding: 12px 14px;
  margin-bottom: 12px;
}

.signal-quality summary {
  cursor: pointer;
  font-weight: 700;
  color: #334155;
}

.signal-quality summary .muted {
  margin-left: 8px;
  font-weight: 400;
  font-size: 12px;
}

.signal-quality .hint {
  margin: 8px 0;
  font-size: 12px;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  white-space: nowrap;
}

th,
td {
  padding: 6px 8px;
  border-bottom: 1px solid #e2e8f0;
  text-align: right;
}

th:first-child,
td:first-child {
  text-align: left;
}

th {
  color: #64748b;
  font-weight: 600;
}
</style>
