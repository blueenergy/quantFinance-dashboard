<template>
  <div class="market-events-card">
    <div class="card-header">
      <div class="header-main">
        <h3>📅 交易日历</h3>
        <span class="header-meta">时间均为北京时间（Asia/Shanghai）</span>
        <span v-if="statusText" class="header-meta">{{ statusText }}</span>
      </div>
      <div class="header-actions">
        <v-btn
          size="small"
          variant="tonal"
          color="white"
          :loading="loading"
          @click="loadEvents"
        >
          刷新
        </v-btn>
        <v-btn
          size="small"
          variant="outlined"
          color="white"
          :loading="briefLoading"
          title="仅对重要性 ★4、未来14天且尚未简评的日历事件生成（最多20条）"
          @click="enqueueBriefs"
        >
          生成简评
        </v-btn>
      </div>
    </div>

    <div class="card-content">
      <div class="brief-rule-hint">
        AI 简评范围：仅<strong>高重要日历事件（★4）</strong>。
        事前：未来 14 天且尚无简评；事后：近 3 天已发生事件写入独立「事后简评」，不覆盖事前内容。
        单次最多约 20 条；针对事件字段与事后新闻，不编造结果。
      </div>

      <div class="range-bar">
        <div class="range-presets">
          <button
            v-for="opt in rangeOptions"
            :key="opt.id"
            type="button"
            class="range-chip"
            :class="{ active: rangeMode === opt.id }"
            @click="selectRange(opt.id)"
          >
            {{ opt.label }}
          </button>
        </div>
        <div v-if="rangeMode === 'custom'" class="range-custom">
          <input v-model="customFrom" type="date" class="date-input" />
          <span>至</span>
          <input v-model="customTo" type="date" class="date-input" />
          <v-btn size="x-small" variant="tonal" color="primary" :loading="loading" @click="loadEvents">
            查询
          </v-btn>
        </div>
        <div class="range-meta">
          当前区间（北京时间）：{{ displayFrom }} → {{ displayTo }}
          <span class="retention-note">历史数据约保留近 14 天</span>
        </div>
      </div>

      <div v-if="loading && !events.length" class="loading-state">
        <v-progress-circular indeterminate color="primary" size="28" />
        <p>正在加载交易日历...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <v-alert type="error" variant="tonal" density="compact">{{ error }}</v-alert>
      </div>

      <div v-else-if="!groupedEvents.length" class="empty-state">
        {{ emptyText }}
      </div>

      <div v-else class="events-body">
        <div v-for="group in groupedEvents" :key="group.date" class="day-group">
          <div class="day-title">
            <span class="day-date">{{ group.date }} <small>北京时间</small></span>
            <span class="day-count">{{ group.items.length }} 条</span>
          </div>

          <div
            v-for="ev in group.items"
            :key="ev.id || ev.identity_key"
            class="event-item"
            :class="importanceClass(ev.importance)"
          >
            <div class="event-header">
              <div class="event-meta">
                <span class="time" :title="'北京时间 Asia/Shanghai'">
                  {{ formatTime(ev.event_time) }}
                  <span class="tz-tag">北京时间</span>
                </span>
                <v-chip
                  v-if="regionLabel(ev.region)"
                  size="x-small"
                  variant="tonal"
                  color="primary"
                  class="meta-chip"
                >
                  {{ regionLabel(ev.region) }}
                </v-chip>
                <v-chip
                  size="x-small"
                  variant="tonal"
                  :color="importanceColor(ev.importance)"
                  class="meta-chip"
                >
                  ★{{ ev.importance }}
                </v-chip>
                <v-chip
                  v-if="ev.category"
                  size="x-small"
                  variant="outlined"
                  class="meta-chip"
                >
                  {{ categoryLabel(ev.category) }}
                </v-chip>
                <v-chip
                  v-if="ev.status"
                  size="x-small"
                  variant="tonal"
                  :color="ev.status === 'happened' ? 'success' : 'grey'"
                  class="meta-chip"
                >
                  {{ statusLabel(ev.status) }}
                </v-chip>
                <span v-if="ev.symbol" class="symbol">{{ ev.symbol }}</span>
              </div>
            </div>

            <div class="event-title">
              <a
                v-if="eventArticleHref(ev)"
                class="event-title-link"
                :href="eventArticleHref(ev)"
                target="_blank"
                rel="noopener noreferrer"
                :title="eventLinkTitle(ev)"
              >{{ displayTitle(ev) }}</a>
              <template v-else>{{ displayTitle(ev) }}</template>
            </div>

            <div v-if="detailLine(ev)" class="detail-line">{{ detailLine(ev) }}</div>

            <div v-if="metricLine(ev)" class="metrics-line">
              {{ metricLine(ev) }}
            </div>

            <div v-if="sourceLine(ev)" class="source-line">
              来源：{{ sourceLine(ev) }}
              <template v-if="eventArticleHref(ev)">
                ·
                <a
                  :href="eventArticleHref(ev)"
                  target="_blank"
                  rel="noopener noreferrer"
                  :title="eventLinkTitle(ev)"
                >{{ usesSearchFallback(primaryUrl(ev)) ? '标题搜索' : '查看原文' }}</a>
              </template>
            </div>

            <div v-if="ev.llm_brief?.summary" class="brief-box">
              <span class="brief-label">事前 AI 简评</span>
              <p class="brief-text">{{ ev.llm_brief.summary }}</p>
              <ul v-if="ev.llm_brief.watchpoints?.length" class="watchpoints">
                <li v-for="(wp, idx) in ev.llm_brief.watchpoints" :key="idx">{{ wp }}</li>
              </ul>
              <div v-if="ev.llm_brief.sectors?.length" class="brief-sectors">
                <span
                  v-for="sec in ev.llm_brief.sectors"
                  :key="sec"
                  class="sector-chip"
                >{{ sec }}</span>
              </div>
            </div>

            <div v-if="ev.llm_brief_post?.summary" class="brief-box brief-box-post">
              <span class="brief-label">事后 AI 简评</span>
              <p class="brief-text">{{ ev.llm_brief_post.summary }}</p>
              <ul v-if="ev.llm_brief_post.watchpoints?.length" class="watchpoints">
                <li v-for="(wp, idx) in ev.llm_brief_post.watchpoints" :key="'p'+idx">{{ wp }}</li>
              </ul>
              <div v-if="ev.llm_brief_post.sectors?.length" class="brief-sectors">
                <span
                  v-for="sec in ev.llm_brief_post.sectors"
                  :key="'ps'+sec"
                  class="sector-chip"
                >{{ sec }}</span>
              </div>
            </div>

            <div v-if="ev.related_news?.length" class="related-box">
              <span class="related-label">相关新闻（事前）</span>
              <div
                v-for="(news, idx) in ev.related_news"
                :key="'r'+idx"
                class="related-item"
              >
                <a
                  v-if="articleHref(news)"
                  class="related-title"
                  :href="articleHref(news)"
                  target="_blank"
                  rel="noopener noreferrer"
                  :title="articleLinkTitle(news)"
                >{{ news.title }}</a>
                <div v-else class="related-title">{{ news.title }}</div>
                <div v-if="news.summary" class="related-summary">{{ news.summary }}</div>
                <div class="related-meta">
                  <span v-if="news.source">{{ news.source }}</span>
                  <span v-if="news.published">{{ news.published }}</span>
                  <span v-if="usesSearchFallback(news.url)" class="link-hint">标题搜索</span>
                </div>
              </div>
            </div>

            <div
              v-if="ev.outcome_news?.length || ev.status === 'happened'"
              class="related-box outcome-box"
            >
              <span class="related-label">事后动态</span>
              <template v-if="ev.outcome_news?.length">
                <div
                  v-for="(news, idx) in ev.outcome_news"
                  :key="'o'+idx"
                  class="related-item"
                >
                  <a
                    v-if="articleHref(news)"
                    class="related-title"
                    :href="articleHref(news)"
                    target="_blank"
                    rel="noopener noreferrer"
                    :title="articleLinkTitle(news)"
                  >{{ news.title }}</a>
                  <div v-else class="related-title">{{ news.title }}</div>
                  <div v-if="news.summary" class="related-summary">{{ news.summary }}</div>
                  <div class="related-meta">
                    <span v-if="news.source">{{ news.source }}</span>
                    <span v-if="news.published">{{ news.published }}</span>
                    <span v-if="usesSearchFallback(news.url)" class="link-hint">标题搜索</span>
                  </div>
                </div>
              </template>
              <div v-else class="related-summary">
                事件已过，暂未匹配到事后报道；上方「相关新闻（事前）」仅为会前信息，请勿当作结果。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { enqueueMarketEventBriefs, fetchMarketEvents, fetchMarketEventsStatus } from '../api/marketEvents.js'

const loading = ref(false)
const briefLoading = ref(false)
const error = ref('')
const events = ref([])
const status = ref(null)
const rangeMode = ref('upcoming14')
const customFrom = ref('')
const customTo = ref('')
const activeFrom = ref('')
const activeTo = ref('')

const rangeOptions = [
  { id: 'upcoming14', label: '未来 14 天' },
  { id: 'past7', label: '近 7 天' },
  { id: 'past14', label: '近 14 天' },
  { id: 'around', label: '近 7 + 未来 7' },
  { id: 'custom', label: '自定义' },
]

const statusText = computed(() => {
  const js = status.value?.job_status
  if (!js) return ''
  const parts = [`同步 ${js.status || '未知'}`]
  if (status.value?.upcoming_high_importance != null) {
    parts.push(`高重要 ${status.value.upcoming_high_importance}`)
  }
  return parts.join(' · ')
})

const displayFrom = computed(() => formatYmdDisplay(activeFrom.value))
const displayTo = computed(() => formatYmdDisplay(activeTo.value))
const emptyText = computed(() => {
  if (rangeMode.value === 'upcoming14') return '该区间暂无高重要性事件'
  return '该区间暂无高重要性事件（更早记录可能已按保留策略清理）'
})

const SH_TZ = 'Asia/Shanghai'

function shanghaiNowParts() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: SH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

function shiftYmd(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  utc.setUTCDate(utc.getUTCDate() + days)
  const yy = utc.getUTCFullYear()
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(utc.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function ymdToParam(ymd) {
  return String(ymd || '').replaceAll('-', '')
}

function formatYmdDisplay(ymd8) {
  const s = String(ymd8 || '')
  if (s.length !== 8) return s || '--'
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

function resolveRange() {
  const today = shanghaiNowParts()
  if (rangeMode.value === 'past7') {
    return { from: shiftYmd(today, -6), to: today }
  }
  if (rangeMode.value === 'past14') {
    return { from: shiftYmd(today, -13), to: today }
  }
  if (rangeMode.value === 'around') {
    return { from: shiftYmd(today, -7), to: shiftYmd(today, 7) }
  }
  if (rangeMode.value === 'custom') {
    const from = customFrom.value || shiftYmd(today, -7)
    const to = customTo.value || today
    return { from, to }
  }
  return { from: today, to: shiftYmd(today, 14) }
}

function selectRange(id) {
  rangeMode.value = id
  if (id === 'custom') {
    const today = shanghaiNowParts()
    if (!customFrom.value) customFrom.value = shiftYmd(today, -7)
    if (!customTo.value) customTo.value = today
    return
  }
  loadEvents()
}

function toShanghaiParts(iso) {
  if (!iso) return null
  // Mongo/API may emit naive UTC ("2026-07-23T16:30:00"). Browsers in CST
  // would treat that as local Beijing time and shift display by +8h wrongly.
  const raw = String(iso).trim()
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)
    ? raw
    : `${raw}Z`
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return null
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: SH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]))
  // Some engines emit hour "24" for 00:xx under hour12:false.
  const hour = parts.hour === '24' ? '00' : parts.hour
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}`,
  }
}

const groupedEvents = computed(() => {
  const map = new Map()
  for (const ev of events.value) {
    const parts = toShanghaiParts(ev.event_time)
    const d = parts?.date || '未知日期'
    if (!map.has(d)) map.set(d, [])
    map.get(d).push(ev)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, items]) => ({ date, items }))
})

function formatTime(iso) {
  return toShanghaiParts(iso)?.time || ''
}

function metricLine(ev) {
  const m = ev.metrics || {}
  const parts = []
  if (m.forecast != null && m.forecast !== '') parts.push(`预期 ${m.forecast}`)
  if (m.previous != null && m.previous !== '') parts.push(`前值 ${m.previous}`)
  if (m.actual != null && m.actual !== '') parts.push(`公布 ${m.actual}`)
  if (m.count != null && m.count !== '') parts.push(`家数 ${m.count}`)
  if (m.release_mktcap != null && m.release_mktcap !== '') {
    const yi = Number(m.release_mktcap) / 1e8
    parts.push(`解禁市值 ${Number.isFinite(yi) ? yi.toFixed(2) + '亿' : m.release_mktcap}`)
  }
  return parts.join(' · ')
}

function detailLine(ev) {
  const parts = []
  if (ev.metric_code) parts.push(`指标 ${ev.metric_code}`)
  if (ev.ref_period) parts.push(`期间 ${ev.ref_period}`)
  if (ev.event_subtype) parts.push(`类型 ${ev.event_subtype}`)
  if (ev.symbol_name) parts.push(ev.symbol_name)
  if (ev.status && ev.status !== 'scheduled') parts.push(`状态 ${ev.status}`)
  return parts.join(' · ')
}

function sourceLine(ev) {
  const names = (ev.sources || []).map((s) => s?.name).filter(Boolean)
  return [...new Set(names)].join(' / ')
}

const REGION_ZH = {
  CN: '中国',
  US: '美国',
  EU: '欧元区',
  JP: '日本',
  UK: '英国',
  KR: '韩国',
  AU: '澳大利亚',
  GLOBAL: '全球',
}

function regionLabel(region) {
  const r = String(region || '').trim()
  if (!r) return ''
  const upper = r.toUpperCase()
  if (REGION_ZH[upper]) return REGION_ZH[upper]
  // Already Chinese / other free-text from source.
  return r
}

/** Prefixed display title so global calendars show country at a glance. */
function displayTitle(ev) {
  const title = String(ev?.title || '').trim()
  const label = regionLabel(ev?.region)
  if (!title) return ''
  if (!label || label === '全球') return title
  if (title.includes(label) || title.startsWith(`【${label}】`) || title.startsWith(`[${label}]`)) {
    return title
  }
  return `【${label}】${title}`
}

function primaryUrl(ev) {
  for (const s of ev.sources || []) {
    if (s?.url) return s.url
  }
  return ev.url || ''
}

/** Wall Street CN calendar deep-links often 404 (API still returns them). */
function isUnreliableCalendarUrl(url) {
  try {
    const u = new URL(String(url || ''))
    return (
      /(^|\.)wallstreetcn\.com$/i.test(u.hostname)
      && /\/calendar\/[^/]+\/overview\/?$/i.test(u.pathname)
    )
  } catch {
    return false
  }
}

function titleSearchUrl(title) {
  const q = String(title || '').trim()
  if (!q) return ''
  return `https://www.baidu.com/s?wd=${encodeURIComponent(q)}`
}

function usesSearchFallback(url) {
  const u = String(url || '').trim()
  return !u || isUnreliableCalendarUrl(u)
}

function resolveExternalUrl(url, title) {
  const u = String(url || '').trim()
  if (u && !isUnreliableCalendarUrl(u)) return u
  return titleSearchUrl(title)
}

function articleHref(news) {
  return resolveExternalUrl(news?.url, news?.title)
}

function articleLinkTitle(news) {
  return usesSearchFallback(news?.url)
    ? '源站无可用原文链接，将用标题搜索'
    : '打开原文'
}

function eventArticleHref(ev) {
  return resolveExternalUrl(primaryUrl(ev), displayTitle(ev) || ev?.title)
}

function eventLinkTitle(ev) {
  return usesSearchFallback(primaryUrl(ev))
    ? '源站日历详情页常失效，将用标题搜索'
    : '打开来源页'
}

function importanceColor(imp) {
  if (imp >= 4) return 'error'
  if (imp >= 3) return 'warning'
  return 'grey'
}

function importanceClass(imp) {
  if (imp >= 4) return 'importance-high'
  if (imp >= 3) return 'importance-mid'
  return ''
}

function categoryLabel(cat) {
  const map = {
    macro_data: '宏观数据',
    central_bank: '央行',
    fiscal: '财政',
    regulator: '监管',
    earnings: '财报',
    corporate: '公司',
    conference: '会议',
    other: '其他',
  }
  return map[cat] || cat
}

function statusLabel(status) {
  const map = {
    scheduled: '未开始',
    happened: '已发生',
    cancelled: '已取消',
  }
  return map[status] || status
}

async function loadEvents() {
  loading.value = true
  error.value = ''
  const range = resolveRange()
  if (rangeMode.value === 'custom' && range.from > range.to) {
    error.value = '开始日期不能晚于结束日期'
    loading.value = false
    return
  }
  activeFrom.value = ymdToParam(range.from)
  activeTo.value = ymdToParam(range.to)
  try {
    const [evRes, stRes] = await Promise.all([
      fetchMarketEvents({
        from: activeFrom.value,
        to: activeTo.value,
        min_importance: 3,
      }),
      fetchMarketEventsStatus(),
    ])
    events.value = evRes?.events || evRes?.data?.events || []
    status.value = stRes?.data || stRes
  } catch (e) {
    error.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function enqueueBriefs() {
  briefLoading.value = true
  try {
    await enqueueMarketEventBriefs({ min_importance: 4, limit: 20 })
    await loadEvents()
  } catch (e) {
    error.value = e?.message || '提交简评任务失败'
  } finally {
    briefLoading.value = false
  }
}

onMounted(() => {
  const today = shanghaiNowParts()
  customFrom.value = shiftYmd(today, -7)
  customTo.value = today
  loadEvents()
})
</script>

<style scoped>
.market-events-card {
  background: white;
  border-radius: 12px;
  border: 1px solid #e1e8ed;
  margin-bottom: 20px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.card-header {
  background: #1a202c;
  color: white;
  padding: 12px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.header-main {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}

.header-main h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.header-meta {
  font-size: 12px;
  color: #a0aec0;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.card-content {
  padding: 16px 20px 20px;
}

.brief-rule-hint {
  margin-bottom: 14px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  color: #4a5568;
  font-size: 12px;
  line-height: 1.55;
}

.brief-rule-hint strong {
  color: #c53030;
  font-weight: 700;
}

.range-bar {
  margin-bottom: 14px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
}

.range-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.range-chip {
  border: 1px solid #cbd5e0;
  background: #f7fafc;
  color: #4a5568;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
}

.range-chip.active {
  background: #ebf8ff;
  border-color: #63b3ed;
  color: #2b6cb0;
  font-weight: 600;
}

.range-custom {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #4a5568;
}

.date-input {
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  color: #2d3748;
  background: #fff;
}

.range-meta {
  margin-top: 8px;
  font-size: 12px;
  color: #718096;
}

.retention-note {
  margin-left: 8px;
  color: #a0aec0;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 36px 12px;
  color: #718096;
  font-size: 14px;
}

.error-state {
  margin-bottom: 8px;
}

.day-group {
  margin-bottom: 18px;
}

.day-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid #edf2f7;
}

.day-date {
  font-size: 14px;
  font-weight: 600;
  color: #1a202c;
}

.day-date small {
  margin-left: 6px;
  font-size: 11px;
  font-weight: 500;
  color: #718096;
}

.day-count {
  font-size: 12px;
  color: #718096;
}

.event-item {
  background: #f7fafc;
  border: 1px solid #edf2f7;
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 8px;
  border-left: 3px solid #cbd5e0;
}

.event-item.importance-mid {
  border-left-color: #ecc94b;
}

.event-item.importance-high {
  border-left-color: #f56565;
  background: linear-gradient(135deg, #fff5f5 0%, #f7fafc 60%);
}

.event-header {
  margin-bottom: 6px;
}

.event-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.time {
  font-size: 12px;
  font-weight: 600;
  color: #4a5568;
  font-variant-numeric: tabular-nums;
}

.tz-tag {
  margin-left: 4px;
  font-size: 10px;
  font-weight: 500;
  color: #a0aec0;
}

.meta-chip {
  height: 20px !important;
}

.symbol {
  font-size: 12px;
  color: #3182ce;
  font-weight: 600;
}

.event-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a202c;
  line-height: 1.45;
}

.event-title-link {
  color: inherit;
  text-decoration: none;
}

.event-title-link:hover {
  color: #2b6cb0;
  text-decoration: underline;
}

.link-hint {
  color: #dd6b20;
}

.detail-line,
.metrics-line,
.source-line {
  margin-top: 6px;
  font-size: 12px;
  color: #4a5568;
}

.source-line a {
  color: #3182ce;
  text-decoration: none;
}

.source-line a:hover {
  text-decoration: underline;
}

.brief-box,
.related-box {
  margin-top: 10px;
  border-radius: 8px;
  padding: 10px 12px;
}

.brief-box {
  background: #ebf8ff;
  border: 1px solid #bee3f8;
  color: #2a4365;
}

.brief-box-post {
  background: #f0fff4;
  border: 1px solid #9ae6b4;
}

.related-box {
  background: #f7fafc;
  border: 1px solid #e2e8f0;
}

.outcome-box {
  background: #fffaf0;
  border: 1px solid #fbd38d;
}

.brief-label,
.related-label {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 4px;
}

.brief-label {
  color: #2b6cb0;
}

.related-label {
  color: #4a5568;
}

.brief-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #2d3748;
}

.watchpoints {
  margin: 8px 0 0;
  padding-left: 18px;
  color: #2d3748;
  font-size: 12px;
  line-height: 1.5;
}

.brief-sectors {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.sector-chip {
  background: #ffffff;
  border: 1px solid #90cdf4;
  color: #2b6cb0;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
}

.related-item + .related-item {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e2e8f0;
}

.related-title {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #2b6cb0;
  line-height: 1.4;
  text-decoration: none;
}

a.related-title:hover {
  text-decoration: underline;
}

.related-summary {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: #4a5568;
}

.related-meta {
  margin-top: 4px;
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: #a0aec0;
}
</style>
