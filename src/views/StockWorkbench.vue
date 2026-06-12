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
          <StockSearchInput
            v-model="directSymbol"
            input-id="stock-workbench-symbol-input"
            label="输入股票代码 / 名称 / 拼音"
            placeholder="例如 600519、平安银行、PAYH、600519.SH"
            density="comfortable"
            bg-color="rgba(255,255,255,.06)"
            input-class="stock-code-input"
            @select="selectSearchCandidate"
            @submit="submitDirectSymbol"
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
          <div class="section-status-row">
            <button
              v-for="item in sectionStatusItems"
              :key="item.key"
              type="button"
              class="section-status-chip"
              :class="{ 'is-missing': !item.found, 'is-stale': item.stale }"
              :title="item.title"
              @click="activePanel = item.panel"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.found ? '已覆盖' : '暂无' }}</strong>
              <small v-if="item.asOf">{{ item.asOf }}</small>
            </button>
          </div>
        </div>
        <div class="hero-metrics">
          <div>
            <small>最新价</small>
            <strong>{{ fmtNumber(latestPrice) }}</strong>
            <span v-if="sectionLoading.quote" class="muted">行情刷新中…</span>
            <span
              v-else
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
        <v-tab value="quote">行情资金</v-tab>
        <v-tab value="scores">量化评分</v-tab>
        <v-tab value="financial">财务业绩</v-tab>
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
              <div class="card-title-row">
                <h3>行情资金快照</h3>
                <button type="button" class="text-link-button" @click="activePanel = 'quote'">查看详情</button>
              </div>
              <div class="financial-metrics">
                <div v-for="metric in overviewQuoteMetrics" :key="metric.label">
                  <span>{{ metric.label }}</span>
                  <strong :class="metric.className">{{ metric.value }}</strong>
                </div>
              </div>
              <div v-if="!quoteDailyRows.length && !latestMoneyFlow && !Object.keys(latestDailyBasic).length" class="muted-block">
                暂无行情资金分区数据。
              </div>
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

        <v-window-item value="quote">
          <section class="panel-grid">
            <article class="workbench-card">
              <div class="card-title-row">
                <h3>行情估值</h3>
                <span class="muted">
                  {{ quoteSectionDate || '暂无日期' }}
                  <template v-if="sectionLoading.quote"> · 刷新中…</template>
                </span>
              </div>
              <div class="financial-metrics">
                <div v-for="metric in quoteMetrics" :key="metric.label">
                  <span>{{ metric.label }}</span>
                  <strong>{{ metric.value }}</strong>
                </div>
              </div>
            </article>

            <article class="workbench-card">
              <div class="card-title-row">
                <h3>资金流</h3>
                <span class="muted">{{ latestMoneyFlow?.trade_date || '暂无日期' }}</span>
              </div>
              <div v-if="latestMoneyFlow" class="financial-metrics">
                <div v-for="metric in moneyFlowMetrics" :key="metric.label">
                  <span>{{ metric.label }}</span>
                  <strong :class="metric.className">{{ metric.value }}</strong>
                </div>
              </div>
              <div v-else class="muted-block">暂无该股票的资金流数据。</div>
            </article>
          </section>

          <section class="workbench-card">
            <div class="card-title-row">
              <h3>日线 K 线</h3>
              <span class="muted">最近 {{ quoteDailyRows.length }} 个交易日</span>
            </div>
            <StockKLineChart
              v-if="quoteDailyRows.length"
              :records="quoteDailyRows"
            />
            <div v-if="quoteDailyRows.length" class="quote-table-wrap">
              <table class="quote-table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>收盘</th>
                    <th>涨跌幅</th>
                    <th>最高</th>
                    <th>最低</th>
                    <th>成交额</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in quoteDailyRows.slice(0, 10)" :key="row.trade_date">
                    <td>{{ row.trade_date }}</td>
                    <td>{{ fmtNumber(row.close) }}</td>
                    <td :class="pctClass(row.pct_chg)">{{ fmtPct(row.pct_chg) }}</td>
                    <td>{{ fmtNumber(row.high) }}</td>
                    <td>{{ fmtNumber(row.low) }}</td>
                    <td>{{ fmtAmount(row.amount) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="muted-block">暂无该股票的日线行情。</div>
          </section>
        </v-window-item>

        <v-window-item value="scores">
          <section class="workbench-card">
            <div class="card-title-row">
              <h3>量化评分详情</h3>
              <span class="muted">
                来自最新 `stock_scores` 文档
                <template v-if="scoreHistory.length"> · 最近 {{ scoreHistory.length }} 条历史</template>
                <template v-if="sectionLoading.scores"> · 刷新中…</template>
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
        </v-window-item>

        <v-window-item value="financial">
          <section class="panel-grid">
            <article class="workbench-card">
              <div class="card-title-row">
                <h3>财务成长图</h3>
                <span class="muted">
                  最近 {{ financialChartData.length }} 期
                  <template v-if="sectionLoading.financials"> · 刷新中…</template>
                </span>
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
          <section class="workbench-card">
            <div class="card-title-row">
              <h3>业绩事件</h3>
              <span class="muted">预告 / 快报 / 披露日历 / 调研</span>
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
        </v-window-item>

        <v-window-item value="analysis">
          <section class="workbench-card">
            <div class="card-title-row">
              <h3>深度分析</h3>
              <div class="analysis-actions">
                <span v-if="sectionLoading.ai" class="muted">刷新中…</span>
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
          <section class="workbench-card">
            <div class="card-title-row">
              <h3>最近分析历史</h3>
              <span class="muted">最近 {{ analysisHistory.length }} 条</span>
            </div>
            <div v-if="analysisHistory.length" class="analysis-history-list">
              <button
                v-for="item in analysisHistory"
                :key="item.id || item.created_at"
                type="button"
                class="analysis-history-item"
                :class="{ active: item.id && item.id === deepAnalysis?.id }"
                @click="selectAnalysisHistory(item)"
              >
                <span>{{ item.created_at || '-' }}</span>
                <strong>{{ analysisHistoryTitle(item) }}</strong>
                <small>{{ item.analysis_mode || 'classic' }}</small>
              </button>
            </div>
            <div v-else class="muted-block">暂无历史分析。</div>
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
import {
  getStockWorkbench,
  getStockWorkbenchAi,
  getStockWorkbenchFinancials,
  getStockWorkbenchQuote,
  getStockWorkbenchScores,
} from '../api/stock'
import AnalysisDetailContent from '../components/AnalysisDetailContent.vue'
import GrowthChart from '../components/GrowthChart.vue'
import StockKLineChart from '../components/StockKLineChart.vue'
import StockSearchInput from '../components/StockSearchInput.vue'

const SCORE_DEFS = [
  { key: 'technical', label: '技术面' },
  { key: 'fundamental', label: '基本面' },
  { key: 'value', label: '价值' },
  { key: 'growth', label: '成长' },
  { key: 'money_flow', label: '资金流' },
  { key: 'cycle', label: '动量' },
]

const loading = ref(false)
const error = ref('')
const payload = ref(null)
const activePanel = ref('overview')
const directSymbol = ref('')
const analysisMode = ref('multi_expert_v1')
const analysisSubmitting = ref(false)
const analysisSubmitStatus = ref('')
const analysisSubmitError = ref('')
const incomeRows = ref([])
const indicatorRows = ref([])
const balanceRows = ref([])
const cashflowRows = ref([])
const earnings = ref({})
const sectionLoading = ref({ quote: false, scores: false, financials: false, ai: false })
const sectionLoaded = ref({ quote: false, scores: false, financials: false, ai: false })
const radarRef = ref(null)
let radarChart = null
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
const analysisHistory = computed(() => Array.isArray(payload.value?.analysis_history) ? payload.value.analysis_history : [])
const scoreHistory = computed(() => Array.isArray(payload.value?.score_history) ? payload.value.score_history : [])
const quoteDailyRows = computed(() => Array.isArray(payload.value?.daily_quotes) ? payload.value.daily_quotes : [])
const latestDailyBasic = computed(() => payload.value?.daily_basic || {})
const latestMoneyFlow = computed(() => payload.value?.money_flow || null)
const quoteSectionDate = computed(() => dataStatus.value?.sections?.quote?.as_of || latestDailyBasic.value.trade_date || quote.value.trade_date || '')

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
const sectionStatusItems = computed(() => {
  const sections = dataStatus.value.sections || {}
  const defs = [
    { key: 'quote', label: '行情资金', panel: 'quote' },
    { key: 'scores', label: '量化评分', panel: 'scores' },
    { key: 'financials', label: '财务业绩', panel: 'financial' },
    { key: 'ai', label: 'AI 分析', panel: 'analysis' },
  ]
  return defs.map((def) => {
    const status = sections[def.key] || {}
    const fallbackFound = {
      quote: dataStatus.value.quote_found,
      scores: dataStatus.value.score_found,
      financials: Boolean(incomeRows.value.length || indicatorRows.value.length),
      ai: dataStatus.value.deep_analysis_found,
    }[def.key]
    return {
      ...def,
      found: status.found ?? fallbackFound,
      stale: Boolean(status.stale),
      asOf: status.as_of || '',
      title: `${def.label}：${status.expected_freshness || '暂无新鲜度说明'}${status.source ? `；来源 ${status.source}` : ''}`,
    }
  })
})

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
  const latestBalance = balanceRows.value[0] || {}
  const latestCashflow = cashflowRows.value[0] || {}
  return [
    { label: 'ROE', value: fmtNumber(latest.roe || latest.roe_dt, 2, '%') },
    { label: '毛利率', value: fmtNumber(latest.grossprofit_margin, 2, '%') },
    { label: '净利同比', value: fmtNumber(latest.netprofit_yoy || latest.profit_to_gr, 2, '%') },
    { label: '营收同比', value: fmtNumber(latest.tr_yoy || latest.or_yoy, 2, '%') },
    { label: 'PE TTM', value: fmtNumber((indicatorRows.value[0] || {}).pe_ttm || quote.value.pe_ttm) },
    { label: 'PB', value: fmtNumber((indicatorRows.value[0] || {}).pb || quote.value.pb) },
    { label: '总资产', value: fmtAmount(latestBalance.total_assets) },
    { label: '经营现金流', value: fmtAmount(latestCashflow.n_cashflow_act) },
  ]
})

const earningsEvents = computed(() => {
  const rows = []
  const source = earnings.value || {}
  for (const row of source.forecast || []) rows.push({ type: '业绩预告', date: row.ann_date || row.end_date, title: row.type || row.summary || '业绩预告', raw: row })
  for (const row of source.express || []) rows.push({ type: '业绩快报', date: row.ann_date || row.end_date, title: row.revenue ? `营收 ${fmtAmount(row.revenue)}` : '业绩快报', raw: row })
  for (const row of source.disclosure || []) rows.push({ type: '披露日历', date: row.ann_date || row.pre_date, title: row.pre_date ? `预计披露 ${row.pre_date}` : '披露日历', raw: row })
  for (const row of source.report_rc || []) rows.push({ type: '调研/研报', date: row.ann_date || row.end_date, title: row.organ_name || row.title || '调研/研报', raw: row })
  return rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 8)
})

const quoteMetrics = computed(() => [
  { label: '换手率', value: fmtNumber(latestDailyBasic.value.turnover_rate, 2, '%') },
  { label: '量比', value: fmtNumber(latestDailyBasic.value.volume_ratio) },
  { label: 'PE TTM', value: fmtNumber(latestDailyBasic.value.pe_ttm ?? latestDailyBasic.value.pe) },
  { label: 'PB', value: fmtNumber(latestDailyBasic.value.pb) },
  { label: '股息率 TTM', value: fmtNumber(latestDailyBasic.value.dv_ttm, 2, '%') },
  { label: '流通市值', value: fmtAmount(latestDailyBasic.value.circ_mv) },
  { label: '总市值', value: fmtAmount(latestDailyBasic.value.total_mv) },
  { label: '日线样本', value: quoteDailyRows.value.length ? `${quoteDailyRows.value.length} 条` : '-' },
])

const moneyFlowMetrics = computed(() => {
  const mf = latestMoneyFlow.value || {}
  return [
    { label: '主力净额', value: fmtAmount(mf.net_mf_amount), className: valueClass(mf.net_mf_amount) },
    { label: '超大单买入', value: fmtAmount(mf.buy_elg_amount) },
    { label: '超大单卖出', value: fmtAmount(mf.sell_elg_amount) },
    { label: '大单买入', value: fmtAmount(mf.buy_lg_amount) },
    { label: '大单卖出', value: fmtAmount(mf.sell_lg_amount) },
    { label: '中单净额', value: fmtAmount(toNumber(mf.buy_md_amount) - toNumber(mf.sell_md_amount)) },
  ]
})
const overviewQuoteMetrics = computed(() => [
  { label: '换手率', value: fmtNumber(latestDailyBasic.value.turnover_rate, 2, '%') },
  { label: 'PE TTM', value: fmtNumber(latestDailyBasic.value.pe_ttm ?? latestDailyBasic.value.pe) },
  { label: 'PB', value: fmtNumber(latestDailyBasic.value.pb) },
  { label: '主力净额', value: fmtAmount(latestMoneyFlow.value?.net_mf_amount), className: valueClass(latestMoneyFlow.value?.net_mf_amount) },
])

watch([scoreItems, activePanel], async () => {
  if (activePanel.value !== 'overview') return
  await nextTick()
  renderRadar()
}, { deep: true })

watch(activePanel, async (panel) => {
  if (!payload.value) return
  if (panel === 'quote') {
    await loadWorkbenchSection('quote')
  } else if (panel === 'scores') {
    await loadWorkbenchSection('scores')
  } else if (panel === 'financial') {
    await loadWorkbenchSection('financials')
  } else if (panel === 'analysis') {
    await loadWorkbenchSection('ai')
  }
})

function selectSearchCandidate(item) {
  if (!item) return
  const symbol = item.symbol || item.ts_code
  if (!symbol) return
  directSymbol.value = symbol
  loadSymbol(symbol)
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
    clearAnalysisPolling()
    analysisSubmitStatus.value = ''
    analysisSubmitError.value = ''
    sectionLoaded.value = { quote: false, scores: false, financials: false, ai: false }
    sectionLoading.value = { quote: false, scores: false, financials: false, ai: false }
    const workbench = await getStockWorkbench(clean)
    if (canonicalSymbol(directSymbol.value) !== canonicalSymbol(clean)) return
    payload.value = workbench
    sectionLoaded.value = {
      quote: Boolean(workbench?.quote),
      scores: Boolean(workbench?.score),
      financials: false,
      ai: Boolean(workbench?.deep_analysis),
    }
    incomeRows.value = []
    indicatorRows.value = []
    balanceRows.value = []
    cashflowRows.value = []
    earnings.value = {}
    queueInitialSectionLoads()
    await nextTick()
    renderRadar()
  } catch (e) {
    if (canonicalSymbol(directSymbol.value) === canonicalSymbol(clean)) {
      error.value = e?.message || '股票工作台数据加载失败'
    }
  } finally {
    if (canonicalSymbol(directSymbol.value) === canonicalSymbol(clean)) {
      loading.value = false
    }
  }
}

function queueInitialSectionLoads() {
  const tasks = [loadWorkbenchSection('quote', { force: true })]
  if (activePanel.value === 'scores') {
    tasks.push(loadWorkbenchSection('scores', { force: true }))
  } else if (activePanel.value === 'financial') {
    tasks.push(loadWorkbenchSection('financials', { force: true }))
  } else if (activePanel.value === 'analysis') {
    tasks.push(loadWorkbenchSection('ai', { force: true }))
  }
  Promise.all(tasks).catch((e) => {
    console.warn('load initial stock workbench sections failed', e)
  })
}

async function loadWorkbenchSection(section, options = {}) {
  const force = Boolean(options.force)
  const symbol = stockSymbol.value && stockSymbol.value !== '-' ? stockSymbol.value : directSymbol.value
  if (!symbol || !payload.value) return
  if (!force && sectionLoaded.value[section]) return

  sectionLoading.value = { ...sectionLoading.value, [section]: true }
  try {
    if (section === 'quote') {
      const data = await getStockWorkbenchQuote(symbol)
      if (!isCurrentWorkbenchSymbol(symbol)) return
      mergeWorkbenchSection('quote', data, {
        quote: data?.quote || null,
        daily_quotes: Array.isArray(data?.daily_quotes) ? data.daily_quotes : [],
        daily_basic: data?.daily_basic || null,
        money_flow: data?.money_flow || null,
      })
    } else if (section === 'scores') {
      const data = await getStockWorkbenchScores(symbol)
      if (!isCurrentWorkbenchSymbol(symbol)) return
      mergeWorkbenchSection('scores', data, {
        score: data?.score || null,
        score_history: Array.isArray(data?.score_history) ? data.score_history : [],
      })
      await nextTick()
      renderRadar()
    } else if (section === 'financials') {
      const data = await getStockWorkbenchFinancials(symbol)
      if (!isCurrentWorkbenchSymbol(symbol)) return
      incomeRows.value = Array.isArray(data?.income) ? data.income : []
      indicatorRows.value = Array.isArray(data?.indicators) ? data.indicators : []
      balanceRows.value = Array.isArray(data?.balance) ? data.balance : []
      cashflowRows.value = Array.isArray(data?.cashflow) ? data.cashflow : []
      earnings.value = data?.earnings || {}
      mergeWorkbenchSection('financials', data, {})
    } else if (section === 'ai') {
      const data = await getStockWorkbenchAi(symbol)
      if (!isCurrentWorkbenchSymbol(symbol)) return
      mergeWorkbenchSection('ai', data, {
        deep_analysis: data?.deep_analysis || null,
        analysis_history: Array.isArray(data?.analysis_history) ? data.analysis_history : [],
        analysis_history_total: data?.analysis_history_total || 0,
      })
    }
    sectionLoaded.value = { ...sectionLoaded.value, [section]: true }
  } catch (e) {
    console.warn(`load stock workbench section ${section} failed`, e)
  } finally {
    if (isCurrentWorkbenchSymbol(symbol)) {
      sectionLoading.value = { ...sectionLoading.value, [section]: false }
    }
  }
}

function mergeWorkbenchSection(section, data, updates) {
  const status = data?.data_status || {}
  const nextStatus = {
    ...(payload.value?.data_status || {}),
    sections: {
      ...(payload.value?.data_status?.sections || {}),
      [section]: status,
    },
  }
  if (section === 'quote') {
    nextStatus.quote_found = Boolean(updates.quote)
    nextStatus.quote_date = status.as_of || nextStatus.quote_date
  } else if (section === 'scores') {
    nextStatus.score_found = Boolean(updates.score)
    nextStatus.score_date = status.as_of || nextStatus.score_date
  } else if (section === 'financials') {
    nextStatus.financials_found = Boolean(status.found)
    nextStatus.financials_date = status.as_of || nextStatus.financials_date
  } else if (section === 'ai') {
    nextStatus.deep_analysis_found = Boolean(updates.deep_analysis)
    nextStatus.analysis_created_at = status.as_of || nextStatus.analysis_created_at
  }

  payload.value = {
    ...(payload.value || {}),
    ...updates,
    data_status: nextStatus,
  }
}

function clearAnalysisPolling() {
  if (analysisPollTimer) {
    clearInterval(analysisPollTimer)
    analysisPollTimer = null
  }
}

function selectAnalysisHistory(item) {
  if (!item) return
  payload.value = {
    ...(payload.value || {}),
    deep_analysis: item,
  }
}

function analysisHistoryTitle(item) {
  const analysis = item?.analysis || {}
  return analysis.final_conclusion
    || analysis.investment_advice
    || analysis.long_term_forecast
    || analysis.mid_term_forecast
    || analysis.short_term_forecast
    || item?.stock_name
    || '查看分析详情'
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
            analysis_history: [
              nextDeepAnalysis,
              ...analysisHistory.value.filter((item) => item.id !== nextDeepAnalysis.id),
            ],
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

function scoreRowComposite(row) {
  const composite = row?.composite_score
  if (composite && typeof composite === 'object') {
    if (composite.balanced != null) return composite.balanced
    const firstKey = Object.keys(composite).find((key) => composite[key] != null)
    return firstKey ? composite[firstKey] : null
  }
  return composite
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

function canonicalSymbol(value) {
  return String(value || '').trim().toUpperCase().split('.')[0]
}

function isCurrentWorkbenchSymbol(symbol) {
  const current = stockSymbol.value && stockSymbol.value !== '-' ? stockSymbol.value : directSymbol.value
  return canonicalSymbol(symbol) === canonicalSymbol(current)
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

function fmtAmount(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(2)}亿`
  return `${n.toFixed(2)}万`
}

function valueClass(value) {
  const n = Number(value)
  return n > 0 ? 'is-up' : n < 0 ? 'is-down' : ''
}

function pctClass(value) {
  return valueClass(value)
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
.section-status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}
.section-status-chip {
  background: rgba(34, 197, 94, .10);
  border: 1px solid rgba(34, 197, 94, .30);
  border-radius: 14px;
  color: #dcfce7;
  cursor: pointer;
  display: grid;
  gap: 2px;
  min-width: 116px;
  padding: 9px 12px;
  text-align: left;
}
.section-status-chip:hover {
  background: rgba(34, 197, 94, .18);
}
.section-status-chip.is-missing {
  background: rgba(148, 163, 184, .10);
  border-color: rgba(148, 163, 184, .24);
  color: #cbd5e1;
}
.section-status-chip.is-stale {
  background: rgba(245, 158, 11, .12);
  border-color: rgba(245, 158, 11, .35);
  color: #fde68a;
}
.section-status-chip span {
  font-size: 12px;
  opacity: .86;
}
.section-status-chip strong {
  font-size: 14px;
}
.section-status-chip small {
  color: inherit;
  font-size: 11px;
  opacity: .72;
}
.text-link-button {
  background: transparent;
  border: 0;
  color: #93c5fd;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
}
.text-link-button:hover {
  color: #bfdbfe;
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
.analysis-history-list {
  display: grid;
  gap: 10px;
}
.analysis-history-item {
  background: rgba(30, 41, 59, .62);
  border: 1px solid rgba(148, 163, 184, .16);
  border-radius: 12px;
  color: #cbd5e1;
  cursor: pointer;
  display: grid;
  gap: 6px;
  grid-template-columns: 170px minmax(0, 1fr) 110px;
  padding: 12px 14px;
  text-align: left;
}
.analysis-history-item:hover,
.analysis-history-item.active {
  background: rgba(96, 165, 250, .14);
  border-color: rgba(96, 165, 250, .34);
}
.analysis-history-item span,
.analysis-history-item small {
  color: #94a3b8;
  font-size: 12px;
}
.analysis-history-item strong {
  color: #f8fafc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
