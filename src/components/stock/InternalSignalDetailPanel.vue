<template>
  <Teleport to="body">
    <div v-if="detail" class="internal-popover-backdrop" @click="$emit('close')">
      <div class="internal-detail-panel" @click.stop>
        <header class="internal-detail-head">
          <div>
            <span class="internal-detail-title">
              {{ dimensionLabel }}信号详情
              <template v-if="detail.symbol"> · {{ detail.name || detail.symbol }}</template>
            </span>
            <p v-if="detail.finding?.summary" class="internal-detail-summary">
              {{ detail.finding.summary }}
            </p>
          </div>
          <button type="button" class="internal-detail-close" @click="$emit('close')">关闭</button>
        </header>

        <section class="internal-detail-section">
          <h5>规则条件</h5>
          <dl class="internal-kv">
            <div><dt>指标</dt><dd>{{ condition.metric || '—' }}</dd></div>
            <div><dt>进入条件</dt><dd>{{ entryConditionText }}</dd></div>
            <div v-if="exitConditionText"><dt>退出条件</dt><dd>{{ exitConditionText }}</dd></div>
            <div v-if="peerConditionText"><dt>同业分位条件</dt><dd>{{ peerConditionText }}</dd></div>
            <div v-if="detail.finding?.engine_version"><dt>规则版本</dt><dd>{{ detail.finding.engine_version }}</dd></div>
            <div v-if="detail.finding?.rule_config_hash"><dt>配置指纹</dt><dd>{{ detail.finding.rule_config_hash }}</dd></div>
            <div v-if="detail.finding?.evidence_version"><dt>证据期间</dt><dd>{{ detail.finding.evidence_version }}</dd></div>
          </dl>
        </section>

        <section v-if="primaryEvidence" class="internal-detail-section">
          <h5>当前证据</h5>
          <dl class="internal-kv">
            <div><dt>实际值</dt><dd>{{ formatValue(primaryEvidence.value, primaryEvidence.unit) }}</dd></div>
            <div v-if="peerContext" class="peer-percentile-block">
              <dt>行业百分位</dt>
              <dd>
                <strong>{{ formatPercentile(peerContext.percentile) }}</strong>
                <span class="peer-sample">（样本 {{ peerContext.peerCount }} 家）</span>
                <p class="peer-percentile-note">{{ peerPercentileExplanation }}</p>
                <p v-if="peerRankingHint" class="peer-percentile-hint">{{ peerRankingHint }}</p>
              </dd>
            </div>
            <div v-if="primaryEvidence.end_date"><dt>财报期</dt><dd>{{ primaryEvidence.end_date }}</dd></div>
            <div v-if="primaryEvidence.update_flag != null"><dt>修订版本</dt><dd>{{ primaryEvidence.update_flag }}</dd></div>
          </dl>
          <ul v-if="primaryEvidence.points?.length" class="internal-point-list">
            <li v-for="point in primaryEvidence.points" :key="`${point.end_date}-${point.value}`">
              {{ point.end_date }}：{{ formatValue(point.value, primaryEvidence.unit) }}
            </li>
          </ul>
        </section>

        <section v-if="componentEvidence.length" class="internal-detail-section">
          <h5>组成明细</h5>
          <article
            v-for="component in componentEvidence"
            :key="component.component || component.metric"
            class="internal-component-card"
          >
            <strong>{{ componentLabel(component) }}</strong>
            <p v-if="component.value != null">
              合计/当前：{{ formatValue(component.value, component.unit) }}
              <span v-if="component.unit === 'currency'" class="currency-unit-hint">（财报原始单位：元）</span>
            </p>
            <ul v-if="component.points?.length" class="internal-point-list">
              <li v-for="point in component.points" :key="`${component.metric}-${point.end_date}`">
                {{ point.end_date }}：{{ formatValue(point.value, component.unit) }}
              </li>
            </ul>
          </article>
        </section>

        <section v-if="detail.finding?.detail" class="internal-detail-section">
          <h5>引擎说明</h5>
          <p class="internal-detail-note">{{ detail.finding.detail }}</p>
        </section>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  detail: { type: Object, default: null },
})

defineEmits(['close'])

const OPERATOR_LABELS = {
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
}

const dimensionLabel = computed(() => (
  props.detail?.dimension === 'weakness' ? '劣势' : '优势'
))

const condition = computed(() => props.detail?.finding?.rule_condition || {})
const lifecycle = computed(() => props.detail?.finding?.lifecycle_policy || {})

const primaryEvidence = computed(() => {
  const rows = props.detail?.finding?.evidence || []
  return rows.find((row) => !row.component) || rows[0] || null
})

const componentEvidence = computed(() => (
  (props.detail?.finding?.evidence || []).filter((row) => row.component)
))

const peerContext = computed(() => {
  const evidence = primaryEvidence.value
  if (!evidence || evidence.peer_percentile == null) return null
  return {
    percentile: Number(evidence.peer_percentile),
    peerCount: Number(evidence.peer_count || 0),
    metric: evidence.metric,
    sourceField: evidence.source_field,
    endDate: evidence.end_date,
    sw1Code: evidence.sw1_code,
    sw1Name: evidence.sw1_name,
    membershipMode: evidence.industry_membership_mode || 'current_sw1',
    value: evidence.value,
    unit: evidence.unit,
  }
})

const METRIC_LABELS = {
  roe_level: 'ROE（年报口径）',
  debt_to_assets: '资产负债率',
}

const peerPercentileExplanation = computed(() => {
  const ctx = peerContext.value
  if (!ctx) return ''
  const industryLabel = ctx.sw1Name
    ? `申万2021一级行业「${ctx.sw1Name}」`
    : '申万2021一级行业'
  const metricLabel = METRIC_LABELS[ctx.metric] || ctx.metric || '该指标'
  const periodLabel = ctx.endDate ? `财报期末 ${ctx.endDate}` : '同一财报期末'
  return [
    `在${industryLabel}（${ctx.sw1Code || '当前 SW1 成分'}）内，`,
    `取${periodLabel}、且截至评分日已披露年报/指标的同业公司，`,
    `按「${metricLabel}」横向比较：本股该指标数值高于其中 `,
    `${formatPercentile(ctx.percentile)} 的样本（共 ${ctx.peerCount} 家有效样本）。`,
    '行业归属采用当前申万一级成分（current_sw1），不做历史行业变更回溯。',
  ].join('')
})

const peerRankingHint = computed(() => {
  const ctx = peerContext.value
  if (!ctx || !Number.isFinite(ctx.percentile)) return ''
  if (ctx.metric === 'debt_to_assets') {
    return '负债率类指标：百分位越高，表示在同业中相对更靠前（杠杆更高）。'
  }
  if (ctx.metric === 'roe_level') {
    return '盈利能力类指标：百分位越高，表示在同业中相对更靠前（ROE 更高）。'
  }
  return '百分位越高，表示该指标数值在同业样本中相对越大。'
})

const entryConditionText = computed(() => {
  const metric = condition.value.metric || '指标'
  const op = OPERATOR_LABELS[condition.value.operator] || condition.value.operator || ''
  const threshold = condition.value.threshold
  if (threshold == null) return '—'
  if ((condition.value.consecutive_periods || 1) > 1) {
    return `连续 ${condition.value.consecutive_periods} 期 ${metric} ${op} ${threshold}`
  }
  return `${metric} ${op} ${threshold}`
})

const exitConditionText = computed(() => {
  if (lifecycle.value.exit_threshold == null || !lifecycle.value.exit_operator) return ''
  const op = OPERATOR_LABELS[lifecycle.value.exit_operator] || lifecycle.value.exit_operator
  return `${condition.value.metric || '指标'} ${op} ${lifecycle.value.exit_threshold}`
})

const peerConditionText = computed(() => {
  if (!condition.value.peer_operator || condition.value.peer_threshold == null) return ''
  const op = OPERATOR_LABELS[condition.value.peer_operator] || condition.value.peer_operator
  const minPeers = condition.value.min_peer_count || 0
  return `申万一级行业百分位 ${op} ${condition.value.peer_threshold}（最少有效样本 ${minPeers} 家）`
})

function formatPercentile(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '—'
  return `${numeric}%`
}

function formatCurrencyAmount(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '—'
  const abs = Math.abs(numeric)
  if (abs >= 100000000) return `${(numeric / 100000000).toFixed(2)}亿元`
  if (abs >= 10000) return `${(numeric / 10000).toFixed(2)}万元`
  return `${numeric.toFixed(2)}元`
}

function formatValue(value, unit) {
  if (value == null || value === '') return '—'
  const numeric = Number(value)
  if (unit === 'currency') return formatCurrencyAmount(value)
  const rendered = Number.isFinite(numeric)
    ? (Math.abs(numeric) >= 100 ? numeric.toFixed(2) : String(numeric))
    : String(value)
  if (!unit || unit === 'ratio') return rendered
  if (unit === 'percent' || unit === 'percentage_points') return `${rendered}${unit === 'percentage_points' ? ' pp' : '%'}`
  return `${rendered} ${unit}`
}

function componentLabel(component) {
  if (component.component === 'ttm_operating_cash_flow') return 'TTM 经营现金流（单季组成）'
  if (component.component === 'ttm_attributable_profit') return 'TTM 归母净利润（单季组成）'
  return component.metric || component.component || '组成项'
}
</script>

<style scoped>
.internal-popover-backdrop {
  align-items: center;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  inset: 0;
  justify-content: center;
  padding: 24px;
  position: fixed;
  z-index: 1200;
}

.internal-detail-panel {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
  max-height: min(88vh, 900px);
  max-width: 720px;
  overflow: auto;
  padding: 18px 20px 22px;
  width: 100%;
}

.internal-detail-head {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 12px;
}

.internal-detail-title {
  color: #0f172a;
  font-size: 18px;
  font-weight: 700;
}

.internal-detail-summary {
  color: #334155;
  margin: 6px 0 0;
}

.internal-detail-close {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  cursor: pointer;
  padding: 6px 12px;
}

.internal-detail-section + .internal-detail-section {
  border-top: 1px solid #e2e8f0;
  margin-top: 14px;
  padding-top: 14px;
}

.internal-detail-section h5 {
  color: #475569;
  font-size: 13px;
  letter-spacing: 0.02em;
  margin: 0 0 8px;
  text-transform: uppercase;
}

.internal-kv {
  display: grid;
  gap: 8px;
  margin: 0;
}

.internal-kv > div {
  display: grid;
  gap: 8px;
  grid-template-columns: 110px 1fr;
}

.internal-kv dt {
  color: #64748b;
  font-size: 13px;
}

.internal-kv dd {
  color: #0f172a;
  margin: 0;
  word-break: break-word;
}

.peer-percentile-block dd {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.peer-sample {
  color: #64748b;
  font-size: 13px;
  margin-left: 4px;
}

.peer-percentile-note,
.peer-percentile-hint {
  color: #475569;
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
}

.peer-percentile-hint {
  color: #64748b;
  font-style: italic;
}

.internal-point-list {
  color: #334155;
  margin: 8px 0 0;
  padding-left: 18px;
}

.internal-component-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-top: 8px;
  padding: 10px 12px;
}

.currency-unit-hint {
  color: #94a3b8;
  font-size: 12px;
  margin-left: 4px;
}

.internal-detail-note {
  color: #334155;
  margin: 0;
  white-space: pre-wrap;
}
</style>
