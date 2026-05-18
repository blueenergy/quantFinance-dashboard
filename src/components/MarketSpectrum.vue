<template>
  <div class="market-spectrum-page">
    <h3 class="page-title">{{ pageTitle }}</h3>
  <div class="controls flex-column gap-sm">
  <div class="date-range flex-row-center gap-sm wrap">
        <label>开始日期:</label>
        <input type="date" v-model="startDate" :max="today" />
        <label>结束日期:</label>
        <input type="date" v-model="endDate" :max="today" />
  <button @click="fetchSpectrum" :disabled="loading || !startDate || !endDate" class="btn-base btn-sm btn-gradient-blue">加载</button>
  <button @click="refreshCurrent" :disabled="loading" class="btn-base btn-sm btn-gradient-teal">刷新</button>
      </div>
<div class="quick-range flex-row-center gap-sm wrap">
        <span class="qr-label">快捷区间:</span>
        <button @click="setQuickRange(7)" :disabled="loading" class="btn-base btn-sm btn-gradient-orange">最近7天</button>
        <button @click="setQuickRange(30)" :disabled="loading" class="btn-base btn-sm btn-gradient-orange">最近30天</button>
        <button @click="setQuickRange(90)" :disabled="loading" class="btn-base btn-sm btn-gradient-orange">最近90天</button>
      </div>
      <div v-if="!lockedMode" class="mode-toggle flex-row-center gap-sm wrap">
        <span class="qr-label">周期:</span>
        <button @click="setMode('daily')" :disabled="loading || mode === 'daily'" class="btn-base btn-sm btn-gradient-blue">日线</button>
        <button @click="setMode('minute')" :disabled="loading || mode === 'minute'" class="btn-base btn-sm btn-gradient-teal">分钟线</button>
      </div>
      <div v-if="mode === 'daily'" class="mode-toggle flex-row-center gap-sm wrap">
        <span class="qr-label">叠加指数:</span>
        <select v-model="overlaySymbol" @change="onOverlayChange" class="overlay-sel">
          <option value="">— 不叠加 —</option>
          <option v-for="p in OVERLAY_INDICES" :key="p.symbol" :value="p.symbol">{{ p.name }}</option>
        </select>
      </div>
      <div v-if="hasSectorPanel" class="mode-toggle flex-row-center gap-sm wrap">
        <span class="qr-label">板块层级:</span>
        <button
          @click="setSectorLevel('L1')"
          :disabled="loading"
          :class="['btn-base', 'btn-xs', 'btn-gradient-blue', { active: sectorLevel === 'L1' }]"
        >申万 L1</button>
        <button
          @click="setSectorLevel('L2')"
          :disabled="loading"
          :class="['btn-base', 'btn-xs', 'btn-gradient-orange', { active: sectorLevel === 'L2' }]"
        >申万 L2</button>
      </div>
      <div class="hint">阳谱(yang_spectrum) 是上涨占比, 阴谱(yin_spectrum) 是下跌/未达标占比</div>
      <div v-if="isRealtimeSpectrumTab" class="realtime-spectrum-notes">
        <p class="realtime-spectrum-notes-title">实时阴阳谱 · 数据与 MA 说明</p>
        <ul class="realtime-spectrum-notes-list">
          <li>曲线与表格为盘中按任务写入的<strong>实时日 K 快照</strong>；横轴时间为 <code>YYYYMMDDHHMM</code>，仅在交易时段内有新点。</li>
          <li>全市场阳谱来自 <code>market_spectrum_realtime_daily</code>；下方板块表来自 <code>realtime_sector_strength</code>，与全市场同一批快照对齐。</li>
          <li><strong>「站上 MA5」</strong>与「阴阳谱」日线逻辑一致：取该股最近 <strong>4 个交易日</strong>已在 <code>volume_price</code> 落库的<strong>收盘</strong>，加上<strong>当前实时快照收盘价</strong>（每只股票在 <code>volume_price_realtime_latest</code> 中当日一条），构成含当日在内的 5 日均价，再判断现价是否高于该均价；<strong>不会</strong>把当日 <code>volume_price</code> 里可能滞后或重复的同日记录算进这条 MA。</li>
          <li>收盘后若日线入库完成且与最后一笔快照一致，该判断与纯日线阴阳谱收敛一致。</li>
        </ul>
      </div>
    </div>

  <!-- 叠加指数相关性统计 -->
  <div v-if="overlayStats" class="overlay-stats">
    <span class="ostat-label">阳谱与 {{ overlayStats.name }} 相关性:</span>
    <span class="ostat-val" :class="corrClass(overlayStats.corrLevel)">
      水平值 r={{ overlayStats.corrLevel.toFixed(3) }}
      <span class="ostat-hint">(阳谱占比高低与指数高低的长期同步)</span>
    </span>
    <span class="ostat-sep">/</span>
    <span class="ostat-val" :class="corrClass(overlayStats.corrChange)">
      日变量 r={{ overlayStats.corrChange.toFixed(3) }}
      <span class="ostat-hint">(当日阳谱变化与指数涨跌同步度)</span>
    </span>
    <span class="ostat-n">N={{ overlayStats.n }}个公共交易日</span>
    <button class="corr-help-btn" @click="showCorrHelp = true" title="查看指标说明">?</button>
  </div>

  <!-- 相关性说明弹窗 -->
  <teleport to="body">
    <div v-if="showCorrHelp" class="corr-help-mask" @click.self="showCorrHelp = false">
      <div class="corr-help-modal">
        <div class="corr-help-header">
          <h4>阳谱 × 指数相关性说明</h4>
          <button class="corr-help-close" @click="showCorrHelp = false">×</button>
        </div>
        <div class="corr-help-body">
          <section>
            <h5>什么是阳谱？</h5>
            <p>阳谱（yang_spectrum）是全市场当日上涨股票数占总股票数的比例，反映市场内部广度（Breadth）。按 MA5 弹窗统计，即当日收盘价高于 5 日均线计为“阳”。</p>
          </section>
          <section>
            <h5>两个相关系数的区别</h5>
            <table class="help-table">
              <thead><tr><th></th><th>水平值 r</th><th>日变量 r</th></tr></thead>
              <tbody>
                <tr><td>问的问题</td><td>指数在高位时，阳谱会不会也在高位？</td><td>指数今天涨，阳谱今天会不会也涨？</td></tr>
                <tr><td>体现关系</td><td>长期结构性同步</td><td>短期方向一致性</td></tr>
                <tr><td>计算方法</td><td>阳谱绝对值 vs 指数归一化收盘价 Pearson r</td><td>Δ阳谱（今-昼）vs 指数日对数收盘率 Pearson r</td></tr>
                <tr><td>实战价値</td><td>较低，短期檃盘容易影响</td><td>较高，可用于当日强弱验证</td></tr>
              </tbody>
            </table>
          </section>
          <section>
            <h5>不同指数的相关性差异</h5>
            <p><strong>中证1000（小盘）</strong>的相关性天然高于<strong>沪深50（大盘）</strong>，因为：</p>
            <ul>
              <li>阳谱统计全市场 4000+ 只股票，绕大多数是中小盘，与中证1000成分股公共集合更大</li>
              <li>沪深50 由超大盘蓝筹驱动，走势受机构/外资/政策影响，与全市场情绪关联较弱</li>
            </ul>
          </section>
          <section>
            <h5>实战场景解读</h5>
            <table class="help-table">
              <thead><tr><th>阳谱</th><th>指数</th><th>含义</th></tr></thead>
              <tbody>
                <tr><td>↑ 涨</td><td>↑ 涨</td><td>健康上涨，广度支撑，贺锑效应广泛</td></tr>
                <tr><td>→ 不动/↓ 跌</td><td>↑ 涨</td><td>结构分化，指数虚涨，慎追</td></tr>
                <tr><td>小幅↓</td><td>↓ 跌</td><td>广度韧性，市场底部支撑尚存，可能快见底</td></tr>
                <tr><td>↑ 率先回升</td><td>→ 横盘底部</td><td>内部广度修复先于指数，潜在反弹信号</td></tr>
              </tbody>
            </table>
          </section>
          <section>
            <h5>r 値强弱参考</h5>
            <p>
              <span class="corr-pos-strong">≥ 0.5 强正相关</span>　
              <span class="corr-pos-weak">0.2–0.5 弱正相关</span>　
              <span class="corr-neutral">&lt;0.2 近似无相关</span>　
              <span class="corr-neg-weak">−0.5–0.2 弱负相关</span>　
              <span class="corr-neg-strong">≤ −0.5 强负相关</span>
            </p>
            <p class="help-note">建议选择 90 天以上区间，样本量 N 足够后数值才稳定可靠。</p>
          </section>
        </div>
      </div>
    </div>
  </teleport>

  <!-- 折线图展示：使用 v-show 保持 DOM，避免 ref 在首次更新时不存在 -->
  <div ref="chartRef" class="spectrum-chart" v-show="records.length > 0"></div>

  <section v-if="hasSectorPanel" class="sector-panel">
    <div class="sector-panel-header">
      <div>
        <h4>{{ sectorLevel }} 板块阴阳谱</h4>
        <p>{{ sectorPanelHint }}</p>
      </div>
      <span class="sector-date">{{ sectorLoading ? '板块加载中...' : `最新: ${formatDate(latestSectorDate)}` }}</span>
    </div>
    <div
      v-if="hasSectorPanel && !sectorLoading && latestSectorRows.length > 0"
      class="sector-quick-picker"
    >
      <div class="sector-quick-picker-row">
        <label class="sector-quick-label" for="sector-pick-filter">快速切换</label>
        <input
          id="sector-pick-filter"
          v-model="sectorPickerFilter"
          type="search"
          class="sector-quick-filter"
          placeholder="筛选名称或代码"
          autocomplete="off"
          enterkeyhint="search"
        />
        <select
          class="sector-quick-select"
          :value="selectedSectorCode"
          @change="onSectorPickerChange($event.target.value)"
        >
          <option value="">— 未选（不叠加曲线 / 无贡献股）—</option>
          <option
            v-for="row in sectorPickerSelectRows"
            :key="row.sector_code"
            :value="row.sector_code"
          >
            {{ formatSectorPickerOption(row) }}
          </option>
        </select>
      </div>
      <p v-if="sectorPickerFilter.trim() && filteredSectorPickerRows.length === 0 && sectorPickerSelectRows.length === 0" class="sector-quick-empty text-subtle">
        无匹配板块
      </p>
    </div>
    <div v-if="sectorLoading" class="loading text-subtle">板块阴阳谱加载中...</div>
    <div v-else-if="latestSectorRows.length === 0" class="empty text-subtle">暂无板块阴阳谱数据</div>
    <details v-else class="spectrum-fold spectrum-fold--nested">
      <summary class="spectrum-fold-summary">
        {{ sectorLevel }} 板块阴阳谱明细 · 共 {{ latestSectorRows.length }} 行
        <span class="spectrum-fold-hint">（默认折叠，点击展开）</span>
      </summary>
      <table class="spectrum-table sector-table spectrum-fold-table">
        <thead>
          <tr>
            <th>板块</th>
            <th>阳谱%</th>
            <th>阴谱%</th>
            <th>MA上方/样本</th>
            <th>相对全市场</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in latestSectorRows"
            :key="row.sector_code"
            :class="{ selected: selectedSectorCode === row.sector_code }"
            @click="selectSector(row.sector_code)"
          >
            <td>{{ row.sector_name }}</td>
            <td>{{ toPercent(row.yang_spectrum) }}</td>
            <td>{{ toPercent(row.yin_spectrum) }}</td>
            <td>{{ row.above_ma_count }}/{{ row.total_stocks }}</td>
            <td :class="relativeClass(row.yang_spectrum - latestMarketYang)">
              {{ signedPercent(row.yang_spectrum - latestMarketYang) }}
            </td>
          </tr>
        </tbody>
      </table>
    </details>

    <SectorContributorsPanel
      v-if="selectedSectorCode"
      class="sector-contributors"
      :loading="contributorsLoading"
      :error="contributorsError"
      :payload="contributorsPayload"
      :title="`贡献股拆解 · ${selectedSectorName}`"
      :description="contributorsDescription"
      :top-n="contributorTopN"
      :ma-period="contributorMaPeriod"
      :data-key="selectedSectorContributorsKey"
      loading-text="贡献股加载中..."
      @show-reasoning="showLimitUpReasoning"
    />
  </section>

  <div v-if="loading" class="loading text-subtle">加载中...</div>
  <div v-else-if="records.length === 0" class="empty text-subtle">暂无数据, 请调整日期范围</div>
  <details v-else class="spectrum-fold">
    <summary class="spectrum-fold-summary">
      <template v-if="isRealtimeSpectrumTab">全市场实时快照明细 · 共 {{ displayRecords.length }} 条</template>
      <template v-else>全市场阴阳谱明细 · 共 {{ displayRecords.length }} 条</template>
      <span class="spectrum-fold-hint">（默认折叠，点击展开）</span>
    </summary>
    <table class="spectrum-table spectrum-fold-table">
      <thead>
        <tr>
          <th>时间</th>
          <th>阳谱%</th>
          <th>阴谱%</th>
          <th>上涨股票数</th>
          <th>下跌股票数</th>
          <th>总股票数</th>
          <th>信号</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in displayRecords" :key="row.trade_date">
          <td>{{ formatDate(row.trade_date) }}</td>
          <td>{{ toPercent(row.yang_spectrum) }}</td>
          <td>{{ toPercent(row.yin_spectrum) }}</td>
          <td>{{ row.aboveCount }}</td>
          <td>{{ row.belowCount }}</td>
          <td>{{ row.total_stocks }}</td>
          <td>
            <span v-if="row.yang_spectrum <= 0.35" class="signal silver" title="阳谱低于35%: 银手指">🤍 银手指</span>
            <span v-else-if="row.yang_spectrum >= 0.50" class="signal gold" title="阳谱高于50%: 金手指">💛 金手指</span>
            <span v-else class="signal neutral" title="无强信号">—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </details>
  <LimitUpReasoningDialog
    :open="limitUpReasoningOpen"
    :loading="limitUpReasoningLoading"
    :error="limitUpReasoningError"
    :symbol="limitUpReasoningStock?.symbol || ''"
    :stock-name="limitUpReasoningStock?.name || ''"
    :trade-date="limitUpReasoningTradeDate"
    :reasoning="limitUpReasoning"
    :news-context="limitUpReasoningNewsContext"
    @close="closeLimitUpReasoning"
  />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import axios from 'axios'
import SectorContributorsPanel from './SectorContributorsPanel.vue'
import LimitUpReasoningDialog from './LimitUpReasoningDialog.vue'
import { useLimitUpReasoningDialog } from '../composables/useLimitUpReasoningDialog'
// Lazy-load ECharts to reduce initial bundle size
let echarts
import { chartColors } from '../theme/chartTheme.js'

const props = defineProps({
  defaultMode: {
    type: String,
    default: 'daily',
    validator: (value) => ['daily', 'minute'].includes(value),
  },
  lockedMode: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '市场阴阳谱',
  },
})

const OVERLAY_INDICES = [
  { symbol: '000300.SH', name: '沪深300' },
  { symbol: '000905.SH', name: '中证500' },
  { symbol: '000852.SH', name: '中证1000' },
  { symbol: '000016.SH', name: '上证50' },
  { symbol: '000688.SH', name: '科创50' },
  { symbol: '399006.SZ', name: '创业板指' },
  { symbol: '000001.SH', name: '上证指数' },
]
const OVERLAY_MAP = Object.fromEntries(OVERLAY_INDICES.map(p => [p.symbol, p.name]))

const overlaySymbol = ref('')
const overlayData = ref([]) // [{ trade_date, close }]
const showCorrHelp = ref(false)

// --- 相关性计算 ---
function pearson(xs, ys) {
  const n = xs.length
  if (n < 2) return null
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, sdx = 0, sdy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my
    num += dx * dy; sdx += dx * dx; sdy += dy * dy
  }
  const denom = Math.sqrt(sdx * sdy)
  return denom === 0 ? 0 : num / denom
}

const overlayStats = computed(() => {
  if (!overlayData.value.length || !records.value.length || mode.value !== 'daily') return null
  const name = OVERLAY_MAP[overlaySymbol.value] || overlaySymbol.value

  // 对齐共同交易日
  const specMap = Object.fromEntries(records.value.map(r => [r.trade_date, r.yang_spectrum]))
  const idxMap = Object.fromEntries(overlayData.value.map(r => [r.trade_date, r.close]))
  const common = overlayData.value.map(r => r.trade_date).filter(d => specMap[d] != null).sort()
  if (common.length < 5) return null

  const yang = common.map(d => specMap[d])
  const idx  = common.map(d => idxMap[d])

  // 1. 水平值相关：yang_spectrum 和指数归一化收盘价直接 Pearson
  //    归一化消除量级影响，体现“占比高低―指数高低”的长期同步关系
  const base = idx[0] || 1
  const idxNorm = idx.map(v => v / base)
  const corrLevel = pearson(yang, idxNorm)

  // 2. 日变量相关：Δyang_spectrum 对比指数日对数收益率
  //    体现“当日阳谱变化方向―指数涨跌方向”的短期同步度
  const dYang = yang.slice(1).map((v, i) => v - yang[i])
  const dIdx  = idx.slice(1).map((v, i) => Math.log(v / idx[i]))
  const corrChange = pearson(dYang, dIdx)

  return { name, n: common.length, corrLevel: corrLevel ?? 0, corrChange: corrChange ?? 0 }
})

function corrClass(r) {
  if (r >= 0.5) return 'corr-pos-strong'
  if (r >= 0.2) return 'corr-pos-weak'
  if (r <= -0.5) return 'corr-neg-strong'
  if (r <= -0.2) return 'corr-neg-weak'
  return 'corr-neutral'
}

// 默认展示最近30天，提升首次加载可视化体验
const todayDate = new Date()
const startDateObj = new Date()
startDateObj.setDate(startDateObj.getDate() - 30)
const today = todayDate.toISOString().slice(0,10)
const startDate = ref(startDateObj.toISOString().slice(0,10))
const endDate = ref(today)
const records = ref([])
const sectorRecords = ref([])
const selectedSectorSeries = ref([])
const sectorLevel = ref('L1')
const selectedSectorCode = ref('')
const sectorLoading = ref(false)
const sectorSeriesLoading = ref(false)
const contributorsPayload = ref(null)
const contributorsLoading = ref(false)
const contributorsError = ref('')
const contributorMaPeriod = 5
const contributorTopN = 40
const contributorsDescription = computed(() => (
  `与上方板块表同一套 MA${contributorMaPeriod} 规则：日线为最近 N 根收盘（含当日）的均值；实时为前 N−1 根已收盘日线 + 当前快照价构成当日均线。下列按成交额、涨跌与距均线空间摘录，便于观察板块内部结构。`
))
const selectedSectorContributorsKey = computed(() => (
  `${selectedSectorCode.value}-${String(contributorsPayload.value?.trade_date || contributorsPayload.value?.snapshot_time || '')}`
))
const {
  limitUpReasoningOpen,
  limitUpReasoningLoading,
  limitUpReasoningError,
  limitUpReasoningStock,
  limitUpReasoning,
  limitUpReasoningNewsContext,
  limitUpReasoningTradeDate,
  showLimitUpReasoning,
  closeLimitUpReasoning,
} = useLimitUpReasoningDialog()
const pageTitle = computed(() => props.title)
const displayRecords = computed(() => {
  return records.value.map(r => ({
    ...r,
    aboveCount: r.above_ma5_count ?? r.above_ma_count,
    belowCount: r.below_ma5_count ?? r.below_ma_count,
  }))
})
const loading = ref(false)
const chartRef = ref(null)
let chartInstance = null


const mode = ref(props.defaultMode)
/** 实时阴阳谱 Tab：lockedMode + 分钟(实时日K) 曲线 */
const isRealtimeSpectrumTab = computed(() => props.lockedMode && mode.value === 'minute')
const hasSectorPanel = computed(() => mode.value === 'daily' || mode.value === 'minute')
const sectorPanelHint = computed(() => (
  mode.value === 'minute'
    ? '表格只取最新实时快照以保证加载速度。点击板块后，再按需叠加该板块的实时区间曲线。'
    : '表格只取最新交易日以保证加载速度。点击板块后，再按需叠加该板块的区间曲线。'
))

const latestSectorDate = computed(() => {
  const dates = sectorRecords.value.map(row => row.trade_date).filter(Boolean).sort()
  return dates.length ? dates[dates.length - 1] : ''
})

const latestMarketYang = computed(() => {
  const row = records.value.find(item => item.trade_date === latestSectorDate.value)
  return row?.yang_spectrum ?? 0
})

const latestSectorRows = computed(() => {
  const date = latestSectorDate.value
  return sectorRecords.value
    .filter(row => row.trade_date === date)
    .slice()
    .sort((a, b) => (b.yang_spectrum ?? 0) - (a.yang_spectrum ?? 0))
})

/** 板块快速切换：筛选关键字（名称 / 代码） */
const sectorPickerFilter = ref('')
const filteredSectorPickerRows = computed(() => {
  const q = sectorPickerFilter.value.trim().toLowerCase()
  const rows = latestSectorRows.value
  if (!q) return rows
  return rows.filter((r) => {
    const name = String(r.sector_name || '').toLowerCase()
    const code = String(r.sector_code || '').toLowerCase()
    return name.includes(q) || code.includes(q)
  })
})
/** 下拉选项：筛选结果；若当前选中行被筛掉则插在列表前，避免 select 显示异常 */
const sectorPickerSelectRows = computed(() => {
  const list = filteredSectorPickerRows.value
  const code = selectedSectorCode.value
  if (!code) return list
  if (list.some((r) => r.sector_code === code)) return list
  const sel = latestSectorRows.value.find((r) => r.sector_code === code)
  return sel ? [sel, ...list] : list
})

function formatSectorPickerOption(row) {
  const y = row?.yang_spectrum
  const yStr = y == null || Number.isNaN(Number(y)) ? '—' : toPercent(Number(y))
  return `${row.sector_name} · 阳谱 ${yStr}`
}

function onSectorPickerChange(raw) {
  const code = (raw || '').trim()
  if (!code) {
    if (selectedSectorCode.value) {
      selectedSectorCode.value = ''
      selectedSectorSeries.value = []
      contributorsPayload.value = null
      contributorsError.value = ''
      updateChart()
    }
    return
  }
  if (selectedSectorCode.value === code) return
  selectSector(code)
}

const selectedSectorRows = computed(() => {
  if (!selectedSectorCode.value) return []
  return selectedSectorSeries.value
    .filter(row => row.sector_code === selectedSectorCode.value)
    .slice()
    .sort((a, b) => String(a.trade_date).localeCompare(String(b.trade_date)))
})

const selectedSectorName = computed(() => {
  const row = sectorRecords.value.find(item => item.sector_code === selectedSectorCode.value)
  return row?.sector_name || ''
})

function formatDate(ymd) {
  if (!ymd) return ''
  if (typeof ymd !== 'string') ymd = String(ymd)
  if (ymd.includes('-')) return ymd
  const datePart = `${ymd.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6,8)}`
  if (ymd.length > 8) {
    const timePart = `${ymd.slice(8,10)}:${ymd.slice(10,12)}`
    return `${datePart} ${timePart}`
  }
  return datePart
}
function toPercent(v) { return (v * 100).toFixed(2) + '%' }
function signedPercent(v) {
  const n = Number(v || 0)
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`
}
function relativeClass(v) {
  if (v >= 0.05) return 'relative-strong'
  if (v <= -0.05) return 'relative-weak'
  return 'relative-neutral'
}
function ymd(dateStr) { return dateStr.replace(/-/g,'') }

function buildMinuteRange() {
  const start = ymd(startDate.value) + '0930'
  let endMinute = '1500'
  // During after-hours testing, realtime daily-K snapshots may be written after 15:00.
  // Keep historical ranges capped at 15:00, but allow today's query to include current test snapshots.
  if (endDate.value === today) {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const currentMinute = `${hh}${mm}`
    if (currentMinute > endMinute) {
      endMinute = currentMinute
    }
  }
  const end = ymd(endDate.value) + endMinute
  return { start, end }
}

async function fetchOverlay() {
  if (!overlaySymbol.value || mode.value !== 'daily') {
    overlayData.value = []
    return
  }
  const sd = ymd(startDate.value)
  const ed = ymd(endDate.value)
  try {
    const res = await axios.get(`/api/kline-series?symbol=${overlaySymbol.value}&start_date=${sd}&end_date=${ed}&limit=2000`)
    overlayData.value = res.data?.data || []
  } catch (e) {
    console.error('获取叠加指数失败', e)
    overlayData.value = []
  }
}

async function fetchSectorSpectrum() {
  if (!hasSectorPanel.value) {
    sectorRecords.value = []
    selectedSectorSeries.value = []
    selectedSectorCode.value = ''
    return
  }
  const latestDate = records.value[records.value.length - 1]?.trade_date
  if (!latestDate) {
    sectorRecords.value = []
    return
  }
  sectorLoading.value = true
  try {
    const url = mode.value === 'minute'
      ? `/api/market-spectrum/realtime-sectors?start_time=${latestDate}&end_time=${latestDate}&level=${sectorLevel.value}&ma_period=5&limit=120`
      : `/api/market-spectrum/sectors?start_date=${latestDate}&end_date=${latestDate}&level=${sectorLevel.value}&ma_period=5&limit=120`
    const res = await axios.get(url)
    const arr = Array.isArray(res.data?.data) ? res.data.data : []
    arr.sort((a, b) => String(a.trade_date).localeCompare(String(b.trade_date)) || String(a.sector_code).localeCompare(String(b.sector_code)))
    sectorRecords.value = arr
    if (!arr.some(row => row.sector_code === selectedSectorCode.value)) {
      selectedSectorCode.value = ''
      selectedSectorSeries.value = []
    }
  } catch (e) {
    console.error('获取板块阴阳谱失败', e)
    sectorRecords.value = []
    selectedSectorSeries.value = []
    selectedSectorCode.value = ''
  } finally {
    sectorLoading.value = false
    if (selectedSectorCode.value) {
      fetchSectorContributors().catch(err => console.error('贡献股刷新失败', err))
    }
  }
}

async function fetchSectorContributors() {
  if (!selectedSectorCode.value || !hasSectorPanel.value) {
    contributorsPayload.value = null
    return
  }
  const latestDate = records.value[records.value.length - 1]?.trade_date
  if (!latestDate) {
    contributorsPayload.value = null
    return
  }
  contributorsLoading.value = true
  contributorsError.value = ''
  try {
    const code = encodeURIComponent(selectedSectorCode.value)
    const lv = sectorLevel.value
    const mp = contributorMaPeriod
    const tn = contributorTopN
    let url
    if (mode.value === 'minute') {
      url = `/api/market-spectrum/sector-contributors?mode=realtime&level=${lv}&sector_code=${code}&snapshot_time=${latestDate}&ma_period=${mp}&top_n=${tn}`
    } else {
      const td = String(latestDate).replace(/-/g, '').slice(0, 8)
      url = `/api/market-spectrum/sector-contributors?mode=daily&level=${lv}&sector_code=${code}&trade_date=${td}&ma_period=${mp}&top_n=${tn}`
    }
    const res = await axios.get(url)
    contributorsPayload.value = res.data
  } catch (e) {
    console.error('获取板块贡献股失败', e)
    contributorsError.value = e?.response?.data?.detail || e.message || '加载失败'
    contributorsPayload.value = null
  } finally {
    contributorsLoading.value = false
  }
}

async function fetchSelectedSectorSeries(code) {
  if (!code || !hasSectorPanel.value) {
    selectedSectorSeries.value = []
    return
  }
  sectorSeriesLoading.value = true
  try {
    let url
    if (mode.value === 'minute') {
      const { start, end } = buildMinuteRange()
      url = `/api/market-spectrum/realtime-sectors?start_time=${start}&end_time=${end}&level=${sectorLevel.value}&ma_period=5&limit=300&sector_code=${encodeURIComponent(code)}`
    } else {
      const sd = ymd(startDate.value)
      const ed = ymd(endDate.value)
      url = `/api/market-spectrum/sectors?start_date=${sd}&end_date=${ed}&level=${sectorLevel.value}&ma_period=5&limit=300&sector_code=${encodeURIComponent(code)}`
    }
    const res = await axios.get(url)
    const arr = Array.isArray(res.data?.data) ? res.data.data : []
    arr.sort((a, b) => String(a.trade_date).localeCompare(String(b.trade_date)))
    selectedSectorSeries.value = arr
  } catch (e) {
    console.error('获取板块区间曲线失败', e)
    selectedSectorSeries.value = []
  } finally {
    sectorSeriesLoading.value = false
  }
}

function onOverlayChange() {
  if (!overlaySymbol.value) {
    overlayData.value = []
  } else {
    fetchOverlay().then(() => updateChart())
  }
  updateChart()
}

async function fetchSpectrum() {
  if (!startDate.value || !endDate.value) return
  loading.value = true
  try {
    let url
    if (mode.value === 'daily') {
      url = `/api/market-spectrum?start_date=${ymd(startDate.value)}&end_date=${ymd(endDate.value)}`
    } else {
      const { start, end } = buildMinuteRange()
      url = `/api/market-spectrum-minute?start_time=${start}&end_time=${end}&ma_period=5`
    }
    const resp = await axios.get(url)
    const arr = Array.isArray(resp.data?.data) ? resp.data.data : []
    // 按日期升序排序，确保图表顺序
    arr.sort((a,b) => a.trade_date.localeCompare(b.trade_date))
    records.value = arr
    await fetchOverlay()
    await nextTick() // 确保 chartRef 已渲染
    updateChart()
    fetchSectorSpectrum().then(() => {
      updateChart()
      if (selectedSectorCode.value) {
        return fetchSectorContributors()
      }
    })
  } catch (e) {
    console.error('获取阴阳谱失败', e)
    records.value = []
    await nextTick()
    updateChart()
  } finally {
    loading.value = false
  }
}

function refreshCurrent() {
  if (!startDate.value || !endDate.value) return
  fetchSpectrum().catch(err => console.error('刷新失败', err))
}

function setQuickRange(days) {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - days + 1) // 包含今天在内的最近 N 天
  startDate.value = start.toISOString().slice(0,10)
  endDate.value = end.toISOString().slice(0,10)
  refreshCurrent()
}

function setMode(m) {
  if (mode.value === m) return
  if (props.lockedMode) return
  mode.value = m
  // 切换模式后自动刷新当前选择区间
  refreshCurrent()
}

function setSectorLevel(level) {
  if (sectorLevel.value === level) return
  sectorLevel.value = level
  sectorPickerFilter.value = ''
  selectedSectorCode.value = ''
  selectedSectorSeries.value = []
  fetchSectorSpectrum().then(() => updateChart())
}

function selectSector(code) {
  if (selectedSectorCode.value === code) {
    selectedSectorCode.value = ''
    selectedSectorSeries.value = []
    contributorsPayload.value = null
    contributorsError.value = ''
    updateChart()
    return
  }
  selectedSectorCode.value = code
  contributorsPayload.value = null
  contributorsError.value = ''
  fetchSelectedSectorSeries(code).then(() => {
    updateChart()
    return fetchSectorContributors()
  })
}

async function updateChart() {
  if (!chartRef.value) return
  if (!chartInstance) {
    if (!echarts) {
      const mod = await import('echarts')
      echarts = mod.default || mod
    }
    chartInstance = echarts.init(chartRef.value)
    window.addEventListener('resize', handleResize)
  }
  if (!records.value || records.value.length === 0) {
    chartInstance.clear()
    return
  }
  const dates = records.value.map(r => formatDate(r.trade_date))
  const yangVals = records.value.map(r => r.yang_spectrum)
  const yinVals = records.value.map(r => r.yin_spectrum)
  const selectedSectorMap = Object.fromEntries(
    selectedSectorRows.value.map(row => [formatDate(row.trade_date), row.yang_spectrum])
  )
  const selectedSectorVals = dates.map(d => selectedSectorMap[d] ?? null)
  const hasSectorOverlay = hasSectorPanel.value && selectedSectorCode.value && selectedSectorRows.value.length > 0

  // 叠加指数：将指数收盘价对齐到阴阳谱的日期轴
  const hasOverlay = overlayData.value.length > 0 && mode.value === 'daily'
  const overlayName = OVERLAY_MAP[overlaySymbol.value] || overlaySymbol.value
  let overlayVals = []
  if (hasOverlay) {
    const closeMap = Object.fromEntries(
      overlayData.value.map(r => [formatDate(r.trade_date), r.close])
    )
    overlayVals = dates.map(d => closeMap[d] ?? null)
  }

  const legendData = ['阳谱', '阴谱']
  if (hasSectorOverlay) legendData.push(selectedSectorName.value)
  if (sectorSeriesLoading.value) legendData.push('板块曲线加载中')
  if (hasOverlay) legendData.push(overlayName)

  const yAxisArr = [
    {
      type: 'value',
      min: 0,
      max: 1,
      axisLabel: { formatter: v => (v * 100).toFixed(0) + '%' },
      splitLine: { lineStyle: { color: chartColors.gridLine } }
    }
  ]
  if (hasOverlay) {
    yAxisArr.push({
      type: 'value',
      scale: true,
      axisLabel: { fontSize: 11, color: '#7b5ea7' },
      splitLine: { show: false },
      axisLine: { lineStyle: { color: '#7b5ea7' } }
    })
  }

  const seriesArr = [
    {
      name: '阳谱',
      type: 'line',
      smooth: true,
      yAxisIndex: 0,
      data: yangVals,
      lineStyle: { width: 2, color: chartColors.yangLine },
      areaStyle: { opacity: 0.15, color: chartColors.yangArea },
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: { type: 'dashed', color: chartColors.thresholdLine },
        data: [
          { yAxis: 0.35, name: '银手指阈值 35%' },
          { yAxis: 0.50, name: '金手指阈值 50%' }
        ],
        label: { formatter: ({ value }) => (value * 100) + '%', position: 'end' }
      }
    },
    {
      name: '阴谱',
      type: 'line',
      smooth: true,
      yAxisIndex: 0,
      data: yinVals,
      lineStyle: { width: 2, color: chartColors.yinLine },
      areaStyle: { opacity: 0.10, color: chartColors.yinArea }
    }
  ]
  if (hasSectorOverlay) {
    seriesArr.push({
      name: selectedSectorName.value,
      type: 'line',
      smooth: true,
      yAxisIndex: 0,
      data: selectedSectorVals,
      connectNulls: false,
      lineStyle: { width: 2, color: '#f59e0b' },
      areaStyle: { opacity: 0.08, color: '#f59e0b' },
    })
  }
  if (hasOverlay) {
    seriesArr.push({
      name: overlayName,
      type: 'line',
      smooth: false,
      symbol: 'none',
      yAxisIndex: 1,
      data: overlayVals,
      connectNulls: false,
      lineStyle: { width: 1.5, color: '#7b5ea7' },
      color: '#7b5ea7',
    })
  }

  const option = {
    backgroundColor: '#ffffff',
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        let s = `<b>${params[0]?.axisValue}</b><br/>`
        for (const p of params) {
          if (p.value == null) continue
          const isSpectrum = p.seriesName === '阳谱' || p.seriesName === '阴谱' || p.seriesName === selectedSectorName.value
          const val = isSpectrum ? (p.value * 100).toFixed(2) + '%' : p.value.toFixed(2)
          s += `${p.marker}${p.seriesName}: ${val}<br/>`
        }
        return s
      }
    },
    legend: { data: legendData },
    grid: { left: '6%', right: hasOverlay ? '7%' : '4%', top: 50, bottom: 70 },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLabel: { rotate: dates.length > 14 ? 45 : 0 }
    },
    yAxis: yAxisArr,
    dataZoom: [
      { type: 'slider', start: 0, end: 100, height: 18, bottom: 40 },
      { type: 'inside' }
    ],
    series: seriesArr
  }
  chartInstance.setOption(option, true)
  chartInstance.resize()
}

function handleResize() {
  if (chartInstance) chartInstance.resize()
}

watch(records, () => {
  updateChart()
}, { deep: true })

onMounted(() => {
  // 首次自动加载默认区间数据
  fetchSpectrum().catch(err => console.error('首次加载失败', err))
})

onBeforeUnmount(() => {
  if (chartInstance) {
    window.removeEventListener('resize', handleResize)
    chartInstance.dispose()
    chartInstance = null
  }
})
</script>

<style scoped>
.market-spectrum-page { background:#fff; padding:16px; border-radius:8px; }
.page-title { margin:0 0 16px; font-size:20px; }
.controls { margin-bottom:12px; display:flex; flex-direction:column; gap:8px; }
.date-range { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.date-range input { padding:6px 8px; border:1px solid #ccc; border-radius:4px; }
/* buttons now use global utilities; keep disabled override */
.date-range button:disabled { opacity:.55; cursor:not-allowed; }
.quick-range { margin-top:4px; }
.mode-toggle { margin-top:4px; }
.overlay-sel { padding:4px 8px; border:1px solid #ccc; border-radius:4px; font-size:13px; }
.hint { font-size:12px; color:#666; }
.mode-toggle .btn-xs { padding:2px 6px; font-size:11px; }
.mode-toggle .btn-base.active {
  box-shadow: 0 0 0 2px rgba(37, 99, 235, .35);
  filter: saturate(1.15);
}
.loading, .empty { padding:20px; text-align:center; color:#555; }
.spectrum-chart { width:100%; height:320px; margin-bottom:16px; border:1px solid #e2e8f0; border-radius:6px; }
.spectrum-table { width:100%; border-collapse:collapse; }
.spectrum-table th, .spectrum-table td { border:1px solid #e2e8f0; padding:6px 8px; font-size:13px; text-align:center; }
.spectrum-table th { background:#f1f5f9; }
.spectrum-fold { margin:0 0 16px; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; background:#fff; }
.spectrum-fold-summary { padding:10px 14px; cursor:pointer; background:#f8fafc; font-size:13px; font-weight:600; color:#334155; border-bottom:1px solid #e2e8f0; list-style:none; user-select:none; }
.spectrum-fold-summary::-webkit-details-marker { display:none; }
.spectrum-fold-summary::marker { content:''; }
.spectrum-fold-hint { font-weight:400; color:#64748b; font-size:12px; margin-left:6px; }
.spectrum-fold:not([open]) .spectrum-fold-summary { border-bottom:none; }
.spectrum-fold-table { margin:0; }
.spectrum-fold--nested { margin:0; border:none; border-radius:0; background:transparent; overflow:visible; }
.sector-panel { margin:0 0 16px; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; }
.sector-panel-header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; background:#f8fafc; border-bottom:1px solid #e2e8f0; }
.sector-quick-picker { padding:10px 14px; background:#fff; border-bottom:1px solid #e2e8f0; }
.sector-quick-picker-row { display:flex; flex-wrap:wrap; align-items:center; gap:8px 10px; }
.sector-quick-label { font-size:12px; font-weight:600; color:#475569; white-space:nowrap; }
.sector-quick-filter { flex:1 1 140px; min-width:120px; max-width:100%; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; }
.sector-quick-select { flex:2 1 200px; min-width:160px; max-width:100%; padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; background:#fff; color:#334155; }
.sector-quick-empty { margin:6px 0 0; font-size:12px; }
.sector-panel-header h4 { margin:0 0 4px; font-size:15px; }
.sector-panel-header p { margin:0; font-size:12px; color:#64748b; }
.sector-date { font-size:12px; color:#64748b; white-space:nowrap; }
.sector-table { margin:0; }
.sector-table tbody tr { cursor:pointer; }
.sector-table tbody tr:hover { background:#fff7ed; }
.sector-table tbody tr.selected { background:#ffedd5; }
.relative-strong { color:#dc2626; font-weight:700; }
.relative-weak { color:#2563eb; font-weight:700; }
.relative-neutral { color:#64748b; }
.signal { font-weight:700; display:inline-flex; align-items:center; gap:4px; }
.signal.gold { color:#d4af37; }
.signal.silver { color:#a9a9a9; }
.signal.neutral { color:#666; font-weight:400; }
.overlay-stats { display:flex; flex-wrap:wrap; align-items:center; gap:10px; padding:8px 12px; background:#f8fafc; border-radius:6px; margin-bottom:10px; font-size:13px; }
.ostat-label { color:#555; }
.ostat-val { font-weight:600; display:flex; align-items:center; gap:4px; }
.ostat-hint { font-size:11px; font-weight:400; color:#999; }
.ostat-sep { color:#ccc; }
.ostat-n { color:#aaa; font-size:12px; margin-left:4px; }
.corr-pos-strong { color:#c62828; }
.corr-pos-weak   { color:#e57373; }
.corr-neg-strong { color:#1565c0; }
.corr-neg-weak   { color:#64b5f6; }
.corr-neutral    { color:#888; }
.corr-help-btn { margin-left:4px; width:18px; height:18px; border-radius:50%; border:1px solid #aaa; background:#f0f0f0; color:#555; font-size:11px; font-weight:700; cursor:pointer; line-height:1; padding:0; flex-shrink:0; }
.corr-help-btn:hover { background:#ddd; }
.corr-help-mask { position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:9999; display:flex; align-items:center; justify-content:center; }
.corr-help-modal { background:#fff; border-radius:10px; width:min(680px,92vw); max-height:80vh; overflow-y:auto; box-shadow:0 8px 32px rgba(0,0,0,0.18); display:flex; flex-direction:column; }
.corr-help-header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px 12px; border-bottom:1px solid #e2e8f0; position:sticky; top:0; background:#fff; z-index:1; }
.corr-help-header h4 { margin:0; font-size:16px; }
.corr-help-close { background:none; border:none; font-size:20px; cursor:pointer; color:#666; line-height:1; padding:0 4px; }
.corr-help-close:hover { color:#333; }
.corr-help-body { padding:16px 20px; display:flex; flex-direction:column; gap:16px; font-size:13px; line-height:1.7; }
.corr-help-body section h5 { margin:0 0 8px; font-size:14px; color:#333; border-left:3px solid #7b5ea7; padding-left:8px; }
.corr-help-body section p { margin:0 0 6px; color:#444; }
.corr-help-body section ul { margin:4px 0 0 16px; padding:0; color:#444; }
.corr-help-body section ul li { margin-bottom:4px; }
.help-table { width:100%; border-collapse:collapse; font-size:12px; }
.help-table th, .help-table td { border:1px solid #e2e8f0; padding:5px 8px; text-align:left; }
.help-table th { background:#f8fafc; font-weight:600; }
.help-note { font-size:11px; color:#999; margin-top:6px !important; }
.sector-contributors { margin-top:14px; padding:12px 14px; background:#fafafa; border-top:1px solid #e2e8f0; }
</style>
