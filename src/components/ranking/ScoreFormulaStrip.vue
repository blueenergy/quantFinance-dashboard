<template>
  <div v-if="formula" class="formula-strip">
    <span class="formula-label">得分拆解</span>
    <span class="formula-part">基准 {{ formatNum(formula.base) }}</span>
    <template v-for="(step, idx) in formula.steps" :key="idx">
      <span class="formula-operator">{{ step.delta >= 0 ? '+' : '−' }}</span>
      <span
        class="formula-part"
        :title="step.reason || step.rule"
      >
        {{ step.rule }}<span v-if="step.weight != null" class="formula-weight">
          ×{{ formatWeight(step.weight) }}</span> ({{ formatMagnitude(step.delta) }})
      </span>
    </template>
    <template v-if="formula.rawScore != null">
      <span class="formula-operator">=</span>
      <span class="formula-total">{{ formatNum(formula.rawScore) }}</span>
    </template>
    <template v-if="formula.clipped && formula.clippedScore != null">
      <span class="formula-operator">→</span>
      <span class="formula-total formula-total--clipped">
        {{ formatNum(formula.clippedScore) }}
      </span>
      <span class="formula-note">（裁剪到 [0, 100]）</span>
    </template>
    <span v-if="formula.note" class="formula-rule-note">{{ formula.note }}</span>
  </div>
</template>

<script setup>
defineProps({
  formula: { type: Object, default: null },
})

function formatNum(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return Number(value).toFixed(1)
}

// The +/− already precedes the term, so the term itself shows magnitude only.
function formatMagnitude(delta) {
  const n = Math.abs(Number(delta))
  if (Number.isNaN(n)) return '—'
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function formatWeight(weight) {
  const n = Number(weight)
  if (Number.isNaN(n)) return ''
  return `${(n * 100).toFixed(0)}%`
}
</script>

<style scoped>
.formula-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  font-size: 0.8rem;
  line-height: 1.4;
}

.formula-label {
  font-weight: 700;
  color: #334155;
  margin-right: 4px;
}

.formula-part {
  color: #475569;
  cursor: default;
}

.formula-weight {
  color: #0f766e;
  font-weight: 600;
}

.formula-operator {
  color: #94a3b8;
  font-weight: 600;
}

.formula-total {
  font-weight: 800;
  color: #1e293b;
}

.formula-total--clipped {
  color: #2563eb;
}

.formula-note {
  color: #64748b;
  font-size: 0.75rem;
}

/* Explains a weighting rule the terms alone cannot show, so it takes the full
   width rather than sitting inline between terms. */
.formula-rule-note {
  flex-basis: 100%;
  color: #b45309;
  font-size: 0.75rem;
}
</style>
