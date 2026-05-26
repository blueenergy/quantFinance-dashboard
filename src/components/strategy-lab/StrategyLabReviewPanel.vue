<template>
  <section class="review-panel">
    <template v-if="latestReview">
      <h4>AI 复盘</h4>
      <p>{{ latestReview.review?.summary || '复盘已完成' }}</p>
      <div class="review-grid">
        <div>
          <strong>主要发现</strong>
          <ul>
            <li v-for="item in latestReview.review?.main_findings || []" :key="item">{{ item }}</li>
          </ul>
        </div>
        <div>
          <strong>下一轮实验</strong>
          <ul>
            <li v-for="item in latestReview.review?.next_experiments || []" :key="item.name || item.hypothesis || item">
              <span>{{ item.name || item.hypothesis || item }}</span>
              <button class="mini-btn" @click="() => applyReviewSuggestion(item)">应用到本实验</button>
              <button
                class="mini-btn primary-mini"
                :disabled="!canCreateNextExperiment"
                @click="() => applyReviewSuggestion(item, true)"
              >
                应用并测试
              </button>
            </li>
          </ul>
        </div>
      </div>
      <div class="suggestion-list" v-if="latestReview.review?.parameter_suggestions?.length">
        <strong>参数建议</strong>
        <div
          v-for="item in latestReview.review.parameter_suggestions"
          :key="item.name || item.rationale || JSON.stringify(item)"
          class="suggestion-row"
        >
          <span>{{ item.name || '参数组合' }}：{{ item.rationale || item.suggested_values || item }}</span>
          <button class="mini-btn" @click="() => applyReviewSuggestion(item)">应用到本实验</button>
          <button
            class="mini-btn primary-mini"
            :disabled="!canCreateNextExperiment"
            @click="() => applyReviewSuggestion(item, true)"
          >
            应用并测试
          </button>
        </div>
      </div>
    </template>
    <p v-else class="muted">暂无 AI 复盘。批量回测完成后可点击上方「AI 复盘」生成。</p>
  </section>
</template>

<script setup>
defineProps({
  latestReview: { type: Object, default: null },
  canCreateNextExperiment: { type: Boolean, default: false },
  applyReviewSuggestion: { type: Function, required: true },
})
</script>

<style scoped>
.review-panel {
  background: #f8fafc;
  border-radius: 12px;
  margin-top: 16px;
  padding: 12px;
}

h4,
p {
  margin: 0;
}

.muted {
  color: #64748b;
  font-size: 13px;
  margin-top: 8px;
}

.review-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin-top: 10px;
}

.review-grid ul {
  margin: 8px 0 0;
  padding-left: 18px;
}

.review-grid li,
.suggestion-row {
  margin-bottom: 8px;
}

button {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  padding: 8px 12px;
}

.mini-btn {
  font-size: 12px;
  margin-left: 6px;
  padding: 4px 8px;
}

.primary-mini {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}

.suggestion-list {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.suggestion-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
