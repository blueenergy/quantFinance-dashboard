<template>
  <v-container fluid class="regime-panel pa-4">
    <div class="regime-shell">
      <header class="regime-header">
        <div>
          <p class="regime-eyebrow">A股市场温度计</p>
          <h1>广度与估值扫描</h1>
          <p class="regime-sub">MCL · 兴登堡预兆 · 5年通胀调整 CAPE</p>
        </div>
        <div class="regime-actions">
          <button class="regime-refresh dark" :disabled="analysisTriggering || !latest" @click="triggerAnalysis">
            {{ analysisTriggering ? '分析中...' : 'AI 解读' }}
          </button>
          <button class="regime-refresh" :disabled="loading" @click="loadAll">刷新</button>
        </div>
      </header>

      <div v-if="loading" class="regime-empty">广度估值数据加载中...</div>
      <div v-else-if="error" class="regime-empty is-error">{{ error }}</div>
      <div v-else-if="!latest" class="regime-empty">暂无 A 股广度估值扫描数据</div>

      <template v-else>
        <section class="regime-summary" :class="`alert-${latest.composite_alert || 'low'}`">
          <div>
            <span class="summary-label">综合等级</span>
            <strong>{{ alertLabel(latest.composite_alert) }}</strong>
          </div>
          <div>
            <span class="summary-label">扫描日期</span>
            <strong>{{ latest.scan_date }}</strong>
          </div>
          <div>
            <span class="summary-label">生成时间</span>
            <strong>{{ latest.generated_at || '-' }}</strong>
          </div>
        </section>

        <section class="ai-section">
          <div class="section-head">
            <div>
              <div class="section-title">AI 解读</div>
              <p class="section-caption">按需生成，把 MCL、兴登堡和 CAPE 翻译成普通用户可读结论。</p>
            </div>
            <span v-if="analysisDoc?.analysis_date" class="section-caption">{{ analysisDoc.analysis_date }}</span>
          </div>
          <div v-if="analysisLoading" class="ai-empty">AI 解读加载中...</div>
          <div v-else-if="!analysisDoc" class="ai-empty">
            暂无 AI 解读，点击右上角“AI 解读”生成本次扫描说明。
          </div>
          <template v-else>
            <div class="ai-headline">
              <strong>{{ analysisDoc.analysis?.headline || '市场状态解读' }}</strong>
              <span>{{ analysisDoc.analysis?.risk_tone || alertLabel(latest.composite_alert) }}</span>
            </div>
            <p class="ai-summary">{{ analysisDoc.analysis?.plain_summary || '-' }}</p>
            <div class="ai-grid">
              <div class="ai-card">
                <div class="ai-card-title">广度/MCL</div>
                <p>{{ analysisDoc.analysis?.breadth_reading || '-' }}</p>
              </div>
              <div class="ai-card">
                <div class="ai-card-title">兴登堡</div>
                <p>{{ analysisDoc.analysis?.hindenburg_reading || '-' }}</p>
              </div>
              <div class="ai-card">
                <div class="ai-card-title">估值/CAPE</div>
                <p>{{ analysisDoc.analysis?.valuation_reading || '-' }}</p>
              </div>
            </div>
            <div class="ai-bottom">
              <div>
                <div class="ai-card-title">观察清单</div>
                <ul>
                  <li v-for="item in analysisDoc.analysis?.what_to_watch || []" :key="item">{{ item }}</li>
                </ul>
              </div>
              <div>
                <div class="ai-card-title">组合提示</div>
                <p>{{ analysisDoc.analysis?.portfolio_hint || '-' }}</p>
              </div>
            </div>
          </template>
        </section>

        <section class="regime-grid">
          <article class="metric-panel">
            <div class="panel-title">MCL 广度</div>
            <div class="metric-main">{{ formatNumber(mcl?.mcl) }}</div>
            <div class="metric-row"><span>RANA</span><b>{{ formatNumber(mcl?.net_advance_ratio) }}</b></div>
            <div class="metric-row"><span>分位</span><b>{{ formatPercent(mcl?.pct_rank_to_date) }}</b></div>
            <div class="metric-row"><span>涨 / 跌 / 平</span><b>{{ mcl?.advances ?? '-' }} / {{ mcl?.declines ?? '-' }} / {{ mcl?.unchanged ?? '-' }}</b></div>
          </article>

          <article class="metric-panel">
            <div class="panel-title">兴登堡预兆</div>
            <div class="metric-main">{{ hindenburgLabel(hindenburg?.alert_level) }}</div>
            <div class="metric-row"><span>30日触发</span><b>{{ hindenburg?.cluster_count_30d ?? 0 }} 次</b></div>
            <div class="metric-row"><span>新高 / 新低</span><b>{{ hindenburg?.new_high_count ?? '-' }} / {{ hindenburg?.new_low_count ?? '-' }}</b></div>
            <div class="condition-row">
              <span :class="conditionClass(hindenburg?.cond_uptrend)">趋势</span>
              <span :class="conditionClass(hindenburg?.cond_high_low)">高低</span>
              <span :class="conditionClass(hindenburg?.cond_ratio)">比例</span>
              <span :class="conditionClass(hindenburg?.cond_mcl_negative)">MCL</span>
            </div>
          </article>
        </section>

        <section class="mcl-chart-section">
          <div class="section-head">
            <div>
              <div class="section-title">MCL 走势</div>
              <p class="section-caption">McClellan 广度震荡指标与 9 日均线，零轴上方=广度修复，下方=广度走弱。</p>
            </div>
          </div>
          <div v-if="!mclSeries.dates.length" class="ai-empty">暂无 MCL 历史数据。</div>
          <div v-else ref="mclChartRef" class="mcl-chart"></div>
        </section>

        <section class="cape-section">
          <div class="section-title">CAPE 估值分位</div>
          <div class="cape-grid">
            <article v-for="item in capeSignals" :key="item.index_code" class="cape-card">
              <div class="cape-top">
                <strong>{{ item.index_name || item.index_code }}</strong>
                <span :class="`band-${item.valuation_band || 'fair'}`">{{ bandLabel(item.valuation_band) }}</span>
              </div>
              <div class="cape-value">{{ formatNumber(item.cape) }}</div>
              <div class="cape-meta">分位 {{ formatPercent(item.pct_rank_to_date) }} · PE {{ formatNumber(item.pe_ttm) }}</div>
              <div v-if="item.pe_source_date && item.pe_source_date !== item.trade_date" class="cape-meta warn">估值取自 {{ item.pe_source_date }}</div>
            </article>
          </div>
        </section>

        <section v-if="latest.warnings?.length" class="warning-panel">
          <div class="section-title">告警事项</div>
          <ul>
            <li v-for="warning in latest.warnings" :key="warning">{{ warning }}</li>
          </ul>
        </section>

        <section v-if="regimeTimeline.length" class="history-section">
          <div class="section-head">
            <div>
              <div class="section-title">风险时间轴</div>
              <p class="section-caption">近 {{ regimeTimeline.length }} 个交易日的综合风险等级走势，越靠右越新。</p>
            </div>
          </div>

          <div class="risk-summary">
            <div class="risk-summary-cell">
              <span class="summary-label">近 {{ regimeTimeline.length }} 日高风险天数</span>
              <strong>{{ riskSummary.highRiskDays }} 天</strong>
            </div>
            <div class="risk-summary-cell">
              <span class="summary-label">当前连续预警天数</span>
              <strong>{{ riskSummary.warningStreak }} 天</strong>
            </div>
            <div class="risk-summary-cell">
              <span class="summary-label">区间 Warning 总数</span>
              <strong>{{ riskSummary.warningTotal }} 条</strong>
            </div>
          </div>

          <div class="timeline-track">
            <span
              v-for="(cell, idx) in regimeTimeline"
              :key="cell.date"
              class="timeline-cell"
              :class="[`tl-${cell.alert}`, { 'is-latest': idx === regimeTimeline.length - 1 }]"
              :title="`${cell.date} · ${cell.alertLabel} · ${cell.warningCount} 条预警`"
            ></span>
          </div>
          <div class="timeline-legend">
            <span><i class="tl-dot tl-low"></i>低</span>
            <span><i class="tl-dot tl-medium"></i>中</span>
            <span><i class="tl-dot tl-high"></i>高</span>
            <span><i class="tl-dot tl-extreme"></i>极高</span>
          </div>

          <div class="event-head">
            <div class="section-title">关键预警事件流</div>
            <p class="section-caption">仅记录等级变化与新增预警，最新在上。</p>
          </div>
          <div v-if="warningEvents.length" class="event-feed">
            <div v-for="event in warningEvents" :key="event.id" class="event-item">
              <i class="event-dot" :class="`ev-${event.type}`"></i>
              <div class="event-body">
                <div class="event-meta">
                  <span class="event-date">{{ event.date }}</span>
                  <span class="event-tag" :class="`ev-${event.type}`">{{ event.tagLabel }}</span>
                </div>
                <p class="event-text">{{ event.text }}</p>
              </div>
            </div>
          </div>
          <div v-else class="ai-empty">近 {{ regimeTimeline.length }} 日无等级变化与新增预警。</div>
        </section>
      </template>
    </div>
  </v-container>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  getMarketRegimeAnalysisLatest,
  getMarketRegimeHistory,
  getMarketRegimeLatest,
  triggerMarketRegimeAnalysis,
} from '../api/marketRegime.js'

const latest = ref(null)
const historyRows = ref([])
const loading = ref(false)
const analysisLoading = ref(false)
const analysisTriggering = ref(false)
const analysisDoc = ref(null)
const error = ref('')
const mclChartRef = ref(null)

const mcl = computed(() => latest.value?.signals?.mcl || null)
const hindenburg = computed(() => latest.value?.signals?.hindenburg || null)
const capeSignals = computed(() => latest.value?.signals?.cape || [])

// 时间轴与事件流只关注最近 30 个交易日；MCL 曲线用完整窗口。
const recentRows = computed(() => (historyRows.value || []).slice(-30))

const regimeTimeline = computed(() =>
  recentRows.value.map((row) => ({
    date: row.scan_date,
    alert: row.composite_alert || 'low',
    alertLabel: alertLabel(row.composite_alert),
    warningCount: row.warnings?.length || 0,
  })),
)

const riskSummary = computed(() => {
  const rows = regimeTimeline.value
  const highRiskDays = rows.filter((r) => r.alert === 'high' || r.alert === 'extreme').length
  const warningTotal = rows.reduce((sum, r) => sum + r.warningCount, 0)
  let warningStreak = 0
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i].warningCount > 0) warningStreak += 1
    else break
  }
  return { highRiskDays, warningTotal, warningStreak }
})

const ALERT_RANK = { low: 0, medium: 1, high: 2, extreme: 3 }

const warningEvents = computed(() => {
  const rows = recentRows.value
  const events = []
  const allRows = historyRows.value || []
  const firstRecentIndex = Math.max(0, allRows.length - rows.length)
  const baseline = firstRecentIndex > 0 ? allRows[firstRecentIndex - 1] : null
  let prevAlert = baseline?.composite_alert || null
  let prevWarnings = baseline?.warnings || []
  rows.forEach((row) => {
    const alert = row.composite_alert || 'low'
    const warnings = row.warnings || []
    if (prevAlert !== null && ALERT_RANK[alert] !== ALERT_RANK[prevAlert]) {
      const escalate = ALERT_RANK[alert] > ALERT_RANK[prevAlert]
      events.push({
        id: `${row.scan_date}-level`,
        date: row.scan_date,
        type: escalate ? 'escalate' : 'deescalate',
        tagLabel: escalate ? '风险升级' : '风险缓解',
        text: `综合风险由「${alertLabel(prevAlert)}」变为「${alertLabel(alert)}」`,
      })
    }
    const fresh = warnings.filter((w) => !prevWarnings.includes(w))
    fresh.forEach((text, idx) => {
      events.push({
        id: `${row.scan_date}-w${idx}`,
        date: row.scan_date,
        type: 'warning',
        tagLabel: '新增预警',
        text,
      })
    })
    prevAlert = alert
    prevWarnings = warnings
  })
  return events.reverse()
})

const mclSeries = computed(() => {
  const rows = historyRows.value || []
  const dates = []
  const mclVals = []
  const maVals = []
  rows.forEach((row) => {
    const sig = row.signals?.mcl
    if (!sig || sig.mcl === null || sig.mcl === undefined) return
    dates.push(String(row.scan_date).replace(/(\d{4})(\d{2})(\d{2})/, '$2-$3'))
    mclVals.push(Number(sig.mcl))
    maVals.push(sig.mcl_ma9 === null || sig.mcl_ma9 === undefined ? null : Number(sig.mcl_ma9))
  })
  return { dates, mclVals, maVals }
})

let mclChart = null
let resizeObs = null

function renderMclChart() {
  const series = mclSeries.value
  if (!mclChartRef.value || !series.dates.length) return
  if (!mclChartRef.value.clientWidth) return
  import('echarts').then((echarts) => {
    if (!mclChart) {
      mclChart = echarts.init(mclChartRef.value, null, { renderer: 'canvas' })
      if (window.ResizeObserver) {
        resizeObs = new ResizeObserver(() => mclChart && mclChart.resize())
        resizeObs.observe(mclChartRef.value)
      }
    }
    mclChart.setOption({
      grid: { top: 24, left: 48, right: 16, bottom: 28 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: '#d9e1ee',
        textStyle: { color: '#172033', fontSize: 12 },
      },
      legend: { data: ['MCL', 'MA9'], right: 8, top: 0, textStyle: { color: '#667085', fontSize: 12 } },
      xAxis: {
        type: 'category',
        data: series.dates,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#c8d2e2' } },
        axisLabel: { color: '#667085', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: '#667085', fontSize: 11 },
        splitLine: { lineStyle: { color: '#edf1f7' } },
      },
      series: [
        {
          name: 'MCL',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: series.mclVals,
          lineStyle: { width: 2, color: '#2563eb' },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(37,99,235,0.18)' },
                { offset: 1, color: 'rgba(37,99,235,0.01)' },
              ],
            },
          },
          markLine: {
            symbol: 'none',
            silent: true,
            lineStyle: { color: '#b42318', type: 'dashed', width: 1 },
            data: [{ yAxis: 0, label: { formatter: '零轴', color: '#b42318', fontSize: 11 } }],
          },
        },
        {
          name: 'MA9',
          type: 'line',
          smooth: true,
          showSymbol: false,
          connectNulls: true,
          data: series.maVals,
          lineStyle: { width: 1.5, color: '#d9921f', type: 'dashed' },
        },
      ],
    })
    mclChart.resize()
  })
}

watch(mclSeries, () => nextTick(renderMclChart))

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return Number(value).toFixed(2)
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return `${Number(value).toFixed(1)}%`
}

function alertLabel(level) {
  return ({ low: '低', medium: '中', high: '高', extreme: '极高' })[level] || '未知'
}

function hindenburgLabel(level) {
  return ({ none: '未触发', single: '单次', cluster: '集群' })[level] || '未触发'
}

function bandLabel(band) {
  return ({ cheap: '便宜', fair: '合理', rich: '偏贵', bubble: '泡沫' })[band] || '合理'
}

function conditionClass(value) {
  return ['condition-pill', value ? 'pass' : 'mute']
}

async function loadAll() {
  loading.value = true
  analysisLoading.value = true
  error.value = ''
  try {
    const [latestData, historyData, analysisData] = await Promise.all([
      getMarketRegimeLatest(),
      getMarketRegimeHistory(300),
      getMarketRegimeAnalysisLatest(),
    ])
    latest.value = latestData
    historyRows.value = historyData?.data || []
    analysisDoc.value = analysisData
  } catch (err) {
    error.value = err?.message || '广度估值数据加载失败'
  } finally {
    loading.value = false
    analysisLoading.value = false
    await nextTick()
    renderMclChart()
  }
}

async function triggerAnalysis() {
  if (!latest.value?.scan_date) return
  analysisTriggering.value = true
  error.value = ''
  try {
    await triggerMarketRegimeAnalysis(latest.value.scan_date)
    error.value = 'AI 解读任务已提交，稍后点击刷新查看结果。'
  } catch (err) {
    error.value = err?.message || 'AI 解读任务提交失败'
  } finally {
    analysisTriggering.value = false
  }
}

onMounted(loadAll)

onBeforeUnmount(() => {
  if (resizeObs) {
    resizeObs.disconnect()
    resizeObs = null
  }
  if (mclChart) {
    mclChart.dispose()
    mclChart = null
  }
})
</script>

<style scoped>
.regime-panel { background: #f5f7fb; min-height: 100%; }
.regime-shell { max-width: 1280px; margin: 0 auto; }
.regime-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 18px; }
.regime-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.regime-eyebrow { margin: 0 0 6px; color: #607089; font-size: 13px; font-weight: 700; }
.regime-header h1 { margin: 0; color: #172033; font-size: 30px; letter-spacing: 0; }
.regime-sub { margin: 8px 0 0; color: #667085; }
.regime-refresh { border: 1px solid #c8d2e2; background: #ffffff; color: #24324a; border-radius: 8px; padding: 9px 16px; font-weight: 700; }
.regime-refresh.dark { background: #25324a; color: #ffffff; border-color: #25324a; }
.regime-refresh:disabled { opacity: .55; cursor: not-allowed; }
.regime-empty { background: #ffffff; border: 1px solid #d9e1ee; border-radius: 8px; padding: 28px; color: #667085; text-align: center; }
.regime-empty.is-error { color: #b42318; border-color: #f3b8b0; }
.regime-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; border-radius: 8px; padding: 18px; margin-bottom: 14px; border: 1px solid #d8e0ea; background: #ffffff; }
.summary-label { display: block; color: #68758b; font-size: 12px; margin-bottom: 6px; }
.regime-summary strong { color: #172033; font-size: 22px; }
.alert-medium { border-left: 5px solid #d9921f; }
.alert-high { border-left: 5px solid #c2410c; }
.alert-extreme { border-left: 5px solid #b42318; }
.regime-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-bottom: 14px; }
.metric-panel, .cape-section, .warning-panel, .history-section, .ai-section { background: #ffffff; border: 1px solid #d9e1ee; border-radius: 8px; padding: 16px; }
.mcl-chart-section { background: #ffffff; border: 1px solid #d9e1ee; border-radius: 8px; padding: 16px; margin-bottom: 14px; }
.mcl-chart { width: 100%; height: 280px; }
.panel-title, .section-title { color: #25324a; font-weight: 800; margin-bottom: 12px; }
.section-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.section-caption { margin: 0; color: #667085; font-size: 13px; }
.ai-section { margin-bottom: 14px; }
.ai-empty { background: #f7f9fc; border: 1px dashed #d9e1ee; border-radius: 8px; padding: 14px; color: #667085; }
.ai-headline { display: flex; justify-content: space-between; gap: 12px; align-items: center; background: #f7f9fc; border-radius: 8px; padding: 12px 14px; color: #172033; }
.ai-headline strong { font-size: 18px; }
.ai-headline span { border-radius: 999px; padding: 4px 9px; background: #eef2f7; color: #475467; font-size: 12px; font-weight: 800; }
.ai-summary { color: #344054; line-height: 1.7; margin: 12px 0; }
.ai-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.ai-card { border: 1px solid #edf1f7; border-radius: 8px; padding: 12px; background: #fbfcfe; }
.ai-card-title { color: #25324a; font-weight: 800; margin-bottom: 6px; }
.ai-card p, .ai-bottom p { color: #344054; line-height: 1.65; margin: 0; }
.ai-bottom { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: 12px; border-top: 1px solid #edf1f7; margin-top: 12px; padding-top: 12px; }
.ai-bottom ul { margin: 0; padding-left: 18px; color: #344054; }
.metric-main { font-size: 34px; font-weight: 800; color: #172033; margin-bottom: 10px; }
.metric-row { display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid #edf1f7; padding: 8px 0; color: #667085; }
.metric-row b { color: #25324a; }
.condition-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.condition-pill { border-radius: 999px; padding: 5px 9px; font-size: 12px; border: 1px solid #d9e1ee; }
.condition-pill.pass { background: #e7f6ec; color: #137333; border-color: #b7e2c4; }
.condition-pill.mute { background: #f3f5f8; color: #667085; }
.cape-section { margin-bottom: 14px; }
.cape-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.cape-card { border: 1px solid #e3e9f2; border-radius: 8px; padding: 14px; background: #fbfcfe; }
.cape-top { display: flex; justify-content: space-between; gap: 10px; color: #25324a; }
.cape-top span { border-radius: 999px; padding: 3px 8px; font-size: 12px; }
.band-cheap { background: #e6f4ea; color: #137333; }
.band-fair { background: #eef2f7; color: #475467; }
.band-rich { background: #fff4e5; color: #b55a00; }
.band-bubble { background: #fee4e2; color: #b42318; }
.cape-value { margin-top: 14px; font-size: 28px; font-weight: 800; color: #172033; }
.cape-meta { color: #667085; margin-top: 5px; font-size: 13px; }
.cape-meta.warn { color: #b55a00; }
.warning-panel { margin-bottom: 14px; }
.warning-panel ul { margin: 0; padding-left: 18px; color: #344054; }
.warning-panel li + li { margin-top: 6px; }
.risk-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.risk-summary-cell { border: 1px solid #edf1f7; border-radius: 8px; padding: 12px; background: #fbfcfe; }
.risk-summary-cell strong { display: block; margin-top: 4px; color: #172033; font-size: 22px; }
.timeline-track { display: flex; gap: 3px; flex-wrap: wrap; padding: 4px 0; }
.timeline-cell { flex: 1 1 10px; min-width: 10px; height: 26px; border-radius: 3px; background: #e6f4ea; cursor: default; }
.timeline-cell.tl-low { background: #cdeed6; }
.timeline-cell.tl-medium { background: #f6d98c; }
.timeline-cell.tl-high { background: #f0a868; }
.timeline-cell.tl-extreme { background: #e88a82; }
.timeline-cell.is-latest { outline: 2px solid #25324a; outline-offset: 1px; }
.timeline-legend { display: flex; gap: 16px; margin-top: 8px; color: #667085; font-size: 12px; }
.timeline-legend span { display: inline-flex; align-items: center; gap: 5px; }
.tl-dot { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
.tl-dot.tl-low { background: #cdeed6; }
.tl-dot.tl-medium { background: #f6d98c; }
.tl-dot.tl-high { background: #f0a868; }
.tl-dot.tl-extreme { background: #e88a82; }
.event-head { margin-top: 16px; padding-top: 14px; border-top: 1px solid #edf1f7; }
.event-feed { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
.event-item { display: flex; gap: 10px; }
.event-dot { width: 10px; height: 10px; border-radius: 999px; margin-top: 5px; flex-shrink: 0; background: #98a2b3; }
.event-dot.ev-escalate { background: #c2410c; }
.event-dot.ev-deescalate { background: #137333; }
.event-dot.ev-warning { background: #d9921f; }
.event-body { flex: 1; }
.event-meta { display: flex; gap: 8px; align-items: center; }
.event-date { color: #25324a; font-weight: 700; font-size: 13px; }
.event-tag { border-radius: 999px; padding: 2px 8px; font-size: 11px; font-weight: 800; background: #eef2f7; color: #475467; }
.event-tag.ev-escalate { background: #fde7da; color: #c2410c; }
.event-tag.ev-deescalate { background: #e7f6ec; color: #137333; }
.event-tag.ev-warning { background: #fcefcf; color: #b55a00; }
.event-text { margin: 3px 0 0; color: #344054; line-height: 1.6; }
@media (max-width: 840px) {
  .regime-header { flex-direction: column; }
  .regime-summary, .regime-grid, .cape-grid, .risk-summary { grid-template-columns: 1fr; }
}
</style>