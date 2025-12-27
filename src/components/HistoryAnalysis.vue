<template>
  <div v-if="history && history.length > 0" class="history-section">
    <h4 style="margin-top:24px;">🕑 历史AI分析</h4>
    <div v-for="(item, idx) in history" :key="item.timestamp || item.id || idx" class="history-card">
      <div class="history-header">
        <span class="stock-code">
          {{ item.symbol }}<span v-if="item.stock_name"> - {{ item.stock_name }}</span>
        </span>
        <span class="history-date">{{ formatDateTime(item.created_at || item.timestamp) }}</span>
        <span class="history-model">🧠 模型: <b>{{ item.model || 'unknown' }}</b></span>
      </div>
      <div class="history-body">
        <div><span class="label">📊 技术面分析:</span> {{ item.analysis?.technical_analysis || '无' }}</div>
        <div><span class="label">⏳ 长期走势预测:</span> {{ item.analysis?.long_term_forecast || '无' }}</div>
        <div><span class="label">⏳ 中期走势预测:</span> {{ item.analysis?.mid_term_forecast || '无' }}</div>
        <div><span class="label">⏳ 短期走势预测:</span> {{ item.analysis?.short_term_forecast || '无' }}</div>
        <div>
          <span class="label">📋 摘要:</span>
          <ul v-if="Array.isArray(item.analysis?.key_points)">
            <li v-for="(point, i) in item.analysis.key_points" :key="i">{{ point }}</li>
          </ul>
          <span v-else>{{ item.analysis?.key_points || '无' }}</span>
        </div>
        <div>
          <span class="label">💡 投资建议:</span>
          <span :class="['advice', item.analysis?.investment_advice]">
            {{ item.analysis?.investment_advice || '无' }}
          </span>
        </div>
        <div class="risk-row">
          <span class="label">⚠️ 风险等级:</span>
          <span :class="['risk', item.analysis?.risk_level]">
            {{ item.analysis?.risk_level || '未知' }}
          </span>
          <span class="label" style="margin-left:12px;">支撑位:</span>
          <span>{{ item.analysis?.support_level ?? '无' }}</span>
          <span class="label" style="margin-left:12px;">阻力位:</span>
          <span>{{ item.analysis?.resistance_level ?? '无' }}</span>
          <span class="label" style="margin-left:12px;">信心分数:</span>
          <span>{{ item.analysis?.confidence_score ?? '无' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  history: Array
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
