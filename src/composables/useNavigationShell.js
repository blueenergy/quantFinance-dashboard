import { computed, ref, watch } from 'vue'
import axios from 'axios'

const NAV_CACHE_IDS_KEY = 'nav_visible_tab_ids_v3'
const NAV_CACHE_USER_KEY = 'nav_visible_tab_username_v2'
const ACTIVE_TAB_KEY = 'activeTab_v2'
const ACTIVE_TAB_USER_KEY = 'activeTab_username_v2'

const LEGACY_NAV_CACHE_KEYS = [
  'nav_visible_tab_ids_v1',
  'nav_visible_tab_ids_v2',
]

const LEGACY_NAV_CACHE_USER_KEYS = [
  'nav_visible_tab_username_v1',
]

function readNavCacheRaw() {
  try {
    const username = sessionStorage.getItem(NAV_CACHE_USER_KEY)
    const raw = sessionStorage.getItem(NAV_CACHE_IDS_KEY)
    if (!username || !raw) return null
    const userJson = localStorage.getItem('user_info')
    if (!userJson) return null
    const current = JSON.parse(userJson).username
    if (current !== username) return null
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
    LEGACY_NAV_CACHE_USER_KEYS.forEach((key) => sessionStorage.removeItem(key))
    LEGACY_NAV_CACHE_KEYS.forEach((key) => sessionStorage.removeItem(key))
  } catch {
    /* ignore */
  }
}

function readActiveTabCache() {
  try {
    const username = localStorage.getItem(ACTIVE_TAB_USER_KEY)
    const tab = localStorage.getItem(ACTIVE_TAB_KEY)
    const userJson = localStorage.getItem('user_info')
    if (!username || !tab || !userJson) return null
    const current = JSON.parse(userJson).username
    if (!current || current !== username) return null
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

export function useNavigationShell({ user, isAuthenticated }) {
  const activeTab = ref(readActiveTabCache() ?? '')
  const mountedTabs = ref(new Set())
  const cachedNavIds = readNavCacheRaw()
  const serverVisibleTabIds = ref(cachedNavIds)
  const navPolicyResolved = ref(!!cachedNavIds)

  const tabsShellReady = computed(() => {
    if (user.value?.is_admin) return true
    return navPolicyResolved.value
  })

  const adminTabs = computed(() => {
    const baseTabs = [
      { id: 'global-market-brief', name: '🌍 全球市场简报' },
      { id: 'data-pulse', name: '🛰️ 数据脉搏' },
      { id: 'market-analysis', name: '🤖 AI大盘分析' },
      { id: 'limit-up-ladder', name: '📊 连板天梯' },
      { id: 'market-risk', name: '🚨 风险预警' },
      { id: 'china-macro', name: '🇨🇳 中国宏观' },
      { id: 'us-rates', name: '🇺🇸 美国利率' },
      { id: 'x-influencer-voices', name: '🐦 X大V情报' },
      { id: 'theme-lag-recommend', name: '📌 主题补涨' },
      { id: 'sector-concept', name: '📈 概念板块' },
      { id: 'hot-stock', name: '🔥 热股分析' },
      { id: 'etf', name: '💰 ETF淘金' },
      { id: 'earnings-hunter', name: '🎯 财报猎手' },
      { id: 'shenwan-index', name: '📊 申万行业研究' },
      { id: 'history', name: '🔍 个股深度分析' },
      { id: 'strategy-pool', name: '🎯 策略股池' },
      { id: 'ranking', name: '金榜' },
      { id: 'watchlist', name: '自选股' },
      { id: 'backtest', name: '📊 回测管理' },
      { id: 'strategies', name: '策略配置' },
      { id: 'strategy-workers', name: '🚀 实盘交易' },
      { id: 'trade-executions', name: '交易记录' },
      { id: 'trading-manual', name: '人工干预' },
      { id: 'strategy-execution-analysis', name: '策略执行分析' },
      { id: 'spectrum', name: '阴阳谱' },
      { id: 'securities', name: '账户工作台' },
      { id: 'user-profile', name: '用户配置' },
      { id: 'chat', name: '🤖 AI助手' },
    ]

    if (user.value?.is_admin) {
      const filteredTabs = baseTabs.map((tab) => ({ ...tab }))
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

    const tabById = Object.fromEntries(baseTabs.map((tab) => [tab.id, tab]))
    const filteredTabs = []
    for (const id of ids) {
      const row = tabById[id]
      if (row) filteredTabs.push({ ...row })
    }
    return filteredTabs
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
        const username = user.value?.username
        if (username) writeNavCache(serverVisibleTabIds.value, username)
      } else {
        serverVisibleTabIds.value = null
      }
    } catch (error) {
      console.error('加载主导航策略失败:', error)
      if (!readNavCacheRaw()) {
        serverVisibleTabIds.value = null
      }
    } finally {
      navPolicyResolved.value = true
    }
  }

  function switchTab(tabId) {
    if (activeTab.value === tabId) {
      activeTab.value = ''
      return
    }
    if (tabId) mountedTabs.value.add(tabId)
    activeTab.value = tabId
  }

  function applyResolvedNavigationTabs(ids, username) {
    serverVisibleTabIds.value = ids
    navPolicyResolved.value = true
    if (ids && username) {
      writeNavCache(ids, username)
    }
  }

  function resetNavigationShell() {
    clearNavCache()
    serverVisibleTabIds.value = null
    navPolicyResolved.value = false
    mountedTabs.value = new Set()
    activeTab.value = ''
  }

  watch(activeTab, (newTab) => {
    const username = user.value?.username
    if (username) {
      writeActiveTabCache(newTab, username)
    }
    console.log('已保存当前tab:', newTab)
  })

  watch(adminTabs, (tabs) => {
    const ids = tabs.map((tab) => tab.id)
    if (!ids.length) {
      return
    }
    if (!ids.includes(activeTab.value)) {
      activeTab.value = ''
    }
  }, { deep: true })

  return {
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
    readSavedActiveTab: readActiveTabCache,
  }
}