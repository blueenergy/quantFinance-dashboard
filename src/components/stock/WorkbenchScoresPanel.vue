<template>
  <section class="workbench-card">
    <div class="card-title-row">
      <h3>量化评分详情</h3>
      <span class="muted">
        来自最新 `stock_scores` 文档
        <template v-if="scoreHistory.length"> · 最近 {{ scoreHistory.length }} 条历史</template>
        <template v-if="loading"> · 刷新中…</template>
      </span>
    </div>
    <div class="score-grid">
      <article v-for="item in scoreItems" :key="item.key" class="score-card">
        <div class="score-card__head">
          <span>{{ item.label }}</span>
          <strong>{{ fmtNumber(item.score) }}</strong>
        </div>
        <div class="score-bar"><i :style="{ width: `${scorePercent(item.score)}%` }"></i></div>
        <details>
          <summary>查看详情</summary>
          <pre>{{ formatDetail(item.details) }}</pre>
        </details>
      </article>
    </div>
    <div class="score-history-block">
      <h4>评分历史</h4>
      <div v-if="scoreHistory.length" class="quote-table-wrap">
        <table class="quote-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>综合</th>
              <th>技术</th>
              <th>基本面</th>
              <th>价值</th>
              <th>成长</th>
              <th>资金流</th>
              <th>动量</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in scoreHistory.slice(0, 12)" :key="row.score_date">
              <td>{{ row.score_date || '-' }}</td>
              <td>{{ fmtNumber(scoreRowComposite(row)) }}</td>
              <td>{{ fmtNumber(row.technical_score) }}</td>
              <td>{{ fmtNumber(row.fundamental_score) }}</td>
              <td>{{ fmtNumber(row.value_score) }}</td>
              <td>{{ fmtNumber(row.growth_score) }}</td>
              <td>{{ fmtNumber(row.money_flow_score) }}</td>
              <td>{{ fmtNumber(row.cycle_score) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="muted-block">暂无评分历史。</div>
    </div>
  </section>
</template>

<script setup>
import {
  fmtNumber,
  formatDetail,
  scorePercent,
  scoreRowComposite,
} from '../../utils/workbenchFormat'

defineProps({
  scoreItems: { type: Array, default: () => [] },
  scoreHistory: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})
</script>

<style scoped>
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
.score-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}
.score-card {
  background: rgba(30, 41, 59, .72);
  border: 1px solid rgba(148, 163, 184, .16);
  border-radius: 14px;
  padding: 16px;
}
.score-card__head {
  align-items: center;
  display: flex;
  justify-content: space-between;
}
.score-card__head strong {
  color: #93c5fd;
  font-size: 24px;
}
.score-history-block {
  margin-top: 22px;
}
.score-history-block h4 {
  color: #e2e8f0;
  margin: 0 0 12px;
}
.score-bar {
  background: rgba(148, 163, 184, .18);
  border-radius: 999px;
  height: 8px;
  margin: 12px 0;
  overflow: hidden;
}
.score-bar i {
  background: linear-gradient(90deg, #38bdf8, #818cf8);
  display: block;
  height: 100%;
}
details summary {
  color: #bfdbfe;
  cursor: pointer;
}
pre {
  background: rgba(2, 6, 23, .68);
  border-radius: 10px;
  color: #cbd5e1;
  margin: 10px 0 0;
  max-height: 360px;
  overflow: auto;
  padding: 12px;
  white-space: pre-wrap;
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
.muted-block {
  background: rgba(30, 41, 59, .56);
  border-radius: 12px;
  padding: 18px;
}
</style>
