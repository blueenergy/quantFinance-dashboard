<template>
  <section class="workbench-card">
    <div class="card-title-row">
      <h3>股东筹码概览</h3>
      <span class="muted">
        <template v-if="loading">刷新中…</template>
        <template v-else>户数 {{ summary.holder_num_date || '-' }} · 北向 {{ summary.northbound_date || '-' }}</template>
      </span>
    </div>
    <div class="financial-metrics">
      <div>
        <span>股东户数</span>
        <strong>{{ summary.holder_num != null ? Math.round(summary.holder_num).toLocaleString() : '-' }}</strong>
      </div>
      <div>
        <span>户数环比<small class="muted">（降为筹码集中）</small></span>
        <strong :class="holderTrendClass(summary.holder_num_chg_pct)">{{ fmtPct(summary.holder_num_chg_pct) }}</strong>
      </div>
      <div>
        <span>北向持股占比</span>
        <strong>{{ fmtNullablePct(summary.northbound_ratio) }}</strong>
      </div>
      <div>
        <span>北向占比变动</span>
        <strong :class="pctClass(summary.northbound_ratio_chg)">{{ summary.northbound_ratio_chg != null ? `${summary.northbound_ratio_chg > 0 ? '+' : ''}${summary.northbound_ratio_chg.toFixed(2)}pct` : '-' }}</strong>
      </div>
      <div>
        <span>外资机构变化</span>
        <strong>{{ summary.intl_change_count ?? summary.intl_new_count ?? 0 }} 家</strong>
      </div>
      <div>
        <span>香港中央结算变化</span>
        <strong :class="pctClass(summary.hksc_hold_ratio_chg)">{{ summary.hksc_hold_ratio_chg != null ? `${summary.hksc_hold_ratio_chg > 0 ? '+' : ''}${summary.hksc_hold_ratio_chg.toFixed(2)}pct` : '-' }}</strong>
      </div>
    </div>
  </section>

  <section class="panel-grid">
    <article class="workbench-card">
      <div class="card-title-row">
        <h3>股东户数趋势</h3>
        <span class="muted">
          按报告期 · {{ holderNumbers.length || 0 }} 条
          <button type="button" class="text-link-button" @click="holderNumberTableExpanded = !holderNumberTableExpanded">
            {{ holderNumberTableExpanded ? '收起明细' : '展开明细' }}
          </button>
        </span>
      </div>
      <div v-if="holderNumbers.length" ref="holderNumberChartRef" class="shareholder-mini-chart"></div>
      <div v-if="holderNumberTableExpanded && holderNumbers.length" class="quote-table-wrap">
        <table class="quote-table">
          <thead>
            <tr><th>报告期</th><th>股东户数</th><th>环比</th></tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in holderNumbers.slice(0, 12)" :key="row.end_date">
              <td>{{ row.end_date }}</td>
              <td>{{ row.holder_num != null ? Math.round(row.holder_num).toLocaleString() : '-' }}</td>
              <td :class="holderTrendClass(holderNumQoq(idx))">{{ fmtPct(holderNumQoq(idx)) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else-if="holderNumberTableExpanded" class="muted-block">暂无股东户数数据。</div>
      <div v-else-if="holderNumbers.length" class="muted-block">明细表默认收起，图表已展示主要趋势。</div>
      <div v-else class="muted-block">暂无股东户数数据。</div>
    </article>

    <article class="workbench-card">
      <div class="card-title-row">
        <h3>北向持股（沪深港股通）</h3>
        <span class="muted">2024-08 起按季披露</span>
      </div>
      <div v-if="hkHold.length" ref="hkHoldChartRef" class="shareholder-mini-chart"></div>
      <div v-if="hkHold.length" class="quote-table-wrap">
        <table class="quote-table">
          <thead>
            <tr><th>日期</th><th>持股量</th><th>占流通比</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in hkHold.slice(0, 12)" :key="row.trade_date">
              <td>{{ row.trade_date }}</td>
              <td>{{ fmtShares(row.vol) }}</td>
              <td>{{ fmtNullablePct(row.ratio) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="muted-block">暂无北向持股数据。</div>
    </article>
  </section>

  <section class="workbench-card">
    <div class="card-title-row">
      <h3>前十大流通股东变化</h3>
      <span class="muted">
        {{ top10Change.period_curr || '-' }}
        <template v-if="top10Change.period_prev"> vs {{ top10Change.period_prev }}</template>
      </span>
    </div>
    <div v-if="top10Change.period_curr" class="shareholder-signal-grid">
      <article>
        <h4>国际机构/外资席位变化</h4>
        <div v-if="intlChanges.length" class="chip-list">
          <span
            v-for="row in intlChanges"
            :key="`${row.norm_key}-${row.current?.holder_name || row.previous?.holder_name || row.holder_name}`"
            class="chip-pill"
          >
            {{ row.norm_label }} · {{ top10ChangeLabel(row.change_type) }}
            <template v-if="row.current">
              · 本期 {{ fmtShares(row.current.hold_amount) }} / {{ fmtNullablePct(row.current.hold_ratio) }}
            </template>
            <template v-if="row.previous && row.change_type === 'exited'">
              · 上期 {{ fmtShares(row.previous.hold_amount) }} / {{ fmtNullablePct(row.previous.hold_ratio) }}
            </template>
            <template v-if="row.hold_ratio_chg != null && !['new', 'exited'].includes(row.change_type)">
              · {{ top10RatioChangeText(row) }}
            </template>
          </span>
        </div>
        <p v-else class="muted">最近两期未识别到高盛/摩根/UBS 等国际机构持仓变化。</p>
      </article>
      <article>
        <h4>香港中央结算有限公司</h4>
        <template v-if="hksc.current">
          <p>
            本期 {{ fmtShares(hksc.current.hold_amount) }} · {{ fmtNullablePct(hksc.current.hold_ratio) }}
          </p>
          <p>
            较上期 {{ top10ChangeLabel(hksc.change_type) }}
            <strong :class="valueClass(hksc.hold_amount_chg)">{{ fmtSignedShares(hksc.hold_amount_chg) }}</strong>
            /
            <strong :class="pctClass(hksc.hold_ratio_chg)">{{ top10RatioChangeText(hksc) }}</strong>
          </p>
          <small>北向集合账户,不是单一外资机构,但持仓变化本身值得跟踪。</small>
        </template>
        <p v-else class="muted">本期未进入前十大流通股东。</p>
      </article>
    </div>
    <div v-else class="muted-block">暂无前十大流通股东变化数据。</div>
  </section>

  <section class="workbench-card">
    <div class="card-title-row">
      <h3>股东增减持</h3>
      <span class="muted">
        公告驱动 · {{ holderTrades.length || 0 }} 条
        <button type="button" class="text-link-button" @click="shareholderTradesExpanded = !shareholderTradesExpanded">
          {{ shareholderTradesExpanded ? '收起' : '展开' }}
        </button>
      </span>
    </div>
    <div v-if="shareholderTradesExpanded && holderTrades.length" class="quote-table-wrap">
      <table class="quote-table">
        <thead>
          <tr><th>公告日</th><th>股东</th><th>方向</th><th>变动股数</th><th>占比</th><th>变动后持股比</th><th>均价</th></tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in holderTrades.slice(0, 15)" :key="`${row.ann_date}-${row.holder_name}-${idx}`">
            <td>{{ row.ann_date }}</td>
            <td class="cell-name">{{ row.holder_name || '-' }}</td>
            <td :class="row.in_de === 'IN' ? 'is-up' : row.in_de === 'DE' ? 'is-down' : ''">{{ inDeLabel(row.in_de) }}</td>
            <td>{{ fmtShares(row.change_vol) }}</td>
            <td>{{ fmtNullablePct(row.change_ratio) }}</td>
            <td>{{ fmtNullablePct(row.after_ratio) }}</td>
            <td>{{ fmtNullableNumber(row.avg_price) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else-if="shareholderTradesExpanded" class="muted-block">暂无股东增减持记录。</div>
    <div v-else class="muted-block">默认收起公告驱动的股东增减持明细，可展开查看。</div>
  </section>

  <section class="panel-grid">
    <article class="workbench-card">
      <div class="card-title-row">
        <h3>限售解禁</h3>
        <span class="muted">
          float_date 为解禁日 · {{ shareFloats.length || 0 }} 条
          <button type="button" class="text-link-button" @click="shareFloatExpanded = !shareFloatExpanded">
            {{ shareFloatExpanded ? '收起' : '展开' }}
          </button>
        </span>
      </div>
      <div v-if="shareFloatExpanded && shareFloats.length" class="quote-table-wrap">
        <table class="quote-table">
          <thead>
            <tr><th>解禁日</th><th>类型</th><th>解禁股数</th><th>占比</th></tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in shareFloats.slice(0, 12)" :key="`${row.float_date}-${idx}`">
              <td>{{ row.float_date }}<small v-if="isFutureDate(row.float_date)" class="badge-upcoming">待解禁</small></td>
              <td class="cell-name">{{ row.share_type || '-' }}</td>
              <td>{{ fmtShares(row.float_share) }}</td>
              <td>{{ fmtNullablePct(row.float_ratio) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else-if="shareFloatExpanded" class="muted-block">暂无限售解禁数据。</div>
      <div v-else class="muted-block">默认收起限售解禁明细，可展开查看。</div>
    </article>

    <article class="workbench-card">
      <div class="card-title-row">
        <h3>股票回购</h3>
        <span class="muted">含回购阶段</span>
      </div>
      <div v-if="repurchases.length" class="quote-table-wrap">
        <table class="quote-table">
          <thead>
            <tr><th>公告日</th><th>阶段</th><th>回购股数</th><th>金额</th></tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in repurchases.slice(0, 12)" :key="`${row.ann_date}-${row.proc}-${idx}`">
              <td>{{ row.ann_date }}</td>
              <td class="cell-name">{{ row.proc || '-' }}</td>
              <td>{{ fmtShares(row.vol) }}</td>
              <td>{{ fmtStatementAmount(row.amount) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="muted-block">暂无股票回购数据。</div>
    </article>
  </section>
</template>

<script setup>
import * as echarts from 'echarts'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { waitForChartDom } from '../../utils/chartDom'
import {
  holderTrendClass,
  fmtPct,
  fmtNullablePct,
  fmtShares,
  fmtSignedShares,
  top10ChangeLabel,
  top10RatioChangeText,
  inDeLabel,
  isFutureDate,
  fmtNullableNumber,
  fmtStatementAmount,
  pctClass,
  valueClass,
  toNumber,
} from '../../utils/workbenchFormat'

const props = defineProps({
  summary: { type: Object, default: () => ({}) },
  holderNumbers: { type: Array, default: () => [] },
  hkHold: { type: Array, default: () => [] },
  holderTrades: { type: Array, default: () => [] },
  shareFloats: { type: Array, default: () => [] },
  repurchases: { type: Array, default: () => [] },
  top10Change: { type: Object, default: () => ({}) },
  intlChanges: { type: Array, default: () => [] },
  hksc: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  symbol: { type: String, default: '' },
  /** Bumped by parent on each symbol load (including same-symbol reload). */
  resetKey: { type: [Number, String], default: 0 },
})

const holderNumberTableExpanded = ref(false)
const shareholderTradesExpanded = ref(false)
const shareFloatExpanded = ref(false)
const holderNumberChartRef = ref(null)
const hkHoldChartRef = ref(null)
let holderNumberChart = null
let hkHoldChart = null

function holderNumQoq(idx) {
  const curr = Number(props.holderNumbers[idx]?.holder_num)
  const prev = Number(props.holderNumbers[idx + 1]?.holder_num)
  if (!Number.isFinite(curr) || !Number.isFinite(prev) || prev === 0) return null
  return (curr - prev) / Math.abs(prev) * 100
}

function renderShareholderCharts() {
  return Promise.all([
    renderHolderNumberChart(),
    renderHkHoldChart(),
  ])
}

async function renderHolderNumberChart() {
  const rows = props.holderNumbers
    .slice(0, 12)
    .reverse()
    .map((row) => ({
      date: row.end_date,
      value: toNumber(row.holder_num),
    }))
    .filter((row) => row.date && row.value != null)
  if (!holderNumberChartRef.value || !rows.length) {
    if (holderNumberChart) {
      holderNumberChart.dispose()
      holderNumberChart = null
    }
    return
  }
  if (!holderNumberChart) {
    const ready = await waitForChartDom(holderNumberChartRef.value)
    if (!ready || !holderNumberChartRef.value) return
    holderNumberChart = echarts.init(holderNumberChartRef.value)
  }
  holderNumberChart.setOption({
    backgroundColor: 'transparent',
    grid: { left: 44, right: 18, top: 20, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      formatter: (items) => {
        const row = items?.[0]
        return row ? `${row.axisValue}<br/>股东户数：${Number(row.data).toLocaleString()}` : ''
      },
    },
    xAxis: {
      type: 'category',
      data: rows.map((row) => row.date),
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(148,163,184,.3)' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#94a3b8',
        formatter: (value) => {
          if (Math.abs(value) >= 10000) return `${Math.round(value / 10000)}万`
          return `${Math.round(value)}`
        },
      },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,.16)' } },
    },
    series: [{
      type: 'line',
      data: rows.map((row) => row.value),
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: '#60a5fa', width: 2 },
      itemStyle: { color: '#93c5fd' },
      areaStyle: { color: 'rgba(96,165,250,.14)' },
    }],
  })
  holderNumberChart.resize()
}

async function renderHkHoldChart() {
  const rows = props.hkHold
    .slice(0, 12)
    .reverse()
    .map((row) => ({
      date: row.trade_date,
      ratio: toNumber(row.ratio),
    }))
    .filter((row) => row.date && row.ratio != null)
  if (!hkHoldChartRef.value || !rows.length) {
    if (hkHoldChart) {
      hkHoldChart.dispose()
      hkHoldChart = null
    }
    return
  }
  if (!hkHoldChart) {
    const ready = await waitForChartDom(hkHoldChartRef.value)
    if (!ready || !hkHoldChartRef.value) return
    hkHoldChart = echarts.init(hkHoldChartRef.value)
  }
  hkHoldChart.setOption({
    backgroundColor: 'transparent',
    grid: { left: 42, right: 18, top: 20, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      formatter: (items) => {
        const row = items?.[0]
        return row ? `${row.axisValue}<br/>北向占比：${Number(row.data).toFixed(2)}%` : ''
      },
    },
    xAxis: {
      type: 'category',
      data: rows.map((row) => row.date),
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(148,163,184,.3)' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#94a3b8', formatter: (value) => `${value}%` },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,.16)' } },
    },
    series: [{
      type: 'line',
      data: rows.map((row) => row.ratio),
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: '#f97316', width: 2 },
      itemStyle: { color: '#fb923c' },
      areaStyle: { color: 'rgba(249,115,22,.13)' },
    }],
  })
  hkHoldChart.resize()
}

function disposeShareholderCharts() {
  holderNumberChart?.dispose()
  holderNumberChart = null
  hkHoldChart?.dispose()
  hkHoldChart = null
}

async function renderActiveShareholderCharts() {
  if (!props.active) return
  await nextTick()
  await renderShareholderCharts()
}

watch(
  [() => props.holderNumbers, () => props.hkHold, () => props.active],
  renderActiveShareholderCharts,
  { deep: true },
)

function resetExpandedSections() {
  holderNumberTableExpanded.value = false
  shareholderTradesExpanded.value = false
  shareFloatExpanded.value = false
}

watch(
  () => props.symbol,
  async () => {
    resetExpandedSections()
    disposeShareholderCharts()
    await renderActiveShareholderCharts()
  },
)

watch(
  () => props.resetKey,
  async () => {
    resetExpandedSections()
    disposeShareholderCharts()
    await renderActiveShareholderCharts()
  },
)

onMounted(renderActiveShareholderCharts)
onBeforeUnmount(disposeShareholderCharts)
</script>

<style scoped>
.quote-table td.cell-name {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shareholder-mini-chart {
  height: 180px;
  margin-bottom: 10px;
  width: 100%;
}
.shareholder-signal-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}
.shareholder-signal-grid article {
  background: rgba(15, 23, 42, .45);
  border: 1px solid rgba(148, 163, 184, .16);
  border-radius: 12px;
  padding: 12px;
}
.shareholder-signal-grid h4 {
  color: #e2e8f0;
  font-size: 14px;
  margin: 0 0 8px;
}
.shareholder-signal-grid p {
  color: #cbd5e1;
  margin: 6px 0;
}
.shareholder-signal-grid small {
  color: #94a3b8;
}
.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip-pill {
  background: rgba(96, 165, 250, .14);
  border: 1px solid rgba(96, 165, 250, .24);
  border-radius: 999px;
  color: #bfdbfe;
  font-size: 12px;
  padding: 5px 10px;
}
.badge-upcoming {
  background: rgba(248, 113, 113, .16);
  border-radius: 4px;
  color: #f87171;
  font-size: 11px;
  margin-left: 6px;
  padding: 1px 5px;
}
</style>
