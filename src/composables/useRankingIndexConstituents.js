import { ref } from 'vue'
import request from '../utils/request'

const INDEX_DEFINITIONS = {
  hs300: {
    path: '/index/hs300/constituents',
    fallback: [
      { symbol: '000001.SZ', name: '平安银行', industry: '银行', market_cap: 280000000000, weight: 0.85 },
      { symbol: '000002.SZ', name: '万科A', industry: '房地产开发', market_cap: 250000000000, weight: 0.78 },
    ],
  },
  a500: {
    path: '/index/a500/constituents',
    fallback: [
      { symbol: '600519.SH', name: '贵州茅台', industry: '白酒', market_cap: 2500000000000, weight: 2.50 },
      { symbol: '000333.SZ', name: '美的集团', industry: '家电', market_cap: 450000000000, weight: 1.20 },
    ],
  },
  csi500: {
    path: '/index/csi500/constituents',
    fallback: [
      { symbol: '000001.SZ', name: '平安银行', industry: '银行', market_cap: 280000000000, weight: 0.35 },
      { symbol: '600036.SH', name: '招商银行', industry: '银行', market_cap: 340000000000, weight: 0.40 },
      { symbol: '002415.SZ', name: '海康威视', industry: '电子', market_cap: 310000000000, weight: 0.45 },
    ],
  },
  csi1000: {
    path: '/index/csi1000/constituents',
    fallback: [
      { symbol: '300014.SZ', name: '亿纬锂能', industry: '电力设备', market_cap: 80000000000, weight: 0.32 },
      { symbol: '002304.SZ', name: '洋河股份', industry: '食品饮料', market_cap: 120000000000, weight: 0.28 },
      { symbol: '600887.SH', name: '伊利股份', industry: '食品饮料', market_cap: 150000000000, weight: 0.30 },
    ],
  },
  csi2000: {
    path: '/index/csi2000/constituents',
    fallback: [
      { symbol: '300014.SZ', name: '亿纬锂能', industry: '电力设备', market_cap: 80000000000, weight: 0.20 },
      { symbol: '002304.SZ', name: '洋河股份', industry: '食品饮料', market_cap: 120000000000, weight: 0.18 },
      { symbol: '603986.SH', name: '兆易创新', industry: '电子', market_cap: 90000000000, weight: 0.16 },
    ],
  },
  star50: {
    path: '/index/star50/constituents',
    fallback: [
      { symbol: '688001.SH', name: '华兴源创', industry: '半导体', market_cap: 45000000000, weight: 1.10 },
      { symbol: '688012.SH', name: '中微公司', industry: '半导体设备', market_cap: 120000000000, weight: 2.20 },
    ],
  },
}

export function useRankingIndexConstituents(options = {}) {
  const requestClient = options.requestClient || request
  const warn = options.warn || console.warn

  const hs300Stocks = ref([])
  const hs300Loading = ref(false)
  const a500Stocks = ref([])
  const a500Loading = ref(false)
  const csi500Stocks = ref([])
  const csi500Loading = ref(false)
  const csi1000Stocks = ref([])
  const csi1000Loading = ref(false)
  const csi2000Stocks = ref([])
  const csi2000Loading = ref(false)
  const star50Stocks = ref([])
  const star50Loading = ref(false)

  const indexStateMap = {
    hs300: { ...INDEX_DEFINITIONS.hs300, list: hs300Stocks, loading: hs300Loading },
    a500: { ...INDEX_DEFINITIONS.a500, list: a500Stocks, loading: a500Loading },
    csi500: { ...INDEX_DEFINITIONS.csi500, list: csi500Stocks, loading: csi500Loading },
    csi1000: { ...INDEX_DEFINITIONS.csi1000, list: csi1000Stocks, loading: csi1000Loading },
    csi2000: { ...INDEX_DEFINITIONS.csi2000, list: csi2000Stocks, loading: csi2000Loading },
    star50: { ...INDEX_DEFINITIONS.star50, list: star50Stocks, loading: star50Loading },
  }

  function getIndexSymbols(indexKey) {
    const state = indexStateMap[indexKey]
    return state ? state.list.value.map(stock => stock.symbol) : []
  }

  async function fetchIndexConstituents(indexKey) {
    const state = indexStateMap[indexKey]
    if (!state) throw new Error(`未知指数: ${indexKey}`)
    if (state.list.value.length > 0) return state.list.value

    state.loading.value = true
    try {
      const response = await requestClient({ method: 'get', url: state.path })
      const rows = Array.isArray(response?.data) ? response.data : null
      if (response?.success && rows?.length > 0) {
        state.list.value = rows
        return state.list.value
      }
      if (!response?.success || rows === null) throw new Error('API返回数据格式错误')
      warn(`获取 ${indexKey} 成分股返回空列表，使用本地 fallback`)
    } catch (error) {
      warn(`获取 ${indexKey} 成分股失败，使用本地数据:`, error.message)
    } finally {
      if (state.list.value.length === 0) state.list.value = [...state.fallback]
      state.loading.value = false
    }
    return state.list.value
  }

  return {
    indexStateMap,
    hs300Stocks,
    hs300Loading,
    a500Stocks,
    a500Loading,
    csi500Stocks,
    csi500Loading,
    csi1000Stocks,
    csi1000Loading,
    csi2000Stocks,
    csi2000Loading,
    star50Stocks,
    star50Loading,
    getIndexSymbols,
    fetchIndexConstituents,
  }
}
