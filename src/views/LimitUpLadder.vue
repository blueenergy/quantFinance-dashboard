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
          icon="🔄"
          variant="text"
          @click="loadData"
        >
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
            />
            
            <!-- 三板 -->
            <ladder-tier-card
              v-if="tiers['3'] && tiers['3'].length > 0"
              tier="3"
              icon="🌲"
              color="orange-darken-1"
              :stocks="tiers['3']"
              :sector-aggregation="getSectorAggregation('3')"
            />
            
            <!-- 二板 -->
            <ladder-tier-card
              v-if="tiers['2'] && tiers['2'].length > 0"
              tier="2"
              icon="🌿"
              color="green-darken-1"
              :stocks="tiers['2']"
              :sector-aggregation="getSectorAggregation('2')"
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
            />

            <!-- 无数据 -->
            <v-alert v-if="!loading && Object.keys(tiers).every(k => !tiers[k] || tiers[k].length === 0)" type="info" variant="tonal">
              {{ selectedDate || '今日' }} 暂无涨停数据
            </v-alert>
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
      </v-col>
    </v-row>

    <!-- 加载遮罩 -->
    <v-overlay :model-value="loading" class="align-center justify-center" contained>
      <v-progress-circular indeterminate size="64" color="primary" />
    </v-overlay>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getDailyLadder, getIndicators, getSectorRanking } from '../api/ladder'
import LadderTierCard from '../components/LadderTierCard.vue'

const loading = ref(false)
const selectedDate = ref('')
const tiers = ref({})
const sectorAggregation = ref({})
const indicators = ref(null)
const sectorRanking = ref([])
const mainlines = ref([])
const displayDate = ref('')
const fallbackNote = ref('')
const lastUpdatedTime = ref('')
const autoRefresh = ref(false)
const countdown = ref(60)
let refreshTimer = null
let countdownTimer = null

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
      displayDate.value = ladderRes.display_date || ''
      
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
</style>
