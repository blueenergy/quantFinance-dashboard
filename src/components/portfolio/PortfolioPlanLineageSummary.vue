<template>
  <section v-if="lineage.show" class="lineage-panel">
    <div>
      <span>当前 plan</span><strong :title="plan.plan_id">{{ shortPlanId(plan.plan_id) }}</strong>
      <small>{{ plan.base_date || '-' }} · {{ planCadenceBadge(plan).text }}</small>
    </div>
    <div>
      <span>组合血缘</span><strong :title="plan.params_hash || '-'">{{ plan.params_hash || '-' }}</strong>
      <small>{{ planParamSummary(plan) }}</small>
    </div>
    <div>
      <span>继承自上次调仓</span>
      <button v-if="lineage.previousPlanId" type="button" class="lineage-link" :title="lineage.previousPlanId" @click="$emit('select', lineage.previousPlanId)">
        {{ shortPlanId(lineage.previousPlanId) }}
      </button>
      <strong v-else>{{ lineage.previousDate || '-' }}</strong>
      <small>{{ lineage.previousDate ? `base_date ${lineage.previousDate}` : '首次调仓，无上一期' }}</small>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { planCadenceBadge, planLineage, planParamSummary, shortPlanId } from '../../composables/usePortfolioPlanFormat'

const props = defineProps({
  plan: { type: Object, required: true },
  plans: { type: Array, default: () => [] },
})

defineEmits(['select'])
const lineage = computed(() => planLineage(props.plan, props.plans))
</script>
