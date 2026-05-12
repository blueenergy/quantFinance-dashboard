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
            <button type="button" :class="{ on: tf === '1d' }" @click="onTfClick('1d')">日 K</button>
            <button type="button" :class="{ on: tf === '1w' }" @click="onTfClick('1w')">周 K</button>
            <button type="button" :class="{ on: tf === '1m' }" @click="onTfClick('1m')">月 K</button>
          </div>
          <div class="dates">
            <label>开始             <input v-model="startD" class="d-inp" type="date" @change="_startDIsDefault = false" /></label>
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

        <!-- PE/PB 估值走势 -->
        <div v-if="pepbData.length" class="pepb-section">
          <h4 class="section-title">PE / PB 估值走势</h4>
          <div class="pepb-box" ref="pepbBoxRef">
            <div ref="pepbElRef" class="pepb-canvas" />
          </div>
        </div>

        <!-- 成分股列表 -->
        <div class="member-section">
          <div class="member-section-header">
            <h4 class="section-title">
              成分股
              <span v-if="memberList.length" class="member-count">{{ memberList.length }} 只</span>
            </h4>
            <div v-if="memberList.length" class="member-sort-btns">
              <button :class="{ on: memberSort === 'default' }" @click="memberSort = 'default'">代码</button>
              <button :class="{ on: memberSort === 'mv' }" @click="memberSort = 'mv'">市值↓</button>
            </div>
          </div>
          <div v-if="memberLoading" class="muted">加载成分股…</div>
          <div v-else-if="memberError" class="err-msg">{{ memberError }}</div>
          <div v-else-if="!klineIndexCode" class="muted">请先选择行业</div>
          <div v-else-if="memberList.length === 0" class="muted">暂无成分股数据</div>
          <div v-else class="member-grid">
            <div
              v-for="m in sortedMemberList"
              :key="m.con_code"
              class="member-chip"
              @click="openDeepAnalysis(m)"
              @mouseenter="onChipEnter($event, m)"
              @mouseleave="onChipLeave"
            >
              <span class="member-name">{{ m.name }}</span>
              <span class="member-code">{{ m.con_code }}</span>
            </div>
          </div>
        </div>

        <!-- AI 行业分析 -->
        <div v-if="klineIndexCode" class="industry-analysis-section">
          <div class="industry-analysis-header">
            <h4 class="section-title">AI 行业研究</h4>
            <button
              class="btn-analyze"
              :disabled="industryAnalysisLoading"
              @click="submitIndustryAnalysis"
            >
              {{ industryAnalysisLoading ? '分析中…' : industryAnalysisResult ? '重新分析' : '开始分析' }}
            </button>
            <span v-if="industryAnalysisAgeText && !industryAnalysisLoading" class="ia-age">{{ industryAnalysisAgeText }}</span>
          </div>
          <div v-if="industryAnalysisStatus === 'processing' || (industryAnalysisLoading && industryAnalysisStatus === 'pending')" class="muted ia-status">
            正在生成行业分析报告，请稍候…
          </div>
          <div v-if="industryAnalysisError" class="err-msg">{{ industryAnalysisError }}</div>
          <AnalysisDetailContent
            v-if="industryAnalysisResult && !industryAnalysisLoading"
            :analysis="industryAnalysisResult"
            analysis-mode="industry_v1"
            mode="industry"
            layout="stacked"
          />
        </div>
      </section>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="tooltip.visible"
      class="member-tooltip"
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
      @mouseenter="onTipEnter"
      @mouseleave="onTipLeave"
    >
      <div class="mt-header">
        <span class="mt-name">{{ tooltip.member?.name }}</span>
        <span class="mt-code">{{ tooltip.member?.con_code }}</span>
        <button class="mt-close" @click.stop="closeTooltip">×</button>
      </div>
      <div v-if="tooltip.member?.l1_name" class="mt-industry">
        {{ tooltip.member.l1_name }}
        <template v-if="tooltip.member.l2_name"> › {{ tooltip.member.l2_name }}</template>
        <template v-if="tooltip.member.l3_name"> › {{ tooltip.member.l3_name }}</template>
      </div>
      <div class="mt-body">
        <div class="mt-row">
          <span class="mt-label">总市值</span>
          <span class="mt-val">{{ tooltip.member?.total_mv != null ? (tooltip.member.total_mv / 10000).toFixed(0) + ' 亿' : '—' }}</span>
        </div>
        <div class="mt-row">
          <span class="mt-label">PE(TTM)</span>
          <span class="mt-val">{{ tooltip.member?.pe_ttm != null ? Number(tooltip.member.pe_ttm).toFixed(1) : '—' }}</span>
        </div>
        <div class="mt-row">
          <span class="mt-label">PB</span>
          <span class="mt-val">{{ tooltip.member?.pb != null ? Number(tooltip.member.pb).toFixed(2) : '—' }}</span>
        </div>
      </div>
      <button class="mt-goto" @click.stop="openDeepAnalysis(tooltip.member); closeTooltip()">前往个股分析 →</button>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick, reactive } from 'vue'
import axios from 'axios'
import { buildShenwanKlineOption } from '../utils/echarts/shenwanKlineOption.js'
import AnalysisDetailContent from '../components/AnalysisDetailContent.vue'

const SRC = 'SW2021'
const klineLimit = 800

// ── 成分股 ────────────────────────────────────────────────────────────────
const memberList = ref([])
const memberLoading = ref(false)
const memberError = ref('')
const memberSort = ref('mv')

const sortedMemberList = computed(() => {
  const arr = [...memberList.value]
  if (memberSort.value === 'mv') {
    arr.sort((a, b) => {
      const av = a.total_mv != null ? Number(a.total_mv) : null
      const bv = b.total_mv != null ? Number(b.total_mv) : null
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      return bv - av
    })
  }
  // 'default': 保持后端返回的默认顺序（con_code 升序）
  return arr
})

async function loadMembers (indexCode) {
  if (!indexCode) { memberList.value = []; return }
  memberLoading.value = true
  memberError.value = ''
  memberList.value = []
  try {
    const token = localStorage.getItem('access_token')
    const { data } = await axios.get('/api/shenwan-index/members', {
      params: { index_code: indexCode, src: SRC, current_only: true },
      headers: { Authorization: `Bearer ${token}` },
    })
    memberList.value = data?.data || []
  } catch (e) {
    memberError.value = '成分股加载失败'
  } finally {
    memberLoading.value = false
  }
}

function openDeepAnalysis (member) {
  const symbol = member.con_code || ''
  if (!symbol) return
  window.dispatchEvent(new CustomEvent('shenwan:open-deep-analysis', {
    detail: { symbol, name: member.name || '' },
  }))
}

// ── 成分股 Tooltip ────────────────────────────────────────────────────────
const tooltip = reactive({ visible: false, x: 0, y: 0, member: null })
let _tipLeaveTimer = null

function onChipEnter (e, member) {
  clearTimeout(_tipLeaveTimer)
  const rect = e.currentTarget.getBoundingClientRect()
  // 弹窗宽 240px，优先向右，贴近屏幕边时向左
  const x = rect.right + 8 + 240 > window.innerWidth
    ? rect.left - 248
    : rect.right + 8
  const y = Math.min(rect.top, window.innerHeight - 220)
  tooltip.x = Math.round(x)
  tooltip.y = Math.round(y)
  tooltip.member = member
  tooltip.visible = true
}

function onChipLeave () {
  _tipLeaveTimer = setTimeout(() => { tooltip.visible = false }, 150)
}

function onTipEnter () { clearTimeout(_tipLeaveTimer) }
function onTipLeave () { _tipLeaveTimer = setTimeout(() => { tooltip.visible = false }, 150) }
function closeTooltip () { tooltip.visible = false }

// ── AI 行业分析 ───────────────────────────────────────────────────────────
const industryAnalysisResult = ref(null)
const industryAnalysisLoading = ref(false)
const industryAnalysisError = ref('')
const industryAnalysisStatus = ref('')  // pending / processing / completed / failed
const industryAnalysisCreatedAt = ref(null)  // ISO string from server
let industryPollTimer = null
let industryPollCount = 0

const industryAnalysisAgeText = computed(() => {
  const ts = industryAnalysisCreatedAt.value
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} 小时前`
  const days = Math.floor(hrs / 24)
  return `${days} 天前`
})

async function loadLatestIndustryAnalysis (indexCode) {
  if (!indexCode) return
  try {
    const token = localStorage.getItem('access_token')
    const { data } = await axios.get('/api/shenwan-index/industry-analysis/latest', {
      params: { index_code: indexCode },
      headers: { Authorization: `Bearer ${token}` },
    })
    if (data?.success && data.analysis) {
      industryAnalysisResult.value = { ...data.analysis, _index_code: indexCode }
      industryAnalysisStatus.value = 'completed'
      industryAnalysisCreatedAt.value = data.created_at || null
    }
  } catch (_) { /* no prior result is normal */ }
}

async function submitIndustryAnalysis () {
  const code = klineIndexCode.value
  if (!code || industryAnalysisLoading.value) return
  industryAnalysisLoading.value = true
  industryAnalysisError.value = ''
  industryAnalysisStatus.value = 'pending'
  industryAnalysisResult.value = null
  industryPollCount = 0
  clearInterval(industryPollTimer)
  try {
    const token = localStorage.getItem('access_token')
    const { data } = await axios.post('/api/shenwan-index/industry-analysis',
      { index_code: code },
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!data?.task_id) throw new Error('未返回 task_id')
    const taskId = data.task_id
    industryPollTimer = setInterval(async () => {
      industryPollCount++
      if (industryPollCount > 120) {
        clearInterval(industryPollTimer)
        industryAnalysisLoading.value = false
        industryAnalysisError.value = '分析超时，请稍后重试'
        industryAnalysisStatus.value = 'failed'
        return
      }
      try {
        const { data: td } = await axios.get(`/api/analyze/task/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (td.status === 'completed') {
          clearInterval(industryPollTimer)
          industryAnalysisLoading.value = false
          industryAnalysisStatus.value = 'completed'
          industryAnalysisResult.value = { ...(td.analysis || {}), _index_code: code }
          industryAnalysisCreatedAt.value = td.task_meta?.completed_at || null
        } else if (td.status === 'failed' || td.status === 'completed_with_parse_error') {
          clearInterval(industryPollTimer)
          industryAnalysisLoading.value = false
          industryAnalysisStatus.value = 'failed'
          industryAnalysisError.value = td.error || '分析失败'
        } else {
          industryAnalysisStatus.value = 'processing'
        }
      } catch (_) { /* poll errors are transient */ }
    }, 3000)
  } catch (e) {
    industryAnalysisLoading.value = false
    industryAnalysisStatus.value = 'failed'
    industryAnalysisError.value = e?.response?.data?.detail || e.message || '提交失败'
  }
}

onBeforeUnmount(() => { clearInterval(industryPollTimer) })

// ── PE/PB 图 ───────────────────────────────────────────────────────────────
const pepbBoxRef = ref(null)
const pepbElRef = ref(null)
let pepbInstance = null

const pepbData = computed(() => {
  return klineData.value
    .filter(r => r.trade_date && (r.pe != null || r.pb != null))
    .map(r => ({
      date: fmtAxis(r.trade_date),
      pe: r.pe != null ? +r.pe : null,
      pb: r.pb != null ? +r.pb : null,
    }))
})

function disposePepb () {
  if (pepbInstance) {
    try { pepbInstance.dispose() } catch (e) { /* */ }
    pepbInstance = null
  }
}

async function drawPepb () {
  const rows = pepbData.value
  if (!rows.length) { disposePepb(); return }
  await nextTick()
  await new Promise(r => requestAnimationFrame(r))
  if (!pepbElRef.value) return
  if (!echarts) {
    const mod = await import('echarts')
    echarts = mod.default || mod
  }
  if (!pepbInstance) pepbInstance = echarts.init(pepbElRef.value, 'dark')
  const dates = rows.map(r => r.date)
  const peVals = rows.map(r => r.pe)
  const pbVals = rows.map(r => r.pb)
  const hasPe = peVals.some(v => v != null)
  const hasPb = pbVals.some(v => v != null)
  const series = []
  if (hasPe) series.push({ name: 'PE', type: 'line', data: peVals, smooth: true, symbol: 'none', lineStyle: { color: '#ffd54f', width: 1.5 }, connectNulls: true })
  if (hasPb) series.push({ name: 'PB', type: 'line', data: pbVals, smooth: true, symbol: 'none', lineStyle: { color: '#80cbc4', width: 1.5 }, connectNulls: true, yAxisIndex: hasPe ? 1 : 0 })
  const yAxes = hasPe && hasPb
    ? [{ type: 'value', name: 'PE', nameTextStyle: { color: '#ffd54f' }, axisLabel: { color: '#aaa', fontSize: 10 }, splitLine: { lineStyle: { color: '#2a2a2a' } } },
       { type: 'value', name: 'PB', nameTextStyle: { color: '#80cbc4' }, axisLabel: { color: '#aaa', fontSize: 10 }, splitLine: { show: false } }]
    : [{ type: 'value', axisLabel: { color: '#aaa', fontSize: 10 }, splitLine: { lineStyle: { color: '#2a2a2a' } } }]
  pepbInstance.setOption({
    backgroundColor: '#121212',
    tooltip: { trigger: 'axis', backgroundColor: '#1e1e2e', borderColor: '#444', textStyle: { color: '#eee', fontSize: 11 } },
    legend: { data: series.map(s => s.name), textStyle: { color: '#aaa', fontSize: 11 }, top: 4 },
    grid: { top: 32, bottom: 28, left: 48, right: hasPe && hasPb ? 48 : 12 },
    xAxis: { type: 'category', data: dates, axisLabel: { color: '#777', fontSize: 10, rotate: 30 }, axisLine: { lineStyle: { color: '#333' } } },
    yAxis: yAxes,
    series,
  }, true)
  pepbInstance.resize()
}

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

// tf 对应的默认回看年数
const TF_DEFAULT_YEARS = { '1d': 3, '1w': 5, '1m': 20 }

// 根据当前 tf 生成默认 startD（YYYY-MM-DD）
function defaultStartForTf (tfVal) {
  const t = new Date()
  t.setFullYear(t.getFullYear() - (TF_DEFAULT_YEARS[tfVal] ?? 3))
  return t.toISOString().slice(0, 10)
}

// 标记 startD 是否还是程序自动设置的默认值（未被用户手动修改）
let _startDIsDefault = true

// 切换 tf 时，如果 startD 仍是默认值则自动调整回看区间
function onTfClick (newTf) {
  if (_startDIsDefault) {
    startD.value = defaultStartForTf(newTf)
  }
  tf.value = newTf
}
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

// 选中哪一层就用哪一层的 index_code 加载 K 线（L1 / L2 / L3 均可）
const klineIndexCode = computed(() => activeCode.value)

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
  const option = buildShenwanKlineOption(
    klineData.value,
    {
      fmtAxis,
      formatNum2,
      toNumOrNull,
      formatVolShow,
      formatAmountQianYuan,
      formatMvWan
    },
    { tf: tf.value }
  )
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

// auto-load latest industry analysis when user selects an industry
watch(klineIndexCode, (newCode) => {
  if (newCode !== (industryAnalysisResult.value?._index_code)) {
    industryAnalysisResult.value = null
    industryAnalysisError.value = ''
    industryAnalysisStatus.value = ''
    industryAnalysisCreatedAt.value = null
    loadLatestIndustryAnalysis(newCode)
  }
})

watch([klineIndexCode, tf, startD, endD], () => {
  if (klineIndexCode.value) {
    reloadKline()
    loadMembers(klineIndexCode.value)
  } else {
    clearKlineState()
    memberList.value = []
  }
})

watch(pepbData, () => {
  drawPepb()
})

onMounted(() => {
  const t = new Date()
  const ed = t.toISOString().slice(0, 10)
  endD.value = ed
  startD.value = defaultStartForTf(tf.value)
  _startDIsDefault = true
  loadL1()
  window.addEventListener('shenwan:navigate-to-industry', onNavigateToIndustry)
})

onBeforeUnmount(() => {
  window.removeEventListener('shenwan:navigate-to-industry', onNavigateToIndustry)
  if (ro && chartBoxRef.value) {
    try { ro.unobserve(chartBoxRef.value) } catch (e) { /* */ }
  }
  ro = null
  disposeChart()
  disposePepb()
})

// 等待某个 loading ref 变为 false
function waitDone (loadingRef) {
  return new Promise(r => {
    if (!loadingRef.value) { r(); return }
    const t = setInterval(() => { if (!loadingRef.value) { clearInterval(t); r() } }, 80)
  })
}

// 跳转并自动选中行业节点
async function onNavigateToIndustry (e) {
  const code = e?.detail?.index_code
  if (!code) return

  // — 等 L1 列表加载完成 —
  await waitDone(l1Loading)

  // 用事件携带的 l1_code 定位 L1；若直接点击 L1 则 l1_code === code
  const targetL1Code = e.detail?.l1_code || code
  const l1Match = l1List.value.find(it => it.index_code === targetL1Code)
  if (!l1Match) return

  if (selectedL1.value?.index_code !== l1Match.index_code) {
    onPickL1(l1Match)
    await nextTick()
    await waitDone(l2Loading)
  } else {
    // 已选中但 L2 可能仍在加载
    await waitDone(l2Loading)
  }

  // 如果目标就是 L1，完成
  if (l1Match.index_code === code) return

  // 用事件携带的 l2_code 定位 L2；若直接点击 L2 则 l2_code === code
  const targetL2Code = e.detail?.l2_code || code
  const l2Match = l2List.value.find(it => it.index_code === targetL2Code)
  if (!l2Match) return

  if (selectedL2.value?.index_code !== l2Match.index_code) {
    onPickL2(l2Match)
    await nextTick()
    await waitDone(l3Loading)
  } else {
    await waitDone(l3Loading)
  }

  // 如果目标就是 L2，完成
  if (l2Match.index_code === code) return

  // 用原始 code 定位 L3
  const l3Match = l3List.value.find(it => it.index_code === code)
  if (l3Match) onPickL3(l3Match)
}
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

/* PE/PB */
.pepb-section { margin-top: 1rem; }
.section-title { font-size: 13px; font-weight: 600; color: #bbb; margin: 0 0 0.4rem; }
.pepb-box { width: 100%; height: 180px; background: #121212; border: 1px solid #2a2a2a; border-radius: 6px; position: relative; }
.pepb-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }

/* 成分股 */
.member-section { margin-top: 1rem; }
.member-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.member-section-header .section-title { margin: 0; }

.member-count { font-size: 11px; font-weight: 400; color: #666; margin-left: 6px; }
.member-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 260px;
  overflow-y: auto;
}
.member-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 6px;
  padding: 5px 10px;
  cursor: pointer;
  transition: .15s;
  min-width: 96px;
}
.member-chip:hover { background: #1e3a5f; border-color: #42a5f5; }
.member-sort-btns { display: flex; gap: 4px; }
.member-sort-btns button {
  padding: 3px 10px;
  font-size: 11px;
  border: 1px solid #333;
  border-radius: 4px;
  background: #1a1a2e;
  color: #aaa;
  cursor: pointer;
  transition: .15s;
}
.member-sort-btns button.on,
.member-sort-btns button:hover { background: #1e3a5f; border-color: #42a5f5; color: #e0e0e0; }
.member-name { font-size: 12px; color: #e0e0e0; font-weight: 600; white-space: nowrap; }
.member-code { font-size: 10px; color: #888; margin-top: 1px; }

/* AI 行业分析区 */
.industry-analysis-section {
  margin-top: 1.5rem;
  background: #fff;
  color: #1a1a1a;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  padding: 20px 24px;
}
.industry-analysis-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.industry-analysis-header .section-title { margin: 0; color: #2c3e50; }
.btn-analyze {
  padding: 5px 16px;
  font-size: 13px;
  font-weight: 600;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  transition: .15s;
}
.btn-analyze:hover:not(:disabled) { filter: brightness(1.15); }
.btn-analyze:disabled { opacity: .5; cursor: not-allowed; }
.ia-status { margin-bottom: 8px; font-size: 13px; color: #555; }
.ia-age { font-size: 12px; color: #888; margin-left: 4px; }

/* chip 文字色在白底下的可读性修正（原色为暗底设计） */
.industry-analysis-section :deep(.analysis-chip--hold)     { color: #92400e; }
.industry-analysis-section :deep(.analysis-chip--na),
.industry-analysis-section :deep(.analysis-chip--risk-na)  { color: #475569; }
.industry-analysis-section :deep(.analysis-chip--risk-medium) { color: #92400e; }
.industry-analysis-section :deep(.expert-review-chip--cycle)       { color: #7c3aed; }
.industry-analysis-section :deep(.expert-review-chip--fundamental) { color: #1d4ed8; }
.industry-analysis-section :deep(.expert-review-chip--growth)      { color: #166534; }
.industry-analysis-section :deep(.expert-review-chip--technical)   { color: #92400e; }
.industry-analysis-section :deep(.expert-review-chip--risk)        { color: #991b1b; }

/* ── 成分股 Tooltip ──────────────────────────────────────────────────────── */
.member-tooltip {
  position: fixed;
  z-index: 9999;
  width: 240px;
  background: #1e2130;
  border: 1px solid #3a3f5c;
  border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0,0,0,.55);
  padding: 12px 14px 10px;
  pointer-events: auto;
  font-size: 13px;
  color: #e0e0e0;
}
.mt-header { display: flex; align-items: baseline; gap: 6px; margin-bottom: 4px; }
.mt-name { font-weight: 700; font-size: 14px; flex: 1; }
.mt-code { font-size: 11px; color: #888; }
.mt-close {
  margin-left: auto;
  background: none; border: none;
  color: #666; font-size: 16px; line-height: 1; cursor: pointer; padding: 0 2px;
}
.mt-close:hover { color: #e0e0e0; }
.mt-industry {
  font-size: 11px; color: #7b8ab8; margin-bottom: 8px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.mt-body { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.mt-row { display: flex; justify-content: space-between; }
.mt-label { color: #8892b0; }
.mt-val { font-weight: 600; color: #cdd6f4; }
.mt-goto {
  width: 100%; padding: 5px 0; font-size: 12px;
  border: 1px solid #4a6fa5; border-radius: 6px;
  background: transparent; color: #7eb3f5; cursor: pointer; transition: .15s;
}
.mt-goto:hover { background: #1e3a5f; color: #e0e0e0; }
</style>
