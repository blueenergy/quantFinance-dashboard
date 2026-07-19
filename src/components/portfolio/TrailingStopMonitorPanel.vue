<template>
  <section class="trailing-stop-card">
    <div class="card-header">
      <div>
        <h3>移动止盈监控</h3>
        <p v-if="summaryMessage" class="summary-text">{{ summaryMessage }}</p>
        <p v-else class="summary-text muted">{{ emptyMessage }}</p>
      </div>
      <span v-if="statusBadge" class="status-badge" :class="statusBadge.class">{{ statusBadge.label }}</span>
    </div>

    <div v-if="run" class="meta-row">
      <span>检查日 {{ run.base_date || '-' }}</span>
      <span v-if="trailingStopPctLabel">阈值 {{ trailingStopPctLabel }}</span>
      <span>检查 {{ run.symbols_checked ?? run.summary?.symbols_checked ?? 0 }} 只</span>
      <span>触发 {{ run.triggered_count ?? run.summary?.triggered_count ?? 0 }} 只</span>
      <span v-if="run.sell_plan_id" class="sell-plan-id">卖单计划 {{ run.sell_plan_id }}</span>
    </div>

    <button
      v-if="run && showExpand"
      type="button"
      class="secondary toggle-btn"
      @click="toggleExpanded"
    >
      {{ expanded ? '收起明细' : '展开明细' }}
    </button>

    <div v-if="expanded && detailItems.length" class="table-wrap">
      <table class="items-table">
        <thead>
          <tr>
            <th>标的</th>
            <th>峰值</th>
            <th>收盘</th>
            <th>止损线</th>
            <th>距止损</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in detailItems"
            :key="row.symbol"
            :class="{ triggered: row.triggered }"
          >
            <td>{{ row.symbol }}</td>
            <td>{{ fmtPrice(row.peak_high) }}</td>
            <td>{{ fmtPrice(row.close) }}</td>
            <td>{{ fmtPrice(row.stop_floor) }}</td>
            <td>{{ fmtDistance(row.distance_to_stop_pct) }}</td>
            <td>{{ row.triggered ? '已触发' : '安全' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-else-if="expanded && loadingDetail" class="muted">加载明细中…</p>
    <p v-else-if="expanded && !detailItems.length" class="muted">暂无明细</p>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { getTrailingStopRun } from '../api/portfolioPlans'

const props = defineProps({
  latestRun: { type: Object, default: null },
  planId: { type: String, default: '' },
  defaultExpanded: { type: Boolean, default: false },
  triggersOnly: { type: Boolean, default: false },
})

const expanded = ref(props.defaultExpanded)
const loadingDetail = ref(false)
const detailItems = ref([])
const detailRun = ref(null)

const run = computed(() => detailRun.value || props.latestRun || null)

const trailingStopPctLabel = computed(() => {
  const pct = Number(run.value?.trailing_stop_pct)
  return Number.isFinite(pct) && pct > 0 ? `${(pct * 100).toFixed(0)}%` : ''
})

const summaryMessage = computed(() => {
  if (!run.value) return ''
  return run.value.summary?.message || ''
})

const emptyMessage = computed(() => {
  if (!props.planId) return '请选择组合'
  return '监控未启用或等待今日检查'
})

const statusBadge = computed(() => {
  if (!run.value) return null
  const triggered = Number(run.value.triggered_count ?? run.value.summary?.triggered_count ?? 0)
  if (triggered > 0) {
    return { label: '有触发', class: 'danger' }
  }
  return { label: '全部安全', class: 'safe' }
})

const showExpand = computed(() => {
  if (!run.value) return false
  const checked = Number(run.value.symbols_checked ?? run.value.summary?.symbols_checked ?? 0)
  const triggered = Number(run.value.triggered_count ?? run.value.summary?.triggered_count ?? 0)
  return checked > 0 || triggered > 0
})

function fmtPrice(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : '-'
}

function fmtDistance(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return `${(number * 100).toFixed(2)}%`
}

async function loadDetail() {
  const runId = run.value?.run_id
  if (!runId) {
    detailItems.value = []
    return
  }
  loadingDetail.value = true
  try {
    const res = await getTrailingStopRun(runId)
    detailRun.value = res.data || null
    let items = Array.isArray(detailRun.value?.items) ? detailRun.value.items : []
    if (props.triggersOnly) {
      items = items.filter((row) => row.triggered)
    }
    detailItems.value = items
  } catch (_error) {
    detailItems.value = []
  } finally {
    loadingDetail.value = false
  }
}

function toggleExpanded() {
  expanded.value = !expanded.value
  if (expanded.value && !detailItems.value.length) {
    loadDetail()
  }
}

watch(
  () => props.latestRun?.run_id,
  () => {
    detailRun.value = null
    detailItems.value = []
    expanded.value = props.defaultExpanded
  },
)
</script>

<style scoped>
.trailing-stop-card {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  margin-bottom: 16px;
  padding: 14px 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.card-header h3 {
  margin: 0 0 4px;
  font-size: 1rem;
}

.summary-text {
  margin: 0;
  color: #334155;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 10px;
  font-size: 0.9rem;
  color: #475569;
}

.status-badge {
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

.status-badge.safe {
  background: #dcfce7;
  color: #166534;
}

.status-badge.danger {
  background: #fee2e2;
  color: #991b1b;
}

.toggle-btn {
  margin-top: 10px;
}

.table-wrap {
  margin-top: 12px;
  overflow-x: auto;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.items-table th,
.items-table td {
  border-bottom: 1px solid #e2e8f0;
  padding: 8px 10px;
  text-align: left;
}

.items-table tr.triggered {
  background: #fff1f2;
}

.sell-plan-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #334155;
}

.muted {
  color: #64748b;
}
</style>
