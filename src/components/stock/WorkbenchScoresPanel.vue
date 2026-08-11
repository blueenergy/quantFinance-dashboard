<template>
  <section class="workbench-card">
    <div class="card-title-row">
      <h3>量化评分详情</h3>
      <span class="muted">
        来自最新 `stock_scores` 文档
        <template v-if="scoreHistory.length"> · 最近 {{ scoreHistory.length }} 条历史</template>
        <template v-if="loading"> · 刷新中…</template>
      </span>
    </div>

    <ScoreRecommendationsPanel :recommendations="recommendations" />

    <div class="score-grid">
      <article v-for="item in scoreItems" :key="item.key" class="score-card">
        <div class="score-card__head">
          <span>{{ item.label }}</span>
          <strong>{{ fmtNumber(item.score) }}</strong>
        </div>
        <div class="score-bar"><i :style="{ width: `${scorePercent(item.score)}%` }"></i></div>
        <details class="score-card__detail">
          <summary>查看详情</summary>
          <div class="score-card__detail-body">
            <ScoreDetailView
              :category="item.key"
              :details="item.details"
              :weights="weightsFor(item.key)"
              :meta="scoreMeta"
              :score-date="scoreDate"
              :score-history="scoreHistory"
            />
          </div>
        </details>
      </article>
    </div>

    <div class="score-history-block">
      <h4>评分历史</h4>
      <ScoreHistoryComparison
        v-if="scoreHistory.length"
        :history="scoreHistory"
        category="composite"
        :limit="12"
      />
      <div v-else class="muted-block">暂无评分历史。</div>
    </div>
  </section>
</template>

<script setup>
import { computed, defineAsyncComponent } from 'vue'
import ScoreRecommendationsPanel from '../ranking/ScoreRecommendationsPanel.vue'
import ScoreHistoryComparison from '../ranking/ScoreHistoryComparison.vue'
import { normalizeScoreMeta } from '../../utils/scoreDetail.js'
import { SUBMODULE_WEIGHTS } from '../../utils/scoreSubmoduleWeights.js'
import {
  fmtNumber,
  scorePercent,
} from '../../utils/workbenchFormat'

const ScoreDetailView = defineAsyncComponent(
  () => import('../ranking/ScoreDetailView.vue'),
)

const props = defineProps({
  scoreItems: { type: Array, default: () => [] },
  scoreHistory: { type: Array, default: () => [] },
  scoreMeta: { type: Object, default: null },
  recommendations: { type: Object, default: null },
  scoreDate: { type: String, default: '' },
  loading: { type: Boolean, default: false },
})

const scoreMeta = computed(() => normalizeScoreMeta(
  props.scoreMeta,
  null,
  props.scoreDate,
))

function weightsFor(category) {
  return SUBMODULE_WEIGHTS[category] || {}
}
</script>

<style scoped>
.score-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}
.score-card {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px;
  background: #fff;
}
.score-card__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 0.9rem;
}
.score-card__head strong {
  font-size: 1.1rem;
  color: #1e293b;
}
.score-bar {
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}
.score-bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #22c55e);
  border-radius: 3px;
}
.score-card__detail summary {
  cursor: pointer;
  font-size: 0.82rem;
  color: #3b82f6;
  font-weight: 600;
}
.score-card__detail-body {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #e2e8f0;
}
.score-history-block {
  margin-top: 20px;
}
.score-history-block h4 {
  margin: 0 0 10px;
  font-size: 0.95rem;
}
.muted-block {
  color: #94a3b8;
  font-size: 0.85rem;
}
</style>
