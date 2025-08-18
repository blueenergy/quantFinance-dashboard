<template>
  <div class="bulletin-board">
    <div class="bulletin-header">
      <h3>
        🤖 AI大盘分析公告栏
        <span v-if="analysis?.analysisDate" class="header-date">
          ({{ analysis.analysisDate }})
        </span>
      </h3>
      <div class="header-actions">
        <button @click="refreshAnalysis" :disabled="loading" class="refresh-btn">
          <span v-if="loading">分析中...</span>
          <span v-else>🔄 刷新分析</span>
        </button>
      </div>
    </div>
    
    <div class="bulletin-content">
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <p>AI正在分析当前市场情况...</p>
      </div>
      
      <div v-else-if="error" class="error">
        <p>❌ {{ error }}</p>
        <button @click="refreshAnalysis" class="retry-btn">重试</button>
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
      </div>
      
      <div v-else class="no-data">
        <p>暂无分析数据，点击刷新按钮获取最新分析</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useAuth } from '../services/auth.js'

const { user, isAuthenticated, authService } = useAuth()

const loading = ref(false)
const error = ref('')
const analysis = ref(null)

// 获取大盘分析
async function refreshAnalysis() {
  loading.value = true
  error.value = ''
  
  try {
    // 检查是否已登录
    if (!isAuthenticated.value) {
      throw new Error('请先登录后再获取分析')
    }
    
    // 发送API请求（axios拦截器会自动添加认证头）
    // 用户点击刷新时强制后端不使用缓存
    const response = await axios.post('/api/analyze-market', {
      type: 'daily_overview',
      force_refresh: true
    })
    
    if (response.data.success) {
      analysis.value = {
        timestamp: new Date().toISOString(),
        analysisDate: response.data.analysis_date || '未知日期',  // 添加分析基准日期
        cacheInfo: response.data.cache_info || null,  // 添加缓存信息
        mood: response.data.mood || '谨慎乐观',
        summary: response.data.summary || '市场表现平稳，投资者情绪较为理性。',
        keyPoints: response.data.keyPoints || [
          '主要指数震荡调整，成交量较前日有所放大',
          '科技股表现相对强势，金融股承压',
          '外围市场保持稳定，人民币汇率企稳'
        ],
        outlook: response.data.outlook || '短期内市场可能延续震荡格局，建议关注结构性机会。',
        riskLevel: response.data.riskLevel || 'medium',
        riskNote: response.data.riskNote || '注意控制仓位，分散投资风险。'
      }
    } else {
      throw new Error(response.data.error || '分析失败')
    }
  } catch (err) {
    console.error('获取市场分析失败:', err)
    if (err.response?.status === 401) {
      error.value = '登录已过期，请重新登录'
    } else if (err.message.includes('请先登录')) {
      error.value = err.message
    } else {
      error.value = err.response?.data?.detail || err.message || '网络连接失败'
    }
    
    // 如果API失败，提供一个示例数据（只在有认证的情况下）
    if (!analysis.value && isAuthenticated.value) {
      const today = new Date().toISOString().split('T')[0]  // 当前日期作为示例
      analysis.value = {
        timestamp: new Date().toISOString(),
        analysisDate: today,  // 添加示例分析日期
        mood: '谨慎乐观',
        summary: '当前市场处于调整阶段，主要指数表现分化。科技板块相对活跃，传统行业表现平稳。整体而言，市场情绪趋于理性，投资者更加注重基本面分析。',
        keyPoints: [
          '沪深300指数今日微幅上涨0.3%，成交量环比增长15%',
          '新能源、半导体板块领涨，房地产、银行板块调整',
          '北向资金净流入25亿元，显示外资持续看好A股',
          '市场波动率下降，投资者情绪逐步回暖'
        ],
        outlook: '短期内市场可能维持震荡格局，建议关注业绩确定性强的优质个股。中长期来看，随着政策面的持续发力，市场有望迎来新的上涨机会。',
        riskLevel: 'medium',
        riskNote: '当前市场风险可控，但仍需关注海外市场波动及政策变化带来的影响。建议投资者保持适度仓位，做好风险管理。'
      }
    }
  } finally {
    loading.value = false
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

// 组件挂载时获取分析（只在已登录时）
onMounted(() => {
  if (isAuthenticated.value) {
    refreshAnalysis()
  }
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
}

.header-date {
  font-size: 14px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.8);
  margin-left: 8px;
}

.refresh-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.refresh-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
}

.refresh-btn:disabled {
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
</style>
