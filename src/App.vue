<template>
  <v-app id="app">
    <!-- 重置密码页面 -->
    <ResetPassword 
      v-if="isResetPasswordMode" 
      :token="resetToken"
      @done="handleResetDone"
    />
    
    <!-- 未登录时显示登录表单 -->
    <LoginForm 
      v-else-if="!isAuthenticated" 
      @login-success="handleLoginSuccess"
    />
    
    <!-- 已登录时显示主应用 -->
    <div v-else class="container">
      <header class="header">
        <div class="header-left">
          <h1 v-if="isAuthenticated">🔥 悟空量化金融智能助手</h1>
        </div>
        <div class="header-right">
          <NotificationCenter />
          <UserAvatar :user="user" @logout="handleLogout" />
        </div>
      </header>
      
      <div class="main-content">
        <!-- 普通用户显示：AI公告栏和搜索功能 -->
        <template v-if="!user?.is_admin">
          <!-- 全球市场联动分析 (盘前) -->
          <GlobalMarketBrief />
          <!-- 数据脉搏 (系统心跳 + 新闻 + 同步状态) -->
          <DataPulse />
          <!-- AI公告栏 (盘中/盘后) -->
          <MarketAnalysisBulletin />
          
          <div class="search-section" v-if="false">
            <!-- Legacy search section removed -->
          </div>
        </template>

        <!-- 管理员显示：极简管理仪表板说明 -->
        <div v-if="isAuthenticated && user?.is_admin" class="admin-welcome">
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

        <template v-if="tabsShellReady">
        <div class="tabs">
          <button 
            v-for="tab in adminTabs" 
            :key="tab.id" 
            :class="['tab-button', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id"
          >
            {{ tab.name }}
          </button>
        </div>

        <div v-if="user?.is_admin || adminTabs.length" class="tab-content">
          <div v-if="activeTab === 'watchlist'" class="watchlist-view">
            <WatchListData @select-chart="selectStockForChart" />
          </div>

          <!-- Legacy data view removed -->

          <div v-if="activeTab === 'chart'" class="chart-view">
            <Suspense>
              <template #default>
                <StockChart
                  :symbol="chartSymbol"
                  :stockName="stockName"
                  :records="chartRecords"
                  :moneyFlowRecords="moneyFlowRecords"
                  :signalDates="signalDates"
                  :tradeMarkers="tradeMarkers"
                  :prevStock="prevStock"
                  :nextStock="nextStock"
                  :hasPrev="hasPrev"
                  :hasNext="hasNext"
                  :watchlist="watchlist"
                  :currentIndex="currentIndex"
                  :strategyFrom="currentStrategy"
                  :presetFrom="currentPreset"
                  @go-back="goBackToStrategyPool"
                  @load-more="handleLoadMore"
                />
              </template>
              <template #fallback>
                <div class="skeleton skeleton-chart">图表加载中...</div>
              </template>
            </Suspense>
          </div>

          <!-- AI analysis removed from its own tab. Use AIAnalysisHistory for all AI-related features. -->

          <div v-if="activeTab === 'history'" class="history-view">
            <Suspense>
              <template #default>
                <AIAnalysisHistory />
              </template>
              <template #fallback>
                <div class="skeleton skeleton-table">AI分析回溯加载中...</div>
              </template>
            </Suspense>
          </div>

          <div v-if="activeTab === 'admin' && user?.is_admin" class="admin-view">
            <Suspense>
              <template #default>
                <AdminDashboard :current-user="user" />
              </template>
              <template #fallback>
                <div class="skeleton skeleton-card">管理面板加载中...</div>
              </template>
            </Suspense>
          </div>

          <div v-if="activeTab === 'strategies'" class="strategies-view">
            <Suspense>
              <template #default>
                <WatchlistStrategyTable />
              </template>
              <template #fallback>
                <div class="skeleton skeleton-table">策略配置加载中...</div>
              </template>
            </Suspense>
          </div>

          <!-- ETF淘金 -->
          <Suspense v-if="activeTab === 'etf'">
            <template #default>
              <EtfView />
            </template>
            <template #fallback>
              <div class="skeleton skeleton-table">ETF模块加载中...</div>
            </template>
          </Suspense>

          <!-- 财报猎手 -->
          <Suspense v-if="activeTab === 'earnings-hunter'">
            <template #default>
              <EarningsHunter />
            </template>
            <template #fallback>
              <div class="skeleton skeleton-table">财报猎手加载中...</div>
            </template>
          </Suspense>

          <!-- 在内容区域添加 -->
          <Suspense v-if="activeTab === 'ranking'">
            <template #default>
              <StockRanking @view-chart="selectStockForChart" />
            </template>
            <template #fallback>
              <div class="skeleton skeleton-table">评分模块加载中...</div>
            </template>
          </Suspense>
          <Suspense v-if="activeTab === 'spectrum'">
            <template #default>
              <MarketSpectrum />
            </template>
            <template #fallback>
              <div class="skeleton skeleton-chart">市场阴阳谱加载中...</div>
            </template>
          </Suspense>

          <div v-if="activeTab === 'securities'" class="securities-view">
            <Suspense>
              <template #default>
                <SecuritiesAccountDashboard />
              </template>
              <template #fallback>
                <div class="skeleton skeleton-table">账户工作台加载中...</div>
              </template>
            </Suspense>
          </div>

          <!-- 添加这一部分 -->
          <Suspense v-if="activeTab === 'trade-executions'">
            <template #default>
              <TradeExecutionTable />
            </template>
            <template #fallback>
              <div class="skeleton skeleton-table">交易执行记录加载中...</div>
            </template>
          </Suspense>

          <!-- 新增：手动交易管理标签页 -->
          <Suspense v-if="activeTab === 'trading-manual'">
            <template #default>
              <TradingManualPanel />
            </template>
            <template #fallback>
              <div class="skeleton skeleton-table">手动交易面板加载中...</div>
            </template>
          </Suspense>


          
          <!-- Strategy Workers Tab (New) -->
          <Suspense v-if="activeTab === 'strategy-workers'">
            <template #default>
              <StrategyWorkers />
            </template>
            <template #fallback>
              <div class="skeleton skeleton-table">策略 Workers 加载中...</div>
            </template>
          </Suspense>
          
          <!-- Strategy Execution Analysis Tab -->
          <Suspense v-if="activeTab === 'strategy-execution-analysis'">
            <template #default>
              <StrategyExecutionAnalysis />
            </template>
            <template #fallback>
              <div class="skeleton skeleton-table">策略执行分析加载中...</div>
            </template>
          </Suspense>
          
          <!-- User Profile Tab -->
          <Suspense v-if="activeTab === 'user-profile'">
            <template #default>
              <UserProfile :user="user" />
            </template>
            <template #fallback>
              <div class="skeleton skeleton-table">用户配置加载中...</div>
            </template>
          </Suspense>
          
          <!-- Backtest Manager Tab -->
          <Suspense v-if="activeTab === 'backtest'">
            <template #default>
              <BacktestManager />
            </template>
            <template #fallback>
              <div class="skeleton skeleton-table">回测管理加载中...</div>
            </template>
          </Suspense>


          <!-- Strategy Stock Pool Tab -->
          <Suspense v-if="activeTab === 'strategy-pool'">
            <template #default>
              <StrategyStockPool @view-chart="selectStockForChart" />
            </template>
            <template #fallback>
              <div class="skeleton skeleton-table">策略股池加载中...</div>
            </template>
          </Suspense>

          <!-- Limit-Up Ladder Tab (连板天梯) -->
          <Suspense v-if="activeTab === 'limit-up-ladder'">
            <template #default>
              <LimitUpLadder />
            </template>
            <template #fallback>
              <div class="skeleton skeleton-table">连板天梯加载中...</div>
            </template>
          </Suspense>

          <!-- AI Chat Assistant Tab -->
          <Suspense v-if="activeTab === 'chat'">
            <template #default>
              <ChatPanel />
            </template>
            <template #fallback>
              <div class="skeleton skeleton-table">AI助手加载中...</div>
            </template>
          </Suspense>

          <!-- Sector Concept Analysis Tab (概念板块分析) -->
          <Suspense v-if="activeTab === 'sector-concept'">
            <template #default>
              <SectorConceptAnalysis />
            </template>
            <template #fallback>
              <div class="skeleton skeleton-table">概念板块分析加载中...</div>
            </template>
          </Suspense>

          <!-- Hot Stock Analysis Tab -->
          <Suspense v-if="activeTab === 'hot-stock'">
            <template #default>
              <HotStockAnalysis />
            </template>
            <template #fallback>
              <div class="skeleton skeleton-table">热股分析加载中...</div>
            </template>
          </Suspense>
        </div>
        <p v-else class="nav-policy-loading">无法加载主导航列表，请刷新页面重试。</p>
        </template>
        <p v-else class="nav-policy-loading">主导航策略加载中…</p>
      </div>
    </div>
  </v-app>
</template>

<script setup>
import LoginForm from './components/LoginForm.vue'
import UserAvatar from './components/UserAvatar.vue'
import NotificationCenter from './components/NotificationCenter.vue'
import WatchListData from './components/WatchListData.vue'
import ResetPassword from './components/ResetPassword.vue'
import EtfView from './views/EtfView.vue'
import DataPulse from './components/DataPulse.vue'
// Lazy-load heavy views/components to avoid loading them for normal users
import { defineAsyncComponent, ref, onMounted, computed, watch, nextTick } from 'vue'
const StockChart = defineAsyncComponent(() => import('./components/StockChart.vue'))
// StockAnalysis component removed: AI analysis moved to AIAnalysisHistory
const AIAnalysisHistory = defineAsyncComponent(() => import('./components/AIAnalysisHistory.vue'))
const MarketAnalysisBulletin = defineAsyncComponent(() => import('./components/MarketAnalysisBulletin.vue'))
const GlobalMarketBrief = defineAsyncComponent(() => import('./components/GlobalMarketBrief.vue'))
const AdminDashboard = defineAsyncComponent(() => import('./components/AdminDashboard.vue'))
const StockRanking = defineAsyncComponent(() => import('./components/StockRanking.vue'))
const MarketSpectrum = defineAsyncComponent(() => import('./components/MarketSpectrum.vue'))
const WatchlistStrategyTable = defineAsyncComponent(() => import('./components/WatchlistStrategyTable.vue'))
const TradeExecutionTable = defineAsyncComponent(() => import('./components/TradeExecutionTable.vue'))
// 新增：手动交易管理组件
const TradingManualPanel = defineAsyncComponent(() => import('./components/TradingManualPanel.vue'))

const StrategyWorkers = defineAsyncComponent(() => import('./views/StrategyWorkers.vue'))
const StrategyExecutionAnalysis = defineAsyncComponent(() => import('./components/StrategyExecutionAnalysis.vue'))
const SecuritiesAccountDashboard = defineAsyncComponent(() => import('./components/SecuritiesAccountDashboard.vue'))
const UserProfile = defineAsyncComponent(() => import('./components/UserProfile.vue'))
const BacktestManager = defineAsyncComponent(() => import('./components/BacktestManager.vue'))
const StrategyStockPool = defineAsyncComponent(() => import('./components/StrategyStockPool.vue'))
const LimitUpLadder = defineAsyncComponent(() => import('./views/LimitUpLadder.vue'))
const SectorConceptAnalysis = defineAsyncComponent(() => import('./components/SectorConceptAnalysis.vue'))
const HotStockAnalysis = defineAsyncComponent(() => import('./components/HotStockAnalysis.vue'))
const EarningsHunter = defineAsyncComponent(() => import('./views/EarningsHunter.vue'))
const ChatPanel = defineAsyncComponent(() => import('./components/ChatPanel.vue'))
import { useAuth, authService } from './services/auth.js'
import axios from 'axios'

// 设置axios请求拦截器，自动添加认证头
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // Guard: prevent calling analysis-history without a symbol (backend requires symbol)
    try {
      const url = config.url || ''
      const method = (config.method || 'get').toString().toLowerCase()
      if (method === 'get' && url.includes('/api/analysis-history')) {
        const params = config.params || {}
        // Allow requests that provide either a symbol OR pagination params (page/limit)
        const hasSymbol = !!params.symbol
        const hasPagination = params.page || params.limit
        if (!hasSymbol && !hasPagination) {
          return Promise.reject({ message: 'Client blocked: analysis-history requires symbol or pagination parameters' })
        }
      }
    } catch (e) {
      // swallow
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

// 主导航可见列表：与权益矩阵对齐；sessionStorage 减轻首屏「null=不筛」导致的闪烁与错乱
const NAV_CACHE_IDS_KEY = 'nav_visible_tab_ids_v1'
const NAV_CACHE_USER_KEY = 'nav_visible_tab_username_v1'
const ACTIVE_TAB_KEY = 'activeTab_v2'
const ACTIVE_TAB_USER_KEY = 'activeTab_username_v2'

function readNavCacheRaw() {
  try {
    const u = sessionStorage.getItem(NAV_CACHE_USER_KEY)
    const raw = sessionStorage.getItem(NAV_CACHE_IDS_KEY)
    if (!u || !raw) return null
    const userJson = localStorage.getItem('user_info')
    if (!userJson) return null
    const current = JSON.parse(userJson).username
    if (current !== u) return null
    const ids = JSON.parse(raw)
    return Array.isArray(ids) ? ids : null
  } catch {
    return null
  }
}

function writeNavCache(ids, username) {
  try {
    if (!username || !Array.isArray(ids)) return
    sessionStorage.setItem(NAV_CACHE_USER_KEY, username)
    sessionStorage.setItem(NAV_CACHE_IDS_KEY, JSON.stringify(ids))
  } catch {
    /* storage quota / private mode */
  }
}

function clearNavCache() {
  try {
    sessionStorage.removeItem(NAV_CACHE_USER_KEY)
    sessionStorage.removeItem(NAV_CACHE_IDS_KEY)
  } catch {
    /* ignore */
  }
}

function readActiveTabCache() {
  try {
    const u = localStorage.getItem(ACTIVE_TAB_USER_KEY)
    const tab = localStorage.getItem(ACTIVE_TAB_KEY)
    const userJson = localStorage.getItem('user_info')
    if (!u || !tab || !userJson) return null
    const current = JSON.parse(userJson).username
    if (!current || current !== u) return null
    return tab
  } catch {
    return null
  }
}

function writeActiveTabCache(tab, username) {
  try {
    if (!tab || !username) return
    localStorage.setItem(ACTIVE_TAB_USER_KEY, username)
    localStorage.setItem(ACTIVE_TAB_KEY, tab)
  } catch {
    /* ignore */
  }
}

function clearActiveTabCache() {
  try {
    localStorage.removeItem(ACTIVE_TAB_USER_KEY)
    localStorage.removeItem(ACTIVE_TAB_KEY)
    // Clean legacy key to avoid cross-account tab bleed.
    localStorage.removeItem('activeTab')
  } catch {
    /* ignore */
  }
}

// 密码重置相关状态
const isResetPasswordMode = ref(false)
const resetToken = ref('')

const currentIndex = ref(0)
const watchlist = ref([]) 
const chartRecords = ref([])
const moneyFlowRecords = ref([])
const activeTab = ref('watchlist')
const stockName = ref('')
const chartSymbol = computed(() => 
  watchlist.value.length > 0 ? watchlist.value[currentIndex.value] : ''
)
const signalDates = ref([]) // 用于在图表上标记信号日期
const currentStrategy = ref('') // 当前查看股票的策略
const currentPreset = ref('') // 当前查看股票的preset
const tradeMarkers = ref([]) // 交易标记点（买入+卖出）

const _cachedNavIds = readNavCacheRaw()
/** 非管理员：服务端允许的 tab id；null 且 navPolicyResolved 时表示仅本地 VIP 规则 */
const serverVisibleTabIds = ref(_cachedNavIds)
/** 是否已具备可信导航策略（避免此前 serverVisibleTabIds===null 时完全跳过矩阵筛选） */
const navPolicyResolved = ref(!!_cachedNavIds)

const tabsShellReady = computed(() => {
  if (user.value?.is_admin) return true
  return navPolicyResolved.value
})

async function loadNavigationTabs() {
  const token = localStorage.getItem('access_token')
  if (!token || !isAuthenticated.value) {
    serverVisibleTabIds.value = null
    navPolicyResolved.value = false
    clearNavCache()
    return
  }
  try {
    const res = await axios.get('/api/user/navigation-tabs')
    if (res.data?.success && Array.isArray(res.data.data?.visible_tab_ids)) {
      serverVisibleTabIds.value = res.data.data.visible_tab_ids
      const u = user.value?.username
      if (u) writeNavCache(serverVisibleTabIds.value, u)
    } else {
      serverVisibleTabIds.value = null
    }
  } catch (e) {
    console.error('加载主导航策略失败:', e)
    if (!readNavCacheRaw()) {
      serverVisibleTabIds.value = null
    }
  } finally {
    navPolicyResolved.value = true
  }
}

// 监听activeTab变化，保存到localStorage
watch(activeTab, (newTab) => {
  const username = user.value?.username
  if (username) {
    writeActiveTabCache(newTab, username)
  }
  console.log('已保存当前tab:', newTab)
})

// 动态标签：管理员固定全量业务 Tab + 后台；普通用户仅按服务端权益矩阵返回的 visible_tab_ids（顺序一致）
const adminTabs = computed(() => {
  const baseTabs = [
    { id: 'limit-up-ladder', name: '📊 连板天梯' },
    { id: 'sector-concept', name: '📈 概念板块' },
    { id: 'hot-stock', name: '🔥 热股分析' },
    { id: 'etf', name: '💰 ETF淘金' },
    { id: 'earnings-hunter', name: '🎯 财报猎手' },
    { id: 'strategy-pool', name: '🎯 策略股池' },
    { id: 'ranking', name: '金榜' },
    { id: 'watchlist', name: '自选股' },
    { id: 'backtest', name: '📊 回测管理' },
    { id: 'strategies', name: '策略配置' },
    { id: 'strategy-workers', name: '🚀 实盘交易' },
    { id: 'trade-executions', name: '交易记录' },
    { id: 'trading-manual', name: '人工干预' },
    { id: 'history', name: 'AI分析回溯' },
    { id: 'strategy-execution-analysis', name: '策略执行分析' },
    { id: 'spectrum', name: '阴阳谱' },
    { id: 'securities', name: '账户工作台' },
    { id: 'user-profile', name: '用户配置' },
    { id: 'chat', name: '🤖 AI助手' },
  ]

  if (user.value?.is_admin) {
    const filteredTabs = baseTabs.map((t) => ({ ...t }))
    filteredTabs.push({ id: 'admin', name: '管理后台' })
    return filteredTabs
  }

  if (!navPolicyResolved.value) {
    return []
  }

  const ids = serverVisibleTabIds.value
  if (!Array.isArray(ids) || ids.length === 0) {
    return []
  }

  const tabById = Object.fromEntries(baseTabs.map((t) => [t.id, t]))
  const filteredTabs = []
  for (const id of ids) {
    const row = tabById[id]
    if (row) filteredTabs.push({ ...row })
  }
  return filteredTabs
})

watch(adminTabs, (tabs) => {
  const ids = tabs.map((t) => t.id)
  if (!ids.length) {
    return
  }
  if (!ids.includes(activeTab.value)) {
    activeTab.value = ids[0]
  }
}, { deep: true })


function formatDate(dateStr) {
  if (!dateStr) return ''
  return dateStr.substring(0, 10)
}

function normalizeDateForComparison(dateStr) {
  // Convert various date formats to consistent YYYYMMDD format
  if (!dateStr) return ''
  
  // If already in YYYYMMDD format (8 digits), return as is
  if (/^\d{8}$/.test(dateStr)) {
    return dateStr
  }
  
  // If in YYYY-MM-DD format, convert to YYYYMMDD
  if (dateStr.includes('-')) {
    return dateStr.replace(/-/g, '')
  }
  
  // If in other formats, try to parse and convert
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      return dateStr // Return original if can't parse
    }
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}${month}${day}`
  } catch (e) {
    return dateStr // Return original if parsing fails
  }
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
    // 计算最近90天的日期范围，减少初次加载数据量
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 120) // 增加到120天，更稳妥一点
    
    // 如果有特定的信号日期，确保范围包含它
    if (signalDates.value.length > 0) {
      const sDate = signalDates.value[0]
      // 20251107 -> 2025-11-07
      const sDateStr = sDate.length === 8 ? `${sDate.slice(0,4)}-${sDate.slice(4,6)}-${sDate.slice(6,8)}` : sDate
      const sigDate = new Date(sDateStr)
      if (sigDate < start) {
        // 如果信号日期更早，将起始日期设为信号日期前一个月
        start.setTime(sigDate.getTime() - (30 * 24 * 60 * 60 * 1000))
      }
    }

    const toYmd = (d) => d.toISOString().slice(0,10).replace(/-/g, '')
    const startDate = toYmd(start)
    const endDate = toYmd(end)

    // 并行获取K线与资金流数据，并添加请求超时避免长时间阻塞
    const klineUrl = `/api/records/?limit=500&sort=-trade_date&symbol=${symbol}&start_date=${startDate}&end_date=${endDate}`
    const klineReq = axios.get(klineUrl, { timeout: 10000 })
    const moneyFlowReq = fetchMoneyFlowRecords(symbol)
    
    // 获取交易历史（买入+卖出）- 支持所有策略
    let tradeHistoryReq = Promise.resolve({ data: { trades: [] } })
    if (symbol) {
      console.log('准备获取交易历史，symbol:', symbol, 'currentStrategy:', currentStrategy.value);
      let tradeUrl = `/api/strategy-pool/trade-history?symbol=${symbol}`
      // 如果有策略信息，限制到特定策略
      if (currentStrategy.value) {
        tradeUrl += `&strategy=${currentStrategy.value}`
        if (currentPreset.value) {
          tradeUrl += `&preset=${currentPreset.value}`
        }
      } else {
        console.log('未选择策略，获取所有策略的交易历史。');
      }
      
      console.log('正在请求交易历史:', tradeUrl);
      tradeHistoryReq = axios.get(tradeUrl, { timeout: 5000 })
        .then(response => {
          console.log('交易历史API响应:', response.data);
          console.log('完整的响应对象:', response);
          return response.data; // Return response.data (the server response body)
        })
        .catch(err => {
          console.warn('获取交易历史失败:', err)
          // Return a server response-like object with data field
          return { 
            success: false,
            data: {
              symbol: symbol,
              strategy: currentStrategy.value,
              preset: currentPreset.value,
              count: 0,
              trades: [] 
            }
          };
        })
    } else {
      console.log('股票代码为空，跳过获取交易历史。');
    }

    const [klineRes, moneyFlowRes, tradeHistoryRes] = await Promise.all([klineReq, moneyFlowReq, tradeHistoryReq])
    
    // 处理交易历史标记
    const trades = tradeHistoryRes.data.trades || []
    tradeMarkers.value = trades.map(tr => ({
      date: normalizeDateForComparison(tr.datetime.split(' ')[0]),  // Normalize date format for comparison
      action: tr.action,  // BUY or SELL
      price: tr.price,
      pnl: tr.pnl || 0
    }))
    
    console.log(`股票 ${symbol} 交易历史: 共 ${trades.length} 条记录`)
    
    // 计算包含所有交易日期的完整日期范围
    const allTradeDates = trades.map(tr => normalizeDateForComparison(tr.datetime.split(' ')[0]))
    let adjustedStartDate = normalizeDateForComparison(startDate)
    let adjustedEndDate = normalizeDateForComparison(endDate)
    
    // 调整开始日期以包含最早的交易日期
    if (allTradeDates.length > 0) {
      const earliestTradeDate = allTradeDates.reduce((earliest, current) => {
        return current < earliest ? current : earliest
      }, adjustedEndDate) // Initialize with endDate as default
      if (earliestTradeDate < adjustedStartDate) {
        adjustedStartDate = earliestTradeDate
      }
    }
    
    // 调整结束日期以包含最晚的交易日期
    if (allTradeDates.length > 0) {
      const latestTradeDate = allTradeDates.reduce((latest, current) => {
        return current > latest ? current : latest
      }, adjustedStartDate) // Initialize with startDate as default
      if (latestTradeDate > adjustedEndDate) {
        adjustedEndDate = latestTradeDate
      }
    }
    
    // 如果日期范围被调整，重新获取K线数据
    if (adjustedStartDate !== normalizeDateForComparison(startDate) || adjustedEndDate !== normalizeDateForComparison(endDate)) {
      console.log(`调整日期范围以包含交易记录: ${adjustedStartDate} 到 ${adjustedEndDate}`)
      const adjustedKlineUrl = `/api/records/?limit=500&sort=-trade_date&symbol=${symbol}&start_date=${adjustedStartDate}&end_date=${adjustedEndDate}`
      const adjustedKlineRes = await axios.get(adjustedKlineUrl, { timeout: 10000 })
      chartRecords.value = adjustedKlineRes.data
    } else {
      chartRecords.value = klineRes.data
    }
    
    moneyFlowRecords.value = moneyFlowRes

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

// 新增：加载更多历史数据（无限滚动）
async function handleLoadMore(earliestDate) {
  if (!chartSymbol.value || !earliestDate) return
  
  try {
    const symbol = chartSymbol.value
    const currentStart = new Date(earliestDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'))
    const prevStart = new Date(currentStart)
    prevStart.setDate(prevStart.getDate() - 180)
    
    const toYmd = (d) => d.toISOString().slice(0,10).replace(/-/g, '')
    const startDateStr = toYmd(prevStart)
    const endDateStr = earliestDate.replace(/-/g, '')
    
    const klineUrl = `/api/records/?limit=1000&sort=-trade_date&symbol=${symbol}&start_date=${startDateStr}&end_date=${endDateStr}`
    
    const [klineRes, moneyFlowRes] = await Promise.all([
      axios.get(klineUrl, { timeout: 15000 }),
      axios.get(`/api/money-flow-records?symbol=${symbol}&start_date=${startDateStr}&end_date=${endDateStr}`)
    ])
    
    const newRecords = klineRes.data || []
    const newMoneyFlow = moneyFlowRes.data.data || []
    
    if (newRecords.length === 0) {
      return
    }

    const recordMap = new Map()
    newRecords.forEach(r => recordMap.set(normalizeDateForComparison(r.trade_date), r))
    chartRecords.value.forEach(r => recordMap.set(normalizeDateForComparison(r.trade_date), r))
    chartRecords.value = Array.from(recordMap.values()).sort((a, b) => b.trade_date.localeCompare(a.trade_date))
    
    const mfMap = new Map()
    newMoneyFlow.forEach(r => mfMap.set(normalizeDateForComparison(r.trade_date), r))
    moneyFlowRecords.value.forEach(r => mfMap.set(normalizeDateForComparison(r.trade_date), r))
    moneyFlowRecords.value = Array.from(mfMap.values()).sort((a, b) => b.trade_date.localeCompare(a.trade_date))
  } catch (error) {
    console.error('[App] handleLoadMore failed:', error)
  }
}

// 新增：返回来源标签页功能（支持策略股池及其他来源）
function goBackToStrategyPool(context) {
  // 检查是否有保存的来源信息
  if (window.currentSourceInfo) {
    const sourceInfo = window.currentSourceInfo;
    
    // 切换到来源标签页
    activeTab.value = sourceInfo.tab;
    
    // 如果来源是策略股池且有策略信息，触发恢复事件
    if (sourceInfo.tab === 'strategy-pool' && sourceInfo.strategy) {
      // 使用 nextTick 确保组件已渲染后再触发事件
      nextTick(() => {
        // 创建一个自定义事件来传递策略、预设信息
        const event = new CustomEvent('restore-strategy-context', {
          detail: {
            strategy: sourceInfo.strategy,
            preset: sourceInfo.preset,
            date: context?.date  // Date may be undefined, StrategyStockPool will handle appropriately
          }
        });
        window.dispatchEvent(event);
      });
    }
  } else {
    // 如果没有来源信息，尝试根据 context 判断是否回到策略股池
    if (context && context.strategy) {
      activeTab.value = 'strategy-pool';
      
      // 使用 nextTick 确保组件已渲染后再触发事件
      nextTick(() => {
        // 创建一个自定义事件来传递策略、预设和日期信息
        const event = new CustomEvent('restore-strategy-context', {
          detail: {
            strategy: context.strategy,
            preset: context.preset,
            date: context.date  // Date may be undefined, StrategyStockPool will handle appropriately
          }
        });
        window.dispatchEvent(event);
      });
    }
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

// 扩展 selectStockForChart 方法以支持从不同来源跳转并能返回
async function selectStockForChart(stockData) {
  let stockSymbol = ''
  let signalDate = null
  let strategy = ''
  let preset = ''
  let sourceTab = activeTab.value  // 记录当前标签页作为来源
  
  if (typeof stockData === 'string') {
    stockSymbol = stockData
  } else if (stockData && stockData.symbol) {
    stockSymbol = stockData.symbol
    signalDate = stockData.signalDate
    strategy = stockData.strategy || ''
    preset = stockData.preset || ''
  }

  if (!stockSymbol) return

  // 保存策略信息，用于后续获取交易历史
  currentStrategy.value = strategy
  currentPreset.value = preset
  
  // 保存来源标签页，用于返回
  const sourceInfo = {
    tab: sourceTab,
    strategy: strategy,
    preset: preset
  }

  // 设置信号日期，以便后续 loadStockData 使用正确的日期范围
  if (signalDate) {
    signalDates.value = [signalDate]
  } else {
    signalDates.value = []
  }

  // 找到该股票在 watchlist 中的索引
  const index = watchlist.value.indexOf(stockSymbol)
  if (index !== -1) {
    // 如果已经在列表中，且是当前股票，watcher可能不触发，手动调一下
    if (currentIndex.value === index) {
      loadStockData(stockSymbol)
    } else {
      currentIndex.value = index
    }
  } else {
    // 如果不在自选股中，添加到列表
    watchlist.value.push(stockSymbol)
    currentIndex.value = watchlist.value.length - 1
  }
  
  // From strategy pool: reuse backtest result UI instead of K-line.
  if (sourceTab === 'strategy-pool') {
    activeTab.value = 'backtest'
    await nextTick()
    const event = new CustomEvent('open-backtest-from-strategy-pool', {
      detail: {
        symbol: stockSymbol,
        signalDate,
        strategy,
        preset,
      }
    })
    window.dispatchEvent(event)
    return
  }
  
  activeTab.value = 'chart'
  
  // 保存来源信息到全局变量，供goBackToSource使用
  window.currentSourceInfo = sourceInfo
}

async function handleLoginSuccess(authData) {
  console.log('登录成功:', authData.user.username)
  let ids = null
  try {
    const res = await axios.get('/api/user/navigation-tabs', {
      headers: { Authorization: `Bearer ${authData.access_token}` },
    })
    if (res.data?.success && Array.isArray(res.data.data?.visible_tab_ids)) {
      ids = res.data.data.visible_tab_ids
    }
  } catch (e) {
    console.error('加载主导航策略失败:', e)
  }
  authService.setAuth(authData)
  // Immediately refresh full profile so user_info contains service_level and other server-side fields.
  await validateToken()
  // New session should not inherit stale source context from previous user.
  window.currentSourceInfo = null
  serverVisibleTabIds.value = ids
  navPolicyResolved.value = true
  if (ids && authData.user?.username) {
    writeNavCache(ids, authData.user.username)
  }

  // 根据服务端确认后的用户角色设置默认标签页，避免登录响应中的旧角色值污染
  if (user.value?.is_admin) {
    activeTab.value = 'admin'
    console.log('管理员登录，跳转到系统管理页面')
  } else if (Array.isArray(ids) && ids.length) {
    activeTab.value = ids[0]
  } else {
    activeTab.value = 'watchlist'
  }
}

function handleLogout() {
  clearNavCache()
  clearActiveTabCache()
  serverVisibleTabIds.value = null
  navPolicyResolved.value = false
  window.currentSourceInfo = null
  logout()
  console.log('用户已登出')
}

function handleResetDone() {
  // 密码重置完成，返回登录界面
  isResetPasswordMode.value = false
  resetToken.value = ''
  // 清除URL中的token参数
  window.history.replaceState({}, document.title, window.location.pathname)
}

onMounted(async () => {
  // 检查是否是密码重置URL
  const urlParams = new URLSearchParams(window.location.search)
  const resetTokenParam = urlParams.get('token')
  if (resetTokenParam && window.location.pathname === '/reset-password') {
    isResetPasswordMode.value = true
    resetToken.value = resetTokenParam
    return // 不需要验证token，直接显示重置密码页面
  }

  // 必须验证 token 获取正确的用户信息，不能依赖 localStorage 中的缓存
  if (!localStorage.getItem('access_token')) return

  const fetchWatchlist = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const res = await axios.get('/api/user/watchlist-stocks', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.data && res.data.success && Array.isArray(res.data.data)) {
        watchlist.value = res.data.data.map(stock => stock.symbol)
      } else {
        watchlist.value = ['000001', '000002', '000003']
      }
    } catch (e) {
      console.error('获取自选股失败:', e)
      watchlist.value = ['000001', '000002', '000003']
    }
  }

  // 必须先验证 token，获取正确的用户信息
  const tokenValid = await validateToken()
  if (!tokenValid) {
    console.log('Token已失效,请重新登录')
    return
  }
  await loadNavigationTabs()
  // 现在 user.value 包含正确的服务器数据
  await fetchWatchlist()

  // 根据用户角色设置默认界面
  const savedTab = readActiveTabCache()
  console.log('尝试恢复tab:', savedTab, '用户:', user.value?.username, '是否管理员:', user.value?.is_admin)

  if (savedTab && adminTabs.value.some(tab => tab.id === savedTab)) {
    // 检查管理员tab的访问权限
    if (savedTab === 'admin' && !user.value?.is_admin) {
      const tabs = adminTabs.value
      activeTab.value = tabs.length ? tabs[0].id : 'watchlist'
      console.log('非管理员用户尝试访问管理后台，跳转到允许的首个 Tab')
    } else {
      activeTab.value = savedTab
      console.log('恢复上次浏览的页面:', savedTab)
    }
  } else if (user.value?.is_admin) {
    activeTab.value = 'admin'
    console.log('管理员自动跳转到系统管理页面')
  } else {
    const tabs = adminTabs.value
    activeTab.value = tabs.length ? tabs[0].id : 'watchlist'
  }
})

// 角色降级保护：一旦当前用户不是管理员，不允许停留在 admin 标签页
watch(
  () => user.value?.is_admin,
  (isAdmin) => {
    if (isAdmin || activeTab.value !== 'admin') {
      return
    }

    const tabs = adminTabs.value
    activeTab.value = tabs.length ? tabs[0].id : 'watchlist'
    console.log('检测到非管理员用户处于管理后台，已自动纠正到普通标签页')
  }
)

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
  display: flex;
  align-items: center;
  gap: 16px;
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

.nav-policy-loading {
  padding: 16px 20px;
  margin-bottom: 24px;
  color: #b19cd9;
  font-size: 15px;
  text-align: center;
  background: rgba(30, 30, 63, 0.45);
  border-radius: 8px;
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

/* Simple skeleton loaders for async components */
.skeleton {
  border: 1px dashed rgba(138, 43, 226, 0.4);
  background: rgba(30, 30, 63, 0.25);
  color: #b19cd9;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.skeleton-card { height: 140px; }
.skeleton-table { height: 220px; }
.skeleton-chart { height: 300px; }

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