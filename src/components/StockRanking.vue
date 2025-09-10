<!-- dashboard/src/components/StockRanking.vue -->
<template>
  <div>
    <h3>股票评分排行榜</h3>
    
    <div style="margin-bottom: 20px;">
      <label>显示数量：</label>
      <select v-model="displayLimit" @change="fetchRankings">
        <option value="50">Top 50</option>
        <option value="100">Top 100</option>
        <option value="200">Top 200</option>
      </select>
      
      <button @click="refreshScores" style="margin-left: 20px;" :disabled="isRefreshing">
        {{ isRefreshing ? '重新评分中...' : '重新评分' }}
      </button>
      
      <span style="margin-left: 20px; color: #666; font-size: 12px;">
        最后更新: {{ lastUpdateTime }}
      </span>
    </div>

    <div v-if="loading" style="text-align: center; padding: 20px;">
      加载中...
    </div>

    <div v-else>
      <table class="ranking-table">
        <thead>
          <tr class="table-header">
            <th class="th-rank">排名</th>
            <th class="th-symbol">股票代码</th>
            <th class="th-name">股票名称</th>
            <th class="th-score">总分</th>
            <th class="th-cycle">周期评分</th>
            <th class="th-fundamental">基本面</th>
            <th class="th-technical">技术面</th>
            <th class="th-money">资金流</th>
            <th class="th-action">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(stock, index) in rankings" :key="stock.symbol" class="table-row" :class="getRowClass(index + 1)">
            <td class="td-rank">
              <span :style="getRankStyle(index + 1)" class="rank-badge">{{ index + 1 }}</span>
            </td>
            <td class="td-symbol">
              <span class="symbol-text">{{ stock.symbol }}</span>
            </td>
            <td class="td-name">
              <span class="name-text">{{ stock.name || '-' }}</span>
            </td>
            <td class="td-score">
              <span :style="getScoreStyle(stock.total_score)" class="score-badge">{{ stock.total_score }}</span>
            </td>
            <td class="td-cycle">
              <span class="cycle-score">{{ stock.cycle_score }}</span>
            </td>
            <td class="td-fundamental">
              <span class="fundamental-score">{{ stock.fundamental_score }}</span>
            </td>
            <td class="td-technical">
              <span class="technical-score">{{ stock.technical_score }}</span>
            </td>
            <td class="td-money">
              <span class="money-score">{{ stock.money_flow_score }}</span>
            </td>
            <td class="td-action">
              <button @click="viewChart(stock.symbol)" class="btn-chart">📊</button>
              <button @click="addToWatchlist(stock.symbol)" class="btn-watch">⭐</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 评分详情弹窗 -->
    <div v-if="showScoreDetail" class="modal-overlay" @click="closeScoreDetail">
      <div class="modal-content" @click.stop>
        <h4>{{ selectedStock?.symbol }} 评分详情</h4>
        <div style="margin: 20px 0;">
          <p><strong>总分:</strong> {{ selectedStock?.total_score }}</p>
          <p><strong>周期评分:</strong> {{ selectedStock?.cycle_score }} (权重: 25%)</p>
          <p><strong>基本面评分:</strong> {{ selectedStock?.fundamental_score }} (权重: 35%)</p>
          <p><strong>技术面评分:</strong> {{ selectedStock?.technical_score }} (权重: 25%)</p>
          <p><strong>资金流评分:</strong> {{ selectedStock?.money_flow_score }} (权重: 15%)</p>
        </div>
        <button @click="closeScoreDetail">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const emit = defineEmits(['view-chart'])

const rankings = ref([])
const loading = ref(false)
const displayLimit = ref(10)
const isRefreshing = ref(false)
const lastUpdateTime = ref('')
const showScoreDetail = ref(false)
const selectedStock = ref(null)
const watchlist = ref([]) // ✅ 添加 watchlist 状态

// ✅ 检查用户是否已登录
function isUserLoggedIn() {
  return localStorage.getItem('access_token') !== null
}

// ✅ 获取 axios 配置（包含认证头）
function getAuthHeaders() {
  const token = localStorage.getItem('access_token')
  return token ? {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  } : {}
}

async function fetchRankings() {
  loading.value = true
  try {
    const response = await axios.get(`/api/stock-rankings?limit=${displayLimit.value}`)
    
    console.log('API响应:', response)
    console.log('响应数据:', response.data)
    
    if (response.data && response.data.success && response.data.data) {
      rankings.value = response.data.data
    } else if (Array.isArray(response.data)) {
      rankings.value = response.data
    } else {
      rankings.value = response.data
    }
    
    console.log('设置后的rankings:', rankings.value)
    
    if (rankings.value.length > 0) {
      const scoreDate = rankings.value[0].score_date
      if (scoreDate) {
        const year = scoreDate.substring(0, 4)
        const month = scoreDate.substring(4, 6)
        const day = scoreDate.substring(6, 8)
        lastUpdateTime.value = `${year}-${month}-${day}`
      } else {
        lastUpdateTime.value = new Date().toLocaleDateString()
      }
    }
  } catch (error) {
    console.error('获取股票排行失败:', error)
    console.error('错误详情:', error.response?.data)
  } finally {
    loading.value = false
  }
}

async function refreshScores() {
  isRefreshing.value = true
  try {
    const response = await axios.post('/api/stock-rankings/refresh')
    console.log('刷新响应:', response.data)
    await fetchRankings()
    alert('评分刷新成功!')
  } catch (error) {
    console.error('重新评分失败:', error)
    console.error('错误详情:', error.response?.data)
    alert('重新评分失败: ' + (error.response?.data?.detail || error.message))
  } finally {
    isRefreshing.value = false
  }
}

// ✅ 获取用户自选股列表
async function fetchWatchlist() {
  if (!isUserLoggedIn()) {
    console.log('用户未登录，跳过获取自选股')
    return
  }
  
  try {
    const response = await axios.get('/api/user/watchlist', getAuthHeaders())
    console.log('自选股响应:', response.data)
    
    if (response.data.success && response.data.data) {
      watchlist.value = response.data.data.symbols || []
    }
  } catch (error) {
    console.error('获取自选股失败:', error)
    if (error.response?.status === 401) {
      console.log('认证失败，请重新登录')
      // 可以触发重新登录逻辑
    }
  }
}

// ✅ 修改添加到自选股功能
async function addToWatchlist(symbol) {
  if (!isUserLoggedIn()) {
    alert('❌ 请先登录后再添加自选股')
    return
  }
  
  try {
    // 检查是否已在自选股中
    if (watchlist.value.includes(symbol)) {
      alert(`ℹ️ ${symbol} 已在自选股中`)
      return
    }
    
    // ✅ 使用正确的 API 端点和方法
    const response = await axios.post('/api/user/watchlist/add', 
      { symbol: symbol }, 
      getAuthHeaders()
    )
    
    console.log('添加自选股响应:', response.data)
    
    if (response.data.success) {
      // 更新本地 watchlist 状态
      watchlist.value.push(symbol)
      alert(`✅ 已将 ${symbol} 添加到自选股`)
    } else {
      alert('❌ 添加自选股失败')
    }
    
  } catch (error) {
    console.error('添加自选股失败:', error)
    
    if (error.response?.status === 401) {
      alert('❌ 认证失败，请重新登录')
    } else if (error.response?.status === 422) {
      alert('❌ 请求格式错误')
    } else {
      alert('❌ 添加自选股失败: ' + (error.response?.data?.detail || error.message))
    }
  }
}

// ✅ 添加从自选股移除功能
async function removeFromWatchlist(symbol) {
  if (!isUserLoggedIn()) {
    alert('❌ 请先登录')
    return
  }
  
  try {
    const response = await axios.delete(`/api/user/watchlist/remove/${symbol}`, getAuthHeaders())
    
    if (response.data.success) {
      // 更新本地 watchlist 状态
      watchlist.value = watchlist.value.filter(s => s !== symbol)
      alert(`✅ 已将 ${symbol} 从自选股中移除`)
    } else {
      alert('❌ 移除失败')
    }
    
  } catch (error) {
    console.error('移除自选股失败:', error)
    alert('❌ 移除自选股失败: ' + (error.response?.data?.detail || error.message))
  }
}

// ✅ 查看自选股详细信息
async function viewWatchlistStocks() {
  if (!isUserLoggedIn()) {
    alert('❌ 请先登录后查看自选股')
    return
  }
  
  try {
    const response = await axios.get('/api/user/watchlist-stocks', getAuthHeaders())
    console.log('自选股详细信息:', response.data)
    
    if (response.data.success) {
      const stocks = response.data.data
      if (stocks.length === 0) {
        alert('📝 自选股列表为空')
      } else {
        // 可以显示详细的自选股信息
        const stockInfo = stocks.map(stock => 
          `${stock.symbol} ${stock.name}: ¥${stock.close || 'N/A'} (${stock.change_percent ? stock.change_percent.toFixed(2) + '%' : 'N/A'})`
        ).join('\n')
        alert(`📋 自选股详细信息:\n${stockInfo}`)
      }
    } else {
      alert('❌ 获取自选股信息失败')
    }
    
  } catch (error) {
    console.error('获取自选股详细信息失败:', error)
    alert('❌ 获取自选股信息失败: ' + (error.response?.data?.detail || error.message))
  }
}

// ✅ 检查股票是否在自选股中
function isInWatchlist(symbol) {
  return watchlist.value.includes(symbol)
}

// ✅ 修改清空自选股功能
async function clearWatchlist() {
  if (!isUserLoggedIn()) {
    alert('❌ 请先登录')
    return
  }
  
  if (!confirm('确定要清空自选股列表吗?')) {
    return
  }
  
  try {
    const response = await axios.put('/api/user/watchlist', 
      { symbols: [] }, 
      getAuthHeaders()
    )
    
    if (response.data.success) {
      watchlist.value = []
      alert('🗑️ 自选股列表已清空')
    } else {
      alert('❌ 清空失败')
    }
    
  } catch (error) {
    console.error('清空自选股失败:', error)
    alert('❌ 清空自选股失败: ' + (error.response?.data?.detail || error.message))
  }
}

function getRankStyle(rank) {
  if (rank <= 3) {
    return { 
      background: 'linear-gradient(135deg, #ff6b6b, #ff5252)',
      color: 'white',
      fontWeight: 'bold', 
      fontSize: '16px',
      textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
    }
  } else if (rank <= 10) {
    return { 
      background: 'linear-gradient(135deg, #ffa726, #ff9800)',
      color: 'white',
      fontWeight: 'bold',
      textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
    }
  } else if (rank <= 30) {
    return { 
      background: 'linear-gradient(135deg, #66bb6a, #4caf50)',
      color: 'white',
      fontWeight: 'bold',
      textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
    }
  }
  return { 
    background: 'linear-gradient(135deg, #90a4ae, #78909c)',
    color: 'white'
  }
}

function getScoreStyle(score) {
  if (score >= 80) {
    return { 
      background: 'linear-gradient(135deg, #4caf50, #388e3c)',
      color: 'white', 
      fontWeight: 'bold',
      textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
    }
  } else if (score >= 70) {
    return { 
      background: 'linear-gradient(135deg, #ff9800, #f57c00)',
      color: 'white', 
      fontWeight: 'bold',
      textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
    }
  } else if (score >= 60) {
    return { 
      background: 'linear-gradient(135deg, #2196f3, #1976d2)',
      color: 'white',
      fontWeight: 'bold',
      textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
    }
  }
  return { 
    background: 'linear-gradient(135deg, #9e9e9e, #757575)',
    color: 'white'
  }
}

function getRowClass(rank) {
  if (rank <= 3) return 'top-three'
  if (rank <= 10) return 'top-ten'
  if (rank <= 30) return 'top-thirty'
  return ''
}

function viewChart(symbol) {
  emit('view-chart', symbol)
}

function showScoreDetailModal(stock) {
  selectedStock.value = stock
  showScoreDetail.value = true
}

function closeScoreDetail() {
  showScoreDetail.value = false
  selectedStock.value = null
}

onMounted(() => {
  fetchRankings()
  fetchWatchlist() // ✅ 页面加载时获取自选股
})
</script>

<style scoped>
/* ✅ 表格整体样式 */
.ranking-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  border-radius: 8px;
  overflow: hidden;
}

/* ✅ 表头样式 */
.table-header {
  background: linear-gradient(135deg, #2c3e50, #34495e);
  color: white;
}

.table-header th {
  border: 1px solid #34495e;
  padding: 12px 8px;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
}

.th-rank { background: linear-gradient(135deg, #e74c3c, #c0392b); }
.th-symbol { background: linear-gradient(135deg, #3498db, #2980b9); }
.th-name { background: linear-gradient(135deg, #9b59b6, #8e44ad); }
.th-score { background: linear-gradient(135deg, #e67e22, #d35400); }
.th-cycle { background: linear-gradient(135deg, #1abc9c, #16a085); }
.th-fundamental { background: linear-gradient(135deg, #f39c12, #e67e22); }
.th-technical { background: linear-gradient(135deg, #2ecc71, #27ae60); }
.th-money { background: linear-gradient(135deg, #e74c3c, #c0392b); }
.th-action { background: linear-gradient(135deg, #95a5a6, #7f8c8d); }

/* ✅ 表格行样式 */
.table-row {
  transition: all 0.3s ease;
}

.table-row:hover {
  background-color: #f8f9fa;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.top-three {
  background: linear-gradient(135deg, #fff5f5, #ffebee);
  border-left: 4px solid #ff5252;
}

.top-ten {
  background: linear-gradient(135deg, #fff8e1, #fffde7);
  border-left: 4px solid #ffa726;
}

.top-thirty {
  background: linear-gradient(135deg, #f1f8e9, #f9fbe7);
  border-left: 4px solid #66bb6a;
}

/* ✅ 单元格基础样式 */
.ranking-table td {
  border: 1px solid #e0e0e0;
  padding: 10px 8px;
  vertical-align: middle;
}

/* ✅ 排名徽章样式 */
.rank-badge {
  display: inline-block;
  min-width: 30px;
  height: 30px;
  line-height: 30px;
  text-align: center;
  border-radius: 50%;
  font-weight: bold;
}

/* ✅ 股票代码样式 */
.symbol-text {
  display: inline-block;
  background: linear-gradient(135deg, #3498db, #2980b9);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: bold;
  font-family: 'Courier New', monospace;
  letter-spacing: 1px;
}

/* ✅ 股票名称样式 */
.name-text {
  display: inline-block;
  background: linear-gradient(135deg, #9b59b6, #8e44ad);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: bold;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ✅ 评分徽章样式 */
.score-badge {
  display: inline-block;
  min-width: 50px;
  padding: 6px 12px;
  border-radius: 20px;
  font-weight: bold;
  text-align: center;
}

/* ✅ 各项评分样式 */
.cycle-score {
  display: inline-block;
  background: linear-gradient(135deg, #1abc9c, #16a085);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: bold;
  min-width: 40px;
  text-align: center;
}

.fundamental-score {
  display: inline-block;
  background: linear-gradient(135deg, #f39c12, #e67e22);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: bold;
  min-width: 40px;
  text-align: center;
}

.technical-score {
  display: inline-block;
  background: linear-gradient(135deg, #2ecc71, #27ae60);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: bold;
  min-width: 40px;
  text-align: center;
}

.money-score {
  display: inline-block;
  background: linear-gradient(135deg, #e74c3c, #c0392b);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: bold;
  min-width: 40px;
  text-align: center;
}

/* ✅ 操作按钮样式 */
.btn-chart, .btn-watch {
  background: linear-gradient(135deg, #3498db, #2980b9);
  color: white;
  border: none;
  padding: 6px 10px;
  border-radius: 4px;
  margin: 0 2px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
}

.btn-chart:hover, .btn-watch:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.btn-watch {
  background: linear-gradient(135deg, #f39c12, #e67e22);
}

/* ✅ 模态框样式保持不变 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}

/* ✅ 响应式设计 */
@media (max-width: 768px) {
  .ranking-table {
    font-size: 12px;
  }
  
  .symbol-text, .name-text {
    padding: 2px 4px;
    font-size: 11px;
  }
  
  .cycle-score, .fundamental-score, .technical-score, .money-score {
    padding: 2px 4px;
    font-size: 11px;
  }
}
</style>