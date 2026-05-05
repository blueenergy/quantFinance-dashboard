<template>
  <v-container fluid class="market-risk-panel pa-4">
    <div class="mrp-paper">

      <!-- 标题栏 -->
      <v-row class="mb-4">
        <v-col cols="12" md="8">
          <h1 class="mrp-h1">🇺🇸 美国利率</h1>
          <p class="mrp-sub">国债收益率曲线 · TIPS实际利率 · T-Bill · 盈亏平衡通胀 — LLM 深度解读 · 对A股传导</p>
        </v-col>
        <v-col cols="12" md="4" class="d-flex align-center justify-end gap-2 flex-wrap">
          <button class="mrp-btn-sm mrp-btn-dark" :disabled="triggering" @click="triggerAnalysis">
            {{ triggering ? '分析中…' : '🤖 触发分析' }}
          </button>
          <button class="mrp-btn-sm mrp-btn-ghost" :disabled="loading" @click="loadAnalysis">↻ 刷新</button>
        </v-col>
      </v-row>

      <!-- 错误提示 -->
      <div v-if="errorMsg" class="xiv-error-bar mb-3">
        {{ errorMsg }}
        <button type="button" class="xiv-error-dismiss" aria-label="关闭" @click="errorMsg = ''">×</button>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="no-data-hint">加载中…</div>

      <!-- 暂无数据 -->
      <div v-else-if="!doc" class="no-data-hint">
        <p class="mrp-muted">暂无分析数据</p>
        <p class="mrp-caption">点击「触发分析」生成今日解读，或等待每日 06:40 自动任务</p>
      </div>

      <!-- 分析结果 -->
      <template v-else>
        <!-- 元信息 -->
        <div class="macro-meta mb-4">
          <span class="mrp-caption">分析日期：{{ doc.analysis_date }}</span>
          <span class="mrp-caption ml-4" v-if="doc.model">模型：{{ doc.model }}</span>
          <span class="mrp-caption ml-4" v-if="doc.created_at">生成于：{{ fmtTime(doc.created_at) }}</span>
        </div>

        <!-- 核心信号卡片 -->
        <v-row class="mb-4">
          <!-- 收益率曲线形态 -->
          <v-col cols="12" sm="6" md="4" lg="3">
            <div class="macro-card" :class="curveClass(doc.analysis?.curve_shape)">
              <div class="macro-card-label">收益率曲线形态</div>
              <div class="macro-card-value text-sm">{{ doc.analysis?.curve_shape || '—' }}</div>
            </div>
          </v-col>
          <!-- 盈亏平衡通胀预期 -->
          <v-col cols="12" sm="6" md="4" lg="3">
            <div class="macro-card macro-card-neutral">
              <div class="macro-card-label">盈亏平衡通胀预期</div>
              <div class="macro-card-value text-sm">{{ doc.analysis?.breakeven_inflation || '—' }}</div>
            </div>
          </v-col>
          <!-- 美联储政策路径 -->
          <v-col cols="12" sm="6" md="4" lg="3">
            <div class="macro-card macro-card-neutral">
              <div class="macro-card-label">美联储政策路径</div>
              <div class="macro-card-value text-sm">{{ doc.analysis?.fed_path || '—' }}</div>
            </div>
          </v-col>
          <!-- 北向资金潜在影响 -->
          <v-col cols="12" sm="6" md="4" lg="3">
            <div class="macro-card macro-card-neutral">
              <div class="macro-card-label">北向资金潜在影响</div>
              <div class="macro-card-value text-sm">{{ doc.analysis?.northbound_implication || '—' }}</div>
            </div>
          </v-col>
        </v-row>

        <!-- 详细分析区块 -->
        <v-row>
          <v-col cols="12" md="6">
            <div class="macro-block">
              <div class="macro-block-title">📉 2Y/10Y利差分析</div>
              <p class="macro-block-text">{{ doc.analysis?.spread_2y10y || '—' }}</p>
            </div>
          </v-col>
          <v-col cols="12" md="6">
            <div class="macro-block">
              <div class="macro-block-title">⚖️ 实际长期利率影响</div>
              <p class="macro-block-text">{{ doc.analysis?.real_rate_impact || '—' }}</p>
            </div>
          </v-col>
          <v-col cols="12" md="6">
            <div class="macro-block">
              <div class="macro-block-title">🛢️ 大宗商品与汇率传导</div>
              <p class="macro-block-text">{{ doc.analysis?.commodity_fx_transmission || '—' }}</p>
            </div>
          </v-col>
          <v-col cols="12" md="6">
            <div class="macro-block macro-block-highlight">
              <div class="macro-block-title">🏛️ 对A股板块的传导分析</div>
              <p class="macro-block-text">{{ doc.analysis?.a_share_impact || '—' }}</p>
            </div>
          </v-col>
          <v-col cols="12">
            <div class="macro-block macro-block-summary">
              <div class="macro-block-title">🔍 综合评估</div>
              <p class="macro-block-text">{{ doc.analysis?.overall_assessment || '—' }}</p>
            </div>
          </v-col>
        </v-row>

        <!-- 历史记录 -->
        <v-row class="mt-4">
          <v-col cols="12">
            <div class="macro-history-header">
              <span class="macro-history-title">历史记录</span>
              <button class="mrp-btn-sm mrp-btn-ghost" :disabled="historyLoading" @click="loadHistory">
                {{ historyLoading ? '…' : '展开' }}
              </button>
            </div>
            <div v-if="history.length > 1" class="macro-history-list">
              <button
                v-for="h in history"
                :key="h.analysis_date"
                class="macro-history-item"
                :class="{ 'macro-history-active': h.analysis_date === doc.analysis_date }"
                @click="selectHistoryDoc(h)"
              >
                {{ h.analysis_date }}
              </button>
            </div>
          </v-col>
        </v-row>

        <!-- 数据走势（可折叠） -->
        <v-row class="mt-2">
          <v-col cols="12">
            <div class="chart-toggle-bar" @click="toggleCharts">
              <span class="macro-history-title">📊 数据走势</span>
              <span class="chart-toggle-arrow">{{ chartsOpen ? '▲' : '▼' }}</span>
            </div>
            <div v-if="chartsOpen">
              <div class="chart-range-bar mt-1">
                <button
                  v-for="opt in RANGE_OPTIONS" :key="opt.days"
                  class="chart-range-btn" :class="{ active: chartDays === opt.days }"
                  @click.stop="setChartDays(opt.days)"
                >{{ opt.label }}</button>
              </div>
              <div class="chart-row mt-2">
              <div class="chart-wrap">
                <div class="chart-label">
                  收益率 2Y / 10Y · 利差 (10Y−2Y)
                  <button class="info-btn" @click.stop="spreadInfoOpen = true" title="如何阅读此图？">?</button>
                </div>
                <div class="chart-canvas" ref="chartSpread" />
                <div v-if="chartLoading" class="chart-loading">加载中…</div>
              </div>
              <div class="chart-wrap">
                <div class="chart-label">
                  TIPS 实际利率 · 10Y
                  <button class="info-btn" @click.stop="tipsInfoOpen = true" title="如何阅读此图？">?</button>
                </div>
                <div class="chart-canvas" ref="chartTips" />
              </div>
              </div>
            </div>
          </v-col>
        </v-row>

      </template>

    </div>
  </v-container>

  <!-- 2Y/10Y 收益率 + 利差 说明弹窗 -->
  <Teleport to="body">
    <div v-if="spreadInfoOpen" class="shibor-modal-overlay" @click.self="spreadInfoOpen = false">
      <div class="shibor-modal">
        <div class="shibor-modal-header">
          <span>收益率曲线与期限利差说明</span>
          <button class="shibor-modal-close" @click="spreadInfoOpen = false">✕</button>
        </div>
        <div class="shibor-modal-body">
          <p>图表包含三个要素：<b>蓝色线（2Y）</b>、<b>黑色线（10Y）</b>和<b>红色虚线阴影区（10Y−2Y利差）</b>。</p>

          <table class="shibor-table">
            <thead><tr><th>指标</th><th>含义</th></tr></thead>
            <tbody>
              <tr><td><b>2Y 收益率</b></td><td>对货币政策预期最敏感，追踪市场对未来 1−2 年联储加息/降息次数的预期</td></tr>
              <tr><td><b>10Y 收益率</b></td><td>长期融资成本基准，影响房贷、企业贷款利率，市场对长期增长+通胀预期的定价</td></tr>
              <tr><td><b>10Y−2Y 利差</b></td><td>期限结构判断指标，正常应为正值；持续为负即"倒挂"</td></tr>
            </tbody>
          </table>

          <h4>如何阅读利差曲线</h4>
          <p><b>利差 &gt; 0（阳帽）</b>：正常期限结构，长期利率 &gt; 短期利率，经济预期平稳。</p>
          <p><b>利差收窄趋向 0</b>：市场开始担忧联储持续加息或经济放缓。</p>
          <p><b>利差 &lt; 0（倒挂）</b>：历史上是衰退的可靠预警信号，过去 50 年每次美国衰退前都出现过倒挂（延迟通常 6−18 个月）。</p>
          <p><b>倒挂结束、利差急速拳头回升</b>：进入衰退的确认信号，往往比倒挂本身更危险。</p>

          <h4>两条收益率线的同向 / 背离</h4>
          <ul>
            <li><b>同向上行</b>：送气期，市场对增长乐观，利差扩大表示长期信心强。</li>
            <li><b>2Y 上、10Y 不动</b>：市场预期加息但不信长期增长，利差压缩，是谨慎信号。</li>
            <li><b>同向下行</b>：降息周期，融资条件整体宽松。</li>
            <li><b>10Y 下、2Y 不动</b>：市场对长期增长忧虑，利差收窄，谨慎信号。</li>
          </ul>

          <p class="shibor-tip">💡 简单记忆：利差是市场对未来的投票。长期持续倒挂大概率意味着衰退，但倒挂刚出现时股市未必立即下跌。</p>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- TIPS 实际利率 说明弹窗 -->
  <Teleport to="body">
    <div v-if="tipsInfoOpen" class="shibor-modal-overlay" @click.self="tipsInfoOpen = false">
      <div class="shibor-modal">
        <div class="shibor-modal-header">
          <span>TIPS 实际利率说明</span>
          <button class="shibor-modal-close" @click="tipsInfoOpen = false">✕</button>
        </div>
        <div class="shibor-modal-body">
          <p><strong>TIPS（通胀保护证券，Treasury Inflation-Protected Securities）</strong>的 10 年期实际收益率 = 名义利率 − 市场隐含通胀预期，是衡量货币实质成本的核心指标。</p>

          <table class="shibor-table">
            <thead><tr><th>实际利率区间</th><th>市场信号</th></tr></thead>
            <tbody>
              <tr><td><b>&gt; 2%</b></td><td>融资条件偏紧，投资回报要求高，投资者偏等超高收益资产</td></tr>
              <tr><td><b>0%−2%</b></td><td>正常中性区间，融资条件平衡</td></tr>
              <tr><td><b>&lt; 0%（负实利）</b></td><td>融资条件极度宽松，利于成长股、黄金、商品资产</td></tr>
            </tbody>
          </table>

          <h4>实际利率与名义利率的关系</h4>
          <p>名义利率（10Y 常规国债）≈ <b>实际利率</b> + <b>盈亏平衡率（BEI）</b>（市场对未来 10 年平均通胀的预期）</p>
          <ul>
            <li><b>实际利率上升</b>：融资条件收紧 → 成长股估值 PE 承压，黄金承压</li>
            <li><b>实际利率下降</b>：融资条件宽松 → 估值分分扩张，黄金弹升</li>
            <li><b>实际利率上升但名义利率不动</b>：市场在当下不高但通胀预期下降——需警惕需求放缓</li>
          </ul>

          <h4>为什么要单独看 TIPS？</h4>
          <p>名义利率包含通胀预期噪音，实际利率才是市场对货币实质回报要求的"净化"展示，更直接反映融资条件的松紧。</p>

          <p class="shibor-tip">💡 简单记忆：实际利率是股市和黄金的"引力"——负实利时资金涌向风险资产，高实利时资金流回安全资产。</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import axios from 'axios'
import * as echarts from 'echarts'

const doc = ref(null)
const history = ref([])
const loading = ref(false)
const historyLoading = ref(false)
const triggering = ref(false)
const errorMsg = ref('')

// ── raw data charts ───────────────────────────────────────────────────────────
const spreadInfoOpen = ref(false)
const tipsInfoOpen = ref(false)

const chartsOpen = ref(false)
const chartLoading = ref(false)
const chartDays = ref(180)
const chartSpread = ref(null)
const chartTips = ref(null)
let ecSpread = null
let ecTips = null

const RANGE_OPTIONS = [
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: '2Y', days: 730 },
  { label: '3Y', days: 1095 },
]

async function setChartDays(d) {
  chartDays.value = d
  await loadCharts()
}

async function loadAnalysis() {
  loading.value = true
  errorMsg.value = ''
  try {
    const token = localStorage.getItem('access_token')
    const res = await axios.get('/api/macro/analysis/us_macro', {
      headers: { Authorization: `Bearer ${token}` },
    })
    doc.value = res.data
  } catch (e) {
    if (e.response?.status === 404) {
      doc.value = null
    } else {
      errorMsg.value = e.response?.data?.detail || e.message || '加载失败'
    }
  } finally {
    loading.value = false
  }
}

async function loadHistory() {
  historyLoading.value = true
  try {
    const token = localStorage.getItem('access_token')
    const res = await axios.get('/api/macro/analysis/us_macro/history', {
      params: { limit: 30 },
      headers: { Authorization: `Bearer ${token}` },
    })
    history.value = res.data?.data || []
  } catch {
    // 历史加载失败静默处理
  } finally {
    historyLoading.value = false
  }
}

async function triggerAnalysis() {
  triggering.value = true
  errorMsg.value = ''
  try {
    const token = localStorage.getItem('access_token')
    await axios.post('/api/macro/analysis/us_macro/trigger', null, {
      headers: { Authorization: `Bearer ${token}` },
    })
    setTimeout(loadAnalysis, 5000)
  } catch (e) {
    errorMsg.value = e.response?.data?.detail || e.message || '触发失败'
  } finally {
    triggering.value = false
  }
}

function selectHistoryDoc(h) {
  doc.value = h
}

function fmtTime(ts) {
  if (!ts) return ''
  return String(ts).replace('T', ' ').slice(0, 16)
}

function curveClass(shape) {
  if (!shape) return 'macro-card-neutral'
  if (shape.includes('倒挂')) return 'macro-card-hawkish'
  if (shape.includes('陡峭') || shape.includes('正常')) return 'macro-card-dovish'
  return 'macro-card-neutral'
}

async function toggleCharts() {
  chartsOpen.value = !chartsOpen.value
  if (chartsOpen.value) {
    await nextTick()
    await loadCharts()
  }
}

async function loadCharts() {
  chartLoading.value = true
  try {
    const token = localStorage.getItem('access_token')
    const headers = { Authorization: `Bearer ${token}` }
    const [r1, r2] = await Promise.all([
      axios.get('/api/macro/raw-data/us-rates', { params: { data_type: 'tycr',  days: chartDays.value }, headers }),
      axios.get('/api/macro/raw-data/us-rates', { params: { data_type: 'trycr', days: chartDays.value }, headers }),
    ])

    // Chart 1: 2Y / 10Y yields + spread
    const rows1  = r1.data?.data || []
    const dates1 = rows1.map(r => String(r.date).slice(0, 10))
    const y2     = rows1.map(r => r.y2  != null ? +r.y2  : null)
    const y10    = rows1.map(r => r.y10 != null ? +r.y10 : null)
    const spread = rows1.map((_, i) =>
      (y10[i] != null && y2[i] != null) ? +(y10[i] - y2[i]).toFixed(3) : null
    )
    if (chartSpread.value) {
      if (!ecSpread) ecSpread = echarts.init(chartSpread.value)
      ecSpread.setOption({
        animation: false,
        grid: { top: 30, right: 60, bottom: 24, left: 44 },
        legend: { top: 4, itemWidth: 12, itemHeight: 8, textStyle: { fontSize: 10 } },
        tooltip: { trigger: 'axis', textStyle: { fontSize: 10 } },
        xAxis: { type: 'category', data: dates1, boundaryGap: false,
          axisLabel: { fontSize: 9, interval: Math.floor(dates1.length / 5) } },
        yAxis: [
          { type: 'value', name: '%', nameTextStyle: { fontSize: 9 },
            axisLabel: { fontSize: 9, formatter: v => Number(v).toFixed(1) },
            splitLine: { lineStyle: { color: '#eee' } } },
          { type: 'value', name: '利差%', nameTextStyle: { fontSize: 9 },
            axisLabel: { fontSize: 9, formatter: v => Number(v).toFixed(2) },
            splitLine: { show: false } },
        ],
        series: [
          { name: '2Y',    type: 'line', color: '#5c85d6', data: y2,     yAxisIndex: 0,
            symbol: 'none', lineStyle: { width: 1.5, color: '#5c85d6' } },
          { name: '10Y',   type: 'line', color: '#111',    data: y10,    yAxisIndex: 0,
            symbol: 'none', lineStyle: { width: 1.5, color: '#111' } },
          { name: '10Y-2Y', type: 'line', color: '#c62828', data: spread, yAxisIndex: 1,
            symbol: 'none', lineStyle: { width: 1, color: '#c62828', type: 'dashed' },
            areaStyle: { color: 'rgba(198,40,40,0.07)' } },
        ],
      })
    }

    // Chart 2: TIPS 10Y real rate
    const rows2  = r2.data?.data || []
    const dates2 = rows2.map(r => String(r.date).slice(0, 10))
    const tips10 = rows2.map(r => r.y10 != null ? +r.y10 : null)
    if (chartTips.value) {
      if (!ecTips) ecTips = echarts.init(chartTips.value)
      ecTips.setOption({
        animation: false,
        grid: { top: 30, right: 14, bottom: 24, left: 44 },
        legend: { top: 4, itemWidth: 12, itemHeight: 8, textStyle: { fontSize: 10 } },
        tooltip: { trigger: 'axis', textStyle: { fontSize: 10 } },
        xAxis: { type: 'category', data: dates2, boundaryGap: false,
          axisLabel: { fontSize: 9, interval: Math.floor(dates2.length / 5) } },
        yAxis: { type: 'value', name: '%', nameTextStyle: { fontSize: 9 },
          axisLabel: { fontSize: 9, formatter: v => Number(v).toFixed(2) },
          splitLine: { lineStyle: { color: '#eee' } } },
        series: [
          { name: 'TIPS 10Y', type: 'line', color: '#2e7d32', data: tips10,
            symbol: 'none', lineStyle: { width: 1.5, color: '#2e7d32' },
            areaStyle: { color: 'rgba(46,125,50,0.07)' } },
        ],
      })
    }
  } catch {
    // chart load failures are silent
  } finally {
    chartLoading.value = false
  }
}

onUnmounted(() => {
  ecSpread?.dispose()
  ecTips?.dispose()
})

onMounted(() => {
  loadAnalysis()
})
</script>

<style scoped>
/* ── Shared paper theme (mirrors MarketRiskPanel scoped styles) ── */
.market-risk-panel {
  min-height: 100vh;
  background: #f5f5f5;
}
.mrp-paper {
  background: #ffffff;
  color: #111111;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px 24px;
}
.mrp-h1 {
  font-size: 1.35rem;
  font-weight: 700;
  color: #000;
  margin: 0 0 0.3rem;
}
.mrp-sub {
  font-size: 0.875rem;
  color: #555;
  margin: 0;
}
.mrp-muted   { font-size: 0.85rem; color: #777; }
.mrp-caption { font-size: 0.78rem; color: #888; }
.mrp-btn-sm {
  padding: 3px 10px;
  font-size: 0.78rem;
  border-radius: 3px;
  cursor: pointer;
  border: 1px solid;
  line-height: 1.6;
}
.mrp-btn-dark {
  background: #111;
  color: #fff;
  border-color: #111;
}
.mrp-btn-dark:disabled { opacity: 0.5; cursor: default; }
.mrp-btn-ghost {
  background: transparent;
  color: #333;
  border-color: #ccc;
}
.no-data-hint {
  text-align: center;
  padding: 60px 20px;
  color: #777;
}
.xiv-error-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  font-size: 0.85rem;
  color: #5c2121;
  background: #fff5f5;
  border: 1px solid #e0b4b4;
  border-radius: 3px;
}
.xiv-error-dismiss {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: #666;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}
.xiv-error-dismiss:hover { color: #111; }

/* ── Paper container (same as MarketRiskPanel) ── */
.macro-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 12px;
  margin-bottom: 0;
}

/* ── Signal cards ── */
.macro-card {
  background: #fafafa;
  border: 1px solid #ddd;
  border-left: 4px solid #bbb;
  border-radius: 4px;
  padding: 12px 14px;
  height: 100%;
  min-height: 90px;
}
.macro-card-dovish  { border-left-color: #2e7d32; }
.macro-card-hawkish { border-left-color: #c62828; }
.macro-card-neutral { border-left-color: #bbb; }

.macro-card-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #888;
  margin-bottom: 6px;
}
.macro-card-value {
  font-size: 0.92rem;
  font-weight: 600;
  color: #111;
  line-height: 1.4;
}
.text-sm { font-size: 0.82rem; font-weight: 400; }

/* ── Analysis blocks ── */
.macro-block {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 14px 16px;
  height: 100%;
}
.macro-block-highlight { border-left: 3px solid #1565c0; }
.macro-block-summary   { border-left: 3px solid #111; }

.macro-block-title {
  font-size: 0.78rem;
  font-weight: 700;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 8px;
}
.macro-block-text {
  font-size: 0.88rem;
  color: #111;
  line-height: 1.65;
  margin: 0;
}

/* ── History strip ── */
.macro-history-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.macro-history-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.macro-history-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.macro-history-item {
  padding: 3px 10px;
  border-radius: 3px;
  border: 1px solid #ccc;
  background: #fff;
  font-size: 0.78rem;
  color: #333;
  cursor: pointer;
  transition: background 0.12s;
}
.macro-history-item:hover { background: #f5f5f5; }
.macro-history-active {
  background: #111;
  color: #fff;
  border-color: #111;
}

/* ── Chart section ── */
.chart-range-bar { display: flex; gap: 5px; padding: 4px 0; }
.chart-range-btn {
  font-size: 0.72rem;
  padding: 2px 10px;
  border: 1px solid #ddd;
  border-radius: 3px;
  background: #fff;
  color: #555;
  cursor: pointer;
  line-height: 1.6;
  transition: background 0.15s, color 0.15s;
}
.chart-range-btn.active { background: #111; color: #fff; border-color: #111; }
.chart-range-btn:hover:not(.active) { border-color: #888; color: #111; }

.chart-toggle-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  border-top: 1px solid #efefef;
  cursor: pointer;
  user-select: none;
}
.chart-toggle-arrow { font-size: 0.68rem; color: #aaa; }
.chart-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
@media (max-width: 640px) { .chart-row { grid-template-columns: 1fr; } }
.chart-wrap { position: relative; }
.chart-label {
  font-size: 0.70rem;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 3px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.info-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid #aaa;
  background: transparent;
  color: #aaa;
  font-size: 0.60rem;
  font-weight: 700;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  flex-shrink: 0;
  transition: border-color 0.15s, color 0.15s;
}
.info-btn:hover { border-color: #555; color: #555; }
.shibor-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.shibor-modal {
  background: #fff;
  border-radius: 8px;
  max-width: 600px;
  width: 100%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
}
.shibor-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px 10px;
  border-bottom: 1px solid #eee;
  font-size: 0.95rem;
  font-weight: 600;
  color: #222;
}
.shibor-modal-close {
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  color: #999;
  padding: 0 4px;
  line-height: 1;
}
.shibor-modal-close:hover { color: #333; }
.shibor-modal-body {
  padding: 16px 18px;
  overflow-y: auto;
  font-size: 0.84rem;
  line-height: 1.7;
  color: #333;
}
.shibor-modal-body p { margin: 0 0 8px; }
.shibor-modal-body h4 { margin: 14px 0 6px; font-size: 0.86rem; color: #111; }
.shibor-modal-body ul { margin: 0 0 8px; padding-left: 18px; }
.shibor-modal-body li { margin-bottom: 4px; }
.shibor-table {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0 14px;
  font-size: 0.82rem;
}
.shibor-table th, .shibor-table td {
  border: 1px solid #e0e0e0;
  padding: 5px 10px;
  text-align: left;
}
.shibor-table thead { background: #f5f5f5; font-weight: 600; }
.shibor-tip {
  background: #f9f9e8;
  border-left: 3px solid #d4b800;
  padding: 8px 12px;
  border-radius: 3px;
  margin-top: 10px !important;
  color: #555;
}
.chart-canvas {
  width: 100%;
  height: 170px;
  border: 1px solid #efefef;
  border-radius: 3px;
}
.chart-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  color: #aaa;
  background: rgba(255,255,255,0.85);
}
</style>
