<template>
  <div class="etf-heatmap-panel">
    <div v-if="viewMode === 'grid'" class="heatmap-grid-view">
      <div class="toolbar">
        <div class="window-btns">
          <span class="label">统计窗口</span>
          <button
            v-for="w in windowOptions"
            :key="w.value"
            type="button"
            class="pill"
            :class="{ on: window === w.value }"
            @click="setWindow(w.value)"
          >
            {{ w.label }}
          </button>
        </div>
        <div v-if="tradeDate" class="as-of">
          份额数据日：<strong>{{ tradeDate }}</strong>
          <span class="legend-hint">颜色 = 窗口净申购 / 期初规模；红进绿出，深浅表示强度</span>
        </div>
      </div>

      <div v-if="loading" class="loading-state">正在加载行业资金热力图…</div>
      <div v-else-if="error" class="error-state">{{ error }}</div>
      <template v-else>
        <section class="grid-section">
          <h3 class="section-title">行业主题</h3>
          <div class="cell-grid">
            <button
              v-for="cell in themeCells"
              :key="cell.bucket_id"
              type="button"
              class="heat-cell"
              :style="cellStyle(cell)"
              @click="openSeries(cell)"
            >
              <span class="cell-name">{{ cell.name }}</span>
              <span class="cell-rate">{{ formatInflowRatePct(cell.inflow_rate) }}</span>
              <span class="cell-amt">{{ formatInflowYi(cell.net_inflow) }}</span>
            </button>
          </div>
        </section>

        <section class="grid-section broad-section">
          <h3 class="section-title">宽基（市场 β）</h3>
          <div class="cell-grid broad-grid">
            <button
              v-for="cell in broadCells"
              :key="cell.bucket_id"
              type="button"
              class="heat-cell"
              :style="cellStyleBroad(cell)"
              @click="openSeries(cell)"
            >
              <span class="cell-name">{{ cell.name }}</span>
              <span class="cell-rate">{{ formatInflowRatePct(cell.inflow_rate) }}</span>
              <span class="cell-amt">{{ formatInflowYi(cell.net_inflow) }}</span>
            </button>
          </div>
        </section>
      </template>
    </div>

    <div v-else class="series-view">
      <div class="series-toolbar">
        <button type="button" class="back-button" @click="viewMode = 'grid'">← 返回热力图</button>
        <h3>{{ activeCell?.name }} · 资金时序</h3>
      </div>
      <p v-if="memberLockNote" class="member-note">{{ memberLockNote }}</p>
      <ul v-if="seriesMembers.length" class="member-list">
        <li v-for="m in seriesMembers" :key="m.ts_code">
          <button type="button" class="member-link" @click="$emit('open-etf', m.ts_code)">
            {{ m.name }} ({{ m.ts_code }})
          </button>
        </li>
      </ul>
      <EtfThemeFlowChart
        :title="`${activeCell?.name || ''} · 前3合计`"
        :series="seriesData"
        :flagship-code="flagshipCode"
        :loading="seriesLoading"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import request from '../utils/request'
import EtfThemeFlowChart from './EtfThemeFlowChart.vue'
import {
  formatInflowRatePct,
  formatInflowYi,
  heatmapCellBackground,
  heatmapCellForeground,
  heatmapIntensityCap,
} from '../utils/etfHeatmapScale.js'

defineEmits(['open-etf'])

const windowOptions = [
  { value: '1d', label: '1日' },
  { value: '5d', label: '5日' },
  { value: '20d', label: '20日' },
]

const window = ref('5d')
const loading = ref(true)
const error = ref('')
const tradeDate = ref(null)
const cells = ref([])

const viewMode = ref('grid')
const activeCell = ref(null)
const seriesLoading = ref(false)
const seriesData = ref([])
const seriesMembers = ref([])
const flagshipCode = ref('')
const memberLockNote = ref('')

const themeCells = computed(() => cells.value.filter((c) => c.kind === 'theme'))
const broadCells = computed(() => cells.value.filter((c) => c.kind === 'broad'))

const themeCap = computed(() =>
  heatmapIntensityCap(themeCells.value.map((c) => c.inflow_rate)),
)
const broadCap = computed(() =>
  heatmapIntensityCap(broadCells.value.map((c) => c.inflow_rate)),
)

function buildCellStyle(cell, cap) {
  return {
    background: heatmapCellBackground(cell.inflow_rate, cap),
    '--heat-cell-fg': heatmapCellForeground(cell.inflow_rate, cap),
  }
}

function cellStyle(cell) {
  return buildCellStyle(cell, themeCap.value)
}

function cellStyleBroad(cell) {
  return buildCellStyle(cell, broadCap.value)
}

async function fetchHeatmap() {
  loading.value = true
  error.value = ''
  try {
    const body = await request.get('/etf/heatmap', { params: { window: window.value } })
    cells.value = body.cells || []
    tradeDate.value = body.trade_date || body.share_as_of || null
    if (body.message && !cells.value.length) {
      error.value = body.message
    }
  } catch (e) {
    error.value = '加载热力图失败: ' + (e.message || String(e))
  } finally {
    loading.value = false
  }
}

function setWindow(w) {
  if (window.value === w) return
  window.value = w
  fetchHeatmap()
}

async function openSeries(cell) {
  activeCell.value = cell
  viewMode.value = 'series'
  seriesLoading.value = true
  seriesData.value = []
  seriesMembers.value = []
  flagshipCode.value = cell.flagship_ts_code || ''
  memberLockNote.value = ''
  try {
    const body = await request.get(`/etf/heatmap/${cell.bucket_id}/series`, {
      params: { limit: 250, trade_date: tradeDate.value || undefined },
    })
    seriesData.value = body.series || []
    seriesMembers.value = body.members || []
    flagshipCode.value = body.flagship_ts_code || flagshipCode.value
    memberLockNote.value = body.member_lock_note || ''
  } catch (e) {
    error.value = '加载时序失败: ' + (e.message || String(e))
    viewMode.value = 'grid'
  } finally {
    seriesLoading.value = false
  }
}

watch(viewMode, (v) => {
  if (v === 'grid') {
    activeCell.value = null
  }
})

onMounted(() => {
  fetchHeatmap()
})

defineExpose({ refresh: fetchHeatmap })
</script>

<style scoped>
.etf-heatmap-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--text-color);
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  align-items: center;
  margin-bottom: 8px;
}
.window-btns {
  display: flex;
  align-items: center;
  gap: 8px;
}
.window-btns .label {
  font-size: 13px;
  color: var(--text-color, #666);
}
.pill {
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--border-color, #ddd);
  background: var(--card-bg, #fff);
  cursor: pointer;
  font-size: 13px;
}
.pill.on {
  background: var(--primary-color, #1890ff);
  color: #fff;
  border-color: var(--primary-color, #1890ff);
}
.as-of {
  font-size: 13px;
  color: var(--text-color, #555);
}
.legend-hint {
  margin-left: 12px;
  color: var(--text-muted, #888);
}
.section-title {
  margin: 0 0 12px;
  font-size: 15px;
}
.cell-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}
.broad-grid {
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
}
.heat-cell {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px 10px;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 88px;
  color: var(--heat-cell-fg);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.heat-cell:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}
.cell-name {
  font-weight: 600;
  font-size: 14px;
  color: inherit;
}
.cell-rate {
  font-size: 16px;
  font-weight: 700;
  color: inherit;
}
.cell-amt {
  font-size: 12px;
  color: inherit;
  opacity: 0.78;
}
.grid-section {
  margin-bottom: 24px;
}
.loading-state,
.error-state {
  padding: 24px;
  text-align: center;
  color: var(--text-muted, #666);
}
.error-state { color: #c0392b; }
.series-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}
.series-toolbar h3 {
  margin: 0;
  font-size: 16px;
}
.back-button {
  padding: 6px 12px;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}
.member-note {
  font-size: 12px;
  color: var(--text-muted, #888);
  margin: 0 0 8px;
}
.member-list {
  list-style: none;
  padding: 0;
  margin: 0 0 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.member-link {
  background: none;
  border: none;
  color: var(--primary-color, #1890ff);
  cursor: pointer;
  font-size: 13px;
  padding: 0;
  text-decoration: underline;
}
</style>
