<template>
  <div class="global-brief-card">
    <div class="card-header">
      <div class="header-main">
        <h3>🌍 隔夜全球市场联动分析</h3>
        <span v-if="analysisTimestamp" class="header-time">
          ({{ formatDateTime(analysisTimestamp) }} 分析)
        </span>
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

      <!-- Watchdog Alert -->
      <div v-if="watchdogAlert" class="watchdog-alert">
        <v-alert
          density="compact"
          type="warning"
          variant="tonal"
          icon="mdi-alert-circle-outline"
          class="mb-2"
        >
          <div class="d-flex justify-space-between align-center">
            <span style="font-size: 13px">
              <strong>市场剧烈波动</strong>: {{ watchdogAlert.name }} 
              {{ watchdogAlert.direction === 'up' ? '上涨' : '下跌' }} {{ watchdogAlert.diffPct }}% 
              (现价 {{ formatNumber(watchdogAlert.currentPrice) }})，分析可能过时。
            </span>
            <v-btn
              size="x-small"
              color="warning"
              variant="flat"
              @click="$emit('refresh')"
              :loading="loading"
            >
              刷新分析
            </v-btn>
          </div>
        </v-alert>
      </div>

      <div v-else-if="brief" class="brief-body">
        
        <!-- 新增：市场数据仪表盘 (数据快照) -->
        <div v-if="marketData" class="market-dashboard">
          <div class="dashboard-header">
            <h4>📉 市场数据快照 <span class="snap-time" v-if="marketDate">({{ marketDate }} 收盘)</span><span class="snap-time" v-else-if="analysisTimestamp">({{ formatTime(analysisTimestamp) }})</span></h4>
            <v-chip size="x-small" color="grey" variant="outlined">快照数据</v-chip>
          </div>

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
                <div class="market-item" :class="getChangeClass(getMarketItem(marketData.indices, '^IXIC')?.change_pct)">
                  <span class="m-name">纳斯达克</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(marketData.indices, '^IXIC')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(marketData.indices, '^IXIC')?.change_pct) }}</span>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(marketData.indices, '^GSPC')?.change_pct)">
                  <span class="m-name">标普500</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(marketData.indices, '^GSPC')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(marketData.indices, '^GSPC')?.change_pct) }}</span>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(marketData.indices, '^DJI')?.change_pct)">
                  <span class="m-name">道琼斯</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(marketData.indices, '^DJI')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(marketData.indices, '^DJI')?.change_pct) }}</span>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(marketData.indices, '^RUT')?.change_pct)">
                  <span class="m-name">罗素2000</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(marketData.indices, '^RUT')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(marketData.indices, '^RUT')?.change_pct) }}</span>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(marketData.indices, '^VIX')?.change_pct)">
                  <span class="m-name">恐慌指数(VIX)</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(marketData.indices, '^VIX')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(marketData.indices, '^VIX')?.change_pct) }}</span>
                </div>
              </div>
            </v-window-item>

            <!-- 2. 中国资产 -->
            <v-window-item value="china">
              <div class="market-indices">
                <div class="market-item" v-for="(symbol, index) in ['FXI', '2823.HK', 'PGJ', 'BABA', 'PDD', 'JD', 'NIO']" :key="index"
                     :class="getChangeClass(getMarketItem(marketData.china_concepts, symbol)?.change_pct)">
                  <span class="m-name">{{ getMarketItem(marketData.china_concepts, symbol)?.name || symbol }}</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(marketData.china_concepts, symbol)?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(marketData.china_concepts, symbol)?.change_pct) }}</span>
                </div>
              </div>
            </v-window-item>

            <!-- 3. 科技巨头 -->
            <v-window-item value="tech">
              <div class="market-indices">
                <div class="market-item" v-for="(symbol, index) in ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'GOOG', 'META', 'AMZN', 'AMD', 'INTC']" :key="index"
                     :class="getChangeClass(getMarketItem(marketData.tech_giants, symbol)?.change_pct)">
                  <span class="m-name">{{ getMarketItem(marketData.tech_giants, symbol)?.name || symbol }}</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(marketData.tech_giants, symbol)?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(marketData.tech_giants, symbol)?.change_pct) }}</span>
                </div>
              </div>
            </v-window-item>

            <!-- 4. 商品外汇 -->
            <v-window-item value="commodities">
              <div class="market-indices">
                <div class="market-item" :class="getChangeClass(getMarketItem(marketData.commodities, 'GC=F')?.change_pct)">
                  <span class="m-name">黄金</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(marketData.commodities, 'GC=F')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(marketData.commodities, 'GC=F')?.change_pct) }}</span>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(marketData.commodities, 'SI=F')?.change_pct)">
                  <span class="m-name">白银</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(marketData.commodities, 'SI=F')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(marketData.commodities, 'SI=F')?.change_pct) }}</span>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(marketData.commodities, 'CL=F')?.change_pct)">
                  <span class="m-name">原油</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(marketData.commodities, 'CL=F')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(marketData.commodities, 'CL=F')?.change_pct) }}</span>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(marketData.forex, 'CNH=X')?.change_pct)">
                  <span class="m-name">离岸人民币</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(marketData.forex, 'CNH=X')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(marketData.forex, 'CNH=X')?.change_pct) }}</span>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(marketData.forex, 'DX-Y.NYB')?.change_pct)">
                  <span class="m-name">美元指数</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(marketData.forex, 'DX-Y.NYB')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(marketData.forex, 'DX-Y.NYB')?.change_pct) }}</span>
                </div>
              </div>
            </v-window-item>
            
            <!-- 5. 债券加密 -->
            <v-window-item value="other">
               <div class="market-indices">
                <div class="market-item" :class="getChangeClass(getMarketItem(marketData.bonds, '^TNX')?.change_pct)">
                  <span class="m-name">10年美债</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(marketData.bonds, '^TNX')?.price) }}%</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(marketData.bonds, '^TNX')?.change_pct) }}</span>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(marketData.crypto, 'BTC-USD')?.change_pct)">
                  <span class="m-name">比特币</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(marketData.crypto, 'BTC-USD')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(marketData.crypto, 'BTC-USD')?.change_pct) }}</span>
                </div>
                 <div class="market-item" :class="getChangeClass(getMarketItem(marketData.crypto, 'ETH-USD')?.change_pct)">
                  <span class="m-name">以太坊</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(marketData.crypto, 'ETH-USD')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(marketData.crypto, 'ETH-USD')?.change_pct) }}</span>
                </div>
               </div>
            </v-window-item>

          </v-window>
        </div>

        <!-- 三步骤分析展示 -->
        
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

      <div v-else class="empty-state">
        <p>📡 暂无隔夜全球数据，请等待 08:30 自动简报生成</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const loading = ref(false)
const error = ref('')
const analysisResult = ref(null)
const activeMarketTab = ref('indices')

// 提取数据
// 后端现在直接返回 { categories: { indices: {...}, ... } }
const brief = computed(() => analysisResult.value?.analysis || null)
const marketData = computed(() => {
  const data = analysisResult.value?.market_data
  // 如果后端返回的就是 categories 字典，直接用
  return data?.categories || data || null
})
const analysisTimestamp = computed(() => analysisResult.value?.analyzed_at || analysisResult.value?.timestamp)
const marketDate = computed(() => {
  if (!marketData.value?.indices) return null
  const ixic = marketData.value.indices['^IXIC']
  if (ixic?.date) return ixic.date
  // Fallback to any item
  const firstKey = Object.keys(marketData.value.indices)[0]
  return marketData.value.indices[firstKey]?.date || null
})

// --- Watchdog Logic Start ---
const watchdogAlert = ref(null) // { symbol: 'FXI', diffPct: 1.2, currentPrice: 38.5 }
let watchdogTimer = null

// 监控列表：需要监控的符号
const WATCH_SYMBOLS = ['^IXIC', 'FXI', 'GC=F']

async function runWatchdog() {
  if (!marketData.value) return
  
  try {
    const symbols = WATCH_SYMBOLS.join(',')
    const res = await axios.get(`/api/market-quotes?symbols=${symbols}`)
    if (res.data.success) {
      const quotes = res.data.data
      
      // 检查偏差
      for (const sym of WATCH_SYMBOLS) {
        // 找到快照价格
        let snapshotItem = null
        if (marketData.value.indices && marketData.value.indices[sym]) snapshotItem = marketData.value.indices[sym]
        else if (marketData.value.commodities && marketData.value.commodities[sym]) snapshotItem = marketData.value.commodities[sym]
        
        if (snapshotItem && quotes[sym]) {
          const snapPrice = snapshotItem.price
          const currPrice = quotes[sym].price
          const diff = Math.abs(currPrice - snapPrice)
          const pct = (diff / snapPrice) * 100
          
          // 阈值：1%
          if (pct > 1.0) {
            watchdogAlert.value = {
              symbol: sym,
              name: snapshotItem.name,
              diffPct: pct.toFixed(1),
              currentPrice: currPrice,
              direction: currPrice > snapPrice ? 'up' : 'down'
            }
            return // 只有有一个告警就够了
          }
        }
      }
      // 如果没有偏差，清除告警
      watchdogAlert.value = null
    }
  } catch (e) {
    console.error("Watchdog check failed:", e)
  }
}

function startWatchdog() {
  stopWatchdog()
  // Run immediately then interval
  runWatchdog()
  watchdogTimer = setInterval(runWatchdog, 60 * 1000) // 60s
}

function stopWatchdog() {
  if (watchdogTimer) clearInterval(watchdogTimer)
  watchdogTimer = null
}
// --- Watchdog Logic End ---

// Hook into lifecycle
onMounted(() => {
  fetchGlobalAnalysis().then(() => {
    // Start watchdog if analysis exists
    if (analysisResult.value) startWatchdog()
  })
})

import { onUnmounted } from 'vue'
onUnmounted(() => {
  stopWatchdog()
})

async function fetchGlobalAnalysis() {
  loading.value = true
  error.value = ''
  try {
    const response = await axios.get('/api/global-analysis')
    if (response.data.success) {
      analysisResult.value = response.data.data
    } else {
      if (!response.data.error.includes('今日尚无')) {
        error.value = response.data.error
      }
    }
  } catch (err) {
    console.error('Failed to fetch global analysis:', err)
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

function formatNumber(num) {
  if (num === undefined || num === null) return '--'
  return Number(num).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function formatPercent(num) {
  if (num === undefined || num === null) return '--'
  const val = Number(num)
  return (val > 0 ? '+' : '') + val.toFixed(2) + '%'
}

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
  font-size: 12px;
  color: #718096;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
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

.watchdog-alert {
  animation: fadeIn 0.5s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
