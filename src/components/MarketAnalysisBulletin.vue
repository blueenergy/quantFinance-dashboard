<template>
  <div class="bulletin-board">
    <div class="bulletin-header">
      <h3>
        🤖 AI大盘分析公告栏
        <span v-if="analysis?.analysisDate" class="header-date">
          ({{ analysis.analysisDate }})
        </span>
        <span v-if="isPostMarket" class="post-market-badge">收盘复盘</span>
      </h3>
      <div class="header-controls">
        <input type="date" v-model="selectedDate" @change="handleDateChange" class="date-input" :disabled="loading || triggering" />
        <button class="trigger-btn" @click="triggerAnalysis" :disabled="loading || triggering">
          {{ triggering ? '提交中...' : '🚀 触发分析' }}
        </button>
      </div>
    </div>
    
    <div class="bulletin-content">
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <p>AI正在分析最新市场情况...</p>
      </div>
      
      <div v-else-if="error" class="error">
        <p>❌ {{ error }}</p>
        <p class="error-tip">请联系系统管理员检查后台服务运行状态</p>
      </div>
      
      <div v-else-if="analysis" class="analysis-content">
        <div class="analysis-meta">
          <span class="timestamp">📅 分析时间: {{ formatDateTime(analysis.timestamp) }}</span>
          <span class="analysis-date">📊 数据日期: {{ analysis.analysisDate || '未知' }}</span>
          <span v-if="analysis.cacheInfo" class="cache-info" :class="getCacheClass(analysis.cacheInfo.from_cache)">
            {{ getCacheIcon(analysis.cacheInfo.from_cache) }} {{ analysis.cacheInfo.reason }}
          </span>
          <span class="market-mood" :class="getMoodClass(analysis.mood)">
            {{ getMoodIcon(analysis.mood) }} {{ analysis.mood }}
          </span>
        </div>
        
        <div class="analysis-summary">
          <h4>📊 市场概览</h4>
          <p>{{ analysis.summary }}</p>
        </div>
        
        <div class="key-points">
          <h4>🔍 关键要点</h4>
          <ul>
            <li v-for="point in analysis.keyPoints" :key="point">{{ point }}</li>
          </ul>
        </div>
        
        <div class="market-outlook">
          <h4>🔮 市场展望</h4>
          <p>{{ analysis.outlook }}</p>
        </div>
        
        <div class="risk-alert" v-if="analysis.riskLevel !== 'low'">
          <h4>⚠️ 风险提示</h4>
          <p class="risk-content" :class="getRiskClass(analysis.riskLevel)">
            风险等级：{{ getRiskText(analysis.riskLevel) }} | {{ analysis.riskNote }}
          </p>
        </div>

        <!-- New Multi-Dim Industry Signals -->
        <IndustrySignals 
          v-if="analysis && analysis.industry_signals" 
          :signals="analysis.industry_signals" 
        />
      </div>
      
      <div v-else class="no-data">
        <p>
          📈 暂无分析数据<br>
          <small>系统将在交易日的预定时间(10:00/11:30/15:30)自动生成大盘分析<br>如长时间未显示，请联系管理员检查后台服务</small>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import request from '../utils/request'
import IndustrySignals from './IndustrySignals.vue'

const loading = ref(false)
const error = ref('')
const analysis = ref(null)
const selectedDate = ref(new Date().toISOString().split('T')[0])

function handleDateChange() {
  fetchLatestAnalysis()
}

// 获取最新的大盘分析（由 quantAnalyzer 自动生成）
async function fetchLatestAnalysis() {
  loading.value = true
  error.value = ''
  analysis.value = null

  try {
    const response = await request.post('/analyze-market', {
      type: 'daily_overview',
      date: selectedDate.value
    })

    if (response.success) {
      analysis.value = {
        timestamp: response.cache_info?.created_at || new Date().toISOString(),
        analysisDate: response.analysis_date || '未知日期',
        cacheInfo: response.cache_info || null,
        mood: response.mood || '谨慎乐观',
        summary: response.summary || '市场表现平稳，投资者情绪较为理性。',
        keyPoints: response.keyPoints || [
          '主要指数震荡调整，成交量较前日有所放大',
          '科技股表现相对强势，金融股承压',
          '外围市场保持稳定，人民币汇率企稳'
        ],
        outlook: response.outlook || '短期内市场可能延续震荡格局，建议关注结构性机会。',
        riskLevel: response.riskLevel || 'medium',
        riskNote: response.riskNote || '注意控制仓位，分散投资风险。',
        industry_signals: response.industry_signals || null
      }
    } else {
      throw new Error(response.error || '暂无分析数据')
    }
  } catch (err) {
    console.error('获取市场分析失败:', err)

    // 如果 err.response 存在，说明服务器响应了错误（如 4xx/5xx）
    if (err.response && err.response.data && err.response.data.error) {
      error.value = err.response.data.error
    } else if (err.message) {
      error.value = err.message
    } else {
      error.value = '无法连接到分析服务'
    }
  } finally {
    loading.value = false
  }
}

// 触发新的大盘分析任务
const triggering = ref(false)

async function triggerAnalysis() {
  if (triggering.value) return

  triggering.value = true
  try {
    const response = await request.post('/trigger-market-analysis', {
      date: selectedDate.value
    })

    if (response.success) {
      // 提示用户任务已提交
      alert(`✅ 分析任务已提交！\n任务ID: ${response.task_id}\nAI正在进行深度分析，请稍候刷新查看结果。`)
    } else {
      throw new Error(response.error || '提交失败')
    }
  } catch (err) {
    console.error('触发分析失败:', err)
    let msg = '触发分析失败'
    if (err.response?.data?.error) {
      msg += ': ' + err.response.data.error
    } else if (err.message) {
      msg += ': ' + err.message
    }
    alert(msg)
  } finally {
    triggering.value = false
  }
}



// 格式化时间
function formatDateTime(timestamp) {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 判断是否为收盘复盘 (15:00 以后)
const isPostMarket = computed(() => {
  if (!analysis.value?.timestamp) return false
  const date = new Date(analysis.value.timestamp)
  return date.getHours() >= 15
})

// 获取市场情绪样式类
function getMoodClass(mood) {
  if (mood.includes('乐观') || mood.includes('积极')) return 'mood-positive'
  if (mood.includes('悲观') || mood.includes('谨慎')) return 'mood-negative'
  return 'mood-neutral'
}

// 获取市场情绪图标
function getMoodIcon(mood) {
  if (mood.includes('乐观') || mood.includes('积极')) return '📈'
  if (mood.includes('悲观') || mood.includes('谨慎')) return '📉'
  return '📊'
}

// 获取风险等级样式类
function getRiskClass(level) {
  switch (level) {
    case 'high': return 'risk-high'
    case 'medium': return 'risk-medium'
    case 'low': return 'risk-low'
    default: return 'risk-medium'
  }
}

// 获取风险等级文本
function getRiskText(level) {
  switch (level) {
    case 'high': return '高风险'
    case 'medium': return '中等风险'
    case 'low': return '低风险'
    default: return '中等风险'
  }
}

// 获取缓存状态样式类
function getCacheClass(fromCache) {
  return fromCache ? 'cache-hit' : 'cache-miss'
}

// 获取缓存状态图标
function getCacheIcon(fromCache) {
  return fromCache ? '💾' : '🔄'
}

// 自动加载时调用
onMounted(() => {
  fetchLatestAnalysis()
})
</script>

<style scoped>
.bulletin-board {
  background: linear-gradient(135deg, #f8f9ff 0%, #e8f4fd 100%);
  border-radius: 12px;
  border: 1px solid #e1e8ed;
  margin-bottom: 25px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.bulletin-header {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  color: white;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bulletin-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
}

.header-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.date-input {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  color: white;
  padding: 6px 10px;
  font-size: 14px;
  outline: none;
}

.date-input::-webkit-calendar-picker-indicator {
  filter: invert(1);
  cursor: pointer;
}

.header-date {
  font-size: 14px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.8);
  margin-left: 8px;
}

.trigger-btn {
  background: #10b981;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.trigger-btn:hover:not(:disabled) {
  background: #059669;
}

.trigger-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.bulletin-content {
  padding: 20px;
  min-height: 200px;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #666;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #4f46e5;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error {
  text-align: center;
  color: #dc3545;
  padding: 40px 20px;
}

.retry-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 12px;
}

.analysis-content {
  line-height: 1.6;
}

.analysis-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e1e8ed;
  flex-wrap: wrap;
  gap: 8px;
}

.timestamp, .analysis-date {
  color: #666;
  font-size: 14px;
  background: #f8f9fa;
  padding: 4px 8px;
  border-radius: 4px;
}

.analysis-date {
  background: #e3f2fd;
  color: #1976d2;
  font-weight: 500;
}

.market-mood {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
}

.mood-positive {
  background: #d4edda;
  color: #155724;
}

.mood-negative {
  background: #f8d7da;
  color: #721c24;
}

.mood-neutral {
  background: #fff3cd;
  color: #856404;
}

.analysis-summary, .key-points, .market-outlook, .risk-alert {
  margin-bottom: 20px;
}

.analysis-summary h4, .key-points h4, .market-outlook h4, .risk-alert h4 {
  margin: 0 0 12px 0;
  color: #2d3748;
  font-size: 16px;
  font-weight: 600;
}

.key-points ul {
  margin: 0;
  padding-left: 20px;
}

.key-points li {
  margin-bottom: 8px;
  color: #4a5568;
}

.risk-alert {
  background: #fff5f5;
  border: 1px solid #fed7d7;
  border-radius: 8px;
  padding: 16px;
}

.risk-content {
  margin: 8px 0 0 0;
  font-weight: 500;
}

.risk-high {
  color: #c53030;
}

.risk-medium {
  color: #d69e2e;
}

.risk-low {
  color: #38a169;
}

/* 缓存信息样式 */
.cache-info {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.cache-hit {
  background: #e6fffa;
  color: #234e52;
  border: 1px solid #81e6d9;
}

.cache-miss {
  background: #fef5e7;
  color: #744210;
  border: 1px solid #f6ad55;
}

.no-data {
  text-align: center;
  color: #666;
  padding: 60px 20px;
  font-size: 16px;
}

.post-market-badge {
  background: rgba(255, 255, 255, 0.25);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-left: 8px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  font-weight: 500;
}
</style>
