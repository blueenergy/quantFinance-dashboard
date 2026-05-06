<template>
  <v-app id="app">
    <!-- 注册后邮件内「开通」链接：/activate?token=... -->
    <AccountActivate
      v-if="isAccountActivateMode"
      :token="accountActivateToken"
    />
    <!-- 重置密码页面 -->
    <ResetPassword
      v-else-if="isResetPasswordMode"
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
          <section class="home-welcome">
            <div class="welcome-card home-welcome-card">
              <div class="home-welcome-copy">
                <p class="welcome-eyebrow">欢迎页</p>
                <h2>主控室摘要入口</h2>
                <p>
                  首页只显示轻量摘要。进入全球市场简报、数据脉搏和 AI 大盘分析时，才按需加载对应模块。
                </p>
              </div>

              <div class="home-entry-grid">
                <button
                  v-for="card in visibleHomeEntryCards"
                  :key="card.id"
                  type="button"
                  class="home-entry-card"
                  :class="{
                    active: activeTab === card.targetTabId,
                    'is-loading': card.loading,
                    'is-error': card.loadFailed,
                  }"
                  @click="switchTab(card.targetTabId)"
                >
                  <div class="home-entry-card__top">
                    <span class="home-entry-card__icon">{{ card.loading ? '⏳' : card.icon }}</span>
                    <span class="home-entry-card__badge">{{ card.loading ? '摘要加载中' : card.status }}</span>
                  </div>
                  <div class="home-entry-card__body">
                    <h3>{{ card.title }}</h3>
                    <p>{{ card.summaryLine }}</p>
                  </div>
                  <div class="home-entry-card__meta">
                    <span>{{ card.updatedAt }}</span>
                    <span>{{ card.signals.join(' · ') }}</span>
                  </div>
                  <span class="home-entry-card__action">
                    {{ card.loadFailed ? '摘要读取失败，仍可进入' : activeTab === card.targetTabId ? '当前模块' : '点击进入' }}
                  </span>
                </button>
              </div>
            </div>
          </section>
          
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
            @click="switchTab(tab.id)"
          >
            {{ tab.name }}
          </button>
        </div>

        <div v-if="user?.is_admin || adminTabs.length" class="tab-content">
          <div v-if="!activeTab" class="empty">请选择一个功能页</div>

          <!-- 每个 Tab 首次被点击时才 mount，之后仅用 v-show 切换，避免反复加载 -->
            <template v-for="tabView in renderableTabViews" :key="tabView.id">
              <template v-if="mountedTabs.has(tabView.id) && (!tabView.adminOnly || user?.is_admin)">
                <div v-show="activeTab === tabView.id" :class="tabView.wrapperClass || undefined">
                  <Suspense>
                    <template #default>
                      <component
                        :is="tabView.component"
                        v-bind="getTabProps(tabView.id)"
                        v-on="getTabListeners(tabView.id)"
                      />
                    </template>
                    <template #fallback>
                      <div :class="['skeleton', tabView.fallbackClass]">{{ tabView.fallbackText }}</div>
                    </template>
                  </Suspense>
                </div>
              </template>
            </template>
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
import AccountActivate from './components/AccountActivate.vue'
import ResetPassword from './components/ResetPassword.vue'
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { getRenderableTabViews, getTabProps as buildTabProps, getTabListeners as buildTabListeners } from './utils/tabViews.js'
import { useHomeSummaries } from './composables/useHomeSummaries.js'
import { useNavigationShell } from './composables/useNavigationShell.js'
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

// 注册邮件开通、密码重置
const isAccountActivateMode = ref(false)
const accountActivateToken = ref('')
const isResetPasswordMode = ref(false)
const resetToken = ref('')

const currentIndex = ref(0)
const watchlist = ref([]) 
const chartRecords = ref([])
const moneyFlowRecords = ref([])
const stockName = ref('')
const chartSymbol = computed(() => 
  watchlist.value.length > 0 ? watchlist.value[currentIndex.value] : ''
)
const signalDates = ref([]) // 用于在图表上标记信号日期
const currentStrategy = ref('') // 当前查看股票的策略
const currentPreset = ref('') // 当前查看股票的preset
const tradeMarkers = ref([]) // 交易标记点（买入+卖出）

const {
  activeTab,
  mountedTabs,
  serverVisibleTabIds,
  navPolicyResolved,
  tabsShellReady,
  adminTabs,
  loadNavigationTabs,
  switchTab,
  applyResolvedNavigationTabs,
  resetNavigationShell,
  readSavedActiveTab,
} = useNavigationShell({
  user,
  isAuthenticated,
})

const {
  visibleHomeEntryCards,
  refreshVisibleHomeSummaries,
  resetHomeCardSummaries,
} = useHomeSummaries({
  isAuthenticated,
  user,
  tabsShellReady,
  adminTabs,
})

const renderableTabViews = computed(() => {
  return getRenderableTabViews(adminTabs.value)
})

function getTabProps(tabId) {
  return buildTabProps(tabId, {
    chartSymbol: chartSymbol.value,
    stockName: stockName.value,
    chartRecords: chartRecords.value,
    moneyFlowRecords: moneyFlowRecords.value,
    signalDates: signalDates.value,
    tradeMarkers: tradeMarkers.value,
    prevStock,
    nextStock,
    hasPrev: hasPrev.value,
    hasNext: hasNext.value,
    watchlist: watchlist.value,
    currentIndex: currentIndex.value,
    currentStrategy: currentStrategy.value,
    currentPreset: currentPreset.value,
    user: user.value,
  })
}

function getTabListeners(tabId) {
  return buildTabListeners(tabId, {
    selectStockForChart,
    goBackToStrategyPool,
    handleLoadMore,
  })
}

/** 图表区 prev/next 与自选股 ref；仅切入「自选股 / 图表」Tab 时拉取，避免登录首屏就请求 */
let _appChartWatchlistInFlight = null
async function loadAppChartWatchlist() {
  if (!localStorage.getItem('access_token') || !isAuthenticated.value) {
    return
  }
  if (_appChartWatchlistInFlight) {
    return _appChartWatchlistInFlight
  }
  _appChartWatchlistInFlight = (async () => {
    try {
      const token = localStorage.getItem('access_token')
      const res = await axios.get('/api/user/watchlist-stocks', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data && res.data.success && Array.isArray(res.data.data)) {
        watchlist.value = res.data.data.map((stock) => stock.symbol)
      } else {
        watchlist.value = ['000001', '000002', '000003']
      }
    } catch (e) {
      console.error('获取自选股失败:', e)
      watchlist.value = ['000001', '000002', '000003']
    } finally {
      _appChartWatchlistInFlight = null
    }
  })()
  return _appChartWatchlistInFlight
}

watch(activeTab, (t) => {
  if (t === 'chart' || t === 'watchlist') {
    void loadAppChartWatchlist()
  }
})

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
    switchTab(sourceInfo.tab);
    
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
      switchTab('strategy-pool');
      
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
    switchTab('backtest')
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
  
  switchTab('chart')
  
  // 保存来源信息到全局变量，供goBackToSource使用
  window.currentSourceInfo = sourceInfo
}

async function handleLoginSuccess(authData) {
  console.log('登录成功:', authData.user.username)
  authService.setAuth(authData)
  // New session should not inherit stale source context from previous user.
  window.currentSourceInfo = null

  // 并行：刷新完整用户 profile + 拉取导航 tab 列表，减少登录后首屏延迟
  let ids = null
  const navReq = axios
    .get('/api/user/navigation-tabs', {
      headers: { Authorization: `Bearer ${authData.access_token}` },
    })
    .then((res) => {
      if (res.data?.success && Array.isArray(res.data.data?.visible_tab_ids)) {
        ids = res.data.data.visible_tab_ids
      }
    })
    .catch((e) => {
      console.error('加载主导航策略失败:', e)
    })
  await Promise.all([navReq, validateToken()])
  applyResolvedNavigationTabs(ids, authData.user?.username)

  // 登录成功后，优先恢复当前用户上次访问且仍有权限的 tab，并同步恢复内容挂载。
  const savedTab = readSavedActiveTab()
  const visibleIds = user.value?.is_admin
    ? adminTabs.value.map((tab) => tab.id)
    : (Array.isArray(ids) ? ids : [])

  if (savedTab && visibleIds.includes(savedTab)) {
    switchTab(savedTab)
    console.log('登录后恢复上次浏览的页面:', savedTab)
  } else if (user.value?.is_admin) {
    switchTab('admin')
    console.log('管理员登录，跳转到系统管理页面')
  } else {
    activeTab.value = ''
  }

  await refreshVisibleHomeSummaries()
}

function handleLogout() {
  resetNavigationShell()
  window.currentSourceInfo = null
  watchlist.value = []
  resetHomeCardSummaries()
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
  if (window.location.pathname === '/activate') {
    const t = urlParams.get('token')
    if (t) {
      isAccountActivateMode.value = true
      accountActivateToken.value = t
    } else {
      isAccountActivateMode.value = true
      accountActivateToken.value = ''
    }
    return
  }
  const resetTokenParam = urlParams.get('token')
  if (resetTokenParam && window.location.pathname === '/reset-password') {
    isResetPasswordMode.value = true
    resetToken.value = resetTokenParam
    return // 不需要验证token，直接显示重置密码页面
  }

  // 必须验证 token 获取正确的用户信息，不能依赖 localStorage 中的缓存
  if (!localStorage.getItem('access_token')) return

  // 并行发起 token 验证与导航 tab 加载，减少首屏等待时间
  const [tokenValid] = await Promise.all([
    validateToken(),
    loadNavigationTabs(),
  ])
  if (!tokenValid) {
    console.log('Token已失效,请重新登录')
    return
  }
  // 自选股列表由 watch(activeTab) 在进入「自选股 / 图表」时通过 loadAppChartWatchlist 拉取

  // 根据用户角色设置默认界面
  const savedTab = readSavedActiveTab()
  console.log('尝试恢复tab:', savedTab, '用户:', user.value?.username, '是否管理员:', user.value?.is_admin)

  if (savedTab && adminTabs.value.some(tab => tab.id === savedTab)) {
    // 检查管理员tab的访问权限
    if (savedTab === 'admin' && !user.value?.is_admin) {
      activeTab.value = ''
      console.log('非管理员用户尝试访问管理后台，已清空无权限标签页')
    } else {
      switchTab(savedTab)
      console.log('恢复上次浏览的页面:', savedTab)
    }
  } else if (user.value?.is_admin) {
    switchTab('admin')
    console.log('管理员自动跳转到系统管理页面')
  } else {
    // 普通用户未命中有效缓存 tab 时，不默认进入任何业务页，等待用户主动选择。
    activeTab.value = ''
  }

  await refreshVisibleHomeSummaries()

  // 恢复 Tab 后若正在图表/自选股，拉一次（activeTab 未变时 watch 不会触发）
  if (activeTab.value === 'chart' || activeTab.value === 'watchlist') {
    await loadAppChartWatchlist()
  }
})

// 角色降级保护：一旦当前用户不是管理员，不允许停留在 admin 标签页
watch(
  () => user.value?.is_admin,
  (isAdmin) => {
    if (isAdmin || activeTab.value !== 'admin') {
      return
    }

    mountedTabs.value.delete('admin')
    activeTab.value = ''
    console.log('检测到非管理员用户处于管理后台，已退出管理页面并等待用户重新选择标签页')
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

.home-welcome {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 32px;
}

.home-welcome-card {
  text-align: left;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(241, 245, 249, 0.96) 100%);
}

.home-welcome-copy {
  margin-bottom: 20px;
}

.welcome-eyebrow {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #2563eb;
}

.home-welcome-copy h2 {
  margin: 0 0 12px;
  color: #0f172a;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.home-welcome-copy p {
  margin: 0;
  color: #475569;
  line-height: 1.6;
  max-width: 760px;
}

.home-entry-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.home-entry-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 188px;
  padding: 18px;
  border: 1px solid #dbe3ef;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
  text-align: left;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.home-entry-card:hover {
  transform: translateY(-2px);
  border-color: #93c5fd;
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
}

.home-entry-card.active {
  border-color: #2563eb;
  box-shadow: 0 16px 32px rgba(37, 99, 235, 0.12);
}

.home-entry-card.is-loading {
  opacity: 0.88;
}

.home-entry-card.is-error {
  border-color: #f59e0b;
}

.home-entry-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.home-entry-card__icon {
  font-size: 24px;
}

.home-entry-card__badge {
  padding: 4px 10px;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 600;
}

.home-entry-card__body h3 {
  margin: 0 0 8px;
  color: #0f172a;
  font-size: 18px;
}

.home-entry-card__body p {
  margin: 0;
  color: #475569;
  line-height: 1.55;
}

.home-entry-card__meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 14px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
}

.home-entry-card__action {
  margin-top: 18px;
  color: #2563eb;
  font-size: 13px;
  font-weight: 700;
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
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  max-width: 100%;
  padding: 6px 6px 0;
  border-bottom: 2px solid rgba(138, 43, 226, 0.3);
  margin-bottom: 20px;
  background: rgba(30, 30, 63, 0.5);
  border-radius: 8px 8px 0 0;
}

.tab-button {
  flex: 0 1 auto;
  min-width: 0;
  padding: 8px 12px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #b19cd9;
  border-bottom: 2px solid transparent;
  transition: all 0.3s;
  position: relative;
  white-space: nowrap;
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

@media (max-width: 1024px) {
  .home-entry-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .home-entry-card__meta {
    gap: 4px;
  }
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