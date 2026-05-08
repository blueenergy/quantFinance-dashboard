<template>
  <div class="analysis-detail-content" :class="[`analysis-detail-content--${layout}`]">
    <section v-if="showExpertSynthesis" class="expert-synthesis-block">
      <div class="expert-synthesis-grid">
        <article v-if="consensusPoints.length > 0" class="expert-synthesis-card expert-synthesis-card--consensus">
          <div class="expert-synthesis-header">
            <h4>一致观点</h4>
            <span class="expert-synthesis-chip">共识</span>
          </div>
          <ul class="analysis-points-list">
            <li v-for="(point, index) in consensusPoints" :key="`consensus-${index}`">{{ point }}</li>
          </ul>
        </article>

        <article v-if="divergencePoints.length > 0" class="expert-synthesis-card expert-synthesis-card--divergence">
          <div class="expert-synthesis-header">
            <h4>分歧点</h4>
            <span class="expert-synthesis-chip">分歧</span>
          </div>
          <ul class="analysis-points-list">
            <li v-for="(point, index) in divergencePoints" :key="`divergence-${index}`">{{ point }}</li>
          </ul>
        </article>
      </div>

      <article v-if="finalConclusion" class="expert-synthesis-card expert-synthesis-card--conclusion">
        <div class="expert-synthesis-header">
          <h4>最终结论</h4>
          <span class="expert-synthesis-chip">结论</span>
        </div>
        <p>{{ finalConclusion }}</p>
      </article>
    </section>

    <section v-if="expertReports.length > 0" class="expert-review-block">
      <div class="expert-review-header">
        <div>
          <h4>多专家会审</h4>
          <p>以下为各专家的原始观点；上方已展示综合结论。</p>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <span class="expert-review-count">{{ expertReports.length }} 位专家</span>
          <button class="expert-review-toggle" @click="expertReportsExpanded = !expertReportsExpanded">
            {{ expertReportsExpanded ? '收起' : '展开原始报告' }}
            <span class="expert-review-toggle-arrow" :class="{ 'expert-review-toggle-arrow--open': expertReportsExpanded }">▾</span>
          </button>
        </div>
      </div>

      <div v-show="expertReportsExpanded" class="expert-review-list">
        <article
          v-for="(report, idx) in expertReports"
          :key="report.key"
          class="expert-review-card"
          :class="[`expert-review-card--${report.key}`, { 'expert-review-card--open': expandedExperts.has(report.key) }]"
        >
          <button class="expert-review-card-header" @click="toggleExpert(report.key)">
            <div style="display:flex;align-items:center;gap:10px">
              <span class="expert-review-index">{{ idx + 1 }}</span>
              <h5>{{ report.title }}</h5>
              <span class="expert-review-chip" :class="`expert-review-chip--${report.key}`">{{ report.shortLabel }}</span>
            </div>
            <span class="expert-review-toggle-arrow" :class="{ 'expert-review-toggle-arrow--open': expandedExperts.has(report.key) }">▾</span>
          </button>
          <div v-show="expandedExperts.has(report.key)" class="expert-review-card-body">
            <GrowthChart
              v-if="report.key === 'growth' && financialChartData.length > 0"
              :series="financialChartData"
              class="expert-review-chart"
            />
            <pre>{{ report.content }}</pre>
          </div>
        </article>
      </div>
    </section>

    <div class="analysis-field-list" :class="[`analysis-field-list--${layout}`]">
      <section v-if="showMode" class="analysis-field-card analysis-field-card--meta">
        <h5>分析模式</h5>
        <p>{{ modeLabel(analysisMode) }}</p>
      </section>

      <section
        v-for="field in detailFields"
        :key="field.key"
        class="analysis-field-card"
        :class="{ 'analysis-field-card--wide': field.wide }"
      >
        <h5>{{ field.title }}</h5>

        <template v-if="field.type === 'levels'">
          <p>支撑位: {{ supportLevel }}</p>
          <p>阻力位: {{ resistanceLevel }}</p>
        </template>

        <template v-else-if="field.type === 'list'">
          <ul v-if="Array.isArray(field.value) && field.value.length > 0" class="analysis-points-list">
            <li v-for="(point, index) in field.value" :key="index">{{ point }}</li>
          </ul>
          <p v-else>{{ emptyText }}</p>
        </template>

        <template v-else>
          <p>{{ field.value }}</p>
        </template>
      </section>
    </div>

    <div class="analysis-summary-row">
      <div class="analysis-summary-item">
        <span class="analysis-summary-label">投资建议</span>
        <span :class="['analysis-chip', `analysis-chip--${investmentAdvice}`]">
          {{ investmentAdviceText }}
        </span>
      </div>
      <div class="analysis-summary-item">
        <span class="analysis-summary-label">风险等级</span>
        <span :class="['analysis-chip', `analysis-chip--risk-${riskLevel}`]">
          {{ riskLevelText }}
        </span>
      </div>
      <div class="analysis-summary-item">
        <span class="analysis-summary-label">信心分数</span>
        <span class="analysis-summary-value">{{ confidenceText }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import GrowthChart from './GrowthChart.vue'

const props = defineProps({
  analysis: {
    type: Object,
    default: () => ({})
  },
  analysisMode: {
    type: String,
    default: 'classic'
  },
  layout: {
    type: String,
    default: 'stacked'
  },
  showMode: {
    type: Boolean,
    default: false
  },
  emptyText: {
    type: String,
    default: '暂无'
  }
})

const adviceLabels = { buy: '买入', hold: '持有', sell: '卖出' }
const riskLabels = { low: '低风险', medium: '中风险', high: '高风险' }

const analysis = computed(() => props.analysis || {})
const investmentAdvice = computed(() => analysis.value.investment_advice || 'na')
const riskLevel = computed(() => analysis.value.risk_level || 'na')
const supportLevel = computed(() => analysis.value.support_level ?? props.emptyText)
const resistanceLevel = computed(() => analysis.value.resistance_level ?? props.emptyText)
const expertReportsExpanded = ref(false)
const expandedExperts = ref(new Set())
function toggleExpert(key) {
  const s = new Set(expandedExperts.value)
  if (s.has(key)) s.delete(key)
  else s.add(key)
  expandedExperts.value = s
}
const financialChartData = computed(() => {
  const d = analysis.value.financial_chart_data
  return Array.isArray(d) && d.length > 0 ? d : []
})

const expertLabelMap = {
  fundamental: { title: '基本面专家',   shortLabel: '基本面' },
  technical:   { title: '技术面专家',   shortLabel: '技术面' },
  risk:        { title: '风险专家',     shortLabel: '风险' },
  growth:      { title: '成长性专家',   shortLabel: '成长性' },
  cycle:       { title: '行业周期专家', shortLabel: '行业周期' },
}
const EXPERT_ORDER = ['cycle', 'fundamental', 'growth', 'technical', 'risk']

const investmentAdviceText = computed(() => adviceLabels[investmentAdvice.value] || analysis.value.investment_advice || props.emptyText)
const riskLevelText = computed(() => riskLabels[riskLevel.value] || analysis.value.risk_level || props.emptyText)
const confidenceText = computed(() => {
  const score = analysis.value.confidence_score
  return score == null || score === '' ? props.emptyText : `${score}%`
})
const consensusPoints = computed(() => normalizePoints(analysis.value.consensus_points))
const divergencePoints = computed(() => normalizePoints(analysis.value.divergence_points))
const finalConclusion = computed(() => {
  const value = analysis.value.final_conclusion
  return typeof value === 'string' ? value.trim() : ''
})
const showExpertSynthesis = computed(() => {
  return consensusPoints.value.length > 0 || divergencePoints.value.length > 0 || !!finalConclusion.value
})

const expertReports = computed(() => {
  const reports = analysis.value.module_reports
  if (!reports || typeof reports !== 'object') return []

  const orderedKeys = [
    ...EXPERT_ORDER.filter(k => reports[k] != null),
    ...Object.keys(reports).filter(k => !EXPERT_ORDER.includes(k)),
  ]
  return orderedKeys
    .map(key => {
      const value = reports[key]
      const labels = expertLabelMap[key] || { title: `${key} 专家`, shortLabel: key }
      const content = String(value || '').trim()
      if (!content) return null
      return { key, title: labels.title, shortLabel: labels.shortLabel, content }
    })
    .filter(Boolean)
})

const detailFields = computed(() => [
  {
    key: 'growth_assessment',
    title: '成长性判断',
    value: analysis.value.growth_assessment || props.emptyText,
  },
  {
    key: 'cycle_assessment',
    title: '行业周期判断',
    value: analysis.value.industry_cycle_assessment || props.emptyText,
  },
  {
    key: 'qtag',
    title: '量化快照标记',
    value: analysis.value.quant_score_snapshot_tag || props.emptyText,
  },
  {
    key: 'qcross',
    title: '分数与叙述对照',
    value: analysis.value.quant_score_cross_check || props.emptyText,
    wide: true,
  },
  {
    key: 'technical',
    title: '技术分析',
    value: analysis.value.technical_analysis || props.emptyText,
    wide: true,
  },
  {
    key: 'long',
    title: '长期预测',
    value: analysis.value.long_term_forecast || props.emptyText,
  },
  {
    key: 'mid',
    title: '中期预测',
    value: analysis.value.mid_term_forecast || props.emptyText,
  },
  {
    key: 'short',
    title: '短期预测',
    value: analysis.value.short_term_forecast || props.emptyText,
  },
  {
    key: 'levels',
    title: '关键价位',
    type: 'levels',
  },
  {
    key: 'points',
    title: '关键要点',
    type: 'list',
    value: analysis.value.key_points,
    wide: true,
  },
])

function modeLabel(mode) {
  return mode === 'multi_expert_v1' ? '多专家' : '经典'
}

function normalizePoints(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/\n+|；|;/)
      .map((item) => item.replace(/^[\-•\d\.\s]+/, '').trim())
      .filter(Boolean)
  }
  return []
}
</script>

<style scoped>
.analysis-detail-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.expert-synthesis-block {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.expert-synthesis-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
}

.expert-synthesis-card {
  background: rgba(148, 163, 184, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 12px;
  padding: 14px 16px;
}

.expert-synthesis-card--conclusion p {
  margin: 0;
  line-height: 1.7;
  white-space: pre-wrap;
}

.expert-synthesis-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.expert-synthesis-header h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}

.expert-synthesis-chip {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid rgba(148, 163, 184, 0.24);
}

.expert-synthesis-card--consensus .expert-synthesis-chip {
  color: #166534;
  background: rgba(34, 197, 94, 0.14);
  border-color: rgba(74, 222, 128, 0.26);
}

.expert-synthesis-card--divergence .expert-synthesis-chip {
  color: #92400e;
  background: rgba(245, 158, 11, 0.14);
  border-color: rgba(251, 191, 36, 0.26);
}

.expert-synthesis-card--conclusion .expert-synthesis-chip {
  color: #1d4ed8;
  background: rgba(59, 130, 246, 0.14);
  border-color: rgba(96, 165, 250, 0.26);
}

.expert-review-block {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.expert-review-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.expert-review-header h4 {
  margin: 0 0 4px;
  font-size: 16px;
}

.expert-review-header p {
  margin: 0;
  opacity: 0.8;
  line-height: 1.6;
}

.expert-review-count {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  background: rgba(14, 165, 233, 0.14);
  border: 1px solid rgba(56, 189, 248, 0.26);
}

.expert-review-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  background: rgba(148, 163, 184, 0.10);
  border: 1px solid rgba(148, 163, 184, 0.28);
  color: inherit;
  transition: background 0.15s;
}

.expert-review-toggle:hover {
  background: rgba(148, 163, 184, 0.18);
}

.expert-review-toggle-arrow {
  display: inline-block;
  transition: transform 0.2s;
}

.expert-review-toggle-arrow--open {
  transform: rotate(180deg);
}

.expert-review-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.expert-review-card {
  background: rgba(148, 163, 184, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 12px;
  overflow: hidden;
}

.expert-review-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  width: 100%;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.expert-review-card-header:hover {
  background: rgba(148, 163, 184, 0.10);
}

.expert-review-card--open > .expert-review-card-header {
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.expert-review-card-header h5 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
}

.expert-review-chip {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  background: rgba(6, 182, 212, 0.14);
  border: 1px solid rgba(45, 212, 191, 0.28);
}
/* per-expert accent colors */
.expert-review-chip--cycle       { background: rgba(139, 92, 246, 0.16); border-color: rgba(167, 139, 250, 0.32); color: #c4b5fd; }
.expert-review-chip--fundamental { background: rgba(59, 130, 246, 0.16); border-color: rgba(96, 165, 250, 0.32);  color: #93c5fd; }
.expert-review-chip--growth      { background: rgba(34, 197, 94, 0.16);  border-color: rgba(74, 222, 128, 0.32); color: #86efac; }
.expert-review-chip--technical   { background: rgba(245, 158, 11, 0.16); border-color: rgba(251, 191, 36, 0.32); color: #fde68a; }
.expert-review-chip--risk        { background: rgba(239, 68, 68, 0.16);  border-color: rgba(248, 113, 113, 0.32); color: #fca5a5; }

.expert-review-card--cycle       { border-left: 3px solid rgba(139, 92, 246, 0.5); }
.expert-review-card--fundamental { border-left: 3px solid rgba(59, 130, 246, 0.5); }
.expert-review-card--growth      { border-left: 3px solid rgba(34, 197, 94, 0.5); }
.expert-review-card--technical   { border-left: 3px solid rgba(245, 158, 11, 0.5); }
.expert-review-card--risk        { border-left: 3px solid rgba(239, 68, 68, 0.5); }

.expert-review-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(148, 163, 184, 0.15);
  border: 1px solid rgba(148, 163, 184, 0.25);
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.expert-review-card-body {
  padding: 14px 16px;
}

.expert-review-card-body pre {
  margin: 0;
  white-space: pre-wrap;
  font: inherit;
  line-height: 1.7;
  color: inherit;
}

.expert-review-chart {
  margin-bottom: 16px;
}

.analysis-field-list {
  display: grid;
  gap: 14px;
}

.analysis-field-list--grid {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.analysis-field-list--stacked {
  grid-template-columns: 1fr;
}

.analysis-field-card {
  background: rgba(148, 163, 184, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 12px;
  padding: 14px 16px;
}

.analysis-field-list--grid .analysis-field-card--wide {
  grid-column: 1 / -1;
}

.analysis-field-card h5 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 700;
  color: inherit;
}

.analysis-field-card p {
  margin: 0;
  line-height: 1.7;
  color: inherit;
  white-space: pre-wrap;
}

.analysis-points-list {
  margin: 0;
  padding-left: 18px;
}

.analysis-points-list li {
  margin-bottom: 6px;
  line-height: 1.6;
}

.analysis-summary-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.analysis-summary-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.analysis-summary-label {
  font-size: 12px;
  opacity: 0.78;
}

.analysis-summary-value {
  font-weight: 600;
}

.analysis-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid transparent;
}

.analysis-chip--buy {
  color: #fecaca;
  background: rgba(239, 68, 68, 0.16);
  border-color: rgba(248, 113, 113, 0.28);
}

.analysis-chip--sell {
  color: #bbf7d0;
  background: rgba(34, 197, 94, 0.16);
  border-color: rgba(74, 222, 128, 0.28);
}

.analysis-chip--hold {
  color: #fde68a;
  background: rgba(245, 158, 11, 0.16);
  border-color: rgba(251, 191, 36, 0.28);
}

.analysis-chip--na,
.analysis-chip--risk-na {
  color: #cbd5e1;
  background: rgba(100, 116, 139, 0.14);
  border-color: rgba(148, 163, 184, 0.25);
}

.analysis-chip--risk-high {
  color: #fecaca;
  background: rgba(239, 68, 68, 0.16);
  border-color: rgba(248, 113, 113, 0.28);
}

.analysis-chip--risk-medium {
  color: #fde68a;
  background: rgba(245, 158, 11, 0.16);
  border-color: rgba(251, 191, 36, 0.28);
}

.analysis-chip--risk-low {
  color: #bbf7d0;
  background: rgba(34, 197, 94, 0.16);
  border-color: rgba(74, 222, 128, 0.28);
}

@media (max-width: 768px) {
  .expert-synthesis-grid,
  .expert-review-header {
    flex-direction: column;
  }

  .analysis-summary-row {
    flex-direction: column;
  }

  .analysis-summary-item {
    justify-content: space-between;
    width: 100%;
    border-radius: 12px;
  }
}
</style>