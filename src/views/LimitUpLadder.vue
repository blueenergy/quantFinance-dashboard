<template>
  <v-container fluid class="limit-up-ladder pa-4">
    <!-- 页面标题和日期选择 -->
    <v-row class="mb-4">
      <v-col cols="12" md="6">
        <h1 class="text-h4 font-weight-bold">
          📊 连板天梯
          <span v-if="displayDate" class="text-h6 text-grey-lighten-1 ml-2">
            {{ displayDate }}
          </span>
        </h1>
        <p class="text-subtitle-1 text-grey mt-1">
          A股连板高度分布 · 板块资金流向 · 市场情绪追踪
        </p>
      </v-col>
      <v-col cols="12" md="6" class="d-flex align-center justify-end">
        <div class="d-flex align-center mr-4">
          <v-switch
            v-model="autoRefresh"
            color="primary"
            hide-details
            density="compact"
            class="mr-2"
            @update:model-value="handleAutoRefreshChange"
          >
            <template v-slot:label>
              <span class="text-caption text-grey-lighten-1">
                {{ autoRefresh ? `自动刷新 (${countdown}s)` : '自动刷新' }}
              </span>
            </template>
          </v-switch>
        </div>
        
        <div class="d-flex flex-column align-end mr-3">
          <span class="text-caption text-grey">上次更新</span>
          <span class="text-caption font-weight-medium">{{ lastUpdatedTime || '--:--:--' }}</span>
        </div>

        <v-text-field
          v-model="selectedDate"
          label="选择日期"
          type="date"
          density="compact"
          variant="outlined"
          hide-details
          style="max-width: 150px"
          @change="loadData"
        />
        <v-btn
          color="primary"
          class="ml-3"
          :loading="loading"
          variant="text"
          size="small"
          @click="loadData"
        >
          🔄
        </v-btn>
      </v-col>
    </v-row>

    <!-- 日期回退提示 -->
    <v-alert
      v-if="fallbackNote"
      type="info"
      variant="tonal"
      density="compact"
      class="mb-4"
      closable
    >
      ⏰ {{ fallbackNote }}（今日尚未收盘或非交易日）
    </v-alert>

    <!-- 情绪指标概览 -->
    <v-row v-if="indicators" class="mb-4">
      <v-col cols="6" md="3">
        <v-card class="sentiment-card" :class="getSentimentClass(indicators.sentiment_score)">
          <v-card-text class="text-center">
            <div class="text-h3 font-weight-bold">{{ indicators.sentiment_score }}</div>
            <div class="text-subtitle-2">{{ indicators.sentiment_level }}</div>
            <div class="text-caption text-grey">情绪得分</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card class="indicator-card">
          <v-card-text class="text-center">
            <div class="text-h3 font-weight-bold text-red">{{ indicators.total_limit_up }}</div>
            <div class="text-caption text-grey">涨停总数</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card class="indicator-card">
          <v-card-text class="text-center">
            <div class="text-h3 font-weight-bold text-orange">{{ indicators.high_tier_count }}</div>
            <div class="text-caption text-grey">高标数量（三板+）</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card class="indicator-card">
          <v-card-text class="text-center">
            <div class="text-h3 font-weight-bold text-purple">{{ formatPercent(indicators.promotion_rate) }}</div>
            <div class="text-caption text-grey">首板→二板晋级率</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 连板天梯主视图 -->
    <v-row>
      <!-- 左侧：天梯 -->
      <v-col cols="12" md="8">
        <v-card class="mb-4">
          <v-card-title class="d-flex align-center">
            <span>🏔️ 连板天梯</span>
            <v-chip v-if="indicators" size="small" class="ml-2" color="info">
              最高 {{ indicators.max_streak }}板
            </v-chip>
          </v-card-title>
          <v-card-text>
            <!-- 四板+ -->
            <ladder-tier-card
              v-if="tiers['4+'] && tiers['4+'].length > 0"
              tier="4+"
              icon="🏔️"
              color="red-darken-2"
              :stocks="tiers['4+']"
              :sector-aggregation="getSectorAggregation('4+')"
              @show-reasoning="handleShowReasoning"
            />
            
            <!-- 三板 -->
            <ladder-tier-card
              v-if="tiers['3'] && tiers['3'].length > 0"
              tier="3"
              icon="🌲"
              color="orange-darken-1"
              :stocks="tiers['3']"
              :sector-aggregation="getSectorAggregation('3')"
              @show-reasoning="handleShowReasoning"
            />
            
            <!-- 二板 -->
            <ladder-tier-card
              v-if="tiers['2'] && tiers['2'].length > 0"
              tier="2"
              icon="🌿"
              color="green-darken-1"
              :stocks="tiers['2']"
              :sector-aggregation="getSectorAggregation('2')"
              @show-reasoning="handleShowReasoning"
            />
            
            <!-- 首板 -->
            <ladder-tier-card
              v-if="tiers['1'] && tiers['1'].length > 0"
              tier="1"
              icon="🌱"
              color="blue-grey-darken-1"
              :stocks="tiers['1']"
              :sector-aggregation="getSectorAggregation('1')"
              :collapsed="true"
              @show-reasoning="handleShowReasoning"
            />

            <!-- 无数据 -->
            <v-alert v-if="!loading && Object.keys(tiers).every(k => !tiers[k] || tiers[k].length === 0)" type="info" variant="tonal">
              {{ selectedDate || '今日' }} 暂无涨停数据
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- 炸板股区域 -->
      <v-col cols="12" md="8" v-if="brokenLimitUps && brokenLimitUps.length > 0">
        <v-card class="mb-4" style="border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(30, 30, 40, 0.6);">
          <v-card-title class="text-subtitle-1 font-weight-bold text-grey-lighten-1">
            💥 炸板 / 开板 ({{ brokenLimitUps.length }})
          </v-card-title>
          <v-card-text>
            <v-chip-group column>
              <v-chip
                v-for="stock in brokenLimitUps"
                :key="stock.symbol"
                variant="flat"
                color="grey-darken-3"
                size="small"
                class="mr-2 mb-2"
                style="border: 1px solid #555"
                @click="handleShowReasoning(stock)"
              >
                <span class="mr-1 text-white font-weight-bold">{{ stock.name }}</span>
                <span class="text-caption text-grey-lighten-1 mr-1">{{ stock.symbol.split('.')[0] }}</span>
                
                <!-- Sustainability Tag -->
                <v-chip
                  v-if="stock.analysis && stock.analysis.sustainability"
                  size="x-small"
                  :color="getSustainabilityColor(stock.analysis.sustainability)"
                  class="ml-1 px-1"
                  variant="flat"
                  style="height: 16px; font-size: 10px;"
                >
                  回封: {{ getSustainabilityText(stock.analysis.sustainability) }}
                </v-chip>
              </v-chip>
            </v-chip-group>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- 右侧：板块排名 -->
      <v-col cols="12" md="4">
        <v-card class="mb-4">
          <v-card-title>
            <span>🔥 板块热度排名</span>
          </v-card-title>
          <v-card-text>
            <div v-for="(sector, index) in sectorRanking.slice(0, 10)" :key="sector.sector" class="sector-item mb-3">
              <div class="d-flex justify-space-between align-center mb-1">
                <div>
                  <span class="font-weight-medium">{{ index + 1 }}. {{ sector.sector }}</span>
                  <v-chip v-if="mainlines.includes(sector.sector)" size="x-small" color="red" class="ml-2">
                    主线
                  </v-chip>
                </div>
                <span class="text-caption">{{ sector.count }}只 · 平均{{ sector.avg_streak }}板</span>
              </div>
              <v-progress-linear
                :model-value="(sector.score / maxSectorScore) * 100"
                :color="index < 2 ? 'red' : index < 5 ? 'orange' : 'grey'"
                height="8"
                rounded
              />
            </div>
            
            <v-alert v-if="sectorRanking.length === 0 && !loading" type="info" variant="tonal" density="compact">
              暂无板块数据
            </v-alert>
          </v-card-text>
        </v-card>

        <!-- 主线板块提示 -->
        <v-card v-if="mainlines.length > 0">
          <v-card-title>
            <span>🎯 今日主线</span>
          </v-card-title>
          <v-card-text>
            <v-chip v-for="sector in mainlines" :key="sector" color="red" class="mr-2 mb-2">
              {{ sector }}
            </v-chip>
            <p class="text-caption text-grey mt-2">
              主线板块：连板数≥5且晋级率≥30%
            </p>
          </v-card-text>
        </v-card>

        <!-- 自选股分析 -->
        <analysis-card 
          type="watchlist" 
          :analyze-api="watchlistAnalyzeApi" 
          :get-latest-api="getLatestApi" 
          class="mt-4" 
        />
        
        <!-- 持仓分析 -->
        <analysis-card 
          type="positions" 
          :analyze-api="positionsAnalyzeApi" 
          :get-latest-api="getLatestApi" 
          class="mt-4" 
        />
      </v-col>
    </v-row>

    <!-- 加载遮罩 -->
    <v-overlay :model-value="loading" class="align-center justify-center" contained>
      <v-progress-circular indeterminate size="64" color="primary" />
    </v-overlay>

    <!-- 归因详情弹窗 -->
    <v-dialog v-model="showReasoningDialog" max-width="600">
      <v-card v-if="selectedStockReasoning">
        <v-card-title class="d-flex align-center bg-primary text-white">
          <span>🤖 智能归因：{{ selectedStockReasoning.name }} ({{ selectedStockReasoning.symbol }})</span>
          <v-spacer></v-spacer>
          <v-btn icon variant="text" @click="showReasoningDialog = false">✕</v-btn>
        </v-card-title>
        <v-card-text class="pa-4">
          <!-- 核心结论 -->
          <div class="mb-4">
            <div class="text-subtitle-1 font-weight-bold mb-1">💡 核心驱动</div>
            <v-chip color="purple-lighten-2" class="mr-2">{{ selectedStockReasoning.reasoning.tag }}</v-chip>
            <span class="text-body-1">{{ selectedStockReasoning.reasoning.reason }}</span>
          </div>

          <!-- 详细分析 -->
          <v-alert type="info" variant="tonal" class="mb-4">
            <div class="text-subtitle-2 font-weight-bold mb-1">详细分析</div>
            {{ selectedStockReasoning.reasoning.analysis }}
          </v-alert>

          <!-- 思考过程 (CoT) -->
          <div v-if="selectedStockReasoning.reasoning.thought_process_raw" class="mb-4">
            <div class="d-flex align-center mb-2">
              <v-btn
                variant="tonal"
                size="small"
                color="primary"
                prepend-icon="mdi-brain"
                @click="showThinking = !showThinking"
                class="mr-2"
              >
                {{ showThinking ? '隐藏' : '查看' }} AI 思考过程
              </v-btn>
              
              <v-fade-transition>
                <v-btn
                  v-if="showThinking"
                  variant="text"
                  size="small"
                  color="primary"
                  prepend-icon="mdi-fullscreen"
                  @click="isThinkingMaximized = true"
                >
                  全屏
                </v-btn>
              </v-fade-transition>
            </div>
            
            <v-expand-transition>
              <div 
                v-if="showThinking" 
                class="thinking-box"
                :class="{ 'maximized': isThinkingMaximized }"
              >
                <div v-if="isThinkingMaximized" class="thinking-box-header text-right pa-2">
                   <span class="text-subtitle-2 ml-4 float-left mt-1 text-grey">🧠 AI 思考过程</span>
                   <v-btn size="small" color="red" variant="text" prepend-icon="mdi-close" @click="isThinkingMaximized = false">
                     关闭全屏
                   </v-btn>
                </div>
                <div class="pa-3">
                    <pre>{{ selectedStockReasoning.reasoning.thought_process_raw }}</pre>
                </div>
              </div>
            </v-expand-transition>
            
            <!-- 遮罩层 (全屏时显示) -->
            <div v-if="isThinkingMaximized" class="thinking-overlay" @click="isThinkingMaximized = false"></div>
          </div>

            <!-- 新闻上下文 -->
          <div v-if="selectedStockReasoning.news_context && selectedStockReasoning.news_context.length" class="mb-4">
            <div class="text-subtitle-1 font-weight-bold mb-2">📰 相关新闻上下文</div>
            <v-list density="compact" class="pa-0">
              <v-list-item 
                v-for="(news, i) in selectedStockReasoning.news_context" 
                :key="i"
                class="pa-0 min-height-0"
              >
                <template v-slot:title>
                  <div class="d-flex align-center py-0" style="min-height: 24px;">
                    <span class="text-caption text-grey mr-2" style="min-width: 38px; font-size: 0.75rem !important;">
                      {{ formatTime(news.datetime) }}
                    </span>
                    <a 
                      v-if="news.url"
                      :href="news.url"
                      target="_blank"
                      class="text-caption font-weight-medium text-truncate text-primary text-decoration-none custom-link"
                      style="max-width: calc(100% - 46px);"
                    >
                      <v-tooltip activator="parent" location="top">
                        【{{ formatSource(news.source) }}】{{ news.is_announcement ? '公告原件 (PDF)' : '查看原文' }}: {{ news.url }}
                      </v-tooltip>
                      <v-icon size="x-small" class="mr-1" color="primary">
                        {{ news.is_announcement ? 'mdi-file-pdf-box' : 'mdi-open-in-new' }}
                      </v-icon>
                      {{ news.title }}
                    </a>
                    <span v-else class="text-caption font-weight-medium text-truncate" style="max-width: calc(100% - 46px);">{{ news.title }}</span>
                  </div>
                </template>
              </v-list-item>
            </v-list>
          </div>
          
          <v-divider class="my-4"></v-divider>
          
          <!-- 用户反馈 -->
          <div>
            <div class="text-subtitle-1 font-weight-bold mb-2">✍️ 纠错反馈</div>
            <p class="text-caption text-grey mb-2">如果您认为AI归因有误（如非主流逻辑、未识别暗线等），请提出纠错建议，系统将结合您的提示进行深度重新推理。</p>
            <v-textarea
              v-model="userFeedback"
              label="例如：该股并非汽车零部件，而是受卫星导航板块带动..."
              variant="outlined"
              rows="3"
              auto-grow
              hide-details
              class="mb-3"
            ></v-textarea>
            <div class="d-flex justify-end">
              <v-btn 
                color="primary" 
                :loading="submittingFeedback" 
                :disabled="!userFeedback.trim()"
                @click="submitFeedback"
                prepend-icon="mdi-send"
              >
                提交反馈并重算
              </v-btn>
            </div>
          </div>
        </v-card-text>
      </v-card>
      <v-card v-else>
        <v-card-text class="text-center pa-5">
          <v-progress-circular indeterminate color="primary" />
          <div class="mt-2">正在分析...</div>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getDailyLadder, getIndicators, getSectorRanking, getReasoningDetail, submitReasoningFeedback } from '../api/ladder'
import { getWatchlistOpportunities, getPositionsOpportunities, getLatestPortfolioAnalysis } from '../api/portfolio'
import LadderTierCard from '../components/LadderTierCard.vue'
import AnalysisCard from '../components/AnalysisCard.vue'

// API wrapper functions for the analysis cards
const watchlistAnalyzeApi = () => getWatchlistOpportunities()
const positionsAnalyzeApi = () => getPositionsOpportunities()
const getLatestApi = (type) => getLatestPortfolioAnalysis(type)

const loading = ref(false)
const selectedDate = ref('')
const tiles = ref({})
const tiers = ref({})
const brokenLimitUps = ref([])
const sectorAggregation = ref({})
const indicators = ref(null)
const sectorRanking = ref([])
const mainlines = ref([])
const displayDate = ref('')
const currentLadderDate = ref('')
const fallbackNote = ref('')
const lastUpdatedTime = ref('')
const autoRefresh = ref(false)
const countdown = ref(60)
let refreshTimer = null
let countdownTimer = null

// Reasoning Dialog State
const showReasoningDialog = ref(false)
const showThinking = ref(false)
const isThinkingMaximized = ref(false)
const selectedStockReasoning = ref(null)
const userFeedback = ref('')
const submittingFeedback = ref(false)

// Format time utility
function formatTime(val) {
   if (!val) return ''
   // If it contains a date part (e.g., 2026-02-21 08:30:00), just show the time
   if (val.includes(' ')) return val.split(' ')[1].slice(0, 5)
   return val
}

function formatSource(source) {
  const mapping = {
    'cninfo_announcement': '巨潮公告',
    'sina_search': '新浪财经',
    'eastmoney_guba': '东方财富股吧',
    'tushare_major': 'Tushare新闻'
  }
  return mapping[source] || source
}

// Handle click on stock to show reasoning
async function handleShowReasoning(stock) {
  showReasoningDialog.value = true
  showThinking.value = false 
  isThinkingMaximized.value = false
  userFeedback.value = ''
  selectedStockReasoning.value = null // Show loading
  
  try {
    // Use the actual date from the ladder data, not the selected date (which might be null or holiday)
    const targetDate = currentLadderDate.value || (selectedDate.value ? selectedDate.value.replace(/-/g, '') : null)
    
    const res = await getReasoningDetail(stock.symbol, targetDate)
    if (res.success) {
      selectedStockReasoning.value = res.data
    } else {
      // If no detail found, show basic info from stock object if available
       selectedStockReasoning.value = {
          name: stock.name,
          symbol: stock.symbol,
          reasoning: stock.analysis || { tag: '未知', reason: '暂无详细分析', analysis: res.error }
       }
    }
  } catch (e) {
    console.error(e)
    selectedStockReasoning.value = {
        name: stock.name,
        symbol: stock.symbol,
        reasoning: { tag: 'Error', reason: '加载失败', analysis: e.message }
     }
  }
}

async function submitFeedback() {
  if (!userFeedback.value.trim() || !selectedStockReasoning.value) return;
  submittingFeedback.value = true;
  
  try {
    const symbol = selectedStockReasoning.value.symbol;
    const isBroken = selectedStockReasoning.value.reasoning.stock_status === 'broken';
    const targetDate = currentLadderDate.value || (selectedDate.value ? selectedDate.value.replace(/-/g, '') : null);
    
    await submitReasoningFeedback(symbol, targetDate, userFeedback.value, isBroken);
    
    alert('纠错反馈已提交！AI正在重新构建推理逻辑，约5-10秒后请重新打开查询。');
    showReasoningDialog.value = false;
    
    // Optionally trigger a reload of the main screen after a delay
    setTimeout(() => {
        loadData();
    }, 10000);
    
  } catch(e) {
    console.error('Failed to submit feedback:', e);
    alert('提交反馈失败：' + e.message);
  } finally {
    submittingFeedback.value = false;
  }
}

// 计算最大板块分数（用于进度条）
const maxSectorScore = computed(() => {
  if (sectorRanking.value.length === 0) return 100
  return sectorRanking.value[0]?.score || 100
})

// 获取指定梯队的板块聚合
function getSectorAggregation(tier) {
  const agg = {}
  for (const [sector, data] of Object.entries(sectorAggregation.value)) {
    if (data[tier] > 0) {
      agg[sector] = data[tier]
    }
  }
  return agg
}

// 格式化百分比
function formatPercent(value) {
  if (!value) return '0%'
  return (value * 100).toFixed(1) + '%'
}

// 获取情绪等级样式
function getSentimentClass(score) {
  if (score >= 80) return 'sentiment-euphoric'
  if (score >= 65) return 'sentiment-optimistic'
  if (score >= 50) return 'sentiment-neutral'
  if (score >= 35) return 'sentiment-cautious'
  return 'sentiment-panic'
}

// 获取回封/反包概率颜色
function getSustainabilityColor(text) {
  if (!text) return 'grey'
  if (text.includes('强') || text.includes('高')) return 'red-accent-2'
  if (text.includes('中')) return 'orange-accent-2'
  return 'blue-grey'
}

// 获取回封/反包概率文本
function getSustainabilityText(text) {
  if (!text) return ''
  // Extract key words: High, Medium, Low
  if (text.includes('强') || text.includes('高')) return '高'
  if (text.includes('中')) return '中'
  if (text.includes('弱') || text.includes('低')) return '低'
  return text.substring(0, 2)
}

// 加载数据
async function loadData() {
  loading.value = true
  fallbackNote.value = ''
  
  try {
    const dateParam = selectedDate.value 
      ? selectedDate.value.replace(/-/g, '') 
      : null
    
    // 并行加载
    const [ladderRes, indicatorRes, sectorRes] = await Promise.all([
      getDailyLadder(dateParam),
      getIndicators(dateParam),
      getSectorRanking(dateParam)
    ])
    
    if (ladderRes.success) {
      tiers.value = ladderRes.tiers || {}
      sectorAggregation.value = ladderRes.sector_aggregation || {}
      brokenLimitUps.value = ladderRes.broken_limit_ups || []
      displayDate.value = ladderRes.display_date || ''
      currentLadderDate.value = ladderRes.date || ''
            
      // 如果是回退数据，显示提示
      if (ladderRes.is_fallback && ladderRes.fallback_note) {
        fallbackNote.value = ladderRes.fallback_note
      }
    }
    
    if (indicatorRes.success) {
      indicators.value = indicatorRes.latest
    }
    
    if (sectorRes.success) {
      sectorRanking.value = sectorRes.ranking || []
      mainlines.value = sectorRes.mainlines || []
    }
    
  } catch (error) {
    console.error('加载连板天梯失败:', error)
  } finally {
    loading.value = false
    lastUpdatedTime.value = new Date().toLocaleTimeString()
  }
}

// 自动刷新逻辑
function handleAutoRefreshChange(val) {
  if (val) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
}

function startAutoRefresh() {
  stopAutoRefresh()
  countdown.value = 60
  
  // 倒计时定时器
  countdownTimer = setInterval(() => {
    if (countdown.value > 0) {
      countdown.value--
    }
  }, 1000)
  
  // 数据刷新定时器
  refreshTimer = setInterval(() => {
    loadData()
    countdown.value = 60
  }, 60000)
}

function stopAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer)
  if (countdownTimer) clearInterval(countdownTimer)
  refreshTimer = null
  countdownTimer = null
}

onMounted(() => {
  // 检查是否在交易时间，如果是则自动开启刷新
  const now = new Date()
  const hour = now.getHours()
  const day = now.getDay() // 0=Sun, 6=Sat
  const isTradingHours = (day > 0 && day < 6) && (
    (hour >= 9 && hour < 12) || (hour >= 13 && hour < 15)
  )
  
  if (isTradingHours) {
    autoRefresh.value = true
    startAutoRefresh()
  }
  
  loadData()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.limit-up-ladder {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  min-height: 100vh;
}

.sentiment-card {
  transition: all 0.3s;
}

.sentiment-euphoric {
  background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%) !important;
  color: white;
}

.sentiment-optimistic {
  background: linear-gradient(135deg, #56ab2f 0%, #a8e063 100%) !important;
  color: white;
}

.sentiment-neutral {
  background: linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%) !important;
  color: white;
}

.sentiment-cautious {
  background: linear-gradient(135deg, #f7971e 0%, #ffd200 100%) !important;
  color: #333;
}

.sentiment-panic {
  background: linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%) !important;
  color: white;
}

.indicator-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.sector-item {
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.sector-item:last-child {
  border-bottom: none;
}

/* 思考过程样式 (参考 HistoryAnalysis.vue) */
.thinking-box {
  margin-top: 8px;
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 6px;
  max-height: 300px;
  overflow-y: auto;
  position: relative;
}

.thinking-box pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: 'Fira Code', monospace, Consolas;
  font-size: 13px;
  color: #d4d4d4; /* 清晰的浅灰色字体 */
  line-height: 1.5;
}

/* 全屏模式 */
.thinking-box.maximized {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90vw;
  max-width: 1200px;
  height: 85vh;
  max-height: none;
  z-index: 2500; /* 高于 dialog (通常是 2400) */
  box-shadow: 0 0 50px rgba(0,0,0,0.9);
  border: 1px solid #4ade80; /* 全屏时用绿色边框高亮 */
  background-color: #1e1e1e; /* 确保背景不透明 */
}

.thinking-box-header {
  position: sticky;
  top: 0;
  background: #1e1e1e;
  border-bottom: 1px solid #333;
  z-index: 10;
}

.thinking-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0,0,0,0.7);
  z-index: 2490;
}

.custom-link {
  transition: all 0.2s ease;
}

.custom-link:hover {
  text-decoration: underline !important;
  opacity: 0.8;
}

.min-height-0 {
  min-height: 0 !important;
}
</style>
