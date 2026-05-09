<template>
  <v-container fluid class="market-risk-panel pa-4">
    <div class="mrp-paper">
    <!-- 标题栏 -->
    <v-row class="mb-4">
      <v-col cols="12" md="6">
        <h1 class="mrp-h1">
          🚨 市场风险预警
          <span v-if="selectedDate" class="mrp-date-sub">
            {{ formatDisplayDate(selectedDate) }}
          </span>
        </h1>
        <p class="mrp-sub">A股多行业量化风险扫描 · 5大信号 · 每日收盘后更新</p>
      </v-col>
      <v-col cols="12" md="6" class="d-flex align-center justify-end gap-2">
        <input
          v-model="selectedDate"
          type="date"
          class="mrp-date-input"
          @change="loadOverview"
        />
        <button class="mrp-btn-sm mrp-btn-ghost" :disabled="overviewLoading" @click="loadOverview">
          🔄
        </button>
      </v-col>
    </v-row>

    <!-- 加载中 -->
    <v-row v-if="overviewLoading">
      <v-col v-for="i in 7" :key="i" cols="12" sm="6" md="4" lg="3">
        <v-skeleton-loader type="card" />
      </v-col>
    </v-row>

    <!-- 无数据 -->
    <v-row v-if="!overviewLoading && sectors.length === 0">
      <v-col cols="12">
        <div class="no-data-hint">
          <v-icon size="48" color="grey" :icon="mdiChartTimelineVariant" />
          <p class="mrp-muted mt-2">{{ selectedDate }} 暂无扫描数据</p>
          <p class="mrp-caption">每日 19:30 收盘后自动扫描，或联系管理员手动触发</p>
        </div>
      </v-col>
    </v-row>

    <!-- 市场 Tab 切换 -->
    <v-row v-if="!overviewLoading && sectors.length > 0" class="mb-2">
      <v-col cols="12">
        <div class="market-tabs">
          <button
            class="market-tab"
            :class="{ 'market-tab-active': marketTab === 'us' }"
            @click="switchMarketTab('us')"
          >
            🇺🇸 美股板块
            <span class="tab-count">{{ usSectors.length }}</span>
          </button>
          <button
            class="market-tab"
            :class="{ 'market-tab-active': marketTab === 'a' }"
            @click="switchMarketTab('a')"
          >
            🇨🇳 A股板块
            <span class="tab-count">{{ aShareSectors.length }}</span>
          </button>
          <div class="tab-spacer" />
          <button
            class="mrp-btn-sm mrp-btn-dark"
            :disabled="triggeringMarket"
            @click="triggerMarketDaily"
            :title="marketTab === 'us' ? '触发美股市场 LLM 日报解读' : '触发A股市场 LLM 日报解读'"
          >🤖 {{ marketTab === 'us' ? '美股日报' : 'A股日报' }}</button>
        </div>
      </v-col>
    </v-row>

    <!-- A股波动率分析卡片（A股Tab专属，置顶） -->
    <v-row v-if="!overviewLoading && marketTab === 'a'" class="mb-2">
      <v-col cols="12">
        <IVAnalysisCard />
      </v-col>
    </v-row>

    <!-- 行业卡片概览 -->
    <v-row v-if="!overviewLoading && sectors.length > 0">
      <v-col
        v-for="s in visibleSectors"
        :key="s.sector"
        cols="12" sm="6" md="4" lg="3"
      >
        <div
          class="sector-card"
          :class="riskLevelClass(s.overall_risk_level)"
          @click="openDetail(s.sector)"
        >
          <div class="sc-header">
            <span class="sc-name">{{ sectorLabel(s.sector) }}</span>
            <span class="sc-badge" :class="'badge-' + (s.overall_risk_level || 'unknown')">
              {{ riskLabel(s.overall_risk_level) }}
            </span>
          </div>
          <div class="score-row">
            <span class="score-number">{{ (s.overall_risk_score || 0).toFixed(1) }}</span>
            <div class="score-bar-track">
              <div
                class="score-bar-fill"
                :class="'fill-' + (s.overall_risk_level || 'unknown')"
                :style="{ width: (s.overall_risk_score || 0) + '%' }"
              />
            </div>
          </div>
          <div v-if="s.warnings?.length" class="sc-warn">
            ⚠️ {{ s.warnings.length }} 个预警
          </div>
        </div>
      </v-col>
    </v-row>

    <!-- 全市场日报解读 -->
    <v-row v-if="tabAnalysis" class="mt-3 mb-1">
      <v-col cols="12">
        <div class="detail-paper">
          <div class="detail-header">
            <span class="detail-title">🤖 {{ marketTab === 'us' ? '美股板块' : 'A股板块' }}风险日报解读</span>
            <div class="d-flex align-center gap-2">
              <span class="mrp-caption">{{ tabAnalysis.model }} · {{ (tabAnalysis.generated_at || '').slice(0, 16) }}</span>
              <button class="mrp-btn-sm mrp-btn-ghost" @click="refreshMarketAnalysis" title="刷新日报解读">↻</button>
            </div>
          </div>
          <div class="detail-divider" />
          <div class="mda-body">
            <p class="mda-summary">{{ tabAnalysis.market_summary }}</p>
            <div class="mda-grid mt-2">
              <!-- 风险分布 + 情绪 -->
              <div class="mda-block">
                <div class="signal-title">📊 风险分布</div>
                <div class="mda-chips mt-1" v-if="tabAnalysis.risk_distribution">
                  <span class="mda-chip mda-chip-low">低风险 {{ (tabAnalysis.risk_distribution.low ?? []).length }}</span>
                  <span class="mda-chip mda-chip-medium">中等 {{ (tabAnalysis.risk_distribution.medium ?? []).length }}</span>
                  <span class="mda-chip mda-chip-high">高风险 {{ (tabAnalysis.risk_distribution.high ?? []).length }}</span>
                  <span v-if="(tabAnalysis.risk_distribution.extreme ?? []).length" class="mda-chip mda-chip-extreme">极端 {{ (tabAnalysis.risk_distribution.extreme ?? []).length }}</span>
                </div>
                <div class="mrp-caption mt-1" v-if="tabAnalysis.risk_distribution?.dominant_risk">
                  主导：{{ tabAnalysis.risk_distribution.dominant_risk }}
                </div>
                <div class="signal-title mt-2">💬 市场情绪</div>
                <span class="mda-sentiment-chip mt-1" :class="sentimentClass(tabAnalysis.market_sentiment)">
                  {{ tabAnalysis.market_sentiment }}
                </span>
              </div>
              <!-- 主要风险 -->
              <div class="mda-block" v-if="tabAnalysis.top_risks?.length">
                <div class="signal-title">⚠️ 主要风险</div>
                <ul class="mda-list mt-1">
                  <li v-for="(r, i) in tabAnalysis.top_risks" :key="i">
                    <strong>{{ r.sector_name || r.sector }}</strong>
                    <span class="mrp-caption ml-1">({{ r.score?.toFixed(1) }}分)</span>
                    — {{ r.reason }}
                  </li>
                </ul>
              </div>
              <!-- 综合建议 -->
              <div class="mda-block">
                <div class="signal-title">📌 综合建议</div>
                <p class="mrp-caption mt-1">{{ tabAnalysis.overall_advice }}</p>
              </div>
              <!-- A股IV温度计 -->
              <div class="mda-block" v-if="tabAnalysis.iv_snapshot?.available">
                <div class="signal-title">📊 A股波动率温度计</div>
                <div class="iv-badge mt-1" :class="'iv-badge--' + tabAnalysis.iv_snapshot.level">
                  <span class="iv-badge__val">{{ tabAnalysis.iv_snapshot.source === 'HV' ? 'HV20' : 'IV' }} {{ tabAnalysis.iv_snapshot.iv_30 }}%</span>
                  <span class="iv-badge__label">{{ tabAnalysis.iv_snapshot.underlying }} · {{ tabAnalysis.iv_snapshot.level_zh }}</span>
                  <span class="iv-badge__skew" v-if="tabAnalysis.iv_snapshot.skew_pp !== null">认沽偏度 {{ tabAnalysis.iv_snapshot.skew_pp > 0 ? '+' : '' }}{{ tabAnalysis.iv_snapshot.skew_pp }}pp</span>
                </div>
                <div v-if="Object.keys(tabAnalysis.iv_snapshot.indices || {}).length > 1" class="iv-multi-row mt-1">
                  <span
                    v-for="(idx, key) in tabAnalysis.iv_snapshot.indices"
                    :key="key"
                    class="iv-mini"
                    :class="'iv-mini--' + idx.level"
                  >{{ idx.name }}&nbsp;{{ idx.iv_30 }}%</span>
                </div>
              </div>
              <!-- 重点关注 -->
              <div class="mda-block" v-if="tabAnalysis.key_watchpoints?.length">
                <div class="signal-title">🔍 重点关注</div>
                <ul class="mda-list mt-1">
                  <li v-for="(w, i) in tabAnalysis.key_watchpoints" :key="i">{{ w }}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </v-col>
    </v-row>

    <!-- 详情面板 + 趋势图 -->
    <v-row v-if="activeSector" class="mt-4">
      <!-- 左：信号详情 -->
      <v-col cols="12" md="6">
        <div class="detail-paper">
          <div class="detail-header">
            <span class="detail-title">{{ sectorLabel(activeSector) }} — 信号详情</span>
            <div class="d-flex gap-2">
              <button class="mrp-btn-sm mrp-btn-dark" :disabled="triggeringSector" @click="triggerSectorAnalysis">
                {{ triggeringSector ? '提交中…' : '🤖 LLM解读' }}
              </button>
              <button class="mrp-btn-sm mrp-btn-ghost" @click="activeSector = null">✕</button>
            </div>
          </div>
          <div class="detail-divider" />

          <div v-if="detailLoading" class="detail-body">
            <p class="mrp-muted">加载中…</p>
          </div>

          <div v-else-if="detail" class="detail-body">
            <!-- Signal 1: MA 偏离 -->
            <div class="signal-block" v-if="detail.signals?.ma_deviation?.length">
              <div class="signal-title">📐 信号1：均线偏离</div>
              <div v-for="sig in detail.signals.ma_deviation" :key="sig.ts_code" class="signal-row">
                <span class="sig-name">{{ sig.name }}</span>
                <span class="sig-value" :class="deviationClass(sig.deviation_pct)">
                  {{ (sig.deviation_pct * 100).toFixed(1) }}%
                </span>
                <span class="sig-chip" :class="'chip-' + (sig.risk_level || 'unknown')">
                  {{ riskLabel(sig.risk_level) }}
                </span>
              </div>
            </div>

            <!-- Signal 2: RSI -->
            <div class="signal-block" v-if="detail.signals?.rsi_signals?.length">
              <div class="signal-title">📊 信号2：RSI 超买超卖</div>
              <div v-for="sig in detail.signals.rsi_signals" :key="sig.ts_code" class="signal-row">
                <span class="sig-name">{{ sig.name }}</span>
                <span class="sig-value" :class="rsiClass(sig.rsi)">{{ sig.rsi?.toFixed(1) }}</span>
                <span class="sig-chip" :class="'chip-rsi-' + rsiLabel(sig.rsi)">
                  {{ rsiLabel(sig.rsi) }}
                </span>
              </div>
            </div>

            <!-- Signal 3: 成交量热度 -->
            <div class="signal-block" v-if="detail.signals?.speculation_heat?.length">
              <div class="signal-title">🔥 信号3：成交量热度</div>
              <div v-for="sig in detail.signals.speculation_heat" :key="sig.ts_code" class="signal-row">
                <span class="sig-name">{{ sig.name }}</span>
                <span class="sig-value" :class="volClass(sig.turnover_rate)">
                  {{ sig.turnover_rate?.toFixed(2) }}x
                </span>
                <span class="mrp-muted ml-1">({{ sig.percentile?.toFixed(0) }}th pct)</span>
              </div>
            </div>

            <!-- Signal 4: 因子拥挤 -->
            <div class="signal-block" v-if="detail.signals?.factor_crowding">
              <div class="signal-title">👥 信号4：全市场拥挤度</div>
              <div class="signal-row">
                <span class="sig-name">拥挤分位</span>
                <span class="sig-value">
                  {{ (detail.signals.factor_crowding.crowding_percentile || 0).toFixed(0) }}th
                </span>
                <span class="sig-chip" :class="'chip-' + (detail.signals.factor_crowding.risk_level || 'unknown')">
                  {{ riskLabel(detail.signals.factor_crowding.risk_level) }}
                </span>
              </div>
              <div class="mrp-caption mt-1">
                拥挤股票：{{ detail.signals.factor_crowding.crowded_stocks?.slice(0,5).join(', ') || '无' }}
              </div>
            </div>

            <!-- Signal 5: 相对强弱 -->
            <div class="signal-block" v-if="detail.signals?.tech_relative_strength">
              <div class="signal-title">⚡ 信号5：板块相对强弱</div>
              <div class="signal-row">
                <span class="sig-name">vs 基准</span>
                <span
                  class="sig-value"
                  :class="detail.signals.tech_relative_strength.relative_return >= 0 ? 'val-pos' : 'val-neg'"
                >
                  {{ (detail.signals.tech_relative_strength.relative_return * 100).toFixed(1) }}%
                </span>
                <span class="mrp-caption ml-1">({{ detail.signals.tech_relative_strength.period }}日)</span>
              </div>
            </div>

            <!-- 预警列表 -->
            <div v-if="detail.warnings?.length" class="mt-3">
              <div class="signal-title">⚠️ 预警信息</div>
              <div v-for="(w, i) in detail.warnings" :key="i" class="warn-item mt-1">
                • {{ w }}
              </div>
            </div>

            <!-- LLM 解读（若已有） -->
            <div v-if="detail.llm_analysis" class="llm-block mt-3">
              <div class="llm-header">
                <span class="signal-title">🤖 AI 解读</span>
                <span class="mrp-caption">{{ detail.llm_analysis.model }} · {{ (detail.llm_analysis.generated_at || '').slice(0,16) }}
                  <span class="llm-conf" :class="'conf-' + (detail.llm_analysis.analysis?.confidence || '')">
                    置信度：{{ detail.llm_analysis.analysis?.confidence || 'N/A' }}
                  </span>
                </span>
              </div>
              <!-- 风险摘要 -->
              <p class="llm-summary mt-1">{{ detail.llm_analysis.analysis?.risk_summary }}</p>
              <!-- 主要风险 -->
              <div v-if="detail.llm_analysis.analysis?.key_risks?.length" class="mt-2">
                <div class="llm-section-title">⚠️ 主要风险</div>
                <ul class="llm-list">
                  <li v-for="(r, i) in detail.llm_analysis.analysis.key_risks" :key="i">{{ r }}</li>
                </ul>
              </div>
              <!-- 信号解读 -->
              <div v-if="detail.llm_analysis.analysis?.signal_interpretation" class="mt-2">
                <div class="llm-section-title">🔍 信号解读</div>
                <div class="llm-interp-grid">
                  <div v-for="(val, key) in detail.llm_analysis.analysis.signal_interpretation" :key="key" class="llm-interp-item">
                    <span class="llm-interp-key">{{ interpLabel(key) }}</span>
                    <span class="llm-interp-val">{{ val }}</span>
                  </div>
                </div>
              </div>
              <!-- 操作建议 + 1周展望 -->
              <div class="llm-advice-row mt-2">
                <div v-if="detail.llm_analysis.analysis?.actionable_advice" class="llm-advice-block">
                  <div class="llm-section-title">📌 操作建议</div>
                  <p class="llm-interp-val mt-1">{{ detail.llm_analysis.analysis.actionable_advice }}</p>
                </div>
                <div v-if="detail.llm_analysis.analysis?.outlook_1w" class="llm-advice-block">
                  <div class="llm-section-title">📅 1周展望</div>
                  <p class="llm-interp-val mt-1">{{ detail.llm_analysis.analysis.outlook_1w }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </v-col>

      <!-- 右：趋势图 -->
      <v-col cols="12" md="6">
        <div class="detail-paper">
          <div class="detail-header">
            <span class="detail-title">{{ sectorLabel(activeSector) }} — 风险趋势</span>
            <div class="trend-tabs">
              <button
                v-for="d in [30, 60, 90]"
                :key="d"
                class="trend-tab"
                :class="{ 'trend-tab-active': trendDays === d }"
                :disabled="trendLoading"
                @click="switchTrendDays(d)"
              >{{ d }}日</button>
            </div>
          </div>
          <div class="detail-divider" />
          <div class="detail-body">
            <p v-if="trendLoading" class="mrp-muted">加载中…</p>
            <canvas v-else-if="trendData.length" ref="trendChart" height="220" style="width:100%" />
            <p v-else class="mrp-muted text-center">暂无趋势数据</p>
          </div>
        </div>
      </v-col>
    </v-row>

    <!-- 操作结果提示 -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000" location="top">
      {{ snackbar.message }}
    </v-snackbar>
    </div><!-- /mrp-paper -->
  </v-container>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { mdiChartTimelineVariant } from '@mdi/js'
import IVAnalysisCard from '../components/IVAnalysisCard.vue'
import {
  getRiskOverview,
  getRiskDetail,
  getRiskTrend,
  triggerRiskAnalysis,
  triggerMarketDailyAnalysis,
  getMarketDailyAnalysis,
  triggerUsMarketDailyAnalysis,
  getUsMarketDailyAnalysis,
} from '../api/riskReport.js'

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const today = new Date().toISOString().slice(0, 10)
const selectedDate = ref(today)

const sectors = ref([])
const overviewLoading = ref(false)

const activeSector = ref(null)
const detail = ref(null)
const detailLoading = ref(false)

const trendData = ref([])
const trendLoading = ref(false)
const trendChart = ref(null)
const trendDays = ref(30)

const triggeringSector = ref(false)
const triggeringMarket = ref(false)

const marketAnalysis = ref(null)
const usMarketAnalysis = ref(null)
const marketTab = ref('us')  // 'us' = 美股（默认，美股是A股风向标）, 'a' = A股

const snackbar = ref({ show: false, message: '', color: 'success' })

// ---------------------------------------------------------------------------
// Sector grouping
// ---------------------------------------------------------------------------
const aShareSectors = computed(() => sectors.value.filter(s => !s.sector.startsWith('us_')))
const usSectors     = computed(() => sectors.value.filter(s => s.sector.startsWith('us_')))
const visibleSectors = computed(() => marketTab.value === 'us' ? usSectors.value : aShareSectors.value)

// Filter market daily analysis to match the active tab
const tabAnalysis = computed(() => {
  if (marketTab.value === 'us') {
    if (!usMarketAnalysis.value) return null
    const rd = usMarketAnalysis.value.risk_distribution
    return {
      ...usMarketAnalysis.value,
      risk_distribution: rd ? {
        low:     (rd.low     || []),
        medium:  (rd.medium  || []),
        high:    (rd.high    || []),
        extreme: (rd.extreme || []),
        dominant_risk: rd.dominant_risk,
      } : null,
    }
  }
  if (!marketAnalysis.value) return null
  const keep = (key) => !key.startsWith('us_')
  const rd = marketAnalysis.value.risk_distribution
  return {
    ...marketAnalysis.value,
    top_risks: (marketAnalysis.value.top_risks || []).filter(r => keep(r.sector)),
    risk_distribution: rd ? {
      low:     (rd.low     || []).filter(keep),
      medium:  (rd.medium  || []).filter(keep),
      high:    (rd.high    || []).filter(keep),
      extreme: (rd.extreme || []).filter(keep),
      dominant_risk: rd.dominant_risk,
    } : null,
  }
})

// ---------------------------------------------------------------------------
// Sector metadata
// ---------------------------------------------------------------------------
const SECTOR_LABELS = {
  semicon:    '半导体芯片',
  semicon_eq: '半导体设备',
  finance:    '金融',
  consumer:   '消费',
  healthcare: '医药医疗',
  nev:        '新能源',
  robot:      '机器人',
  tourism:    '旅游',
  aerospace:  '航空航天',
  us_semicon: '🇺🇸 美股半导体',
  us_tech:    '🇺🇸 美股科技',
  us_macro:   '🇺🇸 美股宏观',
}
const sectorLabel = (key) => SECTOR_LABELS[key] || key

// ---------------------------------------------------------------------------
// Risk helpers
// ---------------------------------------------------------------------------
const RISK_COLORS = { low: 'success', medium: 'warning', high: 'error', extreme: 'deep-purple' }
const RISK_LABELS = { low: '低风险', medium: '中等', high: '高风险', extreme: '极端' }
const RISK_CLASSES = { low: 'risk-low', medium: 'risk-medium', high: 'risk-high', extreme: 'risk-extreme' }

const riskColor = (level) => RISK_COLORS[level] || 'grey'
const riskLabel = (level) => RISK_LABELS[level] || level || '未知'
const riskLevelClass = (level) => RISK_CLASSES[level] || ''

const deviationClass = (pct) => {
  if (pct === null || pct === undefined) return ''
  return Math.abs(pct) >= 0.15 ? 'text-red' : Math.abs(pct) >= 0.10 ? 'text-orange' : 'text-green'
}

const rsiClass = (rsi) => {
  if (rsi === null || rsi === undefined) return ''
  return rsi >= 70 ? 'text-red' : rsi <= 30 ? 'text-blue' : 'text-green'
}
const rsiChipColor = (rsi) => rsi >= 70 ? 'error' : rsi <= 30 ? 'info' : 'success'
const rsiLabel = (rsi) => rsi >= 70 ? '超买' : rsi <= 30 ? '超卖' : '中性'

const volClass = (ratio) => ratio >= 2.0 ? 'text-red' : ratio >= 1.5 ? 'text-orange' : 'text-green'

const sentimentClass = (s) => {
  if (!s) return ''
  if (s.includes('偏多')) return 'sentiment-bullish'
  if (s.includes('极度')) return 'sentiment-extreme'
  if (s.includes('偏空')) return 'sentiment-bearish'
  return 'sentiment-neutral'
}

const INTERP_LABELS = {
  ma_deviation:       '均线偏离',
  rsi:                'RSI',
  volume:             '成交量热度',
  crowding:           '因子拥挤',
  relative_strength:  '相对强弱',
}
const interpLabel = (key) => INTERP_LABELS[key] || key

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
const toApiDate = (isoDate) => isoDate?.replace(/-/g, '') || null
const formatDisplayDate = (isoDate) => {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-')
  return `${y}年${m}月${d}日`
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------
async function loadOverview() {
  overviewLoading.value = true
  activeSector.value = null
  detail.value = null
  trendData.value = []
  marketAnalysis.value = null
  usMarketAnalysis.value = null
  try {
    const apiDate = toApiDate(selectedDate.value)
    const [overviewData, analysisData, usAnalysisData] = await Promise.all([
      getRiskOverview(apiDate),
      getMarketDailyAnalysis(apiDate).catch(() => null),
      getUsMarketDailyAnalysis(apiDate).catch(() => null),
    ])
    sectors.value = overviewData.sectors || []
    const doc = analysisData?.analysis || null
    marketAnalysis.value = doc
      ? { ...doc.analysis, model: doc.model, generated_at: doc.generated_at }
      : null
    const usDoc = usAnalysisData?.analysis || null
    usMarketAnalysis.value = usDoc
      ? { ...usDoc.analysis, model: usDoc.model, generated_at: usDoc.generated_at }
      : null
  } catch (e) {
    showSnack(`加载概览失败: ${e.message}`, 'error')
  } finally {
    overviewLoading.value = false
  }
}

async function refreshMarketAnalysis() {
  try {
    const apiDate = toApiDate(selectedDate.value)
    if (marketTab.value === 'us') {
      const res = await getUsMarketDailyAnalysis(apiDate)
      const doc = res?.analysis || null
      usMarketAnalysis.value = doc
        ? { ...doc.analysis, model: doc.model, generated_at: doc.generated_at }
        : null
      if (!usMarketAnalysis.value) showSnack('暂无美股日报解读，请先触发 🤖 美股日报', 'warning')
    } else {
      const res = await getMarketDailyAnalysis(apiDate)
      const doc = res?.analysis || null
      marketAnalysis.value = doc
        ? { ...doc.analysis, model: doc.model, generated_at: doc.generated_at }
        : null
      if (!marketAnalysis.value) showSnack('暂无A股日报解读，请先触发 🤖 A股日报', 'warning')
    }
  } catch (e) {
    showSnack(`刷新失败: ${e.message}`, 'error')
  }
}

async function openDetail(sector) {
  activeSector.value = sector
  detail.value = null
  detailLoading.value = true
  trendData.value = []
  trendLoading.value = true
  trendDays.value = 30

  try {
    const apiDate = toApiDate(selectedDate.value)
    const [d, t] = await Promise.all([
      getRiskDetail(sector, apiDate, true),
      getRiskTrend(sector, trendDays.value),
    ])
    detail.value = d
    trendData.value = t?.data || []
  } catch (e) {
    showSnack(`加载详情失败: ${e.message}`, 'error')
  } finally {
    detailLoading.value = false
    trendLoading.value = false
  }
}

async function switchTrendDays(days) {
  if (days === trendDays.value || !activeSector.value) return
  trendDays.value = days
  trendLoading.value = true
  trendData.value = []
  try {
    const t = await getRiskTrend(activeSector.value, days)
    trendData.value = t?.data || []
  } catch (e) {
    showSnack(`趋势加载失败: ${e.message}`, 'error')
  } finally {
    trendLoading.value = false
  }
}

// ---------------------------------------------------------------------------
// Chart rendering (lightweight canvas, no extra deps)
// ---------------------------------------------------------------------------

// Watch the canvas ref: fires when the element appears in DOM after trendData is set
watch(trendChart, (el) => { if (el) renderChart() })

function renderChart() {
  const canvas = trendChart.value
  if (!canvas || !trendData.value.length) return

  const ctx = canvas.getContext('2d')
  const data = trendData.value
  const scores = data.map(d => d.overall_risk_score || 0)
  const labels = data.map(d => {
    const s = String(d.scan_date)
    return `${s.slice(4, 6)}/${s.slice(6, 8)}`
  })

  // offsetWidth can be 0 on first paint; fall back to parent width or 400
  const W = canvas.offsetWidth || canvas.parentElement?.clientWidth || 400
  const H = 220
  canvas.width = W
  canvas.height = H

  const pad = { top: 20, right: 20, bottom: 30, left: 36 }
  const chartW = W - pad.left - pad.right
  const chartH = H - pad.top - pad.bottom
  const maxScore = 100
  const xStep = chartW / Math.max(scores.length - 1, 1)

  ctx.clearRect(0, 0, W, H)

  // Background risk zones (light theme)
  const zones = [
    { min: 75, max: 100, color: 'rgba(200,0,0,0.06)' },
    { min: 50, max: 75,  color: 'rgba(220,120,0,0.06)' },
    { min: 0,  max: 50,  color: 'rgba(0,150,60,0.05)' },
  ]
  zones.forEach(z => {
    const y1 = pad.top + chartH * (1 - z.max / maxScore)
    const y2 = pad.top + chartH * (1 - z.min / maxScore)
    ctx.fillStyle = z.color
    ctx.fillRect(pad.left, y1, chartW, y2 - y1)
  })

  // Gridlines
  ctx.strokeStyle = 'rgba(0,0,0,0.1)'
  ctx.lineWidth = 1
  ;[25, 50, 75].forEach(v => {
    const y = pad.top + chartH * (1 - v / maxScore)
    ctx.beginPath()
    ctx.moveTo(pad.left, y)
    ctx.lineTo(pad.left + chartW, y)
    ctx.stroke()
    ctx.fillStyle = '#888'
    ctx.font = '10px sans-serif'
    ctx.fillText(String(v), 2, y + 4)
  })

  // Line
  ctx.beginPath()
  ctx.strokeStyle = '#1565c0'
  ctx.lineWidth = 2
  scores.forEach((s, i) => {
    const x = pad.left + i * xStep
    const y = pad.top + chartH * (1 - s / maxScore)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.stroke()

  // Dots + x-labels
  scores.forEach((s, i) => {
    const x = pad.left + i * xStep
    const y = pad.top + chartH * (1 - s / maxScore)

    // dot
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fillStyle = s >= 75 ? '#ef5350' : s >= 50 ? '#ffa726' : '#66bb6a'
    ctx.fill()

    // x-label every ~5 points
    if (i % Math.max(1, Math.floor(scores.length / 6)) === 0) {
      ctx.fillStyle = '#666'
      ctx.font = '9px sans-serif'
      ctx.fillText(labels[i], x - 12, H - 6)
    }
  })
}

function switchMarketTab(tab) {
  marketTab.value = tab
  activeSector.value = null
}

// ---------------------------------------------------------------------------
// LLM triggers
// ---------------------------------------------------------------------------
async function triggerSectorAnalysis() {
  if (!activeSector.value) return
  triggeringSector.value = true
  try {
    const apiDate = toApiDate(selectedDate.value)
    await triggerRiskAnalysis(activeSector.value, apiDate)
    showSnack('LLM 分析任务已提交，结果将在几分钟后更新', 'success')
  } catch (e) {
    showSnack(`提交失败: ${e.message}`, 'error')
  } finally {
    triggeringSector.value = false
  }
}

async function triggerMarketDaily() {
  triggeringMarket.value = true
  try {
    const apiDate = toApiDate(selectedDate.value)
    if (marketTab.value === 'us') {
      const res = await triggerUsMarketDailyAnalysis(apiDate)
      showSnack(`美股日报任务已提交（${res.sector_count} 个板块）`, 'success')
    } else {
      const res = await triggerMarketDailyAnalysis(apiDate)
      showSnack(`A股日报任务已提交（${res.sector_count} 个行业）`, 'success')
    }
  } catch (e) {
    showSnack(`提交失败: ${e.message}`, 'error')
  } finally {
    triggeringMarket.value = false
  }
}

function showSnack(message, color = 'success') {
  snackbar.value = { show: true, message, color }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
onMounted(loadOverview)
</script>

<style scoped>
/* =====================================================================
   MarketRiskPanel — light / paper theme (matches ThemeLagRecommendPanel)
   ===================================================================== */

.market-risk-panel {
  min-height: 100vh;
  background: #f5f5f5;
}

/* Outer paper container */
.mrp-paper {
  background: #ffffff;
  color: #111111;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px 24px;
}

/* Market tab switcher */
.market-tabs {
  display: flex;
  gap: 6px;
  align-items: center;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 0;
}
.tab-spacer { flex: 1; }
.market-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 18px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #666;
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  border-radius: 4px 4px 0 0;
  transition: color 0.15s, border-color 0.15s;
}
.market-tab:hover {
  color: #1565c0;
  background: #f0f4ff;
}
.market-tab-active {
  color: #1565c0;
  border-bottom-color: #1565c0;
  font-weight: 600;
}
.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 5px;
  font-size: 0.75rem;
  font-weight: 600;
  background: #e3eaf7;
  color: #1565c0;
  border-radius: 9px;
}
.market-tab-active .tab-count {
  background: #1565c0;
  color: #fff;
}

/* Typography */
.mrp-h1 {
  font-size: 1.35rem;
  font-weight: 700;
  color: #000;
  margin: 0 0 0.3rem;
}
.mrp-date-sub {
  font-size: 1rem;
  font-weight: 400;
  color: #555;
  margin-left: 8px;
}
.mrp-sub {
  font-size: 0.875rem;
  color: #555;
  margin: 0;
}
.mrp-muted  { font-size: 0.85rem; color: #777; }
.mrp-caption { font-size: 0.78rem; color: #888; }

/* Buttons */
.mrp-btn-outline {
  border-color: #333 !important;
  color: #111 !important;
}
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

/* Native date input styled to match paper theme */
.mrp-date-input {
  height: 30px;
  padding: 0 8px;
  font-size: 0.82rem;
  color: #111;
  background: #fff;
  border: 1px solid #bbb;
  border-radius: 3px;
  outline: none;
  box-sizing: border-box;
  cursor: pointer;
}
.mrp-date-input:hover  { border-color: #666; }
.mrp-date-input:focus  { border-color: #333; box-shadow: 0 0 0 2px rgba(0,0,0,0.08); }

/* no-data */
.no-data-hint {
  text-align: center;
  padding: 60px 20px;
  color: #777;
}

/* ── Sector cards ── */
.sector-card {
  background: #fafafa;
  border: 1px solid #ddd;
  border-left: 4px solid #ddd;
  border-radius: 4px;
  padding: 12px 14px;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.12s;
}
.sector-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.risk-low    { border-left-color: #2e7d32; }
.risk-medium { border-left-color: #e65100; }
.risk-high   { border-left-color: #c62828; }
.risk-extreme { border-left-color: #4527a0; }

.sc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.sc-name {
  font-size: 0.92rem;
  font-weight: 700;
  color: #111;
}
.sc-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 2px;
  border: 1px solid;
}
.badge-low     { background: #e8f5e9; border-color: #2e7d32; color: #1b5e20; }
.badge-medium  { background: #fff3e0; border-color: #e65100; color: #bf360c; }
.badge-high    { background: #ffebee; border-color: #c62828; color: #b71c1c; }
.badge-extreme { background: #ede7f6; border-color: #4527a0; color: #311b92; }
.badge-unknown { background: #f5f5f5; border-color: #bbb;    color: #555; }

.score-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.score-number {
  font-size: 1.4rem;
  font-weight: 700;
  color: #111;
  min-width: 44px;
  line-height: 1;
}
.score-bar-track {
  flex: 1;
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
}
.score-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s;
}
.fill-low     { background: #2e7d32; }
.fill-medium  { background: #e65100; }
.fill-high    { background: #c62828; }
.fill-extreme { background: #4527a0; }
.fill-unknown { background: #bbb; }

.sc-warn { font-size: 0.75rem; color: #b71c1c; margin-top: 2px; }

/* ── Detail panel ── */
.detail-paper {
  background: #fff;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
}
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
}
.detail-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #000;
}
.detail-divider {
  border-top: 1px solid #e0e0e0;
}
.detail-body {
  padding: 12px 14px;
}

/* Signal rows */
.signal-block {
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #efefef;
}
.signal-block:last-child { border-bottom: none; }
.signal-title {
  font-size: 0.72rem;
  font-weight: 700;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}
.signal-row {
  display: flex;
  align-items: center;
  padding: 3px 0;
  font-size: 0.85rem;
}
.sig-name {
  flex: 1;
  color: #222;
  font-size: 0.85rem;
}
.sig-value {
  font-weight: 700;
  min-width: 52px;
  text-align: right;
  font-size: 0.85rem;
  color: #111;
}
.sig-chip {
  font-size: 0.68rem;
  padding: 1px 5px;
  border-radius: 2px;
  border: 1px solid;
  margin-left: 6px;
  white-space: nowrap;
}
.chip-low     { background: #e8f5e9; border-color: #2e7d32; color: #1b5e20; }
.chip-medium  { background: #fff3e0; border-color: #e65100; color: #bf360c; }
.chip-high    { background: #ffebee; border-color: #c62828; color: #b71c1c; }
.chip-extreme { background: #ede7f6; border-color: #4527a0; color: #311b92; }
.chip-unknown { background: #f5f5f5; border-color: #bbb;    color: #555; }
.chip-rsi-超买 { background: #ffebee; border-color: #c62828; color: #b71c1c; }
.chip-rsi-超卖 { background: #e3f2fd; border-color: #1565c0; color: #0d47a1; }
.chip-rsi-中性 { background: #e8f5e9; border-color: #2e7d32; color: #1b5e20; }

/* Signal value colors */
.text-red  { color: #c62828 !important; }
.text-orange { color: #e65100 !important; }
.text-green  { color: #2e7d32 !important; }
.text-blue   { color: #1565c0 !important; }
.val-pos { color: #2e7d32 !important; font-weight: 700; }
.val-neg { color: #c62828 !important; font-weight: 700; }

.warn-item { font-size: 0.78rem; color: #b71c1c; }

/* LLM block */
.llm-block {
  background: #f0f4ff;
  border: 1px solid #c5cae9;
  border-radius: 4px;
  padding: 10px 12px;
}
.llm-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
}
.llm-summary {
  font-size: 0.85rem;
  color: #222;
  line-height: 1.65;
  margin: 0;
}
.llm-section-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: #444;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.llm-list {
  padding-left: 16px;
  margin: 4px 0 0;
}
.llm-list li { font-size: 0.78rem; color: #333; line-height: 1.6; margin-bottom: 2px; }
.llm-interp-grid { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
.llm-interp-item { display: flex; gap: 6px; align-items: baseline; }
.llm-interp-key {
  font-size: 0.72rem;
  font-weight: 600;
  color: #5c6bc0;
  white-space: nowrap;
  min-width: 60px;
}
.llm-interp-val { font-size: 0.78rem; color: #333; line-height: 1.55; }
.llm-advice-row { display: flex; gap: 10px; flex-wrap: wrap; }
.llm-advice-block { flex: 1; min-width: 140px; }
.llm-conf {
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 2px;
  font-size: 0.7rem;
  font-weight: 600;
}
.conf-high   { background: #e8f5e9; color: #2e7d32; }
.conf-medium { background: #fff3e0; color: #e65100; }
.conf-low    { background: #ffebee; color: #c62828; }

.gap-2 { gap: 8px; }
.ml-1  { margin-left: 4px; }
.mt-1  { margin-top: 4px; }
.mt-2  { margin-top: 8px; }
.mt-3  { margin-top: 12px; }
.text-center { text-align: center; }

/* Trend day-range tabs */
.trend-tabs { display: flex; gap: 4px; }
.trend-tab {
  padding: 2px 10px;
  font-size: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: transparent;
  color: #555;
  cursor: pointer;
  line-height: 1.7;
  transition: background 0.1s, color 0.1s;
}
.trend-tab:hover:not(:disabled) { border-color: #888; color: #111; }
.trend-tab:disabled { opacity: 0.45; cursor: default; }
.trend-tab-active {
  background: #111;
  color: #fff;
  border-color: #111;
}

/* ── Market Daily Analysis ── */
.mda-body { padding: 2px 0 4px; }
.mda-summary {
  font-size: 0.9rem;
  color: #222;
  line-height: 1.65;
  margin: 0 0 2px;
}
.mda-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}
.mda-block {
  background: #fafafa;
  border: 1px solid #ececec;
  border-radius: 3px;
  padding: 10px 12px;
}
.mda-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.mda-chip {
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 600;
}
.mda-chip-low     { background: #e8f5e9; color: #2e7d32; }
.mda-chip-medium  { background: #fff3e0; color: #e65100; }
.mda-chip-high    { background: #ffebee; color: #c62828; }
.mda-chip-extreme { background: #ede7f6; color: #4527a0; }
.mda-sentiment-chip {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 3px;
  font-size: 0.8rem;
  font-weight: 600;
}
.sentiment-bullish { background: #e8f5e9; color: #2e7d32; }
.sentiment-neutral { background: #f5f5f5; color: #555; }
.sentiment-bearish { background: #fff3e0; color: #e65100; }
.sentiment-extreme { background: #ffebee; color: #c62828; }
.mda-list { padding-left: 14px; margin: 0; }
.mda-list li { font-size: 0.78rem; color: #444; line-height: 1.65; }

/* IV badge */
.iv-badge { display: inline-flex; align-items: center; gap: 8px; padding: 4px 10px; border-radius: 8px; border: 1px solid #e2e8f0; }
.iv-badge__val  { font-size: 14px; font-weight: 700; }
.iv-badge__label{ font-size: 12px; opacity: .75; }
.iv-badge__skew { font-size: 11px; color: #718096; }
.iv-badge--calm     { background: #ebf4ff; border-color: #c3dafe; } .iv-badge--calm     .iv-badge__val { color: #2b6cb0; }
.iv-badge--normal   { background: #f0fff4; border-color: #c6f6d5; } .iv-badge--normal   .iv-badge__val { color: #276749; }
.iv-badge--elevated { background: #fffaf0; border-color: #feebc8; } .iv-badge--elevated .iv-badge__val { color: #c05621; }
.iv-badge--panic    { background: #fff5f5; border-color: #fed7d7; } .iv-badge--panic    .iv-badge__val { color: #c53030; }
.iv-multi-row { display: flex; flex-wrap: wrap; gap: 4px; }
.iv-mini { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; border: 1px solid transparent; }
.iv-mini--calm     { background: #ebf4ff; border-color: #c3dafe; color: #2b6cb0; }
.iv-mini--normal   { background: #f0fff4; border-color: #c6f6d5; color: #276749; }
.iv-mini--elevated { background: #fffaf0; border-color: #feebc8; color: #c05621; }
.iv-mini--panic    { background: #fff5f5; border-color: #fed7d7; color: #c53030; }
</style>
