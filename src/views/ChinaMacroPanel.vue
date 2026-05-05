<template>
  <v-container fluid class="market-risk-panel pa-4">
    <div class="mrp-paper">

      <!-- 标题栏 -->
      <v-row class="mb-4">
        <v-col cols="12" md="8">
          <h1 class="mrp-h1">🇨🇳 中国宏观</h1>
          <p class="mrp-sub">Shibor · LPR · PMI · CPI/PPI · M/社融 · GDP · 民间利率 — LLM 深度解读</p>
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
        <p class="mrp-caption">点击「触发分析」生成今日宏观解读，或等待每日 19:45 自动任务</p>
      </div>

      <!-- 分析结果 -->
      <template v-else>
        <!-- 元信息 -->
        <div class="macro-meta mb-4">
          <span class="mrp-caption">分析日期：{{ doc.analysis_date }}</span>
          <span class="mrp-caption ml-4" v-if="doc.model">模型：{{ doc.model }}</span>
          <span class="mrp-caption ml-4" v-if="doc.created_at">生成于：{{ fmtTime(doc.created_at) }}</span>
        </div>

        <!-- 核心信号卡片行 -->
        <v-row class="mb-4">
          <!-- 货币政策取向 -->
          <v-col cols="12" sm="6" md="4" lg="3">
            <div class="macro-card" :class="stanceClass(doc.analysis?.policy_stance)">
              <div class="macro-card-label">货币政策取向</div>
              <div class="macro-card-value">{{ doc.analysis?.policy_stance || '—' }}</div>
            </div>
          </v-col>
          <!-- 政策空间 -->
          <v-col cols="12" sm="6" md="4" lg="3">
            <div class="macro-card macro-card-neutral">
              <div class="macro-card-label">政策空间</div>
              <div class="macro-card-value text-sm">{{ doc.analysis?.policy_room || '—' }}</div>
            </div>
          </v-col>
          <!-- 民间信用成本 -->
          <v-col cols="12" sm="6" md="4" lg="3">
            <div class="macro-card macro-card-neutral">
              <div class="macro-card-label">民间信用成本</div>
              <div class="macro-card-value text-sm">{{ doc.analysis?.credit_cost || '—' }}</div>
            </div>
          </v-col>
          <!-- 近期关注点 -->
          <v-col cols="12" sm="6" md="4" lg="3">
            <div class="macro-card macro-card-neutral">
              <div class="macro-card-label">近期关注点</div>
              <div class="macro-card-value text-sm">
                <template v-if="Array.isArray(doc.analysis?.watch_points)">
                  <div v-for="(w, i) in doc.analysis.watch_points" :key="i">· {{ w }}</div>
                </template>
                <span v-else>—</span>
              </div>
            </div>
          </v-col>
        </v-row>

        <!-- 详细分析区块 -->
        <v-row>
          <v-col cols="12" md="6">
            <div class="macro-block">
              <div class="macro-block-title">💧 流动性状况</div>
              <p class="macro-block-text">{{ doc.analysis?.liquidity || '—' }}</p>
            </div>
          </v-col>
          <v-col cols="12" md="6">
            <div class="macro-block">
              <div class="macro-block-title">📊 通胀格局</div>
              <p class="macro-block-text">{{ doc.analysis?.inflation || '—' }}</p>
            </div>
          </v-col>
          <v-col cols="12" md="6">
            <div class="macro-block">
              <div class="macro-block-title">📈 经济景气度</div>
              <p class="macro-block-text">{{ doc.analysis?.growth_momentum || '—' }}</p>
            </div>
          </v-col>
          <v-col cols="12" md="6">
            <div class="macro-block macro-block-highlight">
              <div class="macro-block-title">🏛️ 对A股的影响</div>
              <p class="macro-block-text">{{ doc.analysis?.stock_market_impact || '—' }}</p>
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
                  Shibor · ON / 1W / 1M / 3M
                  <button class="info-btn" @click.stop="shiborInfoOpen = true" title="什么是 Shibor？">?</button>
                </div>
                <div class="chart-canvas" ref="chartShibor" />
                <div v-if="chartLoading" class="chart-loading">加载中…</div>
              </div>
              <div class="chart-wrap">
                <div class="chart-label">
                  LPR · 1年期 / 5年期
                  <button class="info-btn" @click.stop="lprInfoOpen = true" title="什么是 LPR？">?</button>
                </div>
                <div class="chart-canvas" ref="chartLpr" />
              </div>
              </div>
            </div>
          </v-col>
        </v-row>

      </template>

    </div>
  </v-container>

  <!-- LPR 说明弹窗 -->
  <Teleport to="body">
    <div v-if="lprInfoOpen" class="shibor-modal-overlay" @click.self="lprInfoOpen = false">
      <div class="shibor-modal">
        <div class="shibor-modal-header">
          <span>LPR 利率说明</span>
          <button class="shibor-modal-close" @click="lprInfoOpen = false">✕</button>
        </div>
        <div class="shibor-modal-body">
          <p><strong>LPR（贷款市场报价利率，Loan Prime Rate）</strong>是中国实际贷款利率的基准锚，由 18 家报价行每月 20 日报价，取中位数公布。</p>

          <table class="shibor-table">
            <thead><tr><th>品种</th><th>主要用途</th><th>影响对象</th></tr></thead>
            <tbody>
              <tr><td><b>1年期 LPR</b></td><td>短期/中期贷款定价</td><td>企业经营贷、消费贷、信用卡分期</td></tr>
              <tr><td><b>5年期 LPR</b></td><td>中长期贷款定价</td><td>个人房贷（存量 + 新增）、基础设施贷款</td></tr>
            </tbody>
          </table>

          <h4>LPR 的形成机制</h4>
          <p>LPR = <b>MLF 利率</b>（中期借贷便利，央行政策利率）+ <b>银行加点</b>（反映银行资金成本与风险溢价）</p>
          <p>因此，LPR 下调通常意味着央行先降 MLF，或引导银行压缩加点。</p>

          <h4>两根线的关系</h4>
          <p><b>正常状态</b>：5年期 &gt; 1年期，期限越长利率越高（期限溢价）。</p>
          <p><b>利差收窄</b>：央行着重刺激长期投资/房地产时，往往单独下调 5年期 LPR，两线靠拢。</p>
          <p><b>同步下调</b>：全面宽松信号，企业和居民融资成本均降低。</p>

          <h4>实际分析意义</h4>
          <ul>
            <li><b>1年期 LPR 下调</b>：企业短贷成本降低，有利于中小企业经营和消费信贷扩张。</li>
            <li><b>5年期 LPR 下调</b>：直接降低房贷月供，对楼市需求端是明确刺激信号。</li>
            <li><b>LPR 与 Shibor 3M 的背离</b>：若 Shibor 3M 已下行但 LPR 未动，说明银行加点未压缩，货币政策传导不畅。</li>
            <li><b>LPR 长期不动</b>：反映央行维持中性立场，既不刺激也不收紧。</li>
          </ul>

          <p class="shibor-tip">💡 简单记忆：1年期 LPR 看「企业借钱贵不贵」，5年期 LPR 看「买房月供高不高」，两线一起降是全面宽松，只降5年期是定向托楼市。</p>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- SHIBOR 说明弹窗 -->
  <Teleport to="body">
    <div v-if="shiborInfoOpen" class="shibor-modal-overlay" @click.self="shiborInfoOpen = false">
      <div class="shibor-modal">
        <div class="shibor-modal-header">
          <span>Shibor 利率说明</span>
          <button class="shibor-modal-close" @click="shiborInfoOpen = false">✕</button>
        </div>
        <div class="shibor-modal-body">
          <p><strong>SHIBOR（上海银行间同业拆放利率）</strong>是中国银行间市场的基准利率，类似于美国的 SOFR、欧洲的 EURIBOR。</p>

          <table class="shibor-table">
            <thead><tr><th>代码</th><th>周期</th><th>代表含义</th></tr></thead>
            <tbody>
              <tr><td><b>ON</b></td><td>隔夜（1天）</td><td>银行间最短期资金成本，反映当下流动性是否充裕</td></tr>
              <tr><td><b>1W</b></td><td>7天</td><td>短期流动性预期，跨周/跨月末资金紧张会在此体现</td></tr>
              <tr><td><b>1M</b></td><td>1个月</td><td>月度资金需求，季末/税期压力会推高此利率</td></tr>
              <tr><td><b>3M</b></td><td>3个月</td><td>季度资金成本，与央行 MLF 操作利率高度相关</td></tr>
            </tbody>
          </table>

          <h4>四根线的关系</h4>
          <p><b>正常状态</b>：ON &lt; 1W &lt; 1M &lt; 3M，期限越长利率越高（正常期限溢价）。</p>
          <p><b>流动性紧张</b>：ON / 1W 飙升超过 1M / 3M，出现倒挂 → 市场极度缺短钱（季末、春节前、税期）。</p>
          <p><b>宽松放水</b>：整体曲线下移，ON 接近 3M → 央行通过逆回购大量投放流动性。</p>

          <h4>实际分析意义</h4>
          <ul>
            <li><b>ON / 1W</b>：最灵敏的流动性温度计，日内即可反映央行操作意图。</li>
            <li><b>ON–3M 利差</b>：利差收窄或倒挂是流动性压力的预警信号。</li>
            <li><b>3M Shibor</b>：市场对 MLF 预期的晴雨表，与 LPR 同向运动。</li>
            <li><b>四线分叉扩大</b>：机构间信用分层加剧；<b>四线靠拢</b>：市场平稳。</li>
          </ul>

          <p class="shibor-tip">💡 简单记忆：ON/1W 看「今天缺不缺钱」，1M/3M 看「市场对未来的预期」，四线整体高低看货币政策松紧方向。</p>
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
const chartsOpen = ref(false)
const chartLoading = ref(false)
const chartDays = ref(180)
const shiborInfoOpen = ref(false)
const lprInfoOpen = ref(false)

const chartShibor = ref(null)
const chartLpr = ref(null)
let ecShibor = null
let ecLpr = null

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
    const res = await axios.get('/api/macro/analysis/china_macro', {
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
    const res = await axios.get('/api/macro/analysis/china_macro/history', {
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
    await axios.post('/api/macro/analysis/china_macro/trigger', null, {
      headers: { Authorization: `Bearer ${token}` },
    })
    // 5 秒后刷新，给 worker 一点时间
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

function stanceClass(stance) {
  if (!stance) return 'macro-card-neutral'
  if (stance.includes('宽松')) return 'macro-card-dovish'
  if (stance.includes('收紧')) return 'macro-card-hawkish'
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
      axios.get('/api/macro/raw-data/cn-rates', { params: { data_type: 'shibor',     days: chartDays.value }, headers }),
      axios.get('/api/macro/raw-data/cn-rates', { params: { data_type: 'shibor_lpr', days: chartDays.value }, headers }),
    ])

    // Chart 1: Shibor ON / 1W / 1M / 3M
    const rows1  = r1.data?.data || []
    const dates1 = rows1.map(r => String(r.date).slice(0, 10))
    if (chartShibor.value) {
      if (!ecShibor) ecShibor = echarts.init(chartShibor.value)
      ecShibor.setOption({
        animation: false,
        grid: { top: 30, right: 14, bottom: 24, left: 44 },
        legend: { top: 4, itemWidth: 12, itemHeight: 8, textStyle: { fontSize: 10 } },
        tooltip: { trigger: 'axis', textStyle: { fontSize: 10 } },
        xAxis: { type: 'category', data: dates1, boundaryGap: false,
          axisLabel: { fontSize: 9, interval: Math.floor(dates1.length / 5) } },
        yAxis: { type: 'value', name: '%', nameTextStyle: { fontSize: 9 },
          axisLabel: { fontSize: 9, formatter: v => Number(v).toFixed(2) },
          splitLine: { lineStyle: { color: '#eee' } } },
        series: [
          { name: 'ON', type: 'line', color: '#5c85d6',
            data: rows1.map(r => r.on   != null ? +r.on        : null),
            symbol: 'none', lineStyle: { width: 1.5, color: '#5c85d6' } },
          { name: '1W', type: 'line', color: '#e65100',
            data: rows1.map(r => r['1w'] != null ? +r['1w']    : null),
            symbol: 'none', lineStyle: { width: 1.5, color: '#e65100' } },
          { name: '1M', type: 'line', color: '#111',
            data: rows1.map(r => r['1m'] != null ? +r['1m']    : null),
            symbol: 'none', lineStyle: { width: 1.5, color: '#111' } },
          { name: '3M', type: 'line', color: '#2e7d32',
            data: rows1.map(r => r['3m'] != null ? +r['3m']    : null),
            symbol: 'none', lineStyle: { width: 1.5, color: '#2e7d32' } },
        ],
      })
    }

    // Chart 2: LPR 1Y / 5Y (step line — only changes on policy dates)
    const rows2  = r2.data?.data || []
    const dates2 = rows2.map(r => String(r.date).slice(0, 10))
    if (chartLpr.value) {
      if (!ecLpr) ecLpr = echarts.init(chartLpr.value)
      ecLpr.setOption({
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
          { name: 'LPR 1Y', type: 'line', color: '#1565c0',
            data: rows2.map(r => r['1y'] != null ? +r['1y'] : null),
            symbol: 'none', step: 'end', lineStyle: { width: 1.5, color: '#1565c0' } },
          { name: 'LPR 5Y', type: 'line', color: '#c62828',
            data: rows2.map(r => r['5y'] != null ? +r['5y'] : null),
            symbol: 'none', step: 'end', lineStyle: { width: 1.5, color: '#c62828' } },
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
  ecShibor?.dispose()
  ecLpr?.dispose()
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
