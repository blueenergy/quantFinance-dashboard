<template>
  <v-container fluid class="regime-panel pa-4">
    <div class="regime-shell">
      <header class="regime-header">
        <div>
          <p class="regime-eyebrow">A股市场温度计</p>
          <h1>广度与估值扫描</h1>
          <p class="regime-sub">MCL · 兴登堡预兆 · 5年通胀调整 CAPE</p>
        </div>
        <button class="regime-refresh" :disabled="loading" @click="loadAll">刷新</button>
      </header>

      <div v-if="loading" class="regime-empty">广度估值数据加载中...</div>
      <div v-else-if="error" class="regime-empty is-error">{{ error }}</div>
      <div v-else-if="!latest" class="regime-empty">暂无 A 股广度估值扫描数据</div>

      <template v-else>
        <section class="regime-summary" :class="`alert-${latest.composite_alert || 'low'}`">
          <div>
            <span class="summary-label">综合等级</span>
            <strong>{{ alertLabel(latest.composite_alert) }}</strong>
          </div>
          <div>
            <span class="summary-label">扫描日期</span>
            <strong>{{ latest.scan_date }}</strong>
          </div>
          <div>
            <span class="summary-label">生成时间</span>
            <strong>{{ latest.generated_at || '-' }}</strong>
          </div>
        </section>

        <section class="regime-grid">
          <article class="metric-panel">
            <div class="panel-title">MCL 广度</div>
            <div class="metric-main">{{ formatNumber(mcl?.mcl) }}</div>
            <div class="metric-row"><span>RANA</span><b>{{ formatNumber(mcl?.net_advance_ratio) }}</b></div>
            <div class="metric-row"><span>分位</span><b>{{ formatPercent(mcl?.pct_rank_to_date) }}</b></div>
            <div class="metric-row"><span>涨 / 跌 / 平</span><b>{{ mcl?.advances ?? '-' }} / {{ mcl?.declines ?? '-' }} / {{ mcl?.unchanged ?? '-' }}</b></div>
          </article>

          <article class="metric-panel">
            <div class="panel-title">兴登堡预兆</div>
            <div class="metric-main">{{ hindenburgLabel(hindenburg?.alert_level) }}</div>
            <div class="metric-row"><span>30日触发</span><b>{{ hindenburg?.cluster_count_30d ?? 0 }} 次</b></div>
            <div class="metric-row"><span>新高 / 新低</span><b>{{ hindenburg?.new_high_count ?? '-' }} / {{ hindenburg?.new_low_count ?? '-' }}</b></div>
            <div class="condition-row">
              <span :class="conditionClass(hindenburg?.cond_uptrend)">趋势</span>
              <span :class="conditionClass(hindenburg?.cond_high_low)">高低</span>
              <span :class="conditionClass(hindenburg?.cond_ratio)">比例</span>
              <span :class="conditionClass(hindenburg?.cond_mcl_negative)">MCL</span>
            </div>
          </article>
        </section>

        <section class="cape-section">
          <div class="section-title">CAPE 估值分位</div>
          <div class="cape-grid">
            <article v-for="item in capeSignals" :key="item.index_code" class="cape-card">
              <div class="cape-top">
                <strong>{{ item.index_name || item.index_code }}</strong>
                <span :class="`band-${item.valuation_band || 'fair'}`">{{ bandLabel(item.valuation_band) }}</span>
              </div>
              <div class="cape-value">{{ formatNumber(item.cape) }}</div>
              <div class="cape-meta">分位 {{ formatPercent(item.pct_rank_to_date) }} · PE {{ formatNumber(item.pe_ttm) }}</div>
              <div v-if="item.pe_source_date && item.pe_source_date !== item.trade_date" class="cape-meta warn">估值取自 {{ item.pe_source_date }}</div>
            </article>
          </div>
        </section>

        <section v-if="latest.warnings?.length" class="warning-panel">
          <div class="section-title">告警事项</div>
          <ul>
            <li v-for="warning in latest.warnings" :key="warning">{{ warning }}</li>
          </ul>
        </section>

        <section class="history-section">
          <div class="section-title">最近日报</div>
          <div class="history-table">
            <div class="history-row header"><span>日期</span><span>等级</span><span>Warnings</span></div>
            <div v-for="row in historyRows" :key="row.scan_date" class="history-row">
              <span>{{ row.scan_date }}</span>
              <span>{{ alertLabel(row.composite_alert) }}</span>
              <span>{{ row.warnings?.length || 0 }}</span>
            </div>
          </div>
        </section>
      </template>
    </div>
  </v-container>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { getMarketRegimeHistory, getMarketRegimeLatest } from '../api/marketRegime.js'

const latest = ref(null)
const historyRows = ref([])
const loading = ref(false)
const error = ref('')

const mcl = computed(() => latest.value?.signals?.mcl || null)
const hindenburg = computed(() => latest.value?.signals?.hindenburg || null)
const capeSignals = computed(() => latest.value?.signals?.cape || [])

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return Number(value).toFixed(2)
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return `${Number(value).toFixed(1)}%`
}

function alertLabel(level) {
  return ({ low: '低', medium: '中', high: '高', extreme: '极高' })[level] || '未知'
}

function hindenburgLabel(level) {
  return ({ none: '未触发', single: '单次', cluster: '集群' })[level] || '未触发'
}

function bandLabel(band) {
  return ({ cheap: '便宜', fair: '合理', rich: '偏贵', bubble: '泡沫' })[band] || '合理'
}

function conditionClass(value) {
  return ['condition-pill', value ? 'pass' : 'mute']
}

async function loadAll() {
  loading.value = true
  error.value = ''
  try {
    const [latestData, historyData] = await Promise.all([
      getMarketRegimeLatest(),
      getMarketRegimeHistory(30),
    ])
    latest.value = latestData
    historyRows.value = historyData?.data || []
  } catch (err) {
    error.value = err?.message || '广度估值数据加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(loadAll)
</script>

<style scoped>
.regime-panel { background: #f5f7fb; min-height: 100%; }
.regime-shell { max-width: 1280px; margin: 0 auto; }
.regime-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 18px; }
.regime-eyebrow { margin: 0 0 6px; color: #607089; font-size: 13px; font-weight: 700; }
.regime-header h1 { margin: 0; color: #172033; font-size: 30px; letter-spacing: 0; }
.regime-sub { margin: 8px 0 0; color: #667085; }
.regime-refresh { border: 1px solid #c8d2e2; background: #ffffff; color: #24324a; border-radius: 8px; padding: 9px 16px; font-weight: 700; }
.regime-empty { background: #ffffff; border: 1px solid #d9e1ee; border-radius: 8px; padding: 28px; color: #667085; text-align: center; }
.regime-empty.is-error { color: #b42318; border-color: #f3b8b0; }
.regime-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; border-radius: 8px; padding: 18px; margin-bottom: 14px; border: 1px solid #d8e0ea; background: #ffffff; }
.summary-label { display: block; color: #68758b; font-size: 12px; margin-bottom: 6px; }
.regime-summary strong { color: #172033; font-size: 22px; }
.alert-medium { border-left: 5px solid #d9921f; }
.alert-high { border-left: 5px solid #c2410c; }
.alert-extreme { border-left: 5px solid #b42318; }
.regime-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-bottom: 14px; }
.metric-panel, .cape-section, .warning-panel, .history-section { background: #ffffff; border: 1px solid #d9e1ee; border-radius: 8px; padding: 16px; }
.panel-title, .section-title { color: #25324a; font-weight: 800; margin-bottom: 12px; }
.metric-main { font-size: 34px; font-weight: 800; color: #172033; margin-bottom: 10px; }
.metric-row { display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid #edf1f7; padding: 8px 0; color: #667085; }
.metric-row b { color: #25324a; }
.condition-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.condition-pill { border-radius: 999px; padding: 5px 9px; font-size: 12px; border: 1px solid #d9e1ee; }
.condition-pill.pass { background: #e7f6ec; color: #137333; border-color: #b7e2c4; }
.condition-pill.mute { background: #f3f5f8; color: #667085; }
.cape-section { margin-bottom: 14px; }
.cape-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.cape-card { border: 1px solid #e3e9f2; border-radius: 8px; padding: 14px; background: #fbfcfe; }
.cape-top { display: flex; justify-content: space-between; gap: 10px; color: #25324a; }
.cape-top span { border-radius: 999px; padding: 3px 8px; font-size: 12px; }
.band-cheap { background: #e6f4ea; color: #137333; }
.band-fair { background: #eef2f7; color: #475467; }
.band-rich { background: #fff4e5; color: #b55a00; }
.band-bubble { background: #fee4e2; color: #b42318; }
.cape-value { margin-top: 14px; font-size: 28px; font-weight: 800; color: #172033; }
.cape-meta { color: #667085; margin-top: 5px; font-size: 13px; }
.cape-meta.warn { color: #b55a00; }
.warning-panel { margin-bottom: 14px; }
.warning-panel ul { margin: 0; padding-left: 18px; color: #344054; }
.warning-panel li + li { margin-top: 6px; }
.history-table { border: 1px solid #edf1f7; border-radius: 8px; overflow: hidden; }
.history-row { display: grid; grid-template-columns: 1fr 1fr 1fr; padding: 9px 12px; border-top: 1px solid #edf1f7; color: #344054; }
.history-row.header { border-top: 0; background: #f7f9fc; color: #667085; font-size: 12px; font-weight: 800; }
@media (max-width: 840px) {
  .regime-header { flex-direction: column; }
  .regime-summary, .regime-grid, .cape-grid { grid-template-columns: 1fr; }
}
</style>