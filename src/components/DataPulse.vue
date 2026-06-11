<template>
  <div class="data-pulse-widget">
    <!-- ===== 顶栏: 系统心跳指示 ===== -->
    <div class="pulse-header">
      <div class="pulse-indicator">
        <span class="pulse-dot" :class="pulseClass"></span>
        <span class="pulse-label">数据脉搏</span>
      </div>
      <div class="pulse-summary" v-if="overview">
        <span class="summary-item" v-if="overview.sync_health">
          <v-icon size="14" :color="healthColor">{{ healthIcon }}</v-icon>
          {{ overview.sync_health.healthy }}/{{ overview.sync_health.total_pipelines }} 管线正常
        </span>
        <span class="summary-item" v-if="latestDataDate">
          📊 数据 {{ latestDataDate }}
        </span>
        <span class="summary-item" v-if="overview.news">
          📰 {{ overview.news.total }} 条新闻
          <span v-if="overview.news.is_fresh" class="fresh-badge">LIVE</span>
        </span>
      </div>
    </div>

    <div class="pulse-panel">
      <!-- Tab 切换 -->
      <div class="panel-tabs">
        <button 
          v-for="tab in panelTabs" :key="tab.id"
          :class="['ptab', { active: panelTab === tab.id }]"
          @click="panelTab = tab.id"
        >{{ tab.icon }} {{ tab.label }}</button>
      </div>

      <!-- ─── 新闻快讯 ─── -->
      <div v-if="panelTab === 'news'" class="panel-content">
        <div v-if="newsLoading" class="panel-loading">
          <v-progress-circular indeterminate size="20" width="2" color="primary" />
        </div>
        <div v-else-if="!newsData || Object.keys(newsData).length === 0" class="panel-empty">
          暂无新闻数据
        </div>
        <div v-else class="news-grid">
          <div v-for="(items, category) in newsData" :key="category" class="news-category">
            <div class="category-header">
              <span class="cat-icon">{{ categoryIcon(category) }}</span>
              <span class="cat-name">{{ category }}</span>
            </div>
            <div v-for="(item, idx) in items" :key="idx" class="news-item">
              <a
                v-if="item.url"
                class="news-title news-link"
                :href="item.url"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ displayNewsTitle(item) }}
              </a>
              <span v-else class="news-title">{{ displayNewsTitle(item) }}</span>
              <span v-if="showOriginalTitle(item)" class="news-title-original">{{ item.title }}</span>
              <span class="news-meta">
                <span class="news-source">{{ item.source }}</span>
                <span v-if="item.published" class="news-time">{{ item.published }}</span>
              </span>
            </div>
          </div>
        </div>
        <div v-if="newsFetchedAt" class="panel-footer">
          数据源: BBC / CNBC / Yahoo Finance · {{ newsFetchedAt }}
        </div>
      </div>

      <!-- ─── 数据同步状态 ─── -->
      <div v-if="panelTab === 'sync'" class="panel-content">
        <div v-if="!overview?.sync_health" class="panel-empty">暂无同步状态</div>
        <div v-else>
          <!-- 健康度环 -->
          <div class="health-ring-row">
            <div class="health-ring">
              <svg viewBox="0 0 36 36" class="ring-svg">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#edf2f7" stroke-width="3" />
                <circle cx="18" cy="18" r="15.5" fill="none" :stroke="healthColor"
                  stroke-width="3" stroke-linecap="round"
                  :stroke-dasharray="`${healthPct}, 100`"
                  transform="rotate(-90 18 18)" />
              </svg>
              <span class="ring-pct">{{ healthPct }}%</span>
            </div>
            <div class="health-label">
              <strong>系统健康度</strong>
              <span>{{ overview.sync_health.healthy }} / {{ overview.sync_health.total_pipelines }} 管线正常</span>
            </div>
          </div>

          <!-- 各管线状态 -->
          <div class="sync-jobs">
            <div v-for="job in overview.sync_health.jobs" :key="job.type" class="sync-job-row">
              <span class="job-icon" :class="jobIconClass(job.status)">
                {{ jobIconText(job.status) }}
              </span>
              <span class="job-name">{{ job.label || jobLabel(job.type) }}</span>
              <span class="job-date">{{ job.latest_date || '--' }}</span>
            </div>
          </div>

          <!-- 数据新鲜度（优先 freshness_detail 保持与目录一致的顺序） -->
          <div class="freshness-row" v-if="freshnessDisplayItems.length">
            <h4>📅 数据最后日期</h4>
            <div class="fresh-items">
              <div
                v-for="item in freshnessDisplayItems"
                :key="item._key"
                class="fresh-item"
              >
                <span class="f-label">{{ item.label }}</span>
                <span class="f-date" :class="{ stale: isStale(item.display) }">{{ item.display || '--' }}</span>
                <button
                  v-if="coverageGapCount(item.row) > 0"
                  type="button"
                  class="f-gap-btn"
                  @click.stop="openCoverageGaps(item.row)"
                >缺失 {{ coverageGapCount(item.row) }}</button>
            </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── 数据合约 / 冷启动补全 ─── -->
      <div v-if="panelTab === 'contracts'" class="panel-content">
        <div v-if="contractsLoading" class="panel-loading">
          <v-progress-circular indeterminate size="20" width="2" color="primary" />
        </div>
        <div v-else-if="!contractRows.length" class="panel-empty">暂无合约数据</div>
        <div v-else>
          <!-- 冷启动进度 -->
          <div class="boot-row">
            <div class="boot-head">
              <strong>冷启动补全</strong>
              <span class="boot-state" :class="bootstrap.done ? 'ok' : 'progress'">
                {{ bootstrap.done ? '已完成' : '进行中' }}
              </span>
            </div>
            <div class="boot-bar">
              <div class="boot-bar-fill"
                :style="{ width: summary.healthy_pct + '%', background: bootColor }"></div>
            </div>
            <div class="boot-meta">
              {{ summary.healthy }}/{{ summary.total }} 合约就绪 ({{ summary.healthy_pct }}%)
              <span v-if="stillFilling > 0" class="boot-filling">· {{ stillFilling }} 个补全中</span>
              <span v-if="bootstrap.completed_at" class="boot-ts">· 标记 {{ shortTime(bootstrap.completed_at) }}</span>
            </div>
          </div>

          <!-- 各合约状态 -->
          <div class="contract-list">
            <div v-for="c in contractRows" :key="c.contract_id" class="contract-row">
              <span class="c-badge" :class="contractStatusClass(c.status)">{{ contractStatusText(c.status) }}</span>
              <span class="c-name">{{ c.label }}</span>
              <span class="c-metric" :class="{ filling: isFilling(c.status) }">{{ contractMetric(c) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <v-dialog v-model="gapDialog" max-width="560" scrollable>
      <v-card>
        <v-card-title class="text-subtitle-1">{{ gapTitle }}</v-card-title>
        <v-card-text>
          <div v-if="gapLoading" class="gap-dialog-loading">
            <v-progress-circular indeterminate size="24" width="2" color="primary" />
          </div>
          <div v-else-if="gapError" class="gap-dialog-error">{{ gapError }}</div>
          <template v-else>
            <p v-if="gapPayload" class="gap-dialog-meta">
              报告期 {{ gapPayload.period }} · 共缺 {{ gapPayload.missing_total }} 只
              <span v-if="gapPayload.missing_total > gapRows.length">（本页展示前 {{ gapRows.length }} 条）</span>
            </p>
            <v-table v-if="gapRows.length" density="compact" class="gap-table">
              <thead>
                <tr><th class="text-left">代码</th><th class="text-left">名称</th></tr>
              </thead>
              <tbody>
                <tr v-for="(r, idx) in gapRows" :key="r.ts_code + '-' + idx">
                  <td>{{ r.ts_code }}</td>
                  <td>{{ r.name != null && r.name !== '' ? r.name : '—' }}</td>
                </tr>
              </tbody>
            </v-table>
            <p v-else class="text-caption text-medium-emphasis">无缺失记录</p>
          </template>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="gapDialog = false">关闭</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { mdiCheckCircle, mdiAlertCircle } from '@mdi/js'
import { fetchDataPulseOverview, fetchDataPulseNews, fetchCoverageGaps, fetchDataPulseContracts } from '../api/dataPulse.js'

const panelTab = ref('news')
const overview = ref(null)
const newsData = ref(null)
const newsFetchedAt = ref(null)
const newsLoading = ref(false)

const contractsData = ref(null)
const contractsLoading = ref(false)

const gapDialog = ref(false)
const gapLoading = ref(false)
const gapError = ref(null)
const gapTitle = ref('')
const gapPayload = ref(null)
const gapRows = ref([])

const panelTabs = [
  { id: 'news', icon: '📰', label: '新闻快讯' },
  { id: 'sync', icon: '⚡', label: '数据同步' },
  { id: 'contracts', icon: '📑', label: '数据合约' },
]

// ── 计算属性 ──
const healthPct = computed(() => overview.value?.sync_health?.health_pct ?? 0)
const healthColor = computed(() => {
  if (healthPct.value >= 80) return '#48bb78'
  if (healthPct.value >= 50) return '#ecc94b'
  return '#f56565'
})
const healthIcon = computed(() => healthPct.value >= 80 ? mdiCheckCircle : mdiAlertCircle)

const pulseClass = computed(() => {
  if (!overview.value) return 'loading'
  if (healthPct.value >= 80) return 'healthy'
  if (healthPct.value >= 50) return 'warn'
  return 'error'
})

function leadingYyyymmdd(v) {
  if (typeof v !== 'string' || !v) return null
  const m = v.match(/^(\d{8})/)
  return m ? m[1] : null
}

function formatFreshnessRowDisplay(row) {
  if (!row || row.latest_value == null) return null
  const s = String(row.latest_value)
  const base = s.length >= 8 && /^\d{8}/.test(s.slice(0, 8)) ? s.slice(0, 8) : s.slice(0, 32)
  const num = row.coverage_numerator
  const den = row.coverage_denominator
  if (num != null && den != null && Number(den) > 0)
    return `${base} · ${Number(num)}/${Number(den)}`
  const pct = row.coverage_pct
  if (pct != null && den != null && Number(den) > 0)
    return `${base} · 覆盖 ${Number(pct).toFixed(1)}%`
  return base
}

const freshnessDisplayItems = computed(() => {
  const ov = overview.value
  if (!ov) return []
  const fd = ov.freshness_detail
  if (fd && Array.isArray(fd)) {
    return fd.map((row, i) => ({
      _key: `${row.pipeline_id || ''}-${row.collection || ''}-${row.label || i}`,
      label: row.label || row.pipeline_id || String(i),
      display: formatFreshnessRowDisplay(row),
      row,
    }))
  }
  const df = ov.data_freshness
  if (!df || typeof df !== 'object') return []
  return Object.entries(df).map(([label, date], i) => ({
    _key: `legacy-${label}-${i}`,
    label,
    display: date,
    row: null,
  }))
})

const latestDataDate = computed(() => {
  const fd = overview.value?.freshness_detail
  const raw = []
  if (fd && Array.isArray(fd)) {
    fd.forEach((row) => {
      if (row.latest_value != null) raw.push(String(row.latest_value))
    })
  } else if (overview.value?.data_freshness) {
    raw.push(...Object.values(overview.value.data_freshness).filter(Boolean))
  }
  const ymd = raw.map((v) => leadingYyyymmdd(v)).filter(Boolean)
  if (ymd.length === 0) return null
  const latest = ymd.sort().pop()
  if (latest && latest.length === 8) {
    return `${latest.slice(4, 6)}-${latest.slice(6, 8)}`
  }
  return latest
})

function coverageGapCount(row) {
  if (!row) return 0
  const d = row.coverage_denominator
  const n = row.coverage_numerator
  if (d == null || n == null) return 0
  const diff = Number(d) - Number(n)
  return diff > 0 ? diff : 0
}

async function openCoverageGaps(row) {
  gapDialog.value = true
  gapLoading.value = true
  gapError.value = null
  gapPayload.value = null
  gapRows.value = []
  gapTitle.value = `${row.label || row.collection} — 未覆盖股票`
  const period = row.coverage_as_of || leadingYyyymmdd(String(row.latest_value || ''))
  try {
    const data = await fetchCoverageGaps({
      database: row.database || 'quant_data',
      collection: row.collection,
      period: period || undefined,
      skip: 0,
      limit: 500,
    })
    if (!data.success) {
      gapError.value = data.detail || '请求失败'
      return
    }
    gapPayload.value = data
    gapRows.value = Array.isArray(data.items) ? data.items : []
  } catch (e) {
    gapError.value = e?.message || String(e)
  } finally {
    gapLoading.value = false
  }
}

// ── 工具方法 ──
const categoryIcons = {
  '地缘政治': '🌍', '大宗商品': '🛢️', '央行/利率': '🏦',
  '科技/AI': '🤖', '全球经济': '📉', '其他重要': '📌',
}
function categoryIcon(cat) {
  return categoryIcons[cat] || '📰'
}

function displayNewsTitle(item) {
  if (!item) return ''
  const zh = (item.title_zh || '').trim()
  if (zh) return zh
  return item.title || ''
}

function showOriginalTitle(item) {
  if (!item) return false
  const zh = (item.title_zh || '').trim()
  const en = (item.title || '').trim()
  return Boolean(zh && en && zh !== en)
}

const jobLabels = {
  stock_daily: '股票日线',
  stock_weekly: '股票周线',
  stock_monthly: '股票月线',
  index_daily: '指数日线',
  etf_daily: 'ETF日线',
  etf_share_size: 'ETF份额规模',
  financial_sync: '财务数据',
  moneyflow: '资金流向',
  ladder_sync: '连板天梯',
  market_sentiment: '市场情绪',
  international_news: '国际新闻',
  industry_sync: '行业与ETF聚合',
  hot_stock_sync: '热股同步',
  stock_composite_scoring: '综合评分',
}
function jobLabel(type) {
  return jobLabels[type] || type
}

function jobIconText(st) {
  if (st === 'complete') return '✅'
  if (st === 'no_record') return '➖'
  return '⚠️'
}
function jobIconClass(st) {
  if (st === 'complete') return 'ok'
  if (st === 'no_record') return 'missing'
  return 'fail'
}

function isStale(display) {
  const dateStr = leadingYyyymmdd(display)
  if (!dateStr || dateStr.length !== 8) return false
  const today = new Date()
  const y = parseInt(dateStr.slice(0, 4))
  const m = parseInt(dateStr.slice(4, 6)) - 1
  const d = parseInt(dateStr.slice(6, 8))
  const dataDate = new Date(y, m, d)
  const diffDays = (today - dataDate) / (1000 * 60 * 60 * 24)
  return diffDays > 3 // 超过3天视为过期
}

// ── 数据合约 / 冷启动补全 ──
const summary = computed(() => contractsData.value?.summary || { total: 0, healthy: 0, healthy_pct: 0 })
const bootstrap = computed(() => contractsData.value?.bootstrap || { done: false, completed_at: null, contracts: [] })

const SEVERITY = { failed: 0, violated: 1, pending: 2, unknown: 3, repaired: 4, ok: 5 }
const contractRows = computed(() => {
  const rows = contractsData.value?.contracts || []
  return [...rows].sort((a, b) => (SEVERITY[a.status] ?? 9) - (SEVERITY[b.status] ?? 9))
})
const stillFilling = computed(() => contractRows.value.filter((c) => isFilling(c.status)).length)
const bootColor = computed(() => {
  if (bootstrap.value.done) return '#48bb78'
  if (summary.value.healthy_pct >= 50) return '#ecc94b'
  return '#f56565'
})

function isFilling(st) {
  return st === 'violated' || st === 'failed' || st === 'pending'
}
function contractStatusText(st) {
  return { ok: '就绪', repaired: '已补', violated: '缺', failed: '失败', unknown: '未知', pending: '等待' }[st] || st
}
function contractStatusClass(st) {
  if (st === 'ok' || st === 'repaired') return 'ok'
  if (st === 'violated' || st === 'failed') return 'fail'
  return 'missing'
}
function contractMetric(c) {
  if (c.status === 'pending') return '等待补全…'
  switch (c.kind) {
    case 'snapshot':
      return c.doc_count != null ? `${c.doc_count} 行${c.min_docs ? ` / 最低 ${c.min_docs}` : ''}` : '—'
    case 'run_recency':
      return c.run_lag_days != null ? `运行滞后 ${c.run_lag_days} 天` : '—'
    case 'report_periods': {
      const pct = c.coverage_pct != null ? `${Number(c.coverage_pct).toFixed(1)}%` : '—'
      if (c.present_days != null && c.expected_days != null) return `${pct} · ${c.present_days}/${c.expected_days} 期`
      return pct
    }
    default: {
      const parts = []
      if (c.coverage_pct != null) parts.push(`${Number(c.coverage_pct).toFixed(2)}%`)
      if (c.lag_trading_days != null) parts.push(`滞后 ${c.lag_trading_days} 日`)
      if (c.missing_days) parts.push(`缺 ${c.missing_days} 天`)
      return parts.join(' · ') || '—'
    }
  }
}
function shortTime(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const p = (n) => String(n).padStart(2, '0')
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  } catch {
    return ''
  }
}

// ── 数据加载 ──
async function loadContracts() {
  contractsLoading.value = true
  try {
    const res = await fetchDataPulseContracts()
    if (res.success) contractsData.value = res
  } catch (e) {
    console.warn('[DataPulse] Failed to load contracts:', e)
  } finally {
    contractsLoading.value = false
  }
}

async function loadOverview() {
  try {
    const res = await fetchDataPulseOverview()
    if (res.success) {
      overview.value = res.overview
      // 同时预填新闻
      if (res.overview?.news?.headlines) {
        // overview只有头条，完整数据需要单独加载
      }
    }
  } catch (e) {
    console.warn('[DataPulse] Failed to load overview:', e)
  }
}

async function loadNews() {
  newsLoading.value = true
  try {
    const res = await fetchDataPulseNews()
    if (res.success) {
      newsData.value = res.categories
      newsFetchedAt.value = res.fetched_at
    }
  } catch (e) {
    console.warn('[DataPulse] Failed to load news:', e)
  } finally {
    newsLoading.value = false
  }
}

onMounted(() => {
  loadOverview()
  loadNews()
  loadContracts()
})
</script>

<style scoped>
.data-pulse-widget {
  background: #ffffff;
  border: 1px solid #e1e8ed;
  border-radius: 12px;
  margin-bottom: 16px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}

/* ── 顶栏 ── */
.pulse-header {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  cursor: pointer;
  user-select: none;
  gap: 12px;
  transition: background 0.15s;
}
.pulse-header:hover { background: #f7fafc; }

.pulse-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.pulse-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.pulse-dot.healthy {
  background: #48bb78;
  box-shadow: 0 0 6px rgba(72, 187, 120, 0.6);
  animation: pulse-glow 2s infinite;
}
.pulse-dot.warn { background: #ecc94b; box-shadow: 0 0 6px rgba(236, 201, 75, 0.6); }
.pulse-dot.error { background: #f56565; animation: pulse-glow-red 1s infinite; }
.pulse-dot.loading { background: #a0aec0; animation: pulse-glow 2s infinite; }

@keyframes pulse-glow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@keyframes pulse-glow-red {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.3); }
}

.pulse-label {
  font-size: 13px;
  font-weight: 600;
  color: #2d3748;
  white-space: nowrap;
}

.pulse-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  flex: 1;
  min-width: 0;
  align-items: center;
}

.summary-item {
  font-size: 11px;
  color: #718096;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.fresh-badge {
  background: #48bb78;
  color: white;
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 8px;
  letter-spacing: 0.5px;
  animation: pulse-glow 2s infinite;
}

/* ── 展开面板 ── */
.pulse-panel {
  border-top: 1px solid #edf2f7;
}

.panel-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid #edf2f7;
}

.ptab {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  font-size: 11px;
  font-weight: 500;
  color: #718096;
  border: none;
  background: none;
  cursor: pointer;
  transition: all 0.15s;
  border-bottom: 2px solid transparent;
}
.ptab.active {
  color: #3182ce;
  border-bottom-color: #3182ce;
  background: #ebf8ff;
}
.ptab:hover:not(.active) { background: #f7fafc; }

.panel-content {
  padding: 10px 12px;
  max-height: 380px;
  overflow-y: auto;
  overflow-x: auto;
}

.panel-loading, .panel-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
  color: #a0aec0;
  font-size: 13px;
}

/* ── 新闻 ── */
.news-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.news-category {
  background: #f7fafc;
  border-radius: 8px;
  padding: 8px 10px;
  border: 1px solid #edf2f7;
  min-width: 0;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid #e2e8f0;
}

.cat-icon { font-size: 14px; }
.cat-name {
  font-size: 12px;
  font-weight: 600;
  color: #2d3748;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.news-item {
  padding: 4px 0;
  border-bottom: 1px dashed #edf2f7;
}
.news-item:last-child { border-bottom: none; }

.news-title {
  display: block;
  font-size: 12px;
  color: #2d3748;
  line-height: 1.4;
  margin-bottom: 2px;
}

.news-title-original {
  display: block;
  font-size: 10px;
  color: #718096;
  line-height: 1.3;
  margin-bottom: 2px;
}

.news-link {
  color: #2b6cb0;
  text-decoration: none;
}

.news-link:hover {
  color: #1a4f85;
  text-decoration: underline;
}

.news-meta {
  display: flex;
  gap: 8px;
  font-size: 10px;
  color: #a0aec0;
}

.news-source { font-weight: 500; }

.panel-footer {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid #edf2f7;
  font-size: 10px;
  color: #a0aec0;
  text-align: right;
}

/* ── 同步状态 ── */
.health-ring-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.health-ring {
  position: relative;
  width: 56px; height: 56px;
  flex-shrink: 0;
}

.ring-svg {
  width: 100%; height: 100%;
}

.ring-pct {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  font-size: 13px;
  font-weight: 700;
  color: #2d3748;
}

.health-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.health-label strong { font-size: 13px; color: #2d3748; }
.health-label span { font-size: 11px; color: #718096; }

.sync-jobs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 4px;
  margin-bottom: 16px;
}

.sync-job-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
}
.sync-job-row:hover { background: #f7fafc; }

.job-icon { font-size: 12px; }
.job-name { flex: 1; color: #4a5568; }
.job-date {
  font-family: 'Roboto Mono', monospace;
  font-size: 11px;
  color: #a0aec0;
}

.freshness-row h4 {
  font-size: 12px;
  color: #718096;
  margin: 0 0 8px 0;
  font-weight: 600;
}

.fresh-items {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.fresh-item {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px 12px;
}

.f-label { font-size: 10px; color: #a0aec0; }
.f-date {
  font-size: 13px;
  font-weight: 600;
  font-family: 'Roboto Mono', monospace;
  color: #2d3748;
}
.f-date.stale { color: #f56565; }

.f-gap-btn {
  font-size: 11px;
  border: none;
  background: transparent;
  color: #3182ce;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  font-family: inherit;
}
.f-gap-btn:hover { color: #2c5282; }

.gap-dialog-loading,
.gap-dialog-error {
  text-align: center;
  padding: 16px 0;
}
.gap-dialog-error { color: #c53030; font-size: 13px; }
.gap-dialog-meta {
  font-size: 12px;
  color: #718096;
  margin: 0 0 12px 0;
}
.gap-table { font-size: 12px; }

/* ── 数据合约 / 冷启动补全 ── */
.boot-row {
  margin-bottom: 14px;
}
.boot-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.boot-head strong { font-size: 13px; color: #2d3748; }
.boot-state {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 8px;
  letter-spacing: 0.4px;
}
.boot-state.ok { background: #c6f6d5; color: #22543d; }
.boot-state.progress { background: #feebc8; color: #7b341e; animation: pulse-glow 2s infinite; }

.boot-bar {
  height: 8px;
  border-radius: 5px;
  background: #edf2f7;
  overflow: hidden;
}
.boot-bar-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.4s ease;
}
.boot-meta {
  margin-top: 6px;
  font-size: 11px;
  color: #718096;
}
.boot-filling { color: #dd6b20; font-weight: 600; }
.boot-ts { color: #a0aec0; }

.contract-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.contract-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 6px;
  font-size: 12px;
}
.contract-row:hover { background: #f7fafc; }

.c-badge {
  flex-shrink: 0;
  min-width: 34px;
  text-align: center;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 6px;
}
.c-badge.ok { background: #c6f6d5; color: #22543d; }
.c-badge.fail { background: #fed7d7; color: #822727; }
.c-badge.missing { background: #e2e8f0; color: #4a5568; }

.c-name { flex: 1; color: #2d3748; min-width: 0; }
.c-metric {
  font-family: 'Roboto Mono', monospace;
  font-size: 11px;
  color: #718096;
  text-align: right;
  white-space: nowrap;
}
.c-metric.filling { color: #dd6b20; font-weight: 600; }

/* ── 响应式 ── */
@media (max-width: 768px) {
  .pulse-summary { gap: 8px; }
  .summary-item { font-size: 11px; }
  .news-grid { grid-template-columns: 1fr; }
  .sync-jobs { grid-template-columns: 1fr; }
}
</style>
