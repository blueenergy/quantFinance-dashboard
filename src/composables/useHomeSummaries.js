import { computed, ref } from 'vue'
import request from '../utils/request'
import { fetchDataPulseOverview } from '../api/dataPulse.js'

const homeEntryCards = [
  {
    id: 'global-market-brief',
    targetTabId: 'global-market-brief',
    icon: '🌍',
    status: '盘前观察',
    title: '全球市场简报',
    summaryLine: '概览隔夜联动影响与净影响分。',
    updatedAt: '等待摘要刷新',
    signals: ['纳指期货', 'VIX 监控'],
  },
  {
    id: 'data-pulse',
    targetTabId: 'data-pulse',
    icon: '🛰️',
    status: '系统快照',
    title: '数据脉搏',
    summaryLine: '概览新闻、同步状态与数据健康度。',
    updatedAt: '等待摘要刷新',
    signals: ['同步状态', '新闻摘要'],
  },
  {
    id: 'market-analysis',
    targetTabId: 'market-analysis',
    icon: '🤖',
    status: '盘中盘后',
    title: 'AI大盘分析',
    summaryLine: '概览盘前预判、盘中跟踪与收盘复盘。',
    updatedAt: '等待摘要刷新',
    signals: ['风险等级', '主题主线'],
  },
]

function buildInitialHomeCardSummaryState() {
  return Object.fromEntries(
    homeEntryCards.map((card) => [
      card.id,
      {
        status: card.status,
        summaryLine: card.summaryLine,
        updatedAt: card.updatedAt,
        signals: card.signals,
        loading: false,
        loadFailed: false,
      },
    ])
  )
}

function normalizeSignalList(items, fallback = []) {
  const values = Array.isArray(items) ? items : []
  const normalized = values
    .map((item) => {
      if (!item) return ''
      if (typeof item === 'string') return item.trim()
      if (typeof item === 'object') {
        return String(item.name || item.label || item.title || item.sector || '').trim()
      }
      return String(item).trim()
    })
    .filter(Boolean)
  return normalized.slice(0, 2).length ? normalized.slice(0, 2) : fallback
}

function summarizeText(text, fallback, maxLength = 42) {
  const value = typeof text === 'string' ? text.trim() : ''
  if (!value) return fallback
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value
}

function formatHomeCardTimestamp(value, fallback = '刚刚更新') {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function useHomeSummaries({ isAuthenticated, user, tabsShellReady, adminTabs }) {
  const homeCardSummaryState = ref(buildInitialHomeCardSummaryState())

  const visibleHomeEntryCards = computed(() => {
    const visibleTabIds = new Set(adminTabs.value.map((tab) => tab.id))
    return homeEntryCards
      .filter((card) => visibleTabIds.has(card.targetTabId))
      .map((card) => ({
        ...card,
        ...(homeCardSummaryState.value[card.id] || {}),
      }))
  })

  function setHomeCardSummary(cardId, patch) {
    const current = homeCardSummaryState.value[cardId] || {}
    homeCardSummaryState.value = {
      ...homeCardSummaryState.value,
      [cardId]: {
        ...current,
        ...patch,
      },
    }
  }

  function setHomeCardLoading(cardId, loading) {
    setHomeCardSummary(cardId, {
      loading,
      loadFailed: loading ? false : homeCardSummaryState.value[cardId]?.loadFailed || false,
    })
  }

  async function refreshGlobalMarketSummary() {
    setHomeCardLoading('global-market-brief', true)
    try {
      const response = await request.get('/global-analysis/summary', { timeout: 30000, silentErrorLog: true })
      const summary = response?.data
      if (!summary) {
        setHomeCardSummary('global-market-brief', {
          status: '未生成',
          summaryLine: '今日暂无全球市场简报，进入模块后可查看是否已生成新报告。',
          updatedAt: response?.error?.includes('今日尚无') ? '等待今日分析生成' : '暂无可用摘要',
          signals: ['等待生成', '无轮询'],
          loading: false,
          loadFailed: false,
        })
        return
      }

      setHomeCardSummary('global-market-brief', {
        status: summary.status || (response?.success ? '已生成' : '未生成'),
        summaryLine: summarizeText(summary.summary_line, '全球市场影响摘要已生成'),
        updatedAt: formatHomeCardTimestamp(summary.updated_at, '已生成，等待时间戳'),
        signals: normalizeSignalList(summary.signals, ['全球联动', '等待查看']),
        loading: false,
        loadFailed: !response?.success,
      })
    } catch (_) {
      setHomeCardSummary('global-market-brief', {
        status: '读取失败',
        summaryLine: '全球市场简报摘要暂时不可用，可直接进入模块查看详情。',
        updatedAt: '请求失败',
        signals: ['手动进入模块', '稍后重试'],
        loading: false,
        loadFailed: true,
      })
    }
  }

  async function refreshDataPulseSummary() {
    setHomeCardLoading('data-pulse', true)
    try {
      const response = await fetchDataPulseOverview()
      const overview = response?.overview
      const syncHealth = overview?.sync_health
      const latestFreshness = Array.isArray(overview?.freshness_detail)
        ? overview.freshness_detail.map((row) => String(row?.latest_value || '')).filter(Boolean).sort().pop()
        : null
      if (!response?.success || !overview) {
        setHomeCardSummary('data-pulse', {
          status: '暂无摘要',
          summaryLine: '数据脉搏摘要暂不可用，可进入模块查看同步状态和新闻。',
          updatedAt: '暂无数据',
          signals: ['等待同步', '新闻摘要'],
          loading: false,
          loadFailed: false,
        })
        return
      }

      const healthPct = Number(syncHealth?.health_pct ?? 0)
      const healthy = Number(syncHealth?.healthy ?? 0)
      const total = Number(syncHealth?.total_pipelines ?? 0)
      const status = healthPct >= 80 ? '正常' : healthPct >= 50 ? '部分延迟' : '异常'
      const headlineCount = Array.isArray(overview?.news?.headlines) ? overview.news.headlines.length : 0
      setHomeCardSummary('data-pulse', {
        status,
        summaryLine: total > 0
          ? `${healthy}/${total} 条管线正常，当前健康度 ${healthPct.toFixed(0)}%`
          : '已获取数据脉搏概览，请进入模块查看细项。',
        updatedAt: latestFreshness
          ? `最新数据 ${String(latestFreshness).slice(4, 6)}-${String(latestFreshness).slice(6, 8)}`
          : '已更新概览',
        signals: normalizeSignalList([
          headlineCount > 0 ? `新闻 ${headlineCount} 条` : '',
          healthPct >= 80 ? '同步正常' : healthPct >= 50 ? '存在延迟' : '需排障',
        ], ['同步状态', '新闻摘要']),
        loading: false,
        loadFailed: false,
      })
    } catch (_) {
      setHomeCardSummary('data-pulse', {
        status: '读取失败',
        summaryLine: '数据脉搏摘要获取失败，可直接进入模块检查同步状态。',
        updatedAt: '请求失败',
        signals: ['同步状态', '稍后重试'],
        loading: false,
        loadFailed: true,
      })
    }
  }

  async function refreshMarketAnalysisSummary() {
    setHomeCardLoading('market-analysis', true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const response = await request.get('/market-analysis/summary', {
        params: { date: today },
        silentErrorLog: true,
      })
      const summary = response?.data
      if (!summary) {
        setHomeCardSummary('market-analysis', {
          status: '等待生成',
          summaryLine: summarizeText(response?.user_tip || response?.error, '今日暂无 AI 大盘分析摘要。', 48),
          updatedAt: '等待分析生成',
          signals: ['等待生成', '人工查看'],
          loading: false,
          loadFailed: false,
        })
        return
      }

      setHomeCardSummary('market-analysis', {
        status: summary.status || (response?.success ? '已生成' : '等待生成'),
        summaryLine: summarizeText(summary.summary_line, 'AI 大盘分析已生成'),
        updatedAt: formatHomeCardTimestamp(summary.updated_at || summary.analysis_date, '已生成'),
        signals: normalizeSignalList(summary.signals, ['风险等级', '主题主线']),
        loading: false,
        loadFailed: !response?.success,
      })
    } catch (_) {
      setHomeCardSummary('market-analysis', {
        status: '读取失败',
        summaryLine: 'AI 大盘分析摘要暂不可用，可直接进入模块查看完整结论。',
        updatedAt: '请求失败',
        signals: ['风险等级', '稍后重试'],
        loading: false,
        loadFailed: true,
      })
    }
  }

  async function refreshVisibleHomeSummaries() {
    if (!isAuthenticated.value || user.value?.is_admin || !tabsShellReady.value) return
    const visibleIds = new Set(visibleHomeEntryCards.value.map((card) => card.id))
    try {
      const today = new Date().toISOString().split('T')[0]
      const response = await request.get('/home-summaries', {
        params: { date: today },
        timeout: 30000,
        silentErrorLog: true,
      })
      const data = response?.data
      if (!response?.success || !data) throw new Error(response?.error || 'empty home summaries')

      if (visibleIds.has('global-market-brief')) {
        const summary = data['global-market-brief']
        setHomeCardSummary('global-market-brief', {
          status: summary?.status || '未生成',
          summaryLine: summarizeText(summary?.summary_line, '全球市场影响摘要已生成'),
          updatedAt: formatHomeCardTimestamp(summary?.updated_at, '已生成，等待时间戳'),
          signals: normalizeSignalList(summary?.signals, ['全球联动', '等待查看']),
          loading: false,
          loadFailed: !summary?.success,
        })
      }

      if (visibleIds.has('data-pulse')) {
        const summary = data['data-pulse']
        setHomeCardSummary('data-pulse', {
          status: summary?.status || '暂无摘要',
          summaryLine: summarizeText(summary?.summary_line, '已获取数据脉搏概览，请进入模块查看细项。', 48),
          updatedAt: summary?.updated_at || '已更新概览',
          signals: normalizeSignalList(summary?.signals, ['同步状态', '新闻摘要']),
          loading: false,
          loadFailed: !summary?.success,
        })
      }

      if (visibleIds.has('market-analysis')) {
        const summary = data['market-analysis']
        setHomeCardSummary('market-analysis', {
          status: summary?.status || '等待生成',
          summaryLine: summarizeText(summary?.summary_line, 'AI 大盘分析已生成'),
          updatedAt: formatHomeCardTimestamp(summary?.updated_at || summary?.analysis_date, '已生成'),
          signals: normalizeSignalList(summary?.signals, ['风险等级', '主题主线']),
          loading: false,
          loadFailed: !summary?.success,
        })
      }
      return
    } catch (_) {
      const jobs = []
      if (visibleIds.has('global-market-brief')) jobs.push(refreshGlobalMarketSummary())
      if (visibleIds.has('data-pulse')) jobs.push(refreshDataPulseSummary())
      if (visibleIds.has('market-analysis')) jobs.push(refreshMarketAnalysisSummary())
      await Promise.all(jobs)
    }
  }

  function resetHomeCardSummaries() {
    homeCardSummaryState.value = buildInitialHomeCardSummaryState()
  }

  return {
    homeEntryCards,
    homeCardSummaryState,
    visibleHomeEntryCards,
    refreshVisibleHomeSummaries,
    resetHomeCardSummaries,
  }
}