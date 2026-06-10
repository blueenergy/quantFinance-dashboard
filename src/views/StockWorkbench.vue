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
          <div class="stock-code-combobox">
            <v-text-field
              id="stock-workbench-symbol-input"
              v-model="directSymbol"
              clearable
              hide-details
              label="输入股票代码 / 名称 / 拼音"
              placeholder="例如 600519、平安银行、PAYH、600519.SH"
              variant="outlined"
              density="comfortable"
              class="stock-code-input"
              autocomplete="off"
              :loading="searching"
              @focus="showStockSearchMenu = searchResults.length > 0"
              @keyup.enter="submitDirectSymbol"
            />
            <v-menu
              v-model="showStockSearchMenu"
              activator="#stock-workbench-symbol-input"
              :close-on-content-click="false"
              :open-on-click="false"
              :open-on-focus="false"
              location="bottom start"
              content-class="stock-workbench-search-menu"
            >
              <div v-if="searchResults.length" class="stock-workbench-search-scroll">
                <v-list
                  density="compact"
                  class="stock-workbench-search-list"
                >
                  <v-list-item
                    v-for="item in searchResults"
                    :key="item.symbol || item.ts_code"
                    :title="stockItemTitle(item)"
                    :subtitle="stockItemSubtitle(item)"
                    @click="selectSearchCandidate(item)"
                  >
                    <template #prepend>
                      <v-chip size="x-small" label class="mr-2" color="primary">
                        {{ stockMarketLabel(item) }}
                      </v-chip>
                    </template>
                  </v-list-item>
                </v-list>
              </div>
            </v-menu>
          </div>
          <v-btn
            color="primary"
            size="large"
            :loading="loading"
            @click="submitDirectSymbol"
          >
            加载工作台
          </v-btn>
        </div>
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
            <span
              class="price-change-line"
              :class="changeClass"
              :title="priceChangeTitle"
            >
              日涨跌幅 {{ fmtPct(latestPctChange) }}
            </span>
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
                <span class="muted">按维度展示最新量化评分</span>
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
              <div class="analysis-actions">
                <v-select
                  v-model="analysisMode"
                  :items="analysisModeOptions"
                  density="compact"
                  variant="outlined"
                  hide-details
                  class="analysis-mode-select"
                />
                <v-btn
                  color="primary"
                  variant="tonal"
                  :loading="analysisSubmitting"
                  :disabled="!stockSymbol || stockSymbol === '-'"
                  @click="submitDeepAnalysis"
                >
                  {{ deepAnalysis?.analysis ? '重新分析' : '开始深度分析' }}
                </v-btn>
              </div>
            </div>
            <v-alert v-if="analysisSubmitError" type="error" variant="tonal" class="mb-3">
              {{ analysisSubmitError }}
            </v-alert>
            <v-alert v-if="analysisSubmitStatus" type="info" variant="tonal" class="mb-3">
              {{ analysisSubmitStatus }}
            </v-alert>
            <div v-if="deepAnalysis?.created_at" class="analysis-time">
              最近分析时间：{{ deepAnalysis.created_at }}
            </div>
            <AnalysisDetailContent
              v-if="deepAnalysis?.analysis"
              :analysis="deepAnalysis.analysis"
              :analysis-mode="deepAnalysis.analysis_mode || 'classic'"
              layout="stacked"
              mode="stock"
              show-mode
            />
            <div v-else class="muted-block">暂无深度分析，可点击上方按钮直接发起分析任务。</div>
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
import axios from 'axios'
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
  { key: 'cycle', label: '动量' },
  { key: 'sentiment', label: '情绪' },
]

const loading = ref(false)
const searching = ref(false)
const error = ref('')
const payload = ref(null)
const activePanel = ref('overview')
const directSymbol = ref('')
const searchResults = ref([])
const selectedSearchItem = ref(null)
const showStockSearchMenu = ref(false)
const analysisMode = ref('multi_expert_v1')
const analysisSubmitting = ref(false)
const analysisSubmitStatus = ref('')
const analysisSubmitError = ref('')
const incomeRows = ref([])
const indicatorRows = ref([])
const radarRef = ref(null)
let radarChart = null
let searchTimer = null
let analysisPollTimer = null

const analysisModeOptions = [
  { title: '多专家', value: 'multi_expert_v1' },
  { title: '经典', value: 'classic' },
]

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
const latestPctChange = computed(() => {
  const normalizedPct = toNumber(quote.value.display_pct_chg)
  if (normalizedPct != null) return normalizedPct

  const explicitPct = firstFinite([
    quote.value.pct_chg,
    quote.value.pct_change,
    quote.value.change_percent,
  ])
  if (explicitPct != null && Math.abs(explicitPct) <= 30) {
    return explicitPct
  }

  const close = toNumber(latestPrice.value)
  const previousClose = firstFinite([
    quote.value.pre_close,
    quote.value.prev_close,
    quote.value.previous_close,
    quote.value.yesterday_close,
    quote.value.last_close,
  ])
  if (close != null && previousClose > 0) {
    return ((close - previousClose) / previousClose) * 100
  }

  return null
})
const priceChangeTitle = computed(() => {
  const source = quote.value.display_pct_chg_source
  const preClose = toNumber(quote.value.display_pre_close)
  if (source && source !== 'unavailable') {
    const preText = preClose != null ? `，昨收 ${fmtNumber(preClose)}` : ''
    return `当日涨跌幅：后端已按“最新价相对昨收价”归一计算${preText}。来源：${source}。`
  }
  return '当日涨跌幅：优先使用后端归一字段 display_pct_chg；缺失时才使用行情 pct_chg / pct_change 或用昨收价计算。'
})
const changeClass = computed(() => {
  const n = Number(latestPctChange.value)
  return n > 0 ? 'is-up' : n < 0 ? 'is-down' : ''
})

const compositeScore = computed(() => score.value.composite_score || {})
const currentCompositeScore = computed(() => {
  if (compositeScore.value && typeof compositeScore.value === 'object') {
    if (compositeScore.value.balanced != null) return compositeScore.value.balanced
    const firstKey = Object.keys(compositeScore.value).find((key) => compositeScore.value[key] != null)
    return firstKey ? compositeScore.value[firstKey] : null
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

watch(directSymbol, (val) => {
  clearTimeout(searchTimer)
  const clean = String(val || '').trim()
  if (!clean || clean.length < 2) {
    searchResults.value = []
    showStockSearchMenu.value = false
    return
  }
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      searchResults.value = await searchStocks(clean)
      showStockSearchMenu.value = searchResults.value.length > 0
    } catch (e) {
      console.warn('search stocks failed', e)
      searchResults.value = []
      showStockSearchMenu.value = false
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
  const name = item.name || item.stock_name || ''
  const pinyin = item.pinyin ? ` ${item.pinyin}` : ''
  return `${symbol} ${name}${pinyin}`.trim()
}

function stockItemSubtitle(item) {
  if (!item) return ''
  const parts = []
  if (item.industry) parts.push(item.industry)
  if (item.pinyin) parts.push(`拼音 ${item.pinyin}`)
  if (item.is_etf) parts.push('ETF')
  return parts.join(' · ')
}

function stockMarketLabel(item) {
  const symbol = item?.symbol || item?.ts_code || ''
  const suffix = String(symbol).split('.')[1]
  if (suffix) return suffix
  if (/^6|^9/.test(symbol)) return 'SH'
  if (/^0|^2|^3/.test(symbol)) return 'SZ'
  if (/^4|^8/.test(symbol)) return 'BJ'
  return item?.is_etf ? 'ETF' : '股票'
}

function selectSearchCandidate(item) {
  if (!item) return
  const symbol = item.symbol || item.ts_code
  if (!symbol) return
  selectedSearchItem.value = item
  directSymbol.value = symbol
  showStockSearchMenu.value = false
  searchResults.value = []
  loadSymbol(symbol)
}

function submitDirectSymbol() {
  loadSymbol(directSymbol.value)
}

async function loadSymbol(symbol) {
  const clean = String(symbol || '').trim()
  if (!clean) return
  directSymbol.value = clean
  selectedSearchItem.value = null
  showStockSearchMenu.value = false
  loading.value = true
  error.value = ''
  try {
    clearAnalysisPolling()
    analysisSubmitStatus.value = ''
    analysisSubmitError.value = ''
    const [workbench, income, indicator] = await Promise.all([
      getStockWorkbench(clean),
      getStockFinancial(clean, 'income', 8).catch(() => []),
      getStockFinancial(clean, 'indicator', 8).catch(() => []),
    ])
    payload.value = workbench
    incomeRows.value = Array.isArray(income) ? income : []
    indicatorRows.value = Array.isArray(indicator) ? indicator : []
    await nextTick()
    renderRadar()
  } catch (e) {
    error.value = e?.message || '股票工作台数据加载失败'
  } finally {
    loading.value = false
  }
}

function clearAnalysisPolling() {
  if (analysisPollTimer) {
    clearInterval(analysisPollTimer)
    analysisPollTimer = null
  }
}

async function submitDeepAnalysis() {
  const symbol = stockSymbol.value && stockSymbol.value !== '-' ? stockSymbol.value : directSymbol.value
  if (!symbol) return
  clearAnalysisPolling()
  analysisSubmitting.value = true
  analysisSubmitError.value = ''
  analysisSubmitStatus.value = ''
  const token = localStorage.getItem('access_token')
  try {
    const res = await axios.post(
      '/api/analyze/deep-analysis',
      { symbol, priority: 30, analysis_mode: analysisMode.value },
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!res.data?.success) {
      analysisSubmitError.value = res.data?.message || '提交失败'
      analysisSubmitting.value = false
      return
    }
    const taskId = res.data.task_id
    analysisSubmitStatus.value = `已提交，前方 ${res.data.queue_ahead ?? '?'} 个任务。${res.data.wait_hint || '分析中…'}`
    let tries = 0
    analysisPollTimer = setInterval(async () => {
      tries += 1
      if (tries > 120) {
        clearAnalysisPolling()
        analysisSubmitStatus.value = '等待超时，请稍后刷新工作台或在个股深度分析历史中查看。'
        analysisSubmitting.value = false
        return
      }
      try {
        const poll = await axios.get(`/api/analyze/task/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const status = poll.data?.status
        if (status === 'completed') {
          clearAnalysisPolling()
          analysisSubmitting.value = false
          analysisSubmitStatus.value = '分析完成，已更新当前工作台。'
          const analysis = poll.data?.analysis || {}
          const nextDeepAnalysis = {
            id: taskId,
            symbol,
            stock_name: analysis.stock_name || stockName.value || '',
            analysis_mode: poll.data?.analysis_mode || analysis.analysis_mode || analysisMode.value,
            analysis,
            model: poll.data?.model,
            created_at: new Date().toISOString(),
          }
          payload.value = {
            ...(payload.value || {}),
            deep_analysis: nextDeepAnalysis,
            data_status: {
              ...(payload.value?.data_status || {}),
              deep_analysis_found: true,
              analysis_created_at: nextDeepAnalysis.created_at,
            },
          }
        } else if (status === 'failed' || status === 'completed_with_parse_error') {
          clearAnalysisPolling()
          analysisSubmitting.value = false
          analysisSubmitStatus.value = ''
          analysisSubmitError.value = poll.data?.error || '分析失败'
        } else if (status === 'pending') {
          analysisSubmitStatus.value = `排队中，前方 ${poll.data?.queue_ahead ?? '?'} 个任务。${poll.data?.wait_hint || '预计等待时间计算中'}`
        } else if (status === 'processing') {
          analysisSubmitStatus.value = poll.data?.wait_hint || '正在分析，LLM 响应时间可能有波动'
        }
      } catch (_) {
        // Keep polling through transient network/server hiccups.
      }
    }, 3000)
  } catch (e) {
    analysisSubmitError.value = e.response?.data?.detail || e.message || '提交失败'
    analysisSubmitting.value = false
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

function firstFinite(values) {
  for (const value of values) {
    const n = toNumber(value)
    if (n != null) return n
  }
  return null
}

function fmtNumber(value, digits = 2, suffix = '') {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${n.toFixed(digits)}${suffix}`
}

function fmtPct(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
}

async function onOpenWorkbench(e) {
  const detail = e?.detail || {}
  const symbol = typeof detail === 'string' ? detail : detail.symbol
  if (symbol) {
    directSymbol.value = symbol
    await loadSymbol(symbol)
  }
}

onMounted(() => {
  window.addEventListener('stock-workbench:set-symbol', onOpenWorkbench)
})

onBeforeUnmount(() => {
  window.removeEventListener('stock-workbench:set-symbol', onOpenWorkbench)
  clearTimeout(searchTimer)
  clearAnalysisPolling()
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
.stock-code-combobox {
  min-width: 0;
}
.stock-code-input {
  background: rgba(255,255,255,.06);
  border-radius: 12px;
}
:global(.stock-workbench-search-menu) {
  background: rgba(15, 23, 42, .98);
  border: 1px solid rgba(148, 163, 184, .22);
  border-radius: 12px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, .28);
  max-height: 340px;
  overflow: hidden;
}
:global(.stock-workbench-search-scroll) {
  max-height: 320px;
  min-width: 320px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
:global(.stock-workbench-search-list) {
  background: rgba(15, 23, 42, .98) !important;
  color: #e2e8f0 !important;
  min-width: 320px;
}
:global(.stock-workbench-search-list .v-list-item-title) {
  color: #ffffff !important;
  font-size: 14px;
  font-weight: 800;
  opacity: 1 !important;
}
:global(.stock-workbench-search-list .v-list-item-subtitle) {
  color: #dbeafe !important;
  opacity: 1 !important;
}
:global(.stock-workbench-search-list .v-list-item) {
  color: #f8fafc !important;
}
:global(.stock-workbench-search-list .v-list-item:hover) {
  background: rgba(96, 165, 250, .18) !important;
}
:global(.stock-workbench-search-list .v-chip) {
  background: rgba(59, 130, 246, .35) !important;
  color: #ffffff !important;
  font-weight: 800;
}
:global(.stock-workbench-search-scroll::-webkit-scrollbar) {
  width: 8px;
}
:global(.stock-workbench-search-scroll::-webkit-scrollbar-thumb) {
  background: rgba(148, 163, 184, .45);
  border-radius: 999px;
}
:global(.stock-workbench-search-scroll::-webkit-scrollbar-track) {
  background: rgba(15, 23, 42, .55);
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
.price-change-line {
  cursor: help;
  display: block;
  font-size: 12px;
  line-height: 1.35;
}
.is-up {
  color: #ef4444;
}
.is-down {
  color: #22c55e;
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
.analysis-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}
.analysis-mode-select {
  min-width: 140px;
}
.analysis-time {
  color: #94a3b8;
  font-size: 13px;
  margin: -4px 0 14px;
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
