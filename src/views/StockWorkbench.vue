<template>
  <div class="stock-workbench">
    <section class="workbench-search">
      <div>
        <p class="eyebrow">Stock Workbench</p>
        <h2>股票研究工作台</h2>
        <p>以单只股票为中心，集中查看量化评分、财务快照和 AI 深度分析。</p>
      </div>
      <div class="stock-input-panel">
        <div class="stock-code-row">
          <v-text-field
            v-model="directSymbol"
            clearable
            hide-details
            label="输入股票代码"
            placeholder="例如 600519、000858、600519.SH"
            variant="outlined"
            density="comfortable"
            class="stock-code-input"
            @keyup.enter="submitDirectSymbol"
          />
          <v-btn
            color="primary"
            size="large"
            :loading="loading"
            @click="submitDirectSymbol"
          >
            加载工作台
          </v-btn>
        </div>
        <v-autocomplete
          v-model="selectedSearchItem"
          v-model:search="searchText"
          :items="searchResults"
          :loading="searching"
          :item-title="stockItemTitle"
          item-value="symbol"
          return-object
          clearable
          hide-details
          label="也可以按名称搜索"
          variant="outlined"
          density="comfortable"
          class="stock-search-box"
          @update:model-value="onSearchSelected"
          @keyup.enter="loadSymbol(searchText)"
        />
        <div class="quick-symbols">
          <span>快速示例</span>
          <button type="button" @click="loadSymbol('600519.SH')">600519.SH</button>
          <button type="button" @click="loadSymbol('000858.SZ')">000858.SZ</button>
          <button type="button" @click="loadSymbol('000001.SZ')">000001.SZ</button>
        </div>
      </div>
    </section>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      class="mb-4"
    >
      {{ error }}
    </v-alert>

    <section v-if="!payload && !loading" class="empty-state">
      <h3>选择一只股票开始研究</h3>
      <p>例如输入 600519、000858 或股票名称，工作台会自动聚合评分、财务与深度分析结果。</p>
    </section>

    <template v-if="payload">
      <section class="hero-card">
        <div class="hero-main">
          <p class="eyebrow">{{ stockIndustry || '行业未覆盖' }}</p>
          <h1>{{ stockName || payload.symbol }} <span>{{ stockSymbol }}</span></h1>
          <div class="hero-tags">
            <span v-if="stockIndustryL2">{{ stockIndustryL2 }}</span>
            <span v-if="stockIndustryL3">{{ stockIndustryL3 }}</span>
            <span v-for="code in indexCodes" :key="code">{{ code }}</span>
          </div>
        </div>
        <div class="hero-metrics">
          <div>
            <small>最新价</small>
            <strong>{{ fmtNumber(latestPrice) }}</strong>
            <span :class="changeClass">{{ fmtPct(latestPctChange) }}</span>
          </div>
          <div>
            <small>综合评分</small>
            <strong>{{ fmtNumber(currentCompositeScore) }}</strong>
            <span>{{ ratingText }}</span>
          </div>
          <div>
            <small>评分日</small>
            <strong>{{ dataStatus.score_date || '-' }}</strong>
            <span>{{ dataStatus.quote_date || '行情未覆盖' }}</span>
          </div>
        </div>
      </section>

      <v-tabs v-model="activePanel" class="workbench-tabs" color="primary">
        <v-tab value="overview">总览</v-tab>
        <v-tab value="scores">量化评分</v-tab>
        <v-tab value="financial">财务快照</v-tab>
        <v-tab value="analysis">深度分析</v-tab>
      </v-tabs>

      <v-window v-model="activePanel">
        <v-window-item value="overview">
          <section class="panel-grid panel-grid--overview">
            <article class="workbench-card">
              <div class="card-title-row">
                <h3>评分雷达</h3>
                <v-select
                  v-model="selectedStrategy"
                  :items="strategyOptions"
                  label="策略"
                  density="compact"
                  variant="outlined"
                  hide-details
                  class="strategy-select"
                />
              </div>
              <div ref="radarRef" class="score-radar"></div>
            </article>

            <article class="workbench-card">
              <h3>AI 研究摘要</h3>
              <div v-if="deepAnalysis" class="analysis-summary">
                <p class="summary-line">{{ analysisSummary }}</p>
                <div class="summary-meta">
                  <span>模式：{{ deepAnalysis.analysis_mode || 'classic' }}</span>
                  <span>时间：{{ deepAnalysis.created_at || '-' }}</span>
                </div>
                <ul v-if="analysisPoints.length">
                  <li v-for="(point, idx) in analysisPoints" :key="idx">{{ point }}</li>
                </ul>
              </div>
              <div v-else class="muted-block">暂无该股票的 AI 深度分析记录。</div>
            </article>

            <article class="workbench-card">
              <h3>核心状态</h3>
              <div class="status-grid">
                <div v-for="item in statusItems" :key="item.label">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
            </article>
          </section>
        </v-window-item>

        <v-window-item value="scores">
          <section class="workbench-card">
            <div class="card-title-row">
              <h3>量化评分详情</h3>
              <span class="muted">来自最新 `stock_scores` 文档</span>
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
          </section>
        </v-window-item>

        <v-window-item value="financial">
          <section class="panel-grid">
            <article class="workbench-card">
              <div class="card-title-row">
                <h3>财务成长图</h3>
                <span class="muted">最近 {{ financialChartData.length }} 期</span>
              </div>
              <GrowthChart v-if="financialChartData.length" :series="financialChartData" />
              <div v-else class="muted-block">暂无足够财务数据。</div>
            </article>
            <article class="workbench-card">
              <h3>核心财务指标</h3>
              <div class="financial-metrics">
                <div v-for="metric in financialMetrics" :key="metric.label">
                  <span>{{ metric.label }}</span>
                  <strong>{{ metric.value }}</strong>
                </div>
              </div>
            </article>
          </section>
        </v-window-item>

        <v-window-item value="analysis">
          <section class="workbench-card">
            <div class="card-title-row">
              <h3>深度分析</h3>
              <span class="muted">{{ deepAnalysis?.created_at || '暂无分析时间' }}</span>
            </div>
            <AnalysisDetailContent
              v-if="deepAnalysis?.analysis"
              :analysis="deepAnalysis.analysis"
              :analysis-mode="deepAnalysis.analysis_mode || 'classic'"
              layout="stacked"
              mode="stock"
              show-mode
            />
            <div v-else class="muted-block">暂无深度分析，可先在「个股深度分析」模块发起分析任务。</div>
          </section>
        </v-window-item>
      </v-window>
    </template>

    <v-overlay :model-value="loading" class="align-center justify-center" persistent>
      <v-progress-circular indeterminate size="48" />
    </v-overlay>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { getStockFinancial, getStockWorkbench, searchStocks } from '../api/stock'
import AnalysisDetailContent from '../components/AnalysisDetailContent.vue'
import GrowthChart from '../components/GrowthChart.vue'

const SCORE_DEFS = [
  { key: 'technical', label: '技术面' },
  { key: 'fundamental', label: '基本面' },
  { key: 'value', label: '价值' },
  { key: 'growth', label: '成长' },
  { key: 'money_flow', label: '资金流' },
  { key: 'cycle', label: '周期' },
  { key: 'sentiment', label: '情绪' },
]

const loading = ref(false)
const searching = ref(false)
const error = ref('')
const payload = ref(null)
const activePanel = ref('overview')
const directSymbol = ref('')
const searchText = ref('')
const searchResults = ref([])
const selectedSearchItem = ref(null)
const selectedStrategy = ref('balanced')
const incomeRows = ref([])
const indicatorRows = ref([])
const radarRef = ref(null)
let radarChart = null
let searchTimer = null

const score = computed(() => payload.value?.score || {})
const stock = computed(() => payload.value?.stock || {})
const quote = computed(() => payload.value?.quote || {})
const deepAnalysis = computed(() => payload.value?.deep_analysis || null)
const dataStatus = computed(() => payload.value?.data_status || {})

const stockSymbol = computed(() => stock.value.symbol || payload.value?.symbol || '-')
const stockName = computed(() => stock.value.name || stock.value.stock_name || '')
const shenwan = computed(() => stock.value.shenwan_industry || {})
const stockIndustry = computed(() => shenwan.value.l1_name || stock.value.industry || '')
const stockIndustryL2 = computed(() => shenwan.value.l2_name || '')
const stockIndustryL3 = computed(() => shenwan.value.l3_name || '')
const indexCodes = computed(() => Array.isArray(score.value.index_codes) ? score.value.index_codes : [])

const latestPrice = computed(() => quote.value.close ?? quote.value.price ?? quote.value.latest_price)
const latestPctChange = computed(() => quote.value.pct_chg ?? quote.value.pct_change ?? quote.value.change_pct)
const changeClass = computed(() => {
  const n = Number(latestPctChange.value)
  return n > 0 ? 'is-up' : n < 0 ? 'is-down' : ''
})

const compositeScore = computed(() => score.value.composite_score || {})
const strategyOptions = computed(() => {
  if (compositeScore.value && typeof compositeScore.value === 'object') {
    return Object.keys(compositeScore.value)
  }
  return ['balanced']
})
const currentCompositeScore = computed(() => {
  if (compositeScore.value && typeof compositeScore.value === 'object') {
    return compositeScore.value[selectedStrategy.value] ?? compositeScore.value.balanced
  }
  return compositeScore.value
})
const ratingText = computed(() => {
  const n = Number(currentCompositeScore.value)
  if (n >= 80) return '强烈关注'
  if (n >= 70) return '推荐关注'
  if (n >= 60) return '谨慎观察'
  if (n >= 50) return '暂不推荐'
  return Number.isFinite(n) ? '回避' : '-'
})

const scoreItems = computed(() => {
  const details = score.value.details || {}
  return SCORE_DEFS.map((def) => ({
    ...def,
    score: score.value[`${def.key}_score`],
    details: details[`${def.key}_details`] || score.value[`${def.key}_details`] || {},
  })).filter((item) => item.score != null || Object.keys(item.details || {}).length > 0)
})

const statusItems = computed(() => [
  { label: '行情', value: dataStatus.value.quote_found ? '已覆盖' : '未覆盖' },
  { label: '评分', value: dataStatus.value.score_found ? '已覆盖' : '未覆盖' },
  { label: 'AI分析', value: dataStatus.value.deep_analysis_found ? '已覆盖' : '未覆盖' },
  { label: '当前策略', value: selectedStrategy.value },
])

const analysisObj = computed(() => deepAnalysis.value?.analysis || {})
const analysisSummary = computed(() => {
  const a = analysisObj.value
  return a.final_conclusion
    || a.investment_advice
    || a.long_term_forecast
    || a.mid_term_forecast
    || '暂无结构化摘要。'
})
const analysisPoints = computed(() => {
  const a = analysisObj.value
  const points = a.key_points || a.consensus_points || a.risk_factors || []
  if (Array.isArray(points)) return points.slice(0, 5)
  if (typeof points === 'string') return [points]
  return []
})

const financialChartData = computed(() => {
  const incomeByPeriod = new Map()
  for (const row of incomeRows.value) {
    const period = row.end_date || row.period || row.report_date
    if (period) incomeByPeriod.set(period, row)
  }
  const rows = indicatorRows.value.map((indicator) => {
    const period = indicator.end_date || indicator.period || indicator.report_date
    const income = incomeByPeriod.get(period) || {}
    return {
      period,
      revenue: toNumber(income.revenue || income.total_revenue || indicator.revenue),
      net_profit: toNumber(income.n_income_attr_p || income.net_profit || indicator.net_profit),
      revenue_yoy: toNumber(indicator.tr_yoy || indicator.or_yoy || indicator.revenue_yoy),
      netprofit_yoy: toNumber(indicator.netprofit_yoy || indicator.profit_to_gr),
      dt_netprofit_yoy: toNumber(indicator.dt_netprofit_yoy),
      gross_margin: toNumber(indicator.grossprofit_margin),
      roe: toNumber(indicator.roe || indicator.roe_dt),
    }
  }).filter((row) => row.period)
  return rows.reverse()
})

const financialMetrics = computed(() => {
  const latest = indicatorRows.value[0] || {}
  return [
    { label: 'ROE', value: fmtNumber(latest.roe || latest.roe_dt, 2, '%') },
    { label: '毛利率', value: fmtNumber(latest.grossprofit_margin, 2, '%') },
    { label: '净利同比', value: fmtNumber(latest.netprofit_yoy || latest.profit_to_gr, 2, '%') },
    { label: '营收同比', value: fmtNumber(latest.tr_yoy || latest.or_yoy, 2, '%') },
    { label: 'PE TTM', value: fmtNumber((indicatorRows.value[0] || {}).pe_ttm || quote.value.pe_ttm) },
    { label: 'PB', value: fmtNumber((indicatorRows.value[0] || {}).pb || quote.value.pb) },
  ]
})

watch(searchText, (val) => {
  clearTimeout(searchTimer)
  if (!val || val.length < 2) {
    searchResults.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      searchResults.value = await searchStocks(val)
    } catch (e) {
      console.warn('search stocks failed', e)
    } finally {
      searching.value = false
    }
  }, 250)
})

watch([scoreItems, activePanel], async () => {
  if (activePanel.value !== 'overview') return
  await nextTick()
  renderRadar()
}, { deep: true })

function stockItemTitle(item) {
  if (!item) return ''
  const symbol = item.symbol || item.ts_code || ''
  return `${symbol} ${item.name || item.stock_name || ''}`.trim()
}

function onSearchSelected(item) {
  if (!item) return
  const symbol = item.symbol || item.ts_code
  if (symbol) loadSymbol(symbol)
}

function submitDirectSymbol() {
  loadSymbol(directSymbol.value)
}

async function loadSymbol(symbol) {
  const clean = String(symbol || '').trim()
  if (!clean) return
  directSymbol.value = clean
  loading.value = true
  error.value = ''
  try {
    const [workbench, income, indicator] = await Promise.all([
      getStockWorkbench(clean),
      getStockFinancial(clean, 'income', 8).catch(() => []),
      getStockFinancial(clean, 'indicator', 8).catch(() => []),
    ])
    payload.value = workbench
    incomeRows.value = Array.isArray(income) ? income : []
    indicatorRows.value = Array.isArray(indicator) ? indicator : []
    selectedStrategy.value = Object.keys(workbench?.score?.composite_score || {})[0] || 'balanced'
    await nextTick()
    renderRadar()
  } catch (e) {
    error.value = e?.message || '股票工作台数据加载失败'
  } finally {
    loading.value = false
  }
}

function renderRadar() {
  if (!radarRef.value || !scoreItems.value.length) return
  if (!radarChart) radarChart = echarts.init(radarRef.value)
  const items = scoreItems.value.filter((item) => item.score != null)
  radarChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    radar: {
      indicator: items.map((item) => ({ name: item.label, max: 100 })),
      radius: '62%',
      splitLine: { lineStyle: { color: 'rgba(148,163,184,.35)' } },
      splitArea: { areaStyle: { color: ['rgba(15,23,42,.25)', 'rgba(30,41,59,.35)'] } },
      axisName: { color: '#cbd5e1' },
      axisLine: { lineStyle: { color: 'rgba(148,163,184,.35)' } },
    },
    series: [{
      type: 'radar',
      data: [{
        name: '评分',
        value: items.map((item) => Number(item.score || 0)),
        areaStyle: { color: 'rgba(96,165,250,.25)' },
        lineStyle: { color: '#60a5fa', width: 2 },
        itemStyle: { color: '#93c5fd' },
      }],
    }],
  })
  radarChart.resize()
}

function formatDetail(detail) {
  if (!detail || !Object.keys(detail).length) return '暂无详情'
  return JSON.stringify(detail, null, 2)
}

function scorePercent(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function fmtNumber(value, digits = 2, suffix = '') {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${n.toFixed(digits)}${suffix}`
}

function fmtPct(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  const v = Math.abs(n) > 1 ? n : n * 100
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`
}

async function onOpenWorkbench(e) {
  const detail = e?.detail || {}
  const symbol = typeof detail === 'string' ? detail : detail.symbol
  if (symbol) {
    searchText.value = symbol
    await loadSymbol(symbol)
  }
}

onMounted(() => {
  window.addEventListener('stock-workbench:set-symbol', onOpenWorkbench)
})

onBeforeUnmount(() => {
  window.removeEventListener('stock-workbench:set-symbol', onOpenWorkbench)
  clearTimeout(searchTimer)
  if (radarChart) {
    radarChart.dispose()
    radarChart = null
  }
})
</script>

<style scoped>
.stock-workbench {
  color: #e2e8f0;
  padding: 6px;
}
.workbench-search,
.hero-card,
.workbench-card,
.empty-state {
  background: rgba(15, 23, 42, 0.76);
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 18px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
}
.workbench-search {
  align-items: center;
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 460px);
  margin-bottom: 18px;
  padding: 22px;
}
.eyebrow {
  color: #93c5fd;
  font-size: 12px;
  letter-spacing: .08em;
  margin: 0 0 5px;
  text-transform: uppercase;
}
h1, h2, h3 {
  margin: 0;
}
.workbench-search p:not(.eyebrow) {
  color: #94a3b8;
  margin: 7px 0 0;
}
.stock-search-box {
  background: rgba(255,255,255,.04);
  border-radius: 12px;
}
.stock-input-panel {
  display: grid;
  gap: 12px;
}
.stock-code-row {
  align-items: center;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr) auto;
}
.stock-code-input {
  background: rgba(255,255,255,.06);
  border-radius: 12px;
}
.quick-symbols {
  align-items: center;
  color: #94a3b8;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 13px;
}
.quick-symbols button {
  background: rgba(96, 165, 250, .14);
  border: 1px solid rgba(96, 165, 250, .32);
  border-radius: 999px;
  color: #bfdbfe;
  cursor: pointer;
  padding: 5px 10px;
}
.quick-symbols button:hover {
  background: rgba(96, 165, 250, .24);
}
.empty-state {
  padding: 44px;
  text-align: center;
}
.empty-state p,
.muted,
.muted-block {
  color: #94a3b8;
}
.hero-card {
  display: grid;
  gap: 22px;
  grid-template-columns: minmax(0, 1fr) auto;
  margin-bottom: 16px;
  padding: 24px;
}
.hero-main h1 {
  color: #f8fafc;
  font-size: 34px;
}
.hero-main h1 span {
  color: #94a3b8;
  font-size: 20px;
  font-weight: 500;
}
.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.hero-tags span,
.summary-meta span {
  background: rgba(96, 165, 250, .12);
  border: 1px solid rgba(96, 165, 250, .24);
  border-radius: 999px;
  color: #bfdbfe;
  padding: 5px 10px;
}
.hero-metrics {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, 130px);
}
.hero-metrics div,
.status-grid div,
.financial-metrics div {
  background: rgba(30, 41, 59, .78);
  border-radius: 14px;
  padding: 14px;
}
.hero-metrics small,
.status-grid span,
.financial-metrics span {
  color: #94a3b8;
  display: block;
  font-size: 12px;
}
.hero-metrics strong,
.status-grid strong,
.financial-metrics strong {
  color: #f8fafc;
  display: block;
  font-size: 22px;
  margin: 4px 0;
}
.is-up {
  color: #22c55e;
}
.is-down {
  color: #ef4444;
}
.workbench-tabs {
  margin-bottom: 14px;
}
.panel-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, .8fr);
}
.panel-grid--overview {
  grid-template-columns: minmax(0, 1.1fr) minmax(300px, .9fr);
}
.workbench-card {
  margin-bottom: 16px;
  padding: 20px;
}
.card-title-row {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 14px;
}
.strategy-select {
  max-width: 220px;
}
.score-radar {
  height: 360px;
  min-height: 360px;
}
.summary-line {
  color: #f8fafc;
  font-size: 18px;
  line-height: 1.7;
}
.summary-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}
.analysis-summary ul {
  color: #cbd5e1;
  margin: 12px 0 0;
  padding-left: 18px;
}
.status-grid,
.financial-metrics {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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
.muted-block {
  background: rgba(30, 41, 59, .56);
  border-radius: 12px;
  padding: 18px;
}
@media (max-width: 980px) {
  .workbench-search,
  .hero-card,
  .panel-grid,
  .panel-grid--overview {
    grid-template-columns: 1fr;
  }
  .hero-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .stock-code-row {
    grid-template-columns: 1fr;
  }
}
</style>
