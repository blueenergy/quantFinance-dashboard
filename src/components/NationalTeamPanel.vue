<template>
  <div class="national-team-panel">
    <div class="toolbar">
      <div class="toolbar-left">
        <span class="panel-title">国家队动向</span>
        <span v-if="snapshot" class="panel-meta">
          基准日 <strong>{{ fmtDate(snapshot.trade_date) }}</strong>
          · 信号时点 <strong>{{ asOfLabel }}</strong>
          · 份额截至 {{ fmtDate(snapshot.share?.date) }}
        </span>
      </div>
      <div class="toolbar-right">
        <span class="toolbar-label">日期</span>
        <v-menu v-model="dateMenu" :close-on-content-click="false" offset="6">
          <template #activator="{ props }">
            <button
              v-bind="props"
              type="button"
              class="date-trigger"
              :class="{ on: selectedDate }"
              title="选择交易日，只有有数据的日期可选"
            >
              <span>{{ selectedDate ? fmtDate(selectedDate) : '最新' }}</span>
              <span class="date-caret">▾</span>
            </button>
          </template>
          <div class="date-popover">
            <v-date-picker
              :model-value="pickerValue"
              :allowed-dates="isAllowedDate"
              :first-day-of-week="1"
              show-adjacent-months
              hide-header
              @update:model-value="onPickDate"
            />
            <div class="date-popover-footer">
              <button
                type="button"
                class="date-latest-btn"
                :class="{ on: !selectedDate }"
                @click="pickLatest"
              >
                回到最新
              </button>
              <span class="date-popover-hint">
                {{ dates.length ? `共 ${dates.length} 个有数据的交易日` : '交易日列表加载失败' }}
              </span>
            </div>
          </div>
        </v-menu>
        <span class="toolbar-label">时点</span>
        <button
          v-for="opt in asOfOptions"
          :key="opt.value || 'latest'"
          type="button"
          class="asof-btn"
          :class="{ on: asOf === opt.value }"
          @click="setAsOf(opt.value)"
        >
          {{ opt.label }}
        </button>
        <button type="button" class="refresh-btn" :disabled="loading" @click="refresh">
          {{ loading ? '刷新中…' : '刷新' }}
        </button>
      </div>
    </div>

    <div v-if="loading && !snapshot" class="loading-state">正在计算国家队 ETF 信号…</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>
    <template v-else-if="snapshot">
      <div class="summary-grid">
        <div class="summary-card level-card" :class="'level-' + snapshot.level">
          <span class="card-label">今日态势</span>
          <span class="level-line">
            <strong class="card-value">{{ snapshot.level_label }}</strong>
            <span
              v-if="snapshot.share?.direction"
              class="direction-chip"
              :class="'dir-' + snapshot.share.direction"
            >
              {{ snapshot.share.direction_label }}
            </span>
          </span>
          <span class="card-sub">
            首次观察 {{ fmtTime(snapshot.first_signal?.watch) }}
            · 首次疑似 {{ fmtTime(snapshot.first_signal?.suspect) }}
          </span>
        </div>
        <div class="summary-card">
          <span class="card-label">池子总量 / 20 日基线</span>
          <strong class="card-value">{{ fmtRatio(snapshot.pool?.ratio) }}</strong>
          <span class="card-sub">
            {{ fmtYi(snapshot.pool?.amount_yuan) }} / {{ fmtYi(snapshot.pool?.baseline_yuan) }}
          </span>
          <span class="card-sub">
            较昨 {{ fmtRatio(snapshot.pool?.prev_day_ratio) }} · 较5日 {{ fmtRatio(snapshot.pool?.avg5_ratio) }}
          </span>
        </div>
        <div class="summary-card">
          <span class="card-label">放量广度</span>
          <strong class="card-value">{{ snapshot.breadth?.ratio2 }} / {{ snapshot.breadth?.pool_size }}</strong>
          <span class="card-sub">≥2.5x：{{ snapshot.breadth?.ratio25 }} 只</span>
        </div>
        <div class="summary-card">
          <span class="card-label">尾盘 14:30–15:00</span>
          <strong class="card-value">{{ fmtPct(snapshot.tail?.share) }}</strong>
          <span class="card-sub">
            基线 {{ fmtPct(snapshot.tail?.baseline) }} · {{ fmtRatio(snapshot.tail?.ratio) }}
          </span>
        </div>
        <div class="summary-card">
          <span class="card-label">份额确认（T+1）</span>
          <strong class="card-value">{{ fmtPct(snapshot.share?.avg_chg_1d) }}</strong>
          <span class="card-sub">5 日 {{ fmtPct(snapshot.share?.avg_chg_5d) }}</span>
          <span class="card-sub">
            净申赎 {{ fmtPct(snapshot.share?.pool_flow) }}
            <template v-if="snapshot.share?.rotation != null">
              · 相消 {{ fmtRatio(snapshot.share.rotation) }}
            </template>
          </span>
        </div>
      </div>

      <div class="history-card">
        <div class="history-header">
          <div class="history-title">
            <strong>信号历史</strong>
            <span class="muted">15:00 收盘口径 · 点击色块或柱子回看当日截面</span>
          </div>
          <div class="history-legend">
            <span v-for="opt in historyLevels" :key="opt.value">
              <i :class="'dot-' + opt.value"></i>{{ opt.label }}
            </span>
            <span class="flow-hint">细条 红=净申购 / 绿=净赎回</span>
            <span v-if="historyLoading" class="muted">加载中…</span>
          </div>
        </div>
        <div v-if="historyRows.length" class="history-strip">
          <button
            v-for="row in historyRows"
            :key="row.trade_date"
            type="button"
            class="history-day"
            :class="['level-' + row.level, { on: row.trade_date === activeHistoryDate, partial: row.partial }]"
            :title="historyTitle(row)"
            :aria-label="historyTitle(row)"
            @click="openHistoryDay(row)"
          ></button>
        </div>
        <div v-if="historyRows.length" class="history-flow-strip">
          <span
            v-for="row in historyRows"
            :key="row.trade_date"
            class="history-flow"
            :class="'flow-' + (row.direction || 'unknown')"
            :title="historyTitle(row)"
          ></span>
        </div>
        <div v-if="historyRows.length" ref="historyChartRef" class="history-canvas"></div>
        <div v-else-if="!historyLoading" class="muted history-empty">
          {{ historyError || '暂无历史信号' }}
        </div>
      </div>

      <div class="index-row">
        <span
          v-for="idx in snapshot.index_moves || []"
          :key="idx.ts_code"
          class="index-chip"
          :class="valueClass(idx.pct_chg)"
        >
          {{ idx.name }} {{ fmtPct(idx.pct_chg) }}
        </span>
        <span class="index-note">指数为日线收盘口径；盘中以 ETF 价格为准</span>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>代码</th>
              <th>名称</th>
              <th>指数</th>
              <th class="num">现价</th>
              <th class="num">涨跌</th>
              <th class="num">今日成交额</th>
              <th class="num">量比（20日 / 昨 / 5日）</th>
              <th class="num">尾盘占比</th>
              <th class="num">份额日变</th>
              <th class="num">份额 5 日</th>
              <th>信号</th>
              <th>前十名国家队（2025 年报）</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="etf in sortedEtfs"
              :key="etf.ts_code"
              class="etf-row"
              :class="{ selected: etf.ts_code === selectedCode }"
              @click="selectEtf(etf.ts_code)"
            >
              <td><span class="code-link">{{ etf.ts_code }}</span></td>
              <td class="name-cell">{{ etf.name }}</td>
              <td>{{ etf.index }}</td>
              <td class="num">{{ fmtPrice(etf.price) }}</td>
              <td class="num" :class="valueClass(etf.pct_chg)">{{ fmtPct(etf.pct_chg) }}</td>
              <td class="num">{{ fmtYi(etf.amount_yuan) }}</td>
              <td class="num ratio-cell">
                <div class="ratio-main ratio" :class="ratioClass(etf.ratio)">{{ fmtRatio(etf.ratio) }}</div>
                <div class="ratio-sub">昨 {{ fmtRatio(etf.prev_day_ratio) }} · 5日 {{ fmtRatio(etf.avg5_ratio) }}</div>
              </td>
              <td class="num">{{ fmtPct(etf.tail_share) }}</td>
              <td class="num" :class="valueClass(etf.share_chg_1d)">{{ fmtPct(etf.share_chg_1d) }}</td>
              <td class="num" :class="valueClass(etf.share_chg_5d)">{{ fmtPct(etf.share_chg_5d) }}</td>
              <td>
                <span class="signal-badge" :class="'signal-' + etf.signal">{{ etf.signal_label }}</span>
              </td>
              <td class="holder-cell" :title="etf.holder">{{ etf.holder }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="chart-card">
        <div class="chart-header">
          <div>
            <strong>{{ selectedEtf?.name || selectedCode }}</strong>
            <span class="muted">{{ selectedCode }}</span>
          </div>
          <div class="muted">今日累计成交额 vs 20 日基线 · 价格</div>
        </div>
        <div ref="chartRef" class="chart-canvas"></div>
      </div>

      <div class="footnote">
        量比主值 = 今日同一时刻累计成交额 / 过去 20 个交易日同一时刻中位数；下方为较昨日、较 5 日均。
        20 日中位数会被低量日拉低，和同花顺的「今天 / 昨天」不是同一个口径。
        图上浅灰点线为基线 p25 / p75，只作参考，不在图例里。
        尾盘只统计 14:30 之后；份额为 T+1 的基金份额变化；持有人为 2025 年报前十名，不是实时持仓。
        数据源：QMT 1m bars + Tushare fund_share。
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  getNationalTeamCurve,
  getNationalTeamDates,
  getNationalTeamHistory,
  getNationalTeamSnapshot,
} from '../api/nationalTeam'
import { loadEcharts } from '../utils/echarts/loadEcharts.js'

const asOfOptions = [
  { value: '', label: '最新' },
  { value: '1030', label: '10:30' },
  { value: '1130', label: '11:30' },
  { value: '1400', label: '14:00' },
  { value: '1430', label: '14:30' },
  { value: '1500', label: '15:00' },
]

const historyLevels = [
  { value: 'calm', label: '平静' },
  { value: 'watch', label: '观察' },
  { value: 'suspect', label: '疑似' },
  { value: 'high', label: '高置信' },
]

const loading = ref(false)
const error = ref('')
const snapshot = ref(null)
const curve = ref(null)
const dates = ref([])
const selectedDate = ref('')
const selectedCode = ref('510300.SH')
const asOf = ref('')
const dateMenu = ref(false)
const historyRows = ref([])
const historyLoading = ref(false)
const historyError = ref('')
const chartRef = ref(null)
const historyChartRef = ref(null)
let chartInstance = null
let historyChartInstance = null
let historyChartRows = []
let echartsLib = null
let resizeOb = null
let historyResizeOb = null
let refreshTimer = null

const asOfLabel = computed(() => {
  const hm = asOf.value || snapshot.value?.as_of || ''
  return hm ? `${hm.slice(0, 2)}:${hm.slice(2)}` : '最新'
})

const sortedEtfs = computed(() => {
  const rows = snapshot.value?.etfs || []
  return [...rows].sort((a, b) => (b.ratio || 0) - (a.ratio || 0))
})

const selectedEtf = computed(() => {
  return (snapshot.value?.etfs || []).find((row) => row.ts_code === selectedCode.value) || null
})

const allowedDateSet = computed(() => new Set(dates.value))

const latestDate = computed(() => {
  let latest = ''
  for (const d of dates.value) {
    if (d > latest) latest = d
  }
  return latest
})

const pickerValue = computed(() => {
  const compact = selectedDate.value || latestDate.value
  return compact ? compactToIso(compact) : null
})

const activeHistoryDate = computed(() => {
  return selectedDate.value || snapshot.value?.trade_date || ''
})

function fmtYi(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const yi = Number(value) / 1e8
  return `${yi >= 100 ? yi.toFixed(0) : yi.toFixed(1)} 亿`
}

function fmtPct(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const num = Number(value)
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`
}

function fmtRatio(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `${Number(value).toFixed(2)}x`
}

function fmtPrice(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return Number(value).toFixed(3)
}

function fmtTime(hm) {
  if (!hm) return '—'
  return `${hm.slice(0, 2)}:${hm.slice(2)}`
}

function fmtDate(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8)
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  }
  return value || '—'
}

function valueClass(value) {
  if (value == null || Number.isNaN(Number(value))) return ''
  if (Number(value) > 0) return 'up'
  if (Number(value) < 0) return 'down'
  return ''
}

function ratioClass(value) {
  if (value == null) return ''
  if (Number(value) >= 2.5) return 'hot'
  if (Number(value) >= 2.0) return 'warm'
  return ''
}

async function ensureChart() {
  if (!chartRef.value) return null
  if (!echartsLib) echartsLib = await loadEcharts()
  if (!chartInstance) {
    chartInstance = echartsLib.init(chartRef.value)
    resizeOb = new ResizeObserver(() => {
      if (chartInstance) chartInstance.resize()
    })
    resizeOb.observe(chartRef.value)
  }
  return chartInstance
}

function drawChart() {
  if (!chartInstance || !curve.value?.times?.length) return
  const times = curve.value.times
  const today = (curve.value.today_cum || []).map((v) => (v == null ? null : v / 1e8))
  const base = (curve.value.baseline_med || []).map((v) => (v == null ? null : v / 1e8))
  const p25 = (curve.value.baseline_p25 || []).map((v) => (v == null ? null : v / 1e8))
  const p75 = (curve.value.baseline_p75 || []).map((v) => (v == null ? null : v / 1e8))
  const price = curve.value.price || []
  const asOfIdx = asOf.value ? times.indexOf(fmtTime(curve.value.as_of)) : -1

  chartInstance.setOption(
    {
      animation: false,
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const idx = params?.[0]?.dataIndex ?? 0
          const lines = [`<b>${times[idx]}</b>`]
          if (today[idx] != null) lines.push(`今日累计：${today[idx].toFixed(1)} 亿`)
          if (base[idx] != null) lines.push(`20 日基线：${base[idx].toFixed(1)} 亿`)
          if (price[idx] != null) lines.push(`价格：${Number(price[idx]).toFixed(3)}`)
          return lines.join('<br/>')
        },
      },
      legend: {
        top: 0,
        data: ['今日累计', '20 日基线', '价格'],
        textStyle: { color: '#64748b', fontSize: 11 },
      },
      grid: { left: 56, right: 58, top: 36, bottom: 30 },
      xAxis: {
        type: 'category',
        data: times,
        axisLabel: { color: '#64748b', fontSize: 11, interval: 29 },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
      },
      yAxis: [
        {
          type: 'value',
          name: '亿元',
          nameTextStyle: { color: '#64748b', fontSize: 11 },
          axisLabel: { color: '#64748b', fontSize: 11 },
          splitLine: { lineStyle: { color: '#f1f5f9' } },
        },
        {
          type: 'value',
          name: '价格',
          scale: true,
          position: 'right',
          nameTextStyle: { color: '#64748b', fontSize: 11 },
          axisLabel: { color: '#64748b', fontSize: 11 },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '今日累计',
          type: 'line',
          showSymbol: false,
          data: today,
          itemStyle: { color: '#e53935' },
          lineStyle: { width: 2, color: '#e53935' },
          areaStyle: { color: 'rgba(229, 57, 53, 0.08)' },
          markLine: asOfIdx >= 0
            ? {
                symbol: 'none',
                silent: true,
                lineStyle: { color: '#94a3b8', type: 'dashed' },
                label: { formatter: '信号时点', color: '#64748b', fontSize: 10 },
                data: [{ xAxis: times[asOfIdx] }],
              }
            : undefined,
        },
        {
          name: '20 日基线',
          type: 'line',
          showSymbol: false,
          data: base,
          itemStyle: { color: '#78909c' },
          lineStyle: { width: 1.5, color: '#78909c', type: 'dashed' },
        },
        {
          name: '基线 p25',
          type: 'line',
          showSymbol: false,
          silent: true,
          legendHoverLink: false,
          tooltip: { show: false },
          data: p25,
          itemStyle: { color: '#cbd5e1' },
          lineStyle: { width: 1, color: '#cbd5e1', type: 'dotted' },
        },
        {
          name: '基线 p75',
          type: 'line',
          showSymbol: false,
          silent: true,
          legendHoverLink: false,
          tooltip: { show: false },
          data: p75,
          itemStyle: { color: '#cbd5e1' },
          lineStyle: { width: 1, color: '#cbd5e1', type: 'dotted' },
        },
        {
          name: '价格',
          type: 'line',
          yAxisIndex: 1,
          showSymbol: false,
          data: price,
          itemStyle: { color: '#1e88e5' },
          lineStyle: { width: 1.5, color: '#1e88e5' },
        },
      ],
    },
    true,
  )
}

function fmtShortDate(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8)
  return digits.length === 8 ? `${digits.slice(4, 6)}-${digits.slice(6, 8)}` : value
}

function historyTitle(row) {
  const direction = row.direction_label ? ` · ${row.direction_label}` : ''
  const parts = [fmtDate(row.trade_date), `${row.level_label}${direction}`]
  if (row.pool_ratio != null) parts.push(`量比 ${Number(row.pool_ratio).toFixed(2)}x`)
  parts.push(`广度 ≥2.5x ${row.breadth_25x} 只`)
  if (row.tail_ratio != null) parts.push(`尾盘 ${Number(row.tail_ratio).toFixed(2)}x`)
  if (row.share_chg_1d != null) parts.push(`份额日变 ${Number(row.share_chg_1d).toFixed(2)}%`)
  if (row.pool_share_flow != null) {
    const sign = row.pool_share_flow >= 0 ? '+' : ''
    parts.push(`净申赎 ${sign}${Number(row.pool_share_flow).toFixed(2)}%`)
  }
  if (row.share_rotation != null) parts.push(`相消 ${Number(row.share_rotation).toFixed(2)}`)
  if (row.baseline_days < 20) parts.push(`基线 ${row.baseline_days}/20 日`)
  if (row.partial) parts.push('盘中未收盘')
  return parts.join(' · ')
}

async function ensureHistoryChart() {
  if (!historyChartRef.value) return null
  if (!echartsLib) echartsLib = await loadEcharts()
  if (!historyChartInstance) {
    historyChartInstance = echartsLib.init(historyChartRef.value)
    historyChartInstance.on('click', (params) => {
      const row = historyChartRows[params?.dataIndex]
      if (row) openHistoryDay(row)
    })
    historyResizeOb = new ResizeObserver(() => {
      if (historyChartInstance) historyChartInstance.resize()
    })
    historyResizeOb.observe(historyChartRef.value)
  }
  return historyChartInstance
}

function daysBetween(a, b) {
  const parse = (value) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 8)
    if (digits.length !== 8) return null
    return Date.UTC(
      Number(digits.slice(0, 4)),
      Number(digits.slice(4, 6)) - 1,
      Number(digits.slice(6, 8)),
    )
  }
  const left = parse(a)
  const right = parse(b)
  if (left == null || right == null) return 0
  return Math.abs(right - left) / 86400000
}

function drawHistoryChart() {
  if (!historyChartInstance || !historyRows.value.length) return
  const rows = historyRows.value
  const chartRows = []
  rows.forEach((row, idx) => {
    if (idx > 0 && daysBetween(rows[idx - 1].trade_date, row.trade_date) > 20) {
      chartRows.push(null)
    }
    chartRows.push(row)
  })
  historyChartRows = chartRows
  const labels = chartRows.map((row) => (row ? fmtShortDate(row.trade_date) : ''))
  const ratios = chartRows.map((row) =>
    row && row.pool_ratio != null ? Number(row.pool_ratio.toFixed(2)) : null,
  )
  const breadth = chartRows.map((row) => (row ? row.breadth_25x : null))
  const shares = chartRows.map((row) => {
    if (!row) return null
    const value = row.pool_share_flow ?? row.share_chg_1d
    return value == null ? null : Number(value.toFixed(2))
  })
  const activeIdx = chartRows.findIndex(
    (row) => row && row.trade_date === activeHistoryDate.value,
  )
  const bands = []
  const firstFull = chartRows.findIndex((row) => row && row.baseline_days >= 20)
  const partialEnd = firstFull === -1 ? chartRows.length - 0.5 : firstFull - 0.5
  if (partialEnd > 0.5) {
    bands.push([
      {
        xAxis: 0,
        itemStyle: { color: 'rgba(148, 163, 184, 0.06)' },
        label: {
          show: true,
          position: 'insideTop',
          formatter: '基线不足',
          color: '#94a3b8',
          fontSize: 10,
        },
      },
      { xAxis: partialEnd },
    ])
  }
  chartRows.forEach((row, idx) => {
    if (row && (row.level === 'high' || row.level === 'suspect')) {
      bands.push([
        {
          xAxis: idx - 0.5,
          itemStyle: {
            color: row.level === 'high' ? 'rgba(211, 47, 47, 0.08)' : 'rgba(245, 124, 0, 0.07)',
          },
        },
        { xAxis: idx + 0.5 },
      ])
    }
  })

  historyChartInstance.setOption(
    {
      animation: false,
      legend: {
        top: 0,
        data: ['池子量比', '广度≥2.5x', '净申赎'],
        textStyle: { color: '#64748b', fontSize: 11 },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const idx = params?.[0]?.dataIndex ?? 0
          const row = chartRows[idx]
          if (!row) return ''
          const lines = [`<b>${fmtDate(row.trade_date)}</b> ${row.level_label}`]
          if (row.pool_ratio != null) lines.push(`池子量比：${Number(row.pool_ratio).toFixed(2)}x`)
          lines.push(`放量广度：≥2.5x ${row.breadth_25x} 只 · ≥2.0x ${row.breadth_2x} 只`)
          if (row.tail_ratio != null) lines.push(`尾盘占比：${Number(row.tail_ratio).toFixed(2)}x`)
          if (row.share_chg_1d != null) {
            const sign = row.share_chg_1d >= 0 ? '+' : ''
            lines.push(`份额日变：${sign}${Number(row.share_chg_1d).toFixed(2)}%`)
          }
          if (row.pool_share_flow != null) {
            const sign = row.pool_share_flow >= 0 ? '+' : ''
            lines.push(`净申赎(AUM加权)：${sign}${Number(row.pool_share_flow).toFixed(2)}%`)
          }
          if (row.share_rotation != null) {
            lines.push(`相消比：${Number(row.share_rotation).toFixed(2)}`)
          }
          if (row.baseline_days < 20) lines.push(`基线：${row.baseline_days}/20 日`)
          if (row.partial) lines.push('盘中未收盘')
          return lines.join('<br/>')
        },
      },
      grid: { left: 48, right: 84, top: 36, bottom: 28 },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: {
          color: '#64748b',
          fontSize: 10,
          interval: Math.max(0, Math.floor(labels.length / 8)),
        },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
      },
      yAxis: [
        {
          type: 'value',
          name: '量比',
          scale: true,
          nameTextStyle: { color: '#64748b', fontSize: 10 },
          axisLabel: { color: '#64748b', fontSize: 10, formatter: '{value}x' },
          splitLine: { lineStyle: { color: '#f1f5f9' } },
        },
        {
          type: 'value',
          name: '只数',
          min: 0,
          nameTextStyle: { color: '#64748b', fontSize: 10 },
          axisLabel: { color: '#64748b', fontSize: 10 },
          splitLine: { show: false },
        },
        {
          type: 'value',
          name: '净申赎%',
          position: 'right',
          offset: 38,
          nameTextStyle: { color: '#64748b', fontSize: 10 },
          axisLabel: { color: '#64748b', fontSize: 10, formatter: '{value}%' },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '广度≥2.5x',
          type: 'bar',
          yAxisIndex: 1,
          data: breadth,
          barMaxWidth: 12,
          itemStyle: { color: 'rgba(245, 124, 0, 0.45)', borderRadius: [2, 2, 0, 0] },
        },
        {
          name: '池子量比',
          type: 'line',
          yAxisIndex: 0,
          data: ratios,
          showSymbol: true,
          symbolSize: 4,
          connectNulls: false,
          itemStyle: { color: '#e53935' },
          lineStyle: { width: 2, color: '#e53935' },
          markArea: { silent: true, data: bands },
          markLine: activeIdx >= 0
            ? {
                symbol: 'none',
                silent: true,
                lineStyle: { color: '#94a3b8', type: 'dashed' },
                label: { show: false },
                data: [{ xAxis: activeIdx }],
              }
            : undefined,
        },
        {
          name: '净申赎',
          type: 'line',
          yAxisIndex: 2,
          data: shares,
          showSymbol: false,
          connectNulls: false,
          itemStyle: { color: '#1e88e5' },
          lineStyle: { width: 1.2, color: '#1e88e5', type: 'dashed' },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#cbd5e1', type: 'dotted' },
            label: { show: false },
            data: [{ yAxis: 0 }],
          },
        },
      ],
    },
    true,
  )
}

async function loadHistory() {
  historyLoading.value = true
  historyError.value = ''
  try {
    const body = await getNationalTeamHistory({ as_of: '1500', limit: 240 })
    historyRows.value = (Array.isArray(body?.rows) ? [...body.rows] : []).sort(
      (a, b) => String(a.trade_date).localeCompare(String(b.trade_date)),
    )
  } catch (exc) {
    historyRows.value = []
    historyError.value =
      exc?.response?.data?.detail || exc?.message || '信号历史加载失败'
  } finally {
    historyLoading.value = false
  }
}

async function refreshHistory() {
  await loadHistory()
  await nextTick()
  await ensureHistoryChart()
  drawHistoryChart()
}

function openHistoryDay(row) {
  if (!row?.trade_date) return
  selectedDate.value = row.trade_date
  asOf.value = '1500'
  loadSnapshot()
}

async function loadCurve() {
  if (!selectedCode.value) return
  const params = { code: selectedCode.value }
  if (asOf.value) params.as_of = asOf.value
  if (selectedDate.value) params.trade_date = selectedDate.value
  curve.value = await getNationalTeamCurve(params)
  await nextTick()
  await ensureChart()
  drawChart()
}

async function loadSnapshot() {
  loading.value = true
  error.value = ''
  try {
    const params = {}
    if (asOf.value) params.as_of = asOf.value
    if (selectedDate.value) params.trade_date = selectedDate.value
    const data = await getNationalTeamSnapshot(params)
    snapshot.value = data
    const rows = data?.etfs || []
    if (!rows.some((row) => row.ts_code === selectedCode.value)) {
      selectedCode.value = rows[0]?.ts_code || '510300.SH'
    }
    await loadCurve()
  } catch (exc) {
    error.value = exc?.response?.data?.detail || exc?.message || '加载国家队 ETF 信号失败'
  } finally {
    loading.value = false
  }
}

function refresh() {
  loadSnapshot()
  refreshHistory()
}

function setAsOf(value) {
  asOf.value = value
  loadSnapshot()
}

function compactToIso(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8)
  if (digits.length !== 8) return null
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

function isoFromDate(value) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isAllowedDate(value) {
  // Vuetify's default adapter hands us a Date; other adapters may pass ISO.
  const iso = value instanceof Date ? isoFromDate(value) : String(value)
  return allowedDateSet.value.has(iso.replace(/-/g, ''))
}

function onPickDate(value) {
  dateMenu.value = false
  const picked = Array.isArray(value) ? value[0] : value
  if (!picked) return
  const compact = (typeof picked === 'string' ? picked : isoFromDate(picked)).replace(/-/g, '')
  if (compact.length !== 8 || compact === selectedDate.value) return
  selectedDate.value = compact
  loadSnapshot()
}

function pickLatest() {
  dateMenu.value = false
  if (!selectedDate.value) return
  selectedDate.value = ''
  loadSnapshot()
}

async function loadDates() {
  try {
    const body = await getNationalTeamDates({ limit: 240 })
    dates.value = Array.isArray(body?.dates) ? body.dates : []
  } catch (exc) {
    // Keep the "最新" option usable even if the date list endpoint is down.
    dates.value = []
  }
}

async function selectEtf(code) {
  if (!code || code === selectedCode.value) return
  selectedCode.value = code
  try {
    await loadCurve()
  } catch (exc) {
    error.value = exc?.response?.data?.detail || exc?.message || '加载分时曲线失败'
  }
}

function setupTimer() {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = setInterval(() => {
    if (!asOf.value && !selectedDate.value) loadSnapshot()
  }, 30000)
}

watch(activeHistoryDate, () => drawHistoryChart())

onMounted(async () => {
  await nextTick()
  await ensureChart()
  await Promise.all([loadDates(), loadSnapshot(), loadHistory()])
  await nextTick()
  await ensureHistoryChart()
  drawHistoryChart()
  setupTimer()
})

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  if (resizeOb) resizeOb.disconnect()
  if (historyResizeOb) historyResizeOb.disconnect()
  if (chartInstance) chartInstance.dispose()
  if (historyChartInstance) historyChartInstance.dispose()
  chartInstance = null
  historyChartInstance = null
})
</script>

<style scoped>
.national-team-panel {
  --card-bg: #ffffff;
  --border-color: #e2e8f0;
  --text-color: #172033;
  --text-secondary: #64748b;
  --primary-color: #0466c8;
  color: var(--text-color);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.toolbar-left {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
}

.panel-title {
  font-size: 18px;
  font-weight: 700;
}

.panel-meta {
  font-size: 12px;
  color: var(--text-secondary);
}

.toolbar-right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.toolbar-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.date-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 108px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-color);
  font-size: 12px;
  cursor: pointer;
}

.date-trigger:hover,
.date-trigger.on {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.date-caret {
  font-size: 10px;
  color: var(--text-secondary);
}

.date-popover {
  background: var(--card-bg);
}

.date-popover-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px 10px;
  border-top: 1px solid var(--border-color);
}

.date-latest-btn {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-color);
  font-size: 12px;
  cursor: pointer;
}

.date-latest-btn.on {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: #fff;
}

.date-popover-hint {
  font-size: 11px;
  color: var(--text-secondary);
}

.asof-btn,
.refresh-btn {
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-color);
  font-size: 12px;
  cursor: pointer;
}

.asof-btn.on {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: #fff;
}

.refresh-btn {
  border-radius: 6px;
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: #fff;
}

.refresh-btn:disabled {
  opacity: 0.55;
  cursor: wait;
}

.loading-state,
.error-state {
  padding: 24px;
  text-align: center;
  border-radius: 10px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
}

.error-state {
  color: #b91c1c;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--card-bg);
}

.level-card {
  border-left-width: 4px;
}

.level-high {
  border-left-color: #d32f2f;
}

.level-suspect {
  border-left-color: #f57c00;
}

.level-watch {
  border-left-color: #1976d2;
}

.level-calm {
  border-left-color: #94a3b8;
}

.card-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.card-value {
  font-size: 22px;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.level-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.direction-chip {
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.dir-inflow {
  background: #fee2e2;
  color: #b91c1c;
}

.dir-outflow {
  background: #dcfce7;
  color: #15803d;
}

.dir-neutral,
.dir-unknown {
  background: #f1f5f9;
  color: #64748b;
}

.card-sub {
  font-size: 11px;
  color: var(--text-secondary);
}

.index-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.index-chip {
  padding: 3px 10px;
  border-radius: 999px;
  background: #f1f5f9;
  font-size: 12px;
}

.index-note {
  font-size: 11px;
  color: var(--text-secondary);
}

.history-card {
  margin-bottom: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--card-bg);
}

.history-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.history-title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  font-size: 14px;
}

.history-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  color: var(--text-secondary);
}

.history-legend i {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 2px;
  margin-right: 3px;
  vertical-align: middle;
}

.dot-calm {
  background: #cbd5e1;
}

.dot-watch {
  background: #60a5fa;
}

.dot-suspect {
  background: #fb923c;
}

.dot-high {
  background: #ef4444;
}

.history-strip {
  display: flex;
  gap: 3px;
  overflow-x: auto;
  padding: 2px 0 6px;
}

.history-day {
  flex: 0 0 18px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  cursor: pointer;
  opacity: 0.85;
}

.history-day:hover {
  opacity: 1;
  transform: translateY(-1px);
}

.history-day.on {
  outline: 2px solid var(--primary-color);
  outline-offset: 1px;
}

.history-day.level-calm {
  background: #cbd5e1;
}

.history-day.level-watch {
  background: #60a5fa;
}

.history-day.level-suspect {
  background: #fb923c;
}

.history-day.level-high {
  background: #ef4444;
}

.history-day.partial {
  background-image: repeating-linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.5) 0 2px,
    transparent 2px 4px
  );
}

.history-flow-strip {
  display: flex;
  gap: 3px;
  overflow-x: auto;
  padding: 0 0 4px;
}

.history-flow {
  flex: 0 0 18px;
  height: 5px;
  border-radius: 2px;
  background: #e2e8f0;
}

.flow-inflow {
  background: #ef4444;
}

.flow-outflow {
  background: #16a34a;
}

.flow-neutral,
.flow-unknown {
  background: #e2e8f0;
}

.flow-hint {
  font-size: 11px;
  color: var(--text-secondary);
}

.history-canvas {
  width: 100%;
  height: 260px;
}

.history-empty {
  padding: 10px 0;
}

.table-wrap {
  overflow-x: auto;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1120px;
}

.data-table th,
.data-table td {
  padding: 9px 10px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
}

.data-table th {
  background: #f8fafc;
  font-weight: 600;
  white-space: nowrap;
}

.data-table th.num,
.data-table td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.etf-row {
  cursor: pointer;
}

.etf-row:hover {
  background: rgba(4, 102, 200, 0.05);
}

.etf-row.selected {
  background: rgba(4, 102, 200, 0.1);
}

.code-link {
  color: var(--primary-color);
  font-weight: 600;
}

.name-cell {
  font-weight: 500;
  max-width: 180px;
}

.holder-cell {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
  font-size: 12px;
}

.up {
  color: #d32f2f;
}

.down {
  color: #2e7d32;
}

.ratio-cell {
  min-width: 104px;
}

.ratio-main {
  font-weight: 600;
}

.ratio-sub {
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.ratio.hot {
  color: #d32f2f;
  font-weight: 700;
}

.ratio.warm {
  color: #f57c00;
  font-weight: 600;
}

.signal-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  white-space: nowrap;
}

.signal-high {
  background: #fee2e2;
  color: #b91c1c;
}

.signal-suspect {
  background: #ffedd5;
  color: #c2410c;
}

.signal-watch {
  background: #dbeafe;
  color: #1d4ed8;
}

.signal-calm {
  background: #f1f5f9;
  color: #64748b;
}

.chart-card {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--card-bg);
}

.chart-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.chart-header .muted {
  margin-left: 8px;
}

.muted {
  color: var(--text-secondary);
  font-size: 12px;
}

.chart-canvas {
  width: 100%;
  height: 340px;
}

.footnote {
  margin-top: 10px;
  font-size: 11px;
  line-height: 1.7;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .chart-canvas {
    height: 280px;
  }

  .history-canvas {
    height: 220px;
  }
}
</style>
