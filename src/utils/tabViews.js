import { defineAsyncComponent } from 'vue'
import EtfView from '../views/EtfView.vue'

const WatchListData = defineAsyncComponent(() => import('../components/WatchListData.vue'))
const StockChart = defineAsyncComponent(() => import('../components/StockChart.vue'))
const AIAnalysisHistory = defineAsyncComponent(() => import('../components/AIAnalysisHistory.vue'))
const AnalysisTaskQueue = defineAsyncComponent(() => import('../components/AnalysisTaskQueue.vue'))
const DataPulse = defineAsyncComponent(() => import('../components/DataPulse.vue'))
const MarketAnalysisBulletin = defineAsyncComponent(() => import('../components/MarketAnalysisBulletin.vue'))
const GlobalMarketBrief = defineAsyncComponent(() => import('../components/GlobalMarketBrief.vue'))
const AdminDashboard = defineAsyncComponent(() => import('../components/AdminDashboard.vue'))
const StockRanking = defineAsyncComponent(() => import('../components/StockRanking.vue'))
const MarketSpectrum = defineAsyncComponent(() => import('../components/MarketSpectrum.vue'))
const IntradayT0 = defineAsyncComponent(() => import('../components/IntradayT0.vue'))
const MarketInsightsRadar = defineAsyncComponent(() => import('../components/MarketInsightsRadar.vue'))
const WatchlistStrategyTable = defineAsyncComponent(() => import('../components/WatchlistStrategyTable.vue'))
const TradeExecutionTable = defineAsyncComponent(() => import('../components/TradeExecutionTable.vue'))
const TradingManualPanel = defineAsyncComponent(() => import('../components/TradingManualPanel.vue'))
const StrategyWorkers = defineAsyncComponent(() => import('../views/StrategyWorkers.vue'))
const StrategyExecutionAnalysis = defineAsyncComponent(() => import('../components/StrategyExecutionAnalysis.vue'))
const SecuritiesAccountDashboard = defineAsyncComponent(() => import('../components/SecuritiesAccountDashboard.vue'))
const UserProfile = defineAsyncComponent(() => import('../components/UserProfile.vue'))
const BacktestManager = defineAsyncComponent(() => import('../components/BacktestManager.vue'))
const StrategyLab = defineAsyncComponent(() => import('../views/StrategyLab.vue'))
const PortfolioPlans = defineAsyncComponent(() => import('../views/PortfolioPlans.vue'))
const PortfolioResearch = defineAsyncComponent(() => import('../views/PortfolioResearch.vue'))
const StrategyStockPool = defineAsyncComponent(() => import('../components/StrategyStockPool.vue'))
const LimitUpLadder = defineAsyncComponent(() => import('../views/LimitUpLadder.vue'))
const MarketRiskPanel = defineAsyncComponent(() => import('../views/MarketRiskPanel.vue'))
const ChinaMacroPanel = defineAsyncComponent(() => import('../views/ChinaMacroPanel.vue'))
const UsRatesPanel = defineAsyncComponent(() => import('../views/UsRatesPanel.vue'))
const XInfluencerVoicesPanel = defineAsyncComponent(() => import('../views/XInfluencerVoicesPanel.vue'))
const ThemeLagRecommendPanel = defineAsyncComponent(() => import('../components/ThemeLagRecommendPanel.vue'))
const SectorConceptAnalysis = defineAsyncComponent(() => import('../components/SectorConceptAnalysis.vue'))
const HotStockAnalysis = defineAsyncComponent(() => import('../components/HotStockAnalysis.vue'))
const KLineComparison = defineAsyncComponent(() => import('../views/KLineComparison.vue'))
const EarningsHunter = defineAsyncComponent(() => import('../views/EarningsHunter.vue'))
const ShenwanIndustryIndex = defineAsyncComponent(() => import('../views/ShenwanIndustryIndex.vue'))
const ChatPanel = defineAsyncComponent(() => import('../components/ChatPanel.vue'))

export const tabViewDefinitions = [
  {
    id: 'watchlist',
    component: WatchListData,
    wrapperClass: 'watchlist-view',
    fallbackClass: 'skeleton-table',
    fallbackText: '自选股加载中...',
  },
  {
    id: 'chart',
    component: StockChart,
    wrapperClass: 'chart-view',
    fallbackClass: 'skeleton-chart',
    fallbackText: '图表加载中...',
  },
  {
    id: 'history',
    component: AIAnalysisHistory,
    wrapperClass: 'history-view',
    fallbackClass: 'skeleton-table',
    fallbackText: '个股深度分析加载中...',
  },
  {
    id: 'analysis-task-queue',
    component: AnalysisTaskQueue,
    fallbackClass: 'skeleton-table',
    fallbackText: '分析任务队列加载中...',
  },
  {
    id: 'admin',
    component: AdminDashboard,
    wrapperClass: 'admin-view',
    fallbackClass: 'skeleton-card',
    fallbackText: '管理面板加载中...',
    adminOnly: true,
  },
  {
    id: 'strategies',
    component: WatchlistStrategyTable,
    wrapperClass: 'strategies-view',
    fallbackClass: 'skeleton-table',
    fallbackText: '策略配置加载中...',
  },
  {
    id: 'etf',
    component: EtfView,
    fallbackClass: 'skeleton-table',
    fallbackText: 'ETF模块加载中...',
  },
  {
    id: 'earnings-hunter',
    component: EarningsHunter,
    fallbackClass: 'skeleton-table',
    fallbackText: '财报猎手加载中...',
  },
  {
    id: 'shenwan-index',
    component: ShenwanIndustryIndex,
    fallbackClass: 'skeleton-table',
    fallbackText: '申万行业研究加载中...',
  },
  {
    id: 'ranking',
    component: StockRanking,
    fallbackClass: 'skeleton-table',
    fallbackText: '评分模块加载中...',
  },
  {
    id: 'spectrum',
    component: MarketSpectrum,
    fallbackClass: 'skeleton-chart',
    fallbackText: '市场阴阳谱加载中...',
  },
  {
    id: 'realtime-spectrum',
    component: MarketSpectrum,
    fallbackClass: 'skeleton-chart',
    fallbackText: '实时阴阳谱加载中...',
  },
  {
    id: 'intraday-t0',
    component: IntradayT0,
    fallbackClass: 'skeleton-table',
    fallbackText: '日内T+0加载中...',
  },
  {
    id: 'market-insights',
    component: MarketInsightsRadar,
    fallbackClass: 'skeleton-table',
    fallbackText: '火眼金睛加载中...',
  },
  {
    id: 'securities',
    component: SecuritiesAccountDashboard,
    wrapperClass: 'securities-view',
    fallbackClass: 'skeleton-table',
    fallbackText: '账户工作台加载中...',
  },
  {
    id: 'trade-executions',
    component: TradeExecutionTable,
    fallbackClass: 'skeleton-table',
    fallbackText: '交易执行记录加载中...',
  },
  {
    id: 'trading-manual',
    component: TradingManualPanel,
    fallbackClass: 'skeleton-table',
    fallbackText: '手动交易面板加载中...',
  },
  {
    id: 'strategy-workers',
    component: StrategyWorkers,
    fallbackClass: 'skeleton-table',
    fallbackText: '策略 Workers 加载中...',
  },
  {
    id: 'strategy-execution-analysis',
    component: StrategyExecutionAnalysis,
    fallbackClass: 'skeleton-table',
    fallbackText: '策略执行分析加载中...',
  },
  {
    id: 'user-profile',
    component: UserProfile,
    fallbackClass: 'skeleton-table',
    fallbackText: '用户配置加载中...',
  },
  {
    id: 'backtest',
    component: BacktestManager,
    fallbackClass: 'skeleton-table',
    fallbackText: '回测管理加载中...',
  },
  {
    id: 'strategy-lab',
    component: StrategyLab,
    fallbackClass: 'skeleton-table',
    fallbackText: '策略实验室加载中...',
  },
  {
    id: 'portfolio-plans',
    component: PortfolioPlans,
    fallbackClass: 'skeleton-table',
    fallbackText: '组合交易计划加载中...',
  },
  {
    id: 'portfolio-research',
    component: PortfolioResearch,
    fallbackClass: 'skeleton-table',
    fallbackText: '组合研究加载中...',
  },
  {
    id: 'strategy-pool',
    component: StrategyStockPool,
    fallbackClass: 'skeleton-table',
    fallbackText: '策略股池加载中...',
  },
  {
    id: 'global-market-brief',
    component: GlobalMarketBrief,
    fallbackClass: 'skeleton-table',
    fallbackText: '全球市场简报加载中...',
  },
  {
    id: 'data-pulse',
    component: DataPulse,
    fallbackClass: 'skeleton-table',
    fallbackText: '数据脉搏加载中...',
  },
  {
    id: 'market-analysis',
    component: MarketAnalysisBulletin,
    fallbackClass: 'skeleton-table',
    fallbackText: 'AI大盘分析加载中...',
  },
  {
    id: 'limit-up-ladder',
    component: LimitUpLadder,
    fallbackClass: 'skeleton-table',
    fallbackText: '连板天梯加载中...',
  },
  {
    id: 'market-risk',
    component: MarketRiskPanel,
    fallbackClass: 'skeleton-table',
    fallbackText: '市场风险预警加载中...',
  },
  {
    id: 'china-macro',
    component: ChinaMacroPanel,
    fallbackClass: 'skeleton-table',
    fallbackText: '中国宏观加载中...',
  },
  {
    id: 'us-rates',
    component: UsRatesPanel,
    fallbackClass: 'skeleton-table',
    fallbackText: '美国利率加载中...',
  },
  {
    id: 'x-influencer-voices',
    component: XInfluencerVoicesPanel,
    fallbackClass: 'skeleton-table',
    fallbackText: 'X大V情报加载中...',
  },
  {
    id: 'theme-lag-recommend',
    component: ThemeLagRecommendPanel,
    fallbackClass: 'skeleton-table',
    fallbackText: '主题补涨加载中...',
  },
  {
    id: 'chat',
    component: ChatPanel,
    fallbackClass: 'skeleton-table',
    fallbackText: 'AI助手加载中...',
  },
  {
    id: 'sector-concept',
    component: SectorConceptAnalysis,
    fallbackClass: 'skeleton-table',
    fallbackText: '概念板块分析加载中...',
  },
  {
    id: 'hot-stock',
    component: HotStockAnalysis,
    fallbackClass: 'skeleton-table',
    fallbackText: '热股分析加载中...',
  },
  {
    id: 'kline-comparison',
    component: KLineComparison,
    fallbackClass: 'skeleton-chart',
    fallbackText: '走势对比加载中...',
  },
]

export function getRenderableTabViews(visibleTabs) {
  const visibleTabIds = new Set(visibleTabs.map((tab) => tab.id))
  return tabViewDefinitions.filter((tabView) => {
    if (tabView.id === 'chart') return true
    return visibleTabIds.has(tabView.id)
  })
}

export function getTabProps(tabId, context) {
  if (tabId === 'chart') {
    return {
      symbol: context.chartSymbol,
      stockName: context.stockName,
      records: context.chartRecords,
      moneyFlowRecords: context.moneyFlowRecords,
      signalDates: context.signalDates,
      tradeMarkers: context.tradeMarkers,
      prevStock: context.prevStock,
      nextStock: context.nextStock,
      hasPrev: context.hasPrev,
      hasNext: context.hasNext,
      watchlist: context.watchlist,
      currentIndex: context.currentIndex,
      strategyFrom: context.currentStrategy,
      presetFrom: context.currentPreset,
    }
  }

  if (tabId === 'admin') {
    return {
      currentUser: context.user,
    }
  }

  if (tabId === 'user-profile') {
    return {
      user: context.user,
    }
  }

  if (tabId === 'etf') {
    return {
      pendingNavigation: context.pendingEtfNavigation,
    }
  }

  if (tabId === 'spectrum') {
    return {
      defaultMode: 'daily',
      lockedMode: true,
      title: '市场阴阳谱',
    }
  }

  if (tabId === 'realtime-spectrum') {
    return {
      defaultMode: 'minute',
      lockedMode: true,
      title: '实时阴阳谱',
    }
  }

  return {}
}

export function getTabListeners(tabId, handlers) {
  if (tabId === 'watchlist') {
    return {
      'select-chart': handlers.selectStockForChart,
      'open-etf-analysis': handlers.openEtfAnalysis,
    }
  }

  if (tabId === 'chart') {
    return {
      'go-back': handlers.goBackToStrategyPool,
      'load-more': handlers.handleLoadMore,
    }
  }

  if (tabId === 'ranking' || tabId === 'strategy-pool') {
    return {
      'view-chart': handlers.selectStockForChart,
    }
  }

  return {}
}