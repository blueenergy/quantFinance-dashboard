<template>
  <section class="card watermark-card">
    <div class="task-list-header">
      <div>
        <h3>Plan 生成数据水位</h3>
        <p class="muted">确认当前 base_date 对应评分数据是否可用于生成 plan。</p>
      </div>
      <button :disabled="loading || disabled" @click="$emit('refresh')">刷新水位</button>
    </div>
    <p v-if="loading" class="muted">正在加载数据水位...</p>
    <p v-else-if="!watermark" class="muted">请选择 strategy 后查看评分水位。</p>
    <template v-else>
      <div class="watermark-grid">
        <div><span>universe</span><strong>{{ watermark.universe_index || '-' }}</strong></div>
        <div>
          <span>base_date 评分</span><strong>{{ targetScoringRunText }}</strong>
          <small v-if="watermark.target_scoring_run?.updated_at">updated {{ watermark.target_scoring_run.updated_at }}</small>
        </div>
        <div><span>最近完成评分</span><strong>{{ latestCompletedScoringText }}</strong></div>
        <div><span>最新可用评分数据</span><strong>{{ latestAvailableScoreText }}</strong><small>{{ latestAvailableScoreMeta }}</small></div>
        <div><span>最近评分 run</span><strong>{{ latestScoringRunText }}</strong></div>
      </div>
      <p v-if="watermark.target_is_running" class="watermark-warning">
        当前 base_date 的评分仍在运行，plan generation worker 会等待，避免使用半成品评分。
      </p>
    </template>
  </section>
</template>

<script setup>
defineProps({
  watermark: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  targetScoringRunText: { type: String, default: '' },
  latestCompletedScoringText: { type: String, default: '' },
  latestAvailableScoreText: { type: String, default: '' },
  latestAvailableScoreMeta: { type: String, default: '' },
  latestScoringRunText: { type: String, default: '' },
})

defineEmits(['refresh'])
</script>
