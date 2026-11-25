/**
 * 斐波那契回撤位：从一段「低点 → 高点」的主升浪，按标准回撤口径
 * （从高点往下量）输出 23.6 / 38.2 / 50 / 61.8 / 78.6 各档。
 *
 * 注意口径：通达信从低点往上画时标注的「23.6%」= 标准回撤的 76.4%；
 * 这里统一按标准回撤口径（ratio = 从高点回撤的比例）输出，避免误读。
 *
 * 锚点用 low / high（不是 close），与手工画线一致。
 */

/**
 * 23.6 / 38.2 / 50 / 61.8 是通用档位；
 * 最后一档用 76.4%（= 1 − 23.6%）而不是 78.6%，
 * 这样和通达信「从低点往上画 23.6%」落在同一条线上（示例：4380.41 → 2167.59）。
 */
export const FIB_RATIOS = [0.236, 0.382, 0.5, 0.618, 0.764]

/**
 * zigzag 反转阈值：用于自动识别「最近一轮主升浪」。
 * 取 35% 是为了把 2024-02 → 2026-06 这种跨年度大浪识别成一整段，
 * 而不是被中间 25–30% 的回撤切成小段（会被切成 2025-04 起算）。
 */
export const FIB_ZIGZAG_THRESHOLD = 0.35

/** 自动识别时要求的最小浪幅，避免把噪声段当成主升浪 */
export const FIB_MIN_AMPLITUDE = 0.15

function toNumber (value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function rowHigh (row) {
  return toNumber(row?.high) ?? toNumber(row?.close)
}

function rowLow (row) {
  return toNumber(row?.low) ?? toNumber(row?.close)
}

function rowDate (row) {
  return String(row?.trade_date ?? row?.date ?? '')
}

/** YYYYMMDD / YYYY-MM-DD → YYYYMMDD */
export function compactYmd (value) {
  return String(value || '').replace(/\D/g, '').slice(0, 8)
}

/** YYYYMMDD → YYYY-MM-DD（input[type=date] 用） */
export function toDateInput (value) {
  const s = compactYmd(value)
  if (s.length !== 8) return ''
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

/** YYYY-MM-DD → YYYY-MM-DD 展示（容错） */
export function formatAnchorDate (value) {
  const s = compactYmd(value)
  if (s.length !== 8) return String(value || '')
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

/**
 * 找「最近一轮主升浪」：低点在最前、高点在其后，且浪幅 ≥ minAmplitude。
 * 输入 rows 必须按时间升序。
 *
 * @returns {{startIndex:number,endIndex:number,low:number,high:number,startDate:string,endDate:string,amplitude:number}|null}
 */
export function findLastSwing (rows, {
  threshold = FIB_ZIGZAG_THRESHOLD,
  minAmplitude = FIB_MIN_AMPLITUDE,
} = {}) {
  if (!Array.isArray(rows) || rows.length < 2) return null

  const pivots = []
  let trend = 0
  let highIndex = 0
  let highValue = rowHigh(rows[0])
  let lowIndex = 0
  let lowValue = rowLow(rows[0])

  for (let i = 1; i < rows.length; i += 1) {
    const high = rowHigh(rows[i])
    const low = rowLow(rows[i])
    if (high == null || low == null) continue

    if (high > highValue) {
      highValue = high
      highIndex = i
    }
    if (low < lowValue) {
      lowValue = low
      lowIndex = i
    }

    if (trend >= 0 && low <= highValue * (1 - threshold)) {
      pivots.push({ type: 'peak', index: highIndex, value: highValue })
      trend = -1
      lowValue = low
      lowIndex = i
    } else if (trend <= 0 && high >= lowValue * (1 + threshold)) {
      pivots.push({ type: 'trough', index: lowIndex, value: lowValue })
      trend = 1
      highValue = high
      highIndex = i
    }
  }

  for (let k = pivots.length - 1; k >= 1; k -= 1) {
    const peak = pivots[k]
    const trough = pivots[k - 1]
    if (peak.type !== 'peak' || trough.type !== 'trough') continue
    const amplitude = peak.value / trough.value - 1
    if (amplitude < minAmplitude) continue
    return {
      startIndex: trough.index,
      endIndex: peak.index,
      low: trough.value,
      high: peak.value,
      startDate: rowDate(rows[trough.index]),
      endDate: rowDate(rows[peak.index]),
      amplitude,
    }
  }
  return null
}

/**
 * 标准回撤位：price = high - (high - low) × ratio。
 * 0% 与 100% 作为锚点一并返回，方便画基准线。
 */
export function buildFibLevels (low, high, ratios = FIB_RATIOS) {
  const l = toNumber(low)
  const h = toNumber(high)
  if (l == null || h == null || !(h > l)) return []
  const span = h - l
  return [
    { ratio: 0, price: h, isAnchor: true },
    ...ratios.map((ratio) => ({ ratio, price: h - span * ratio, isAnchor: false })),
    { ratio: 1, price: l, isAnchor: true },
  ]
}

/**
 * 把 levels 转成 ECharts markLine.data。
 * 三处 K 线（StockKLineChart / StockChart / KLineComparison）共用同一套样式。
 */
export function buildFibMarkLineData (levels, { digits = 2 } = {}) {
  return (Array.isArray(levels) ? levels : [])
    .map((level) => {
      const price = Number(level?.price)
      if (!Number.isFinite(price)) return null
      const ratio = Number(level?.ratio) || 0
      const anchor = Boolean(level?.isAnchor)
      return {
        yAxis: price,
        silent: true,
        label: {
          show: true,
          position: 'insideEndTop',
          formatter: `${(ratio * 100).toFixed(1)}%  ${price.toFixed(digits)}`,
          color: anchor ? '#94a3b8' : '#38bdf8',
          fontSize: 10,
        },
        lineStyle: {
          color: anchor ? '#94a3b8' : '#38bdf8',
          type: anchor ? 'solid' : 'dashed',
          width: 1,
          opacity: anchor ? 0.5 : 0.85,
        },
      }
    })
    .filter(Boolean)
}

/** 在 rows 中找离指定日期最近的交易日索引；找不到返回 -1 */
export function findNearestRowIndex (rows, dateStr) {
  const target = compactYmd(dateStr)
  if (target.length !== 8 || !Array.isArray(rows) || !rows.length) return -1
  let best = -1
  let bestDistance = Infinity
  for (let i = 0; i < rows.length; i += 1) {
    const current = compactYmd(rowDate(rows[i]))
    if (current.length !== 8) continue
    const distance = Math.abs(Number(current) - Number(target))
    if (distance < bestDistance) {
      bestDistance = distance
      best = i
    }
  }
  return best
}

/**
 * 生成叠加层数据：
 * - 两个日期都有效 → 在这段区间内取最低 low 与最高 high；
 * - 否则 → 自动识别最近一轮主升浪。
 *
 * @returns {{auto:boolean,startDate:string,endDate:string,low:number,high:number,levels:Array}|null}
 */
export function buildFibOverlay (rows, { startDate, endDate } = {}) {
  if (!Array.isArray(rows) || rows.length < 2) return null

  let startIndex = startDate ? findNearestRowIndex(rows, startDate) : -1
  let endIndex = endDate ? findNearestRowIndex(rows, endDate) : -1
  let auto = false

  if (startIndex < 0 || endIndex < 0 || startIndex >= endIndex) {
    const swing = findLastSwing(rows)
    if (swing) {
      startIndex = swing.startIndex
      endIndex = swing.endIndex
      auto = true
    } else {
      // 没有已确认的主升浪（例如一路上涨未回撤）→ 退化为「窗口最低 → 窗口最高」
      let peakIndex = 0
      let peakValue = rowHigh(rows[0]) ?? -Infinity
      for (let i = 1; i < rows.length; i += 1) {
        const h = rowHigh(rows[i])
        if (h != null && h > peakValue) {
          peakValue = h
          peakIndex = i
        }
      }
      let valleyIndex = 0
      let valleyValue = Infinity
      for (let i = 0; i <= peakIndex; i += 1) {
        const l = rowLow(rows[i])
        if (l != null && l < valleyValue) {
          valleyValue = l
          valleyIndex = i
        }
      }
      if (!Number.isFinite(valleyValue) || !(peakValue / valleyValue - 1 >= FIB_MIN_AMPLITUDE)) return null
      startIndex = valleyIndex
      endIndex = peakIndex
      auto = true
    }
  }

  let low = Infinity
  let high = -Infinity
  let lowIndex = startIndex
  let highIndex = startIndex
  for (let i = startIndex; i <= endIndex; i += 1) {
    const l = rowLow(rows[i])
    const h = rowHigh(rows[i])
    if (l != null && l < low) {
      low = l
      lowIndex = i
    }
    if (h != null && h > high) {
      high = h
      highIndex = i
    }
  }
  if (!Number.isFinite(low) || !Number.isFinite(high) || !(high > low)) return null

  return {
    auto,
    startDate: rowDate(rows[lowIndex]),
    endDate: rowDate(rows[highIndex]),
    low,
    high,
    levels: buildFibLevels(low, high),
  }
}
