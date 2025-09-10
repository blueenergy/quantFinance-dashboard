<template>
  <div id="app">
    <!-- 未登录时显示登录表单 -->
    <LoginForm 
      v-if="!isAuthenticated" 
      @login-success="handleLoginSuccess"
    />
    
    <!-- 已登录时显示主应用 -->
    <div v-else class="container">
      <header class="header">
        <div class="header-left">
          <h1>� 悟空量化金融智能助手</h1>
        </div>
        <div class="header-right">
          <UserInfo :user="user" @logout="handleLogout" />
        </div>
      </header>
      
      <div class="main-content">
        <!-- 普通用户显示：AI公告栏和搜索功能 -->
        <template v-if="!user?.is_admin">
          <!-- AI公告栏 -->
          <MarketAnalysisBulletin />
          
          <div class="search-section">
            <div class="search-controls">
              <input v-model="symbol" placeholder="输入股票代码 (如 600519)" />
              <button @click="fetchData">查询</button>
            </div>
          </div>
        </template>

        <!-- 管理员显示：极简管理仪表板说明 -->
        <div v-if="user?.is_admin" class="admin-welcome">
          <div class="welcome-card">
            <h2>系统管理控制台</h2>
            <p>悟空量化金融智能助手管理后台</p>
            <div class="admin-features">
              <span class="feature-tag">用户管理</span>
              <span class="feature-tag">系统监控</span>
              <span class="feature-tag">操作日志</span>
              <span class="feature-tag">安全审计</span>
            </div>
          </div>
        </div>

        <div class="tabs">
          <button 
            v-for="tab in adminTabs" 
            :key="tab.id" 
            :class="['tab-button', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id"
          >
            {{ tab.name }}
          </button>

          <!-- 在 App.vue 的标签页中添加 -->
          <button 
            @click="activeTab = 'ranking'" 
            :class="{ active: activeTab === 'ranking' }"
          >
            股票评分
          </button>
        </div>

        <div class="tab-content">
          <div v-if="activeTab === 'watchlist'" class="watchlist-view">
            <WatchListData @select-chart="selectStockForChart" />
          </div>

          <div v-if="activeTab === 'data'" class="data-view">
            <table v-if="records.length" class="data-table">
              <thead>
                <tr>
                  <th>股票代码</th>
                  <th>日期</th>
                  <th>开盘</th>
                  <th>最高</th>
                  <th>最低</th>
                  <th>收盘</th>
                  <th>成交量</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in records.slice(0, 20)" :key="row._id">
                  <td>{{ row.symbol }}</td>
                  <td>{{ formatDate(row.trade_date) }}</td>
                  <td>{{ row.open }}</td>
                  <td>{{ row.high }}</td>
                  <td>{{ row.low }}</td>
                  <td>{{ row.close }}</td>
                  <td>{{ row.volume }}</td>
                </tr>
              </tbody>
            </table>
            <div v-else class="empty">暂无数据</div>
          </div>

          <div v-if="activeTab === 'chart'" class="chart-view">
            <StockChart
              :symbol="chartSymbol"
              :stockName="stockName"
              :records="chartRecords"
              :moneyFlowRecords="moneyFlowRecords"
              :prevStock="prevStock"
              :nextStock="nextStock"
              :hasPrev="hasPrev"
              :hasNext="hasNext"
              :watchlist="watchlist"
              :currentIndex="currentIndex"
            />
          </div>

          <div v-if="activeTab === 'analysis'" class="analysis-view">
            <StockAnalysis />
          </div>

          <div v-if="activeTab === 'history'" class="history-view">
            <AnalysisHistory />
          </div>

          <div v-if="activeTab === 'admin'" class="admin-view">
            <AdminDashboard :current-user="user" />
          </div>

          <!-- 在内容区域添加 -->
          <StockRanking 
            v-show="activeTab === 'ranking'" 
            @view-chart="selectStockForChart"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import LoginForm from './components/LoginForm.vue'
import UserInfo from './components/UserInfo.vue'
import WatchListData from './components/WatchListData.vue'
import StockChart from './components/StockChart.vue'
import StockAnalysis from './components/StockAnalysis.vue'
import AnalysisHistory from './components/AnalysisHistory.vue'
import MarketAnalysisBulletin from './components/MarketAnalysisBulletin.vue'
import AdminDashboard from './components/AdminDashboard.vue'
import StockRanking from './components/StockRanking.vue'
import { ref, onMounted, computed,watch } from 'vue'
import { useAuth, authService } from './services/auth.js'
import axios from 'axios'

// 设置axios请求拦截器，自动添加认证头
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 设置axios响应拦截器，处理认证失败
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 认证失败，清除本地认证信息
      authService.clearAuth()
      console.log('认证已过期，请重新登录')
    }
    return Promise.reject(error)
  }
)

const { user, isAuthenticated, validateToken, logout } = useAuth()

const symbol = ref('')
const records = ref([])
const currentIndex = ref(0)
const watchlist = ref([]) 
const chartRecords = ref([])
const moneyFlowRecords = ref([])
const activeTab = ref('watchlist')
const stockName = ref('')
const chartSymbol = computed(() => 
  watchlist.value.length > 0 ? watchlist.value[currentIndex.value] : ''
)

// 动态标签 - 管理员只显示管理功能，普通用户显示业务功能
const adminTabs = computed(() => {
  if (user.value?.is_admin) {
    // 管理员只显示管理相关标签
    return [
      { id: 'admin', name: '系统管理' }
    ]
  }
  // 普通用户显示业务功能标签
  return tabs.value
})

const tabs = ref([
  { id: 'watchlist', name: '自选股' },
  { id: 'data', name: '数据查询' },
  { id: 'chart', name: 'K线图表' },
  { id: 'analysis', name: 'AI分析' },
  { id: 'history', name: '历史分析' }
])

function formatDate(dateStr) {
  if (!dateStr) return ''
  return dateStr.substring(0, 10)
}

async function fetchData() {
  let url = '/api/records/?limit=2000&sort=-trade_date'
  if (symbol.value) url += `&symbol=${symbol.value}`
  try {
    const res = await axios.get(url)
    records.value = res.data
  } catch (e) {
    console.error('获取数据失败:', e)
    records.value = []
  }
}

function selectStock(stockSymbol) {
  symbol.value = stockSymbol
  fetchData()
}

/**
 * Fetches money flow records for a given stock symbol from the API.
 * @param {string} symbol - The stock symbol to fetch money flow records for.
 * @returns {Promise<Array>} A promise that resolves to an array of money flow records.
 */
async function fetchMoneyFlowRecords(symbol) {
  try {
    const token = localStorage.getItem('access_token')
    const res = await fetch(`/api/money-flow-records?symbol=${symbol}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    const moneyFlowRecords = (await res.json()).data
    //console.log('Debug moneyFlowRecords:', moneyFlowRecords)
    
    return moneyFlowRecords
  } catch (err) {
    console.error('获取资金流向数据时出错:', err)
    return []
  }
}

// 获取股票数据的通用方法
async function loadStockData(symbol) {
  if (!symbol) return
  
  try {
    // console.log(`开始加载股票 ${symbol} 的数据...`)
    
    // 获取K线数据
    const klineUrl = `/api/records/?limit=2000&sort=-trade_date&symbol=${symbol}`
    const klineRes = await axios.get(klineUrl)
    chartRecords.value = klineRes.data

    // 🔍 添加调试：查看K线数据结构
    // console.log('K线数据完整响应:', klineRes.data)
    // if (klineRes.data && klineRes.data.length > 0) {
    //   // console.log('第一条K线记录:', klineRes.data[0])
    //   // console.log('第一条记录的所有字段:', Object.keys(klineRes.data[0]))
    // }

    // 获取资金流数据
    moneyFlowRecords.value = await fetchMoneyFlowRecords(symbol)

    // 检查是否有股票名称字段
    const stockInfo = chartRecords.value.find(stock => stock.symbol === symbol)
    if (stockInfo) {
      // console.log('找到匹配的股票记录:', stockInfo)
      const nameFields = ['name', 'stock_name', 'company_name', 'title']
      let foundName = ''
      nameFields.forEach(field => {
        if (stockInfo[field]) {
          // console.log(`找到名称字段 ${field}:`, stockInfo[field])
          foundName = stockInfo[field]
        }
      })
      stockName.value = foundName  // ✅ 正确：使用 .value
    } else {
      // console.log('未找到匹配的股票记录')
      stockName.value = ''  // ✅ 正确：使用 .value
    }

    // console.log(`股票 ${symbol} 数据加载完成: K线${chartRecords.value.length}条, 资金流${moneyFlowRecords.value.length}条, 名称: ${stockName.value}`)
  } catch (error) {
    console.error(`获取股票${symbol}数据失败:`, error)
    chartRecords.value = []
    moneyFlowRecords.value = []
    stockName.value = ''
  }
}

// 按钮方法
function prevStock() {
  if (hasPrev.value) {
    currentIndex.value--
  }
}

function nextStock() {
  if (hasNext.value) {
    currentIndex.value++
  }
}

// 监听 chartSymbol 变化，自动加载数据
watch(chartSymbol, (newSymbol) => {
  if (newSymbol) {
    loadStockData(newSymbol)
  }
}, { immediate: true })

// 原有的 selectStockForChart 方法也可以简化
async function selectStockForChart(stockSymbol) {
  // 找到该股票在 watchlist 中的索引
  const index = watchlist.value.indexOf(stockSymbol)
  if (index !== -1) {
    currentIndex.value = index
  } else {
    // 如果不在自选股中，添加到列表
    watchlist.value.push(stockSymbol)
    currentIndex.value = watchlist.value.length - 1
  }
  activeTab.value = 'chart'
}

function handleLoginSuccess(authData) {
  console.log('登录成功:', authData.user.username)
  // 使用认证服务设置状态，这会触发响应式更新
  authService.setAuth(authData)
  
  // 根据用户角色设置默认标签页
  if (authData.user.is_admin) {
    activeTab.value = 'admin'
    console.log('管理员登录，跳转到系统管理页面')
  } else {
    activeTab.value = 'watchlist'
    // 普通用户登录后立即加载数据
    fetchData()
  }
}

function handleLogout() {
  logout()
  console.log('用户已登出')
}

onMounted(async () => {
  // 验证现有token是否有效
  if (isAuthenticated.value) {
    const isValid = await validateToken()
    if (!isValid) {
      console.log('Token已失效,请重新登录')
    } else {
      // Token有效，根据用户角色设置默认界面
      if (user.value?.is_admin) {
        activeTab.value = 'admin'
        console.log('管理员自动跳转到系统管理页面')
      } else {
        activeTab.value = 'watchlist'
        // 普通用户加载初始数据
        fetchData()
      }
      // 仅在认证通过后获取自选股
      const token = localStorage.getItem('access_token')
      try {
        const res = await axios.get('/api/user/watchlist-stocks', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        // 兼容后端返回结构，若无 stocks 字段则回退为 []
        if (res.data && res.data.success && Array.isArray(res.data.data)) {
          watchlist.value = res.data.data.map(stock => stock.symbol)
        } else {
          // 如果接口失败，使用默认值
          watchlist.value = ['000001', '000002', '000003']
        }
      } catch (e) {
        console.error('获取自选股失败:', e)
        watchlist.value = ['000001', '000002', '000003']
      }
    }
  }
})

// 新增代码：图表视图的股票选择逻辑

const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value < watchlist.value.length - 1)
</script>

<style scoped>
#app {
  min-height: 100vh;
  background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #2d1b69 100%);
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  background: linear-gradient(135deg, #1e1e3f 0%, #2a2a5e 100%);
  min-height: 100vh;
  box-shadow: 0 0 40px rgba(138, 43, 226, 0.3);
  border: 1px solid rgba(138, 43, 226, 0.2);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 30px;
  background: linear-gradient(135deg, #8a2be2 0%, #9370db 50%, #6a5acd 100%);
  color: white;
  box-shadow: 0 4px 20px rgba(138, 43, 226, 0.4);
  position: relative;
}

.header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg, rgba(255,255,255,0.1) 0%, transparent 50%);
  pointer-events: none;
}

.header-left h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
  background: linear-gradient(45deg, #ffffff, #e6e6fa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header-right {
  min-width: 200px;
}

.main-content {
  padding: 30px;
  background: linear-gradient(135deg, #1e1e3f 0%, #2a2a5e 100%);
}

.search-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  gap: 20px;
}

.search-controls {
  display: flex;
  gap: 10px;
}

.search-controls input {
  padding: 12px;
  border: 2px solid rgba(138, 43, 226, 0.3);
  border-radius: 8px;
  font-size: 16px;
  min-width: 250px;
  background: rgba(30, 30, 63, 0.8);
  color: #e6e6fa;
  transition: all 0.3s;
}

.search-controls input:focus {
  outline: none;
  border-color: #8a2be2;
  box-shadow: 0 0 15px rgba(138, 43, 226, 0.5);
  background: rgba(30, 30, 63, 1);
}

.search-controls input::placeholder {
  color: rgba(230, 230, 250, 0.6);
}

.search-controls button {
  padding: 12px 24px;
  background: linear-gradient(135deg, #8a2be2 0%, #9370db 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.3s;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
  box-shadow: 0 4px 15px rgba(138, 43, 226, 0.3);
}

.search-controls button:hover {
  background: linear-gradient(135deg, #9370db 0%, #ba55d3 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(138, 43, 226, 0.5);
}

/* 管理员欢迎区域样式 - 蓝白专业设计 */
.admin-welcome {
  margin-bottom: 40px;
}

.welcome-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

.welcome-card h2 {
  color: #0f172a;
  margin: 0 0 16px 0;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.3px;
}

.welcome-card p {
  color: #64748b;
  margin: 0 0 32px 0;
  font-size: 16px;
  font-weight: 400;
}

.admin-features {
  display: flex;
  justify-content: center;
  gap: 1px;
  flex-wrap: wrap;
  background: #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}

.feature-tag {
  background: #f1f5f9;
  color: #64748b;
  padding: 12px 20px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  min-width: 100px;
  text-align: center;
  transition: all 0.15s ease;
}

.feature-tag:hover {
  background: #e2e8f0;
  color: #475569;
}

.tabs {
  display: flex;
  border-bottom: 2px solid rgba(138, 43, 226, 0.3);
  margin-bottom: 30px;
  background: rgba(30, 30, 63, 0.5);
  border-radius: 8px 8px 0 0;
}

.tab-button {
  padding: 12px 24px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  color: #b19cd9;
  border-bottom: 2px solid transparent;
  transition: all 0.3s;
  position: relative;
}

.tab-button:hover {
  color: #e6e6fa;
  background: rgba(138, 43, 226, 0.1);
}

.tab-button.active {
  color: #ffffff;
  border-bottom-color: #8a2be2;
  background: linear-gradient(135deg, rgba(138, 43, 226, 0.2) 0%, rgba(147, 112, 219, 0.2) 100%);
}

.tab-content {
  min-height: 400px;
  background: rgba(30, 30, 63, 0.3);
  border-radius: 8px;
  padding: 20px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
  box-shadow: 0 4px 20px rgba(138, 43, 226, 0.2);
  border-radius: 12px;
  overflow: hidden;
  background: rgba(30, 30, 63, 0.8);
}

.data-table th,
.data-table td {
  border: 1px solid rgba(138, 43, 226, 0.2);
  padding: 12px;
  text-align: left;
  color: #e6e6fa;
}

.data-table th {
  background: linear-gradient(135deg, #8a2be2 0%, #9370db 100%);
  color: #fff;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

.data-table tr:nth-child(even) {
  background: rgba(42, 42, 94, 0.5);
}

.data-table tr:hover {
  background: rgba(138, 43, 226, 0.1);
  transform: scale(1.01);
  transition: all 0.2s;
}

.empty {
  color: #b19cd9;
  margin-top: 30px;
  text-align: center;
  font-size: 18px;
  padding: 60px;
  background: rgba(30, 30, 63, 0.5);
  border-radius: 8px;
  border: 1px solid rgba(138, 43, 226, 0.2);
}

.chart-view,
.analysis-view {
  padding: 20px 0;
  background: rgba(30, 30, 63, 0.3);
  border-radius: 8px;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(30, 30, 63, 0.5);
}

::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #8a2be2, #9370db);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, #9370db, #ba55d3);
}
</style>
