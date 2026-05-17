import { computed, ref } from 'vue'
import request from '../utils/request'

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
  let refreshPromise = null

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

  async function refreshVisibleHomeSummaries() {
    if (!isAuthenticated.value || user.value?.is_admin || !tabsShellReady.value) return
    if (refreshPromise) return refreshPromise
    const visibleIds = new Set(visibleHomeEntryCards.value.map((card) => card.id))
    for (const id of visibleIds) setHomeCardLoading(id, true)

    refreshPromise = (async () => {
      const today = new Date().toISOString().split('T')[0]
      try {
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
      } catch (_) {
        for (const id of visibleIds) {
          setHomeCardSummary(id, { loading: false, loadFailed: true })
        }
      } finally {
        refreshPromise = null
      }
    })()
    return refreshPromise
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