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
        
        <!-- Thinking Process Toggle -->
        <div v-if="item.analysis?.thought_process_raw" style="margin-top: 12px;">
           <div style="display: flex; gap: 8px; align-items: center;">
             <button @click="toggleThinking(item)" class="btn-toggle-thinking">
               🧠 {{ thinkingStates[item.id || idx] ? '隐藏' : '显示' }}思考过程 (CoT)
             </button>
             <button v-if="thinkingStates[item.id || idx]" @click="toggleMaximize(item)" class="btn-toggle-thinking">
               ⛶ {{ maximizingStates[item.id || idx] ? '缩小' : '全屏' }}
             </button>
           </div>
           
           <div v-if="thinkingStates[item.id || idx]" 
                class="thinking-box" 
                :class="{ 'maximized': maximizingStates[item.id || idx] }">
             <div v-if="maximizingStates[item.id || idx]" class="modal-close-bar">
                <button @click="toggleMaximize(item)" class="btn-close">❌ 关闭全屏</button>
             </div>
             <pre>{{ item.analysis.thought_process_raw }}</pre>
           </div>
           <!-- Modal Overlay Background if needed, but CSS fixed handles it -->
           <div v-if="maximizingStates[item.id || idx]" class="thinking-overlay" @click="toggleMaximize(item)"></div>
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

import { reactive } from 'vue'
const thinkingStates = reactive({})
const maximizingStates = reactive({})

function toggleThinking(item) {
  const key = item.id || item._id || item.timestamp
  if (key) {
      thinkingStates[key] = !thinkingStates[key]
      // Reset maximize when hiding
      if (!thinkingStates[key]) maximizingStates[key] = false
  }
}

function toggleMaximize(item) {
    const key = item.id || item._id || item.timestamp
    if (key) {
        maximizingStates[key] = !maximizingStates[key]
    }
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
.history-card {
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}
.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  border-bottom: 1px solid #333;
  padding-bottom: 8px;
}
.stock-code {
  font-weight: bold;
  color: #eee;
  font-size: 14px;
}
.history-date {
  color: #888;
  font-size: 12px;
}
.history-model {
  font-size: 12px;
  color: #4ade80;
}
.history-body {
  font-size: 13px;
  color: #ddd;
}
.label {
  color: #888;
  margin-right: 6px;
}
.advice.buy { color: #f87171; }
.advice.sell { color: #4ade80; }
.advice.hold { color: #fbbf24; }

.risk.high { color: #f87171; }
.risk.medium { color: #fbbf24; }
.risk.low { color: #4ade80; }

.risk-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 8px;
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
.btn-toggle-thinking {
  background: none;
  border: 1px solid #4ade80;
  color: #4ade80;
  border-radius: 4px;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 12px;
  transition: all 0.2s;
}
.btn-toggle-thinking:hover {
  background: rgba(74, 222, 128, 0.1);
}
.thinking-box {
  margin-top: 8px;
  background: #1e1e1e;
  border-radius: 6px;
  padding: 12px;
  border: 1px solid #333;
  max-height: 300px;
  overflow-y: auto;
}
.thinking-box.maximized {
    position: fixed;
    top: 5vh;
    left: 5vw;
    width: 90vw;
    height: 90vh;
    max-height: none;
    z-index: 1000;
    box-shadow: 0 0 20px rgba(0,0,0,0.8);
    border: 1px solid #4ade80;
}
.thinking-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0,0,0,0.7);
    z-index: 999;
}
.modal-close-bar {
    position: sticky;
    top: 0;
    text-align: right;
    background: #1e1e1e;
    padding-bottom: 8px;
    margin-bottom: 8px;
    border-bottom: 1px solid #333;
}
.thinking-box pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: 'Fira Code', monospace;
  font-size: 13px;
  color: #d4d4d4;
  line-height: 1.5;
}
.btn-close {
    background: #f87171;
    color: white;
    border: none;
    padding: 4px 12px;
    border-radius: 4px;
    cursor: pointer;
}
</style>
