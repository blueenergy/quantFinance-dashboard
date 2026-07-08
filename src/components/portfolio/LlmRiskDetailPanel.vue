<template>
  <Teleport to="body">
    <div v-if="detail" class="llm-popover-backdrop" @click="$emit('close')">
      <div
        class="llm-detail-panel"
        :class="{ 'llm-detail-panel--floating': Boolean(detail.pos) }"
        :style="panelStyle"
        @click.stop
      >
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
        <pre class="llm-detail-body" :style="{ fontSize: fontPx + 'px', maxHeight: bodyMaxHeight }">{{ detail.text }}</pre>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  detail: { type: Object, default: null },
  fontPx: { type: Number, default: 15 },
  min: { type: Number, default: 12 },
  max: { type: Number, default: 30 },
  copied: { type: Boolean, default: false },
})

defineEmits(['inc', 'dec', 'copy', 'close'])

const panelStyle = computed(() => {
  const pos = props.detail?.pos
  if (!pos) return {}
  return {
    top: `${pos.top}px`,
    left: `${pos.left}px`,
    width: `${pos.width}px`,
  }
})

const bodyMaxHeight = computed(() => {
  const pos = props.detail?.pos
  // Leave room for the header (~48px) inside the popover's max height.
  return pos?.maxHeight ? `${Math.max(120, pos.maxHeight - 56)}px` : '380px'
})
</script>

<style scoped>
.llm-popover-backdrop {
  background: transparent;
  inset: 0;
  position: fixed;
  z-index: 3000;
}

.llm-detail-panel {
  background: #f8faff;
  border: 1px solid #818cf8;
  border-radius: 8px;
  margin: 10px;
  padding: 10px 12px;
}

.llm-detail-panel--floating {
  box-shadow: 0 12px 32px rgba(30, 41, 59, 0.28);
  margin: 0;
  position: fixed;
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
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
