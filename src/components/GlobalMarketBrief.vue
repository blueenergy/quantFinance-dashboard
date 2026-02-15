<template>
  <div class="global-brief-card">
    <div class="card-header">
      <div class="header-main">
        <h3>🌍 隔夜全球市场联动分析</h3>
        <span v-if="analysis?.timestamp" class="header-time">
          ({{ formatDateTime(analysis.timestamp) }} 分析)
        </span>
      </div>
      <div v-if="brief" class="sentiment-indicator" :class="getSentimentClass(brief.sentiment_score)">
        <span class="score">{{ brief.sentiment_score }}</span>
        <span class="label">{{ brief.sentiment_mood }}</span>
      </div>
    </div>

    <div class="card-content">
      <div v-if="loading" class="loading-state">
        <v-progress-circular indeterminate color="primary"></ v-progress-circular>
        <p>正在同步全球市场数据与AI分析...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <v-alert type="error" variant="tonal" density="compact">
          {{ error }}
        </v-alert>
      </div>

      <div v-else-if="brief" class="brief-body">
        <div class="summary-section">
          <p class="main-summary">{{ brief.summary }}</p>
        </div>

        <div class="events-grid">
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

        <div class="bottom-sections">
          <div class="suggestion-box">
            <h4>💡 今日建议</h4>
            <p>{{ brief.trading_suggestion }}</p>
          </div>
          <div class="risk-box" v-if="brief.risk_factors && brief.risk_factors.length">
            <h4>⚠️ 风险提示</h4>
            <ul>
              <li v-for="risk in brief.risk_factors" :key="risk">{{ risk }}</li>
            </ul>
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
const analysis = ref(null)

const brief = computed(() => analysis.value?.analysis || null)

async function fetchGlobalAnalysis() {
  loading.value = true
  error.value = ''
  try {
    const response = await axios.get('/api/global-analysis')
    if (response.data.success) {
      analysis.value = response.data.data
    } else {
      // Don't show error if it's just "no data today" for quiet UI
      if (!response.data.error.includes('今日尚无')) {
        error.value = response.data.error
      }
    }
  } catch (err) {
    console.error('Failed to fetch global analysis:', err)
    // Silent fail on auto-load
  } finally {
    loading.value = false
  }
}

function formatDateTime(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
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
</style>
