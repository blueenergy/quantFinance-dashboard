<template>
  <div class="global-brief-card">
    <div class="card-header">
      <div class="header-main">
        <h3>🌍 隔夜全球市场联动分析</h3>
        <span v-if="analysisTimestamp" class="header-time">
          ({{ formatDateTime(analysisTimestamp) }} 分析)
        </span>
        <v-btn 
          :icon="mdiRefresh" 
          variant="text" 
          size="x-small" 
          color="grey"
          :disabled="refreshing || !canTriggerGlobalAnalysis"
          :loading="refreshing"
          @click="refreshAnalysis"
          class="ml-1"
        ></v-btn>
        <span v-if="!canTriggerGlobalAnalysis" class="pro-hint">专业版可用</span>
      </div>
      <div v-if="brief" class="sentiment-indicator" :class="getSentimentClass(brief.sentiment_score)">
        <span class="score">{{ brief.sentiment_score }}</span>
        <span class="label">{{ brief.sentiment_mood }}</span>
      </div>
    </div>

    <div class="card-content">
      <div v-if="loading" class="loading-state">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
        <p>正在同步全球市场数据与AI分析...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <v-alert type="error" variant="tonal" density="compact">
          {{ error }}
        </v-alert>
      </div>

      <div v-if="brief" class="brief-body">

        <div
          v-if="brief.international_shock_score !== undefined || brief.domestic_hedge_score !== undefined || brief.net_impact_score !== undefined"
          class="score-strip-wrap"
        >
          <div class="score-strip-header">
            <span class="score-strip-title">📐 量化对冲分</span>
            <v-btn
              size="x-small"
              variant="text"
              color="primary"
              :prepend-icon="mdiHelpCircleOutline"
              @click="showScoreHelp = !showScoreHelp"
            >
              {{ showScoreHelp ? '收起解读' : '解读' }}
            </v-btn>
          </div>

          <v-expand-transition>
            <div v-if="showScoreHelp" class="score-help-panel">
              <p class="score-help-line">
                <strong>国际冲击分</strong> {{ scoreInterpretation.international.value }}（{{ scoreInterpretation.international.level }}）：
                {{ scoreInterpretation.international.text }}
              </p>
              <p class="score-help-line">
                <strong>国内对冲分</strong> {{ scoreInterpretation.domestic.value }}（{{ scoreInterpretation.domestic.level }}）：
                {{ scoreInterpretation.domestic.text }}
              </p>
              <p class="score-help-line">
                <strong>净影响分</strong> {{ scoreInterpretation.net.value }}（{{ scoreInterpretation.net.level }}）：
                {{ scoreInterpretation.net.text }}
              </p>
              <p class="score-help-summary">综合解读：{{ scoreInterpretation.summary }}</p>
            </div>
          </v-expand-transition>

          <div class="score-strip">
          <div class="score-pill score-international">
            <span class="pill-label">国际冲击分</span>
            <span class="pill-value">{{ formatScore(brief.international_shock_score) }}</span>
          </div>
          <div class="score-pill score-domestic">
            <span class="pill-label">国内对冲分</span>
            <span class="pill-value">{{ formatScore(brief.domestic_hedge_score) }}</span>
          </div>
          <div class="score-pill score-net">
            <span class="pill-label">净影响分</span>
            <span class="pill-value">{{ formatScore(brief.net_impact_score) }}</span>
          </div>
          </div>
        </div>
        
        <!-- 市场数据：优先展示 MongoDB 最新同步（Yahoo），与下方 AI 报告解耦 -->
        <div v-if="displayMarketData" class="market-dashboard">
          <div class="dashboard-header">
            <h4>
              📉 全球市场行情
              <span v-if="marketDate" class="snap-time">（{{ marketDate }} 口径）</span>
            </h4>
            <v-chip size="x-small" :color="isShowingLiveQuotes ? 'success' : 'grey'" variant="tonal">
              {{ isShowingLiveQuotes ? '库内最新' : '分析快照' }}
            </v-chip>
          </div>
          <p class="dashboard-footnote">
            <template v-if="isShowingLiveQuotes && liveSyncedAtMax">
              {{ liveSourceNote }} · 同步入库时间不晚于 {{ formatDateTime(liveSyncedAtMax) }}
            </template>
            <template v-else-if="isShowingLiveQuotes && !liveSyncedAtMax">
              {{ liveSourceNote }}（未返回单条时间戳，请以数据引擎同步任务为准）
            </template>
            <template v-else>
              暂未能从行情库拉取最新数据，当前为<strong>分析报告附带</strong>的快照；刷新页面或稍后重试。下方 AI 段落仍对应标题所示分析时间。
            </template>
          </p>

          <v-tabs
            v-model="activeMarketTab"
            bg-color="transparent"
            color="primary"
            density="compact"
            class="market-tabs mb-3"
            show-arrows
          >
            <v-tab value="indices">🇺🇸 核心指数</v-tab>
            <v-tab value="china">🇨🇳 中国资产</v-tab>
            <v-tab value="tech">🤖 科技巨头</v-tab>
            <v-tab value="commodities">🪙 商品外汇</v-tab>
            <v-tab value="other">📉 债券加密</v-tab>
          </v-tabs>

          <v-window v-model="activeMarketTab">
            <!-- 1. 核心指数 -->
            <v-window-item value="indices">
              <div class="market-indices">
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.indices, '^IXIC')?.change_pct)" :title="buildQuoteSourceTooltip(getMarketItem(displayMarketData.indices, '^IXIC'))">
                  <span class="m-name">纳斯达克</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.indices, '^IXIC')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.indices, '^IXIC')?.change_pct) }}</span>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.indices, '^GSPC')?.change_pct)" :title="buildQuoteSourceTooltip(getMarketItem(displayMarketData.indices, '^GSPC'))">
                  <span class="m-name">标普500</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.indices, '^GSPC')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.indices, '^GSPC')?.change_pct) }}</span>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.indices, '^DJI')?.change_pct)" :title="buildQuoteSourceTooltip(getMarketItem(displayMarketData.indices, '^DJI'))">
                  <span class="m-name">道琼斯</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.indices, '^DJI')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.indices, '^DJI')?.change_pct) }}</span>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.indices, '^RUT')?.change_pct)" :title="buildQuoteSourceTooltip(getMarketItem(displayMarketData.indices, '^RUT'))">
                  <span class="m-name">罗素2000</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.indices, '^RUT')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.indices, '^RUT')?.change_pct) }}</span>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.indices, '^VIX')?.change_pct)" :title="buildQuoteSourceTooltip(getMarketItem(displayMarketData.indices, '^VIX'))">
                  <span class="m-name">恐慌指数(VIX)</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.indices, '^VIX')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.indices, '^VIX')?.change_pct) }}</span>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.us_index_futures, 'NQ=F')?.change_pct)" :title="buildQuoteSourceTooltip(getMarketItem(displayMarketData.us_index_futures, 'NQ=F'))">
                  <span class="m-name">纳指期货</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.us_index_futures, 'NQ=F')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.us_index_futures, 'NQ=F')?.change_pct) }}</span>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.us_index_futures, 'ES=F')?.change_pct)" :title="buildQuoteSourceTooltip(getMarketItem(displayMarketData.us_index_futures, 'ES=F'))">
                  <span class="m-name">标普期货</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.us_index_futures, 'ES=F')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.us_index_futures, 'ES=F')?.change_pct) }}</span>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.us_index_futures, 'YM=F')?.change_pct)" :title="buildQuoteSourceTooltip(getMarketItem(displayMarketData.us_index_futures, 'YM=F'))">
                  <span class="m-name">道指期货</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.us_index_futures, 'YM=F')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.us_index_futures, 'YM=F')?.change_pct) }}</span>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.us_index_futures, 'RTY=F')?.change_pct)" :title="buildQuoteSourceTooltip(getMarketItem(displayMarketData.us_index_futures, 'RTY=F'))">
                  <span class="m-name">罗素期货</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.us_index_futures, 'RTY=F')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.us_index_futures, 'RTY=F')?.change_pct) }}</span>
                </div>
              </div>
            </v-window-item>

            <!-- 2. 中国资产 -->
            <v-window-item value="china">
              <div class="market-indices">
                <div class="market-item" v-for="(symbol, index) in ['FXI', '2823.HK', 'PGJ', 'BABA', 'PDD', 'JD', 'NIO']" :key="index"
                     :class="getChangeClass(getMarketItem(displayMarketData.china_concepts, symbol)?.change_pct)">
                  <span class="m-name">{{ getMarketItem(displayMarketData.china_concepts, symbol)?.name || symbol }}</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.china_concepts, symbol)?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.china_concepts, symbol)?.change_pct) }}</span>
                </div>
              </div>
            </v-window-item>

            <!-- 3. 科技巨头 -->
            <v-window-item value="tech">
              <div class="market-indices">
                <div class="market-item" v-for="(symbol, index) in ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'GOOG', 'META', 'AMZN', 'AMD', 'INTC']" :key="index"
                     :class="getChangeClass(getMarketItem(displayMarketData.tech_giants, symbol)?.change_pct)">
                  <span class="m-name">{{ getMarketItem(displayMarketData.tech_giants, symbol)?.name || symbol }}</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.tech_giants, symbol)?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.tech_giants, symbol)?.change_pct) }}</span>
                </div>
              </div>
            </v-window-item>

            <!-- 4. 商品外汇 -->
            <v-window-item value="commodities">
              <div class="market-indices">
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.commodities, 'GC=F')?.change_pct)">
                  <span class="m-name">黄金</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.commodities, 'GC=F')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.commodities, 'GC=F')?.change_pct) }}</span>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.commodities, 'SI=F')?.change_pct)">
                  <span class="m-name">白银</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.commodities, 'SI=F')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.commodities, 'SI=F')?.change_pct) }}</span>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.commodities, 'CL=F')?.change_pct)">
                  <span class="m-name">原油</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.commodities, 'CL=F')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.commodities, 'CL=F')?.change_pct) }}</span>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.forex, 'CNH=X')?.change_pct)">
                  <span class="m-name">离岸人民币</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.forex, 'CNH=X')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.forex, 'CNH=X')?.change_pct) }}</span>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.forex, 'DX-Y.NYB')?.change_pct)">
                  <span class="m-name">美元指数</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.forex, 'DX-Y.NYB')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.forex, 'DX-Y.NYB')?.change_pct) }}</span>
                </div>
              </div>
            </v-window-item>
            
            <!-- 5. 债券加密 -->
            <v-window-item value="other">
               <div class="market-indices">
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.bonds, '^TNX')?.change_pct)">
                  <span class="m-name">10年美债</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.bonds, '^TNX')?.price) }}%</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.bonds, '^TNX')?.change_pct) }}</span>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.crypto, 'BTC-USD')?.change_pct)">
                  <span class="m-name">比特币</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.crypto, 'BTC-USD')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.crypto, 'BTC-USD')?.change_pct) }}</span>
                </div>
                 <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.crypto, 'ETH-USD')?.change_pct)">
                  <span class="m-name">以太坊</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.crypto, 'ETH-USD')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.crypto, 'ETH-USD')?.change_pct) }}</span>
                </div>
               </div>
            </v-window-item>

          </v-window>
        </div>

        <!-- AI 分析报告区：与上方行情解耦；过时提示仅出现在此区域 -->
        <div class="analysis-report-region">
          <div class="report-region-header">
            <h4 class="report-region-title">📝 AI 分析报告</h4>
            <p v-if="analysisTimestamp" class="report-meta">
              本段文字与量化打分基于 <strong>{{ formatDateTime(analysisTimestamp) }}</strong> 生成时的行情与新闻摘要。
              <template v-if="isShowingLiveQuotes && liveSyncedAtMax">
                当前页顶部报价已更新至 <strong>{{ formatDateTime(liveSyncedAtMax) }}</strong>（库内同步），二者不完全一致属正常；若关键标的波动显著，请以顶部数字为准并考虑重新分析。
              </template>
            </p>
          </div>

          <div v-if="watchdogAlert" class="stale-report-alert">
            <v-alert density="compact" type="warning" variant="tonal" class="mb-0">
              <div class="d-flex flex-column flex-sm-row justify-space-between stale-report-alert-row">
                <span class="stale-report-text">
                  <strong>报告可能已滞后</strong>：自分析完成以来，
                  <strong>{{ watchdogAlert.name }}</strong> 相对当时用于分析的快照价已
                  {{ watchdogAlert.direction === 'up' ? '上涨' : '下跌' }}约 <strong>{{ watchdogAlert.diffPct }}%</strong>
                 （分析时参考价 {{ formatNumber(watchdogAlert.snapshotPrice) }} → 当前库内价 {{ formatNumber(watchdogAlert.currentPrice) }}）。
                  下方结论未自动重写，专业版可点击「刷新分析」触发重新研判。
                </span>
                <v-btn
                  v-if="canTriggerGlobalAnalysis"
                  size="x-small"
                  color="warning"
                  variant="flat"
                  class="align-self-start flex-shrink-0"
                  @click="refreshAnalysis"
                  :loading="refreshing"
                >
                  刷新分析
                </v-btn>
              </div>
            </v-alert>
          </div>

        <!-- Step 1: 国外市场分析 -->
        <div v-if="brief.foreign_impact" class="analysis-section foreign-section">
          <h4 class="section-title">📊 国外市场影响</h4>
          <p class="analysis-content">{{ brief.foreign_impact }}</p>
        </div>

        <!-- Step 2: 国内政策对冲 (核心) -->
        <div v-if="brief.policy_hedge" class="analysis-section policy-section highlight">
          <h4 class="section-title">🏛️ 国内政策对冲<span class="key-badge">KEY</span></h4>
          <p class="analysis-content">{{ brief.policy_hedge }}</p>
        </div>

        <!-- Step 3: 综合影响 -->
        <div v-if="brief.net_impact" class="analysis-section net-impact-section">
          <h4 class="section-title">💡 综合影响评估</h4>
          <p class="analysis-content">{{ brief.net_impact }}</p>
        </div>

        <!-- 推荐板块 -->
        <div v-if="brief.key_sectors && brief.key_sectors.length" class="sectors-section">
          <h4 class="section-title">🎯 推荐板块</h4>
          <div class="sectors-grid">
            <v-chip 
              v-for="(sector, index) in brief.key_sectors" 
              :key="index"
              color="primary"
              variant="tonal"
              class="sector-chip"
            >
              {{ sector }}
            </v-chip>
          </div>
          <p v-if="brief.logic" class="logic-text">{{ brief.logic }}</p>
        </div>

        <!-- 风险提示 -->
        <div class="risk-box" v-if="brief.risk_factors && brief.risk_factors.length">
          <h4>⚠️ 风险提示</h4>
          <ul>
            <li v-for="risk in brief.risk_factors" :key="risk">{{ risk }}</li>
          </ul>
        </div>

        <!-- 兼容旧版数据结构 (可选) -->
        <div v-if="!brief.foreign_impact && brief.summary" class="legacy-format">
          <div class="summary-section">
            <p class="main-summary">{{ brief.summary }}</p>
          </div>

          <div class="events-grid" v-if="brief.key_events">
            <div v-for="(event, index) in brief.key_events" :key="index" class="event-item">
              <div class="event-header">
                <span class="event-title">{{ event.event }}</span>
                <v-chip size="x-small" :color="getStrengthColor(event.strength)" variant="flat">
                  {{ event.strength }}
                </v-chip>
              </div>
              <div class="impact-mapping">
                <span class="impact-label">映射板块:</span>
                <span class="impact-sector">{{ event.impact_sector }}</span>
              </div>
              <p class="logic-text">{{ event.logic }}</p>
            </div>
          </div>

          <div class="suggestion-box" v-if="brief.trading_suggestion">
            <h4>💡 今日建议</h4>
            <p>{{ brief.trading_suggestion }}</p>
          </div>
        </div>
        </div>
      </div>

      <div v-if="!brief && !loading && !error" class="empty-state">
        <p>📡 暂无隔夜全球数据，请等待 08:30 自动简报生成</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import request from '../utils/request'
import { mdiRefresh, mdiHelpCircleOutline } from '@mdi/js'
import { useAuth } from '../services/auth.js'
import { canUseProFeature } from '../utils/entitlements'

const loading = ref(false)
const error = ref('')
const analysisResult = ref(null)
const activeMarketTab = ref('indices')
const showScoreHelp = ref(false)
const { user } = useAuth()
const canTriggerGlobalAnalysis = computed(() => canUseProFeature(user.value))
const showQuoteDebug = computed(() => {
  try {
    let value = new URLSearchParams(window.location.search).get('debugQuote')
    if (!value && window.location.hash && window.location.hash.includes('?')) {
      const hashQuery = window.location.hash.split('?')[1] || ''
      value = new URLSearchParams(hashQuery).get('debugQuote')
    }
    if (!value) return false
    const v = value.toLowerCase()
    return v === '1' || v === 'true' || v === 'yes'
  } catch (_) {
    return false
  }
})

// 提取数据
// 后端现在直接返回 { categories: { indices: {...}, ... } }
const brief = computed(() => analysisResult.value?.analysis || null)
/** 写入 global_analysis 文档时的行情快照（LLM 当时所见） */
const snapshotMarketData = computed(() => {
  const data = analysisResult.value?.market_data
  return data?.categories || data || null
})

const liveDashboardPayload = ref(null)

const displayMarketData = computed(() => {
  const live = liveDashboardPayload.value?.categories
  if (live && typeof live === 'object') {
    const hasAny = Object.keys(live).some(
      (cat) => live[cat] && typeof live[cat] === 'object' && Object.keys(live[cat]).length > 0
    )
    if (hasAny) return live
  }
  return snapshotMarketData.value
})

const isShowingLiveQuotes = computed(() => {
  const live = liveDashboardPayload.value?.categories
  if (!live || typeof live !== 'object') return false
  return Object.keys(live).some(
    (cat) => live[cat] && typeof live[cat] === 'object' && Object.keys(live[cat]).length > 0
  )
})

const liveSyncedAtMax = computed(() => liveDashboardPayload.value?.synced_at_max || null)
const liveSourceNote = computed(() => liveDashboardPayload.value?.source_note || 'Yahoo Finance（经同步任务入库）')

const analysisTimestamp = computed(() => analysisResult.value?.analyzed_at || analysisResult.value?.timestamp)
const marketDate = computed(() => {
  if (!displayMarketData.value?.indices) return null
  const ixic = displayMarketData.value.indices['^IXIC']
  if (ixic?.date) return ixic.date
  const firstKey = Object.keys(displayMarketData.value.indices)[0]
  return displayMarketData.value.indices[firstKey]?.date || null
})

// --- 库内最新价 vs 分析快照：仅在报告区提示，不遮挡顶部行情 ---
const watchdogAlert = ref(null)
let livePollTimer = null
let pollInFlight = false

const WATCH_SYMBOLS = ['NQ=F', 'ES=F', 'YM=F', 'RTY=F', 'FXI', 'GC=F']

function getItemFromCategories(categories, sym) {
  if (!categories || typeof categories !== 'object') return null
  const order = ['indices', 'us_index_futures', 'china_concepts', 'tech_giants', 'commodities', 'forex', 'bonds', 'crypto']
  for (const cat of order) {
    const bucket = categories[cat]
    if (bucket && bucket[sym]) return bucket[sym]
  }
  return null
}

function checkStaleVsSnapshot() {
  const snap = snapshotMarketData.value
  const live = liveDashboardPayload.value?.categories
  if (!snap || !live) {
    watchdogAlert.value = null
    return
  }
  for (const sym of WATCH_SYMBOLS) {
    const snapshotItem = getItemFromCategories(snap, sym)
    const liveItem = getItemFromCategories(live, sym)
    if (!snapshotItem || !liveItem) continue
    const snapPrice = Number(snapshotItem.price)
    const currPrice = Number(liveItem.price)
    if (!Number.isFinite(snapPrice) || snapPrice === 0 || !Number.isFinite(currPrice)) continue
    const diff = Math.abs(currPrice - snapPrice)
    const pct = (diff / snapPrice) * 100
    if (pct > 1.0) {
      watchdogAlert.value = {
        symbol: sym,
        name: snapshotItem.name || sym,
        diffPct: pct.toFixed(1),
        currentPrice: currPrice,
        snapshotPrice: snapPrice,
        direction: currPrice > snapPrice ? 'up' : 'down',
      }
      return
    }
  }
  watchdogAlert.value = null
}

async function fetchLiveDashboard() {
  if (!brief.value) return
  if (pollInFlight) return
  pollInFlight = true
  try {
    const res = await request.get('/global-market-dashboard', {
      timeout: 120000,
      silentErrorLog: true,
    })
    if (res.success && res.data) {
      liveDashboardPayload.value = res.data
      checkStaleVsSnapshot()
    }
  } catch (e) {
    if (e?.code !== 'ECONNABORTED') {
      console.warn('[GlobalMarketBrief] 拉取 global-market-dashboard 失败:', e)
    }
  } finally {
    pollInFlight = false
  }
}

function startLivePoll() {
  stopLivePoll()
  const tick = async () => {
    if (!brief.value) return
    await fetchLiveDashboard()
  }
  void tick()
  livePollTimer = setInterval(tick, 60 * 1000)
}

function stopLivePoll() {
  if (livePollTimer) clearInterval(livePollTimer)
  livePollTimer = null
}

async function fetchGlobalAnalysis() {
  loading.value = true
  error.value = ''
  try {
    // 后端默认裁剪 market_data 体积；全量调试可改为 params: { full: 'true' }
    const data = await request.get('/global-analysis', { timeout: 120000 })
    if (data.success) {
      analysisResult.value = data.data
      if (analysisResult.value?.analysis) {
        void fetchLiveDashboard()
        startLivePoll()
      } else {
        stopLivePoll()
        liveDashboardPayload.value = null
        watchdogAlert.value = null
      }
    } else {
      if (!data.error?.includes('今日尚无')) {
        error.value = data.error
      }
      if (data.error?.includes('今日尚无')) {
        analysisResult.value = null
        stopLivePoll()
        liveDashboardPayload.value = null
        watchdogAlert.value = null
      }
    }
  } catch (err) {
    if (err?.code === 'ECONNABORTED') {
      console.warn('[GlobalMarketBrief] 全球市场分析请求超时（已 120s），请检查 analyzer DB 与网络')
    } else {
      console.error('Failed to fetch global analysis:', err)
    }
  } finally {
    loading.value = false
  }
}

function formatDateTime(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatTime(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// 现在的 collection 是一个 dict，直接取值
function getMarketItem(collection, symbol) {
  if (!collection) return null
  return collection[symbol]
}

function buildQuoteSourceTooltip(item) {
  if (!showQuoteDebug.value || !item) return ''

  const changeSource = item.change_pct_source || ''
  const prevSource = item.prev_close_source || ''
  if (!changeSource && !prevSource) {
    return '数据口径说明\n暂无来源字段（请先运行新版 global sync 写入来源字段）'
  }

  const parts = ['数据口径说明']
  if (changeSource) parts.push(`涨跌幅来源: ${changeSource}`)
  if (prevSource) parts.push(`前收来源: ${prevSource}`)
  if (item.prev_close !== undefined && item.prev_close !== null) {
    parts.push(`前收值: ${formatNumber(item.prev_close)}`)
  }
  return parts.join('\n')
}

function formatNumber(num) {
  if (num === undefined || num === null) return '--'
  return Number(num).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function formatPercent(num) {
  if (num === undefined || num === null) return '--'
  const val = Number(num)
  return (val > 0 ? '+' : '') + val.toFixed(2) + '%'
}

function formatScore(num) {
  if (num === undefined || num === null || num === '') return '--'
  const val = Number(num)
  if (Number.isNaN(val)) return '--'
  return Math.round(val)
}

function normalizeScore(num) {
  if (num === undefined || num === null || num === '') return null
  const val = Number(num)
  if (Number.isNaN(val)) return null
  return Math.max(0, Math.min(100, Math.round(val)))
}

function buildScoreInsight(score, type) {
  if (score === null) {
    return { value: '--', level: '未知', text: '当前暂无有效数据。' }
  }

  if (type === 'international') {
    if (score >= 70) return { value: score, level: '高', text: '外部风险冲击较强，地缘与全球风险偏好对A股影响偏负。' }
    if (score >= 55) return { value: score, level: '中高', text: '外部扰动存在，开盘情绪可能偏谨慎。' }
    if (score >= 40) return { value: score, level: '中性', text: '外部冲击可控，更多取决于国内资金与政策。' }
    return { value: score, level: '低', text: '外部冲击有限，海外因素压制较弱。' }
  }

  if (type === 'domestic') {
    if (score >= 70) return { value: score, level: '强', text: '国内政策与产业支撑较强，具备明显对冲能力。' }
    if (score >= 55) return { value: score, level: '中强', text: '国内托底力度尚可，可部分对冲外部波动。' }
    if (score >= 40) return { value: score, level: '中性', text: '国内对冲力度一般，难以完全抵消外部冲击。' }
    return { value: score, level: '弱', text: '国内对冲偏弱，市场更易受外部风险牵引。' }
  }

  if (score >= 60) return { value: score, level: '偏多', text: '综合影响偏正，风险偏好有改善空间。' }
  if (score >= 45) return { value: score, level: '中性偏谨慎', text: '多空因素交织，建议以节奏和仓位控制为主。' }
  return { value: score, level: '偏空', text: '综合影响偏负，防守与风控优先。' }
}

const scoreInterpretation = computed(() => {
  const b = brief.value || {}
  const international = buildScoreInsight(normalizeScore(b.international_shock_score), 'international')
  const domestic = buildScoreInsight(normalizeScore(b.domestic_hedge_score), 'domestic')
  const net = buildScoreInsight(normalizeScore(b.net_impact_score), 'net')

  let summary = '当前数据不足，建议结合盘中走势再判断。'
  if (net.value !== '--') {
    if (net.level === '偏多') {
      summary = '净影响偏多，可适度提高风险偏好，但仍需观察外部事件是否反复。'
    } else if (net.level === '偏空') {
      summary = '净影响偏空，建议控制追涨，优先防守和仓位管理。'
    } else {
      summary = '净影响中性偏谨慎，建议结构化配置并保持策略弹性。'
    }
  }

  return { international, domestic, net, summary }
})

function getChangeClass(change, inverse = false) {
  if (change === undefined || change === null) return ''
  const val = Number(change)
  if (val === 0) return 'text-neutral'
  
  if (inverse) {
    // For pairs like CNH, up is depreciation (bad for assets usually), but context dependent.
    // Let's stick to standard: Up = Red (China style), Down = Green
    return val > 0 ? 'text-up' : 'text-down'
  }
  return val > 0 ? 'text-up' : 'text-down'
}

function getSentimentClass(score) {
  if (score >= 65) return 'sentiment-bullish'
  if (score <= 35) return 'sentiment-bearish'
  return 'sentiment-neutral'
}

function getStrengthColor(strength) {
  const s = strength?.toLowerCase() || ''
  if (s.includes('high') || s.includes('高')) return 'error'
  if (s.includes('medium') || s.includes('中')) return 'warning'
  return 'success'
}

onMounted(() => {
  fetchGlobalAnalysis()
})

onUnmounted(() => {
  stopLivePoll()
})

const refreshing = ref(false)

async function refreshAnalysis() {
  if (refreshing.value) return
  
  refreshing.value = true
  try {
    // 1. Trigger backend analysis
    const res = await request.post('/analyze-global')
    
    if (res.success) {
      // 2. Clear current analysis temporarily or show loading state
      // loading.value = true -- maybe not, just keep showing old one with a loading indicator
      
      // 3. Wait a bit for the async task to be picked up (optional)
      // Since it's async, we can't wait for completion here easily without polling.
      // We'll just reload the current data after a short delay in case it was a fast update or just to confirm "pending" status if we had that.
      // But mainly we want to tell user it's started.
      
      // For better UX, we could use a snackbar, but here we'll just reload data after 2 seconds
      setTimeout(() => {
        fetchGlobalAnalysis()
        refreshing.value = false
      }, 2000)
    } else {
      console.error('Trigger analysis failed:', res.error)
      refreshing.value = false
    }
  } catch (e) {
    console.error('Trigger analysis error:', e)
    refreshing.value = false
  }
}
</script>

<style scoped>
.global-brief-card {
  background: white;
  border-radius: 12px;
  border: 1px solid #e1e8ed;
  margin-bottom: 20px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.card-header {
  background: #1a202c;
  color: white;
  padding: 12px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-main h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-time {
  font-size: 12px;
  color: #a0aec0;
  margin-left: 4px;
}

.pro-hint {
  margin-left: 6px;
  font-size: 11px;
  color: #cbd5e0;
}

.sentiment-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2px 10px;
  border-radius: 8px;
  background: rgba(255,255,255,0.1);
}

.sentiment-indicator .score {
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}

.sentiment-indicator .label {
  font-size: 10px;
  text-transform: uppercase;
  opacity: 0.8;
}

.sentiment-bullish { color: #48bb78; border-left: 4px solid #48bb78; }
.sentiment-bearish { color: #f56565; border-left: 4px solid #f56565; }
.sentiment-neutral { color: #ecc94b; border-left: 4px solid #ecc94b; }

.card-content {
  padding: 16px 20px;
  min-height: 100px;
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  color: #718096;
  font-size: 14px;
  gap: 12px;
}

.main-summary {
  font-size: 15px;
  font-weight: 500;
  color: #2d3748;
  line-height: 1.5;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px dashed #edf2f7;
}

.events-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.event-item {
  background: #f7fafc;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #edf2f7;
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.event-title {
  font-weight: 700;
  color: #1a202c;
  font-size: 14px;
}

.impact-mapping {
  font-size: 13px;
  margin-bottom: 6px;
  display: flex;
  gap: 6px;
}

.impact-label { color: #718096; }
.impact-sector { color: #3182ce; font-weight: 600; }

.logic-text {
  font-size: 12px;
  color: #4a5568;
  line-height: 1.4;
}

.bottom-sections {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 768px) {
  .bottom-sections { grid-template-columns: 1fr; }
}

.suggestion-box, .risk-box {
  padding: 12px;
  border-radius: 8px;
  font-size: 13px;
}

.suggestion-box {
  background: #ebf8ff;
  border: 1px solid #bee3f8;
  color: #2a4365;
}

.risk-box {
  background: #fff5f5;
  border: 1px solid #fed7d7;
  color: #742a2a;
}

.suggestion-box h4, .risk-box h4 {
  margin: 0 0 6px 0;
  font-size: 14px;
}

.risk-box ul {
  margin: 0;
  padding-left: 18px;
}

/* 新样式：三步骤分析 */
.analysis-section {
  background: #ffffff;
  border: 1px solid #e1e8ed;
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 12px;
}

.score-strip {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.score-strip-wrap {
  margin-bottom: 12px;
}

.score-strip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.score-strip-title {
  font-size: 12px;
  color: #4a5568;
  font-weight: 600;
}

.score-help-panel {
  border: 1px solid #dbeafe;
  background: #f8fbff;
  border-radius: 10px;
  padding: 8px 10px;
  margin-bottom: 8px;
}

.score-help-line {
  margin: 0 0 4px 0;
  font-size: 12px;
  color: #2d3748;
  line-height: 1.5;
}

.score-help-summary {
  margin: 6px 0 0 0;
  font-size: 12px;
  color: #1a365d;
  font-weight: 600;
}

.score-pill {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}

.pill-label {
  font-size: 12px;
  color: #4a5568;
}

.pill-value {
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
}

.score-international .pill-value { color: #c53030; }
.score-domestic .pill-value { color: #2b6cb0; }
.score-net .pill-value { color: #2f855a; }

.analysis-section.highlight {
  background: linear-gradient(135deg, #ebf8ff 0%, #f0fff4 100%);
  border: 2px solid #4299e1;
  box-shadow: 0 2px 12px rgba(66, 153, 225, 0.15);
}

.section-title {
  margin: 0 0 10px 0;
  font-size: 14px;
  font-weight: 600;
  color: #1a202c;
  display: flex;
  align-items: center;
  gap: 6px;
}

.key-badge {
  background: #48bb78;
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 700;
  margin-left: 4px;
}

.analysis-content {
  font-size: 13px;
  color: #2d3748;
  line-height: 1.6;
  margin: 0;
}

.sectors-section {
  background: #f7fafc;
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 12px;
}

.sectors-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.sector-chip {
  font-weight: 500;
}

.logic-text {
  font-size: 12px;
  color: #4a5568;
  margin: 0;
}

/* 市场数据仪表盘样式 */
.market-dashboard {
  background: #f8f9fa;
  border-bottom: 1px solid #e1e8ed;
  padding: 12px 16px;
  margin: -16px -20px 16px -20px; /* 撑满卡片宽度 */
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.dashboard-header h4 {
  margin: 0;
  font-size: 13px;
  color: #4a5568;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.dashboard-footnote {
  margin: 0 0 10px 0;
  font-size: 11px;
  color: #718096;
  line-height: 1.45;
}

.analysis-report-region {
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px dashed #e2e8f0;
}

.report-region-header {
  margin-bottom: 10px;
}

.report-region-title {
  margin: 0 0 6px 0;
  font-size: 14px;
  font-weight: 600;
  color: #1a202c;
}

.report-meta {
  margin: 0;
  font-size: 12px;
  color: #4a5568;
  line-height: 1.55;
}

.stale-report-alert {
  margin-bottom: 12px;
  animation: fadeIn 0.35s ease-out;
}

.stale-report-alert-row {
  gap: 10px;
}

.stale-report-text {
  font-size: 12px;
  line-height: 1.5;
}

.snap-time {
  font-weight: normal;
  margin-left: 6px;
  font-size: 11px;
}

.market-indices {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.market-item {
  display: flex;
  flex-direction: column;
  min-width: 80px;
}

.m-name {
  font-size: 10px;
  color: #718096;
  margin-bottom: 2px;
  white-space: nowrap;
}

.m-price {
  font-size: 13px;
  font-weight: 600;
  font-family: 'Roboto Mono', monospace;
  color: #2d3748;
  line-height: 1.2;
}

.m-change {
  font-size: 11px;
  font-weight: 500;
}

.text-up { color: #f56565; }
.text-down { color: #48bb78; }
.text-neutral { color: #a0aec0; }

.market-tabs {
  border-bottom: 1px solid #edf2f7;
  margin-left: -16px;
  margin-right: -16px;
  padding-left: 16px;
  padding-right: 16px; 
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
