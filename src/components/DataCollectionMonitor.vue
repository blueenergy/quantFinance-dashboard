<template>
  <div class="data-collection-monitor">
    <div class="monitor-header">
      <h2>📊 数据采集监控</h2>
      <button @click="refreshAll" :disabled="loading || loadingOverview" class="refresh-btn">
        {{ loading || loadingOverview ? '刷新中...' : '🔄 刷新' }}
      </button>
    </div>

    <div class="tabs">
      <button
        v-for="t in tabs"
        :key="t.id"
        type="button"
        :class="['tab', { active: activeTab === t.id }]"
        @click="activeTab = t.id"
      >
        {{ t.icon }} {{ t.label }}
      </button>
    </div>

    <!-- Tab: 管线健康 -->
    <div v-show="activeTab === 'pipelines'" class="tab-panel">
      <p v-if="expectedHint" class="hint">参考交易日（工作日近似）: {{ expectedHint }}</p>
      <div v-if="syncHealth" class="health-summary">
        <strong>{{ syncHealth.healthy }}</strong> / {{ syncHealth.total_pipelines }} 管线最近一次为成功（complete）
      </div>
      <div class="table-wrap" v-if="pipelinesRows.length">
        <table class="data-table">
          <thead>
            <tr>
              <th>管线</th>
              <th>调度</th>
              <th>运行日</th>
              <th>状态</th>
              <th>记录数</th>
              <th>完成时间</th>
              <th>错误</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in pipelinesRows" :key="row.job_type">
              <td>{{ row.label }}</td>
              <td class="muted small">{{ row.schedule_hint || '—' }}</td>
              <td class="mono">{{ row.date || '—' }}</td>
              <td><span :class="statusClass(row.status)">{{ row.status }}</span></td>
              <td>{{ row.records_changed ?? '—' }}</td>
              <td class="mono small">{{ fmtBj(row.completed_at) }}</td>
              <td class="err-cell">{{ row.error || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else-if="!loadingOverview" class="empty-state">暂无管线数据</p>
    </div>

    <!-- Tab: 数据新鲜度 -->
    <div v-show="activeTab === 'freshness'" class="tab-panel">
      <div class="table-wrap" v-if="freshnessRows.length">
        <table class="data-table">
          <thead>
            <tr>
              <th>管线</th>
              <th>库</th>
              <th>集合</th>
              <th>字段</th>
              <th>最新值</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="fr in freshnessRows" :key="fr.pipeline_id + fr.collection">
              <td>{{ fr.label }}</td>
              <td class="mono">{{ fr.database }}</td>
              <td class="mono">{{ fr.collection }}</td>
              <td class="mono">{{ fr.field }}</td>
              <td class="mono">{{ fr.latest_value || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else-if="!loadingOverview" class="empty-state">暂无新鲜度数据</p>
    </div>

    <!-- Tab: 流水线图 -->
    <div v-show="activeTab === 'dag'" class="tab-panel">
      <div class="dag-toolbar">
        <span class="qr-label">查询日期:</span>
        <input type="date" v-model="dagDate" class="dag-date-input" @change="loadDag" />
        <button @click="loadDag" :disabled="loadingDag" class="dag-refresh-btn">
          {{ loadingDag ? '加载中...' : '刷新' }}
        </button>
        <div class="dag-legend">
          <span class="leg-item"><span class="leg-dot leg-complete"></span>complete</span>
          <span class="leg-item"><span class="leg-dot leg-failed"></span>failed</span>
          <span class="leg-item"><span class="leg-dot leg-skipped"></span>skipped</span>
          <span class="leg-item"><span class="leg-dot leg-norecord"></span>no_record</span>
        </div>
      </div>
      <div ref="dagRef" class="dag-chart"></div>
      <div v-if="dagSelected" class="dag-detail-card">
        <div class="dag-detail-header">
          <span class="dag-detail-title">{{ dagSelected.label }}</span>
          <span :class="statusClass(dagSelected.status)" style="margin-left:8px;font-size:12px">{{ dagSelected.status }}</span>
          <button @click="dagSelected = null" class="dag-close-btn">✕</button>
        </div>
        <div class="dag-detail-body">
          <div class="dk-row"><span class="dk">分组</span><span>{{ dagSelected.group }}</span></div>
          <div class="dk-row"><span class="dk">运行日</span><span class="mono">{{ dagSelected.date || '—' }}</span></div>
          <div class="dk-row"><span class="dk">完成时间</span><span class="mono small">{{ fmtBj(dagSelected.completed_at) }}</span></div>
          <div class="dk-row"><span class="dk">记录数</span><span>{{ dagSelected.records_changed ?? '—' }}</span></div>
          <div class="dk-row"><span class="dk">上游依赖</span><span>{{ dagSelected.depends_on?.length ? dagSelected.depends_on.join(', ') : '无' }}</span></div>
          <div class="dk-row"><span class="dk">触发模式</span><span>{{ dagSelected.trigger_on_complete ? '上游完成自动触发' : 'cron / 手动' }}</span></div>
          <div class="dk-row" v-if="dagSelected.error"><span class="dk">错误</span><span class="err-cell">{{ dagSelected.error }}</span></div>
          <div class="dk-row" style="grid-column:1/-1"><span class="dk">调度</span><span class="muted small">{{ dagSelected.schedule_hint || '—' }}</span></div>
        </div>
      </div>
    </div>

    <!-- Tab: 分钟线明细（原有） -->
    <div v-show="activeTab === 'minute'" class="tab-panel">
      <div class="stats-cards" v-if="summary">
        <div class="stat-card">
          <div class="stat-icon">📈</div>
          <div class="stat-content">
            <div class="stat-label">总股票数</div>
            <div class="stat-value">{{ summary.total_stocks }}</div>
          </div>
        </div>
        <div class="stat-card active">
          <div class="stat-icon">✅</div>
          <div class="stat-content">
            <div class="stat-label">今日活跃</div>
            <div class="stat-value">{{ summary.active_today }}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📦</div>
          <div class="stat-content">
            <div class="stat-label">总K线数</div>
            <div class="stat-value">{{ formatNumber(summary.total_bars) }}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🔥</div>
          <div class="stat-content">
            <div class="stat-label">今日K线</div>
            <div class="stat-value">{{ formatNumber(summary.today_bars) }}</div>
          </div>
        </div>
      </div>

      <div class="filters">
        <label>
          <input type="checkbox" v-model="showActiveOnly" @change="applyFilters" />
          仅显示今日活跃
        </label>
        <input
          type="text"
          v-model="searchSymbol"
          placeholder="搜索股票代码..."
          @input="applyFilters"
          class="search-input"
        />
      </div>

      <div class="stocks-table-container">
        <table class="stocks-table" v-if="filteredStocks.length > 0">
          <thead>
            <tr>
              <th>股票代码</th>
              <th>状态</th>
              <th>总K线数</th>
              <th>最新时间</th>
              <th>更新间隔</th>
              <th>数据范围</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="stock in paginatedStocks"
              :key="stock.symbol"
              :class="{ 'active-row': stock.is_active_today }"
            >
              <td class="symbol-cell">
                <strong>{{ stock.symbol }}</strong>
              </td>
              <td>
                <span v-if="stock.is_active_today" class="status-badge active">✅ 活跃</span>
                <span v-else class="status-badge inactive">⏸️ 静默</span>
              </td>
              <td>{{ formatNumber(stock.total_bars) }}</td>
              <td>{{ formatDateTime(stock.latest_date) }}</td>
              <td>
                <span
                  v-if="stock.minutes_since_update !== null"
                  :class="getUpdateStatusClass(stock.minutes_since_update)"
                >
                  {{ formatMinutesAgo(stock.minutes_since_update) }}
                </span>
                <span v-else class="text-muted">-</span>
              </td>
              <td class="date-range">
                {{ formatDate(stock.earliest_date) }} ~ {{ formatDate(stock.latest_date) }}
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-state">
          <p>{{ loading ? '加载中...' : '暂无分钟线采集记录' }}</p>
        </div>
      </div>

      <div class="pagination" v-if="totalPages > 1">
        <button @click="prevPage" :disabled="currentPage === 1">上一页</button>
        <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页</span>
        <button @click="nextPage" :disabled="currentPage === totalPages">下一页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import axios from 'axios'

const loading = ref(false)
const loadingOverview = ref(false)
const summary = ref(null)
const stocks = ref([])
const searchSymbol = ref('')
const showActiveOnly = ref(false)
const currentPage = ref(1)
const pageSize = 20

const activeTab = ref('pipelines')
const tabs = [
  { id: 'pipelines', label: '管线健康', icon: '⚡' },
  { id: 'freshness', label: '数据新鲜度', icon: '📅' },
  { id: 'dag', label: '流水线图', icon: '🔀' },
  { id: 'minute', label: '分钟线明细', icon: '📈' },
]

const overviewData = ref(null)

const pipelinesRows = computed(() => overviewData.value?.pipelines || [])
const freshnessRows = computed(() => overviewData.value?.freshness || [])
const syncHealth = computed(() => overviewData.value?.sync_health || null)
const expectedHint = computed(() => overviewData.value?.expected_trade_date_hint || null)

async function loadOverview() {
  loadingOverview.value = true
  try {
    const response = await axios.get('/api/admin/data-monitoring/overview')
    overviewData.value = response.data.data
  } catch (error) {
    console.error('获取数据监控总览失败:', error)
  } finally {
    loadingOverview.value = false
  }
}

async function refreshData() {
  loading.value = true
  try {
    const response = await axios.get('/api/admin/data-collection/status')
    const data = response.data.data
    summary.value = data.summary
    stocks.value = data.stocks
  } catch (error) {
    console.error('获取数据采集状态失败:', error)
    alert('获取分钟线数据失败: ' + (error.response?.data?.detail || error.message))
  } finally {
    loading.value = false
  }
}

async function refreshAll() {
  // DAG is a daily view — do not auto-refresh it on the 30s interval
  // (user can hit the 刷新 button in the DAG toolbar manually)
  await Promise.all([loadOverview(), refreshData()])
}

// ── DAG ──────────────────────────────────────────────────────────────────────
const dagRef = ref(null)
let dagInstance = null
let dagEcharts = null
const dagData = ref(null)
const loadingDag = ref(false)
const dagSelected = ref(null)
const dagDate = ref(new Date().toISOString().slice(0, 10))

const DAG_STATUS_COLOR = {
  complete: '#2e7d32',
  failed: '#c62828',
  skipped: '#f57c00',
  processing: '#1565c0',
  partial: '#f9a825',
  no_record: '#bdbdbd',
}
function dagStatusColor(s) { return DAG_STATUS_COLOR[s] || '#9e9e9e' }

async function loadDag() {
  loadingDag.value = true
  try {
    const d = dagDate.value?.replace(/-/g, '') || ''
    const res = await axios.get(`/api/data-pulse/dag${d ? '?date=' + d : ''}`)
    dagData.value = res.data
    if (activeTab.value === 'dag') {
      await nextTick()
      renderDag()
    }
  } catch (e) {
    console.error('DAG load failed', e)
  } finally {
    loadingDag.value = false
  }
}

function handleDagResize() { dagInstance?.resize() }

async function ensureDagEcharts() {
  if (!dagEcharts) {
    const mod = await import('echarts')
    dagEcharts = mod.default || mod
  }
  if (!dagInstance && dagRef.value) {
    dagInstance = dagEcharts.init(dagRef.value)
    dagInstance.on('click', (params) => {
      if (params.dataType === 'node') dagSelected.value = params.data._raw || null
    })
    window.addEventListener('resize', handleDagResize)
  }
}

async function renderDag() {
  await ensureDagEcharts()
  if (!dagInstance || !dagData.value?.nodes) return

  const { nodes, edges } = dagData.value
  const LAYER_ORDER = ['layer0', 'layer1', 'layer2', 'layer3']
  // left-to-right: each layer is a vertical column
  const LAYER_X     = { layer0: 170, layer1: 490, layer2: 810, layer3: 1110 }
  const LAYER_LABEL = { layer0: 'L0 · 独立采集', layer1: 'L1 · 依赖L0', layer2: 'L2 · 依赖L1', layer3: 'L3 · 分析层' }
  const NODE_W = 132, NODE_H = 44, GAP_Y = 64

  const byGroup = {}
  for (const n of nodes) {
    const g = n.group || 'layer0'
    ;(byGroup[g] = byGroup[g] || []).push(n)
  }

  const maxCount = Math.max(...LAYER_ORDER.map(g => (byGroup[g] || []).length))
  const HEADER_H = 52
  const canvasH = HEADER_H + maxCount * (NODE_H + GAP_Y) - GAP_Y + 60
  const canvasW = 1280

  const eNodes = []

  // layer header labels as silent annotation nodes at top of each column
  for (const g of LAYER_ORDER) {
    if (!byGroup[g]?.length) continue
    eNodes.push({
      id: `__lbl_${g}`,
      name: LAYER_LABEL[g],
      x: LAYER_X[g] || 140,
      y: 18,
      symbol: 'rect',
      symbolSize: [NODE_W + 14, 26],
      label: { show: true, formatter: LAYER_LABEL[g], fontSize: 12, color: '#555', fontStyle: 'italic' },
      itemStyle: { color: 'rgba(240,240,240,0.7)', borderColor: '#ccc', borderWidth: 1 },
      emphasis: { scale: false, itemStyle: { color: 'rgba(240,240,240,0.7)' } },
      silent: true,
    })
  }

  for (const g of LAYER_ORDER) {
    const layerNodes = byGroup[g] || []
    const totalH = layerNodes.length * (NODE_H + GAP_Y) - GAP_Y
    // center each column's nodes vertically within the content area
    const startY = HEADER_H + (canvasH - HEADER_H - 30 - totalH) / 2
    const cx = LAYER_X[g] || 140
    layerNodes.forEach((n, i) => {
      eNodes.push({
        id: n.id,
        name: n.label,
        x: cx,
        y: startY + i * (NODE_H + GAP_Y) + NODE_H / 2,
        symbol: 'roundRect',
        symbolSize: [NODE_W, NODE_H],
        label: { show: true, formatter: n.label, fontSize: 12, color: '#fff', overflow: 'truncate', width: NODE_W - 10 },
        itemStyle: {
          color: dagStatusColor(n.status),
          borderColor: n.status === 'complete' ? '#1b5e20' : '#bbb',
          borderWidth: 1,
        },
        emphasis: { scale: false, itemStyle: { opacity: 0.85 } },
        _raw: n,
      })
    })
  }

  // Build a quick id→status map so edges can inherit source node color
  const statusById = Object.fromEntries(nodes.map(n => [n.id, n.status]))

  const eEdges = edges.map(e => {
    const color = dagStatusColor(statusById[e.source]) || '#aaa'
    return {
      source: e.source,
      target: e.target,
      lineStyle: { color, width: 2, curveness: 0.12, opacity: 0.55 },
      emphasis: { lineStyle: { width: 3.5, opacity: 1 } },
    }
  })

  // auto-fit: compute zoom so the full canvas fits the chart container
  const chartH = dagRef.value?.clientHeight || 860
  const chartW = dagRef.value?.clientWidth || 1100
  // don't zoom below 0.9 — keep node gaps readable; user can pan with roam
  const zoom = Math.min((chartW - 20) / canvasW, 0.95)

  dagInstance.setOption({
    backgroundColor: '#fafafa',
    tooltip: {
      trigger: 'item',
      formatter: (p) => {
        if (p.dataType !== 'node') return ''
        const d = p.data._raw
        if (!d) return ''
        return [
          `<b>${d.label}</b>`,
          `状态: ${d.status || '—'}`,
          `运行日: ${d.date || '—'}`,
          `完成(北京): ${fmtBj(d.completed_at)}`,
          d.records_changed != null ? `记录数: ${d.records_changed}` : '',
          d.error ? `<span style="color:#c62828">✕ ${String(d.error).slice(0, 80)}</span>` : '',
        ].filter(Boolean).join('<br/>')
      },
    },
    series: [{
      type: 'graph',
      layout: 'none',
      nodes: eNodes,
      edges: eEdges,
      roam: true,
      zoom,
      center: [canvasW / 2, HEADER_H + (4 * (NODE_H + GAP_Y)) / 2],
      edgeSymbol: ['circle', 'arrow'],
      edgeSymbolSize: [6, 12],
      lineStyle: { opacity: 0.55 },
    }],
  }, true)
  dagInstance.resize()
}

watch(activeTab, async (tab) => {
  if (tab === 'dag') {
    if (!dagData.value) await loadDag()
    else { await nextTick(); renderDag() }
  }
})

function statusClass(status) {
  if (status === 'complete') return 'st-ok'
  if (status === 'no_record') return 'st-miss'
  if (status === 'skipped') return 'st-skip'
  if (status === 'failed') return 'st-fail'
  return 'st-warn'
}

const filteredStocks = computed(() => {
  let result = stocks.value
  if (showActiveOnly.value) result = result.filter((s) => s.is_active_today)
  if (searchSymbol.value) {
    const search = searchSymbol.value.toLowerCase()
    result = result.filter((s) => s.symbol.toLowerCase().includes(search))
  }
  return result
})

const totalPages = computed(() => Math.ceil(filteredStocks.value.length / pageSize))

const paginatedStocks = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredStocks.value.slice(start, start + pageSize)
})

function prevPage() {
  if (currentPage.value > 1) currentPage.value--
}
function nextPage() {
  if (currentPage.value < totalPages.value) currentPage.value++
}
function applyFilters() {
  currentPage.value = 1
}

function formatNumber(num) {
  return num?.toLocaleString() || '0'
}
function formatDateTime(dateStr) {
  if (!dateStr || dateStr.length < 12) return '-'
  const year = dateStr.substring(0, 4)
  const month = dateStr.substring(4, 6)
  const day = dateStr.substring(6, 8)
  const hour = dateStr.substring(8, 10)
  const minute = dateStr.substring(10, 12)
  return `${year}-${month}-${day} ${hour}:${minute}`
}
function formatDate(dateStr) {
  if (!dateStr || dateStr.length < 8) return '-'
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
}
function formatMinutesAgo(minutes) {
  if (minutes === null || minutes === undefined) return '-'
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  return `${Math.floor(hours / 24)}天前`
}

// 将后端返回的 ISO 时间字符串（已含 +08:00）格式化为 MM-DD HH:mm (北京时间)
function fmtBj(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    // 后端已转 +08:00，直接用 UTC+8 偏移输出
    const bj = new Date(d.getTime() + (d.getTimezoneOffset() + 480) * 60000)
    const mm = String(bj.getMonth() + 1).padStart(2, '0')
    const dd = String(bj.getDate()).padStart(2, '0')
    const hh = String(bj.getHours()).padStart(2, '0')
    const mi = String(bj.getMinutes()).padStart(2, '0')
    return `${mm}-${dd} ${hh}:${mi}`
  } catch {
    return iso
  }
}
function getUpdateStatusClass(minutes) {
  if (minutes === null) return 'text-muted'
  if (minutes < 5) return 'update-fresh'
  if (minutes < 30) return 'update-recent'
  if (minutes < 1440) return 'update-old'
  return 'update-stale'
}

let intervalId = null
onMounted(() => {
  refreshAll()
  intervalId = setInterval(refreshAll, 30000)
})
onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
  window.removeEventListener('resize', handleDagResize)
  dagInstance?.dispose()
  dagInstance = null
})
</script>

<style scoped>
.data-collection-monitor {
  padding: 20px;
  background: #fff;
  border-radius: 8px;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.monitor-header h2 {
  margin: 0;
  color: #333;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
}

.tab {
  padding: 8px 14px;
  border: none;
  background: #f5f5f5;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #555;
}

.tab.active {
  background: #2196f3;
  color: #fff;
}

.tab-panel {
  min-height: 120px;
}

.hint {
  font-size: 12px;
  color: #666;
  margin: 0 0 8px 0;
}

.health-summary {
  margin-bottom: 12px;
  font-size: 14px;
}

.table-wrap {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th,
.data-table td {
  padding: 8px 10px;
  border-bottom: 1px solid #eee;
  text-align: left;
  vertical-align: top;
}

.data-table th {
  background: #f5f5f5;
  font-weight: 600;
}

.mono {
  font-family: 'Roboto Mono', monospace;
  font-size: 12px;
}

.small {
  font-size: 11px;
}

.muted {
  color: #888;
  max-width: 220px;
}

.err-cell {
  max-width: 200px;
  word-break: break-word;
  color: #c62828;
  font-size: 12px;
}

.st-ok {
  color: #2e7d32;
  font-weight: 600;
}
.st-miss {
  color: #757575;
}
.st-skip {
  color: #f57c00;
}
.st-fail {
  color: #c62828;
  font-weight: 600;
}
.st-warn {
  color: #f9a825;
}

.refresh-btn {
  padding: 8px 16px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}
.refresh-btn:hover:not(:disabled) {
  background: #1976d2;
}
.refresh-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}
.stat-card {
  display: flex;
  align-items: center;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
  gap: 15px;
}
.stat-card.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}
.stat-icon {
  font-size: 32px;
}
.stat-label {
  font-size: 13px;
  opacity: 0.8;
  margin-bottom: 5px;
}
.stat-value {
  font-size: 24px;
  font-weight: bold;
}

.filters {
  display: flex;
  gap: 15px;
  align-items: center;
  margin-bottom: 15px;
  padding: 10px;
  background: #f9f9f9;
  border-radius: 4px;
}
.search-input {
  flex: 1;
  max-width: 300px;
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.stocks-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.stocks-table th {
  background: #f5f5f5;
  padding: 12px 8px;
  text-align: left;
  font-weight: 600;
  border-bottom: 2px solid #ddd;
}
.stocks-table td {
  padding: 10px 8px;
  border-bottom: 1px solid #eee;
}
.stocks-table tr.active-row {
  background: #f0f9ff;
}
.symbol-cell {
  font-family: 'Courier New', monospace;
  font-size: 15px;
}
.status-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}
.status-badge.active {
  background: #4caf50;
  color: white;
}
.status-badge.inactive {
  background: #e0e0e0;
  color: #666;
}
.update-fresh {
  color: #4caf50;
  font-weight: 600;
}
.update-recent {
  color: #ff9800;
}
.update-old {
  color: #f44336;
}
.update-stale {
  color: #999;
}
.text-muted {
  color: #999;
}
.date-range {
  font-size: 12px;
  color: #666;
}
.empty-state {
  text-align: center;
  padding: 24px;
  color: #999;
}
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  margin-top: 16px;
}
.pagination button {
  padding: 6px 16px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.pagination button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.page-info {
  color: #666;
  font-size: 14px;
}

/* ── DAG ── */
.dag-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.dag-date-input {
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
}
.dag-refresh-btn {
  padding: 4px 12px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.dag-refresh-btn:disabled { background: #ccc; cursor: not-allowed; }
.dag-legend { display: flex; gap: 12px; align-items: center; font-size: 12px; color: #555; }
.leg-item { display: flex; align-items: center; gap: 4px; }
.leg-dot { width: 11px; height: 11px; border-radius: 2px; display: inline-block; }
.leg-complete { background: #2e7d32; }
.leg-failed   { background: #c62828; }
.leg-skipped  { background: #f57c00; }
.leg-norecord { background: #bdbdbd; }
.dag-chart {
  width: 100%;
  height: 860px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fafafa;
}
.dag-detail-card {
  margin-top: 12px;
  padding: 12px 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
.dag-detail-header {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}
.dag-detail-title { font-weight: 600; font-size: 14px; }
.dag-close-btn { margin-left: auto; background: none; border: none; cursor: pointer; font-size: 16px; color: #666; }
.dag-detail-body { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
.dk-row { display: flex; gap: 8px; font-size: 13px; align-items: flex-start; }
.dk { color: #888; min-width: 64px; flex-shrink: 0; }
.qr-label { font-size: 13px; color: #666; }
</style>
