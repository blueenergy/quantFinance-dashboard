<template>
  <div>
    <!-- Trigger Card -->
    <v-card class="sector-trigger mb-4" variant="outlined">
      <v-card-text class="d-flex align-center justify-space-between flex-wrap ga-2">
        <div class="d-flex align-center ga-3">
          <span class="text-subtitle-1 font-weight-bold">📈 概念板块分析</span>
          <v-chip-group v-model="sourceIndex" mandatory selected-class="text-primary" density="compact">
            <v-chip size="small" variant="outlined" value="0">🏦 东方财富</v-chip>
            <v-chip size="small" variant="outlined" value="1">📊 同花顺</v-chip>
          </v-chip-group>
        </div>
        <div class="d-flex align-center ga-2">
          <input
            type="date"
            v-model="selectedDate"
            class="date-input"
          />
          <v-btn
            color="primary"
            variant="tonal"
            size="small"
            :loading="loading"
            @click="startAnalysis"
          >
            🔍 开始分析
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <!-- Loading -->
    <v-card v-if="loading" class="mb-4" variant="outlined">
      <v-card-text class="text-center py-8">
        <v-progress-circular indeterminate color="primary" size="48" />
        <p class="text-grey mt-4">{{ statusText }}</p>
      </v-card-text>
    </v-card>

    <!-- Error -->
    <v-alert v-if="error && !loading" type="error" variant="tonal" class="mb-4" closable @click:close="error = ''">
      {{ error }}
    </v-alert>

    <!-- Analysis Result -->
    <div v-if="analysis && !loading">
      <!-- Date + Source Badge -->
      <div class="d-flex align-center ga-2 mb-4">
        <v-chip color="primary" variant="tonal" size="small">📅 {{ formatDate(tradeDate) }}</v-chip>
        <v-chip color="secondary" variant="tonal" size="small">{{ sourceName }}</v-chip>
        <v-chip color="grey" variant="outlined" size="small">{{ model }}</v-chip>
        <span class="text-caption" style="color:rgba(255,255,255,0.5)">分析于 {{ formatDateTime(analysisTime) }}</span>
      </div>

      <!-- Thinking Process -->
      <v-card v-if="analysis.thinking_process" class="mb-4 thinking-card" variant="outlined">
        <v-card-title class="text-subtitle-2 d-flex align-center" style="color:rgba(255,255,255,0.9)">
          🧠 AI思维链
          <v-btn
            size="x-small"
            variant="text"
            @click="showThinking = !showThinking"
            class="ml-2"
          >
            {{ showThinking ? '收起' : '展开' }}
          </v-btn>
        </v-card-title>
        <v-card-text v-if="showThinking" class="thinking-text">
          {{ analysis.thinking_process }}
        </v-card-text>
      </v-card>

      <!-- Market Theme Summary -->
      <v-alert v-if="analysis.market_theme_summary" type="info" variant="tonal" class="mb-4" density="compact">
        <strong>📋 今日主线：</strong>{{ analysis.market_theme_summary }}
      </v-alert>

      <!-- Recommended Sectors -->
      <div v-if="analysis.recommended_sectors?.length > 0" class="mb-6">
        <h4 class="text-h6 font-weight-bold mb-3" style="color:rgba(255,255,255,0.95)">
          🚀 推荐板块
          <span class="text-body-2" style="color:rgba(255,255,255,0.5)">({{ analysis.recommended_sectors.length }})</span>
        </h4>
        <v-row>
          <v-col
            v-for="(sector, idx) in analysis.recommended_sectors"
            :key="idx"
            cols="12"
            md="6"
          >
            <v-card variant="outlined" class="sector-card h-100">
              <v-card-text>
                <!-- Header -->
                <div class="d-flex justify-space-between align-center mb-2">
                  <div class="d-flex align-center ga-2">
                    <span class="text-h6 font-weight-bold" style="color:rgba(255,255,255,0.95)">{{ sector.name }}</span>
                    <v-chip
                      :color="getStrengthColor(sector.strength)"
                      size="x-small"
                      variant="tonal"
                    >
                      {{ getStrengthText(sector.strength) }}
                    </v-chip>
                  </div>
                  <v-chip
                    :color="sector.confidence >= 80 ? 'success' : 'warning'"
                    size="small"
                  >
                    {{ sector.confidence }}分
                  </v-chip>
                </div>

                <!-- Metrics -->
                <div class="d-flex ga-2 mb-3">
                  <v-chip size="x-small" :color="sector.pct_change > 0 ? 'red' : 'green'" variant="tonal">
                    涨幅 {{ sector.pct_change > 0 ? '+' : '' }}{{ sector.pct_change?.toFixed(2) }}%
                  </v-chip>
                  <v-chip size="x-small" :color="sector.net_amount > 0 ? 'red' : 'green'" variant="tonal">
                    资金 {{ sector.net_amount > 0 ? '+' : '' }}{{ sector.net_amount?.toFixed(1) }}亿
                  </v-chip>
                </div>

                <!-- Reason -->
                <p class="text-body-2 mb-3" style="color:rgba(255,255,255,0.85)">{{ sector.reason }}</p>

                <!-- Leading Stocks -->
                <div v-if="sector.leading_stocks?.length" class="mb-2">
                  <span class="text-caption" style="color:rgba(255,255,255,0.6)">🔥 领涨股：</span>
                  <v-chip
                    v-for="stock in sector.leading_stocks"
                    :key="stock.symbol"
                    size="x-small"
                    color="red"
                    variant="outlined"
                    class="mr-1 mt-1"
                  >
                    {{ stock.name }} {{ stock.pct_change > 0 ? '+' : '' }}{{ stock.pct_change?.toFixed(1) }}%
                  </v-chip>
                </div>

                <!-- Catchup Stocks -->
                <div v-if="sector.catchup_stocks?.length">
                  <span class="text-caption" style="color:rgba(255,255,255,0.6)">💡 补涨股：</span>
                  <div v-for="stock in sector.catchup_stocks" :key="stock.symbol" class="catchup-item mt-1">
                    <v-chip size="x-small" color="orange" variant="outlined" class="mr-1">
                      {{ stock.name }}
                    </v-chip>
                    <span class="text-caption" style="color:rgba(255,255,255,0.8)">{{ stock.reason }}</span>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </div>

      <!-- Avoid Sectors -->
      <div v-if="analysis.avoid_sectors?.length > 0" class="mb-6">
        <h4 class="text-h6 font-weight-bold mb-3" style="color:rgba(255,255,255,0.95)">
          ⚠️ 回避板块
          <span class="text-body-2" style="color:rgba(255,255,255,0.5)">({{ analysis.avoid_sectors.length }})</span>
        </h4>
        <v-alert
          v-for="(sector, idx) in analysis.avoid_sectors"
          :key="idx"
          :type="sector.risk_level === 'high' ? 'error' : 'warning'"
          variant="tonal"
          density="compact"
          class="mb-2"
        >
          <div class="d-flex justify-space-between align-center">
            <div>
              <strong style="color:rgba(255,255,255,0.95)">{{ sector.name }}</strong>
              <span class="ml-2 text-body-2" style="color:rgba(255,255,255,0.85)">{{ sector.reason }}</span>
            </div>
            <div class="d-flex ga-1">
              <v-chip size="x-small" :color="sector.pct_change > 0 ? 'red' : 'green'" variant="tonal">
                {{ sector.pct_change > 0 ? '+' : '' }}{{ sector.pct_change?.toFixed(2) }}%
              </v-chip>
              <v-chip size="x-small" color="error" variant="tonal">
                {{ sector.net_amount?.toFixed(1) }}亿
              </v-chip>
            </div>
          </div>
        </v-alert>
      </div>

      <!-- Summary -->
      <v-card v-if="analysis.summary" variant="outlined" class="mb-4">
        <v-card-title class="text-subtitle-2" style="color:rgba(255,255,255,0.9)">📝 总结与操作建议</v-card-title>
        <v-card-text class="text-body-2" style="color:rgba(255,255,255,0.85)">{{ analysis.summary }}</v-card-text>
      </v-card>

      <!-- Meta Info -->
      <div class="text-caption d-flex justify-space-between" style="color:rgba(255,255,255,0.45)">
        <span>板块数: {{ dataSummary?.sector_count || 0 }}</span>
      </div>
    </div>

    <!-- No data yet -->
    <v-alert v-if="!analysis && !loading && !error && initialized" type="info" variant="tonal">
      暂无分析数据，请点击"开始分析"触发板块分析。
    </v-alert>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import {
  analyzeSectorConcept,
  getLatestSectorConcept,
  pollSectorConceptTask
} from '../api/sectorConcept'

const sourceIndex = ref('0')
const source = computed(() => sourceIndex.value === '0' ? 'dc' : 'ths')
const selectedDate = ref(new Date().toISOString().split('T')[0])

const loading = ref(false)
const error = ref('')
const statusText = ref('')
const analysis = ref(null)
const tradeDate = ref('')
const sourceName = ref('')
const model = ref('')
const dataSummary = ref(null)
const analysisTime = ref('')
const showThinking = ref(false)
const initialized = ref(false)

// Load latest when source changes
watch(source, () => {
  loadLatest()
})

async function loadLatest() {
  try {
    const res = await getLatestSectorConcept(source.value)
    if (res.success) {
      analysis.value = res.analysis
      tradeDate.value = res.trade_date
      sourceName.value = source.value === 'dc' ? '东方财富' : '同花顺'
      model.value = res.model || ''
      dataSummary.value = res.data_summary
      analysisTime.value = res.created_at
    }
    // success:false means no data yet — keep analysis null, no error shown
  } catch (e) {
    // Surface real fetch/network errors so user knows something is wrong
    console.error('loadLatest error:', e)
    error.value = `加载历史分析失败: ${e.message}`
  } finally {
    initialized.value = true
  }
}

async function startAnalysis() {
  loading.value = true
  error.value = ''
  statusText.value = '正在提交分析任务...'

  try {
    const date = selectedDate.value.replace(/-/g, '')
    const res = await analyzeSectorConcept(date, source.value)

    if (!res.success) {
      error.value = res.error || '提交任务失败'
      return
    }

    statusText.value = '任务已提交，正在获取数据并分析...'

    // Poll for result
    const result = await pollSectorConceptTask(res.task_id, (progress) => {
      if (progress.status === 'processing') {
        statusText.value = '🤖 AI正在分析概念板块数据...'
      } else if (progress.status === 'pending') {
        statusText.value = '⏳ 任务排队中...'
      }
    })

    if (result.status === 'completed') {
      analysis.value = result.analysis
      tradeDate.value = result.trade_date
      sourceName.value = result.source_name || (source.value === 'dc' ? '东方财富' : '同花顺')
      model.value = result.model || ''
      dataSummary.value = result.data_summary
      analysisTime.value = result.completed_at
      showThinking.value = false
    } else if (result.status === 'failed') {
      error.value = result.error || '分析失败'
    } else {
      error.value = result.error || '分析超时'
    }
  } catch (e) {
    error.value = e.message || '请求失败'
  } finally {
    loading.value = false
    statusText.value = ''
  }
}

function formatDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return dateStr || ''
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
}

function formatDateTime(isoStr) {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return isoStr
  }
}

function getStrengthColor(strength) {
  if (strength === 'strong') return 'red'
  if (strength === 'medium') return 'orange'
  return 'blue'
}

function getStrengthText(strength) {
  if (strength === 'strong') return '强势'
  if (strength === 'medium') return '中等'
  if (strength === 'emerging') return '新兴'
  return strength || ''
}

onMounted(() => {
  loadLatest()
})
</script>

<style scoped>
.sector-trigger {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.1);
}

.date-input {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 13px;
  color: inherit;
  outline: none;
}

.date-input:focus {
  border-color: rgba(var(--v-theme-primary), 0.6);
}

.thinking-card {
  border-color: rgba(33, 150, 243, 0.3);
  background: rgba(33, 150, 243, 0.03);
}

.thinking-text {
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.88);
}

.sector-card {
  transition: all 0.2s;
  background: rgba(255, 255, 255, 0.02);
}

.sector-card:hover {
  background: rgba(255, 255, 255, 0.05);
  transform: translateY(-1px);
}

.catchup-item {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
</style>
