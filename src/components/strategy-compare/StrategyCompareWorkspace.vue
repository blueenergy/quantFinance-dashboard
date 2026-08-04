<template>
  <div class="strategy-compare-workspace">
    <p v-if="message" class="message">{{ message }}</p>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <p v-if="resultsErrorMessage" class="error">{{ resultsErrorMessage }}</p>

    <section class="layout">
      <StrategyCompareBatchList
        :batches="batches"
        :selected-batch-id="selectedBatchId"
        :loading="loading"
        @create="drawerOpen = true"
        @select="onSelectBatch"
      />

      <Teleport v-if="selectedBatch" to="body" :disabled="!detailMaximized">
        <div :class="detailMaximized ? 'detail-fullscreen-shell' : 'detail-inline-shell'">
          <div
            v-if="detailMaximized"
            class="detail-fullscreen-backdrop"
            aria-hidden="true"
            @click="exitDetailFullscreen"
          />
          <main
            class="card detail-card"
            :class="{ 'detail-card--maximized': detailMaximized }"
            :role="detailMaximized ? 'dialog' : undefined"
            :aria-modal="detailMaximized ? 'true' : undefined"
            aria-label="对比实验详情"
            @click.stop
          >
            <header class="detail-toolbar">
              <div class="detail-title">
                <h3>{{ selectedBatch.name }}</h3>
                <p class="muted">
                  {{ (selectedBatch.symbols || []).join(', ') }}
                  · {{ selectedBatch.start_date }} - {{ selectedBatch.end_date }}
                  · {{ selectedBatch.status }}
                </p>
                <p v-if="selectedBatch.summary" class="muted">
                  进度 {{ selectedBatch.summary.completed || 0 }} /
                  {{ selectedBatch.summary.total || 0 }}
                  · 失败 {{ selectedBatch.summary.failed || 0 }}
                </p>
              </div>
              <div class="actions">
                <button type="button" @click="toggleDetailFullscreen">
                  {{ detailMaximized ? '退出全屏' : '全屏' }}
                </button>
                <button type="button" @click="refreshAll()">刷新</button>
                <button type="button" :disabled="!canCancel" @click="cancelSelected()">取消</button>
                <button type="button" class="danger" @click="deleteSelected()">删除</button>
              </div>
            </header>

            <div class="detail-body">
              <CompareResultPanel
                v-if="resultRows.length"
                :rows="resultRows"
                :sweep-view="sweepView"
                :sort-key="sortKey"
                :sort-order="sortOrder"
                :pct="pct"
                :num="num"
                @sort="onSort"
                @open-detail="openDetail"
              />
              <p v-else-if="resultsLoading" class="muted">加载结果…</p>
              <p v-else class="muted">
                {{ isBatchRunning ? '回测进行中，完成后将显示对比结果。' : '暂无结果行。' }}
              </p>
            </div>
          </main>
        </div>
      </Teleport>

      <main v-else class="card detail-card empty-card">
        <p class="muted">请选择一个对比实验，或新建对比实验。</p>
      </main>
    </section>

    <CompareCreateDrawer
      :open="drawerOpen"
      :strategies="usableStrategies"
      :templates="strategyTemplates"
      :submitting="submitting"
      @close="drawerOpen = false"
      @submit="onSubmit"
    />

    <BacktestResultDetailModal
      :open="detailOpen"
      :title="detailTitle"
      :subtitle="detailSubtitle"
      :result="detailResult"
      :meta="detailMeta"
      :loading="detailLoading"
      :error="detailError"
      @close="closeDetail"
    >
      <template #actions>
        <BacktestDeployActions :payload="detailDeployPayload" />
        <button type="button" class="action-close-btn" @click="closeDetail">关闭</button>
      </template>
    </BacktestResultDetailModal>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import {
  createBatch,
  getBacktestResult,
  listStrategies,
  listStrategyTemplates,
} from '../../api/strategyLab'
import { useDetailFullscreen } from '../../composables/useDetailFullscreen'
import { useStrategyCompareBatches } from '../../composables/useStrategyCompareBatches'
import { useStrategyCompareResults } from '../../composables/useStrategyCompareResults'
import '../../assets/styles/detail-fullscreen.css'
import { normalizeStrategies, normalizeTemplateGroups } from '../../utils/strategyLabParams'
import BacktestDeployActions from '../BacktestDeployActions.vue'
import BacktestResultDetailModal from '../BacktestResultDetailModal.vue'
import CompareCreateDrawer from './CompareCreateDrawer.vue'
import CompareResultPanel from './CompareResultPanel.vue'
import StrategyCompareBatchList from './StrategyCompareBatchList.vue'

const props = defineProps({
  workspaceActive: { type: Boolean, default: true },
})

const workspaceActiveRef = computed(() => props.workspaceActive)

const {
  batches,
  loading,
  message,
  errorMessage,
  selectedBatchId,
  selectedBatch,
  refreshAll,
  selectBatch,
  cancelSelected,
  deleteSelected,
} = useStrategyCompareBatches({ workspaceActive: workspaceActiveRef })

const {
  rows: resultRows,
  loading: resultsLoading,
  errorMessage: resultsErrorMessage,
  sortKey,
  sortOrder,
  sweepView,
  loadResults,
  setSort,
} = useStrategyCompareResults()

const { detailMaximized, toggleDetailFullscreen, exitDetailFullscreen } = useDetailFullscreen({
  resetWhen: selectedBatchId,
})

const drawerOpen = ref(false)
const submitting = ref(false)
const strategies = ref([])
const strategyTemplates = ref({})

const detailOpen = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const detailResult = ref(null)
const detailMeta = ref({})
const detailRow = ref(null)

const usableStrategies = computed(() => strategies.value.filter((s) => s.can_use !== false))

const isBatchRunning = computed(() => {
  const status = String(selectedBatch.value?.status || '').toLowerCase()
  return ['pending', 'running'].includes(status)
})

const canCancel = computed(() => isBatchRunning.value)

const detailTitle = computed(() => {
  const symbol = detailMeta.value.symbol || detailResult.value?.symbol || '回测结果'
  return `回测结果 · ${symbol}`
})

const detailSubtitle = computed(() => {
  const parts = [
    detailMeta.value.strategy_key || detailResult.value?.strategy_key,
    detailMeta.value.preset || detailResult.value?.preset,
  ].filter(Boolean)
  return parts.join(' · ')
})

const detailDeployPayload = computed(() => ({
  symbol: detailMeta.value.symbol || detailResult.value?.symbol,
  strategy_key: detailMeta.value.strategy_key || detailResult.value?.strategy_key,
  strategy_params:
    detailMeta.value.strategy_params || detailResult.value?.strategy_params || {},
  asset_type:
    detailResult.value?.asset_type ||
    detailRow.value?.asset_type ||
    detailMeta.value.asset_type ||
    'stock',
}))

function pct(value) {
  if (value == null || Number.isNaN(Number(value))) return '-'
  return `${(Number(value) * 100).toFixed(2)}%`
}

function num(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return '-'
  return Number(value).toFixed(digits)
}

function buildDetailMeta(row, result = null) {
  return {
    symbol: row?.symbol || selectedBatch.value?.symbols?.[0] || result?.symbol || '',
    strategy_key: row?.strategy_key || result?.strategy_key || '',
    preset: row?.preset || result?.preset || '',
    strategy_params: row?.strategy_params || result?.strategy_params || {},
    start_date: selectedBatch.value?.start_date || '',
    end_date: selectedBatch.value?.end_date || '',
    initial_cash: selectedBatch.value?.initial_cash ?? 1000000,
  }
}

async function openDetail(row) {
  if (!row?.task_id) return
  detailOpen.value = true
  detailLoading.value = true
  detailError.value = ''
  detailResult.value = null
  detailRow.value = row
  detailMeta.value = buildDetailMeta(row)
  try {
    const result = await getBacktestResult(row.task_id)
    detailResult.value = result
    detailMeta.value = buildDetailMeta(row, result)
  } catch (err) {
    detailError.value = err?.response?.data?.detail || err?.message || '加载结果失败'
  } finally {
    detailLoading.value = false
  }
}

function closeDetail() {
  detailOpen.value = false
  detailLoading.value = false
  detailError.value = ''
  detailResult.value = null
  detailRow.value = null
  detailMeta.value = {}
}

async function loadStrategyMeta() {
  const [strategyPayload, templatesPayload] = await Promise.all([
    listStrategies(),
    listStrategyTemplates(),
  ])
  strategies.value = normalizeStrategies(strategyPayload?.strategies || strategyPayload || [])
  strategyTemplates.value = normalizeTemplateGroups(templatesPayload?.templates || templatesPayload || {})
}

async function onSelectBatch(batchId) {
  selectBatch(batchId)
  await loadResults(batchId)
}

async function onSort(key) {
  setSort(key)
  if (selectedBatchId.value) {
    await loadResults(selectedBatchId.value)
  }
}

async function onSubmit(payload) {
  submitting.value = true
  message.value = ''
  errorMessage.value = ''
  const expectedTasks = (payload.symbols?.length || 0) * (payload.combos?.length || 0)
  try {
    const result = await createBatch(payload)
    const created = Number(result?.created_tasks ?? 0)
    if (expectedTasks > 0 && created !== expectedTasks) {
      errorMessage.value = `后端仅创建 ${created}/${expectedTasks} 个任务。请确认 quant-api 已用最新代码重建并重启，然后重新提交。`
    }
    drawerOpen.value = false
    message.value = `已创建对比实验 ${result.batch_id}（${created} 个任务）`
    await refreshAll()
    if (result.batch_id) {
      await onSelectBatch(result.batch_id)
    }
  } catch (err) {
    errorMessage.value = err?.response?.data?.detail || err?.message || '创建失败'
  } finally {
    submitting.value = false
  }
}

watch(selectedBatchId, (batchId) => {
  if (batchId) void loadResults(batchId)
})

watch(
  () => props.workspaceActive,
  (active) => {
    if (active) void refreshAll()
  },
)

onMounted(async () => {
  await loadStrategyMeta()
})
</script>

<style scoped>
.strategy-compare-workspace {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.layout {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  min-width: 0;
}

.card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  min-width: 0;
}

.detail-card {
  min-width: 0;
}

.detail-title h3 {
  margin: 0;
}

.detail-toolbar button {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
}

.detail-toolbar .danger {
  border-color: #fecaca;
  color: #b91c1c;
}

.muted {
  color: #64748b;
}

.message {
  color: #2563eb;
}

.error {
  color: #b91c1c;
}

.empty-card {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

.action-close-btn {
  padding: 10px 20px;
  background: #f4f4f5;
  color: #606266;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.action-close-btn:hover {
  background: #e9e9eb;
}
</style>
