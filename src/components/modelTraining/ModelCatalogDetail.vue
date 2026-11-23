<template>
  <aside class="card catalog-detail">
    <p v-if="loading" class="muted">加载模型详情...</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <p v-else-if="!model" class="muted detail-empty">选择左侧模型查看详情。</p>
    <template v-else>
      <header class="detail-head">
        <div>
          <h3>{{ model.model_id }}</h3>
          <p class="muted">
            {{ model.family_id || '-' }} · {{ model.index_code || '-' }}
            <span v-if="model.display_name && model.display_name !== model.model_id">
              · {{ model.display_name }}
            </span>
          </p>
        </div>
        <span class="state-badge" :class="model.state">{{ stateLabel(model.state) }}</span>
      </header>

      <div class="detail-kpis">
        <div>
          <span>accepted</span>
          <strong>{{ model.accepted ? '是' : '否' }}</strong>
          <small v-if="model.accepted_reasons?.length">{{ model.accepted_reasons.join(' + ') }}</small>
        </div>
        <div>
          <span>training gate</span>
          <strong :class="{ 'gate-fail': model.operational_gate && !model.operational_gate.passed }">
            {{ gateLabel }}
          </strong>
          <small v-if="model.operational_gate?.reason">{{ model.operational_gate.reason }}</small>
        </div>
        <div>
          <span>最新验证</span>
          <strong>{{ verdictLabel(model.latest_validation?.verdict) }}</strong>
          <small v-if="model.latest_validation?.protocol">{{ model.latest_validation.protocol }}</small>
        </div>
        <div>
          <span>最近预测</span>
          <strong>{{ model.health?.last_prediction_date || '-' }}</strong>
          <small v-if="model.health?.stale_days">落后 {{ model.health.stale_days }}d</small>
        </div>
        <div>
          <span>健康 / 漂移</span>
          <strong>{{ healthLabel(model.health?.status) }}</strong>
          <small v-if="model.health?.score_drift_z !== null && model.health?.score_drift_z !== undefined">
            drift z {{ formatDrift(model.health.score_drift_z) }}
          </small>
        </div>
      </div>

      <p v-if="gateConflict" class="gate-warning">
        state 与 training gate 不一致：{{ gateConflict }}
      </p>

      <section class="detail-section">
        <div class="section-title">
          <h4>状态历史</h4>
          <span class="muted">{{ model.state_history?.length || 0 }} 条</span>
        </div>
        <ol v-if="model.state_history?.length" class="history-list">
          <li v-for="item in model.state_history" :key="historyKey(item)">
            <span class="history-transition">{{ historyFrom(item) }} → {{ stateLabel(item.to) }}</span>
            <span class="history-date">{{ displayDate(item.at) }}</span>
            <span class="history-reason">{{ item.reason || '-' }}</span>
          </li>
        </ol>
        <p v-else class="muted">无状态历史。</p>
      </section>

      <section class="detail-section">
        <div class="section-title">
          <h4>验证记录</h4>
          <span class="muted">{{ model.validation_runs?.length || 0 }} 条</span>
        </div>
        <p v-if="!model.validation_runs?.length" class="muted">暂无验证记录。</p>
        <article v-for="run in model.validation_runs" :key="run.validation_id" class="validation-run">
          <div class="run-head">
            <strong>{{ run.protocol || '-' }}</strong>
            <span class="verdict-badge" :class="run.verdict">{{ verdictLabel(run.verdict) }}</span>
            <small v-if="run.scope">{{ run.scope }}</small>
            <small v-if="run.created_at">{{ displayDate(run.created_at) }}</small>
          </div>
          <p v-if="run.reason" class="muted">reason: {{ run.reason }}</p>
          <p v-if="run.window?.start || run.window?.end" class="muted">
            window: {{ run.window?.start || '-' }} → {{ run.window?.end || '-' }}
          </p>
          <div v-if="run.metrics && Object.keys(run.metrics).length" class="metric-grid">
            <span v-for="(value, key) in run.metrics" :key="key">
              <em>{{ metricLabel(key) }}</em>
              <strong>{{ formatMetric(key, value) }}</strong>
            </span>
          </div>
          <ul v-if="run.caveats?.length" class="caveat-list">
            <li v-for="caveat in run.caveats" :key="caveat">{{ caveat }}</li>
          </ul>
        </article>
      </section>

      <section class="detail-section">
        <div class="section-title">
          <h4>配方与 artifact</h4>
        </div>
        <div v-if="model.recipe" class="recipe-grid">
          <span><em>model_kind</em><strong>{{ model.recipe.model_kind || '-' }}</strong></span>
          <span><em>feature_set</em><strong>{{ featureLabel }}</strong></span>
          <span><em>train / test / purge</em><strong>{{ model.recipe.train_days ?? '-' }} / {{ model.recipe.test_days ?? '-' }} / {{ model.recipe.purge_days ?? '-' }}</strong></span>
          <span><em>training_end</em><strong>{{ model.artifacts?.[0]?.training_end || model.recipe.end_date || '-' }}</strong></span>
        </div>
        <div v-if="model.artifacts?.length" class="artifact-list">
          <div v-for="artifact in model.artifacts" :key="artifact.result_id + artifact.role" class="artifact-row">
            <strong>{{ artifact.role || 'artifact' }} · {{ artifact.model_kind || '-' }}</strong>
            <span class="mono">{{ artifact.result_id || '-' }}</span>
            <span class="mono muted">{{ artifact.artifact_uri || '-' }}</span>
            <small v-if="artifact.snapshot_id">snapshot: {{ artifact.snapshot_id }}</small>
            <small v-if="artifact.artifact_hash" class="mono">hash: {{ artifact.artifact_hash }}</small>
          </div>
        </div>
      </section>

      <section v-if="model.feature_factors?.length" class="detail-section">
        <div class="section-title">
          <h4>因子状态</h4>
          <span class="muted">{{ model.feature_source || 'unrecorded' }}</span>
        </div>
        <div class="recipe-grid">
          <span v-for="feature in model.feature_factors" :key="`${feature.factor_id}-${feature.name}`">
            <em>{{ feature.name }}</em>
            <strong>{{ feature.factor_id ? (model.feature_status?.[feature.factor_id] || '-') : feature.kind }}</strong>
          </span>
        </div>
        <button type="button" class="link-btn" @click="goFactorRegistry">
          在 📚 因子注册表查看证据
        </button>
      </section>

      <section class="detail-section">
        <div class="section-title">
          <h4>训练任务</h4>
          <span class="muted">{{ model.training_jobs?.length || 0 }} 个</span>
        </div>
        <p v-if="!model.training_jobs?.length" class="muted">无关联训练任务（可能是实验回填）。</p>
        <div v-for="job in model.training_jobs" :key="job.job_id" class="job-link-row">
          <strong>{{ job.name || job.job_id }}</strong>
          <span>{{ job.role }} · {{ job.link_quality || '-' }} · {{ job.status || '-' }}</span>
          <small class="mono">{{ job.job_id }}</small>
        </div>
      </section>

      <section class="detail-section">
        <div class="section-title">
          <h4>预测集</h4>
          <span class="muted">{{ model.prediction_sets?.length || 0 }} 组</span>
        </div>
        <div v-for="(item, index) in model.prediction_sets" :key="index" class="prediction-row">
          <strong>{{ item.kind }} · {{ item.source || '-' }}</strong>
          <span>{{ item.window || '-' }} · {{ item.first_trade_date || '-' }} → {{ item.last_trade_date || '-' }}</span>
          <span>{{ item.date_count || 0 }} 日 / {{ item.prediction_count || 0 }} 条</span>
        </div>
      </section>

      <section class="detail-section">
        <div class="section-title">
          <h4>影子 / 实盘</h4>
        </div>
        <p v-if="!model.shadow_profiles?.length && !model.activations?.length" class="muted">无 shadow / activation。</p>
        <div v-for="profile in model.shadow_profiles" :key="profile.profile_id" class="job-link-row">
          <strong>shadow · {{ profile.profile_id }}</strong>
          <span>{{ profile.enabled ? 'enabled' : 'disabled' }} · {{ profile.source_job_id || '-' }}</span>
        </div>
        <div v-for="activation in model.activations" :key="activation.activation_id" class="job-link-row">
          <strong>live · {{ activation.activation_id }}</strong>
          <span>
            {{ activation.status }} · {{ activation.execution_venue || '-' }}
            <span v-if="activation.admin_override"> · admin_override</span>
            <span v-if="activation.parity_status"> · parity={{ activation.parity_status }}</span>
          </span>
        </div>
      </section>

      <section class="detail-section transition-section">
        <div class="section-title">
          <h4>状态操作</h4>
          <span class="muted">admin only · 写入 state_history</span>
        </div>
        <p class="muted">
          validated 需要 evidence.result_id；shadow 需要 enabled profile；live 需要 live activation；override 会记入审计。
        </p>
        <div class="transition-actions">
          <button v-if="canValidate" type="button" :disabled="transitioning" @click="submitTransition('validated')">
            标记已验收
          </button>
          <button v-if="canPromoteShadow" type="button" :disabled="transitioning" @click="submitTransition('shadow')">
            晋升影子
          </button>
          <button v-if="canPromoteLive" type="button" :disabled="transitioning" @click="submitTransition('live')">
            晋升实盘
          </button>
          <button v-if="canDemoteShadow" type="button" :disabled="transitioning" @click="submitTransition('shadow')">
            降级影子
          </button>
          <button v-if="canDemoteValidated" type="button" :disabled="transitioning" @click="submitTransition('validated')">
            降级已验收
          </button>
          <button v-if="canRetire" type="button" class="danger" :disabled="transitioning" @click="submitTransition('retired')">
            退役
          </button>
          <button v-if="canReject" type="button" class="danger" :disabled="transitioning" @click="submitTransition('rejected')">
            否决
          </button>
        </div>
        <label class="transition-field">
          操作理由（必填）
          <input v-model="transitionReason" type="text" placeholder="例如：OOS 21 期 weak，进入影子观察" />
        </label>
        <label class="transition-field">
          证据 JSON（可选；validated 需 result_id）
          <textarea v-model="transitionEvidence" rows="2" placeholder='{"result_id":"65fef1dc-..."}' />
        </label>
        <label class="transition-override">
          <input v-model="transitionOverride" type="checkbox" />
          admin override（危险，写入审计）
        </label>
        <template v-if="canRetire">
          <label class="transition-override">
            <input v-model="retireDisableProfiles" type="checkbox" />
            退役时停用 shadow profiles
          </label>
          <label class="transition-override">
            <input v-model="retireCancelActivations" type="checkbox" />
            退役时取消 active/scheduled activations（危险）
          </label>
        </template>
        <p v-if="localTransitionError" class="error">{{ localTransitionError }}</p>
        <p v-if="transitionError" class="error">{{ transitionError }}</p>
      </section>
    </template>
  </aside>
</template>

<script setup>
import { computed, inject, ref } from 'vue'

const shellActiveTab = inject('shellActiveTab', null)

function goFactorRegistry() {
  if (shellActiveTab) shellActiveTab.value = 'factor-registry'
}

const props = defineProps({
  model: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  transitioning: { type: Boolean, default: false },
  transitionError: { type: String, default: '' },
})

const emit = defineEmits(['transition'])

const transitionReason = ref('')
const transitionEvidence = ref('')
const transitionOverride = ref(false)
const retireDisableProfiles = ref(true)
const retireCancelActivations = ref(false)
const localTransitionError = ref('')

const canValidate = computed(() => props.model?.state === 'research')
const canPromoteShadow = computed(() => props.model?.state === 'validated')
const canPromoteLive = computed(() => props.model?.state === 'shadow')
const canDemoteShadow = computed(() => props.model?.state === 'live')
const canDemoteValidated = computed(() => props.model?.state === 'shadow')
const canRetire = computed(() => ['validated', 'shadow', 'live'].includes(props.model?.state))
const canReject = computed(() => ['research', 'validated'].includes(props.model?.state))

function submitTransition(targetState) {
  localTransitionError.value = ''
  const reason = String(transitionReason.value || '').trim()
  if (!reason) {
    localTransitionError.value = '请填写操作理由'
    return
  }
  let evidence = {}
  const rawEvidence = String(transitionEvidence.value || '').trim()
  if (rawEvidence) {
    try {
      evidence = JSON.parse(rawEvidence)
    } catch {
      localTransitionError.value = '证据 JSON 不是合法对象'
      return
    }
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
      localTransitionError.value = '证据 JSON 必须是对象'
      return
    }
  }
  const isDemotion = (
    (props.model?.state === 'live' && targetState === 'shadow')
    || (props.model?.state === 'shadow' && targetState === 'validated')
  )
  if (isDemotion) evidence = { ...evidence, demotion: true }
  const payload = {
    target_state: targetState,
    reason,
    evidence,
    admin_override: Boolean(transitionOverride.value),
  }
  if (targetState === 'retired') {
    payload.disable_shadow_profiles = Boolean(retireDisableProfiles.value)
    payload.cancel_activations = Boolean(retireCancelActivations.value)
  }
  emit('transition', payload)
}

function stateLabel(state) {
  return {
    live: '实盘',
    shadow: '影子',
    validated: '已验收',
    research: '研究中',
    retired: '已退役',
    rejected: '已否决',
  }[state] || state || '-'
}

function verdictLabel(verdict) {
  return {
    pass: 'pass',
    weak: 'weak',
    fail: 'fail',
  }[verdict] || verdict || '-'
}

function healthLabel(status) {
  return {
    current: 'current',
    stale: 'stale',
    inactive: 'inactive',
    no_predictions: '无预测',
  }[status] || status || '-'
}

function formatDrift(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : '-'
}

const gateLabel = computed(() => {
  if (!props.model?.operational_gate) return '-'
  return props.model.operational_gate.passed ? 'pass' : 'fail'
})

const gateConflict = computed(() => {
  const model = props.model
  if (!model?.operational_gate) return ''
  if (!['live', 'shadow'].includes(model.state)) return ''
  if (model.operational_gate.passed) return ''
  return `${model.state} 但 training_gate=fail (${model.operational_gate.reason || 'unknown'})；需在 state_history 中写明 override 依据`
})

const featureLabel = computed(() => {
  const names = props.model?.recipe?.feature_names
  if (!Array.isArray(names) || !names.length) return '-'
  return names.join(', ')
})

function displayDate(value) {
  if (!value) return '-'
  const text = String(value)
  if (/^\d{8}$/.test(text)) return text
  return text.replace('T', ' ').slice(0, 19)
}

function metricLabel(key) {
  return {
    periods: 'periods',
    cumulative_return: 'cum',
    annualized_return: 'annualized',
    sharpe: 'sharpe',
    max_drawdown: 'MDD',
    average_excess_return: 'excess/period',
    excess_t: 'excess t',
    mde80_excess: 'MDE80',
    excess_hit_rate: 'excess hit',
  }[key] || key
}

function formatMetric(key, value) {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([year, item]) => `${year}: ${formatMetric('yearly_return', item)}`)
      .join(' · ')
  }
  if (typeof value !== 'number') return String(value)
  if (key.includes('return') || key.includes('drawdown') || key.includes('hit_rate')) {
    return `${(value * 100).toFixed(2)}%`
  }
  return value.toFixed(2)
}

function historyKey(item) {
  return `${item.from}-${item.to}-${item.at}-${item.reason}`
}

function historyFrom(item) {
  return item.from ? stateLabel(item.from) : '创建'
}
</script>

<style scoped>
.catalog-detail {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  overflow: auto;
  max-height: min(75dvh, calc(100dvh - 12rem));
}

.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.detail-head h3 {
  margin: 0 0 4px;
  color: #0f172a;
  overflow-wrap: anywhere;
}

.detail-head p {
  margin: 0;
  color: #64748b;
  font-size: 12px;
}

.state-badge {
  flex: none;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.state-badge.live { background: #dcfce7; color: #047857; }
.state-badge.shadow { background: #dbeafe; color: #1d4ed8; }
.state-badge.validated { background: #ede9fe; color: #6d28d9; }
.state-badge.research { background: #f1f5f9; color: #475569; }
.state-badge.retired { background: #fef3c7; color: #b45309; }
.state-badge.rejected { background: #fee2e2; color: #b91c1c; }

.detail-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
}

.detail-kpis > div {
  padding: 9px 10px;
  border: 1px solid #e6eaf0;
  border-radius: 9px;
  background: #f8fafc;
}

.detail-kpis span,
.detail-kpis small {
  display: block;
  color: #64748b;
  font-size: 11px;
}

.detail-kpis strong {
  display: block;
  margin: 2px 0;
  color: #0f172a;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}

.gate-fail {
  color: #b91c1c;
}

.gate-warning {
  margin: 0;
  padding: 9px 10px;
  border: 1px solid #fdba74;
  border-radius: 8px;
  background: #fff7ed;
  color: #9a3412;
  font-size: 12px;
  line-height: 1.45;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.section-title h4 {
  margin: 0;
  color: #0f172a;
  font-size: 13px;
}

.muted {
  color: #64748b;
  font-size: 12px;
}

.history-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-size: 12px;
}

.history-list li {
  line-height: 1.45;
}

.history-transition {
  display: block;
  color: #0f172a;
  font-weight: 600;
}

.history-date,
.history-reason {
  display: block;
  color: #64748b;
}

.validation-run {
  padding: 9px 10px;
  border: 1px solid #e6eaf0;
  border-radius: 9px;
  background: #fff;
  font-size: 12px;
}

.run-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.run-head small {
  color: #64748b;
}

.verdict-badge {
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
}

.verdict-badge.pass { background: #dcfce7; color: #047857; }
.verdict-badge.weak { background: #fef3c7; color: #b45309; }
.verdict-badge.fail { background: #fee2e2; color: #b91c1c; }

.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(125px, 1fr));
  gap: 6px;
  margin-top: 8px;
}

.metric-grid span {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 7px;
  border-radius: 7px;
  background: #f8fafc;
}

.metric-grid em {
  color: #64748b;
  font-size: 10px;
  font-style: normal;
}

.metric-grid strong {
  color: #0f172a;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.caveat-list {
  margin: 8px 0 0;
  padding-left: 16px;
  color: #9a3412;
  line-height: 1.45;
}

.recipe-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 6px;
}

.recipe-grid span {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 7px 8px;
  border: 1px solid #e6eaf0;
  border-radius: 7px;
  background: #f8fafc;
}

.recipe-grid em {
  color: #64748b;
  font-size: 10px;
  font-style: normal;
}

.recipe-grid strong {
  color: #0f172a;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.artifact-list,
.prediction-row,
.job-link-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 9px;
  border: 1px solid #e6eaf0;
  border-radius: 8px;
  background: #fff;
  font-size: 12px;
}

.artifact-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 9px;
  border-top: 1px solid #eef2f7;
}

.artifact-row:first-child {
  border-top: 0;
}

.mono {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.error {
  color: #b91c1c;
  font-size: 12px;
}

.detail-empty {
  color: #64748b;
}
</style>

.transition-section {
  padding-top: 4px;
  border-top: 1px solid #eef2f7;
}

.transition-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.transition-actions button {
  padding: 7px 10px;
  border: 1px solid #d7dde7;
  border-radius: 8px;
  background: #fff;
  color: #334155;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.transition-actions button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.transition-actions button.danger {
  border-color: #fecaca;
  color: #b91c1c;
  background: #fef2f2;
}

.transition-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #475569;
  font-size: 12px;
}

.transition-field input,
.transition-field textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 7px 8px;
  border: 1px solid #d7dde7;
  border-radius: 8px;
  background: #fff;
  color: #172033;
  font: inherit;
  font-size: 12px;
}

.transition-field textarea {
  resize: vertical;
  font-family: ui-monospace, monospace;
}

.transition-override {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #9a3412;
  font-size: 12px;
}

.link-btn {
  margin-top: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #2563eb;
  font-size: 12px;
  cursor: pointer;
}
