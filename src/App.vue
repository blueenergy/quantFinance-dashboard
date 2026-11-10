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
    <div v-else class="container" data-testid="app-shell">
      <header class="header" data-testid="app-header">
        <div class="header-left">
          <button
            v-if="isAuthenticated"
            type="button"
            class="menu-toggle"
            data-testid="nav-menu-toggle"
            aria-label="打开主导航"
            aria-controls="main-nav"
            :aria-expanded="sidebarOpen"
            @click="toggleSidebar"
          >☰</button>
          <h1 v-if="isAuthenticated" data-testid="app-title">🔥 悟空量化金融智能助手</h1>
        </div>
        <div class="header-right">
          <NotificationCenter />
          <UserAvatar :user="user" @logout="handleLogout" />
        </div>
      </header>

      <div v-if="sidebarOpen" class="nav-backdrop" @click="closeSidebar" />
      <NavSidebar
        v-if="tabsShellReady"
        :tabs="adminTabs"
        :active-tab="activeTab"
        :chart-symbol="chartSymbol"
        :drawer-open="sidebarOpen"
        @select="handleSidebarSelect"
      />
      <aside v-else class="nav-placeholder" data-testid="nav-sidebar-loading">
        主导航加载中…
      </aside>

      <div class="main-content">
        <!-- 普通用户显示：AI公告栏和搜索功能 -->
        <template v-if="!user?.is_admin">
          <section v-if="!activeTab" class="home-welcome">
            <div class="welcome-card home-welcome-card">
              <div class="home-welcome-copy">
                <h2>主控室摘要入口</h2>
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
        <p v-if="!(user?.is_admin || adminTabs.length)" class="nav-policy-loading">无法加载主导航列表，请刷新页面重试。</p>
        <div v-else-if="activeTab" class="tab-content">
          <!-- 每个 Tab 首次被点击时才 mount，之后仅用 v-show 切换，避免反复加载 -->
            <template v-for="tabView in renderableTabViews" :key="tabView.id">
              <template v-if="shouldMountTabView(tabView.id) && (!tabView.adminOnly || user?.is_admin)">
                <div v-show="activeTab === tabView.id" :class="['tab-page', tabView.wrapperClass || undefined]">
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
        </template>
        <p v-else class="nav-policy-loading">主导航策略加载中…</p>
      </div>
    </div>

    <!-- ICP 备案号：全站底部悬挂，链至工信部 -->
    <SiteIcpFooter />

    <!-- 停止实盘策略的持仓确认（配置页/运行页共用） -->
    <StrategyPositionGuardDialog />
  </v-app>
</template>

<script setup>
import LoginForm from './components/LoginForm.vue'
import UserAvatar from './components/UserAvatar.vue'
import NotificationCenter from './components/NotificationCenter.vue'
import AccountActivate from './components/AccountActivate.vue'
import ResetPassword from './components/ResetPassword.vue'
import SiteIcpFooter from './components/common/SiteIcpFooter.vue'
import StrategyPositionGuardDialog from './components/StrategyPositionGuardDialog.vue'
import NavSidebar from './components/NavSidebar.vue'
import { computed, ref, watch, onMounted, onUnmounted, nextTick, provide } from 'vue'
import { getRenderableTabViews, getTabProps as buildTabProps, getTabListeners as buildTabListeners } from './utils/tabViews.js'
import { parseDeepLinkFromUrl } from './utils/appDeepLinks.js'
import { nextRankingTabMountedState } from './utils/rankingTabMountGate.js'
import { useAppStartupFlow } from './composables/useAppStartupFlow.js'
import { useHomeSummaries } from './composables/useHomeSummaries.js'
import { useChartWorkspace } from './composables/useChartWorkspace.js'
import { useNavigationShell } from './composables/useNavigationShell.js'
import { useAuth, authService } from './services/auth.js'

const { user, isAuthenticated, validateToken, logout } = useAuth()

const {
  activeTab,
  mountedTabs,
  serverVisibleTabIds,
  navPolicyResolved,
  tabsShellReady,
  adminTabs,
  loadNavigationTabs,
  activateTab,
  switchTab,
  applyResolvedNavigationTabs,
  resetNavigationShell,
  readSavedActiveTab,
} = useNavigationShell({
  user,
  isAuthenticated,
})

provide('shellActiveTab', activeTab)

const {
  watchlist,
  chartRecords,
  moneyFlowRecords,
  stockName,
  chartSymbol,
  signalDates,
  currentStrategy,
  currentPreset,
  tradeMarkers,
  chartLoading,
  hasPrev,
  hasNext,
  loadAppChartWatchlist,
  handleLoadMore,
  goBackToStrategyPool,
  prevStock,
  nextStock,
  selectStockForChart,
  priceAdjust,
  setPriceAdjust,
} = useChartWorkspace({
  activeTab,
  isAuthenticated,
  switchTab,
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

const pendingEtfNavigation = ref(null)
const pendingStockWorkbenchNavigation = ref(null)
const pendingPortfolioOverviewNavigation = ref(null)
const sidebarOpen = ref(false)

/**
 * @param {{ tab: string, params?: Record<string, string> }} payload
 * @returns {boolean}
 */
function applyDeepLink({ tab, params = {} }) {
  if (!tab) return false

  const visibleIds = adminTabs.value.map((t) => t.id)
  if (!visibleIds.includes(tab) && tab !== 'chart') return false

  if (tab === 'chart') {
    const symbol = params.symbol
    if (!symbol) return false
    void selectStockForChart(symbol)
    return true
  }

  if (tab === 'stock-workbench') {
    const symbol = params.symbol
    if (symbol) {
      pendingStockWorkbenchNavigation.value = {
        ...params,
        symbol,
        requestId: Date.now(),
      }
    } else {
      // The workbench renders an empty state with a stock search box, so a
      // symbol-less deep link (e.g. its nav link opened in a new tab) should
      // still activate the page instead of falling back to the last tab.
      pendingStockWorkbenchNavigation.value = null
    }
  }

  if (tab === 'portfolio-overview') {
    pendingPortfolioOverviewNavigation.value = {
      ...params,
      requestId: Date.now(),
    }
  }

  if (activeTab.value !== tab) {
    activateTab(tab)
  } else {
    mountedTabs.value.add(tab)
  }
  return true
}

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function closeSidebar() {
  sidebarOpen.value = false
}

function handleSidebarSelect(tabId) {
  // Preserve existing toggle behavior on plain left click.
  switchTab(tabId, { toggle: true })
  sidebarOpen.value = false
}

const {
  isAccountActivateMode,
  accountActivateToken,
  isResetPasswordMode,
  resetToken,
  handleLoginSuccess,
  handleLogout,
  handleResetDone,
} = useAppStartupFlow({
  user,
  adminTabs,
  activeTab,
  watchlist,
  setAuth: (authData) => authService.setAuth(authData),
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
})

const renderableTabViews = computed(() => {
  return getRenderableTabViews(adminTabs.value)
})

function shouldMountTabView(tabId) {
  const alreadyMounted = mountedTabs.value.has(tabId)
  if (tabId !== 'ranking') return alreadyMounted
  return nextRankingTabMountedState(alreadyMounted, activeTab.value)
}

const DEFAULT_DOCUMENT_TITLE = '悟空量化金融智能助手'

function cleanTabName(name) {
  return String(name || '').replace(/^[^\p{L}\p{N}]+/u, '').trim()
}

function pageTitleForTab(tabId) {
  if (!tabId) return DEFAULT_DOCUMENT_TITLE
  const tab = adminTabs.value.find((item) => item.id === tabId)
  const tabName = cleanTabName(tab?.name) || tabId
  if (tabId === 'stock-workbench') {
    const symbol = pendingStockWorkbenchNavigation.value?.symbol
    return symbol ? `${tabName} ${symbol}` : tabName
  }
  return tabName
}

watch(
  [activeTab, adminTabs, pendingStockWorkbenchNavigation],
  () => {
    document.title = pageTitleForTab(activeTab.value)
  },
  { immediate: true, deep: true }
)

function getTabProps(tabId) {
  return buildTabProps(tabId, {
    chartSymbol: chartSymbol.value,
    stockName: stockName.value,
    chartRecords: chartRecords.value,
    moneyFlowRecords: moneyFlowRecords.value,
    signalDates: signalDates.value,
    tradeMarkers: tradeMarkers.value,
    chartLoading: chartLoading.value,
    prevStock,
    nextStock,
    hasPrev: hasPrev.value,
    hasNext: hasNext.value,
    currentStrategy: currentStrategy.value,
    currentPreset: currentPreset.value,
    priceAdjust: priceAdjust.value,
    user: user.value,
    pendingEtfNavigation: pendingEtfNavigation.value,
    pendingStockWorkbenchNavigation: pendingStockWorkbenchNavigation.value,
    pendingPortfolioOverviewNavigation: pendingPortfolioOverviewNavigation.value,
  })
}

function getTabListeners(tabId) {
  return buildTabListeners(tabId, {
    selectStockForChart,
    openEtfAnalysis,
    goBackToStrategyPool,
    handleLoadMore,
    setPriceAdjust,
  })
}

async function openEtfAnalysis (payload) {
  pendingEtfNavigation.value = {
    ...(payload || {}),
    requestId: Date.now(),
  }
  if (activeTab.value !== 'etf') {
    switchTab('etf')
  }
}

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

// 申万行业研究 → 个股深度分析 跨 Tab 跳转
async function onShenwanOpenDeepAnalysis (e) {
  switchTab('history')
  // history tab may not be mounted yet; wait for nextTick + a frame so
  // AIAnalysisHistory.vue has time to mount and register its listener
  await nextTick()
  await new Promise(r => requestAnimationFrame(r))
  window.dispatchEvent(new CustomEvent('deep-analysis:set-symbol', { detail: e.detail }))
}

async function onShenwanSelectIndustry (e) {
  switchTab('shenwan-index')
  // wait for ShenwanIndustryIndex to mount before forwarding (same pattern as deep-analysis)
  await nextTick()
  await new Promise(r => requestAnimationFrame(r))
  window.dispatchEvent(new CustomEvent('shenwan:navigate-to-industry', { detail: e.detail }))
}

async function onOpenStockWorkbench (e) {
  const detail = e?.detail || {}
  const symbol = typeof detail === 'string' ? detail : detail.symbol
  if (!symbol) return
  applyDeepLink({
    tab: 'stock-workbench',
    params: {
      ...(typeof detail === 'object' ? detail : {}),
      symbol,
    },
  })
}

function onAppNavigate (e) {
  const detail = e?.detail || {}
  applyDeepLink(detail)
}

function onDocumentVisibilityChange() {
  if (document.hidden) return
  // Background tabs can initialize charts with a 0-size container. Charts
  // that only listen for window resize need a nudge when the tab returns.
  window.dispatchEvent(new Event('resize'))
}

function onNavKeydown(event) {
  if (event.key === 'Escape') closeSidebar()
}

function onNavResize() {
  if (window.innerWidth > 1200) closeSidebar()
}

let layoutResizeObserver = null
let layoutResizeFrame = 0

function scheduleLayoutResize() {
  if (layoutResizeFrame) return
  layoutResizeFrame = requestAnimationFrame(() => {
    layoutResizeFrame = 0
    // Charts that only listen to window.resize (and not ResizeObserver)
    // would otherwise keep the canvas width captured at mount time.
    window.dispatchEvent(new Event('resize'))
  })
}

onMounted(() => {
  window.addEventListener('shenwan:open-deep-analysis', onShenwanOpenDeepAnalysis)
  window.addEventListener('shenwan:select-industry', onShenwanSelectIndustry)
  window.addEventListener('stock-workbench:open', onOpenStockWorkbench)
  window.addEventListener('app:navigate', onAppNavigate)
  window.addEventListener('resize', onNavResize)
  document.addEventListener('visibilitychange', onDocumentVisibilityChange)
  document.addEventListener('keydown', onNavKeydown)

  const layoutTarget = document.querySelector('.main-content')
  if (layoutTarget && typeof ResizeObserver !== 'undefined') {
    layoutResizeObserver = new ResizeObserver(scheduleLayoutResize)
    layoutResizeObserver.observe(layoutTarget)
  }
})
onUnmounted(() => {
  window.removeEventListener('shenwan:open-deep-analysis', onShenwanOpenDeepAnalysis)
  window.removeEventListener('shenwan:select-industry', onShenwanSelectIndustry)
  window.removeEventListener('stock-workbench:open', onOpenStockWorkbench)
  window.removeEventListener('app:navigate', onAppNavigate)
  window.removeEventListener('resize', onNavResize)
  document.removeEventListener('visibilitychange', onDocumentVisibilityChange)
  document.removeEventListener('keydown', onNavKeydown)
  if (layoutResizeObserver) {
    layoutResizeObserver.disconnect()
    layoutResizeObserver = null
  }
  if (layoutResizeFrame) {
    cancelAnimationFrame(layoutResizeFrame)
    layoutResizeFrame = 0
  }
})
</script>

<style scoped>
#app {
  --app-header-height: 68px;
  min-height: 100vh;
  /* 为固定 ICP 页脚留出空间，避免遮挡内容 */
  padding-bottom: 36px;
  background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #2d1b69 100%);
}

.container {
  width: 100%;
  max-width: 1620px;
  margin: 0 auto;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  grid-template-rows: auto 1fr;
  grid-template-areas:
    "header header"
    "sidebar main";
  background: linear-gradient(135deg, #1e1e3f 0%, #2a2a5e 100%);
  min-height: 100vh;
  box-shadow: 0 0 40px rgba(138, 43, 226, 0.3);
  border: 1px solid rgba(138, 43, 226, 0.2);
}

.header {
  grid-area: header;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 30px;
  background: linear-gradient(135deg, #8a2be2 0%, #9370db 50%, #6a5acd 100%);
  color: white;
  box-shadow: 0 4px 20px rgba(138, 43, 226, 0.4);
  position: sticky;
  top: 0;
  z-index: 30;
}

.nav-placeholder {
  grid-area: sidebar;
  box-sizing: border-box;
  min-height: calc(100vh - var(--app-header-height, 68px) - 36px);
  padding: 18px 14px;
  border-right: 1px solid rgba(138, 43, 226, 0.22);
  background: rgba(15, 23, 42, 0.38);
  color: #b19cd9;
  font-size: 13px;
  line-height: 1.5;
}

.nav-backdrop {
  display: none;
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

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
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

.menu-toggle {
  display: none;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.45);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.menu-toggle:hover {
  background: rgba(255, 255, 255, 0.24);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 200px;
}

.main-content {
  grid-area: main;
  min-width: 0;
  padding: 16px 18px;
  background: linear-gradient(135deg, #1e1e3f 0%, #2a2a5e 100%);
}

.home-welcome {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.home-welcome-card {
  text-align: left;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(241, 245, 249, 0.96) 100%);
}

.home-welcome-card.welcome-card {
  padding: 14px 18px;
  border-radius: 12px;
  text-align: left;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(241, 245, 249, 0.96) 100%);
}

.home-welcome-copy {
  margin-bottom: 10px;
}

.home-welcome-copy h2 {
  margin: 0;
  color: #0f172a;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.home-entry-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.home-entry-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 128px;
  padding: 12px;
  border: 1px solid #dbe3ef;
  border-radius: 12px;
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
  margin-bottom: 8px;
}

.home-entry-card__icon {
  font-size: 18px;
}

.home-entry-card__badge {
  padding: 3px 8px;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 600;
}

.home-entry-card__body h3 {
  margin: 0 0 4px;
  color: #0f172a;
  font-size: 14px;
}

.home-entry-card__body p {
  margin: 0;
  color: #475569;
  font-size: 12px;
  line-height: 1.4;
}

.home-entry-card__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  color: #64748b;
  font-size: 11px;
  line-height: 1.4;
}

.home-entry-card__action {
  margin-top: 8px;
  color: #2563eb;
  font-size: 11px;
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

.tab-content {
  min-height: 400px;
  background: rgba(30, 30, 63, 0.3);
  border-radius: 8px;
  padding: 0;
}

/* Stable page frame: keeps the panel at a full viewport height while a lazy
   tab chunk loads, so the content window doesn't start small and jump open.
   The direct page root stretches to fill the frame, giving every tab the same
   content canvas. */
.tab-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: calc(100vh - var(--app-header-height, 68px) - 68px);
}

.tab-page > * {
  flex: 1 0 auto;
  width: 100% !important;
  max-width: none !important;
  min-width: 0;
  margin: 0 !important;
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

.chart-view {
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

@media (max-width: 1200px) {
  .container {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "header"
      "main";
  }

  .nav-placeholder {
    display: none;
  }

  .nav-backdrop {
    display: block;
    position: fixed;
    top: var(--app-header-height, 68px);
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 35;
    background: rgba(0, 0, 0, 0.45);
  }

  .menu-toggle {
    display: inline-flex;
  }
}

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