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

    <div v-if="showSettings" class="settings-row">
      <div class="settings-copy">
        <span class="settings-label">当前设置</span>
        <span>{{ currentSettingLabel }}</span>
      </div>
      <div class="settings-controls">
        <label class="input-label" for="trailing-stop-input">阈值</label>
        <input
          id="trailing-stop-input"
          v-model="inputPct"
          type="number"
          min="0"
          max="1"
          step="0.01"
          placeholder="0.15"
          class="pct-input"
          :disabled="saving"
        />
        <button type="button" class="primary" :disabled="saving || !canEnable" @click="saveSetting">
          {{ setting?.enabled ? '更新' : '启用' }}
        </button>
        <button
          type="button"
          class="secondary"
          :disabled="saving || !setting?.enabled"
          @click="disableSetting"
        >
          关闭
        </button>
      </div>
      <p v-if="saveError" class="error-text">{{ saveError }}</p>
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
import { getTrailingStopRun, updatePortfolioPlanTrailingStop } from '../../api/portfolioPlans'

const props = defineProps({
  latestRun: { type: Object, default: null },
  trailingStopSetting: { type: Object, default: null },
  planId: { type: String, default: '' },
  defaultExpanded: { type: Boolean, default: false },
  triggersOnly: { type: Boolean, default: false },
  showSettings: { type: Boolean, default: true },
})

const emit = defineEmits(['setting-updated'])

const expanded = ref(props.defaultExpanded)
const loadingDetail = ref(false)
const detailItems = ref([])
const detailRun = ref(null)
const inputPct = ref('')
const saving = ref(false)
const saveError = ref('')

const run = computed(() => detailRun.value || props.latestRun || null)
const setting = computed(() => props.trailingStopSetting || null)

const trailingStopPctLabel = computed(() => {
  const pct = Number(run.value?.trailing_stop_pct ?? setting.value?.trailing_stop_pct)
  return Number.isFinite(pct) && pct > 0 ? `${(pct * 100).toFixed(0)}%` : ''
})

const currentSettingLabel = computed(() => {
  if (!setting.value?.enabled) return '未启用'
  const pct = Number(setting.value.trailing_stop_pct)
  if (!Number.isFinite(pct) || pct <= 0) return '未启用'
  return `${(pct * 100).toFixed(0)}%（${setting.value.source === 'lineage_controls' ? '已保存' : '来自预设'}）`
})

const summaryMessage = computed(() => {
  if (!run.value) return ''
  return run.value.summary?.message || ''
})

const emptyMessage = computed(() => {
  if (!props.planId) return '请选择组合'
  if (setting.value?.enabled) return '等待今日检查'
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

const canEnable = computed(() => {
  const pct = Number(inputPct.value)
  return Number.isFinite(pct) && pct > 0 && pct <= 1
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

function syncInputFromSetting() {
  const pct = Number(setting.value?.trailing_stop_pct)
  inputPct.value = Number.isFinite(pct) && pct > 0 ? String(pct) : '0.15'
  saveError.value = ''
}

async function saveSetting() {
  if (!props.planId || !canEnable.value) return
  saving.value = true
  saveError.value = ''
  try {
    await updatePortfolioPlanTrailingStop(props.planId, {
      trailing_stop_pct: Number(inputPct.value),
    })
    emit('setting-updated')
  } catch (error) {
    saveError.value = error?.response?.data?.detail || error?.message || '保存失败'
  } finally {
    saving.value = false
  }
}

async function disableSetting() {
  if (!props.planId) return
  saving.value = true
  saveError.value = ''
  try {
    await updatePortfolioPlanTrailingStop(props.planId, { trailing_stop_pct: null })
    emit('setting-updated')
  } catch (error) {
    saveError.value = error?.response?.data?.detail || error?.message || '关闭失败'
  } finally {
    saving.value = false
  }
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

watch(
  () => props.trailingStopSetting,
  () => {
    syncInputFromSetting()
  },
  { immediate: true, deep: true },
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

.settings-row {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}

.settings-copy {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 10px;
  font-size: 0.9rem;
  color: #334155;
}

.settings-label {
  color: #64748b;
}

.settings-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.input-label {
  font-size: 0.85rem;
  color: #64748b;
}

.pct-input {
  width: 88px;
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
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

.error-text {
  margin: 8px 0 0;
  color: #b91c1c;
  font-size: 0.85rem;
}

.muted {
  color: #64748b;
}
</style>
