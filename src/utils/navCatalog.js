/**
 * Main navigation catalog: group, label and order for every primary tab.
 *
 * Keep this independent from `useNavigationShell` (visibility/active state)
 * and `tabViews` (component rendering). Tabs removed from NAV_TABS disappear
 * from the sidebar; add them back here to restore.
 */

export const NAV_GROUPS = [
  { id: 'overview', label: '总览' },
  { id: 'market', label: '盘面' },
  { id: 'macro', label: '宏观' },
  { id: 'stock', label: '个股' },
  { id: 'screening', label: '选股' },
  { id: 'strategy', label: '策略' },
  { id: 'trading', label: '交易' },
  { id: 'system', label: '系统' },
]

/**
 * Temporarily retired ids that the backend may still return. They are skipped
 * rather than rendered under "其他".
 */
export const RETIRED_NAV_TAB_IDS = new Set([
  'chat',
  'x-influencer-voices',
  'backtest',
])

export const NAV_TABS = [
  // 总览
  { id: 'market-events', name: '📅 交易日历', group: 'overview' },
  { id: 'global-market-brief', name: '🌍 全球市场简报', group: 'overview' },
  { id: 'data-pulse', name: '🛰️ 数据脉搏', group: 'overview' },
  { id: 'market-analysis', name: '🤖 AI大盘分析', group: 'overview' },
  { id: 'market-risk', name: '🚨 风险预警', group: 'overview' },
  { id: 'market-regime', name: '📡 广度估值', group: 'overview' },
  { id: 'market-stats', name: '📉 市场统计', group: 'overview' },

  // 盘面
  { id: 'limit-up-ladder', name: '📊 连板天梯', group: 'market' },
  { id: 'market-trend', name: '🧭 趋势全景', group: 'market' },
  { id: 'market-intraday', name: '⚡ 盘中强弱', group: 'market' },
  { id: 'market-insights', name: '👀 火眼金睛', group: 'market' },
  { id: 'spectrum', name: '☯️ 阴阳谱', group: 'market' },
  { id: 'realtime-spectrum', name: '⏱️ 实时阴阳谱', group: 'market' },

  // 宏观
  { id: 'china-macro', name: '🇨🇳 中国宏观', group: 'macro' },
  { id: 'us-rates', name: '🇺🇸 美国利率', group: 'macro' },

  // 个股
  { id: 'watchlist', name: '⭐ 自选股', group: 'stock' },
  { id: 'stock-workbench', name: '🔬 个股工作台', group: 'stock' },
  { id: 'history', name: '🔍 个股深度分析', group: 'stock' },
  { id: 'kline-comparison', name: '📈 走势对比', group: 'stock' },
  { id: 'futures-kline', name: '📉 期货K线', group: 'stock' },
  { id: 'etf', name: '💰 ETF淘金', group: 'stock' },
  { id: 'earnings-hunter', name: '🎯 财报猎手', group: 'stock' },
  { id: 'shenwan-index', name: '📊 申万行业研究', group: 'stock' },

  // 选股
  { id: 'ranking', name: '🏆 金榜', group: 'screening' },
  { id: 'entropy-ranking', name: '🎲 熵值排名', group: 'screening' },
  { id: 'fund-inventory', name: '🗃️ 公募库存', group: 'screening' },
  { id: 'fund-copywork', name: '📝 抄作业', group: 'screening' },
  { id: 'sector-concept', name: '📈 概念板块', group: 'screening' },
  { id: 'hot-stock', name: '🔥 热股分析', group: 'screening' },
  { id: 'theme-lag-recommend', name: '📌 主题补涨', group: 'screening' },
  { id: 'daily-gold-picks', name: '⭐ 每日金股', group: 'screening' },

  // 策略
  { id: 'strategy-pool', name: '🎯 策略股池', group: 'strategy' },
  { id: 'strategy-lab', name: '🧪 策略实验室', group: 'strategy' },
  { id: 'factor-backtest', name: '🧬 因子回测', group: 'strategy' },
  { id: 'portfolio-research', name: '🧩 组合研究', group: 'strategy' },
  { id: 'model-training', name: '🧠 模型训练', group: 'strategy' },

  // 交易
  { id: 'portfolio-plans', name: '📋 组合交易计划', group: 'trading' },
  { id: 'portfolio-overview', name: '📊 组合总览', group: 'trading' },
  { id: 'strategies', name: '⚙️ 策略配置', group: 'trading' },
  { id: 'strategy-workers', name: '🚀 策略运行', group: 'trading' },
  { id: 'trading-manual', name: '⚡ 交易执行', group: 'trading' },
  { id: 'trade-executions', name: '📜 交易记录', group: 'trading' },
  { id: 'intraday-t0', name: '🔄 日内T+0', group: 'trading' },
  { id: 'securities', name: '💼 账户工作台', group: 'trading' },

  // 系统
  { id: 'user-profile', name: '👤 用户配置', group: 'system' },
  { id: 'analysis-task-queue', name: '🗂️ 分析任务队列', group: 'system' },
  { id: 'admin', name: '🛠️ 管理后台', group: 'system', adminOnly: true },
]

const TAB_BY_ID = new Map(NAV_TABS.map((tab) => [tab.id, tab]))

/** Group id for a primary tab; `chart` is a stock detail view. */
export function groupForTab(tabId) {
  if (tabId === 'chart') return 'stock'
  return TAB_BY_ID.get(tabId)?.group || ''
}

/**
 * Turn the already-visibility-filtered tab list into sidebar groups.
 * Empty groups are dropped; unknown groups fall back to "其他".
 *
 * @param {Array<{ id: string, name: string, group?: string }>} tabs
 */
export function buildNavGroups(tabs) {
  const groups = NAV_GROUPS.map((group) => ({ ...group, tabs: [] }))
  const groupById = new Map(groups.map((group) => [group.id, group]))
  const other = { id: 'other', label: '其他', tabs: [] }

  for (const tab of tabs || []) {
    const group = groupById.get(tab.group) || other
    group.tabs.push(tab)
  }

  const visibleGroups = groups.filter((group) => group.tabs.length > 0)
  if (other.tabs.length > 0) visibleGroups.push(other)
  return visibleGroups
}
