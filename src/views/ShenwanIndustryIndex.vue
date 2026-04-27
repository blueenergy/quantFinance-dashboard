<template>
  <div class="shenwan-wrap">
    <div class="shenwan-layout">
      <aside class="shenwan-tree">
        <h3 class="panel-title">行业层级</h3>
        <div v-if="treeError" class="err-msg">{{ treeError }}</div>
        <div v-else-if="l1Loading" class="skeleton">加载 L1 行业…</div>
        <div v-else class="columns">
          <ul class="col" aria-label="一级行业 L1">
            <li
              v-for="it in l1List"
              :key="it.index_code"
              :class="{ active: selectedL1?.index_code === it.index_code }"
              @click="onPickL1(it)"
            >{{ it.name || it.index_code }}</li>
          </ul>
          <ul v-if="selectedL1" class="col" aria-label="二级行业 L2">
            <li v-if="l2Loading" class="muted">加载中…</li>
            <li
              v-for="it in l2List"
              v-else
              :key="it.index_code"
              :class="{ active: selectedL2?.index_code === it.index_code }"
              @click="onPickL2(it)"
            >{{ it.name || it.index_code }}</li>
            <li v-if="!l2Loading && l2List.length === 0" class="muted">无子级</li>
          </ul>
          <ul v-if="selectedL2" class="col" aria-label="三级行业 L3">
            <li v-if="l3Loading" class="muted">加载中…</li>
            <li
              v-for="it in l3List"
              v-else
              :key="it.index_code"
              :class="{ active: selectedL3?.index_code === it.index_code }"
              @click="onPickL3(it)"
            >{{ it.name || it.index_code }}</li>
            <li v-if="!l3Loading && l3List.length === 0" class="muted">无子级</li>
          </ul>
        </div>
        <p class="hint">数据来源：Tushare 申万 <code>SW2021</code>（可扩展版本）。</p>
      </aside>

      <section class="shenwan-main">
        <div class="meta">
          <div v-if="chartTitle" class="crumb">
            <span v-if="crumb1">{{ crumb1 }}</span>
            <span v-if="crumb2" class="sep">›</span>
            <span v-if="crumb2">{{ crumb2 }}</span>
            <span v-if="crumb3" class="sep">›</span>
            <span v-if="crumb3">{{ crumb3 }}</span>
          </div>
          <div v-if="activeCode" class="code-line">
            <code>{{ activeCode }}</code>
            <span v-if="activeName" class="name">{{ activeName }}</span>
          </div>
          <div v-else class="muted">请在左侧点选行业指数，下方将显示 K 线。</div>
        </div>

        <div class="toolbar">
          <div class="tf-btns">
            <button type="button" :class="{ on: tf === '1d' }" @click="tf = '1d'">日 K</button>
            <button type="button" :class="{ on: tf === '1w' }" @click="tf = '1w'">周 K</button>
            <button type="button" :class="{ on: tf === '1m' }" @click="tf = '1m'">月 K</button>
          </div>
          <div class="dates">
            <label>开始             <input v-model="startD" class="d-inp" type="date" /></label>
            <label>结束 <input v-model="endD" class="d-inp" type="date" /></label>
            <span class="muted sm">不填起止则由服务端拉足够长的日线后截断到最近 {{ klineLimit }} 根</span>
          </div>
        </div>

        <div
          v-if="klineData.length && !klineLoading"
          class="kline-info"
          :title="klineInfoTitle"
        >
          <span>最新 <strong class="d">{{ klineInfoDate }}</strong></span>
          <span v-if="klineInfoPct != null" :class="pctClass(klineInfoPct)">涨跌 {{ klineInfoPct > 0 ? '+' : '' }}{{ klineInfoPct.toFixed(2) }}%</span>
          <span v-if="klineInfoChg != null" :class="pctClass(klineInfoChg)">涨跌额 {{ klineInfoChg > 0 ? '+' : '' }}{{ formatNum2(klineInfoChg) }}</span>
          <span v-if="klineInfoFloat != null" title="流通市值（数据为万元，已换算显示）">流通 {{ formatMvWan(klineInfoFloat) }}</span>
          <span v-if="klineInfoTotal != null" title="总市值（数据为万元，已换算显示）">总市值 {{ formatMvWan(klineInfoTotal) }}</span>
        </div>

        <div class="chart-box" ref="chartBoxRef">
          <div v-if="klineLoading" class="overlay">加载 K 线…</div>
          <div v-else-if="klineError" class="overlay err">{{ klineError }}</div>
          <div v-else-if="klineMsg && !klineData.length" class="overlay hint">{{ klineMsg }}</div>
          <div
            v-show="klineData.length && !klineLoading"
            ref="chartElRef"
            class="chart-canvas"
          />
        </div>
        <p class="footer-hint">
          若分类或走势为空，请在服务器执行 <code>quant_data_engine</code> 的
          <code>run_sw_industry_backfill</code> 回补 <code>sw_index_classify</code> 与
          <code>sw_daily</code> 后再试。
        </p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import axios from 'axios'

const SRC = 'SW2021'
const klineLimit = 800

const l1List = ref([])
const l2List = ref([])
const l3List = ref([])
const l1Loading = ref(true)
const l2Loading = ref(false)
const l3Loading = ref(false)
const treeError = ref('')

const selectedL1 = ref(null)
const selectedL2 = ref(null)
const selectedL3 = ref(null)

const tf = ref('1d')
const startD = ref('')
const endD = ref('')
const klineData = ref([])
const klineLoading = ref(false)
const klineError = ref('')
const klineMsg = ref('')

const chartBoxRef = ref(null)
const chartElRef = ref(null)
let echarts = null
let chartInstance = null
let ro = null

const activeItem = computed(() => selectedL3.value || selectedL2.value || selectedL1.value)
const activeCode = computed(() => activeItem.value?.index_code || '')
const activeName = computed(() => activeItem.value?.name || '')

/**
 * 仅当用户已选到「可出 K 线的叶子」时非空，用于请求 /kline、避免在树内点击 L1/L2 时
 * 用中间层 index_code 反复发请求、又被下一次点击清掉（见 activeItem 仍含 L1/L2 的中间态）。
 * - 选了 L3 → 用 L3
 * - 选了 L2 且该支下 L3 已确认加载完且子列表为空 → 叶在 L2
 * - 仅 L1 且 L2 已确认无子级 → 叶在 L1
 */
const klineIndexCode = computed(() => {
  if (selectedL3.value) {
    return selectedL3.value.index_code || ''
  }
  if (
    selectedL2.value
    && !l3Loading.value
    && l3List.value.length === 0
  ) {
    return selectedL2.value.index_code || ''
  }
  if (
    selectedL1.value
    && !l2Loading.value
    && l2List.value.length === 0
    && !selectedL2.value
  ) {
    return selectedL1.value.index_code || ''
  }
  return ''
})

const crumb1 = computed(() => selectedL1.value?.name || selectedL1.value?.index_code || '')
const crumb2 = computed(() => (selectedL2.value ? (selectedL2.value.name || selectedL2.value.index_code) : ''))
const crumb3 = computed(() => (selectedL3.value ? (selectedL3.value.name || selectedL3.value.index_code) : ''))
const chartTitle = computed(() => activeCode.value)

/** 最新一根 K 线，用于图上方摘要（与 sw_daily 字段名一致：pct_change/change 为 % / 点；float_mv、total_mv 为万元，见 Tushare 文档） */
const lastKline = computed(() => {
  const arr = klineData.value
  if (!arr.length) return null
  return arr[arr.length - 1]
})
const klineInfoDate = computed(() => fmtAxis(lastKline.value?.trade_date) || '—')
const klineInfoPct = computed(() => toNumOrNull(lastKline.value?.pct_change))
const klineInfoChg = computed(() => toNumOrNull(lastKline.value?.change))
const klineInfoFloat = computed(() => toNumOrNull(lastKline.value?.float_mv))
const klineInfoTotal = computed(() => toNumOrNull(lastKline.value?.total_mv))
const klineInfoTitle = computed(
  () => '最新交易日行情摘要；鼠标悬停 K 线可查看每根 K 的成交量、成交额、涨跌幅与市值。'
)

function toNumOrNull (v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** 万元 → 万 / 亿 中文（与常见行情软件习惯一致） */
function formatMvWan (wan) {
  if (wan == null || !Number.isFinite(Number(wan))) return '—'
  const w = Number(wan)
  if (w >= 1e4) {
    return `${(w / 1e4).toFixed(2)} 亿`
  }
  if (w >= 1) {
    return `${w.toFixed(0)} 万`
  }
  return w.toFixed(2)
}

/** 成交额 Tushare 为千元，转为「亿元」展示 */
function formatAmountQianYuan (q) {
  if (q == null || !Number.isFinite(Number(q))) return '—'
  const yi = Number(q) / 1e5
  if (Math.abs(yi) >= 0.01) return `${yi.toFixed(2)} 亿`
  return `${(Number(q) / 1e2).toFixed(0)} 万`
}

function formatVolShow (v) {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  const x = Number(v)
  if (x >= 1e4) return `${(x / 1e4).toFixed(2)} 万手`
  return `${x.toFixed(0)} 手`
}

function formatNum2 (n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return Number(n).toFixed(2)
}

function pctClass (n) {
  if (n == null || !Number.isFinite(n)) return ''
  if (n > 0) return 'q-up'
  if (n < 0) return 'q-dn'
  return 'q-eq'
}

function ymdFromInput (s) {
  if (!s) return ''
  return String(s).replace(/-/g, '')
}

function fmtAxis (d) {
  if (!d) return ''
  const t = String(d)
  if (t.length === 8 && /^\d{8}$/.test(t)) return `${t.slice(0,4)}-${t.slice(4,6)}-${t.slice(6,8)}`
  if (t.includes('T')) return t.slice(0, 10)
  if (t.includes('-')) return t.slice(0, 10)
  return t
}

function disposeChart () {
  if (chartInstance) {
    try { chartInstance.dispose() } catch (e) { /* noop */ }
    chartInstance = null
  }
}

function ensureChart () {
  if (!echarts) return
  if (!chartElRef.value) return
  if (!chartInstance) {
    chartInstance = echarts.init(chartElRef.value, 'dark')
    if (ro == null && chartBoxRef.value && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => { if (chartInstance) chartInstance.resize() })
      ro.observe(chartBoxRef.value)
    }
  }
  return chartInstance
}

function barUpDnColor (o, c) {
  const open = Number(o) || 0
  const close = Number(c) || 0
  return close >= open ? '#b71c1c' : '#1b5e20'
}

async function drawCandles () {
  if (!klineData.value.length) {
    if (chartInstance) chartInstance.clear()
    return
  }
  // v-show 由隐藏切到显示时，同一微任务内 clientWidth 可能仍为 0
  await nextTick()
  await new Promise((r) => requestAnimationFrame(r))
  await new Promise((r) => requestAnimationFrame(r))
  if (!chartElRef.value) return
  if (chartElRef.value.clientWidth < 2 || chartElRef.value.clientHeight < 2) {
    await new Promise((res) => setTimeout(res, 50))
  }
  const c = ensureChart()
  if (!c) return
  const data = klineData.value
  const times = data.map((r) => fmtAxis(r.trade_date))
  const ohlc = data.map((r) => {
    const o = Number(r.open) || 0
    const cl = Number(r.close) || 0
    const l = Number(r.low) != null ? Number(r.low) : Math.min(o, cl)
    const h = Number(r.high) != null ? Number(r.high) : Math.max(o, cl)
    return [o, cl, l, h]
  })
  const pcts = data.map((r) => {
    const p = toNumOrNull(r.pct_change)
    return p == null || !Number.isFinite(p) ? null : p
  })
  const hasPct = pcts.some((p) => p != null)
  const vols = data.map((r) => toNumOrNull(r.vol))
  const hasVol = vols.some((v) => v != null)
  const amounts = data.map((r) => toNumOrNull(r.amount))
  const hasAmt = amounts.some((a) => a != null)
  const volData = hasVol
    ? vols.map((v, i) => {
        const d = data[i]
        return {
          value: v == null || !Number.isFinite(v) ? 0 : v,
          itemStyle: { color: barUpDnColor(d.open, d.close) }
        }
      })
    : []
  const amountData = hasAmt
    ? amounts.map((v) => (v == null || !Number.isFinite(v) ? 0 : v))
    : []

  const hasSub = hasVol || hasAmt
  /** 双副图：量+额；单副图：只显示有数据的那一个 */
  const subBoth = hasVol && hasAmt
  const xAxis0 = {
    type: 'category',
    data: times,
    scale: true,
    gridIndex: 0,
    axisLine: { lineStyle: { color: '#666' } }
  }
  const xAxisH = (gi) => ({
    type: 'category',
    data: times,
    gridIndex: gi,
    scale: true,
    axisLine: { show: false },
    axisLabel: { show: false },
    axisTick: { show: false },
    splitLine: { show: false }
  })
  // 有副图时：grid1=量（若有）、grid2=额或第二指标；单副时 bottom 的 x 轴在 grid1
  const xAxisSubBottom = (gi) => ({
    type: 'category',
    data: times,
    gridIndex: gi,
    scale: true,
    axisLine: { lineStyle: { color: '#666' } }
  })
  // 有副图：主图 + 成交量 + 成交额；无副图仅 K+可选涨跌幅线。无涨跌幅列时不挂空「涨跌%」Y 轴，副图 y 轴从 1 起编号。
  const buildGridsXAxesYAxes = () => {
    if (!hasSub) {
      return {
        grid: [{ left: 48, right: hasPct ? 56 : 20, top: 36, bottom: 56 }],
        xAxis: { type: 'category', data: times, axisLine: { lineStyle: { color: '#666' } } },
        yAxis: hasPct
          ? [
              { type: 'value', scale: true, splitLine: { lineStyle: { color: '#333' } } },
              { type: 'value', scale: true, name: '涨跌%', nameTextStyle: { color: '#888' }, position: 'right', splitLine: { show: false } }
            ]
          : { type: 'value', scale: true, splitLine: { lineStyle: { color: '#333' } } },
        xZoomIdx: [0]
      }
    }
    if (subBoth) {
      const yMain = hasPct
        ? [
            { type: 'value', scale: true, gridIndex: 0, splitLine: { lineStyle: { color: '#333' } } },
            { type: 'value', scale: true, name: '涨跌%', nameTextStyle: { color: '#888' }, position: 'right', gridIndex: 0, splitLine: { show: false } }
          ]
        : [{ type: 'value', scale: true, gridIndex: 0, splitLine: { lineStyle: { color: '#333' } } }]
      return {
        grid: [
          { left: 50, right: hasPct ? 56 : 20, top: 32, height: '48%' },
          { left: 50, right: 20, top: '60%', height: '14%' },
          { left: 50, right: 20, top: '76%', height: '12%' }
        ],
        xAxis: [xAxis0, xAxisH(1), xAxisSubBottom(2)],
        yAxis: [
          ...yMain,
          { type: 'value', name: '量(手)', nameTextStyle: { color: '#888' }, scale: true, gridIndex: 1, splitLine: { show: true, lineStyle: { color: '#2a2a2a' } } },
          { type: 'value', name: '额(亿)', nameTextStyle: { color: '#888' }, scale: true, gridIndex: 2, splitLine: { show: true, lineStyle: { color: '#2a2a2a' } } }
        ],
        xZoomIdx: [0, 1, 2]
      }
    }
    // 仅量或仅额：两格
    const yMainSingle = hasPct
      ? [
          { type: 'value', scale: true, gridIndex: 0, splitLine: { lineStyle: { color: '#333' } } },
          { type: 'value', scale: true, name: '涨跌%', nameTextStyle: { color: '#888' }, position: 'right', gridIndex: 0, splitLine: { show: false } }
        ]
      : [{ type: 'value', scale: true, gridIndex: 0, splitLine: { lineStyle: { color: '#333' } } }]
    return {
      grid: [
        { left: 50, right: hasPct ? 56 : 20, top: 32, height: '55%' },
        { left: 50, right: 20, top: '64%', height: '22%' }
      ],
      xAxis: [xAxis0, xAxisSubBottom(1)],
      yAxis: [
        ...yMainSingle,
        { type: 'value', name: hasVol ? '量(手)' : '额(亿)', nameTextStyle: { color: '#888' }, scale: true, gridIndex: 1, splitLine: { show: true, lineStyle: { color: '#2a2a2a' } } }
      ],
      xZoomIdx: [0, 1]
    }
  }
  const gxy = buildGridsXAxesYAxes()
  // 主图：价轴 0 + 可选 涨跌% 1；有涨跌% 时副图从 y 下标 2 起，否则从 1 起
  const yVol = hasSub && hasVol ? (hasPct ? 2 : 1) : 0
  const yAmt = hasSub && hasAmt
    ? (subBoth ? (hasPct ? 3 : 2) : (hasPct ? 2 : 1))
    : 0
  const xVol = hasSub ? 1 : 0
  const xAmt = hasSub && subBoth ? 2 : (hasSub && hasAmt ? 1 : 0)
  const option = {
    backgroundColor: 'transparent',
    textStyle: { color: '#ccc' },
    axisPointer: { link: [{ xAxisIndex: 'all' }], type: 'cross' },
    grid: gxy.grid,
    xAxis: gxy.xAxis,
    yAxis: gxy.yAxis,
    dataZoom: hasSub
      ? [
          { type: 'inside', xAxisIndex: gxy.xZoomIdx },
          { type: 'slider', xAxisIndex: gxy.xZoomIdx, height: 20, bottom: 4, borderColor: '#444' }
        ]
      : [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 6 }],
    series: (() => {
      const s = [
        {
          name: 'K线',
          type: 'candlestick',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: ohlc,
          itemStyle: {
            color: '#ef5350',
            color0: '#26a69a',
            borderColor: '#ef5350',
            borderColor0: '#26a69a'
          }
        }
      ]
      if (hasPct) {
        s.push({
          name: '涨跌幅%',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 1,
          data: pcts,
          showSymbol: false,
          lineStyle: { width: 1, color: '#9ccc65' },
          connectNulls: true,
          z: 5
        })
      }
      if (hasSub && hasVol) {
        s.push({
          name: '成交量',
          type: 'bar',
          xAxisIndex: xVol,
          yAxisIndex: yVol,
          data: volData,
          barMaxWidth: 6
        })
      }
      if (hasSub && hasAmt) {
        s.push({
          name: '成交额(千元→亿轴)',
          type: 'bar',
          xAxisIndex: xAmt,
          yAxisIndex: yAmt,
          // 与右轴标「亿」：千元 / 1e5 = 亿
          data: amountData.map((q) => (q == null ? 0 : q / 1e5)),
          itemStyle: { color: 'rgba(100, 181, 246, 0.65)' },
          barMaxWidth: 6
        })
      }
      if (!hasSub) {
        s[0].xAxisIndex = 0
        s[0].yAxisIndex = 0
      }
      return s
    })(),
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      confine: true,
      formatter (params) {
        if (!params || !params.length) return ''
        const idx = params[0].dataIndex
        const d = data[idx]
        if (!d) return ''
        const t = params.map((p) => {
          if (p.seriesName === 'K线' && p.data && p.data.length >= 4) {
            const [o, c, l, h] = p.data
            return `开 ${formatNum2(o)}　收 ${formatNum2(c)}<br/>低 ${formatNum2(l)}　高 ${formatNum2(h)}`
          }
          if (p.seriesName === '涨跌幅%' && p.data != null) {
            return `涨跌幅 ${Number(p.data).toFixed(2)}%`
          }
          if (p.seriesName === '成交量') {
            const v = p.data
            const val = v && typeof v === 'object' && 'value' in v ? v.value : v
            return `成交 ${formatVolShow(val)}`
          }
          if (p.seriesName && p.seriesName.indexOf('成交额') === 0) {
            const y = toNumOrNull(d.amount)
            return `成交额 ${formatAmountQianYuan(y)}（Tushare 为千元）`
          }
          return ''
        }).filter(Boolean)
        const extra = []
        if (d.pct_change != null) extra.push(`涨跌幅(字段) ${formatNum2(d.pct_change)}%`)
        if (d.change != null) extra.push(`涨跌额 ${(Number(d.change) > 0 ? '+' : '')}${formatNum2(d.change)}`)
        if (d.float_mv != null) extra.push(`流通市值 ${formatMvWan(d.float_mv)}`)
        if (d.total_mv != null) extra.push(`总市值 ${formatMvWan(d.total_mv)}`)
        const body = t.concat(extra).filter(Boolean).join('<br/>')
        return `<div class="k-tip"><strong>${fmtAxis(d.trade_date)}</strong><br/>${body}</div>`
      }
    }
  }
  c.setOption(option, true)
  c.resize()
}

function clearKlineState () {
  klineData.value = []
  klineMsg.value = ''
  klineError.value = ''
  disposeChart()
}

async function reloadKline () {
  const code = klineIndexCode.value
  if (!code) {
    clearKlineState()
    return
  }
  klineLoading.value = true
  klineError.value = ''
  klineMsg.value = ''
  try {
    const params = {
      ts_code: code,
      tf: tf.value,
      limit: klineLimit
    }
    const sd = ymdFromInput(startD.value)
    const ed = ymdFromInput(endD.value)
    if (sd) params.start = sd
    if (ed) params.end = ed
    const { data } = await axios.get('/api/shenwan-index/kline', { params })
    if (data && data.data) {
      klineData.value = data.data
      if (data.message) klineMsg.value = data.message
      if (!klineData.value.length && data.message) {
        klineMsg.value = data.message
      }
    } else {
      klineData.value = []
      klineMsg.value = '无数据'
    }
  } catch (e) {
    klineData.value = []
    const d = e && e.response && e.response.data
    klineError.value = (d && d.detail) || (typeof d === 'string' ? d : '') || (e && e.message) || 'K 线加载失败'
  } finally {
    klineLoading.value = false
  }
  await nextTick()
  if (!echarts) {
    const mod = await import('echarts')
    echarts = mod.default || mod
  }
  if (klineData.value.length) {
    if (!klineError.value) klineMsg.value = ''
    await drawCandles()
  } else {
    disposeChart()
  }
}

async function loadL1 () {
  l1Loading.value = true
  treeError.value = ''
  try {
    const { data } = await axios.get('/api/shenwan-index/tree', { params: { src: SRC, level: 'L1' } })
    l1List.value = (data && data.data) || []
    if (data && data.message && !l1List.value.length) {
      treeError.value = data.message
    }
  } catch (e) {
    treeError.value = '加载 L1 失败: ' + (e.message || '')
    l1List.value = []
  } finally {
    l1Loading.value = false
  }
}

async function loadChildren (parent) {
  const { data } = await axios.get('/api/shenwan-index/children', {
    params: { src: SRC, parent_code: parent }
  })
  return (data && data.data) || []
}

function onPickL1 (it) {
  selectedL1.value = it
  selectedL2.value = null
  selectedL3.value = null
  l2List.value = []
  l3List.value = []
  l2Loading.value = true
  l3Loading.value = false
  clearKlineState()
  loadChildren(it.index_code)
    .then((rows) => { l2List.value = rows })
    .catch(() => { l2List.value = [] })
    .finally(() => { l2Loading.value = false })
}

function onPickL2 (it) {
  selectedL2.value = it
  selectedL3.value = null
  l3List.value = []
  l3Loading.value = true
  clearKlineState()
  loadChildren(it.index_code)
    .then((rows) => { l3List.value = rows })
    .catch(() => { l3List.value = [] })
    .finally(() => { l3Loading.value = false })
}

function onPickL3 (it) {
  selectedL3.value = it
  clearKlineState()
}

watch([klineIndexCode, tf, startD, endD], () => {
  if (klineIndexCode.value) {
    reloadKline()
  } else {
    clearKlineState()
  }
})

onMounted(() => {
  const t = new Date()
  const ed = t.toISOString().slice(0, 10)
  t.setFullYear(t.getFullYear() - 3)
  const sd = t.toISOString().slice(0, 10)
  endD.value = ed
  startD.value = sd
  loadL1()
})

onBeforeUnmount(() => {
  if (ro && chartBoxRef.value) {
    try { ro.unobserve(chartBoxRef.value) } catch (e) { /* */ }
  }
  ro = null
  disposeChart()
})
</script>

<style scoped>
.shenwan-wrap { padding: 0.75rem 1rem; }
.shenwan-layout {
  display: flex;
  gap: 1rem;
  min-height: 60vh;
  flex-wrap: wrap;
}
.shenwan-tree {
  flex: 0 0 320px;
  min-width: 240px;
  background: #1e1e1e;
  border-radius: 8px;
  padding: 0.75rem;
  border: 1px solid #333;
}
.panel-title { font-size: 1rem; margin: 0 0 0.5rem; color: #eee; }
.columns { display: flex; gap: 0.5rem; }
.col {
  list-style: none; margin: 0; padding: 0; flex: 1;
  max-height: 420px; overflow: auto; font-size: 12px; border: 1px solid #2a2a2a; border-radius: 4px;
  background: #111;
}
.col li { padding: 4px 6px; cursor: pointer; color: #ccc; }
.col li:hover { background: #2a2a2a; }
.col li.active { background: #1565c0; color: #fff; }
.muted { color: #888; }
.err-msg { color: #f88; font-size: 12px; }
.skeleton { color: #999; }
.hint, .footer-hint { font-size: 11px; color: #888; margin-top: 0.5rem; }
.shenwan-main { flex: 1; min-width: 280px; }
.meta { margin-bottom: 0.5rem; }
.crumb { color: #bbb; font-size: 14px; }
.sep { margin: 0 4px; color: #666; }
.code-line { margin-top: 4px; }
.code-line code { color: #ffcc80; }
.name { margin-left: 8px; color: #eee; }
.toolbar { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; margin: 0.5rem 0; }
.tf-btns button {
  background: #333; color: #ccc; border: 1px solid #555; padding: 4px 10px; margin-right: 4px; border-radius: 4px; cursor: pointer;
}
.tf-btns button.on { background: #1565c0; color: #fff; border-color: #42a5f5; }
.dates label { color: #aaa; font-size: 12px; margin-right: 0.5rem; }
.d-inp { background: #222; color: #ddd; border: 1px solid #444; border-radius: 4px; }
.sm { font-size: 11px; }
.kline-info {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  align-items: center;
  font-size: 12px;
  color: #aaa;
  margin: 0.25rem 0 0.35rem;
  min-height: 1.4em;
}
.kline-info .d { color: #e0e0e0; font-weight: 600; }
.kline-info .q-up { color: #e57373; }
.kline-info .q-dn { color: #81c784; }
.kline-info .q-eq { color: #9e9e9e; }
.chart-box {
  position: relative;
  width: 100%;
  height: 500px;
  min-height: 480px;
  background: #121212;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
}
/* 空 div 不设高度时 ECharts 会报 clientWidth/Height 为 0，导致「有数据但不出图」 */
.chart-canvas {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  min-width: 100px;
  min-height: 440px;
}
.chart-box > :deep(.echarts) { width: 100% !important; height: 100% !important; min-height: 440px; }
.overlay {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  color: #aaa; background: rgba(0,0,0,0.35);
}
.overlay.err { color: #f88; }
.overlay.hint { color: #fb8; padding: 1rem; text-align: center; }
</style>
