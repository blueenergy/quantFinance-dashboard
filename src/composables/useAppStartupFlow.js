import { onMounted, ref } from 'vue'
import axios from 'axios'

export function useAppStartupFlow({
  user,
  adminTabs,
  activeTab,
  watchlist,
  setAuth,
  validateToken,
  logout,
  loadNavigationTabs,
  activateTab,
  applyResolvedNavigationTabs,
  resetNavigationShell,
  readSavedActiveTab,
  refreshVisibleHomeSummaries,
  loadAppChartWatchlist,
  resetHomeCardSummaries,
  applyDeepLink,
  parseDeepLinkFromUrl,
}) {
  const isAccountActivateMode = ref(false)
  const accountActivateToken = ref('')
  const isResetPasswordMode = ref(false)
  const resetToken = ref('')

  function tryApplyDeepLinkFromUrl(visibleTabIds) {
    if (typeof parseDeepLinkFromUrl !== 'function' || typeof applyDeepLink !== 'function') {
      return false
    }
    const dl = parseDeepLinkFromUrl()
    if (!dl?.tab) return false
    const isVisibleTab = Array.isArray(visibleTabIds) && visibleTabIds.includes(dl.tab)
    const isInternalChartLink = dl.tab === 'chart'
    if (!isVisibleTab && !isInternalChartLink) return false
    return applyDeepLink(dl)
  }

  async function handleLoginSuccess(authData) {
    console.log('登录成功:', authData.user.username)
    setAuth(authData)
    window.currentSourceInfo = null

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

    const savedTab = readSavedActiveTab()
    const visibleIds = user.value?.is_admin
      ? adminTabs.value.map((tab) => tab.id)
      : (Array.isArray(ids) ? ids : [])

    if (tryApplyDeepLinkFromUrl(visibleIds)) {
      refreshVisibleHomeSummaries()
      return
    }

    if (savedTab && visibleIds.includes(savedTab)) {
      activateTab(savedTab)
      console.log('登录后恢复上次浏览的页面:', savedTab)
    } else if (user.value?.is_admin) {
      activateTab('admin')
      console.log('管理员登录，跳转到系统管理页面')
    } else {
      activeTab.value = ''
    }

    refreshVisibleHomeSummaries()
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
    isResetPasswordMode.value = false
    resetToken.value = ''
    window.history.replaceState({}, document.title, window.location.pathname)
  }

  onMounted(async () => {
    const urlParams = new URLSearchParams(window.location.search)
    if (window.location.pathname === '/activate') {
      const token = urlParams.get('token')
      isAccountActivateMode.value = true
      accountActivateToken.value = token || ''
      return
    }

    const resetTokenParam = urlParams.get('token')
    if (resetTokenParam && window.location.pathname === '/reset-password') {
      isResetPasswordMode.value = true
      resetToken.value = resetTokenParam
      return
    }

    if (!localStorage.getItem('access_token')) return

    const [tokenValid] = await Promise.all([
      validateToken(),
      loadNavigationTabs(),
    ])
    if (!tokenValid) {
      console.log('Token已失效,请重新登录')
      return
    }

    const savedTab = readSavedActiveTab()
    console.log('尝试恢复tab:', savedTab, '用户:', user.value?.username, '是否管理员:', user.value?.is_admin)

    const visibleIds = adminTabs.value.map((tab) => tab.id)
    if (tryApplyDeepLinkFromUrl(visibleIds)) {
      refreshVisibleHomeSummaries()
      if (activeTab.value === 'watchlist') {
        await loadAppChartWatchlist()
      }
      return
    }

    if (savedTab && adminTabs.value.some((tab) => tab.id === savedTab)) {
      if (savedTab === 'admin' && !user.value?.is_admin) {
        activeTab.value = ''
        console.log('非管理员用户尝试访问管理后台，已清空无权限标签页')
      } else {
        activateTab(savedTab)
        console.log('恢复上次浏览的页面:', savedTab)
      }
    } else if (user.value?.is_admin) {
      activateTab('admin')
      console.log('管理员自动跳转到系统管理页面')
    } else {
      activeTab.value = ''
    }

    refreshVisibleHomeSummaries()

    if (activeTab.value === 'watchlist') {
      await loadAppChartWatchlist()
    }
  })

  return {
    isAccountActivateMode,
    accountActivateToken,
    isResetPasswordMode,
    resetToken,
    handleLoginSuccess,
    handleLogout,
    handleResetDone,
  }
}