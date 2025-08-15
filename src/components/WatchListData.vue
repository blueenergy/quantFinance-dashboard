<template>
  <div class="watchlist-data">
    <!-- 自选股管理区域 -->
    <div class="watchlist-header">
      <h3>⭐ 自选股管理</h3>
      
      <!-- 用户状态提示 -->
      <div class="user-status" v-if="!isAuthenticated">
        <span class="warning-tip">💡 未登录状态下的自选股仅保存在本地浏览器中</span>
      </div>
      
      <div class="user-status" v-if="isAuthenticated">
        <span class="success-tip">✅ 已登录，自选股已同步到服务器</span>
      </div>
      
      <!-- 迁移提示 -->
      <div class="migration-tip" v-if="migrationComplete">
        <span class="success-tip">🎉 本地自选股已成功迁移到服务器！</span>
      </div>
      
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
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'
import { useAuth } from '../services/auth.js'
import { watchlistService } from '../services/watchlist.js'

const emit = defineEmits(['select-chart'])
const { isAuthenticated, currentUser } = useAuth()

const inputSymbol = ref('')
const watchList = ref([])
const stocksData = ref([])
const loading = ref(false)
const analyzingStock = ref('')
const analysisResults = ref({})
const showAnalysisModal = ref(false)
const currentAnalysis = ref({ symbol: '', data: null, timestamp: null })
const migrationComplete = ref(false)

// 计算没有数据的股票
const stocksWithoutData = computed(() => {
  const dataSymbols = stocksData.value.map(stock => stock.symbol)
  return watchList.value.filter(symbol => !dataSymbols.includes(symbol))
})

// 监听登录状态变化
watch(isAuthenticated, async (newValue, oldValue) => {
  if (newValue && !oldValue) {
    // 用户刚登录，尝试迁移本地数据并加载服务器数据
    await handleUserLogin()
  } else if (!newValue && oldValue) {
    // 用户登出，切换到本地模式
    await handleUserLogout()
  }
}, { immediate: true })

// 处理用户登录
async function handleUserLogin() {
  try {
    loading.value = true
    
    // 尝试迁移本地自选股到服务器
    const migrated = await watchlistService.migrateFromLocalStorage()
    if (migrated) {
      migrationComplete.value = true
      setTimeout(() => {
        migrationComplete.value = false
      }, 3000)
    }
    
    // 加载服务器端自选股
    await loadUserWatchlist()
    
  } catch (error) {
    console.error('处理用户登录失败:', error)
    // 登录失败时回退到本地模式
    loadLocalWatchlist()
  } finally {
    loading.value = false
  }
}

// 处理用户登出
async function handleUserLogout() {
  // 清空服务器数据，切换到本地模式
  watchList.value = []
  stocksData.value = []
  loadLocalWatchlist()
}

// 加载用户自选股（服务器端）
async function loadUserWatchlist() {
  try {
    if (!isAuthenticated?.value) {
      loadLocalWatchlist()
      return
    }
    
    const symbols = await watchlistService.getUserWatchlist()
    watchList.value = symbols
    
    if (symbols.length > 0) {
      await refreshAll()
    }
  } catch (error) {
    console.error('加载用户自选股失败:', error)
    // 失败时回退到本地模式
    loadLocalWatchlist()
  }
}

// 加载本地自选股
function loadLocalWatchlist() {
  watchList.value = watchlistService.getLocalWatchlist()
  if (watchList.value.length > 0) {
    refreshAll()
  }
}

// 添加股票到自选
async function addStock() {
  const symbol = inputSymbol.value.trim().toUpperCase()
  if (!symbol) return
  
  if (watchList.value.includes(symbol)) {
    alert('股票已在自选列表中')
    return
  }
  
  try {
    loading.value = true
    
    if (isAuthenticated?.value) {
      // 用户已登录，添加到服务器
      await watchlistService.addToWatchlist(symbol)
      watchList.value.push(symbol)
    } else {
      // 未登录，添加到本地
      watchList.value.push(symbol)
      watchlistService.setLocalWatchlist(watchList.value)
    }
    
    inputSymbol.value = ''
    // 立即获取新添加股票的数据
    await fetchStockData(symbol)
    
  } catch (error) {
    console.error('添加股票失败:', error)
    alert(error.message || '添加股票失败')
  } finally {
    loading.value = false
  }
}

// 添加示例股票
async function addSampleStock() {
  const sampleSymbol = '000001'
  if (watchList.value.includes(sampleSymbol)) {
    alert('示例股票已在自选列表中')
    return
  }
  
  try {
    loading.value = true
    
    if (isAuthenticated?.value) {
      // 用户已登录，添加到服务器
      await watchlistService.addToWatchlist(sampleSymbol)
      watchList.value.push(sampleSymbol)
    } else {
      // 未登录，添加到本地
      watchList.value.push(sampleSymbol)
      watchlistService.setLocalWatchlist(watchList.value)
    }
    
    // 立即获取示例股票的数据
    await fetchStockData(sampleSymbol)
    
  } catch (error) {
    console.error('添加示例股票失败:', error)
    alert(error.message || '添加示例股票失败')
  } finally {
    loading.value = false
  }
}

// 移除股票
// 移除股票
async function removeStock(symbol) {
  console.log('准备移除股票:', symbol)
  
  // 安全检查：确保isAuthenticated存在
  const isAuthenticatedValue = isAuthenticated?.value || false
  const currentUserValue = currentUser?.value || null
  
  console.log('当前认证状态:', isAuthenticatedValue)
  console.log('当前用户:', currentUserValue)
  
  // 检查token
  const token = localStorage.getItem('access_token')
  console.log('存储的token:', token ? '存在' : '不存在')
  
  try {
    if (isAuthenticatedValue) {
      // 用户已登录，从服务器移除
      console.log('从服务器移除股票:', symbol)
      
      // 检查watchlistService的认证头
      const authHeaders = watchlistService.getAuthHeaders()
      console.log('认证头:', authHeaders)
      
      const result = await watchlistService.removeFromWatchlist(symbol)
      console.log('服务器移除结果:', result)
    } else {
      // 未登录，从本地移除
      console.log('从本地移除股票:', symbol)
      const newList = watchList.value.filter(s => s !== symbol)
      watchlistService.setLocalWatchlist(newList)
    }
    
    // 更新本地状态
    watchList.value = watchList.value.filter(s => s !== symbol)
    stocksData.value = stocksData.value.filter(s => s.symbol !== symbol)
    
    console.log('股票移除成功:', symbol)
    
  } catch (error) {
    console.error('移除股票失败:', error)
    console.error('错误详情:', {
      message: error.message,
      code: error.code,
      response: error.response?.data
    })
    
    // 如果是认证错误，可能需要重新登录
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log('认证失败，可能需要重新登录')
      alert('认证失败，请重新登录')
    } else {
      alert(error.message || '移除股票失败，请重试')
    }
  }
}

// 选择股票查看K线图
function selectChart(symbol) {
  emit('select-chart', symbol)
}

// AI分析股票
async function analyzeStock(symbol) {
  try {
    // 检查是否已登录
    if (!isAuthenticated?.value) {
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
    if (isAuthenticated?.value) {
      // 用户已登录，使用用户专属API
      const response = await watchlistService.getUserWatchlistStocks()
      stocksData.value = response.map(stock => ({
        symbol: stock.symbol,
        name: stock.name,
        close: stock.close,
        change: stock.change,
        changePercent: stock.change_percent,
        volume: stock.volume,
        date: stock.trade_date
      }))
    } else {
      // 未登录，使用传统批量API
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

// 组件挂载时初始化
onMounted(async () => {
  // 初始化时检查登录状态并加载相应的自选股
  if (isAuthenticated?.value) {
    await handleUserLogin()
  } else {
    loadLocalWatchlist()
  }
})
</script>

<style scoped>
.watchlist-data {
  padding: 20px;
  background: rgba(30, 30, 63, 0.5);
  border-radius: 12px;
  border: 1px solid rgba(138, 43, 226, 0.2);
}

.watchlist-header {
  margin-bottom: 20px;
}

.watchlist-header h3 {
  margin: 0 0 15px 0;
  color: #e6e6fa;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
  font-size: 20px;
}

/* 用户状态提示样式 */
.user-status {
  margin-bottom: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  backdrop-filter: blur(10px);
}

.warning-tip {
  color: #fbbf24;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(245, 158, 11, 0.1));
  border: 1px solid rgba(251, 191, 36, 0.3);
  padding: 8px 12px;
  border-radius: 8px;
  display: inline-block;
  box-shadow: 0 2px 8px rgba(251, 191, 36, 0.2);
}

.success-tip {
  color: #34d399;
  background: linear-gradient(135deg, rgba(52, 211, 153, 0.1), rgba(16, 185, 129, 0.1));
  border: 1px solid rgba(52, 211, 153, 0.3);
  padding: 8px 12px;
  border-radius: 8px;
  display: inline-block;
  box-shadow: 0 2px 8px rgba(52, 211, 153, 0.2);
}

.migration-tip {
  margin-bottom: 10px;
  animation: fadeInOut 3s ease-in-out;
}

@keyframes fadeInOut {
  0% { opacity: 0; transform: translateY(-10px); }
  20% { opacity: 1; transform: translateY(0); }
  80% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-10px); }
}

.add-stock {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 20px;
}

.add-stock input {
  padding: 10px 15px;
  border: 2px solid rgba(138, 43, 226, 0.3);
  border-radius: 8px;
  font-size: 14px;
  min-width: 200px;
  background: rgba(30, 30, 63, 0.8);
  color: #e6e6fa;
  transition: all 0.3s;
}

.add-stock input:focus {
  outline: none;
  border-color: #8a2be2;
  box-shadow: 0 0 15px rgba(138, 43, 226, 0.5);
  background: rgba(30, 30, 63, 1);
}

.add-stock input::placeholder {
  color: rgba(230, 230, 250, 0.6);
}

.add-stock button {
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
  font-weight: 500;
}

.add-stock button:first-of-type {
  background: linear-gradient(135deg, #8a2be2 0%, #9370db 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(138, 43, 226, 0.3);
}

.add-stock button:first-of-type:hover:not(:disabled) {
  background: linear-gradient(135deg, #9370db 0%, #ba55d3 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(138, 43, 226, 0.5);
}

.refresh-btn {
  background: linear-gradient(135deg, #00d4aa 0%, #00b894 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(0, 212, 170, 0.3);
}

.refresh-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #00b894 0%, #00a085 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 212, 170, 0.5);
}

.refresh-btn:disabled {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.sample-btn {
  background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(255, 107, 53, 0.3);
}

.sample-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #f7931e 0%, #e67e22 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 107, 53, 0.5);
}

.empty-watchlist {
  text-align: center;
  padding: 40px;
  color: #b19cd9;
  background: #f9fafb;
  border-radius: 8px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  background: rgba(30, 30, 63, 0.8);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(138, 43, 226, 0.2);
  border: 1px solid rgba(138, 43, 226, 0.2);
}

.data-table th,
.data-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid rgba(138, 43, 226, 0.2);
  color: #e6e6fa;
}

.data-table th {
  background: linear-gradient(135deg, #8a2be2 0%, #9370db 100%);
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

.stock-symbol {
  color: #60a5fa;
  cursor: pointer;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
}

.stock-symbol:hover {
  color: #93c5fd;
  text-decoration: underline;
  text-shadow: 0 0 8px rgba(96, 165, 250, 0.5);
}

.stock-name {
  color: #d1d5db;
  font-weight: 500;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.price {
  font-weight: 600;
  color: #fbbf24;
  font-family: 'Courier New', monospace;
}

.positive {
  color: #f87171;
  font-weight: 600;
  text-shadow: 0 0 8px rgba(248, 113, 113, 0.3);
}

.negative {
  color: #34d399;
  font-weight: 600;
  text-shadow: 0 0 8px rgba(52, 211, 153, 0.3);
}

.neutral {
  color: #9ca3af;
}

.chart-btn {
  background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  margin-right: 5px;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
}

.chart-btn:hover {
  background: linear-gradient(135deg, #a855f7 0%, #c084fc 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.5);
}

.analyze-btn {
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  margin-right: 5px;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(6, 182, 212, 0.3);
}

.analyze-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(6, 182, 212, 0.5);
}

.analyze-btn:disabled {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.remove-btn {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.remove-btn:hover {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.5);
}

.no-data-row {
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(251, 191, 36, 0.2);
}

.no-data {
  color: #fbbf24;
  font-style: italic;
}

/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: linear-gradient(135deg, #1e1e3f 0%, #2a2a5e 100%);
  border-radius: 16px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 50px rgba(138, 43, 226, 0.3);
  border: 1px solid rgba(138, 43, 226, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid rgba(138, 43, 226, 0.2);
  background: linear-gradient(135deg, #8a2be2 0%, #9370db 100%);
  border-radius: 16px 16px 0 0;
}

.modal-header h3 {
  margin: 0;
  color: #ffffff;
  font-size: 18px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.8);
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.modal-body {
  padding: 20px;
  background: rgba(30, 30, 63, 0.5);
  color: #e6e6fa;
}

.analysis-section {
  margin-bottom: 20px;
}

.analysis-section h4 {
  margin: 0 0 10px 0;
  color: #d1d5db;
  font-size: 16px;
  font-weight: 600;
}

.analysis-section p {
  margin: 0;
  color: #e6e6fa;
  line-height: 1.6;
  white-space: pre-wrap;
}

.risk-section {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.1));
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  padding: 16px;
}

.risk-section h4 {
  color: #f87171;
}

.risk-section p {
  color: #fca5a5;
}

.analysis-meta {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid rgba(138, 43, 226, 0.2);
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  font-size: 12px;
  color: #b19cd9;
}

/* 表格悬停效果 */
.data-table tr:hover {
  background: rgba(138, 43, 226, 0.1);
  transform: scale(1.01);
  transition: all 0.2s;
}

/* 滚动条样式 */
.modal-content::-webkit-scrollbar {
  width: 8px;
}

.modal-content::-webkit-scrollbar-track {
  background: rgba(30, 30, 63, 0.5);
}

.modal-content::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #8a2be2, #9370db);
  border-radius: 4px;
}

.modal-content::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, #9370db, #ba55d3);
}
</style>
