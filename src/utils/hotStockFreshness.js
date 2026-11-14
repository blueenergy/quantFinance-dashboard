/**
 * 热股分析的数据新鲜度判定。
 *
 * 判定基准是「页面正在展示的分析」与「库里最新的原始热榜快照」，
 * 不是墙上时钟：热榜每个交易日只在 22:50 同步一次，所以「距上次获取
 * 超过 60 分钟」是全天常态，用它判断新鲜度会天天误报。
 */

/** YYYYMMDD → Date；非法输入返回 null。 */
function parseTradeDate(value) {
  const s = String(value || '')
  if (!/^\d{8}$/.test(s)) return null
  const d = new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)))
  return Number.isNaN(d.getTime()) ? null : d
}

/** 两个 YYYYMMDD 之间的自然日数（newer - older），缺一为 0。 */
export function daysBetween(older, newer) {
  const a = parseTradeDate(older)
  const b = parseTradeDate(newer)
  if (!a || !b) return 0
  const diff = b - a
  return Math.max(0, Math.round(diff / 86400000))
}

/**
 * @param {object|null} dataStatus   GET /hot-stock/data-status 的 data 段
 * @param {object|null} shown        当前展示的分析（页面 state）
 * @param {object} opts
 * @param {string} opts.shownRankTime  展示的分析所依据的 rank_time
 * @param {string} opts.shownTradeDate 展示的分析的交易日 YYYYMMDD
 * @param {boolean} opts.viewingOldRecord 用户主动点开了历史记录
 * @returns {null | {type: string, badge: string, text: string}}
 *   type 对应 v-alert 的 success / warning / info
 */
export function describeHotStockFreshness(dataStatus, shown, opts = {}) {
  const { shownRankTime = '', shownTradeDate = '', viewingOldRecord = false } = opts

  if (!dataStatus || !dataStatus.has_data) return null

  const rawRankTime = dataStatus.rank_time || ''
  const rawTradeDate = dataStatus.trade_date || ''
  const stockCount = dataStatus.stock_count || 0

  if (!shown) {
    return {
      type: 'info',
      badge: '待分析',
      text: `原始热榜已就绪（${rawTradeDate}，${stockCount} 只，${rawRankTime}），等待 23:05 自动生成分析。`,
    }
  }

  if (rawRankTime && shownRankTime && rawRankTime !== shownRankTime) {
    if (viewingOldRecord) {
      return {
        type: 'info',
        badge: '历史记录',
        text: `正在查看 ${shownRankTime} 的历史分析；最新热榜为 ${rawRankTime}。`,
      }
    }
    return {
      type: 'warning',
      badge: '结论已过时',
      text: `当前分析基于 ${shownRankTime} 的热榜，最新热榜已更新至 ${rawRankTime}，该结论不代表最新榜单。`,
    }
  }

  const behind = daysBetween(shownTradeDate, rawTradeDate)
  if (behind > 0) {
    return {
      type: 'warning',
      badge: '数据滞后',
      text: `当前分析为 ${shownTradeDate} 的数据，落后最新交易日 ${rawTradeDate} 共 ${behind} 天。`,
    }
  }

  return {
    type: 'success',
    badge: '数据最新',
    text: `分析基于最新热榜快照 ${rawRankTime}（${rawTradeDate}，${stockCount} 只）。`,
  }
}
