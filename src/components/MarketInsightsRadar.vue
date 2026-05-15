<template>
  <div class="insights-page">
    <div class="page-header">
      <div>
        <h3>火眼金睛</h3>
        <p>不预测，不煽动，只揭示市场结构变化的证据。</p>
      </div>
      <div class="actions">
        <input v-model="tradeDate" type="date" />
        <select v-model="eventType" @change="loadEvents">
          <option value="">全部事件</option>
          <option value="MARKET_BREADTH_RECOVERY">广度修复</option>
          <option value="MARKET_BREADTH_DIVERGENCE">广度背离</option>
          <option value="EARLY_SECTOR_DIFFUSION">早期扩散</option>
          <option value="SECTOR_DIFFUSION">板块扩散</option>
          <option value="SECTOR_FADE">板块退潮</option>
          <option value="VOLUME_QUALITY_SHIFT">成交质量变化</option>
        </select>
        <select v-model="sectorLevel" @change="loadSectorStrength">
          <option value="L1">L1</option>
          <option value="L2">L2</option>
          <option value="L3">L3</option>
        </select>
        <button class="btn primary" :disabled="loading" @click="loadAll">刷新</button>
        <button class="btn" :disabled="loading" @click="generateEvents">生成洞察</button>
      </div>
    </div>

    <div v-if="error" class="alert error">{{ error }}</div>
    <div v-if="message" class="alert info">{{ message }}</div>

    <section class="overview">
      <div class="card">
        <span>市场状态</span>
        <strong>{{ overview?.market_state || '-' }}</strong>
      </div>
      <div class="card">
        <span>实时阳谱</span>
        <strong>{{ percent(overview?.latest_spectrum?.yang_spectrum) }}</strong>
      </div>
      <div class="card">
        <span>事件数</span>
        <strong>{{ overview?.event_count ?? '-' }}</strong>
      </div>
      <div class="card">
        <span>最新快照</span>
        <strong>{{ overview?.latest_spectrum?.snapshot_time || overview?.latest_event_snapshot_time || '-' }}</strong>
      </div>
    </section>

    <section class="layout">
      <div class="panel events">
        <div class="panel-title">
          <h4>实时洞察事件流</h4>
          <span>{{ events.length }} 条</span>
        </div>
        <div v-if="loading" class="empty">加载中...</div>
        <div v-else-if="events.length === 0" class="empty">暂无事件，可先点击“生成洞察”。</div>
        <template v-else>
          <button
            v-for="event in events"
            :key="event._id"
            type="button"
            :class="['event-item', { active: selectedEvent?._id === event._id }]"
            @click="selectedEvent = event"
          >
            <div class="event-top">
              <span :class="['badge', event.severity]">{{ event.event_type }}</span>
              <span>{{ score(event.confidence) }}</span>
            </div>
            <strong>{{ event.title }}</strong>
            <p>{{ event.summary }}</p>
            <small>{{ formatSnapshot(event.snapshot_time) }} · {{ event.subject_name }}</small>
          </button>
        </template>
      </div>

      <div class="panel sectors">
        <div class="panel-title">
          <h4>板块结构雷达</h4>
          <span>{{ sectorStrength.length }} 个 {{ sectorLevel }}</span>
        </div>
        <table v-if="sectorStrength.length">
          <thead>
            <tr>
              <th>板块</th>
              <th>上涨比例</th>
              <th>相对强弱</th>
              <th>变化</th>
              <th>均笔</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in sectorStrength" :key="row.sector_code" @click="selectSector(row)">
              <td>
                <strong>{{ row.sector_name }}</strong>
                <div class="muted">{{ row.sector_code }}</div>
              </td>
              <td>{{ percent(row.positive_ratio) }}</td>
              <td :class="numClass(row.relative_positive_ratio)">{{ percent(row.relative_positive_ratio) }}</td>
              <td :class="numClass(row.delta_positive_ratio)">{{ percent(row.delta_positive_ratio) }}</td>
              <td>{{ yuan(row.avg_trade_size_yuan) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty">暂无板块强弱数据。</div>
      </div>

      <div class="panel evidence">
        <div class="panel-title">
          <h4>证据透视镜</h4>
          <span>{{ selectedEvent?.subject_name || '未选择事件' }}</span>
        </div>
        <template v-if="selectedEvent">
          <h3>{{ selectedEvent.title }}</h3>
          <p class="summary">{{ selectedEvent.summary }}</p>
          <div class="kv">
            <span>置信度</span><strong>{{ score(selectedEvent.confidence) }}</strong>
            <span>严重程度</span><strong>{{ selectedEvent.severity }}</strong>
            <span>主体</span><strong>{{ selectedEvent.subject_name }}</strong>
            <span>时间</span><strong>{{ formatSnapshot(selectedEvent.snapshot_time) }}</strong>
          </div>
          <h5>支持证据</h5>
          <ul>
            <li v-for="item in selectedEvent.supporting_points || []" :key="item">{{ item }}</li>
          </ul>
          <h5>反向证据</h5>
          <ul>
            <li v-for="item in selectedEvent.counter_points || []" :key="item">{{ item }}</li>
          </ul>
          <h5>后续观察</h5>
          <ul>
            <li v-for="item in selectedEvent.watch_conditions || []" :key="item">{{ item }}</li>
          </ul>
          <h5>核心指标</h5>
          <pre>{{ JSON.stringify(selectedEvent.evidence || {}, null, 2) }}</pre>
          <template v-if="selectedSectorSeries.length">
            <h5>板块趋势</h5>
            <div v-if="selectedSectorSeriesSimulated" class="simulated-note">
              当前真实快照不足，以下趋势为基于最新快照的非持久化模拟序列，仅用于周末/盘后调试界面和规则。
            </div>
            <div class="trend-chart">
              <svg viewBox="0 0 320 120" preserveAspectRatio="none">
                <polyline :points="trendPoints" fill="none" stroke="#2563eb" stroke-width="2" />
              </svg>
              <div class="trend-axis">
                <span>{{ formatSnapshot(selectedSectorSeries[0]?.snapshot_time) }}</span>
                <span>{{ formatSnapshot(selectedSectorSeries[selectedSectorSeries.length - 1]?.snapshot_time) }}</span>
              </div>
            </div>
            <div class="trend-kpis">
              <span>首值 {{ percent(selectedSectorSeries[0]?.positive_ratio) }}</span>
              <span>最新 {{ percent(selectedSectorSeries[selectedSectorSeries.length - 1]?.positive_ratio) }}</span>
              <span>样本 {{ selectedSectorSeries.length }}</span>
            </div>
          </template>
        </template>
        <div v-else class="empty">点击左侧事件查看证据链。</div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'

const today = new Date().toISOString().slice(0, 10)
const tradeDate = ref(today)
const eventType = ref('')
const sectorLevel = ref('L2')
const loading = ref(false)
const error = ref('')
const message = ref('')
const overview = ref(null)
const events = ref([])
const selectedEvent = ref(null)
const sectorStrength = ref([])
const selectedSectorSeries = ref([])
const selectedSectorSeriesSimulated = ref(false)

const trendPoints = computed(() => {
  const rows = selectedSectorSeries.value
  if (!rows.length) return ''
  const values = rows.map((row) => Number(row.positive_ratio)).filter((n) => Number.isFinite(n))
  if (!values.length) return ''
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)
  const range = max - min || 1
  return rows
    .map((row, index) => {
      const x = rows.length === 1 ? 160 : (index / (rows.length - 1)) * 320
      const y = 110 - ((Number(row.positive_ratio) - min) / range) * 100
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})

function compactDate() {
  return (tradeDate.value || '').replaceAll('-', '')
}

function setError(err, fallback) {
  error.value = err?.response?.data?.detail || err?.message || fallback
}

async function loadOverview() {
  const res = await axios.get('/api/market-insights/overview', { params: { trade_date: compactDate() } })
  overview.value = res.data
}

async function loadEvents() {
  const params = { trade_date: compactDate(), limit: 100 }
  if (eventType.value) params.event_type = eventType.value
  const res = await axios.get('/api/market-insights/events', { params })
  events.value = res.data?.data || []
  if (!selectedEvent.value || !events.value.some((e) => e._id === selectedEvent.value?._id)) {
    selectedEvent.value = events.value[0] || null
  }
}

async function loadSectorStrength() {
  const res = await axios.get('/api/market-insights/sector-strength', {
    params: { trade_date: compactDate(), level: sectorLevel.value, window: 15, limit: 50 },
  })
  sectorStrength.value = res.data?.data || []
  selectedSectorSeries.value = []
  selectedSectorSeriesSimulated.value = false
}

async function loadAll() {
  loading.value = true
  error.value = ''
  message.value = ''
  try {
    await Promise.all([loadOverview(), loadEvents(), loadSectorStrength()])
  } catch (err) {
    setError(err, '加载火眼金睛数据失败')
  } finally {
    loading.value = false
  }
}

async function generateEvents() {
  loading.value = true
  error.value = ''
  try {
    const res = await axios.post('/api/market-insights/generate', null, { params: { trade_date: compactDate() } })
    message.value = `已生成/更新 ${res.data?.written || 0} 条洞察事件`
    await loadAll()
  } catch (err) {
    setError(err, '生成洞察事件失败')
  } finally {
    loading.value = false
  }
}

async function loadSectorSeries(row) {
  const res = await axios.get('/api/market-insights/sector-strength/series', {
    params: {
      trade_date: compactDate(),
      level: row.level || sectorLevel.value,
      sector_code: row.sector_code,
      limit: 120,
      simulate_if_sparse: true,
    },
  })
  selectedSectorSeries.value = res.data?.data || []
  selectedSectorSeriesSimulated.value = !!res.data?.is_simulated
}

async function selectSector(row) {
  selectedEvent.value = {
    event_type: 'SECTOR_STRUCTURE',
    severity: 'info',
    confidence: 0,
    title: `${row.sector_name} 板块结构`,
    summary: `${row.sector_name} 当前上涨比例 ${percent(row.positive_ratio)}，相对全市场 ${percent(row.relative_positive_ratio)}。`,
    subject_name: row.sector_name,
    snapshot_time: row.snapshot_time,
    supporting_points: ['这是板块结构快照，不是买卖信号'],
    counter_points: ['需要结合事件流判断变化方向'],
    watch_conditions: ['观察 15 分钟变化和成交质量是否持续'],
    evidence: row,
  }
  try {
    await loadSectorSeries(row)
  } catch (err) {
    setError(err, '加载板块趋势失败')
  }
}

function percent(value) {
  const n = Number(value)
  return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : '-'
}

function score(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? `${n.toFixed(1)}分` : '-'
}

function yuan(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  return n.toFixed(0)
}

function numClass(value) {
  const n = Number(value)
  return {
    positive: Number.isFinite(n) && n > 0,
    negative: Number.isFinite(n) && n < 0,
  }
}

function formatSnapshot(value) {
  const s = String(value || '')
  if (s.length !== 12) return s || '-'
  return `${s.slice(8, 10)}:${s.slice(10, 12)}`
}

onMounted(loadAll)
</script>

<style scoped>
.insights-page {
  background: #fff;
  border-radius: 8px;
  color: #1f2937;
  padding: 16px;
}
.page-header,
.actions,
.overview,
.panel-title,
.event-top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.page-header,
.panel-title,
.event-top {
  justify-content: space-between;
}
.page-header {
  flex-wrap: wrap;
  margin-bottom: 14px;
}
h3,
h4,
h5,
p {
  margin: 0;
}
.page-header p,
.summary,
.muted {
  color: #64748b;
}
.actions {
  flex-wrap: wrap;
}
input,
select {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 6px 8px;
}
.btn {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  cursor: pointer;
  padding: 6px 10px;
}
.btn.primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.alert {
  border-radius: 6px;
  margin-bottom: 10px;
  padding: 8px 10px;
}
.alert.error {
  background: #fee2e2;
  color: #991b1b;
}
.alert.info {
  background: #e0f2fe;
  color: #075985;
}
.overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 12px;
}
.card,
.panel {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
}
.card span {
  color: #64748b;
  display: block;
  font-size: 12px;
}
.card strong {
  display: block;
  font-size: 20px;
  margin-top: 4px;
}
.layout {
  display: grid;
  grid-template-columns: minmax(260px, 0.9fr) minmax(420px, 1.35fr) minmax(320px, 1fr);
  gap: 12px;
}
.event-item {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  display: block;
  margin-top: 10px;
  padding: 10px;
  text-align: left;
  width: 100%;
}
.event-item.active {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
}
.event-item p {
  color: #475569;
  font-size: 13px;
  margin: 6px 0;
}
.event-item small {
  color: #64748b;
}
.badge {
  background: #f1f5f9;
  border-radius: 999px;
  color: #475569;
  display: inline-block;
  font-size: 11px;
  padding: 2px 7px;
}
.badge.high {
  background: #fee2e2;
  color: #b91c1c;
}
.badge.medium {
  background: #fef3c7;
  color: #92400e;
}
.badge.low {
  background: #dcfce7;
  color: #166534;
}
table {
  border-collapse: collapse;
  margin-top: 10px;
  width: 100%;
}
th,
td {
  border: 1px solid #e2e8f0;
  font-size: 13px;
  padding: 7px 8px;
  text-align: left;
}
th {
  background: #f8fafc;
  color: #475569;
}
tbody tr {
  cursor: pointer;
}
tbody tr:hover {
  background: #f8fafc;
}
.positive {
  color: #dc2626;
}
.negative {
  color: #16a34a;
}
.empty {
  color: #64748b;
  padding: 20px;
  text-align: center;
}
.kv {
  display: grid;
  gap: 6px 12px;
  grid-template-columns: 80px 1fr;
  margin: 12px 0;
}
.kv span {
  color: #64748b;
}
ul {
  margin: 6px 0 12px 18px;
  padding: 0;
}
pre {
  background: #0f172a;
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 12px;
  max-height: 280px;
  overflow: auto;
  padding: 10px;
}
.trend-chart {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-top: 8px;
  padding: 8px;
}
.simulated-note {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 6px;
  color: #9a3412;
  font-size: 12px;
  margin-top: 8px;
  padding: 7px 8px;
}
.trend-chart svg {
  display: block;
  height: 120px;
  width: 100%;
}
.trend-axis,
.trend-kpis {
  color: #64748b;
  display: flex;
  font-size: 12px;
  justify-content: space-between;
  margin-top: 6px;
}
@media (max-width: 1100px) {
  .layout,
  .overview {
    grid-template-columns: 1fr;
  }
}
</style>
