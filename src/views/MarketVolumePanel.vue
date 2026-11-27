<template>
  <v-container fluid class="market-volume-panel pa-4">
    <div class="mv-paper">
      <div class="mv-head">
        <div class="mv-head-main">
          <h1 class="mv-h1">🌊 量能水位</h1>
          <p class="mv-sub">
            成交额相对自身 20 日均线的水位 · 股票五板块互斥 · ETF 单列（Tushare T-1，无盘中数据）
          </p>
        </div>
        <div class="mv-head-actions">
          <span class="mv-range-label">日频区间</span>
          <div class="range-toggle">
            <button
              v-for="opt in rangeOptions"
              :key="opt.days"
              type="button"
              class="range-btn"
              :class="{ active: days === opt.days }"
              @click="setDays(opt.days)"
            >
              {{ opt.label }}
            </button>
          </div>
          <button type="button" class="mv-btn" :disabled="loading" @click="refreshAll">
            {{ loading ? '刷新中…' : '↻ 刷新' }}
          </button>
        </div>
      </div>

      <div v-if="errorMsg" class="mv-error">
        {{ errorMsg }}
        <button type="button" class="mv-error-x" aria-label="关闭" @click="errorMsg = ''">×</button>
      </div>

      <!-- 实时水位 -->
      <section class="mv-hero">
        <div class="mv-hero-figure">
          <span class="mv-label">{{ heroLabel }}</span>
          <span class="mv-hero-num">
            {{ intraday?.projected?.ratio == null ? '—' : intraday.projected.ratio.toFixed(2) }}
            <small>×</small>
          </span>
          <span class="mv-hero-note">{{ heroNote }}</span>
        </div>
        <div class="mv-hero-side">
          <dl class="mv-facts">
            <div v-for="fact in facts" :key="fact.label" class="mv-fact">
              <dt>{{ fact.label }}</dt>
              <dd>{{ fact.value }}<small v-if="fact.unit">{{ fact.unit }}</small></dd>
            </div>
          </dl>
          <div class="mv-gauge" aria-label="量能水位尺">
            <div class="mv-gauge-track">
              <div class="mv-gauge-fill" :style="{ width: gaugePos + '%' }"></div>
              <div class="mv-gauge-ref" :style="{ left: refPos + '%' }"></div>
            </div>
            <div class="mv-gauge-ticks">
              <span v-for="tick in gaugeTicks" :key="tick" :style="{ left: tick.pos + '%' }">{{ tick.label }}</span>
            </div>
          </div>
          <p v-if="sessionNote" class="mv-session-note">{{ sessionNote }}</p>
        </div>
      </section>

      <!-- 板块水位 -->
      <section class="mv-section">
        <div class="mv-sec-head">
          <h2>板块水位</h2>
          <p class="mv-caption">同一时点下的量能倍数，按全市场日内曲线折算；板块自身的日内曲线需另起积累。</p>
        </div>
        <div v-if="!intraday?.boards?.length" class="mv-empty">{{ boardsEmptyNote }}</div>
        <div v-else class="mv-brows">
          <div v-for="row in intraday.boards" :key="row.key" class="mv-brow">
            <span class="mv-bname">{{ row.name }}</span>
            <div class="mv-btrack">
              <div
                class="mv-bfill"
                :style="barStyle(row.ratio)"
              ></div>
              <div class="mv-bref" :style="{ left: refPos + '%' }"></div>
            </div>
            <span class="mv-bval">{{ row.ratio == null ? '—' : row.ratio.toFixed(2) + '×' }}</span>
            <span class="mv-bamt">{{ fmtYi(row.cum) }}</span>
          </div>
        </div>
      </section>

      <!-- 今日盘中推进 -->
      <section class="mv-section">
        <div class="mv-sec-head">
          <h2>{{ intradayTitle }}</h2>
          <p class="mv-caption">
            当日累计成交额，对比「若全天等于 MA20 应在的位置」；灰带是历史同时点的 P10–P90。
          </p>
          <div v-if="availableDates.length" class="mv-session-pick">
            <label for="mv-session-date">交易日</label>
            <select id="mv-session-date" v-model="sessionDate" @change="onSessionChange">
              <option v-for="d in availableDates" :key="d" :value="d">{{ fmtShortDate(d) }}</option>
            </select>
          </div>
        </div>
        <div class="mv-legend">
          <span><i class="mv-ln mv-ink"></i>{{ liveNow ? '今日累计' : '当日累计' }}</span>
          <span><i class="mv-ln mv-muted"></i>中位预期（若全天 = MA20）</span>
          <span><i class="mv-sq mv-band"></i>同时点 P10–P90</span>
        </div>
        <div v-show="hasIntraday" ref="intradayRef" class="mv-chart mv-chart-lg"></div>
        <div v-if="!hasIntraday" class="mv-empty">暂无盘中数据。</div>
      </section>

      <!-- 历史同类 -->
      <section class="mv-section">
        <div class="mv-sec-head">
          <h2>历史同类</h2>
          <p class="mv-caption">
            放量之后 20 个交易日的表现，2010 年至今。「独立段」= 连续放量合并后的段数，比次数更接近真实样本量。
          </p>
          <div class="mv-index-toggle">
            <button
              v-for="item in outlookIndices"
              :key="item.key"
              type="button"
              class="range-btn"
              :class="{ active: outlookIndex === item.key }"
              @click="setOutlookIndex(item.key)"
            >
              {{ item.name }}
            </button>
          </div>
        </div>

        <div v-if="!outlook" class="mv-empty">{{ outlookLoading ? '历史统计计算中…' : '暂无历史统计。' }}</div>
        <template v-else>
          <p class="mv-outlook-current">
            当前 <b>{{ fmtRatio(outlook.current?.ratio) }}</b> 放量 · 距近一年高点
            <b>{{ fmtPct(outlook.current?.drawdown == null ? null : outlook.current.drawdown * 100) }}</b>
            <span class="mv-outlook-meta">样本截至 {{ fmtDate(outlook.as_of) }}，基准（全样本 20 日均值）{{ fmtPct(outlook.baseline?.mean, 2) }}</span>
          </p>

          <div class="mv-table-wrap">
            <table class="mv-table">
              <caption>放量档（不加任何条件）</caption>
              <thead>
                <tr><th>阈值</th><th>次数</th><th>独立段</th><th>20日均值</th><th>胜率</th><th>相对基准</th></tr>
              </thead>
              <tbody>
                <tr v-for="row in outlook.ratio_ladder || []" :key="'r' + row.threshold">
                  <td>&gt;{{ row.threshold.toFixed(1) }}×</td>
                  <td>{{ row.n }}</td>
                  <td>{{ row.episodes }}</td>
                  <td>{{ fmtPct(row.mean, 2) }}</td>
                  <td>{{ row.win_rate == null ? '—' : row.win_rate.toFixed(1) + '%' }}</td>
                  <td>{{ row.excess == null ? '—' : (row.excess > 0 ? '+' : '') + row.excess.toFixed(2) + 'pp' }}</td>
                </tr>
              </tbody>
            </table>

            <table v-if="(outlook.drawdown_ladder || []).length" class="mv-table">
              <caption>再叠加「当前回撤深度」条件</caption>
              <thead>
                <tr><th>回撤</th><th>次数</th><th>独立段</th><th>20日均值</th><th>胜率</th><th>90% 区间</th><th>2018 年后</th></tr>
              </thead>
              <tbody>
                <tr v-for="row in outlook.drawdown_ladder" :key="'d' + row.threshold">
                  <td>&gt;{{ Math.abs(row.threshold * 100).toFixed(0) }}%</td>
                  <td>{{ row.n }}</td>
                  <td>{{ row.episodes }}</td>
                  <td>{{ fmtPct(row.mean, 2) }}</td>
                  <td>{{ row.win_rate == null ? '—' : row.win_rate.toFixed(1) + '%' }}</td>
                  <td>{{ row.bootstrap_ci ? `[${row.bootstrap_ci[0].toFixed(1)}, ${row.bootstrap_ci[1].toFixed(1)}]pp` : '—' }}</td>
                  <td :class="{ 'mv-thin': (row.post2018?.n ?? 0) < 20 }">
                    {{ row.post2018 ? `${row.post2018.n} 次` : '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p class="mv-warn">
            ⚠ 深回撤档的证据集中在 2012 / 2015–2016 / 2018 几段熊市底部，最近几年几乎没有可比样本。
            行内「2018 年后」样本数低于 20 的，不要当成概率使用。
          </p>
        </template>
      </section>

      <!-- 日频构成 -->
      <section class="mv-section">
        <div class="mv-sec-head">
          <h2>日频成交额构成 <span v-if="dailyAsOf" class="mv-asof">截至 {{ dailyAsOf }}</span></h2>
          <p class="mv-caption">五板块互斥堆叠，收盘口径。今日盘中不在其中。</p>
        </div>
        <div class="mv-legend">
          <span v-for="b in boards" :key="b.key"><i class="mv-sq" :style="{ background: color(b.key) }"></i>{{ b.name }}</span>
          <span><i class="mv-ln mv-muted"></i>20 日均线</span>
        </div>
        <div v-show="hasDaily" ref="dailyRef" class="mv-chart mv-chart-md"></div>
        <div v-if="!hasDaily" class="mv-empty">暂无日频数据。</div>
      </section>

      <!-- 分板块倍数 -->
      <section class="mv-section">
        <div class="mv-sec-head">
          <h2>量能倍数分板块 <span v-if="dailyAsOf" class="mv-asof">截至 {{ dailyAsOf }}</span></h2>
          <p class="mv-caption">每个板块除以自身 20 日均线；灰线为全市场，作对照。</p>
        </div>
        <div class="mv-legend">
          <span><i class="mv-ln mv-muted"></i>灰线 = 全市场，彩色 = 该板块自身</span>
        </div>
        <div class="mv-grid">
          <div v-for="(b, i) in boards" :key="b.key" class="mv-cell">
            <div class="mv-cell-head">
              <span class="mv-cell-name"><i :style="{ background: color(b.key) }"></i>{{ b.name }}</span>
              <span class="mv-cell-val">{{ latestRatio(b.key) }}</span>
            </div>
            <div :ref="(el) => setBoardEl(i, el)" class="mv-cell-chart"></div>
          </div>
        </div>
      </section>

      <!-- ETF -->
      <section class="mv-section">
        <div class="mv-sec-head">
          <h2>ETF 单独成列 <span v-if="dailyAsOf" class="mv-asof">截至 {{ dailyAsOf }}</span></h2>
          <p class="mv-caption">
            按基金类型拆分，Tushare 日频（T-1）。股票型约占股票成交额 16%，债券型的波动比股票型更大 —— 混进股票口径会带偏放量判断。
          </p>
        </div>
        <div class="mv-legend">
          <span><i class="mv-sq" :style="{ background: etfColor.equity }"></i>股票型</span>
          <span><i class="mv-sq" :style="{ background: etfColor.bond }"></i>债券型</span>
          <span><i class="mv-sq" :style="{ background: etfColor.money }"></i>货币型</span>
        </div>
        <div v-show="hasDaily" ref="etfRef" class="mv-chart mv-chart-sm"></div>
        <div v-if="!hasDaily" class="mv-empty">暂无 ETF 数据。</div>
      </section>

      <p class="mv-foot">
        口径：成交额由 <code>volume_price</code> 逐股聚合（千元 → 亿元）；沪市 = 沪市主板 + 科创板，深市 = 深市主板 + 创业板，五段互斥不重复加总；不含 ETF / LOF / 债券 / 可转债。
        盘中曲线取自 <code>volume_price_realtime_latest</code>，每 2 分钟一条；历史同时点分布来自申万一级行业汇总（与该日收盘值逐位一致）。
      </p>
    </div>
  </v-container>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  getMarketTurnover,
  getMarketTurnoverIntraday,
  getMarketTurnoverOutlook,
} from '../api/marketStats.js'
import { loadEcharts } from '../utils/echarts/loadEcharts.js'

const rangeOptions = [
  { label: '3月', days: 60 },
  { label: '6月', days: 120 },
  { label: '1年', days: 250 },
  { label: '3年', days: 750 },
]

const BOARDS = [
  { key: 'sh', name: '沪市主板' },
  { key: 'sz', name: '深市主板' },
  { key: 'cx', name: '创业板' },
  { key: 'star', name: '科创板' },
  { key: 'bse', name: '北交所' },
]

const COLORS = {
  sh: '#2a78d6',
  sz: '#eb6834',
  cx: '#1baf7a',
  star: '#eda100',
  bse: '#e87ba4',
  total: '#1f2937',
  muted: '#98a2b3',
  band: '#dcdbd3',
  grid: '#edf1f7',
  rule: '#c8d2e2',
}

const ETF_COLORS = { equity: '#6250d6', bond: '#e34948', money: '#008300' }

const days = ref(120)
const sessionDate = ref('')
const outlook = ref(null)
const outlookIndex = ref('csi1000')
const outlookLoading = ref(false)
const loading = ref(false)
const errorMsg = ref('')
const daily = ref(null)
const intraday = ref(null)

const boards = BOARDS
const etfColor = ETF_COLORS
const color = (key) => COLORS[key] || COLORS.muted

const intradayRef = ref(null)
const dailyRef = ref(null)
const etfRef = ref(null)
const boardEls = []
let boardCharts = []
let intradayChart = null
let dailyChart = null
let etfChart = null
const observers = []
let pollTimer = null
let echartsMod = null

const rows = computed(() => daily.value?.rows || [])
const hasDaily = computed(() => rows.value.length > 0)
const hasIntraday = computed(() => (intraday.value?.cumulative || []).length > 0)

function fmtYi(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 0 })} 亿`
}

function fmtDate(value) {
  if (!value || value.length !== 8) return value || ''
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
}

function fmtRatio(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `${Number(value).toFixed(2)}×`
}

function fmtPct(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const num = Number(value)
  return `${num > 0 ? '+' : ''}${num.toFixed(digits)}%`
}

function fmtShortDate(value) {
  if (!value || value.length !== 8) return value || ''
  return `${value.slice(4, 6)}/${value.slice(6, 8)}`
}

function fmtNum(value, digits = 0) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

// 「实时」只在盘中成立；收盘后 is_final 为真，即便日期还是今天也按收盘口径标注。
const liveNow = computed(() => Boolean(intraday.value?.is_live) && !intraday.value?.is_final)

const heroLabel = computed(() => (liveNow.value ? '实时量能倍数' : '当日量能倍数'))

const isFinal = computed(() => Boolean(intraday.value?.is_final))

const availableDates = computed(() => intraday.value?.available_dates || [])
const outlookIndices = computed(() => outlook.value?.available_indices || [
  { key: 'csi1000', name: '中证1000' },
  { key: 'gem', name: '创业板指' },
  { key: 'hs300', name: '沪深300' },
])

const intradayTitle = computed(() => {
  const session = intraday.value?.session_date
  if (!session || intraday.value?.is_live) return '今日盘中推进'
  return `盘中推进 · ${session.slice(0, 4)}-${session.slice(4, 6)}-${session.slice(6, 8)}`
})

const boardsEmptyNote = computed(() => {
  if (!intraday.value?.session_date) return '暂无盘中数据：盘中聚合任务部署后开始积累（每 2 分钟一条）。'
  const session = intraday.value.session_date
  const newest = availableDates.value[0]
  if (session !== newest) {
    return '该交易日只有全市场合计。分板块的逐帧数据从部署日起才开始采集，历史日补不回来（申万行业汇总无法映射回板块）。'
  }
  return '分板块盘中数据尚未积累（部署后每 2 分钟一条）；上方曲线来自全市场合计。'
})

const isLatestSession = computed(() => {
  const newest = availableDates.value[0]
  return !sessionDate.value || !newest || sessionDate.value === newest
})

const heroNote = computed(() => {
  const projected = intraday.value?.projected
  const baseline = intraday.value?.baseline
  if (!projected?.total || !baseline?.ma20) return '盘中聚合任务尚未产出数据'
  const dayWord = isFinal.value ? '全天合计' : '全天预估'
  return `${dayWord} ${fmtNum(projected.total)} 亿，是 20 日均线 ${fmtNum(baseline.ma20)} 亿的 ${projected.ratio?.toFixed(2)} 倍`
})

const facts = computed(() => {
  const cumulative = intraday.value?.cumulative || []
  const last = cumulative[cumulative.length - 1]
  const baseline = intraday.value?.baseline
  const fraction = intraday.value?.projected?.fraction
  return [
    { label: liveNow.value ? '今日累计' : '当日累计', value: fmtNum(last?.total), unit: '亿' },
    { label: isFinal.value ? '全天合计' : '全天预估', value: fmtNum(intraday.value?.projected?.total), unit: '亿' },
    { label: '20 日均线', value: fmtNum(baseline?.ma20), unit: '亿' },
    { label: '同时点完成度', value: fraction == null ? '—' : (fraction * 100).toFixed(1), unit: '%' },
  ]
})

const GAUGE_LO = 0.6
const GAUGE_HI = 1.6
const gaugePos = computed(() => {
  const ratio = intraday.value?.projected?.ratio
  if (ratio == null) return 0
  return Math.max(0, Math.min(100, ((ratio - GAUGE_LO) / (GAUGE_HI - GAUGE_LO)) * 100))
})
const refPos = ((1 - GAUGE_LO) / (GAUGE_HI - GAUGE_LO)) * 100
const gaugeTicks = [0.8, 1.0, 1.2, 1.4].map((value) => ({
  label: `${value.toFixed(1)}×`,
  pos: ((value - GAUGE_LO) / (GAUGE_HI - GAUGE_LO)) * 100,
}))

function barStyle(ratio) {
  if (ratio == null) return { display: 'none' }
  const pos = (value) => ((value - GAUGE_LO) / (GAUGE_HI - GAUGE_LO)) * 100
  if (ratio >= 1) {
    return {
      left: `${refPos}%`,
      width: `${Math.max(pos(ratio) - refPos, 0.6)}%`,
      background: '#2a78d6',
    }
  }
  return {
    left: `${Math.max(pos(ratio), 0)}%`,
    width: `${Math.max(refPos - pos(ratio), 0.6)}%`,
    background: COLORS.muted,
  }
}

const dailyAsOf = computed(() => fmtShortDate(daily.value?.latest?.trade_date))

const sessionNote = computed(() => {
  if (!hasIntraday.value || !liveNow.value) return ''
  const last = intraday.value?.cumulative?.slice(-1)[0]
  if (!last) return ''
  const bucket = last.t
  if (bucket < '1000') return '早盘 10:00 前历史带宽很宽（同时点完成度 27%–38%），此处的倍数只能当区间看。'
  if (bucket < '1400') return '盘中完成度仍在爬升，倍数随行情推进收敛；14:00 后判断更稳。'
  return '已进入尾盘，同时点完成度 85% 以上，倍数可信度最高。'
})

const latestRatio = (key) => {
  const latest = daily.value?.latest
  if (!latest) return '—'
  const value = latest[`${key}_ratio`]
  return value == null ? '—' : `${value.toFixed(2)}×`
}

function setBoardEl(index, el) {
  boardEls[index] = el
}

async function ensureEcharts() {
  if (!echartsMod) echartsMod = await loadEcharts()
  return echartsMod
}

function attachResize(chart) {
  const observer = new ResizeObserver(() => chart.resize())
  observer.observe(chart.getDom())
  observers.push(observer)
}

const axisLabel = { color: '#667085', fontSize: 11 }
const splitLine = { lineStyle: { color: COLORS.grid } }

function renderIntraday() {
  const el = intradayRef.value
  if (!el || !echartsMod || !hasIntraday.value) return
  const data = intraday.value
  if (!intradayChart) {
    intradayChart = echartsMod.init(el, null, { renderer: 'canvas' })
    attachResize(intradayChart)
  }
  const xs = data.cumulative.map((point) => point.t)
  const profileSorted = [...(data.profile || [])].sort((a, b) => (a.t < b.t ? -1 : 1))
  // 快照落在奇数分钟、基准网格是偶数分钟，精确匹配会漏掉大半，必须取「不大于当前时点」的最后一格。
  const profileAt = (t) => {
    let found = null
    for (const entry of profileSorted) {
      if (entry.t <= t) found = entry
      else break
    }
    return found
  }
  const ma20 = data.baseline?.ma20 || 0
  const bandLow = xs.map((t) => (profileAt(t) ? profileAt(t).p10 * ma20 : null))
  const bandMid = xs.map((t) => (profileAt(t) ? profileAt(t).p50 * ma20 : null))
  const bandHigh = xs.map((t) => (profileAt(t) ? profileAt(t).p90 * ma20 : null))
  const bandWidth = bandLow.map((low, i) => (low == null ? null : bandHigh[i] - low))
  const today = data.cumulative.map((point) => point.total)
  const lastIndex = today.length - 1

  intradayChart.setOption(
    {
      animation: false,
      grid: { top: 24, left: 56, right: 24, bottom: 28 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: '#d9e1ee',
        textStyle: { color: '#172033', fontSize: 12 },
        formatter: (params) => {
          const i = params[0].dataIndex
          const time = `${xs[i].slice(0, 2)}:${xs[i].slice(2)}`
          let out = `<b>${time}</b>`
          if (today[i] != null) out += `<br/>今日累计 ${fmtYi(today[i])}`
          if (bandMid[i] != null) out += `<br/>中位预期 ${fmtYi(bandMid[i])}`
          if (bandLow[i] != null) out += `<br/>区间 ${fmtYi(bandLow[i])} – ${fmtYi(bandHigh[i])}`
          return out
        },
      },
      xAxis: {
        type: 'category',
        data: xs,
        boundaryGap: false,
        axisLine: { lineStyle: { color: COLORS.rule } },
        axisTick: { show: false },
        axisLabel: { ...axisLabel, interval: 29, formatter: (v) => `${v.slice(0, 2)}:${v.slice(2)}` },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine,
        axisLabel: { ...axisLabel, formatter: (v) => `${fmtNum(v / 1000)}k` },
      },
      series: [
        { name: 'p10', type: 'line', data: bandLow, stack: 'band', symbol: 'none', lineStyle: { width: 0 }, areaStyle: { color: 'transparent' }, silent: true, z: 1 },
        { name: 'P10–P90', type: 'line', data: bandWidth, stack: 'band', symbol: 'none', lineStyle: { width: 0 }, areaStyle: { color: COLORS.band }, silent: true, z: 1 },
        { name: '中位预期', type: 'line', data: bandMid, symbol: 'none', lineStyle: { width: 1.2, color: COLORS.muted }, z: 2 },
        {
          name: '今日累计',
          type: 'line',
          data: today,
          symbol: 'none',
          z: 3,
          lineStyle: { width: 2.4, color: COLORS.total },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: 'rgba(31,41,55,0.14)' }, { offset: 1, color: 'rgba(31,41,55,0.01)' }],
            },
          },
          markPoint:
            lastIndex >= 0 && today[lastIndex] != null
              ? {
                  symbol: 'circle',
                  symbolSize: 7,
                  itemStyle: { color: COLORS.total },
                  label: { show: true, position: 'left', distance: 8, color: '#172033', fontSize: 11, fontWeight: 600, formatter: `${fmtNum(today[lastIndex])} 亿` },
                  data: [{ coord: [lastIndex, today[lastIndex]] }],
                }
              : undefined,
        },
      ],
    },
    true
  )
}

function renderDaily() {
  const el = dailyRef.value
  if (!el || !echartsMod || !hasDaily.value) return
  if (!dailyChart) {
    dailyChart = echartsMod.init(el, null, { renderer: 'canvas' })
    attachResize(dailyChart)
  }
  const data = rows.value
  const xs = data.map((row) => row.trade_date)
  const series = BOARDS.map((board) => ({
    name: board.name,
    type: 'bar',
    stack: 'amount',
    barMaxWidth: 14,
    data: data.map((row) => row[board.key] ?? null),
    itemStyle: { color: COLORS[board.key], borderColor: '#ffffff', borderWidth: 1 },
  }))
  series.push({
    name: '20 日均线',
    type: 'line',
    data: data.map((row) => row.stock_total_ma20 ?? null),
    symbol: 'none',
    z: 5,
    lineStyle: { width: 1.5, color: COLORS.muted },
  })

  dailyChart.setOption(
    {
      animation: false,
      grid: { top: 20, left: 56, right: 24, bottom: 28 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: '#d9e1ee',
        textStyle: { color: '#172033', fontSize: 12 },
        valueFormatter: (value) => (value == null ? '—' : fmtYi(value)),
      },
      xAxis: {
        type: 'category',
        data: xs,
        axisLine: { lineStyle: { color: COLORS.rule } },
        axisTick: { show: false },
        axisLabel: {
          ...axisLabel,
          interval: Math.max(Math.floor(xs.length / 6), 0),
          showMaxLabel: true,
          showMinLabel: true,
          formatter: fmtShortDate,
        },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine,
        axisLabel: { ...axisLabel, formatter: (v) => `${fmtNum(v / 1000)}k` },
      },
      series,
    },
    true
  )
}

function renderEtf() {
  const el = etfRef.value
  if (!el || !echartsMod || !hasDaily.value) return
  if (!etfChart) {
    etfChart = echartsMod.init(el, null, { renderer: 'canvas' })
    attachResize(etfChart)
  }
  const data = rows.value
  const xs = data.map((row) => row.trade_date)
  const mk = (name, key, colorValue) => ({
    name,
    type: 'bar',
    stack: 'etf',
    barMaxWidth: 14,
    data: data.map((row) => row[`etf_${key}`] ?? null),
    itemStyle: { color: colorValue, borderColor: '#ffffff', borderWidth: 1 },
  })
  etfChart.setOption(
    {
      animation: false,
      grid: { top: 20, left: 56, right: 24, bottom: 28 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: '#d9e1ee',
        textStyle: { color: '#172033', fontSize: 12 },
        valueFormatter: (value) => (value == null ? '—' : fmtYi(value)),
      },
      xAxis: {
        type: 'category',
        data: xs,
        axisLine: { lineStyle: { color: COLORS.rule } },
        axisTick: { show: false },
        axisLabel: {
          ...axisLabel,
          interval: Math.max(Math.floor(xs.length / 6), 0),
          showMaxLabel: true,
          showMinLabel: true,
          formatter: fmtShortDate,
        },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine,
        axisLabel: { ...axisLabel, formatter: (v) => `${fmtNum(v)}亿` },
      },
      series: [
        mk('股票型', 'equity', ETF_COLORS.equity),
        mk('债券型', 'bond', ETF_COLORS.bond),
        mk('货币型', 'money', ETF_COLORS.money),
      ],
    },
    true
  )
}

function renderBoardCharts() {
  if (!echartsMod || !hasDaily.value) return
  const data = rows.value
  const xs = data.map((row) => row.trade_date)
  const market = data.map((row) => row.stock_total_ratio ?? null)
  BOARDS.forEach((board, index) => {
    const el = boardEls[index]
    if (!el) return
    if (!boardCharts[index]) {
      boardCharts[index] = echartsMod.init(el, null, { renderer: 'canvas' })
      attachResize(boardCharts[index])
    }
    const chart = boardCharts[index]
    chart.setOption(
      {
        animation: false,
        grid: { top: 8, left: 34, right: 10, bottom: 18 },
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#ffffff',
          borderColor: '#d9e1ee',
          textStyle: { color: '#172033', fontSize: 11 },
          formatter: (params) =>
            `<b>${fmtDate(params[0].axisValue)}</b>` +
            params
              .map((p) => `<br/>${p.marker}${p.seriesName} ${p.value == null ? '—' : Number(p.value).toFixed(2) + '×'}`)
              .join(''),
        },
        xAxis: {
          type: 'category',
          data: xs,
          boundaryGap: false,
          axisLine: { lineStyle: { color: COLORS.rule } },
          axisTick: { show: false },
          axisLabel: { ...axisLabel, fontSize: 9, interval: Math.max(Math.floor(xs.length / 3), 0), formatter: fmtShortDate },
        },
        yAxis: {
          type: 'value',
          min: 0.5,
          max: 1.9,
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine,
          axisLabel: { ...axisLabel, fontSize: 9, interval: 0 },
        },
        series: [
          { name: '全市场', type: 'line', data: market, symbol: 'none', silent: true, lineStyle: { width: 1, color: COLORS.muted, opacity: 0.6 } },
          {
            name: board.name,
            type: 'line',
            data: data.map((row) => row[`${board.key}_ratio`] ?? null),
            symbol: 'none',
            lineStyle: { width: 1.8, color: COLORS[board.key] },
            markLine: {
              symbol: 'none',
              silent: true,
              label: { show: false },
              lineStyle: { color: COLORS.muted, width: 1, opacity: 0.6 },
              data: [{ yAxis: 1 }],
            },
          },
        ],
      },
      true
    )
  })
}

function renderAll() {
  if (!echartsMod) return
  renderIntraday()
  renderDaily()
  renderEtf()
  renderBoardCharts()
}

async function loadDaily() {
  try {
    daily.value = await getMarketTurnover({ days: days.value, window: 20 })
  } catch (err) {
    errorMsg.value = `日频数据加载失败：${err.message || err}`
  }
}

async function loadIntraday() {
  try {
    const data = await getMarketTurnoverIntraday({
      days: 60,
      window: 20,
      date: sessionDate.value || undefined,
    })
    intraday.value = data
    if (data?.session_date && !sessionDate.value) sessionDate.value = data.session_date
  } catch (err) {
    errorMsg.value = `盘中数据加载失败：${err.message || err}`
  }
}

async function loadOutlook() {
  outlookLoading.value = true
  try {
    outlook.value = await getMarketTurnoverOutlook({ index: outlookIndex.value })
  } catch (err) {
    errorMsg.value = `历史同类加载失败：${err.message || err}`
  } finally {
    outlookLoading.value = false
  }
}

async function setOutlookIndex(key) {
  if (outlookIndex.value === key) return
  outlookIndex.value = key
  await loadOutlook()
}

async function onSessionChange() {
  await loadIntraday()
  renderIntraday()
}

async function refreshAll() {
  loading.value = true
  errorMsg.value = ''
  await Promise.all([loadDaily(), loadIntraday(), loadOutlook()])
  await ensureEcharts()
  renderAll()
  loading.value = false
}

function setDays(value) {
  if (days.value === value) return
  days.value = value
}

function inTradingSession() {
  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes()
  return minutes >= 9 * 60 + 25 && minutes <= 15 * 60 + 5
}

onMounted(async () => {
  await ensureEcharts()
  await refreshAll()
  // 盘中每 2 分钟拉一次；收盘后与后台标签页不轮询。
  pollTimer = setInterval(() => {
    if (document.visibilityState !== 'visible') return
    if (!inTradingSession()) return
    if (!isLatestSession.value) return
    loadIntraday().then(renderIntraday)
  }, 120000)
})

watch(days, async () => {
  await loadDaily()
  renderDaily()
  renderEtf()
  renderBoardCharts()
})

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
  observers.forEach((observer) => observer.disconnect())
  intradayChart?.dispose()
  dailyChart?.dispose()
  etfChart?.dispose()
  boardCharts.forEach((chart) => chart?.dispose())
})
</script>

<style scoped>
.market-volume-panel {
  padding: 0 !important;
  background: var(--surface-bg-muted);
}
.mv-paper {
  background: var(--surface-bg);
  color: #111111;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  padding: 20px 24px 24px;
}
.mv-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.mv-h1 {
  font-size: 1.35rem;
  font-weight: 700;
  margin: 0 0 4px;
}
.mv-sub,
.mv-caption {
  color: #667085;
  font-size: 13px;
  margin: 0;
}
.mv-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.mv-range-label {
  font-size: 12px;
  color: #98a2b3;
}
.mv-session-pick {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #667085;
}
.mv-session-pick select {
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  color: #344054;
  background: #fff;
}
.range-toggle {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.range-btn {
  border: 1px solid #d0d5dd;
  background: #fff;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  color: #344054;
}
.range-btn.active {
  background: #111;
  color: #fff;
  border-color: #111;
}
.mv-btn {
  border: 1px solid #d0d5dd;
  background: #fff;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 13px;
  cursor: pointer;
}
.mv-btn:disabled {
  opacity: 0.55;
  cursor: default;
}
.mv-error {
  background: #fef3f2;
  color: #b42318;
  border: 1px solid #fecdca;
  border-radius: 6px;
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}
.mv-error-x {
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
}

.mv-hero {
  display: grid;
  grid-template-columns: minmax(200px, 280px) 1fr;
  gap: 24px 40px;
  align-items: end;
  padding: 20px 0 8px;
}
.mv-hero-figure {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mv-label {
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #98a2b3;
}
.mv-hero-num {
  font-size: 56px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  color: #111111;
}
.mv-hero-num small {
  font-size: 20px;
  font-weight: 500;
  color: #667085;
  margin-left: 2px;
}
.mv-hero-note {
  font-size: 12px;
  color: #667085;
  margin-top: 4px;
}
.mv-hero-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.mv-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 28px;
  margin: 0;
}
.mv-fact {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 96px;
}
.mv-fact dt {
  font-size: 11px;
  color: #98a2b3;
}
.mv-fact dd {
  margin: 0;
  font-size: 19px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.mv-fact dd small {
  font-size: 12px;
  font-weight: 400;
  color: #98a2b3;
  margin-left: 2px;
}
.mv-gauge-track {
  position: relative;
  height: 6px;
  border-radius: 3px;
  background: #e4e7ec;
}
.mv-gauge-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  border-radius: 3px;
  background: #2a78d6;
}
.mv-gauge-ref {
  position: absolute;
  top: -5px;
  bottom: -5px;
  width: 1px;
  background: #98a2b3;
}
.mv-gauge-ticks {
  position: relative;
  height: 16px;
  margin-top: 5px;
}
.mv-gauge-ticks span {
  position: absolute;
  transform: translateX(-50%);
  font-size: 10px;
  color: #98a2b3;
}
.mv-session-note {
  margin: 0;
  font-size: 12px;
  color: #b54708;
}

.mv-section {
  padding: 24px 0 0;
  border-top: 1px solid #eaecf0;
  margin-top: 24px;
}
.mv-sec-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 14px;
  margin-bottom: 6px;
}
.mv-sec-head h2 {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
}
.mv-asof {
  font-size: 12px;
  font-weight: 400;
  color: #98a2b3;
  margin-left: 2px;
}
.mv-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 8px 0;
  font-size: 12px;
  color: #475467;
}
.mv-legend i {
  display: inline-block;
  margin-right: 6px;
  vertical-align: baseline;
}
.mv-sq {
  width: 9px;
  height: 9px;
  border-radius: 2px;
}
.mv-ln {
  width: 14px;
  height: 2px;
  border-radius: 1px;
}
.mv-muted {
  background: #98a2b3;
}
.mv-ink {
  background: #1f2937;
}
.mv-band {
  background: #dcdbd3;
}
.mv-chart {
  width: 100%;
}
.mv-chart-lg {
  height: 280px;
}
.mv-chart-md {
  height: 260px;
}
.mv-chart-sm {
  height: 220px;
}
.mv-empty {
  color: #98a2b3;
  font-size: 13px;
  padding: 24px 0;
}

.mv-brows {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mv-brow {
  display: grid;
  grid-template-columns: 76px 1fr 64px 84px;
  align-items: center;
  gap: 12px;
  padding: 7px 0;
  border-bottom: 1px solid #f2f4f7;
}
.mv-bname {
  font-size: 13px;
  color: #475467;
}
.mv-btrack {
  position: relative;
  height: 10px;
  background: #f2f4f7;
  border-radius: 2px;
}
.mv-bfill {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 2px;
}
.mv-bref {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 1px;
  background: #98a2b3;
}
.mv-bval {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.mv-bamt {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: #98a2b3;
  text-align: right;
}

.mv-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1px;
  background: #eaecf0;
  border: 1px solid #eaecf0;
  border-radius: 6px;
  overflow: hidden;
}
.mv-cell {
  background: var(--surface-bg);
  padding: 10px 12px 4px;
  min-width: 0;
}
.mv-cell-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 2px;
}
.mv-cell-name {
  font-size: 12.5px;
  color: #475467;
  display: flex;
  align-items: center;
  gap: 6px;
}
.mv-cell-name i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  display: inline-block;
}
.mv-cell-val {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.mv-cell-chart {
  height: 112px;
}

.mv-index-toggle {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.mv-outlook-current {
  margin: 6px 0 10px;
  font-size: 13px;
  color: #475467;
}
.mv-outlook-current b {
  color: #111;
  font-variant-numeric: tabular-nums;
}
.mv-outlook-meta {
  margin-left: 10px;
  color: #98a2b3;
  font-size: 12px;
}
.mv-table-wrap {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}
.mv-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}
.mv-table caption {
  text-align: left;
  color: #667085;
  font-size: 12px;
  padding-bottom: 4px;
}
.mv-table th,
.mv-table td {
  padding: 5px 8px;
  border-bottom: 1px solid #f2f4f7;
  text-align: right;
  white-space: nowrap;
}
.mv-table th:first-child,
.mv-table td:first-child {
  text-align: left;
}
.mv-table th {
  color: #98a2b3;
  font-weight: 500;
}
.mv-thin {
  color: #b54708;
}
.mv-warn {
  margin: 10px 0 0;
  padding: 8px 12px;
  background: #fffaeb;
  border: 1px solid #fec84b;
  border-radius: 6px;
  color: #b54708;
  font-size: 12px;
  line-height: 1.6;
}
.mv-foot {
  margin: 28px 0 0;
  padding-top: 16px;
  border-top: 1px solid #eaecf0;
  color: #98a2b3;
  font-size: 11.5px;
  line-height: 1.7;
}
.mv-foot code {
  background: #f2f4f7;
  padding: 1px 4px;
  border-radius: 3px;
}

@media (max-width: 1100px) {
  .mv-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 900px) {
  .mv-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 720px) {
  .mv-hero {
    grid-template-columns: 1fr;
  }
  .mv-grid {
    grid-template-columns: 1fr;
  }
  .mv-brow {
    grid-template-columns: 66px 1fr 60px;
  }
  .mv-bamt {
    display: none;
  }
}
</style>
