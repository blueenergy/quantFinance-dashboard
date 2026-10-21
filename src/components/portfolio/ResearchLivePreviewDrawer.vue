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

          <section class="parity-section">
            <div class="section-head">
              <h4>研究与实盘对账</h4>
              <span class="badge" :class="parityTone">{{ parityLabel }}</span>
            </div>
            <p v-if="hasUnsupportedFeatures" class="warning">
              研究使用了实盘未实现的功能：{{ unsupportedFeatures.join('、') }}；默认不可激活。
            </p>
            <p v-if="!parity" class="muted">
              该预览任务未返回对账数据（旧任务）。激活默认需要 admin override。
            </p>
            <template v-else>
              <p class="muted">
                检查 {{ parity.checked_dates }} 个调仓日：一致 {{ parity.matched_dates || 0 }} ·
                实盘回填 {{ parity.backfilled_dates || 0 }} ·
                未解释 {{ parity.unexplained_dates || 0 }}
              </p>
              <div v-if="parityDates.length" class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>调仓日</th>
                      <th>状态</th>
                      <th>研究持仓</th>
                      <th>实盘目标</th>
                      <th>仅研究</th>
                      <th>仅实盘</th>
                      <th class="col-text">差异</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in parityDates" :key="row.score_date">
                      <td>{{ row.score_date }}</td>
                      <td>{{ parityStatusLabel(row.status) }}</td>
                      <td>{{ (row.research_symbols || []).length }}</td>
                      <td>{{ (row.live_symbols || []).length }}</td>
                      <td :class="{ negative: (row.research_only || []).length }">
                        {{ (row.research_only || []).length }}
                      </td>
                      <td :class="{ positive: (row.live_only || []).length }">
                        {{ (row.live_only || []).length }}
                      </td>
                      <td class="col-text diff-cell">
                        <span v-if="(row.research_only || []).length">
                          研究独有：{{ row.research_only.join(', ') }}
                        </span>
                        <span v-if="(row.live_only || []).length">
                          实盘独有：{{ row.live_only.join(', ') }}
                        </span>
                        <span v-if="(row.research_only_unbuyable || []).length" class="muted">
                          整手买不起：{{ row.research_only_unbuyable.join(', ') }}
                        </span>
                        <span v-if="(row.live_only_high_rank || []).length" class="negative">
                          研究漏掉高排名：{{ row.live_only_high_rank.join(', ') }}
                        </span>
                        <span v-if="row.unavailable_reason" class="negative">
                          {{ row.unavailable_reason }}
                        </span>
                        <span v-if="row.regime_error" class="negative">
                          regime: {{ row.regime_error }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
          </section>

          <section class="activation-section">
            <div class="section-head">
              <h4>激活到实盘</h4>
              <span class="muted">默认下一个调仓日生效</span>
            </div>

            <div v-if="activation" class="activation-result">
              <p>
                已提交激活 <strong>{{ activation.activation?.activation_id }}</strong> ·
                状态 {{ activation.activation?.status }} ·
                生效日 {{ activation.activation?.effective_date }}
                <span v-if="activation.applied_now"> · 已立即生成首个调仓计划</span>
              </p>
              <p class="muted">
                预设 {{ activation.preset?.preset_id }} ·
                执行场所 {{ activation.activation?.execution_venue }} ·
                对账 {{ activation.parity?.status }}
              </p>
              <p v-if="activation.activation?.status === 'scheduled'" class="muted">
                在生效日之前不会切换；可在计划列表或再次打开本预览前取消。
              </p>
            </div>

            <template v-else>
              <div class="controls">
                <label class="field">
                  <span>执行场所</span>
                  <select v-model="venue">
                    <option value="paper">paper（模拟执行）</option>
                    <option value="live">live（真实信号）</option>
                  </select>
                </label>
                <label class="field">
                  <span>生效日</span>
                  <input v-model="effectiveDateInput" type="date" />
                </label>
                <label class="field field-wide">
                  <span>备注</span>
                  <input v-model="comment" type="text" placeholder="激活原因 / 备注" />
                </label>
              </div>

              <label
                v-if="parityStatus !== 'clean' || hasUnsupportedFeatures"
                class="override"
              >
                <input v-model="adminOverride" type="checkbox" />
                存在未解释差异，确认以 admin override 激活
              </label>

              <p v-if="activationError" class="error">{{ activationError }}</p>
              <button
                type="button"
                class="activate-btn"
                :disabled="!canActivate || activating"
                @click="activate"
              >
                {{ activating ? '提交中…' : activateLabel }}
              </button>
              <p class="muted hint">
                激活只做切换与计划生成，不会直接下单；plan 仍需人工 review / 执行。
              </p>
            </template>
          </section>

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
            预览本身是只读的，不写入 plan；激活后由后端在生效日生成首个调仓计划。
          </p>
        </template>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  activatePortfolioResearchLivePreview,
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
const parity = ref(null)
const unsupportedFeatures = ref([])
const suggestedEffectiveDate = ref('')
const activation = ref(null)
const activating = ref(false)
const activationError = ref('')
const venue = ref('paper')
const effectiveDateInput = ref('')
const adminOverride = ref(false)
const comment = ref('')
let timer = null
let seq = 0

const parityDates = computed(() => parity.value?.dates || [])
const parityStatus = computed(() => parity.value?.status || 'unavailable')
const parityTone = computed(
  () => ({ clean: 'good', diff: 'bad', unavailable: 'warn' })[parityStatus.value] || 'warn',
)
const parityLabel = computed(
  () =>
    ({
      clean: '一致',
      diff: '有未解释差异',
      unavailable: '无对账数据',
    })[parityStatus.value] || parityStatus.value,
)
const hasUnsupportedFeatures = computed(() => unsupportedFeatures.value.length > 0)
const canActivate = computed(
  () =>
    (parityStatus.value === 'clean' && !hasUnsupportedFeatures.value) ||
    adminOverride.value,
)
const activateLabel = computed(() =>
  adminOverride.value && (parityStatus.value !== 'clean' || hasUnsupportedFeatures.value)
    ? 'Admin override 激活'
    : '激活',
)

function parityStatusLabel(status) {
  return (
    {
      match: '一致',
      live_backfill: '实盘回填（可解释）',
      lot_size_backfill: '整手约束（可解释）',
      selection_diff: '选股差异',
      regime_mismatch: '仓位规则差异',
      unavailable: '数据不可用',
    }[status] || status || '-'
  )
}

function toDateInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8)
  if (digits.length !== 8) return ''
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

function toYmd(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 8)
}

function resetActivationState() {
  activation.value = null
  activationError.value = ''
  adminOverride.value = false
  comment.value = ''
  venue.value = 'paper'
}

async function activate() {
  if (!taskId.value || !canActivate.value || activating.value) return
  activating.value = true
  activationError.value = ''
  try {
    const response = await activatePortfolioResearchLivePreview(taskId.value, {
      execution_venue: venue.value,
      effective_date: toYmd(effectiveDateInput.value) || undefined,
      admin_override: adminOverride.value,
      comment: comment.value,
    })
    activation.value = response?.data || null
  } catch (err) {
    const detail = err?.response?.data?.detail
    if (detail?.parity) parity.value = detail.parity
    if (detail?.unsupported_features) unsupportedFeatures.value = detail.unsupported_features
    activationError.value = formatResearchApiError(err, '激活失败')
  } finally {
    activating.value = false
  }
}

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
        parity.value = data.result?.parity || null
        unsupportedFeatures.value = data.unsupported_features || []
        suggestedEffectiveDate.value =
          data.result?.suggested_effective_date || plan.value?.next_rebalance_date || ''
        effectiveDateInput.value = toDateInput(suggestedEffectiveDate.value)
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
  parity.value = null
  unsupportedFeatures.value = []
  suggestedEffectiveDate.value = ''
  effectiveDateInput.value = ''
  resetActivationState()
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

.parity-section,
.activation-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.section-head h4 {
  margin: 0;
  font-size: 14px;
}

.badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.badge.good {
  background: #dcfce7;
  color: #166534;
}

.badge.bad {
  background: #fee2e2;
  color: #991b1b;
}

.badge.warn {
  background: #fef3c7;
  color: #92400e;
}

.diff-cell {
  white-space: normal;
  max-width: 320px;
  line-height: 1.5;
}

.diff-cell span {
  display: block;
}

.controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #475569;
}

.field input,
.field select {
  padding: 7px 9px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: #fff;
  font-size: 13px;
}

.field-wide {
  grid-column: span 2;
}

.override {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #b45309;
  font-size: 13px;
}

.activate-btn {
  align-self: flex-start;
  padding: 8px 18px;
  border: 0;
  border-radius: 8px;
  background: #1d4ed8;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.activate-btn:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}

.activation-result {
  padding: 10px;
  border-radius: 8px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  font-size: 13px;
}

.activation-result p {
  margin: 0 0 4px;
}

@media (max-width: 640px) {
  .field-wide {
    grid-column: span 1;
  }
}
</style>
