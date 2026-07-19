<template>
  <section class="panel-grid">
    <article class="workbench-card">
      <div class="card-title-row">
        <h3>最近九转信号</h3>
        <span class="muted">
          {{ nineTurnStatus.as_of || '暂无日期' }}
          <template v-if="loading"> · 刷新中…</template>
        </span>
      </div>
      <div v-if="latestNineTurnSignal" class="nine-turn-summary">
        <strong :class="nineturnSignalClass(latestNineTurnSignal)">
          {{ latestNineTurnSignal.label }} · {{ latestNineTurnSignal.grade_label }}
        </strong>
        <span>{{ latestNineTurnSignal.trade_date }} · 强度 {{ latestNineTurnSignal.strength }}/4</span>
        <p>
          完美结构 {{ formatCheck(latestNineTurnSignal.perfect) }}，
          量能过滤 {{ formatCheck(latestNineTurnSignal.vol_filter_pass) }}，
          均线过滤 {{ formatCheck(latestNineTurnSignal.trend_filter_pass) }}
        </p>
      </div>
      <div v-else class="muted-block">暂无已完成的九转信号。</div>
    </article>

    <article class="workbench-card">
      <div class="card-title-row">
        <h3>规则说明</h3>
        <span class="muted">Tushare 原始计数 + 本地增强</span>
      </div>
      <div class="nine-turn-rules">
        <span>下九转：第 8/9 天低点低于第 6/7 天低点</span>
        <span>上九转：第 8/9 天高点高于第 6/7 天高点</span>
        <span>过滤：下九转缩量 + 站上 60 日线；上九转放量</span>
      </div>
    </article>
  </section>

  <section class="workbench-card">
    <div class="card-title-row">
      <h3>九转 K 线</h3>
      <span class="muted">最近 {{ nineTurnDailyRows.length }} 个交易日 · {{ nineTurnSignals.length }} 个信号</span>
    </div>
    <StockKLineChart
      v-if="nineTurnDailyRows.length"
      :records="nineTurnDailyRows"
      :markers="nineTurnMarkers"
    />
    <div v-else class="muted-block">暂无该股票的九转 K 线数据。</div>
  </section>

  <section class="workbench-card">
    <div class="card-title-row">
      <h3>信号明细</h3>
      <span class="muted">普通 / 完美 / 强</span>
    </div>
    <div v-if="nineTurnSignals.length" class="quote-table-wrap">
      <table class="quote-table">
        <thead>
          <tr>
            <th>日期</th>
            <th>方向</th>
            <th>分级</th>
            <th>完美结构</th>
            <th>量能过滤</th>
            <th>均线过滤</th>
            <th>收盘</th>
            <th>5日均量</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="signal in nineTurnSignals" :key="`${signal.trade_date}-${signal.direction}`">
            <td>{{ signal.trade_date }}</td>
            <td :class="nineturnSignalClass(signal)">{{ signal.label }}</td>
            <td>{{ signal.grade_label }}</td>
            <td>{{ formatCheck(signal.perfect) }}</td>
            <td>{{ formatCheck(signal.vol_filter_pass) }}</td>
            <td>{{ formatCheck(signal.trend_filter_pass) }}</td>
            <td>{{ fmtNumber(signal.close) }}</td>
            <td>{{ fmtNumber(signal.volume_ma) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="muted-block">暂无完成 9 计数的九转信号。</div>
  </section>
</template>

<script setup>
import StockKLineChart from '../StockKLineChart.vue'
import {
  fmtNumber,
  formatCheck,
  nineturnSignalClass,
} from '../../utils/workbenchFormat'

defineProps({
  nineTurnStatus: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
  latestNineTurnSignal: { type: Object, default: null },
  nineTurnDailyRows: { type: Array, default: () => [] },
  nineTurnSignals: { type: Array, default: () => [] },
  nineTurnMarkers: { type: Array, default: () => [] },
})
</script>

<style scoped>
.panel-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, .8fr);
}
.workbench-card {
  background: rgba(15, 23, 42, 0.76);
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 18px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
  margin-bottom: 16px;
  padding: 20px;
}
h3 {
  margin: 0;
}
.card-title-row {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 14px;
}
.muted,
.muted-block {
  color: #94a3b8;
}
.muted-block {
  background: rgba(30, 41, 59, .56);
  border-radius: 12px;
  padding: 18px;
}
.nine-turn-summary {
  background: rgba(30, 41, 59, .62);
  border: 1px solid rgba(148, 163, 184, .18);
  border-radius: 14px;
  padding: 16px;
}
.nine-turn-summary strong {
  display: block;
  font-size: 22px;
  margin-bottom: 8px;
}
.nine-turn-summary span,
.nine-turn-summary p {
  color: #cbd5e1;
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
}
.nine-turn-rules {
  display: grid;
  gap: 10px;
}
.nine-turn-rules span {
  background: rgba(15, 23, 42, .58);
  border: 1px solid rgba(148, 163, 184, .16);
  border-radius: 12px;
  color: #cbd5e1;
  font-size: 13px;
  line-height: 1.5;
  padding: 10px 12px;
}
.is-up {
  color: #ef4444;
}
.is-down {
  color: #22c55e;
}
.quote-table-wrap {
  margin-top: 14px;
  overflow-x: auto;
}
.quote-table {
  border-collapse: collapse;
  min-width: 680px;
  width: 100%;
}
.quote-table th,
.quote-table td {
  border-bottom: 1px solid rgba(148, 163, 184, .16);
  color: #cbd5e1;
  font-size: 13px;
  padding: 10px 8px;
  text-align: right;
  white-space: nowrap;
}
.quote-table th:first-child,
.quote-table td:first-child {
  text-align: left;
}
.quote-table th {
  color: #94a3b8;
  font-weight: 600;
}
.quote-table td.is-up {
  color: #ef4444;
}
.quote-table td.is-down {
  color: #22c55e;
}
@media (max-width: 980px) {
  .panel-grid {
    grid-template-columns: 1fr;
  }
}
</style>
