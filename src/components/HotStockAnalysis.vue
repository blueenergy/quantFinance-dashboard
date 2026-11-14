<template>
  <div class="hot-stock-page">
    <!-- Trigger Card -->
    <v-card class="hot-trigger mb-4" variant="outlined">
      <v-card-text class="d-flex align-center flex-wrap ga-3">
        <span class="text-subtitle-1 font-weight-bold">🔥 热股实时分析</span>
        <v-chip-group v-model="sourceIndex" mandatory selected-class="text-primary" density="compact">
          <v-chip size="small" variant="outlined" value="0">📊 同花顺</v-chip>
          <v-chip size="small" variant="outlined" value="1">🏦 东方财富</v-chip>
        </v-chip-group>
        <span class="text-caption" style="color:var(--text-muted)">自动同步 22:50 · 自动分析 23:05</span>
      </v-card-text>
    </v-card>

    <!-- Error -->
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = ''">
      {{ error }}
    </v-alert>

    <!-- Analysis records of the shown trade date -->
    <div v-if="history.length > 1" class="mb-4">
      <div class="d-flex align-center ga-2 mb-2">
        <span class="text-caption" style="color:var(--text-muted)">{{ historyTradeDate }} 分析记录：</span>
        <v-chip
          v-for="rec in history"
          :key="rec.id"
          :color="rec.id === selectedHistoryId ? 'primary' : 'default'"
          size="x-small"
          variant="tonal"
          class="cursor-pointer"
          @click="selectHistory(rec)"
        >
          {{ formatRankTime(rec.rank_time) }}
        </v-chip>
      </div>
    </div>

    <!-- Data Freshness: shown analysis vs latest raw snapshot -->
    <v-alert
      v-if="freshness"
      :type="freshness.type"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      <div class="d-flex align-center justify-space-between flex-wrap ga-2">
        <span>{{ freshness.text }}</span>
        <v-chip size="x-small" :color="freshness.type">{{ freshness.badge }}</v-chip>
      </div>
    </v-alert>
    <v-alert
      v-else-if="dataStatus && !dataStatus.has_data"
      type="info"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      暂无原始热榜数据；每个交易日 22:50 自动同步、23:05 自动分析。
    </v-alert>

    <!-- Analysis Result -->
    <div v-if="analysis">
      <!-- Meta badges -->
      <div class="d-flex align-center ga-2 mb-4 flex-wrap">
        <v-chip color="primary" variant="tonal" size="small">🕐 数据: {{ rankTime || '未知' }}</v-chip>
        <v-chip color="secondary" variant="tonal" size="small">{{ sourceName }}</v-chip>
        <v-chip
          :color="sentimentColor(analysis.market_sentiment)"
          variant="tonal"
          size="small"
        >
          {{ analysis.market_sentiment }}
        </v-chip>
        <span class="text-caption" style="color:var(--text-muted)">{{ analysis.sentiment_reason }}</span>
      </div>

      <!-- Thinking Process -->
      <v-card v-if="analysis.thinking_process" class="mb-4 thinking-card" variant="outlined">
        <v-card-title class="text-subtitle-2 d-flex align-center" style="color:var(--text-primary)">
          🧠 AI思维链
          <v-btn size="x-small" variant="text" @click="showThinking = !showThinking" class="ml-2">
            {{ showThinking ? '收起' : '展开' }}
          </v-btn>
        </v-card-title>
        <v-card-text v-if="showThinking" class="thinking-text">
          {{ analysis.thinking_process }}
        </v-card-text>
      </v-card>

      <!-- Hot Themes -->
      <div v-if="analysis.hot_themes?.length" class="mb-5">
        <h4 class="text-subtitle-1 font-weight-bold mb-2" style="color:var(--text-primary)">🌊 热点主题</h4>
        <div class="d-flex ga-2 flex-wrap">
          <v-card
            v-for="(theme, i) in analysis.hot_themes"
            :key="i"
            variant="outlined"
            class="theme-chip pa-2"
          >
            <div class="d-flex align-center ga-2">
              <v-chip
                :color="theme.heat_level === '高' ? 'red' : theme.heat_level === '中' ? 'orange' : 'blue'"
                size="x-small"
                variant="tonal"
              >{{ theme.heat_level }}</v-chip>
              <span class="text-body-2 font-weight-bold" style="color:var(--text-primary)">{{ theme.theme }}</span>
            </div>
            <div class="text-caption mt-1" style="color:var(--text-muted)">{{ theme.reason }}</div>
            <div v-if="(theme.stocks || []).length" class="d-flex ga-1 mt-2 flex-wrap align-center">
              <span class="text-caption mr-1" style="color:var(--text-muted)">代表股：</span>
              <v-chip v-for="s in (theme.stocks || []).slice(0,4)" :key="s" size="x-small" color="cyan" variant="outlined" class="mr-1">{{ s }}</v-chip>
            </div>
          </v-card>
        </div>
      </div>

      <!-- Opportunities -->
      <div v-if="analysis.opportunities?.length" class="mb-5">
        <h4 class="text-h6 font-weight-bold mb-3" style="color:var(--text-primary)">
          🚀 机会推荐
          <span class="text-body-2" style="color:var(--text-muted)">({{ analysis.opportunities.length }})</span>
        </h4>
        <v-row>
          <v-col
            v-for="(stock, i) in analysis.opportunities"
            :key="i"
            cols="12"
            md="6"
            lg="4"
          >
            <v-card variant="outlined" class="stock-card h-100">
              <v-card-text>
                <div class="d-flex justify-space-between align-center mb-2">
                  <div>
                    <span class="text-h6 font-weight-bold" style="color:var(--text-primary)">{{ stock.name }}</span>
                    <span class="text-caption ml-2" style="color:var(--text-muted)">{{ stock.ts_code }}</span>
                  </div>
                  <div class="d-flex align-center ga-1">
                    <v-chip size="x-small" color="purple" variant="tonal">🏆#{{ stock.rank }}</v-chip>
                    <v-chip :color="stock.confidence >= 75 ? 'success' : 'warning'" size="small">{{ stock.confidence }}分</v-chip>
                  </div>
                </div>

                <div class="d-flex ga-2 mb-2 flex-wrap">
                  <v-chip size="x-small" :color="stock.pct_change > 0 ? 'red' : 'green'" variant="tonal">
                    {{ stock.pct_change > 0 ? '+' : '' }}{{ stock.pct_change?.toFixed(2) }}%
                  </v-chip>
                  <v-chip size="x-small" variant="outlined" color="cyan">
                    {{ stock.opportunity_type || '机会' }}
                  </v-chip>
                  <v-chip v-if="stock.concept" size="x-small" variant="outlined" color="grey">
                    {{ stock.concept }}
                  </v-chip>
                </div>

                <p class="text-body-2 mb-2" style="color:var(--text-subtle)">{{ stock.reason }}</p>

                <div v-if="stock.rank_reason" class="text-caption mb-1" style="color:var(--text-subtle)">
                  📌 {{ stock.rank_reason }}
                </div>
                <div v-if="stock.risk_note" class="text-caption" style="color:#b45309">
                  ⚠️ {{ stock.risk_note }}
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </div>

      <!-- Risk Warnings -->
      <div v-if="analysis.risk_warnings?.length" class="mb-4">
        <h4 class="text-subtitle-1 font-weight-bold mb-2" style="color:var(--text-primary)">⚠️ 风险提示</h4>
        <v-alert
          v-for="(w, i) in analysis.risk_warnings"
          :key="i"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-2"
        >
          <strong>{{ w.type }}</strong> — <span>{{ w.description }}</span>
        </v-alert>
      </div>

      <!-- Summary -->
      <v-card v-if="analysis.summary" variant="outlined" class="mb-4">
        <v-card-title class="text-subtitle-2" style="color:var(--text-primary)">📝 市场总结</v-card-title>
        <v-card-text class="text-body-2" style="color:var(--text-subtle)">{{ analysis.summary }}</v-card-text>
      </v-card>

      <!-- Meta footer -->
      <div class="text-caption d-flex justify-space-between" style="color:var(--text-muted)">
        <span>模型: {{ model }} | 热股数: {{ stockCount }}</span>
        <span>分析时间: {{ formatDateTime(analysisTime) }}</span>
      </div>
    </div>

    <!-- No data -->
    <v-alert v-if="!analysis && !error && initialized" type="info" variant="tonal">
      暂无热股分析数据；每个交易日 23:05 自动生成分析。
    </v-alert>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import {
  getLatestHotStock,
  getHotStockHistory,
  getHotStockDataStatus
} from '../api/hotStock'
import { describeHotStockFreshness } from '../utils/hotStockFreshness'

const sourceIndex = ref('0')
const source = computed(() => sourceIndex.value === '0' ? 'ths' : 'dc')

const dataStatus = ref(null)

const error = ref('')
const analysis = ref(null)
const rankTime = ref('')
const sourceName = ref('')
const model = ref('')
const stockCount = ref(0)
const analysisTime = ref('')
const showThinking = ref(false)
const initialized = ref(false)
const tradeDate = ref('')
const history = ref([])
const selectedHistoryId = ref(null)
const historyTradeDate = ref('')

/** YYYYMMDD → YYYY-MM-DD for display. */
function formatTradeDate(s) {
  if (!s || !/^\d{8}$/.test(String(s))) return ''
  const v = String(s)
  return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`
}

/**
 * Staleness of what is on screen, judged against the newest raw snapshot —
 * not against wall clock. The raw list is synced once per trading day at
 * 22:50, so "older than 60 minutes" is the normal state all day and says
 * nothing about staleness.
 */
const freshness = computed(() => describeHotStockFreshness(dataStatus.value, analysis.value, {
  shownRankTime: rankTime.value,
  shownTradeDate: tradeDate.value,
  viewingOldRecord: history.value.length > 0 &&
    selectedHistoryId.value !== history.value[history.value.length - 1]?.id,
}))

watch(source, () => {
  loadLatest()
  loadHistory()
  fetchDataStatus()
})

async function fetchDataStatus() {
  try {
    const res = await getHotStockDataStatus(source.value)
    if (res.success) {
      dataStatus.value = res.data
    }
  } catch (err) {
    console.error('Failed to fetch data status:', err)
  }
}

async function loadLatest() {
  try {
    const res = await getLatestHotStock(source.value)
    if (res.success) {
      setAnalysis(res)
    }
  } catch (e) {
    error.value = `加载失败: ${e.message}`
  } finally {
    initialized.value = true
  }
}

async function loadHistory() {
  try {
    const res = await getHotStockHistory(source.value)
    if (res.success) {
      history.value = res.records
      historyTradeDate.value = formatTradeDate(res.trade_date)
      if (history.value.length > 0) {
        selectedHistoryId.value = history.value[history.value.length - 1].id
      }
    }
  } catch (e) {
    console.error('load history failed', e)
  }
}

function setAnalysis(res) {
  analysis.value = res.analysis
  rankTime.value = res.rank_time || ''
  tradeDate.value = res.trade_date || ''
  sourceName.value = res.source_name || (source.value === 'ths' ? '同花顺' : '东方财富')
  model.value = res.model || ''
  stockCount.value = res.stock_count || 0
  analysisTime.value = res.created_at || ''
}

function selectHistory(rec) {
  selectedHistoryId.value = rec.id
  analysis.value = rec.analysis
  rankTime.value = rec.rank_time || ''
  tradeDate.value = (rec.rank_time || '').slice(0, 10).replace(/-/g, '')
  sourceName.value = rec.source_name || sourceName.value
  stockCount.value = rec.stock_count || 0
  analysisTime.value = rec.created_at || ''
}

function sentimentColor(s) {
  if (s === '强势') return 'red'
  if (s === '偏强') return 'orange'
  if (s === '中性') return 'blue'
  if (s === '偏弱') return 'cyan'
  return 'grey'
}

function formatRankTime(t) {
  if (!t) return ''
  // "2026-03-01 22:30:01" → "22:30"
  const parts = t.split(' ')
  return parts.length > 1 ? parts[1].slice(0, 5) : t
}

function formatDateTime(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch { return iso }
}

onMounted(() => {
  loadLatest()
  loadHistory()
  fetchDataStatus()
})
</script>

<style scoped>
.hot-stock-page {
  padding: 24px;
}

.hot-trigger {
  background: var(--surface-bg);
  border-color: var(--surface-border);
}
.thinking-card {
  border-color: #bfdbfe;
  background: #eff6ff;
}
.thinking-text {
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-subtle);
}
.theme-chip {
  background: var(--surface-bg);
  border-color: var(--surface-border);
  min-width: 180px;
}
.stock-card {
  background: var(--surface-bg);
  border-color: var(--surface-border);
  transition: all 0.2s;
}
.stock-card:hover {
  background: var(--surface-bg-muted);
  transform: translateY(-1px);
}
.cursor-pointer {
  cursor: pointer;
}
</style>
