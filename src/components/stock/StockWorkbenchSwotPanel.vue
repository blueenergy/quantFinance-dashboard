<template>
  <section class="swot-panel">
    <div class="card-title-row">
      <div>
        <h3>台账 SWOT</h3>
        <p class="muted">个股信号台账的正宗阅读面；组合计划与持仓中的标签均引用此处数据。</p>
      </div>
      <div class="swot-tools">
        <span class="muted">
          <template v-if="loading">刷新中…</template>
          <template v-else-if="dataStatus.as_of">更新于 {{ dataStatus.as_of }}</template>
          <template v-else>进入页签后按需加载</template>
        </span>
        <button
          type="button"
          class="swot-collect-btn"
          :disabled="collecting || loading"
          @click="$emit('collect')"
        >
          {{ collecting ? '正在搜集分析…' : '搜集分析机会与风险' }}
        </button>
        <button
          type="button"
          class="swot-internal-btn"
          :disabled="internalRefreshing || loading || dataStatus.internal_signal_enabled === false"
          @click="$emit('refresh-internal')"
        >
          {{ internalRefreshing ? '正在分析财务信号…' : '刷新优势与劣势' }}
        </button>
        <form class="swot-url-form" @submit.prevent="submitNewsUrl">
          <input
            v-model.trim="newsUrlInput"
            type="url"
            class="swot-url-input"
            placeholder="粘贴新闻链接"
            :disabled="collecting || loading"
          >
          <button
            type="submit"
            class="swot-url-btn"
            :disabled="collecting || loading || !newsUrlInput"
          >
            {{ collecting ? '分析中…' : '分析链接' }}
          </button>
        </form>
      </div>
    </div>

    <div
      v-if="collectionMessage"
      class="swot-collection-status"
      :class="{ 'is-error': collectionError }"
      role="status"
    >
      {{ collectionMessage }}
    </div>
    <div
      v-if="internalRefreshMessage"
      class="swot-collection-status"
      :class="{ 'is-error': internalRefreshError }"
      role="status"
    >
      {{ internalRefreshMessage }}
    </div>

    <div v-if="signalReview" class="signal-review-banner">
      <span>最近 AI 信号复核</span>
      <strong>{{ signalReview.last_run_status || '已分析' }}</strong>
      <small v-if="signalReview.analyzed_at">分析 {{ signalReview.analyzed_at }}</small>
      <small v-if="signalReview.evidence_count != null">证据 {{ signalReview.evidence_count }} 条</small>
    </div>
    <div v-if="internalSignalReview" class="signal-review-banner internal-review-banner">
      <span>最近 S/W 规则评估</span>
      <strong>{{ internalSignalReview.last_run_status || '已分析' }}</strong>
      <small v-if="internalSignalReview.analyzed_at">分析 {{ internalSignalReview.analyzed_at }}</small>
      <small v-if="internalSignalReview.engine_version">引擎 {{ internalSignalReview.engine_version }}</small>
      <small>输入 {{ completenessLabel(internalSignalReview.input_completeness) }}</small>
    </div>

    <div v-if="error" class="swot-error" role="alert">
      <span>{{ error }}</span>
      <button type="button" @click="$emit('retry')">重试</button>
    </div>
    <div v-else-if="loading && !hasSwotContract" class="swot-loading">
      正在加载 SWOT 信号台账…
    </div>
    <div v-else class="swot-grid">
      <article
        v-for="quadrant in quadrants"
        :key="quadrant.key"
        class="swot-quadrant"
        :class="[`swot-quadrant--${quadrant.key}`, { 'is-planned': quadrant.planned }]"
      >
        <header class="swot-quadrant-head">
          <h4>{{ quadrant.title }}</h4>
          <span v-if="quadrant.planned" class="swot-planned-badge">Phase 2</span>
          <span v-else-if="quadrant.badge" class="swot-level-badge" :class="quadrant.badgeClass">
            {{ quadrant.badge }}
          </span>
        </header>

        <p v-if="quadrant.planned" class="swot-placeholder">
          {{ quadrant.placeholder }}
        </p>
        <p v-else-if="!quadrant.findings.length" class="swot-placeholder">
          {{ quadrant.emptyText }}
        </p>
        <p v-else class="swot-summary">{{ quadrant.summary }}</p>

        <ul v-if="!quadrant.planned && quadrant.findings.length" class="swot-finding-list">
          <li
            v-for="finding in quadrant.findings"
            :key="finding.finding_key || finding.summary"
            class="swot-finding-item"
            :class="{ 'is-interactive': quadrant.interactive }"
            :role="quadrant.interactive ? 'button' : undefined"
            :tabindex="quadrant.interactive ? 0 : undefined"
            @click="quadrant.interactive && openFinding(quadrant.mode, $event)"
            @keydown.enter.stop="quadrant.interactive && openFinding(quadrant.mode, $event)"
          >
            <span class="swot-finding-level" :class="levelClass(quadrant.mode, finding)">
              {{ levelLabel(quadrant.mode, finding) }}
            </span>
            <span class="swot-finding-content">
              <span class="swot-finding-text">{{ finding.summary || finding.subject || finding.finding_key }}</span>
              <small v-if="finding.detail">{{ finding.detail }}</small>
              <small v-if="finding.evidence_version">证据版本 {{ finding.evidence_version }}</small>
            </span>
          </li>
        </ul>

        <button
          v-if="quadrant.interactive && (quadrant.findings.length || quadrant.mode === 'risk')"
          type="button"
          class="swot-detail-btn"
          @click="openFinding(quadrant.mode, $event)"
        >
          <template v-if="quadrant.mode === 'risk' && !quadrant.findings.length">手动添加风险</template>
          <template v-else>查看完整{{ quadrant.mode === 'opportunity' ? '机会' : '风险' }}分析</template>
        </button>
      </article>
    </div>

    <section
      v-if="!error && industryReference.industry"
      class="industry-reference"
    >
      <header class="industry-reference-head">
        <div>
          <h4>行业信号引用 · {{ industryReference.industry }}</h4>
          <p>以下是行业层面的机会与威胁，仅供个股研判参考，不等同于该股票自身结论。</p>
        </div>
        <span>{{ industryReference.data_status?.found ? '已覆盖' : '暂无活跃信号' }}</span>
      </header>

      <div class="industry-reference-grid">
        <article
          v-for="card in industryReferenceCards"
          :key="card.mode"
          class="industry-reference-card"
        >
          <div class="industry-reference-card-head">
            <strong>{{ card.title }}</strong>
            <span class="swot-level-badge" :class="card.badgeClass">{{ card.badge }}</span>
          </div>
          <p v-if="!card.findings.length" class="swot-placeholder">{{ card.emptyText }}</p>
          <ul v-else class="industry-finding-list">
            <li v-for="finding in card.findings" :key="finding.finding_key || finding.summary">
              <div>
                <span class="swot-finding-level" :class="levelClass(card.mode, finding)">
                  {{ levelLabel(card.mode, finding) }}
                </span>
                <strong>{{ finding.summary || finding.subject || finding.finding_key }}</strong>
              </div>
              <p v-if="finding.detail">{{ finding.detail }}</p>
            </li>
          </ul>
        </article>
      </div>
    </section>

    <LlmRiskDetailPanel
      :detail="llmDetail"
      :font-px="llmFontPx"
      :min="LLM_FONT_MIN"
      :max="LLM_FONT_MAX"
      :copied="copiedLlmRiskKey === llmDetail?.key"
      :action-busy="actionBusy"
      :allow-news-follow-up="true"
      @inc="incLlmFont"
      @dec="decLlmFont"
      @copy="copyLlmRisk(llmDetail?.mode === 'opportunity' ? llmDetail?.opportunity : llmDetail?.risk, llmDetail?.key, llmDetail?.mode)"
      @close="closeLlmDetail"
      @confirm-resolution="confirmResolution"
      @resolve="resolveFinding"
      @realize-opportunity="realizeOpportunity"
      @invalidate-opportunity="invalidateOpportunity"
      @manual-add="manualAddRisk"
      @analyze-finding-url="submitFindingNewsUrl"
    />
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import LlmRiskDetailPanel from '../portfolio/LlmRiskDetailPanel.vue'
import { useLlmRiskDetail } from '../../composables/useLlmRiskDetail'

const props = defineProps({
  symbol: { type: String, default: '' },
  name: { type: String, default: '' },
  swot: { type: Object, default: () => ({}) },
  signalReview: { type: Object, default: null },
  internalSignalReview: { type: Object, default: null },
  industryReference: { type: Object, default: () => ({}) },
  dataStatus: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  collecting: { type: Boolean, default: false },
  collectionMessage: { type: String, default: '' },
  collectionError: { type: Boolean, default: false },
  internalRefreshing: { type: Boolean, default: false },
  internalRefreshMessage: { type: String, default: '' },
  internalRefreshError: { type: Boolean, default: false },
})

const emit = defineEmits(['changed', 'retry', 'collect', 'refresh-internal', 'analyze-url'])

const newsUrlInput = ref('')

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function submitNewsUrl() {
  const url = newsUrlInput.value.trim()
  if (!url || props.collecting || props.loading) return
  if (!isValidHttpUrl(url)) {
    window.alert('请输入有效的 http/https 新闻链接')
    return
  }
  emit('analyze-url', url)
}

function submitFindingNewsUrl({ findingKey, url } = {}) {
  const trimmed = String(url || '').trim()
  if (!trimmed || !findingKey || props.collecting || props.loading) return
  if (!isValidHttpUrl(trimmed)) {
    window.alert('请输入有效的 http/https 新闻链接')
    return
  }
  closeLlmDetail()
  emit('analyze-url', { url: trimmed, findingKey })
}

const {
  detail: llmDetail,
  copiedKey: copiedLlmRiskKey,
  fontPx: llmFontPx,
  LLM_FONT_MIN,
  LLM_FONT_MAX,
  incLlmFont,
  decLlmFont,
  toggleLlmDetail,
  closeLlmDetail,
  copyLlmText: copyLlmRisk,
  actionBusy,
  confirmResolution,
  resolveFinding,
  realizeOpportunity,
  invalidateOpportunity,
  manualAddRisk,
} = useLlmRiskDetail({
  onRiskChanged: () => emit('changed'),
})

const quadrants = computed(() => {
  const swot = props.swot || {}
  const threat = swot.threat || {}
  const opportunity = swot.opportunity || {}
  const strength = swot.strength || {}
  const weakness = swot.weakness || {}

  return [
    {
      key: 'strength',
      title: '优势 Strength',
      planned: strength.status === 'planned',
      placeholder: '优势维度尚未接入，后续将从量化评分与基本面提炼。',
      mode: 'strength',
      interactive: false,
      findings: Array.isArray(strength.findings) ? strength.findings : [],
      summary: strength.summary || '',
      badge: strengthBadge(strength.strength),
      badgeClass: `opportunity-${strength.strength || 'none'}`,
      emptyText: strength.status === 'not_analyzed'
        ? '尚未执行优势规则评估。'
        : '已评估，暂无活跃优势信号。',
    },
    {
      key: 'weakness',
      title: '劣势 Weakness',
      planned: weakness.status === 'planned',
      placeholder: '劣势维度尚未接入，后续将从财务弱点与估值压力提炼。',
      mode: 'weakness',
      interactive: false,
      findings: Array.isArray(weakness.findings) ? weakness.findings : [],
      summary: weakness.summary || '',
      badge: severityBadge(weakness.severity),
      badgeClass: `risk-${weakness.severity || 'none'}`,
      emptyText: weakness.status === 'not_analyzed'
        ? '尚未执行劣势规则评估。'
        : '已评估，暂无活跃劣势信号。',
    },
    {
      key: 'opportunity',
      title: '机会 Opportunity',
      planned: false,
      placeholder: '',
      mode: 'opportunity',
      interactive: true,
      findings: Array.isArray(opportunity.findings) ? opportunity.findings : [],
      summary: opportunity.summary || '未发现明确 LLM 机会',
      badge: strengthBadge(opportunity.strength),
      badgeClass: `opportunity-${opportunity.strength || 'none'}`,
      emptyText: '暂无活跃机会信号。',
    },
    {
      key: 'threat',
      title: '威胁 Threat',
      planned: false,
      placeholder: '',
      mode: 'risk',
      interactive: true,
      findings: Array.isArray(threat.findings) ? threat.findings : [],
      summary: threat.summary || '未发现明确 LLM 事件风险',
      badge: severityBadge(threat.severity),
      badgeClass: `risk-${threat.severity || 'none'}`,
      emptyText: '暂无活跃威胁信号。',
    },
  ]
})

const hasSwotContract = computed(() => Boolean(
  props.swot?.strength
  || props.swot?.weakness
  || props.swot?.opportunity
  || props.swot?.threat
))

const industryReferenceCards = computed(() => {
  const opportunity = props.industryReference?.opportunity || {}
  const threat = props.industryReference?.threat || {}
  return [
    {
      mode: 'opportunity',
      title: '行业机会',
      findings: Array.isArray(opportunity.findings) ? opportunity.findings : [],
      badge: strengthBadge(opportunity.strength),
      badgeClass: `opportunity-${opportunity.strength || 'none'}`,
      emptyText: '暂无活跃行业机会。',
    },
    {
      mode: 'risk',
      title: '行业威胁',
      findings: Array.isArray(threat.findings) ? threat.findings : [],
      badge: severityBadge(threat.severity),
      badgeClass: `risk-${threat.severity || 'none'}`,
      emptyText: '暂无活跃行业威胁。',
    },
  ]
})

function severityBadge(severity) {
  if (severity === 'high') return '高'
  if (severity === 'medium') return '中'
  if (severity === 'low') return '低'
  return '正常'
}

function strengthBadge(strength) {
  if (strength === 'high') return '强'
  if (strength === 'medium') return '中'
  if (strength === 'low') return '弱'
  return '无'
}

function levelLabel(mode, finding) {
  if (mode === 'opportunity' || mode === 'strength') return strengthBadge(finding.strength)
  return severityBadge(finding.severity)
}

function levelClass(mode, finding) {
  if (mode === 'opportunity' || mode === 'strength') return `opportunity-${finding.strength || 'none'}`
  return `risk-${finding.severity || 'none'}`
}

function completenessLabel(value) {
  if (value === 'complete') return '完整'
  if (value === 'partial') return '部分完整'
  if (value === 'insufficient') return '不足'
  return '未知'
}

function openFinding(mode, event) {
  const swot = props.swot || {}
  const payload = mode === 'opportunity' ? (swot.opportunity || {}) : (swot.threat || {})
  toggleLlmDetail({
    key: `swot:${props.symbol}:${mode}`,
    symbol: props.symbol,
    name: props.name,
    risk: mode === 'risk' ? payload : undefined,
    opportunity: mode === 'opportunity' ? payload : undefined,
    mode,
    event,
  })
}
</script>

<style scoped>
.swot-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-title-row {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.card-title-row h3 {
  margin: 0;
}

.card-title-row p {
  margin: 4px 0 0;
}

.swot-tools {
  align-items: flex-end;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.swot-collect-btn,
.swot-internal-btn {
  background: #4338ca;
  border: 1px solid #4338ca;
  border-radius: 7px;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  padding: 7px 14px;
}

.swot-internal-btn {
  background: #fff;
  color: #4338ca;
}

.swot-collect-btn:disabled,
.swot-internal-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.swot-collect-btn:not(:disabled):hover {
  background: #3730a3;
}

.swot-internal-btn:not(:disabled):hover {
  background: #eef2ff;
}

.swot-url-form {
  align-items: center;
  display: flex;
  gap: 8px;
  width: min(100%, 420px);
}

.swot-url-input {
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  color: #1e293b;
  flex: 1 1 auto;
  font-size: 13px;
  min-width: 0;
  padding: 7px 10px;
}

.swot-url-input::placeholder {
  color: #94a3b8;
}

.swot-url-input:focus {
  border-color: #4338ca;
  outline: none;
}

.swot-url-input:disabled {
  background: #f1f5f9;
  color: #64748b;
  cursor: not-allowed;
}

.swot-url-btn {
  background: #fff;
  border: 1px solid #4338ca;
  border-radius: 7px;
  color: #4338ca;
  cursor: pointer;
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 700;
  padding: 7px 12px;
}

.swot-url-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.swot-url-btn:not(:disabled):hover {
  background: #eef2ff;
}

.swot-collection-status {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  color: #1d4ed8;
  padding: 10px 12px;
}

.swot-collection-status.is-error {
  background: #fef2f2;
  border-color: #fecaca;
  color: #b91c1c;
}

.signal-review-banner {
  align-items: center;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 10px 12px;
}

.signal-review-banner span {
  color: #64748b;
  font-size: 12px;
}

.signal-review-banner strong {
  color: #3730a3;
}

.signal-review-banner small {
  color: #64748b;
  font-size: 12px;
}

.swot-error,
.swot-loading {
  align-items: center;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  padding: 14px;
}

.swot-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
}

.swot-error button {
  background: #fff;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  color: #b91c1c;
  cursor: pointer;
  font-weight: 600;
  padding: 4px 12px;
}

.swot-loading {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #64748b;
}

.swot-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.swot-quadrant {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 180px;
  padding: 14px;
}

.swot-quadrant--strength { border-top: 3px solid #16a34a; }
.swot-quadrant--weakness { border-top: 3px solid #ea580c; }
.swot-quadrant--opportunity { border-top: 3px solid #0284c7; }
.swot-quadrant--threat { border-top: 3px solid #dc2626; }

.swot-quadrant.is-planned {
  background: #f8fafc;
}

.swot-quadrant-head {
  align-items: center;
  display: flex;
  gap: 8px;
  justify-content: space-between;
}

.swot-quadrant-head h4 {
  font-size: 14px;
  margin: 0;
}

.swot-planned-badge,
.swot-level-badge {
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
}

.swot-planned-badge {
  background: #e2e8f0;
  color: #64748b;
}

.swot-level-badge.risk-high { background: #fee2e2; color: #b91c1c; }
.swot-level-badge.risk-medium { background: #ffedd5; color: #c2410c; }
.swot-level-badge.risk-low { background: #fef9c3; color: #a16207; }
.swot-level-badge.risk-none { background: #f1f5f9; color: #64748b; }
.swot-level-badge.opportunity-high { background: #dcfce7; color: #15803d; }
.swot-level-badge.opportunity-medium { background: #e0f2fe; color: #0369a1; }
.swot-level-badge.opportunity-low { background: #ecfccb; color: #4d7c0f; }
.swot-level-badge.opportunity-none { background: #f1f5f9; color: #64748b; }

.swot-placeholder,
.swot-summary {
  color: #475569;
  font-size: 13px;
  line-height: 1.55;
  margin: 0;
}

.swot-finding-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.swot-finding-item {
  align-items: flex-start;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: default;
  display: flex;
  gap: 8px;
  padding: 8px 10px;
}

.swot-finding-item.is-interactive {
  cursor: pointer;
}

.swot-finding-item.is-interactive:hover {
  background: #eef2ff;
  border-color: #c7d2fe;
}

.swot-finding-level {
  border-radius: 4px;
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
}

.swot-finding-level.risk-high { background: #fee2e2; color: #b91c1c; }
.swot-finding-level.risk-medium { background: #ffedd5; color: #c2410c; }
.swot-finding-level.risk-low { background: #fef9c3; color: #a16207; }
.swot-finding-level.risk-none { background: #f1f5f9; color: #64748b; }
.swot-finding-level.opportunity-high { background: #dcfce7; color: #15803d; }
.swot-finding-level.opportunity-medium { background: #e0f2fe; color: #0369a1; }
.swot-finding-level.opportunity-low { background: #ecfccb; color: #4d7c0f; }
.swot-finding-level.opportunity-none { background: #f1f5f9; color: #64748b; }

.swot-finding-text {
  color: #1e293b;
  font-size: 13px;
  line-height: 1.45;
}

.swot-finding-content {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.swot-finding-content small {
  color: #64748b;
  font-size: 11px;
  line-height: 1.4;
}

.swot-detail-btn {
  align-self: flex-start;
  background: transparent;
  border: none;
  color: #4338ca;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  padding: 0;
}

.swot-detail-btn:hover {
  text-decoration: underline;
}

.industry-reference {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 14px;
}

.industry-reference-head {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.industry-reference-head h4,
.industry-reference-head p {
  margin: 0;
}

.industry-reference-head p {
  color: #64748b;
  font-size: 12px;
  margin-top: 4px;
}

.industry-reference-head > span {
  color: #64748b;
  font-size: 12px;
}

.industry-reference-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 12px;
}

.industry-reference-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
}

.industry-reference-card-head {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.industry-finding-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
}

.industry-finding-list li {
  border-top: 1px solid #e2e8f0;
  padding-top: 8px;
}

.industry-finding-list li > div {
  align-items: flex-start;
  display: flex;
  gap: 8px;
}

.industry-finding-list strong {
  color: #1e293b;
  font-size: 13px;
}

.industry-finding-list p {
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
  margin: 6px 0 0;
}

@media (max-width: 900px) {
  .card-title-row {
    flex-direction: column;
  }

  .swot-tools {
    align-items: flex-start;
  }

  .swot-grid,
  .industry-reference-grid {
    grid-template-columns: 1fr;
  }
}
</style>
