<template>
  <aside class="card plan-list">
    <h3>计划列表</h3>
    <p v-if="loading" class="muted">正在加载...</p>
    <button
      v-for="plan in plans"
      :key="plan.plan_id"
      class="plan-row"
      :class="planRowClass(plan, selectedPlanId, selectedDetail, allPlans)"
      @click="$emit('select', plan.plan_id)"
    >
      <span>
        <strong>{{ plan.base_date }}</strong>
        <small>{{ displayTitle(plan) }} · {{ planParamSummary(plan) }}</small>
        <small v-if="planBaselineEquity(plan) != null" class="plan-row-baseline">
          基准 {{ capitalBasisLabel(plan) }} · {{ money(planBaselineEquity(plan)) }}
        </small>
      </span>
      <em>
        <span class="cadence-tag" :class="planCadenceBadge(plan).cls">{{ planCadenceBadge(plan).text }}</span>
        <span
          v-if="planRelationBadge(plan, selectedPlanId, selectedDetail, allPlans)"
          class="relation-tag"
          :class="planRelationBadge(plan, selectedPlanId, selectedDetail, allPlans).cls"
        >
          {{ planRelationBadge(plan, selectedPlanId, selectedDetail, allPlans).text }}
        </span>
        {{ plan.status }}
      </em>
    </button>
    <p v-if="!loading && !plans.length" class="muted">{{ onlyActionRequired ? '暂无需要处理的计划。' : '暂无计划。' }}</p>
  </aside>
</template>

<script setup>
import {
  capitalBasisLabel, money, planBaselineEquity, planCadenceBadge,
  planParamSummary, planRelationBadge, planRowClass,
} from '../../composables/usePortfolioPlanFormat'

defineProps({
  plans: { type: Array, default: () => [] },
  allPlans: { type: Array, default: () => [] },
  selectedPlanId: { type: String, default: '' },
  selectedDetail: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  onlyActionRequired: { type: Boolean, default: false },
  displayTitle: { type: Function, required: true },
})

defineEmits(['select'])
</script>
