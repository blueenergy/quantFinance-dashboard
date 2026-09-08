<template>
  <section v-if="params" class="overview-execute-card">
    <div>
      <h4>去总览执行</h4>
      <p class="muted">发布、立即执行 Paper、补单和取消计划只在组合总览进行。</p>
    </div>
    <AppLink
      class="link-btn link-btn--primary"
      tab="portfolio-overview"
      :params="params"
    >去总览执行</AppLink>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import AppLink from '../common/AppLink.vue'
import { overviewDeepLinkParams } from '../../utils/portfolioOverviewFormat'

const props = defineProps({
  plan: { type: Object, default: null },
})

const params = computed(() => {
  if (props.plan?.status !== 'approved') return null
  const next = overviewDeepLinkParams(props.plan, { plan_id: props.plan.plan_id })
  if (!next.strategy || !next.params_hash) return null
  return next
})
</script>
