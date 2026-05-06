<template>
  <div class="analysis-detail-content" :class="[`analysis-detail-content--${layout}`]">
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
import { computed } from 'vue'

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

const investmentAdviceText = computed(() => adviceLabels[investmentAdvice.value] || analysis.value.investment_advice || props.emptyText)
const riskLevelText = computed(() => riskLabels[riskLevel.value] || analysis.value.risk_level || props.emptyText)
const confidenceText = computed(() => {
  const score = analysis.value.confidence_score
  return score == null || score === '' ? props.emptyText : `${score}%`
})

const detailFields = computed(() => [
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
</script>

<style scoped>
.analysis-detail-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
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