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
        <span v-if="useRealtimeData" class="realtime-badge">🔴 实时数据</span>
        <span v-else class="history-badge">📊 历史数据</span>
      </div>
      
      <!-- 迁移提示 -->
      <div class="migration-tip" v-if="migrationComplete">
        <span class="success-tip">🎉 本地自选股已成功迁移到服务器！</span>
      </div>
      
      <div class="add-stock">
        <div class="stock-input-wrapper">
          <v-text-field 
            id="watchlist-stock-input"
            v-model="inputSymbol" 
            label="股票代码/名称/拼音"
            placeholder="如: 000001, 平安银行, PAYH"
            variant="outlined"
            density="compact"
            hide-details
            bg-color="rgba(30, 30, 63, 0.7)"
            color="white"
            base-color="rgba(230, 230, 250, 0.8)"
            class="custom-stock-input"
            theme="dark"
            :loading="isSearchingStock"
            @update:model-value="handleStockInput"
            @focus="showStockMenu = !!stockSearchResults.length"
            @keyup.enter="addStock"
          />
          <v-menu
            v-model="showStockMenu"
            activator="#watchlist-stock-input"
            :close-on-content-click="false"
            location="bottom start"
            :open-on-click="false"
            :open-on-focus="false"
            :offset="5"
            content-class="stock-search-menu"
          >
            <v-list v-if="stockSearchResults.length" density="compact" max-height="300" theme="dark" class="stock-search-list">
              <v-list-item
                v-for="item in stockSearchResults"
                :key="item.value"
                :title="item.title"
                :subtitle="item.value"
                @click="selectStock(item)"
                class="stock-search-item"
              >
                <template #prepend>
                  <v-chip size="x-small" label class="mr-2" color="primary">{{ item.value.split('.')[1] || 'Unknown' }}</v-chip>
                </template>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>
        <button @click="addStock" :disabled="loading" class="add-stock-btn">添加</button>
        <button @click="refreshAll" :disabled="loading" class="refresh-btn">
          {{ loading ? '刷新中...' : '🔄 刷新全部' }}
        </button>
        <button @click="toggleDataSource" :disabled="loading" class="toggle-source-btn" v-if="isAuthenticated">
          {{ useRealtimeData ? '📊 切换到历史数据' : '🔴 切换到实时数据' }}
        </button>
        <button @click="addSampleStock" class="sample-btn">
          📊 添加示例(000001)
        </button>
        <div class="analysis-mode-toggle" v-if="isAuthenticated">
          <span class="analysis-mode-label">深度分析模式</span>
          <button
            type="button"
            class="mode-btn"
            :class="{ active: deepAnalysisMode === 'classic' }"
            @click="setDeepAnalysisMode('classic')"
          >
            经典
          </button>
          <button
            type="button"
            class="mode-btn"
            :class="{ active: deepAnalysisMode === 'multi_expert_v1' }"
            @click="setDeepAnalysisMode('multi_expert_v1')"
          >
            多专家
          </button>
          <span class="analysis-mode-hint">
            {{ deepAnalysisMode === 'multi_expert_v1' ? '覆盖更全，但通常更慢' : '速度更快，沿用现有单分析师链路' }}
          </span>
        </div>
      </div>
    </div>

    <!-- 自选股数据表格 -->
    <div class="watchlist-table">
      <div v-if="watchList.length === 0" class="empty-watchlist">
        <p>暂无自选股，请添加股票代码</p>
      </div>
      
      <div v-else>
        <div class="watchlist-summary-panel">
          <div class="watchlist-summary">
            <span>共 {{ watchlistSummary.total }} 个</span>
            <span>股票 {{ watchlistSummary.stock }}</span>
            <span>ETF {{ watchlistSummary.etf }}</span>
            <span class="positive">上涨 {{ watchlistSummary.up }}</span>
            <span class="negative">下跌 {{ watchlistSummary.down }}</span>
            <span v-if="watchlistSummary.noData">暂无数据 {{ watchlistSummary.noData }}</span>
          </div>
          <div class="watchlist-filter-bar">
            <button
              v-for="option in watchlistFilterOptions"
              :key="option.value"
              type="button"
              class="filter-chip"
              :class="{ active: watchlistFilter === option.value }"
              @click="setWatchlistFilter(option.value)"
            >
              {{ option.label }} <span class="filter-count">{{ option.count }}</span>
            </button>
          </div>
          <div class="watchlist-display-meta">
            <span>
              当前显示 {{ visibleWatchlistCount }} / {{ filteredWatchlistCount }} 个
              <template v-if="watchlistCollapsed && hiddenWatchlistCount > 0">
                ，已折叠 {{ hiddenWatchlistCount }} 个
              </template>
            </span>
            <button
              v-if="filteredWatchlistCount > WATCHLIST_COLLAPSED_LIMIT"
              type="button"
              class="toggle-collapse-btn"
              @click="toggleWatchlistCollapsed"
            >
              {{ watchlistCollapsed ? '展开全部' : '收起列表' }}
            </button>
          </div>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>股票代码</th>
              <th>股票名称</th>
              <th>最新价格</th>
              <th>开盘</th>
              <th>最高</th>
              <th>最低</th>
              <th>涨跌额</th>
              <th>涨跌幅</th>
              <th>成交量</th>
              <th v-if="useRealtimeData">更新时间</th>
              <th style="min-width: 280px;">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="stock in visibleStocksData" :key="stock.symbol">
              <td>
                <span class="stock-symbol" @click="selectChart(stock.symbol)">
                  {{ stock.symbol }}
                </span>
              </td>
              <td class="stock-name">{{ stock.name || stock.symbol }}</td>
              <td class="price">{{ formatPrice(stock.price || stock.close) }}</td>
              <td class="price">{{ formatPrice(stock.open) }}</td>
              <td class="price">{{ formatPrice(stock.high) }}</td>
              <td class="price">{{ formatPrice(stock.low) }}</td>
              <td :class="getPriceChangeClass(stock.change)">
                {{ formatChange(stock.change) }}
              </td>
              <td :class="getPriceChangeClass(stock.change_percent || stock.change_pct)">
                {{ formatPercent(stock.change_percent || stock.change_pct) }}
              </td>
              <td>{{ formatVolume(stock.volume) }}</td>
              <td v-if="useRealtimeData" class="update-time">{{ formatUpdateTime(stock.update_time) }}</td>
              <td style="white-space: nowrap;">
                  <div class="action-btn-group" style="white-space: nowrap;">
                    <button @click="selectChart(stock.symbol)" class="chart-btn">📈 K线</button>
                    <button @click="deepAnalyzeStock(stock)" class="deep-analyze-btn" :disabled="deepAnalyzingStock === stock.symbol" style="display: inline-block !important; visibility: visible !important; flex-shrink: 0;">
                      {{ deepAnalyzingStock === stock.symbol ? '提交中...' : getDeepAnalysisButtonText(stock) }}
                    </button>
                    <button @click="openHistoryModal(stock)" class="history-btn">
                      {{ isEtfAsset(stock) ? '🕑 分析结果' : '🕑 历史分析' }}
                    </button>
                    <button @click="removeStock(stock.symbol)" class="remove-btn">移除</button>
                  </div>
              </td>
            </tr>
            
            <!-- 显示还没有数据的股票 -->
            <tr v-for="symbol in visibleStocksWithoutData" :key="symbol" class="no-data-row">
              <td>
                <span class="stock-symbol" @click="selectChart(symbol)">
                  {{ symbol }}
                </span>
              </td>
              <td class="stock-name">{{ getStockName(symbol) || symbol }}</td>
              <td colspan="7" class="no-data">暂无数据</td>
              <td v-if="useRealtimeData" class="no-data"></td>
              <td>
                <button @click="selectChart(symbol)" class="chart-btn">📈 K线</button>
                <button @click="deepAnalyzeStock({ symbol })" class="deep-analyze-btn" :disabled="deepAnalyzingStock === symbol">
                  {{ deepAnalyzingStock === symbol ? '提交中...' : '🔬 深度分析' }}
                </button>
                <button @click="openHistoryModal({ symbol })" class="history-btn">🕑 历史分析</button>
                <button @click="removeStock(symbol)" class="remove-btn">移除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div
          v-if="watchlistCollapsed && hiddenWatchlistCount > 0"
          class="watchlist-more-footer"
        >
          还有 {{ hiddenWatchlistCount }} 个自选标的未显示。
          <button type="button" @click="toggleWatchlistCollapsed">展开全部</button>
        </div>
      </div>
    </div>



    <!-- 历史分析弹窗 -->
    <div v-if="showHistoryModal" class="modal-overlay" @click="closeHistoryModal">
      <div class="modal-content" :class="{ 'modal-content--maximized': historyModalMaximized }" @click.stop>
        <div class="modal-header">
          <h3>🕑 {{ historySymbol }} 历史AI分析</h3>
          <button @click="toggleHistoryModalMaximized" class="fullscreen-btn">
            {{ historyModalMaximized ? '退出全屏' : '全屏' }}
          </button>
          <button @click="closeHistoryModal" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <!-- 调试信息 -->
          <div v-if="!analysisHistory[historySymbol] || analysisHistory[historySymbol].length === 0" style="padding: 20px; text-align: center; color: #666;">
            <p>此股票还没有AI分析历史记录</p>
            <p style="font-size: 12px; margin-top: 10px;">请先点击“AI分析”按钮进行分析</p>
          </div>
          <HistoryAnalysis :history="analysisHistory[historySymbol]" />
        </div>
      </div>
    </div>

    <v-snackbar v-model="snackbar" :color="snackbarColor" :timeout="snackbarTimeout" location="top" multi-line>
      {{ snackbarMessage }}
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import axios from 'axios'
import { useAuth } from '../services/auth.js'
import { watchlistService } from '../services/watchlist.js'
import { useAnalysisHistory } from '../composables/useAnalysisHistory'
// checkUserLlmConfig import removed - old AI analysis feature deprecated
import HistoryAnalysis from './HistoryAnalysis.vue'
import { searchStocks } from '../api/stock'

const emit = defineEmits(['select-chart', 'open-etf-analysis'])
const { isAuthenticated, currentUser } = useAuth()
const { analysisHistory, loadHistory } = useAnalysisHistory()

const inputSymbol = ref('')
const watchList = ref([])
const stocksData = ref([])
const loading = ref(false)
const deepAnalyzingStock = ref('')
const snackbar = ref(false)
const snackbarMessage = ref('')
const snackbarColor = ref('success')
const snackbarTimeout = ref(5000)
const migrationComplete = ref(false)
const showHistoryModal = ref(false)
const historySymbol = ref('')
const useRealtimeData = ref(true)  // 默认使用实时数据
const historyModalMaximized = ref(false)

const DEEP_ANALYSIS_MODE_STORAGE_KEY = 'deep_analysis_mode'
const WATCHLIST_COLLAPSED_STORAGE_KEY = 'watchlist_collapsed'
const WATCHLIST_FILTER_STORAGE_KEY = 'watchlist_filter'
const WATCHLIST_COLLAPSED_LIMIT = 10

function readDeepAnalysisMode() {
  const mode = localStorage.getItem(DEEP_ANALYSIS_MODE_STORAGE_KEY)
  return mode === 'multi_expert_v1' ? mode : 'classic'
}

const deepAnalysisMode = ref(readDeepAnalysisMode())
const watchlistCollapsed = ref(localStorage.getItem(WATCHLIST_COLLAPSED_STORAGE_KEY) !== 'false')
const watchlistFilter = ref(localStorage.getItem(WATCHLIST_FILTER_STORAGE_KEY) || 'all')

function setDeepAnalysisMode(mode) {
  deepAnalysisMode.value = mode === 'multi_expert_v1' ? 'multi_expert_v1' : 'classic'
}

function formatAnalysisModeLabel(mode) {
  if (mode === 'etf') return 'ETF'
  return mode === 'multi_expert_v1' ? '多专家' : '经典'
}

function normalizeAssetType(stock) {
  return String(stock?.asset_type || stock?.security_type || '').toLowerCase()
}

function isEtfAsset(stock) {
  return normalizeAssetType(stock) === 'etf'
}

function getDeepAnalysisButtonText(stock) {
  return isEtfAsset(stock) ? '🔬 ETF分析' : '🔬 深度分析'
}

function getStockIndustryGroup(stock) {
  if (isEtfAsset(stock)) return 'ETF'
  const swName = stock?.sw_industry?.l1_name
  if (swName) return swName
  return stock?.industry || '未分类'
}

function getStockPctChange(stock) {
  const raw = stock?.change_percent ?? stock?.change_pct
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function setWatchlistFilter(value) {
  watchlistFilter.value = value || 'all'
}

function toggleWatchlistCollapsed() {
  watchlistCollapsed.value = !watchlistCollapsed.value
}

function matchesWatchlistFilter(stock) {
  const filter = watchlistFilter.value
  if (filter === 'all') return true
  if (filter === 'etf') return isEtfAsset(stock)
  if (filter === 'up') return getStockPctChange(stock) > 0
  if (filter === 'down') return getStockPctChange(stock) < 0
  if (filter === 'no_data') return false
  if (filter.startsWith('industry:')) {
    return getStockIndustryGroup(stock) === filter.slice('industry:'.length)
  }
  return true
}

// 股票搜索相关
const stockSearchResults = ref([])
const isSearchingStock = ref(false)
const showStockMenu = ref(false)
let searchTimeout = null

// 处理股票代码输入（防抖搜索）
function handleStockInput(val) {
  if (!val) {
    stockSearchResults.value = []
    showStockMenu.value = false
    return
  }
  
  // 移除自动补全后缀逻辑，避免无法修改代码的问题
  // 用户反馈：从右往左删的时候，自动补回去很难受

  // 必须输入2位以上才搜索
  if (val.length < 2) {
    stockSearchResults.value = []
    showStockMenu.value = false
    return
  }

  isSearchingStock.value = true
  
  if (searchTimeout) clearTimeout(searchTimeout)
  
  searchTimeout = setTimeout(async () => {
    try {
      // 调用搜索API
      const results = await searchStocks(val)
      
      // 转换结果格式以适应 v-list
      stockSearchResults.value = results.map(item => ({
        title: `${item.symbol} ${item.name}`,
        value: item.symbol,
        pinyin: item.pinyin
      }))
      
      // 如果有结果，显示菜单
      showStockMenu.value = !!stockSearchResults.value.length
    } catch (e) {
      console.error('搜索股票失败:', e)
      stockSearchResults.value = []
    } finally {
      isSearchingStock.value = false
    }
  }, 300)
}

function selectStock(item) {
  inputSymbol.value = item.value
  showStockMenu.value = false
  stockSearchResults.value = [] // 选中后清空搜索结果
  // 也可以选择自动添加
  // addStock()
}


// 计算没有数据的股票
const stocksWithoutData = computed(() => {
  const dataSymbols = stocksData.value.map(stock => stock.symbol)
  return watchList.value.filter(symbol => !dataSymbols.includes(symbol))
})

const watchlistSummary = computed(() => {
  const up = stocksData.value.filter(stock => getStockPctChange(stock) > 0).length
  const down = stocksData.value.filter(stock => getStockPctChange(stock) < 0).length
  const etf = stocksData.value.filter(stock => isEtfAsset(stock)).length
  return {
    total: watchList.value.length,
    stock: stocksData.value.filter(stock => normalizeAssetType(stock) === 'stock').length,
    etf,
    up,
    down,
    noData: stocksWithoutData.value.length,
  }
})

const watchlistFilterOptions = computed(() => {
  const options = [
    { value: 'all', label: '全部', count: watchList.value.length },
    { value: 'etf', label: 'ETF', count: watchlistSummary.value.etf },
    { value: 'up', label: '上涨', count: watchlistSummary.value.up },
    { value: 'down', label: '下跌', count: watchlistSummary.value.down },
  ]
  if (watchlistSummary.value.noData > 0) {
    options.push({ value: 'no_data', label: '暂无数据', count: watchlistSummary.value.noData })
  }

  const industryCounts = new Map()
  for (const stock of stocksData.value) {
    if (isEtfAsset(stock)) continue
    const group = getStockIndustryGroup(stock)
    industryCounts.set(group, (industryCounts.get(group) || 0) + 1)
  }
  for (const [group, count] of Array.from(industryCounts.entries()).sort((a, b) => b[1] - a[1])) {
    options.push({ value: `industry:${group}`, label: group, count })
  }
  return options
})

const filteredStocksData = computed(() => stocksData.value.filter(matchesWatchlistFilter))

const filteredStocksWithoutData = computed(() => (
  watchlistFilter.value === 'all' || watchlistFilter.value === 'no_data'
    ? stocksWithoutData.value
    : []
))

const filteredWatchlistCount = computed(() => (
  filteredStocksData.value.length + filteredStocksWithoutData.value.length
))

const visibleStocksData = computed(() => {
  if (!watchlistCollapsed.value) return filteredStocksData.value
  return filteredStocksData.value.slice(0, WATCHLIST_COLLAPSED_LIMIT)
})

const visibleStocksWithoutData = computed(() => {
  if (!watchlistCollapsed.value) return filteredStocksWithoutData.value
  const remaining = Math.max(WATCHLIST_COLLAPSED_LIMIT - visibleStocksData.value.length, 0)
  return filteredStocksWithoutData.value.slice(0, remaining)
})

const visibleWatchlistCount = computed(() => (
  visibleStocksData.value.length + visibleStocksWithoutData.value.length
))

const hiddenWatchlistCount = computed(() => (
  Math.max(filteredWatchlistCount.value - visibleWatchlistCount.value, 0)
))

// 勿使用 immediate: true，否则与下方 onMounted 重复触发 handleUserLogin（双份请求）；
// 且默认 Tab 为自选股时，未进该页也会因误挂载而拉数（见 App.vue activeTab 初始化）
watch(isAuthenticated, async (newValue, oldValue) => {
  if (newValue && !oldValue) {
    await handleUserLogin()
  } else if (!newValue && oldValue) {
    await handleUserLogout()
  }
})

watch(deepAnalysisMode, (mode) => {
  localStorage.setItem(DEEP_ANALYSIS_MODE_STORAGE_KEY, mode)
})

watch(watchlistCollapsed, (collapsed) => {
  localStorage.setItem(WATCHLIST_COLLAPSED_STORAGE_KEY, collapsed ? 'true' : 'false')
})

watch(watchlistFilter, (filter) => {
  localStorage.setItem(WATCHLIST_FILTER_STORAGE_KEY, filter)
})

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
    console.log('🔍 loadUserWatchlist开始执行，认证状态:', isAuthenticated?.value)
    
    if (!isAuthenticated?.value) {
      console.log('❌ 用户未认证，加载本地自选股')
      loadLocalWatchlist()
      return
    }
    
    console.log('✅ 用户已认证，开始获取服务器端自选股')
    const symbols = await watchlistService.getUserWatchlist()
    console.log('📊 获取到的symbols:', symbols, '数量:', symbols?.length)
    
    watchList.value = symbols
    console.log('💾 已设置watchList.value:', watchList.value)
    
    if (symbols.length > 0) {
      console.log('🔄 symbols数量>0，开始refreshAll')
      await refreshAll()
    } else {
      console.log('⚠️ symbols数组为空，跳过refreshAll')
    }
  } catch (error) {
    console.error('❌ 加载用户自选股失败:', error)
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
  let symbol = inputSymbol.value.trim().toUpperCase()
  if (!symbol) return
  
  // 校验逻辑：防止输入拼音或无效代码被提交
  // 1. 如果是6位数字，自动补全后缀
  if (/^\d{6}$/.test(symbol)) {
    if (symbol.startsWith('6') || symbol.startsWith('9')) {
      symbol += '.SH'
    } else if (symbol.startsWith('0') || symbol.startsWith('2') || symbol.startsWith('3')) {
      symbol += '.SZ'
    } else if (symbol.startsWith('4') || symbol.startsWith('8')) {
      symbol += '.BJ'
    }
  }
  
  // 2. 校验是否符合股票代码格式 (6位数字.后缀)
  if (!/^\d{6}\.(SZ|SH|BJ)$/.test(symbol)) {
    // 如果不符合格式，尝试在搜索结果中查找匹配项
    const match = stockSearchResults.value.find(item => item.value === symbol || item.pinyin === symbol)
    if (match) {
      symbol = match.value
    } else {
      // 没有任何匹配，认为是无效输入
      alert('请输入有效的股票代码（如 000001 或 000001.SZ）')
      return
    }
  }
  
  if (watchList.value.includes(symbol)) {
    alert('股票已在自选列表中')
    inputSymbol.value = '' 
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
    showStockMenu.value = false
    stockSearchResults.value = []
    
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
      
      // Check if the stock has any active strategies
      const authHeaders = watchlistService.getAuthHeaders()
      try {
        const stratCheckResponse = await axios.get('/api/user/watchlist/strategies', {
          headers: authHeaders
        })
        
        if (stratCheckResponse.data.success) {
          const activeStrategies = stratCheckResponse.data.data
            .filter(s => s.symbol === symbol && s.enabled === true)
          
          if (activeStrategies.length > 0) {
            const strategyNames = activeStrategies.map(s => s.strategy_key).join(', ')
            alert(`❌ 无法删除：该股票还有 ${activeStrategies.length} 个策略处于激活状态 (${strategyNames})\n\n请先在“策略配置”页面停用相关策略，然后再删除股票。`)
            return
          }
        }
      } catch (err) {
        console.warn('检查策略状态失败，继续删除操作:', err)
      }
      
      // 检查watchlistService的认证头
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

// 获取股票名称
function getStockName(symbol) {
  const stockData = stocksData.value.find((stock) => stock.symbol === symbol)
  return stockData?.name || symbol
}

/** 用于提示：有名称时「名称（代码）」，否则仅代码 */
function formatStockLabel(symbol) {
  const name = getStockName(symbol)
  if (name && name !== symbol) {
    return `${name}（${symbol}）`
  }
  return symbol
}

const activeDeepTaskPolls = new Map()

function showAppSnackbar(message, color = 'success', timeout = 5000) {
  snackbarMessage.value = message
  snackbarColor.value = color
  snackbarTimeout.value = timeout
  snackbar.value = true
}

/**
 * 轮询任务直到完成/失败/超时，完成后用 Snackbar 提醒（带股票名与代码）。
 */
function startDeepAnalysisTaskPoll(taskId, symbol, assetType = 'stock') {
  if (activeDeepTaskPolls.has(taskId)) {
    clearInterval(activeDeepTaskPolls.get(taskId))
  }
  const label = formatStockLabel(symbol)
  const maxAttempts = 200
  let attempts = 0

  const run = async () => {
    attempts += 1
    if (attempts > maxAttempts) {
      const i = activeDeepTaskPolls.get(taskId)
      if (i) clearInterval(i)
      activeDeepTaskPolls.delete(taskId)
      showAppSnackbar(`「${label}」分析等待超时，请稍后在「历史分析」中查看。`, 'warning', 6000)
      return
    }
    const token = localStorage.getItem('access_token')
    try {
      const { data } = await axios.get(`/api/analyze/task/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const st = (data.status || '').toLowerCase()
      if (st === 'pending' || st === 'processing') {
        if (attempts === 1 || attempts % 4 === 0) {
          const queueText = st === 'pending'
            ? `前方 ${data.queue_ahead ?? '?'} 个任务，${data.wait_hint || '预计等待时间计算中'}`
            : (data.wait_hint || '正在分析，LLM 响应时间可能有波动')
          showAppSnackbar(`「${label}」${queueText}`, 'info', 3500)
        }
        return
      }
      const intervalId = activeDeepTaskPolls.get(taskId)
      if (intervalId) clearInterval(intervalId)
      activeDeepTaskPolls.delete(taskId)

      if (st === 'completed') {
        const ok = data.success !== false
        const modeText = data.task_type === 'etf_analysis' || assetType === 'etf'
          ? 'ETF'
          : formatAnalysisModeLabel(data.analysis_mode)
        const completionHint = modeText === 'ETF' ? '可在 ETF 智能分析中查看。' : '可在历史分析中查看。'
        if (ok) {
          showAppSnackbar(`「${label}」${modeText}深度分析已完成，${completionHint}`, 'success', 6000)
        } else {
          showAppSnackbar(`「${label}」${modeText}深度分析已结束，但结果异常，${completionHint}`, 'warning', 6000)
        }
      } else if (st === 'completed_with_parse_error') {
        const modeText = data.task_type === 'etf_analysis' || assetType === 'etf'
          ? 'ETF'
          : formatAnalysisModeLabel(data.analysis_mode)
        showAppSnackbar(`「${label}」${modeText}深度分析已完成，解析异常，请查看历史分析。`, 'warning', 6000)
      } else if (st === 'failed') {
        const err = data.error || '分析失败'
        const modeText = data.task_type === 'etf_analysis' || assetType === 'etf'
          ? 'ETF'
          : formatAnalysisModeLabel(data.analysis_mode)
        showAppSnackbar(`「${label}」${modeText}深度分析失败：${err}`, 'error', 8000)
      } else {
        showAppSnackbar(`「${label}」分析状态：${st}`, 'info', 5000)
      }
    } catch (e) {
      if (e.response?.status === 401) {
        const i = activeDeepTaskPolls.get(taskId)
        if (i) clearInterval(i)
        activeDeepTaskPolls.delete(taskId)
        return
      }
      if (e.response?.status === 404) {
        const i = activeDeepTaskPolls.get(taskId)
        if (i) clearInterval(i)
        activeDeepTaskPolls.delete(taskId)
        showAppSnackbar(`无法查询「${label}」的任务状态。`, 'error', 5000)
      }
    }
  }

  const intervalId = setInterval(run, 3000)
  activeDeepTaskPolls.set(taskId, intervalId)
  run()
}

onUnmounted(() => {
  for (const id of activeDeepTaskPolls.values()) {
    clearInterval(id)
  }
  activeDeepTaskPolls.clear()
})

// 深度分析股票
async function deepAnalyzeStock(stock) {
  const symbol = typeof stock === 'string' ? stock : stock?.symbol
  const assetType = isEtfAsset(stock) ? 'etf' : 'stock'
  if (!isAuthenticated?.value) {
    alert('请先登录后再进行深度分析')
    return
  }
  if (!symbol) {
    showAppSnackbar('提交失败: 标的代码为空', 'error', 5000)
    return
  }
  
  try {
    deepAnalyzingStock.value = symbol
    const token = localStorage.getItem('access_token')
    const analysisMode = deepAnalysisMode.value

    const requestConfig = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
    const response = assetType === 'etf'
      ? await axios.post('/api/etf/analyze', {
        symbol: symbol,
        force: true
      }, requestConfig)
      : await axios.post('/api/analyze/deep-analysis', {
        symbol: symbol,
        priority: 30,
        analysis_mode: analysisMode
      }, requestConfig)
    
    if (response.data && response.data.success) {
      const remaining = response.data.quota_remaining
      const ahead = response.data.queue_ahead
      const waitHint = response.data.wait_hint
      const label = formatStockLabel(symbol)
      const modeText = assetType === 'etf'
        ? 'ETF'
        : (analysisMode === 'multi_expert_v1' ? '多专家' : '经典')
      const quotaText = remaining === undefined ? '' : `剩余配额 ${remaining}，`
      const queueText = ahead === undefined
        ? (waitHint || '等待分析')
        : `前方 ${ahead ?? '?'} 个任务，${waitHint || '等待分析'}`
      showAppSnackbar(
        `已提交「${label}」${modeText}深度分析。${quotaText}${queueText}。`,
        'success',
        7000
      )
      const taskId = response.data.task_id
      if (taskId) {
        startDeepAnalysisTaskPoll(taskId, symbol, assetType)
      }
    } else {
      showAppSnackbar(`提交失败: ${response.data?.message || '未知错误'}`, 'error', 5000)
    }
    
  } catch (error) {
    console.error('深度分析请求失败:', error)
    const status = error.response?.status
    const detail = error.response?.data?.detail
    
    if (status === 403) {
      showAppSnackbar(`提交失败: ${detail || '配额不足或权限不够'}`, 'error', 6000)
    } else if (status === 401) {
      showAppSnackbar('登录已过期，请重新登录', 'error', 5000)
    } else {
      showAppSnackbar(`系统错误: ${detail || error.message || '请稍后重试'}`, 'error', 5000)
    }
  } finally {
    deepAnalyzingStock.value = ''
  }
}



// 打开历史分析模态框
function openHistoryModal(stock) {
  const symbol = typeof stock === 'string' ? stock : stock?.symbol
  if (!symbol || symbol === 'undefined') {
    console.warn('历史分析弹窗打开时 symbol 无效:', symbol)
    return
  }
  if (isEtfAsset(stock)) {
    emit('open-etf-analysis', {
      symbol,
      name: stock?.name || getStockName(symbol),
    })
    return
  }
  console.log('打开历史分析弹窗:', symbol)
  console.log('analysisHistory:', analysisHistory.value)
  console.log(`analysisHistory[${symbol}]:`, analysisHistory.value[symbol])
  
  historySymbol.value = symbol
  historyModalMaximized.value = false
  loadHistory(symbol)
  showHistoryModal.value = true
}

// 关闭历史分析模态框
function closeHistoryModal() {
  showHistoryModal.value = false
  historySymbol.value = ''
  historyModalMaximized.value = false
}

function toggleHistoryModalMaximized() {
  historyModalMaximized.value = !historyModalMaximized.value
}

// 获取单个股票的最新数据
async function fetchStockData(symbol) {
  try {
    const response = await axios.get(`/api/records/?symbol=${symbol}&limit=2&sort=-trade_date`)
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
        turnover: latest.turnover,
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
      // 用户已登录，根据 useRealtimeData 选择数据源
      if (useRealtimeData.value) {
        // 使用实时数据 API
        const response = await watchlistService.getUserWatchlistRealtime()
        stocksData.value = response.map(stock => ({
          symbol: stock.symbol,
          name: stock.name,
          asset_type: stock.asset_type,
          industry: stock.industry,
          sw_industry: stock.sw_industry,
          price: stock.price,           // 最新价格
          open: stock.open,             // 开盘价
          high: stock.high,             // 最高价
          low: stock.low,               // 最低价
          close: stock.price,           // 兼容性
          change: stock.change,         // 涨跌额
          change_pct: stock.change_pct, // 涨跌幅
          volume: stock.volume,         // 成交量
          update_time: stock.update_time // 更新时间
        }))
      } else {
        // 使用历史数据 API
        const response = await watchlistService.getUserWatchlistStocks()
        stocksData.value = response.map(stock => ({
          symbol: stock.symbol,
          name: stock.name,
          asset_type: stock.asset_type,
          industry: stock.industry,
          sw_industry: stock.sw_industry,
          close: stock.close,
          change: stock.change,
          change_percent: stock.change_percent,
          volume: stock.volume,
          turnover: stock.turnover,
          turnover_rate: stock.turnover_rate,
          pe: stock.pe,
          market_cap: stock.market_cap,
          circ_market_cap: stock.circ_market_cap,
          date: stock.trade_date
        }))
      }
    } else {
      // 未登录，使用传统批量API
      const symbolsStr = watchList.value.join(',')
      const response = await axios.get(`/api/watchlist-stocks?symbols=${symbolsStr}`)
      
      if (response.data && response.data.success) {
        stocksData.value = response.data.data.map(stock => ({
          symbol: stock.symbol,
          name: stock.name,
          asset_type: stock.asset_type,
          industry: stock.industry,
          sw_industry: stock.sw_industry,
          close: stock.close,
          change: stock.change,
          change_percent: stock.change_percent,
          volume: stock.volume,
          turnover: stock.turnover,
          pe: stock.pe,
          market_cap: stock.market_cap,
          circ_market_cap: stock.circ_market_cap,
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

// 切换数据源
function toggleDataSource() {
  useRealtimeData.value = !useRealtimeData.value
  refreshAll()  // 切换后立即刷新数据
}

// 格式化函数
function formatDate(dateStr) {
  if (!dateStr) return '-'
  return dateStr.substring(0, 10)
}

function formatPrice(price) {
  if (price === undefined || price === null) return '-'
  return Number(price).toFixed(2)
}

function formatChange(change) {
  if (change === undefined || change === null) return '-'
  return change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2)
}

function formatUpdateTime(timeStr) {
  if (!timeStr) return '-'
  // timeStr 格式: "2025-12-16 14:30:00"
  // 只显示时间部分
  if (typeof timeStr === 'string' && timeStr.includes(' ')) {
    return timeStr.split(' ')[1]  // 返回 "14:30:00"
  }
  return timeStr
}

function formatPE(val) {
  if (val === undefined || val === null) return '-';
  return Number(val).toFixed(2);
  }

function formatMarketCap(val) {
  if (!val) return '-';
  if (val >= 1e8) return (val / 1e8).toFixed(2) + '亿';
  if (val >= 1e4) return (val / 1e4).toFixed(2) + '万';
  return val.toLocaleString();
}

function formatPercent(val) {
  if (val === undefined || val === null) return '-';
  return Number(val).toFixed(2) + '%';
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

function formatTurnover(val) {
  if (!val) return '-';
  if (val >= 1e8) return (val / 1e8).toFixed(2) + '亿';
  if (val >= 1e4) return (val / 1e4).toFixed(2) + '万';
  return val.toLocaleString();
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

.action-btn-group {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  justify-content: flex-start;
  align-items: center;
  overflow-x: auto;
}
.action-btn-group button {
  margin-right: 0;
  margin-bottom: 4px;
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
  margin-right: 8px;
}

.realtime-badge {
  color: #ef4444;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.1));
  border: 1px solid rgba(239, 68, 68, 0.3);
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: bold;
  display: inline-block;
  margin-left: 8px;
}

.history-badge {
  color: #60a5fa;
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.1), rgba(59, 130, 246, 0.1));
  border: 1px solid rgba(96, 165, 250, 0.3);
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: bold;
  display: inline-block;
  margin-left: 8px;
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
  flex-wrap: wrap;
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

.add-stock-btn {
  background: linear-gradient(135deg, #8a2be2 0%, #9370db 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(138, 43, 226, 0.3);
}

.add-stock-btn:hover:not(:disabled) {
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

.analysis-mode-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(96, 165, 250, 0.25);
}

.analysis-mode-label {
  color: #cbd5e1;
  font-size: 13px;
  white-space: nowrap;
}

.analysis-mode-hint {
  color: #93c5fd;
  font-size: 12px;
  white-space: nowrap;
}

.mode-btn {
  min-width: 72px;
  padding: 8px 12px;
  background: rgba(51, 65, 85, 0.85);
  color: #cbd5e1;
  border: 1px solid rgba(148, 163, 184, 0.25);
  box-shadow: none;
}

.mode-btn:not(.active):hover:not(:disabled) {
  transform: none;
  background: rgba(71, 85, 105, 0.95);
  box-shadow: none;
}

.mode-btn.active {
  background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%);
  color: #eff6ff;
  border-color: rgba(125, 211, 252, 0.55);
  box-shadow: 0 4px 14px rgba(14, 165, 233, 0.25);
}

.toggle-source-btn {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: white;
  margin-left: 8px;
  box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
}

.toggle-source-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(245, 158, 11, 0.5);
}

.update-time {
  color: #9ca3af;
  font-size: 12px;
}

.empty-watchlist {
  text-align: center;
  padding: 40px;
  color: #b19cd9;
  background: #f9fafb;
  border-radius: 8px;
}

.watchlist-summary-panel {
  background: rgba(30, 30, 63, 0.75);
  border: 1px solid rgba(138, 43, 226, 0.22);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 12px;
  box-shadow: 0 4px 20px rgba(138, 43, 226, 0.15);
}

.watchlist-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: #e6e6fa;
  font-size: 13px;
  margin-bottom: 10px;
}

.watchlist-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.filter-chip {
  border: 1px solid rgba(147, 112, 219, 0.35);
  background: rgba(49, 46, 129, 0.55);
  color: #e6e6fa;
  border-radius: 999px;
  padding: 5px 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-chip:hover,
.filter-chip.active {
  background: linear-gradient(135deg, #8a2be2 0%, #9370db 100%);
  border-color: rgba(230, 230, 250, 0.6);
  transform: translateY(-1px);
}

.filter-count {
  color: #c4b5fd;
  margin-left: 3px;
}

.filter-chip.active .filter-count {
  color: #ffffff;
}

.watchlist-display-meta,
.watchlist-more-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #c4b5fd;
  font-size: 13px;
}

.toggle-collapse-btn,
.watchlist-more-footer button {
  border: 1px solid rgba(96, 165, 250, 0.4);
  background: rgba(37, 99, 235, 0.25);
  color: #bfdbfe;
  border-radius: 8px;
  padding: 5px 10px;
  cursor: pointer;
}

.watchlist-more-footer {
  background: rgba(30, 30, 63, 0.65);
  border: 1px solid rgba(138, 43, 226, 0.18);
  border-radius: 0 0 12px 12px;
  padding: 10px 12px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  background: rgba(30, 30, 63, 0.8);
  border-radius: 12px;
  overflow-x: auto;
  box-shadow: 0 4px 20px rgba(138, 43, 226, 0.2);
  border: 1px solid rgba(138, 43, 226, 0.2);
}

.data-table th,
.data-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid rgba(138, 43, 226, 0.2);
  color: #e6e6fa;
  overflow: visible;
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

.modal-content--maximized {
  width: 96vw;
  max-width: none;
  height: 92vh;
  max-height: none;
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

.fullscreen-btn {
  background: linear-gradient(135deg, #0891b2 0%, #0f766e 100%);
  color: white;
  border: none;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  margin-left: auto;
  margin-right: 10px;
  transition: all 0.2s ease;
}

.fullscreen-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(8, 145, 178, 0.35);
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

@media (max-width: 768px) {
  .modal-content--maximized {
    width: 100vw;
    height: 100vh;
    border-radius: 0;
  }

  .modal-header {
    flex-wrap: wrap;
    gap: 8px;
  }
}

.history-btn {
  background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  margin-right: 5px;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.history-btn:hover {
  background: linear-gradient(135deg, #818cf8 0%, #a5b4fc 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.5);
}

.deep-analyze-btn {
  background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  margin-right: 5px;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.3);
  display: inline-block !important;
  visibility: visible !important;
  opacity: 1 !important;
  min-width: 70px;
  text-align: center;
}
.deep-analyze-btn:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.5);
}

.stock-input-wrapper {
  min-width: 300px;
}

/* Customizing v-text-field for dark glassmorphism theme */
.stock-input-wrapper :deep(.v-field__outline) {
  --v-field-border-opacity: 0.6;
}

.stock-input-wrapper {
  position: relative;
  z-index: 10;
}

.custom-stock-input :deep(input) {
  color: #ffffff !important;
  font-weight: 500;
}

.custom-stock-input :deep(.v-label) {
  color: rgba(230, 230, 250, 0.8) !important;
}

.stock-search-menu {
  background: rgba(30, 30, 63, 0.95) !important;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(138, 43, 226, 0.3);
  border-radius: 8px;
  z-index: 9999 !important; /* Ensure it floats above everything */
  margin-top: 5px;
}

.stock-search-list {
  background: transparent !important;
}

.stock-search-item {
  color: #e6e6fa !important;
}

.stock-search-item:hover {
  background: rgba(138, 43, 226, 0.2) !important;
}
</style>
