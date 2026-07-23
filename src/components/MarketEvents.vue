<template>
  <div class="market-events-card">
    <div class="card-header">
      <div class="header-main">
        <h3>📅 交易日历</h3>
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
          @click="enqueueBriefs"
        >
          生成简评
        </v-btn>
      </div>
    </div>

    <div class="card-content">
      <div v-if="loading && !events.length" class="loading-state">
        <v-progress-circular indeterminate color="primary" size="28" />
        <p>正在加载交易日历...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <v-alert type="error" variant="tonal" density="compact">{{ error }}</v-alert>
      </div>

      <div v-else-if="!groupedEvents.length" class="empty-state">
        未来两周暂无高重要性事件
      </div>

      <div v-else class="events-body">
        <div v-for="group in groupedEvents" :key="group.date" class="day-group">
          <div class="day-title">
            <span class="day-date">{{ group.date }}</span>
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
                <span class="time">{{ formatTime(ev.event_time) }}</span>
                <v-chip
                  v-if="ev.region"
                  size="x-small"
                  variant="tonal"
                  color="primary"
                  class="meta-chip"
                >
                  {{ ev.region }}
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
                <span v-if="ev.symbol" class="symbol">{{ ev.symbol }}</span>
              </div>
            </div>

            <div class="event-title">{{ ev.title }}</div>

            <div v-if="metricLine(ev)" class="metrics-line">
              {{ metricLine(ev) }}
            </div>

            <div v-if="ev.llm_brief?.summary" class="brief-box">
              <span class="brief-label">AI 简评</span>
              <p class="brief-text">{{ ev.llm_brief.summary }}</p>
              <div v-if="ev.llm_brief.sectors?.length" class="brief-sectors">
                <span
                  v-for="sec in ev.llm_brief.sectors"
                  :key="sec"
                  class="sector-chip"
                >{{ sec }}</span>
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

const statusText = computed(() => {
  const js = status.value?.job_status
  if (!js) return ''
  const parts = [`同步 ${js.status || '未知'}`]
  if (status.value?.upcoming_high_importance != null) {
    parts.push(`高重要 ${status.value.upcoming_high_importance}`)
  }
  return parts.join(' · ')
})

const SH_TZ = 'Asia/Shanghai'

function toShanghaiParts(iso) {
  if (!iso) return null
  const d = new Date(iso)
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
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
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
  return parts.join(' · ')
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

async function loadEvents() {
  loading.value = true
  error.value = ''
  try {
    const [evRes, stRes] = await Promise.all([
      fetchMarketEvents({ min_importance: 3 }),
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

onMounted(loadEvents)
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

.metrics-line {
  margin-top: 6px;
  font-size: 12px;
  color: #4a5568;
}

.brief-box {
  margin-top: 10px;
  background: #ebf8ff;
  border: 1px solid #bee3f8;
  border-radius: 8px;
  padding: 10px 12px;
  color: #2a4365;
}

.brief-label {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  color: #2b6cb0;
  margin-bottom: 4px;
}

.brief-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #2d3748;
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
</style>
