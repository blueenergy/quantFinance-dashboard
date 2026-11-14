import { computed, nextTick, ref, watch } from 'vue'
import request from '../utils/request'
import { prefetchEchartsForTab } from '../utils/echarts/loadEcharts.js'
import { NAV_TABS, RETIRED_NAV_TAB_IDS } from '../utils/navCatalog.js'

const NAV_CACHE_IDS_KEY = 'nav_visible_tab_ids_v10'
const NAV_CACHE_USER_KEY = 'nav_visible_tab_username_v2'
const ACTIVE_TAB_KEY = 'activeTab_v2'
const ACTIVE_TAB_USER_KEY = 'activeTab_username_v2'

const LEGACY_NAV_CACHE_KEYS = [
  'nav_visible_tab_ids_v1',
  'nav_visible_tab_ids_v2',
  'nav_visible_tab_ids_v3',
  'nav_visible_tab_ids_v4',
  'nav_visible_tab_ids_v5',
  'nav_visible_tab_ids_v6',
  'nav_visible_tab_ids_v7',
  'nav_visible_tab_ids_v8',
  'nav_visible_tab_ids_v9',
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

function readStorageActiveTab(storage) {
  try {
    const username = storage.getItem(ACTIVE_TAB_USER_KEY)
    const tab = storage.getItem(ACTIVE_TAB_KEY)
    return username && tab ? { username, tab } : null
  } catch {
    return null
  }
}

function readActiveTabCache() {
  try {
    const userJson = localStorage.getItem('user_info')
    if (!userJson) return null
    const current = JSON.parse(userJson).username
    if (!current) return null

    // Prefer per-browser-tab sessionStorage so multiple tabs don't overwrite
    // each other's last active page.
    const sessionEntry = readStorageActiveTab(sessionStorage)
    if (sessionEntry?.username === current) return sessionEntry.tab

    // Fallback to the shared key for first load / browser restart.
    const localEntry = readStorageActiveTab(localStorage)
    if (localEntry?.username === current) return localEntry.tab
    return null
  } catch {
    return null
  }
}

function writeActiveTabCache(tab, username) {
  if (!tab || !username) return
  try {
    sessionStorage.setItem(ACTIVE_TAB_USER_KEY, username)
    sessionStorage.setItem(ACTIVE_TAB_KEY, tab)
  } catch {
    /* ignore */
  }
  try {
    // Global fallback for browser restart; sessionStorage is per tab.
    localStorage.setItem(ACTIVE_TAB_USER_KEY, username)
    localStorage.setItem(ACTIVE_TAB_KEY, tab)
  } catch {
    /* ignore */
  }
}

export function useNavigationShell({ user, isAuthenticated }) {
  const cachedActiveTab = readActiveTabCache() ?? ''
  const activeTab = ref(cachedActiveTab)
  const mountedTabs = ref(cachedActiveTab ? new Set([cachedActiveTab]) : new Set())
  const cachedNavIds = readNavCacheRaw()
  const serverVisibleTabIds = ref(cachedNavIds)
  const navPolicyResolved = ref(!!cachedNavIds)

  const tabsShellReady = computed(() => {
    if (user.value?.is_admin) return true
    return navPolicyResolved.value
  })

  const adminTabs = computed(() => {
    if (user.value?.is_admin) {
      return NAV_TABS.map((tab) => ({ ...tab }))
    }

    if (!navPolicyResolved.value) {
      return []
    }

    const ids = serverVisibleTabIds.value
    if (!Array.isArray(ids) || ids.length === 0) {
      return []
    }

    // Retired ids may still be returned by the backend; skip them instead of
    // resurrecting them under "其他".
    const visibleIds = new Set(ids.filter((id) => !RETIRED_NAV_TAB_IDS.has(id)))
    const filteredTabs = NAV_TABS
      .filter((tab) => !tab.adminOnly && visibleIds.has(tab.id))
      .map((tab) => ({ ...tab }))

    // Keep future/unknown ids visible instead of silently dropping them.
    const knownIds = new Set(NAV_TABS.map((tab) => tab.id))
    for (const id of visibleIds) {
      if (!knownIds.has(id)) {
        filteredTabs.push({ id, name: id, group: 'other' })
      }
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
      const body = await request({ url: '/user/navigation-tabs', method: 'get' })
      if (body?.success && Array.isArray(body.data?.visible_tab_ids)) {
        serverVisibleTabIds.value = body.data.visible_tab_ids
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

  function activateTab(tabId) {
    if (!tabId) {
      activeTab.value = ''
      return
    }
    mountedTabs.value.add(tabId)
    activeTab.value = tabId
    prefetchEchartsForTab(tabId)
    // A tab that was mounted under an older layout may still hold a stale
    // chart canvas width. After v-show makes it visible, nudge charts that
    // only listen to window.resize.
    nextTick(() => {
      window.dispatchEvent(new Event('resize'))
    })
  }

  function toggleTab(tabId) {
    // Plain left-click on the already-active tab is a no-op. It used to set
    // activeTab = '', which emptied the content area and forced an expensive
    // remount on the next click.
    if (activeTab.value === tabId) return
    activateTab(tabId)
  }

  function switchTab(tabId, { toggle = false } = {}) {
    if (toggle) toggleTab(tabId)
    else activateTab(tabId)
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
    activateTab,
    toggleTab,
    switchTab,
    applyResolvedNavigationTabs,
    resetNavigationShell,
    readSavedActiveTab: readActiveTabCache,
  }
}