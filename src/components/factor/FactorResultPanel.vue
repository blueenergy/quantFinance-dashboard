<template>
  <section class="factor-result">
    <div class="coverage-cards">
      <div v-for="card in coverageCards" :key="card.k" class="coverage-card">
        <span class="coverage-key">{{ card.k }}</span>
        <strong>{{ card.v }}</strong>
      </div>
    </div>
    <p class="muted pit-note">成分股口径：{{ pitLabel }}</p>

    <div class="panel-head">
      <h4>因子 IC 排行</h4>
      <div class="horizon-tabs">
        <button
          v-for="horizon in horizons"
          :key="horizon"
          type="button"
          class="horizon-tab"
          :class="{ active: String(selectedHorizon) === String(horizon) }"
          @click="$emit('select-horizon', horizon)"
        >
          {{ horizon }}d
        </button>
      </div>
    </div>

    <p v-if="!icRows.length" class="muted">该 horizon 没有可用的因子诊断。</p>
    <div v-else class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>因子</th>
            <th>IC 均值</th>
            <th>IC IR</th>
            <th>t 值</th>
            <th>IC 正比例</th>
            <th>首尾分位差</th>
            <th>单调</th>
            <th>截面数</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in icRows"
            :key="row.factor"
            class="clickable"
            :class="{ active: row.factor === selectedFactor }"
            @click="$emit('select-factor', row.factor)"
          >
            <td class="factor-cell">{{ row.factor }}</td>
            <td :class="signClass(row.ic_mean)">{{ num(row.ic_mean, 4) }}</td>
            <td :class="signClass(row.ic_ir)">{{ num(row.ic_ir, 3) }}</td>
            <td>{{ num(row.t_stat, 2) }}</td>
            <td>{{ pct(row.positive_ratio) }}</td>
            <td :class="signClass(row.spread)">{{ pct(row.spread) }}</td>
            <td>{{ row.monotonic ? '是' : '否' }}</td>
            <td>{{ num(row.observations, 0) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <template v-if="selectedFactor">
      <div class="panel-head">
        <h4>{{ selectedFactor }} · {{ selectedHorizon }}d 诊断</h4>
        <span v-if="factorMeta" class="muted meta-line">
          {{ factorMeta.family }} · {{ factorMeta.description || factorMeta.expression }}
        </span>
      </div>
      <p v-if="factorMeta?.expression" class="expression">{{ factorMeta.expression }}</p>

      <div v-if="quantileBars.length" class="quantile-block">
        <p class="block-title">分位组平均收益（{{ selectedHorizon }}d，1 为因子值最低组）</p>
        <div v-for="bar in quantileBars" :key="bar.quantile" class="quantile-row">
          <span class="quantile-label">Q{{ bar.quantile }}</span>
          <span class="quantile-track">
            <span class="quantile-fill" :class="bar.cls" :style="{ width: `${bar.percent}%` }" />
          </span>
          <span class="quantile-value" :class="bar.cls">{{ pct(bar.value) }}</span>
        </div>
        <p class="muted">
          首尾分位差 {{ pct(diagnostics?.quantiles?.top_minus_bottom_spread) }}
          · 分位秩相关 {{ num(diagnostics?.quantiles?.quantile_rank_corr, 3) }}
          · 单调性 {{ diagnostics?.quantiles?.monotonic_increasing ? '是' : '否' }}
        </p>
      </div>

      <div v-if="yearlyIcRows.length" class="table-scroll">
        <p class="block-title">分年度 IC</p>
        <table>
          <thead>
            <tr>
              <th>年度</th>
              <th>IC 均值</th>
              <th>IC IR</th>
              <th>t 值</th>
              <th>IC 正比例</th>
              <th>截面数</th>
              <th>平均标的数</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in yearlyIcRows" :key="row.year">
              <td>{{ row.year }}</td>
              <td :class="signClass(row.ic_mean)">{{ num(row.ic_mean, 4) }}</td>
              <td :class="signClass(row.ic_ir)">{{ num(row.ic_ir, 3) }}</td>
              <td>{{ num(row.t_stat, 2) }}</td>
              <td>{{ pct(row.positive_ratio) }}</td>
              <td>{{ num(row.observations, 0) }}</td>
              <td>{{ num(row.avg_names, 1) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="netReturnRows.length" class="table-scroll">
        <p class="block-title">
          成本调整后 TopK 收益（单边滑点 {{ num(costAssumptions?.slippage_bps_one_way, 1) }} bps，
          每次调仓成本 {{ pct(costAssumptions?.round_trip_rate) }}）
        </p>
        <table>
          <thead>
            <tr>
              <th>horizon</th>
              <th>Top K</th>
              <th>多头超额(毛)</th>
              <th>多头超额(净)</th>
              <th>多头超额年化(净)</th>
              <th>多空(净)</th>
              <th>多空年化(净)</th>
              <th>期数</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in netReturnRows" :key="`${row.horizon}-${row.top_k}`">
              <td>{{ row.horizon }}d</td>
              <td>{{ row.top_k }}</td>
              <td :class="signClass(row.long_excess_gross)">{{ pct(row.long_excess_gross) }}</td>
              <td :class="signClass(row.long_excess_net)">{{ pct(row.long_excess_net) }}</td>
              <td :class="signClass(row.long_excess_net_annual)">{{ pct(row.long_excess_net_annual) }}</td>
              <td :class="signClass(row.long_short_net)">{{ pct(row.long_short_net) }}</td>
              <td :class="signClass(row.long_short_net_annual)">{{ pct(row.long_short_net_annual) }}</td>
              <td>{{ num(row.observations, 0) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <details v-if="screenRows.length" class="screen-details">
      <summary>IC 初筛全量排行（{{ screenHorizon }}d，{{ screenRows.length }} 个因子）</summary>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>因子</th>
              <th>IC 均值</th>
              <th>IC IR</th>
              <th>t 值</th>
              <th>IC 正比例</th>
              <th>截面数</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in screenRows" :key="row.factor">
              <td class="factor-cell">{{ row.factor }}</td>
              <td :class="signClass(row.ic_mean)">{{ num(row.ic_mean, 4) }}</td>
              <td :class="signClass(row.ic_ir)">{{ num(row.ic_ir, 3) }}</td>
              <td>{{ num(row.t_stat, 2) }}</td>
              <td>{{ pct(row.positive_ratio) }}</td>
              <td>{{ num(row.observations, 0) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { findFactorMeta, num, pct, signClass } from '../../utils/factorBacktestView'

const props = defineProps({
  report: { type: Object, default: null },
  coverageCards: { type: Array, default: () => [] },
  pitLabel: { type: String, default: '-' },
  horizons: { type: Array, default: () => [] },
  selectedHorizon: { type: [String, Number], default: '' },
  selectedFactor: { type: String, default: '' },
  icRows: { type: Array, default: () => [] },
  diagnostics: { type: Object, default: null },
  quantileBars: { type: Array, default: () => [] },
  yearlyIcRows: { type: Array, default: () => [] },
  netReturnRows: { type: Array, default: () => [] },
  screenRows: { type: Array, default: () => [] },
})

defineEmits(['select-factor', 'select-horizon'])

const factorMeta = computed(() => findFactorMeta(props.report, props.selectedFactor))
const costAssumptions = computed(() => props.report?.cost_assumptions || null)
const screenHorizon = computed(() => props.report?.screen?.horizon ?? '-')
</script>

<style scoped>
.factor-result {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.coverage-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 8px;
}

.coverage-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid #e6eaf0;
  border-radius: 10px;
  background: #f8fafc;
}

.coverage-key {
  color: #64748b;
  font-size: 12px;
}

.coverage-card strong {
  color: #172033;
  font-size: 14px;
  overflow-wrap: anywhere;
}

.pit-note {
  margin: -8px 0 0;
  font-size: 12px;
}

.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.panel-head h4 {
  margin: 0;
}

.meta-line {
  font-size: 12px;
  overflow-wrap: anywhere;
}

.horizon-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.horizon-tab {
  border: 1px solid #d9e1ec;
  border-radius: 999px;
  background: #fff;
  color: #334155;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
}

.horizon-tab.active {
  border-color: #0f6bdc;
  background: #eef6ff;
  color: #0f6bdc;
  font-weight: 700;
}

.expression {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid #e6eaf0;
  border-radius: 8px;
  background: #f8fafc;
  color: #334155;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.block-title {
  margin: 0 0 6px;
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}

.table-scroll {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

th,
td {
  padding: 6px 8px;
  border-bottom: 1px solid #eef2f7;
  text-align: right;
  white-space: nowrap;
}

th:first-child,
td:first-child {
  text-align: left;
}

th {
  color: #64748b;
  font-weight: 700;
}

.factor-cell {
  font-weight: 700;
  color: #172033;
}

tr.clickable {
  cursor: pointer;
}

tr.clickable:hover {
  background: #f8fafc;
}

tr.active {
  background: #eef6ff;
}

.quantile-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.quantile-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.quantile-label {
  flex: none;
  width: 32px;
  color: #64748b;
  font-size: 12px;
}

.quantile-track {
  flex: 1;
  height: 10px;
  border-radius: 999px;
  background: #f1f5f9;
  overflow: hidden;
}

.quantile-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: #94a3b8;
}

.quantile-fill.pos {
  background: #16a34a;
}

.quantile-fill.neg {
  background: #dc2626;
}

.quantile-value {
  flex: none;
  width: 76px;
  text-align: right;
  font-size: 12px;
}

.screen-details summary {
  cursor: pointer;
  color: #0f6bdc;
  font-size: 13px;
}

.muted {
  color: #64748b;
  font-size: 12px;
  margin: 0;
}

.pos {
  color: #16a34a;
}

.neg {
  color: #dc2626;
}

.mut {
  color: #64748b;
}
</style>
