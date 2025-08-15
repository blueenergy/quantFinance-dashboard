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
          <h1>📊 量价数据可视化 Dashboard</h1>
        </div>
        <div class="header-right">
          <UserInfo :user="user" @logout="handleLogout" />
        </div>
      </header>
      
      <div class="main-content">
        <div class="search-section">
          <WatchList @select="selectStock" />
          <div class="search-controls">
            <input v-model="symbol" placeholder="输入股票代码 (如 600519)" />
            <button @click="fetchData">查询</button>
          </div>
        </div>

        <div class="tabs">
          <button 
            v-for="tab in tabs" 
            :key="tab.id" 
            :class="['tab-button', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id"
          >
            {{ tab.name }}
          </button>
        </div>

        <div class="tab-content">
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
            <StockChart :records="records" />
          </div>

          <div v-if="activeTab === 'analysis'" class="analysis-view">
            <StockAnalysis />
          </div>

          <div v-if="activeTab === 'history'" class="history-view">
            <AnalysisHistory />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import LoginForm from './components/LoginForm.vue'
import UserInfo from './components/UserInfo.vue'
import WatchList from './components/WatchList.vue'
import StockChart from './components/StockChart.vue'
import StockAnalysis from './components/StockAnalysis.vue'
import AnalysisHistory from './components/AnalysisHistory.vue'
import { ref, onMounted } from 'vue'
import { useAuth, authService } from './services/auth.js'
import axios from 'axios'

const { user, isAuthenticated, validateToken, logout } = useAuth()

const symbol = ref('')
const records = ref([])
const activeTab = ref('data')

const tabs = [
  { id: 'data', name: '数据表格' },
  { id: 'chart', name: 'K线图表' },
  { id: 'analysis', name: 'AI分析' },
  { id: 'history', name: '历史分析' }
]

function formatDate(dateStr) {
  if (!dateStr) return ''
  return dateStr.substring(0, 10)
}

async function fetchData() {
  let url = '/records/?limit=2000&sort=-trade_date'
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

function handleLoginSuccess(authData) {
  console.log('登录成功:', authData.user.username)
  // 使用认证服务设置状态，这会触发响应式更新
  authService.setAuth(authData)
  // 登录成功后立即加载数据
  fetchData()
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
      console.log('Token已失效，请重新登录')
    }
  }
  
  // 如果已登录，加载初始数据
  if (isAuthenticated.value) {
    fetchData()
  }
})
</script>

<style scoped>
#app {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  background: #fff;
  min-height: 100vh;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 30px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.header-left h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.header-right {
  min-width: 200px;
}

.main-content {
  padding: 30px;
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
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  min-width: 250px;
}

.search-controls button {
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: opacity 0.3s;
}

.search-controls button:hover {
  opacity: 0.9;
}
.container {
  max-width: 1400px;
  margin: 20px auto;
  background: #fff;
  padding: 30px;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
}

.header h1 {
  margin: 0;
  color: #007bff;
  font-size: 28px;
}

.search-section {
  margin-bottom: 30px;
  display: flex;
  gap: 10px;
  max-width: 400px;
}

.search-section input {
  flex: 1;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.search-section button {
  padding: 12px 24px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.2s;
}

.search-section button:hover {
  background-color: #0056b3;
}

.tabs {
  display: flex;
  border-bottom: 2px solid #e0e0e0;
  margin-bottom: 30px;
}

.tab-button {
  padding: 12px 24px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  color: #666;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-button:hover {
  color: #007bff;
}

.tab-button.active {
  color: #007bff;
  border-bottom-color: #007bff;
}

.tab-content {
  min-height: 400px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.data-table th,
.data-table td {
  border: 1px solid #ddd;
  padding: 12px;
  text-align: left;
}

.data-table th {
  background: #007bff;
  color: #fff;
  font-weight: 600;
}

.data-table tr:nth-child(even) {
  background: #f8f9fa;
}

.data-table tr:hover {
  background: #e3f2fd;
}

.empty {
  color: #888;
  margin-top: 30px;
  text-align: center;
  font-size: 18px;
  padding: 60px;
}

.chart-view,
.analysis-view {
  padding: 20px 0;
}
</style>
