<template>
  <div v-if="hasContent" class="recommendations-panel">
    <h5 class="section-title">策略建议</h5>
    <div v-if="recommendations.overall_rating" class="overall-rating">
      {{ recommendations.overall_rating }}
    </div>
    <p v-if="recommendations.investment_suggestion" class="investment-suggestion">
      {{ recommendations.investment_suggestion }}
    </p>
    <div class="rec-meta">
      <span v-if="recommendations.risk_level">风险：{{ recommendations.risk_level }}</span>
      <span v-if="recommendations.time_horizon">周期：{{ recommendations.time_horizon }}</span>
      <span v-if="recommendations.comp_score != null">
        综合分：{{ Number(recommendations.comp_score).toFixed(1) }}
      </span>
    </div>
    <div v-if="recommendations.strengths?.length" class="rec-list rec-list--strengths">
      <strong>优势</strong>
      <ul>
        <li v-for="(item, i) in recommendations.strengths" :key="`s-${i}`">{{ item }}</li>
      </ul>
    </div>
    <div v-if="recommendations.weaknesses?.length" class="rec-list rec-list--weaknesses">
      <strong>劣势</strong>
      <ul>
        <li v-for="(item, i) in recommendations.weaknesses" :key="`w-${i}`">{{ item }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  recommendations: { type: Object, default: null },
})

const hasContent = computed(() => {
  const r = props.recommendations
  if (!r || typeof r !== 'object') return false
  return Boolean(
    r.overall_rating
    || r.investment_suggestion
    || r.strengths?.length
    || r.weaknesses?.length,
  )
})
</script>

<style scoped>
.recommendations-panel {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  background: #fff;
}

.section-title {
  margin: 0 0 8px;
  font-size: 0.9rem;
  font-weight: 700;
  color: #334155;
}

.overall-rating {
  font-size: 1.1rem;
  font-weight: 800;
  color: #1e293b;
  margin-bottom: 6px;
}

.investment-suggestion {
  margin: 0 0 8px;
  color: #475569;
  font-size: 0.85rem;
  line-height: 1.45;
}

.rec-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 0.78rem;
  color: #64748b;
  margin-bottom: 10px;
}

.rec-list {
  font-size: 0.82rem;
  margin-top: 8px;
}

.rec-list ul {
  margin: 4px 0 0;
  padding-left: 18px;
  color: #475569;
}

.rec-list--strengths strong {
  color: #166534;
}

.rec-list--weaknesses strong {
  color: #991b1b;
}
</style>
