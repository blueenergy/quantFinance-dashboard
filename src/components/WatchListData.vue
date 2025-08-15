<template>
  <div class="watchlist-data">
    <!-- 自选股管理区域 -->
    <div class="watchlist-header">
      <h3>⭐ 自选股管理</h3>
      <div class="add-stock">
        <input 
          v-model="inputSymbol" 
          placeholder="添加股票代码 (如 000001)" 
          @keyup.enter="addStock"
        />
        <button @click="addStock" :disabled="loading">添加</button>
        <button @click="refreshAll" :disabled="loading" class="refresh-btn">
          {{ loading ? '刷新中...' : '🔄 刷新全部' }}
        </button>
        <button @click="addSampleStock" class="sample-btn">
          📊 添加示例(000001)
        </button>
      </div>
    </div>

    <!-- 自选股数据表格 -->
    <div class="watchlist-table">
      <div v-if="watchList.length === 0" class="empty-watchlist">
        <p>暂无自选股，请添加股票代码</p>
      </div>
      
      <div v-else>
        <table class="data-table">
          <thead>
            <tr>
              <th>股票代码</th>
              <th>股票名称</th>
              <th>最新价格</th>
              <th>涨跌额</th>
              <th>涨跌幅</th>
              <th>成交量</th>
              <th>最新日期</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="stock in stocksData" :key="stock.symbol">
              <td>
                <span class="stock-symbol" @click="selectChart(stock.symbol)">
                  {{ stock.symbol }}
                </span>
              </td>
              <td class="stock-name">{{ stock.name || stock.symbol }}</td>
              <td class="price">{{ stock.close || '-' }}</td>
              <td :class="getPriceChangeClass(stock.change)">
                {{ formatChange(stock.change) }}
              </td>
              <td :class="getPriceChangeClass(stock.changePercent)">
                {{ formatPercent(stock.changePercent) }}
              </td>
              <td>{{ formatVolume(stock.volume) }}</td>
              <td>{{ formatDate(stock.date) }}</td>
              <td>
                <button @click="selectChart(stock.symbol)" class="chart-btn">📈 K线</button>
                <button @click="analyzeStock(stock.symbol)" class="analyze-btn" :disabled="analyzingStock === stock.symbol">
                  {{ analyzingStock === stock.symbol ? '分析中...' : '🤖 AI分析' }}
                </button>
                <button @click="removeStock(stock.symbol)" class="remove-btn">移除</button>
              </td>
            </tr>
            
            <!-- 显示还没有数据的股票 -->
            <tr v-for="symbol in stocksWithoutData" :key="symbol" class="no-data-row">
              <td>
                <span class="stock-symbol" @click="selectChart(symbol)">
                  {{ symbol }}
                </span>
              </td>
              <td class="stock-name">{{ getStockName(symbol) || symbol }}</td>
              <td colspan="5" class="no-data">暂无数据</td>
              <td>
                <button @click="selectChart(symbol)" class="chart-btn">📈 K线</button>
                <button @click="analyzeStock(symbol)" class="analyze-btn" :disabled="analyzingStock === symbol">
                  {{ analyzingStock === symbol ? '分析中...' : '🤖 AI分析' }}
                </button>
                <button @click="removeStock(symbol)" class="remove-btn">移除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- AI分析结果模态框 -->
    <div v-if="showAnalysisModal" class="modal-overlay" @click="closeAnalysisModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>🤖 {{ currentAnalysis.symbol }} AI分析报告</h3>
          <button @click="closeAnalysisModal" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div v-if="currentAnalysis.data">
            <div class="analysis-section">
              <h4>📈 技术面分析</h4>
              <p>{{ currentAnalysis.data.analysis?.technical_analysis || currentAnalysis.data.technical_analysis || '暂无技术分析' }}</p>
            </div>
            
            <div class="analysis-section">
              <h4>� 短期走势预测</h4>
              <p>{{ currentAnalysis.data.analysis?.short_term_forecast || currentAnalysis.data.short_term_forecast || '暂无走势预测' }}</p>
            </div>
            
            <div class="analysis-section">
              <h4>💡 投资建议</h4>
              <p>{{ formatInvestmentAdvice(currentAnalysis.data.analysis?.investment_advice || currentAnalysis.data.investment_advice) }}</p>
            </div>
            
            <div class="analysis-section">
              <h4>🎯 关键要点</h4>
              <ul v-if="getKeyPoints(currentAnalysis.data).length > 0">
                <li v-for="point in getKeyPoints(currentAnalysis.data)" :key="point">{{ point }}</li>
              </ul>
              <p v-else>暂无关键要点</p>
            </div>
            
            <div class="analysis-section risk-section">
              <h4>⚠️ 风险评估</h4>
              <p>
                风险等级：{{ formatRiskLevel(currentAnalysis.data.analysis?.risk_level || currentAnalysis.data.risk_level) }} | 
                置信度：{{ currentAnalysis.data.analysis?.confidence_score || currentAnalysis.data.confidence_score || '未知' }}%
              </p>
            </div>
            
            <div class="analysis-meta">
              <span>📅 分析时间: {{ formatDateTime(currentAnalysis.timestamp) }}</span>
              <span>🤖 AI模型: {{ currentAnalysis.data.model || 'qwen3-30b' }}</span>
              <span>📊 股票代码: {{ currentAnalysis.data.stock_code || currentAnalysis.symbol }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { useAuth } from '../services/auth.js'

const emit = defineEmits(['select-chart'])
const { isAuthenticated } = useAuth()

const inputSymbol = ref('')
const watchList = ref(JSON.parse(localStorage.getItem('watchList') || '[]'))
const stocksData = ref([])
const loading = ref(false)
const analyzingStock = ref('')
const analysisResults = ref({})
const showAnalysisModal = ref(false)
const currentAnalysis = ref({ symbol: '', data: null, timestamp: null })

// 计算没有数据的股票
const stocksWithoutData = computed(() => {
  const dataSymbols = stocksData.value.map(stock => stock.symbol)
  return watchList.value.filter(symbol => !dataSymbols.includes(symbol))
})

// 添加股票到自选
function addStock() {
  const symbol = inputSymbol.value.trim().toUpperCase()
  if (symbol && !watchList.value.includes(symbol)) {
    watchList.value.push(symbol)
    localStorage.setItem('watchList', JSON.stringify(watchList.value))
    inputSymbol.value = ''
    // 立即获取新添加股票的数据
    fetchStockData(symbol)
  }
}

// 添加示例股票
function addSampleStock() {
  const sampleSymbol = '000001'
  if (!watchList.value.includes(sampleSymbol)) {
    watchList.value.push(sampleSymbol)
    localStorage.setItem('watchList', JSON.stringify(watchList.value))
    // 立即获取示例股票的数据
    fetchStockData(sampleSymbol)
  } else {
    alert('示例股票已在自选列表中')
  }
}

// 移除股票
function removeStock(symbol) {
  watchList.value = watchList.value.filter(s => s !== symbol)
  stocksData.value = stocksData.value.filter(s => s.symbol !== symbol)
  localStorage.setItem('watchList', JSON.stringify(watchList.value))
}

// 选择股票查看K线图
function selectChart(symbol) {
  emit('select-chart', symbol)
}

// AI分析股票
async function analyzeStock(symbol) {
  try {
    // 检查是否已登录
    if (!isAuthenticated.value) {
      alert('请先登录后再进行AI分析')
      return
    }

    analyzingStock.value = symbol
    console.log(`开始分析股票: ${symbol}`)
    
    // 获取token
    const token = localStorage.getItem('access_token')
    if (!token) {
      alert('登录已过期，请重新登录')
      return
    }
    
    console.log('发送AI分析请求...')
    
    const response = await axios.post('/api/analyze-stock', {
      symbol: symbol,
      provider: 'openai',
      model: 'qwen3-30b'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000  // 60秒超时
    })
    
    console.log('AI分析响应:', response.status, response.data)
    console.log('响应数据结构详情:', JSON.stringify(response.data, null, 2))
    
    if (response.data && response.data.success) {
      analysisResults.value[symbol] = response.data
      
      // 显示分析结果弹窗
      showAnalysisResult(symbol, response.data)
    } else {
      const errorMsg = response.data?.error || '分析失败，请稍后重试'
      console.error('AI分析失败:', response.data)
      alert(`AI分析失败: ${errorMsg}`)
    }
  } catch (error) {
    console.error(`AI分析股票 ${symbol} 失败:`, error)
    
    let errorMessage = '网络错误，请检查连接'
    
    if (error.response) {
      const status = error.response.status
      const detail = error.response.data?.detail || error.response.data?.message
      
      console.error('错误响应:', {
        status: status,
        data: error.response.data,
        headers: error.response.headers
      })
      
      if (status === 401) {
        errorMessage = '登录已过期，请重新登录'
        // 清除认证信息
        localStorage.removeItem('access_token')
        localStorage.removeItem('user_info')
      } else if (status === 404) {
        errorMessage = `未找到股票 ${symbol} 的数据，请确认股票代码是否正确`
      } else if (status === 500) {
        errorMessage = detail || '服务器内部错误，可能是LLM服务问题'
      } else if (detail) {
        errorMessage = detail
      }
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'AI分析超时，请稍后重试'
    } else if (error.message) {
      errorMessage = error.message
    }
    
    alert(`AI分析失败: ${errorMessage}`)
  } finally {
    analyzingStock.value = ''
  }
}

// 显示分析结果
function showAnalysisResult(symbol, result) {
  currentAnalysis.value = {
    symbol: symbol,
    data: result,
    timestamp: new Date().toISOString()
  }
  showAnalysisModal.value = true
}

// 关闭分析结果模态框
function closeAnalysisModal() {
  showAnalysisModal.value = false
  currentAnalysis.value = { symbol: '', data: null, timestamp: null }
}

// 格式化日期时间
function formatDateTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 格式化投资建议
function formatInvestmentAdvice(advice) {
  if (!advice) return '暂无投资建议';
  return advice;
}

// 格式化风险等级
function formatRiskLevel(riskLevel) {
  if (!riskLevel) return '未知';
  const levels = {
    'low': '低风险',
    'medium': '中等风险', 
    'high': '高风险',
    'very_high': '极高风险'
  };
  return levels[riskLevel.toLowerCase()] || riskLevel;
}

// 获取关键要点
function getKeyPoints(data) {
  // 尝试从多个可能的字段获取关键要点
  const points = data.analysis?.key_points || data.key_points || [];
  if (typeof points === 'string') {
    // 如果是字符串，尝试按换行或分号分割
    return points.split(/[;\n]/).filter(p => p.trim());
  }
  if (Array.isArray(points)) {
    return points;
  }
  return [];
}

// 获取股票名称
function getStockName(symbol) {
  const stockData = stocksData.value.find(stock => stock.symbol === symbol)
  return stockData?.name || symbol
}

// 获取单个股票的最新数据
async function fetchStockData(symbol) {
  try {
    const response = await axios.get(`/records/?symbol=${symbol}&limit=2&sort=-trade_date`)
    const records = response.data
    
    if (records.length > 0) {
      const latest = records[0]
      const previous = records[1]
      
      let change = 0
      let changePercent = 0
      
      if (previous) {
        change = latest.close - previous.close
        changePercent = (change / previous.close) * 100
      }
      
      const stockData = {
        symbol: symbol,
        close: latest.close,
        change: change,
        changePercent: changePercent,
        volume: latest.volume,
        date: latest.trade_date
      }
      
      // 更新或添加股票数据
      const existingIndex = stocksData.value.findIndex(s => s.symbol === symbol)
      if (existingIndex >= 0) {
        stocksData.value[existingIndex] = stockData
      } else {
        stocksData.value.push(stockData)
      }
    }
  } catch (error) {
    console.error(`获取股票 ${symbol} 数据失败:`, error)
  }
}

// 刷新所有自选股数据
async function refreshAll() {
  if (watchList.value.length === 0) return
  
  loading.value = true
  stocksData.value = []
  
  try {
    // 使用批量API获取自选股数据
    const symbolsStr = watchList.value.join(',')
    const response = await axios.get(`/api/watchlist-stocks?symbols=${symbolsStr}`)
    
    if (response.data && response.data.success) {
      stocksData.value = response.data.data.map(stock => ({
        symbol: stock.symbol,
        name: stock.name,
        close: stock.close,
        change: stock.change,
        changePercent: stock.change_percent,
        volume: stock.volume,
        date: stock.trade_date
      }))
    } else {
      console.error('获取自选股数据失败:', response.data?.message)
      // Fallback to individual requests
      const promises = watchList.value.map(symbol => fetchStockData(symbol))
      await Promise.all(promises)
    }
  } catch (error) {
    console.error('刷新自选股数据失败:', error)
    // Fallback to individual requests
    try {
      const promises = watchList.value.map(symbol => fetchStockData(symbol))
      await Promise.all(promises)
    } catch (fallbackError) {
      console.error('Fallback请求也失败:', fallbackError)
    }
  } finally {
    loading.value = false
  }
}

// 格式化函数
function formatDate(dateStr) {
  if (!dateStr) return '-'
  return dateStr.substring(0, 10)
}

function formatChange(change) {
  if (change === undefined || change === null) return '-'
  return change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2)
}

function formatPercent(percent) {
  if (percent === undefined || percent === null) return '-'
  return percent >= 0 ? `+${percent.toFixed(2)}%` : `${percent.toFixed(2)}%`
}

function formatVolume(volume) {
  if (!volume) return '-'
  if (volume >= 100000000) {
    return (volume / 100000000).toFixed(2) + '亿'
  } else if (volume >= 10000) {
    return (volume / 10000).toFixed(2) + '万'
  }
  return volume.toString()
}

function getPriceChangeClass(value) {
  if (value === undefined || value === null) return ''
  return value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'
}

// 组件挂载时加载数据
onMounted(() => {
  if (watchList.value.length > 0) {
    refreshAll()
  }
})
</script>

<style scoped>
.watchlist-data {
  padding: 20px;
}

.watchlist-header {
  margin-bottom: 20px;
}

.watchlist-header h3 {
  margin: 0 0 15px 0;
  color: #2d3748;
}

.add-stock {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 20px;
}

.add-stock input {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  min-width: 200px;
}

.add-stock button {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.add-stock button:first-of-type {
  background: #3b82f6;
  color: white;
}

.add-stock button:first-of-type:hover:not(:disabled) {
  background: #2563eb;
}

.refresh-btn {
  background: #10b981;
  color: white;
}

.refresh-btn:hover:not(:disabled) {
  background: #059669;
}

.refresh-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.sample-btn {
  background: #f59e0b;
  color: white;
}

.sample-btn:hover:not(:disabled) {
  background: #d97706;
}

.empty-watchlist {
  text-align: center;
  padding: 40px;
  color: #6b7280;
  background: #f9fafb;
  border-radius: 8px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.data-table th,
.data-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.data-table th {
  background: #f8fafc;
  font-weight: 600;
  color: #374151;
}

.stock-symbol {
  color: #2563eb;
  cursor: pointer;
  font-weight: 600;
  text-decoration: none;
}

.stock-symbol:hover {
  color: #1d4ed8;
  text-decoration: underline;
}

.stock-name {
  color: #374151;
  font-weight: 500;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.price {
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

.positive {
  color: #dc2626;
  font-weight: 600;
}

.negative {
  color: #16a34a;
  font-weight: 600;
}

.neutral {
  color: #6b7280;
}

.chart-btn {
  background: #8b5cf6;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  margin-right: 5px;
}

.chart-btn:hover {
  background: #7c3aed;
}

.analyze-btn {
  background: #06b6d4;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  margin-right: 5px;
  transition: background-color 0.2s;
}

.analyze-btn:hover:not(:disabled) {
  background: #0891b2;
}

.analyze-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.remove-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.remove-btn:hover {
  background: #dc2626;
}

.no-data-row {
  background: #fef3c7;
}

.no-data {
  color: #92400e;
  font-style: italic;
}

/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
  border-radius: 12px 12px 0 0;
}

.modal-header h3 {
  margin: 0;
  color: #1f2937;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6b7280;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background: #e5e7eb;
}

.modal-body {
  padding: 20px;
}

.analysis-section {
  margin-bottom: 20px;
}

.analysis-section h4 {
  margin: 0 0 10px 0;
  color: #374151;
  font-size: 16px;
  font-weight: 600;
}

.analysis-section p {
  margin: 0;
  color: #4b5563;
  line-height: 1.6;
  white-space: pre-wrap;
}

.risk-section {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 16px;
}

.risk-section h4 {
  color: #dc2626;
}

.risk-section p {
  color: #991b1b;
}

.analysis-meta {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  font-size: 12px;
  color: #6b7280;
}
</style>
