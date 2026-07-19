<template>
  <div>
    <div class="detail-header">
      <div>
        <h3>
          {{ displayTitle(detail.plan) }}
          <span class="cadence-tag" :class="planCadenceBadge(detail.plan).cls">{{ planCadenceBadge(detail.plan).text }}</span>
        </h3>
        <p class="muted">
          {{ detail.plan.base_date }} → {{ detail.plan.execute_date || '-' }} · {{ detail.plan.status }}
          · {{ planParamSummary(detail.plan) }} · initial capital {{ money(effectiveInitialCapital(detail.plan)) }}
          <span v-if="detail.plan.previous_rebalance_date"> · 上次调仓 {{ detail.plan.previous_rebalance_date }}</span>
          <span v-if="detail.plan.rebalance_days"> · 周期 {{ detail.plan.rebalance_days }} 个交易日</span>
          <span v-if="detail.plan.next_rebalance_date">
            · 下次调仓 {{ detail.plan.next_rebalance_date }}<template v-if="detail.plan.record_kind === 'observation' && detail.plan.elapsed_trading_days_since_rebalance != null">（已过 {{ detail.plan.elapsed_trading_days_since_rebalance }} 个交易日）</template>
          </span>
        </p>
        <p v-if="signalReviewSummary" class="muted">AI风险/机会最近分析：{{ signalReviewSummary }}</p>
      </div>
      <div v-if="showReviewActions && detail.plan.status === 'needs_review'" class="actions">
        <button :disabled="actionLoading" @click="$emit('review', 'approved')">审核通过</button>
        <button class="danger" :disabled="actionLoading" @click="$emit('review', 'rejected')">驳回</button>
      </div>
    </div>
    <p v-if="monitorNoTrade" class="monitor-note">
      观察日（未到调仓周期）：本计划仅展示组合漂移，不产生交易。下方“漂移”列为若调仓应执行的股数。
      调仓周期按 <strong>交易日</strong> 计（自动跳过周末与节假日）：每 {{ detail.plan.rebalance_days || 'N' }} 个交易日调仓一次。
      <template v-if="detail.plan.next_rebalance_date">预计下次调仓日：<strong>{{ detail.plan.next_rebalance_date }}</strong>（可通过 monitor_can_trade 参数放开观察日交易）。</template>
      <template v-else>到期后才会生成可执行的调仓计划（可通过 monitor_can_trade 参数放开观察日交易）。</template>
    </p>
    <p v-if="scoreSnapshotStale" class="watermark-warning">
      评分快照 {{ overlay?.score_snapshot_date || '-' }}，最新评分 {{ overlay?.latest_score_date || '-' }}
      <template v-if="overlay?.score_snapshot_age_days != null">（已过期 {{ overlay.score_snapshot_age_days }} 天）</template>
      · 排名与价格可能已变化，发布时将按最新价重算股数
    </p>
  </div>
</template>

<script setup>
import { effectiveInitialCapital, money, planCadenceBadge, planParamSummary } from '../../composables/usePortfolioPlanFormat'

defineProps({
  detail: { type: Object, required: true },
  displayTitle: { type: Function, required: true },
  signalReviewSummary: { type: String, default: '' },
  actionLoading: { type: Boolean, default: false },
  showReviewActions: { type: Boolean, default: false },
  monitorNoTrade: { type: Boolean, default: false },
  scoreSnapshotStale: { type: Boolean, default: false },
  overlay: { type: Object, default: null },
})

defineEmits(['review'])
</script>
