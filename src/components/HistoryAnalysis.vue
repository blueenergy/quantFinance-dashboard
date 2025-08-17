<template>
  <div v-if="history && history.length > 0" class="history-section">
    <h4 style="margin-top:24px;">🕑 历史AI分析</h4>
    <ul>
      <li v-for="(item, idx) in history" :key="item.timestamp">
        <span>{{ formatDateTime(item.timestamp) }}</span>
        <span style="margin-left:8px;">模型: {{ item.data.model || defaultModel }}</span>
        <span style="margin-left:8px;">摘要: {{ item.data.analysis?.technical_analysis || item.data.technical_analysis || '无' }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
const props = defineProps({
  history: Array,
  defaultModel: String
})
function formatDateTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.history-section {
  margin-top: 24px;
  background: rgba(30,30,63,0.08);
  border-radius: 8px;
  padding: 12px 16px;
}
.history-section h4 {
  color: #8a2be2;
  font-size: 15px;
  margin-bottom: 10px;
}
.history-section ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.history-section li {
  margin-bottom: 8px;
  color: #b19cd9;
  font-size: 13px;
}
</style>
