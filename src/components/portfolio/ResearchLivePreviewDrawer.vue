<template>
  <div v-if="open" class="preview-overlay" @click.self="$emit('close')">
    <aside class="preview-panel" role="dialog" aria-modal="true" aria-label="实盘预览">
      <header class="preview-head">
        <div>
          <h3>实盘预览</h3>
          <p class="muted">{{ row?.combo_key || row?.variant || '组合研究结果' }}</p>
        </div>
        <button type="button" class="link-btn" @click="$emit('close')">关闭 ✕</button>
      </header>

      <div class="preview-body">
        <p v-if="loading" class="muted">正在按 live 语义计算目标持仓…</p>
        <p v-if="error" class="error">{{ error }}</p>

        <template v-if="plan && !loading">
          <p v-if="plan.baseline_stale" class="warning">
            账户快照不可用，本次仅生成 advisory 预览：{{ plan.baseline_error || 'account_not_synced' }}
          </p>
          <p v-if="!plan.executable" class="warning">
            当前不可执行：{{ plan.non_executable_reason || plan.status }}
          </p>

          <div class="metric-grid">
            <span><em>Top N</em>{{ plan.summary?.target_top_n ?? '-' }}</span>
            <span><em>单票目标</em>{{ money(plan.summary?.target_amount_per_position) }}</span>
            <span><em>权益</em>{{ money(plan.summary?.equity) }}</span>
            <span><em>现金</em>{{ money(plan.summary?.cash) }}</span>
            <span><em>capital basis</em>{{ plan.capital_basis || '-' }}</span>
            <span><em>score date</em>{{ plan.score_date || '-' }}</span>
            <span><em>execute date</em>{{ plan.execute_date || '-' }}</span>
            <span><em>仓位模式</em>{{ plan.regime_cash?.action || 'off' }}</span>
            <span><em>基准</em>{{ plan.summary?.baseline_source || '-' }}</span>
            <span><em>计划状态</em>{{ plan.status || '-' }}</span>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th class="col-text">代码 / 名称</th>
                  <th>动作</th>
                  <th>当前</th>
                  <th>目标</th>
                  <th>差额</th>
                  <th>价格</th>
                  <th>金额</th>
                  <th class="col-text">blockers</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in items" :key="item.symbol">
                  <td>{{ item.rank }}</td>
                  <td class="col-text">{{ item.symbol }} {{ item.name || '' }}</td>
                  <td>{{ actionLabel(item.action) }}</td>
                  <td>{{ num(item.current_shares, 0) }}</td>
                  <td>{{ num(item.target_shares, 0) }}</td>
                  <td :class="signClass(item.delta_shares)">
                    {{ item.delta_shares > 0 ? '+' : '' }}{{ num(item.delta_shares, 0) }}
                  </td>
                  <td>{{ num(item.estimated_price) }}</td>
                  <td>{{ money(item.estimated_amount) }}</td>
                  <td class="col-text">{{ (item.blockers || []).join(', ') || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="muted hint">
            只读预览，不会写入 plan。生成候选预设 / 激活到实盘是下一步。
          </p>
        </template>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import {
  createPortfolioResearchLivePreview,
  getPortfolioResearchLivePreview,
} from '../../api/portfolioResearch'
import { formatResearchApiError } from '../../utils/portfolioResearchPayload'

const props = defineProps({
  open: { type: Boolean, default: false },
  resultId: { type: String, default: '' },
  row: { type: Object, default: null },
  num: { type: Function, required: true },
})

defineEmits(['close'])

const loading = ref(false)
const error = ref('')
const plan = ref(null)
const items = ref([])
let timer = null
let seq = 0

function localDateYmd() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
}

function clearTimer() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

function money(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return number.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

function actionLabel(action) {
  return { buy: '买入', sell: '卖出', hold: '持有', skip: '跳过' }[action] || action || '-'
}

function signClass(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number === 0) return ''
  return number > 0 ? 'positive' : 'negative'
}

function poll(current) {
  timer = setTimeout(async () => {
    if (current !== seq) return
    try {
      const response = await getPortfolioResearchLivePreview(taskId.value)
      const data = response?.data || {}
      if (data.status === 'completed') {
        loading.value = false
        plan.value = data.result?.plan || null
        items.value = data.result?.items || []
        return
      }
      if (data.status === 'failed') {
        loading.value = false
        error.value = data.error_message || '实盘预览失败'
        return
      }
      poll(current)
    } catch (err) {
      if (current !== seq) return
      loading.value = false
      error.value = formatResearchApiError(err, '实盘预览失败')
    }
  }, 1200)
}

async function startPreview() {
  clearTimer()
  const current = ++seq
  plan.value = null
  items.value = []
  error.value = ''
  if (!props.open || !props.resultId || !props.row?.combo_key) return
  loading.value = true
  try {
    const response = await createPortfolioResearchLivePreview(props.resultId, {
      combo_key: props.row.combo_key,
      as_of_date: localDateYmd(),
    })
    if (current !== seq) return
    taskId.value = response?.data?.task_id || ''
    if (!taskId.value) {
      loading.value = false
      error.value = '实盘预览任务创建失败'
      return
    }
    poll(current)
  } catch (err) {
    if (current !== seq) return
    loading.value = false
    error.value = formatResearchApiError(err, '实盘预览失败')
  }
}

const taskId = ref('')

watch(
  () => [props.open, props.resultId, props.row?.combo_key],
  () => { startPreview() },
  { immediate: true },
)

onBeforeUnmount(() => {
  seq += 1
  clearTimer()
})
</script>

<style scoped>
.preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(15, 23, 42, 0.42);
  display: flex;
  justify-content: flex-end;
}

.preview-panel {
  width: min(980px, 96vw);
  height: 100%;
  overflow-y: auto;
  background: #fff;
  box-shadow: -16px 0 40px rgba(15, 23, 42, 0.18);
  padding: 18px 20px 28px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.preview-head h3 {
  margin: 0 0 4px;
}

.preview-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
}

.metric-grid span {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  font-size: 13px;
}

.metric-grid em {
  color: #64748b;
  font-size: 11px;
  font-style: normal;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  white-space: nowrap;
}

th,
td {
  padding: 6px 8px;
  border-bottom: 1px solid #e2e8f0;
  text-align: right;
}

th:first-child,
td:first-child,
.col-text {
  text-align: left;
}

th {
  color: #64748b;
  background: #f8fafc;
  font-weight: 600;
}

.warning {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: #fff7ed;
  color: #c2410c;
  font-size: 13px;
}

.error {
  color: #b91c1c;
}

.muted {
  color: #64748b;
}

.hint {
  font-size: 12px;
}

.positive {
  color: #15803d;
}

.negative {
  color: #b91c1c;
}
</style>
