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
          <a
            v-for="tab in adminTabs"
            :key="tab.id"
            :href="tabHref(tab.id)"
            :class="['tab-button', { active: activeTab === tab.id }]"
            @click="onTabButtonClick($event, tab.id)"
          >
            {{ tab.name }}
          </a>
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
import { computed, ref, watch, onMounted, onUnmounted, nextTick, provide } from 'vue'
import { getRenderableTabViews, getTabProps as buildTabProps, getTabListeners as buildTabListeners } from './utils/tabViews.js'
import { parseDeepLinkFromUrl, buildDeepLinkHref, isModifiedClick } from './utils/appDeepLinks.js'
import { useAppStartupFlow } from './composables/useAppStartupFlow.js'
import { useHomeSummaries } from './composables/useHomeSummaries.js'
import { useChartWorkspace } from './composables/useChartWorkspace.js'
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
  hasPrev,
  hasNext,
  loadAppChartWatchlist,
  handleLoadMore,
  goBackToStrategyPool,
  prevStock,
  nextStock,
  selectStockForChart,
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
    if (!symbol) return false
    pendingStockWorkbenchNavigation.value = {
      ...params,
      symbol,
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

function tabHref(tabId) {
  return buildDeepLinkHref(tabId)
}

function onTabButtonClick(event, tabId) {
  // Let the browser handle modified clicks (ctrl/cmd/middle) to open a new tab.
  if (isModifiedClick(event)) return
  event.preventDefault()
  // Preserve existing toggle behavior on plain left click.
  switchTab(tabId, { toggle: true })
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
    prevStock,
    nextStock,
    hasPrev: hasPrev.value,
    hasNext: hasNext.value,
    currentStrategy: currentStrategy.value,
    currentPreset: currentPreset.value,
    user: user.value,
    pendingEtfNavigation: pendingEtfNavigation.value,
    pendingStockWorkbenchNavigation: pendingStockWorkbenchNavigation.value,
  })
}

function getTabListeners(tabId) {
  return buildTabListeners(tabId, {
    selectStockForChart,
    openEtfAnalysis,
    goBackToStrategyPool,
    handleLoadMore,
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

onMounted(() => {
  window.addEventListener('shenwan:open-deep-analysis', onShenwanOpenDeepAnalysis)
  window.addEventListener('shenwan:select-industry', onShenwanSelectIndustry)
  window.addEventListener('stock-workbench:open', onOpenStockWorkbench)
  window.addEventListener('app:navigate', onAppNavigate)
})
onUnmounted(() => {
  window.removeEventListener('shenwan:open-deep-analysis', onShenwanOpenDeepAnalysis)
  window.removeEventListener('shenwan:select-industry', onShenwanSelectIndustry)
  window.removeEventListener('stock-workbench:open', onOpenStockWorkbench)
  window.removeEventListener('app:navigate', onAppNavigate)
})
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
  text-decoration: none;
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