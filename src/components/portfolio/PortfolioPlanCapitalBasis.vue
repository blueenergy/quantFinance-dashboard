<template>
  <div>
    <div class="metrics">
      <div><span>买入</span><strong>{{ plan.summary?.buy_count ?? 0 }}</strong></div>
      <div><span>卖出</span><strong>{{ plan.summary?.sell_count ?? 0 }}</strong></div>
      <div><span>持有</span><strong>{{ plan.summary?.hold_count ?? 0 }}</strong></div>
      <div><span>跳过</span><strong>{{ plan.summary?.skip_count ?? 0 }}</strong></div>
      <div><span>目标 TopN</span><strong>{{ effectiveTopN(plan) }}</strong></div>
      <div><span>换手</span><strong>{{ pct(plan.summary?.estimated_turnover) }}</strong></div>
      <div><span>权益</span><strong>{{ money(plan.summary?.equity) }}</strong></div>
    </div>
    <section v-if="plan.summary" class="capital-basis">
      <div class="task-list-header">
        <div><h4>资金基准</h4><p class="muted">下一期调仓的目标仓位以此基准权益规划（实盘默认按账户成交滚动复利）。</p></div>
      </div>
      <div class="metrics">
        <div><span>基准模式</span><strong>{{ capitalBasisLabel(plan) }}</strong></div>
        <div><span>基准来源</span><strong>{{ baselineSourceLabel(plan) }}</strong></div>
        <div><span>基准权益</span><strong>{{ money(plan.summary?.baseline_equity ?? plan.summary?.equity) }}</strong></div>
        <div><span>可用现金</span><strong>{{ money(plan.summary?.baseline_cash ?? plan.summary?.cash) }}</strong></div>
        <div v-if="plan.summary?.baseline_securities_account_id">
          <span>证券账户</span><strong :title="plan.summary.baseline_securities_account_id">{{ shortPlanId(plan.summary.baseline_securities_account_id) }}</strong>
        </div>
        <div v-if="plan.summary?.baseline_synced_at"><span>账户同步</span><strong>{{ baselineSyncedLabel(plan) }}</strong></div>
      </div>
    </section>
  </div>
</template>

<script setup>
import {
  baselineSourceLabel, baselineSyncedLabel, capitalBasisLabel,
  effectiveTopN, money, pct, shortPlanId,
} from '../../composables/usePortfolioPlanFormat'

defineProps({ plan: { type: Object, required: true } })
</script>
