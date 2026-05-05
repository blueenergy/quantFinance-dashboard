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
        <button
          class="trigger-btn"
          :class="{ 'trigger-btn--locked': !canTriggerMarketAnalysis }"
          @click="triggerAnalysis"
          :disabled="loading || triggering || !canTriggerMarketAnalysis"
        >
          {{ triggering ? '提交中...' : '🚀 触发分析' }}
        </button>
        <span v-if="!canTriggerMarketAnalysis" class="pro-hint">专业版可用</span>
      </div>
    </div>
    
    <div class="bulletin-content">
      <div v-if="triggerHint" class="trigger-hint">
        {{ triggerHint }}
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <p>AI正在分析最新市场情况...</p>
      </div>
      
      <div v-else-if="error" class="error">
        <p>❌ {{ error }}</p>
        <p v-if="errorTip" class="error-tip">{{ errorTip }}</p>
      </div>
      
      <div v-else-if="analysis" class="analysis-content">
        <div class="analysis-meta">
          <span class="timestamp">📅 分析时间: {{ formatDateTime(analysis.timestamp) }}</span>
          <span class="analysis-date">📊 数据日期: {{ analysis.analysisDate || '未知' }}</span>
          <span v-if="analysis.cacheInfo" class="cache-info" :class="getCacheClass(analysis.cacheInfo.from_cache)">
            {{ getCacheIcon(analysis.cacheInfo.from_cache) }} {{ analysis.cacheInfo.reason }}
          </span>
          <span v-if="analysis.analysisType" class="analysis-type-badge">
            {{ analysis.analysisType }}
          </span>
          <span class="market-mood" :class="getMoodClass(analysis.mood)">
            {{ getMoodIcon(analysis.mood) }} {{ analysis.mood }}
          </span>
        </div>

        <div v-if="analysis.notice" class="analysis-notice">
          {{ analysis.notice }}
        </div>
        
        <div class="analysis-summary">
          <h4>📊 市场概览</h4>
          <p>{{ analysis.summary }}</p>
        </div>

        <!-- 宏观驱动 -->
        <div v-if="analysis.macroDrivers" class="dim-block">
          <h4>🌐 宏观驱动</h4>
          <p>{{ analysis.macroDrivers }}</p>
        </div>

        <!-- 量能 + 板块 -->
        <div v-if="analysis.volumeAnalysis || analysis.sectorPerformance" class="dim-grid-2">
          <div v-if="analysis.volumeAnalysis" class="dim-card">
            <div class="dim-card-title">📊 量能分析</div>
            <p>{{ analysis.volumeAnalysis }}</p>
          </div>
          <div v-if="analysis.sectorPerformance" class="dim-card">
            <div class="dim-card-title">🏭 板块表现</div>
            <p>{{ analysis.sectorPerformance }}</p>
          </div>
        </div>

        <!-- 资金面 -->
        <div v-if="analysis.northboundFlow || analysis.marginFlow || analysis.capitalFlowInsight || analysis.sectorFundFlow" class="dim-block">
          <h4>💰 资金面</h4>
          <div v-if="analysis.northboundFlow || analysis.marginFlow" class="dim-grid-2">
            <div v-if="analysis.northboundFlow" class="dim-card">
              <div class="dim-card-title">🔮 北向资金</div>
              <p>{{ analysis.northboundFlow }}</p>
            </div>
            <div v-if="analysis.marginFlow" class="dim-card">
              <div class="dim-card-title">⚖️ 融资融券</div>
              <p>{{ analysis.marginFlow }}</p>
            </div>
          </div>
          <p v-if="analysis.capitalFlowInsight" class="dim-summary">{{ analysis.capitalFlowInsight }}</p>
          <div v-if="analysis.sectorFundFlow" class="dim-sub">
            <div class="dim-card-title">📈 板块资金流（同花顺）</div>
            <p>{{ analysis.sectorFundFlow }}</p>
          </div>
        </div>

        <div class="key-points">
          <h4>🔍 关键要点</h4>
          <ul>
            <li v-for="point in analysis.keyPoints" :key="point">{{ point }}</li>
          </ul>
        </div>

        <!-- 连板天梯 + 主线板块 -->
        <div v-if="analysis.ladderInsight || analysis.mainlineAnalysis" class="dim-grid-2">
          <div v-if="analysis.ladderInsight" class="dim-card">
            <div class="dim-card-title">🪜 连板天梯</div>
            <p>{{ analysis.ladderInsight }}</p>
          </div>
          <div v-if="analysis.mainlineAnalysis" class="dim-card">
            <div class="dim-card-title">🎯 主线板块</div>
            <p>{{ analysis.mainlineAnalysis }}</p>
          </div>
        </div>

        <div class="market-outlook">
          <h4>🔮 市场展望</h4>
          <p>{{ analysis.outlook }}</p>
          <p v-if="analysis.nextTradingDays?.length" class="next-trading-days">
            <span class="next-trading-days__label">后续 A 股交易日（交易所日历）</span>
            <span class="next-trading-days__dates">{{ analysis.nextTradingDays.join('、') }}</span>
          </p>
        </div>
        
        <div class="risk-alert" v-if="analysis.riskLevel !== 'low'">
          <h4>⚠️ 风险提示</h4>
          <p class="risk-content" :class="getRiskClass(analysis.riskLevel)">
            风险等级：{{ getRiskText(analysis.riskLevel) }} | {{ analysis.riskNote }}
          </p>
        </div>

        <!-- 个股异常波动 -->
        <div v-if="analysis.abnormalStockInsight" class="dim-block dim-block--warn">
          <h4>🚨 个股异常波动解读</h4>
          <p>{{ analysis.abnormalStockInsight }}</p>
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
import { useAuth } from '../services/auth.js'
import { canUseProFeature } from '../utils/entitlements'

const loading = ref(false)
const error = ref('')
const errorTip = ref('')
const triggerHint = ref('')
const analysis = ref(null)
const selectedDate = ref(new Date().toISOString().split('T')[0])
const { user } = useAuth()
const canTriggerMarketAnalysis = computed(() => canUseProFeature(user.value))

function handleDateChange() {
  fetchLatestAnalysis()
}

// 获取最新的大盘分析（由 quantAnalyzer 自动生成）
async function fetchLatestAnalysis() {
  loading.value = true
  error.value = ''
  errorTip.value = ''
  analysis.value = null

  try {
    const response = await request.get('/market-analysis', {
      params: {
        date: selectedDate.value
      }
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
        nextTradingDays: Array.isArray(response.next_trading_days)
          ? response.next_trading_days
          : [],
        riskLevel: response.riskLevel || 'medium',
        riskNote: response.riskNote || '注意控制仓位，分散投资风险。',
        analysisType: response.analysisType || '',
        macroDrivers: response.macroDrivers || '',
        volumeAnalysis: response.volumeAnalysis || '',
        sectorPerformance: response.sectorPerformance || '',
        northboundFlow: response.northboundFlow || '',
        marginFlow: response.marginFlow || '',
        capitalFlowInsight: response.capitalFlowInsight || '',
        sectorFundFlow: response.sectorFundFlow || '',
        ladderInsight: response.ladderInsight || '',
        mainlineAnalysis: response.mainlineAnalysis || '',
        abnormalStockInsight: response.abnormalStockInsight || '',
        industry_signals: response.industry_signals || null,
        notice: response.notice || ''
      }
    } else if (response.is_expected) {
      error.value = response.error || '暂无分析数据'
      errorTip.value = response.user_tip || '系统将在交易日的预定时间自动生成大盘分析，请稍后刷新。'
      return
    } else {
      throw new Error(response.error || '暂无分析数据')
    }
  } catch (err) {
    console.error('获取市场分析失败:', err)

    // 如果 err.response 存在，说明服务器响应了错误（如 4xx/5xx）
    if (err.response && err.response.data && err.response.data.error) {
      error.value = err.response.data.error
      errorTip.value = err.response.data.user_tip || '请联系系统管理员检查后台服务运行状态'
    } else if (err.message) {
      error.value = err.message
      errorTip.value = '请联系系统管理员检查后台服务运行状态'
    } else {
      error.value = '无法连接到分析服务'
      errorTip.value = '请联系系统管理员检查后台服务运行状态'
    }
  } finally {
    loading.value = false
  }
}

// 触发新的大盘分析任务
const triggering = ref(false)

function isWeekendDate(dateStr) {
  if (!dateStr) return false
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return false
  const day = d.getDay()
  return day === 0 || day === 6
}

async function triggerAnalysis() {
  if (triggering.value) return

  if (isWeekendDate(selectedDate.value)) {
    const todayStr = new Date().toISOString().split('T')[0]
    const dateLabel = selectedDate.value === todayStr ? '今日' : '所选日期'
    const shouldContinue = window.confirm(
      `⚠️ ${dateLabel}为非交易日，不建议触发分析任务。\n\n系统通常会展示最近交易日分析结果。\n是否仍要继续提交？`
    )
    if (!shouldContinue) return
  }

  triggering.value = true
  try {
    const response = await request.post('/trigger-market-analysis', {
      date: selectedDate.value
    })

    if (response.success) {
      if (response.is_non_trading_trigger && response.requested_date && response.effective_analysis_date) {
        triggerHint.value = `你在 ${response.requested_date}（非交易日）发起触发，系统将按最近交易日 ${response.effective_analysis_date} 生成/展示分析。`
      } else {
        triggerHint.value = ''
      }

      if (response.effective_analysis_date && selectedDate.value !== response.effective_analysis_date) {
        selectedDate.value = response.effective_analysis_date
      }

      if (response.skipped_existing) {
        alert(`ℹ️ ${response.message || '最近交易日已有分析结果，已为你切换展示。'}`)
        await fetchLatestAnalysis()
        return
      }

      // 提示用户任务已提交
      const taskLine = response.task_id ? `\n任务ID: ${response.task_id}` : ''
      const noticeLine = response.message ? `\n${response.message}` : ''
      alert(`✅ 分析任务已提交！${taskLine}${noticeLine}\nAI正在进行深度分析，请稍候刷新查看结果。`)
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

.trigger-btn--locked {
  background: #6b7280;
}

.trigger-btn--locked:hover:not(:disabled) {
  background: #6b7280;
}

.pro-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
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

.trigger-hint {
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 13px;
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

.analysis-notice {
  margin-bottom: 16px;
  padding: 10px 12px;
  border-radius: 6px;
  background: #f0f9ff;
  color: #075985;
  border: 1px solid #bae6fd;
  font-size: 14px;
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

.next-trading-days {
  margin: 12px 0 0 0;
  padding: 10px 12px;
  border-radius: 6px;
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  font-size: 13px;
  color: #4a5568;
  line-height: 1.5;
}

.next-trading-days__label {
  display: block;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 4px;
}

.next-trading-days__dates {
  font-variant-numeric: tabular-nums;
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

/* ── 新增维度展示区 ── */
.analysis-type-badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  background: #ede9fe;
  color: #5b21b6;
  border: 1px solid #c4b5fd;
}

.dim-block {
  margin-bottom: 20px;
  padding: 14px 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.dim-block h4 {
  margin: 0 0 10px 0;
  color: #2d3748;
  font-size: 15px;
  font-weight: 600;
}

.dim-block p {
  margin: 0;
  color: #4a5568;
  font-size: 14px;
  line-height: 1.65;
}

.dim-block--warn {
  background: #fffbeb;
  border-color: #fde68a;
}

.dim-block--warn h4 {
  color: #92400e;
}

.dim-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}

@media (max-width: 640px) {
  .dim-grid-2 {
    grid-template-columns: 1fr;
  }
}

.dim-card {
  padding: 12px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

/* dim-grid-2 inside dim-block resets margin */
.dim-block .dim-grid-2 {
  margin-bottom: 0;
  margin-top: 10px;
}

.dim-card-title {
  font-size: 13px;
  font-weight: 600;
  color: #4f46e5;
  margin-bottom: 6px;
}

.dim-card p {
  margin: 0;
  color: #4a5568;
  font-size: 13px;
  line-height: 1.6;
}

.dim-summary {
  margin: 10px 0 0 0;
  padding: 8px 12px;
  background: #eff6ff;
  border-left: 3px solid #3b82f6;
  border-radius: 0 6px 6px 0;
  color: #1e40af;
  font-size: 13px;
  line-height: 1.6;
}

.dim-sub {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed #e2e8f0;
}

.dim-sub p {
  margin: 4px 0 0 0;
  color: #4a5568;
  font-size: 13px;
  line-height: 1.6;
}
</style>
