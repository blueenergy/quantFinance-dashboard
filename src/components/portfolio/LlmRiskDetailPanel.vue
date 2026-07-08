<template>
  <div v-if="detail" class="llm-detail-panel">
    <div class="llm-detail-head">
      <span class="llm-detail-title">
        LLM 风控详情<template v-if="detail.symbol"> · {{ detail.name || detail.symbol }}</template>
      </span>
      <div class="llm-detail-tools">
        <span class="llm-font-label">字号</span>
        <button type="button" class="llm-font-btn" :disabled="fontPx <= min" @click="$emit('dec')">A−</button>
        <span class="llm-font-size">{{ fontPx }}px</span>
        <button type="button" class="llm-font-btn" :disabled="fontPx >= max" @click="$emit('inc')">A+</button>
        <button type="button" class="llm-detail-copy" @click="$emit('copy')">
          {{ copied ? '已复制 ✓' : '复制全文' }}
        </button>
        <button type="button" class="llm-detail-close" @click="$emit('close')">关闭</button>
      </div>
    </div>
    <pre class="llm-detail-body" :style="{ fontSize: fontPx + 'px' }">{{ detail.text }}</pre>
  </div>
</template>

<script setup>
defineProps({
  detail: { type: Object, default: null },
  fontPx: { type: Number, default: 15 },
  min: { type: Number, default: 12 },
  max: { type: Number, default: 30 },
  copied: { type: Boolean, default: false },
})

defineEmits(['inc', 'dec', 'copy', 'close'])
</script>

<style scoped>
.llm-detail-panel {
  background: #f8faff;
  border: 1px solid #818cf8;
  border-radius: 8px;
  margin: 10px;
  padding: 10px 12px;
}

.llm-detail-head {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: space-between;
}

.llm-detail-title {
  color: #3730a3;
  font-size: 13px;
  font-weight: 700;
}

.llm-detail-tools {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.llm-font-label {
  color: #64748b;
  font-size: 12px;
}

.llm-font-btn,
.llm-detail-copy,
.llm-detail-close {
  background: #fff;
  border: 1px solid #c7d2fe;
  border-radius: 6px;
  color: #4338ca;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  padding: 2px 8px;
}

.llm-font-btn:disabled {
  color: #9ca3af;
  cursor: not-allowed;
  opacity: 0.7;
}

.llm-font-btn:not(:disabled):hover,
.llm-detail-copy:hover,
.llm-detail-close:hover {
  background: #eef2ff;
}

.llm-detail-close {
  border-color: #cbd5e1;
  color: #475569;
}

.llm-font-size {
  color: #334155;
  font-size: 12px;
  min-width: 34px;
  text-align: center;
}

.llm-detail-body {
  color: #1f2937;
  font-family: inherit;
  line-height: 1.65;
  margin: 8px 0 0;
  max-height: 380px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
