<template>
  <section class="panel-grid">
    <article class="workbench-card">
      <div class="card-title-row">
        <h3>财务成长图</h3>
        <span class="muted">
          {{ financialModeLabel }} · 最近 {{ financialChartData.length }} 期
          <template v-if="loading"> · 刷新中…</template>
        </span>
      </div>
      <v-btn-toggle
        v-model="financialMode"
        class="financial-mode-toggle"
        color="primary"
        density="compact"
        mandatory
        variant="outlined"
      >
        <v-btn value="quarterly">单季对比</v-btn>
        <v-btn value="annual">年度对比</v-btn>
      </v-btn-toggle>
      <GrowthChart v-if="financialChartData.length" :series="financialChartData" />
      <div v-else class="muted-block">暂无足够财务数据。</div>
    </article>

    <article class="workbench-card">
      <div class="card-title-row">
        <h3>核心财务指标</h3>
        <span class="muted">{{ financialMetricsPeriodText }}</span>
      </div>
      <div class="financial-metrics">
        <div v-for="metric in financialMetrics" :key="metric.label">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
        </div>
      </div>
    </article>
  </section>

  <section class="workbench-card">
    <div class="card-title-row">
      <h3>财务质量摘要</h3>
      <span class="muted">基于当前{{ financialModeLabel }}口径与最新财报数据</span>
    </div>
    <div v-if="financialQualityCards.length" class="quality-card-grid">
      <article
        v-for="card in financialQualityCards"
        :key="card.key"
        :class="['quality-card', `quality-card--${card.level}`]"
      >
        <span>{{ card.label }}</span>
        <strong>{{ card.title }}</strong>
        <small>{{ card.detail }}</small>
      </article>
    </div>
    <div v-else class="muted-block">暂无足够财务数据生成质量摘要。</div>
  </section>

  <section class="workbench-card">
    <div class="card-title-row">
      <h3>原始财报明细</h3>
      <span class="muted">最近 8 期关键字段，金额按报表元口径换算</span>
    </div>
    <div class="financial-raw-sections">
      <details open>
        <summary>利润表</summary>
        <div v-if="incomeReportSections.length" class="financial-report-groups">
          <div v-for="section in incomeReportSections" :key="section.key" class="financial-report-group">
            <h4>{{ section.label }}</h4>
            <div class="quote-table-wrap">
              <table class="quote-table financial-raw-table">
                <thead>
                  <tr>
                    <th>报告期</th>
                    <th>公告日</th>
                    <th>营业总收入</th>
                    <th>营业收入</th>
                    <th>归母净利</th>
                    <th>净利润</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in section.rows.slice(0, 8)" :key="`income-${section.key}-${statementPeriod(row)}`">
                    <td>{{ statementPeriod(row) }}</td>
                    <td>{{ blankDash(row.ann_date || row.f_ann_date) }}</td>
                    <td>{{ fmtStatementAmount(row.total_revenue) }}</td>
                    <td>{{ fmtStatementAmount(row.revenue) }}</td>
                    <td>{{ fmtStatementAmount(row.n_income_attr_p) }}</td>
                    <td>{{ fmtStatementAmount(row.n_income) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div v-else class="muted-block">暂无利润表明细。</div>
      </details>

      <details>
        <summary>资产负债表</summary>
        <div v-if="balanceRows.length" class="quote-table-wrap">
          <table class="quote-table financial-raw-table">
            <thead>
              <tr>
                <th>报告期</th>
                <th>公告日</th>
                <th>总资产</th>
                <th>总负债</th>
                <th>股东权益</th>
                <th>应收账款</th>
                <th>存货</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in balanceRows.slice(0, 8)" :key="`balance-${statementPeriod(row)}`">
                <td>{{ statementPeriod(row) }}</td>
                <td>{{ blankDash(row.ann_date || row.f_ann_date) }}</td>
                <td>{{ fmtStatementAmount(row.total_assets) }}</td>
                <td>{{ fmtStatementAmount(row.total_liab) }}</td>
                <td>{{ fmtStatementAmount(row.total_hldr_eqy_exc_min_int || row.total_hldr_eqy_inc_min_int) }}</td>
                <td>{{ fmtStatementAmount(row.accounts_receiv) }}</td>
                <td>{{ fmtStatementAmount(row.inventories) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="muted-block">暂无资产负债表明细。</div>
      </details>

      <details>
        <summary>现金流量表</summary>
        <div v-if="cashflowReportSections.length" class="financial-report-groups">
          <div v-for="section in cashflowReportSections" :key="section.key" class="financial-report-group">
            <h4>{{ section.label }}</h4>
            <div class="quote-table-wrap">
              <table class="quote-table financial-raw-table">
                <thead>
                  <tr>
                    <th>报告期</th>
                    <th>公告日</th>
                    <th>经营现金流</th>
                    <th>投资现金流</th>
                    <th>筹资现金流</th>
                    <th>购建长期资产</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in section.rows.slice(0, 8)" :key="`cashflow-${section.key}-${statementPeriod(row)}`">
                    <td>{{ statementPeriod(row) }}</td>
                    <td>{{ blankDash(row.ann_date || row.f_ann_date) }}</td>
                    <td>{{ fmtStatementAmount(row.n_cashflow_act) }}</td>
                    <td>{{ fmtStatementAmount(row.n_cashflow_inv_act) }}</td>
                    <td>{{ fmtStatementAmount(row.n_cash_flows_fnc_act) }}</td>
                    <td>{{ fmtStatementAmount(row.c_pay_acq_const_fiolta) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div v-else class="muted-block">暂无现金流量表明细。</div>
      </details>

      <details>
        <summary>财务指标</summary>
        <div v-if="indicatorRows.length" class="quote-table-wrap">
          <table class="quote-table financial-raw-table">
            <thead>
              <tr>
                <th>报告期</th>
                <th>公告日</th>
                <th>ROE</th>
                <th>毛利率</th>
                <th>营收同比</th>
                <th>净利同比</th>
                <th>资产负债率</th>
                <th>流动比率</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in indicatorRows.slice(0, 8)" :key="`indicator-${statementPeriod(row)}`">
                <td>{{ statementPeriod(row) }}</td>
                <td>{{ blankDash(row.ann_date || row.f_ann_date) }}</td>
                <td>{{ fmtNullablePct(row.roe || row.roe_dt) }}</td>
                <td>{{ fmtNullablePct(row.grossprofit_margin) }}</td>
                <td>{{ fmtNullablePct(row.tr_yoy || row.or_yoy) }}</td>
                <td>{{ fmtNullablePct(row.netprofit_yoy || row.profit_to_gr) }}</td>
                <td>{{ fmtNullablePct(row.debt_to_assets) }}</td>
                <td>{{ fmtNullableNumber(row.current_ratio) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="muted-block">暂无财务指标明细。</div>
      </details>
    </div>
  </section>

  <section class="workbench-card">
    <div class="card-title-row">
      <h3>业绩事件</h3>
      <span class="muted">预告 / 快报 / 披露日历</span>
    </div>
    <div v-if="earningsEvents.length" class="event-list">
      <article v-for="event in earningsEvents" :key="`${event.type}-${event.date}-${event.title}`" class="event-item">
        <span>{{ event.type }}</span>
        <strong>{{ event.title }}</strong>
        <small>{{ event.date || '-' }}</small>
      </article>
    </div>
    <div v-else class="muted-block">暂无业绩事件。</div>
  </section>

  <section class="workbench-card">
    <div class="card-title-row">
      <h3>卖方研报</h3>
      <span class="muted">最近 {{ reportRcRows.length }} 条，来自 Tushare report_rc</span>
    </div>
    <div v-if="reportRcRows.length" class="quote-table-wrap">
      <table class="quote-table report-rc-table">
        <thead>
          <tr>
            <th>日期</th>
            <th>券商</th>
            <th>评级</th>
            <th>目标价</th>
            <th>预测期</th>
            <th>营收</th>
            <th>营业利润</th>
            <th>利润总额</th>
            <th>净利润</th>
            <th>EPS</th>
            <th>PE</th>
            <th>股息率</th>
            <th>ROE</th>
            <th>EV/EBITDA</th>
            <th>报告标题</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in reportRcRows" :key="`${row.report_date || row.create_time}-${row.org_name}-${row.report_title}`">
            <td>{{ blankDash(row.report_date || row.create_time) }}</td>
            <td>{{ blankDash(row.org_name || row.organ_name || row.org) }}</td>
            <td>{{ blankDash(row.rating_name || row.rating) }}</td>
            <td>{{ reportRcTargetRange(row) || '-' }}</td>
            <td>{{ blankDash(row.quarter) }}</td>
            <td>{{ fmtWanAmount(row.op_rt) }}</td>
            <td>{{ fmtWanAmount(row.op_pr) }}</td>
            <td>{{ fmtWanAmount(row.tp) }}</td>
            <td>{{ fmtWanAmount(row.np) }}</td>
            <td>{{ fmtNullableNumber(row.eps) }}</td>
            <td>{{ fmtNullableNumber(row.pe) }}</td>
            <td>{{ fmtNullablePct(row.rd) }}</td>
            <td>{{ fmtNullablePct(row.roe) }}</td>
            <td>{{ fmtNullableNumber(row.ev_ebitda) }}</td>
            <td class="report-title-cell">{{ blankDash(row.report_title || row.title || row.name) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="muted-block">暂无卖方研报数据。</div>
  </section>
</template>

<script setup>
import GrowthChart from '../GrowthChart.vue'
import {
  blankDash,
  fmtNullableNumber,
  fmtNullablePct,
  fmtStatementAmount,
  fmtWanAmount,
  reportRcTargetRange,
  statementPeriod,
} from '../../utils/workbenchFormat'

defineProps({
  financialModeLabel: { type: String, default: '' },
  financialChartData: { type: Array, default: () => [] },
  financialMetrics: { type: Array, default: () => [] },
  financialMetricsPeriodText: { type: String, default: '' },
  financialQualityCards: { type: Array, default: () => [] },
  incomeReportSections: { type: Array, default: () => [] },
  balanceRows: { type: Array, default: () => [] },
  cashflowReportSections: { type: Array, default: () => [] },
  indicatorRows: { type: Array, default: () => [] },
  earningsEvents: { type: Array, default: () => [] },
  reportRcRows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const financialMode = defineModel('financialMode', {
  type: String,
  default: 'quarterly',
  validator: (value) => ['quarterly', 'annual'].includes(value),
})
</script>

<style scoped>
.financial-mode-toggle {
  margin: 14px 0 10px;
}
.financial-mode-toggle :deep(.v-btn) {
  color: #cbd5e1;
}
.financial-mode-toggle :deep(.v-btn--active) {
  color: #f8fafc;
}
.quality-card-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}
.quality-card {
  background: rgba(30, 41, 59, .62);
  border: 1px solid rgba(148, 163, 184, .18);
  border-radius: 14px;
  padding: 14px;
}
.quality-card span {
  color: #94a3b8;
  display: block;
  font-size: 12px;
  margin-bottom: 6px;
}
.quality-card strong {
  color: #f8fafc;
  display: block;
  font-size: 16px;
  margin-bottom: 8px;
}
.quality-card small {
  color: #cbd5e1;
  line-height: 1.5;
}
.quality-card--good {
  border-color: rgba(34, 197, 94, .35);
}
.quality-card--neutral {
  border-color: rgba(234, 179, 8, .32);
}
.quality-card--warn {
  border-color: rgba(239, 68, 68, .35);
}
.financial-raw-sections {
  display: grid;
  gap: 12px;
}
.financial-raw-sections details {
  background: rgba(30, 41, 59, .46);
  border: 1px solid rgba(148, 163, 184, .14);
  border-radius: 12px;
  padding: 12px 14px;
}
.financial-raw-sections summary {
  color: #bfdbfe;
  cursor: pointer;
  font-weight: 700;
}
.financial-report-groups {
  display: grid;
  gap: 16px;
}
.financial-report-group h4 {
  color: #e2e8f0;
  font-size: 14px;
  margin: 4px 0 0;
}
.financial-raw-table {
  min-width: 860px;
}
.report-rc-table {
  min-width: 1280px;
}
.report-title-cell {
  max-width: 360px;
  min-width: 260px;
  overflow: hidden;
  text-align: left !important;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.event-list {
  display: grid;
  gap: 10px;
}
.event-item {
  align-items: center;
  background: rgba(30, 41, 59, .56);
  border: 1px solid rgba(148, 163, 184, .14);
  border-radius: 12px;
  display: grid;
  gap: 10px;
  grid-template-columns: 90px minmax(0, 1fr) 110px;
  padding: 12px 14px;
}
.event-item span {
  color: #93c5fd;
  font-size: 12px;
}
.event-item strong {
  color: #f8fafc;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.event-item small {
  color: #94a3b8;
  text-align: right;
}
</style>
