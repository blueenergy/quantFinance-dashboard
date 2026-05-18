<template>
  <teleport to="body">
    <div v-if="open" class="limit-reasoning-mask" @click.self="$emit('close')">
      <section class="limit-reasoning-dialog">
        <header class="limit-reasoning-header">
          <div>
            <h4>涨停归因 · {{ stockName || symbol }}</h4>
            <p>{{ symbol }}<span v-if="tradeDate"> · {{ tradeDate }}</span></p>
          </div>
          <button type="button" class="limit-reasoning-close" @click="$emit('close')">×</button>
        </header>

        <div class="limit-reasoning-body">
          <p v-if="loading" class="limit-reasoning-state">正在读取系统已有归因与 LLM 解读…</p>
          <div v-else-if="error" class="limit-reasoning-empty">
            <strong>解读未就绪</strong>
            <p>{{ error }}</p>
            <p class="limit-reasoning-hint">
              系统默认会生成 LLM 解读，但可能因为任务未完成、当日未触发或该股未进入涨停归因范围而暂时没有结果。
            </p>
          </div>
          <template v-else-if="reasoning">
            <div class="limit-reasoning-core">
              <span v-if="reasoning.tag" class="limit-reasoning-tag">{{ reasoning.tag }}</span>
              <strong>{{ reasoning.reason || '暂无核心原因' }}</strong>
            </div>
            <div class="limit-reasoning-section">
              <h5>深度解读</h5>
              <p>{{ reasoning.analysis || '暂无详细解读。' }}</p>
            </div>
            <div v-if="newsContext.length" class="limit-reasoning-section">
              <h5>相关新闻上下文</h5>
              <ul>
                <li v-for="(item, idx) in newsContext" :key="idx">
                  <span class="limit-reasoning-news-time">{{ formatNewsTime(item.datetime) }}</span>
                  <a v-if="item.url" :href="item.url" target="_blank" rel="noopener noreferrer">
                    {{ item.title }}
                  </a>
                  <span v-else>{{ item.title }}</span>
                </li>
              </ul>
            </div>
          </template>
          <p v-else class="limit-reasoning-state">暂无归因数据。</p>
        </div>
      </section>
    </div>
  </teleport>
</template>

<script setup>
defineProps({
  open: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  symbol: { type: String, default: '' },
  stockName: { type: String, default: '' },
  tradeDate: { type: String, default: '' },
  reasoning: { type: Object, default: null },
  newsContext: { type: Array, default: () => [] },
})

defineEmits(['close'])

function formatNewsTime(value) {
  const s = String(value || '')
  if (!s) return ''
  if (s.includes(' ')) return s.split(' ')[1]?.slice(0, 5) || s
  return s.length >= 12 ? `${s.slice(8, 10)}:${s.slice(10, 12)}` : s
}
</script>

<style scoped>
.limit-reasoning-mask {
  align-items: center;
  background: rgba(15, 23, 42, .45);
  display: flex;
  inset: 0;
  justify-content: center;
  padding: 18px;
  position: fixed;
  z-index: 9999;
}
.limit-reasoning-dialog {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 18px 48px rgba(15, 23, 42, .22);
  max-height: 82vh;
  max-width: 640px;
  overflow: hidden;
  width: min(640px, 96vw);
}
.limit-reasoning-header {
  align-items: center;
  background: #1d4ed8;
  color: #fff;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
}
.limit-reasoning-header h4 {
  font-size: 16px;
  margin: 0 0 4px;
}
.limit-reasoning-header p {
  color: rgba(255, 255, 255, .78);
  font-size: 12px;
  margin: 0;
}
.limit-reasoning-close {
  background: transparent;
  border: none;
  color: #fff;
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
}
.limit-reasoning-body {
  color: #334155;
  font-size: 13px;
  line-height: 1.6;
  max-height: calc(82vh - 72px);
  overflow-y: auto;
  padding: 16px;
}
.limit-reasoning-state,
.limit-reasoning-empty p {
  margin: 0;
}
.limit-reasoning-empty {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
  color: #9a3412;
  padding: 12px;
}
.limit-reasoning-hint {
  color: #64748b;
  font-size: 12px;
  margin-top: 8px !important;
}
.limit-reasoning-core {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}
.limit-reasoning-tag {
  background: #ede9fe;
  border-radius: 999px;
  color: #6d28d9;
  font-size: 12px;
  padding: 3px 8px;
}
.limit-reasoning-section {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  margin-top: 12px;
  padding: 12px;
}
.limit-reasoning-section h5 {
  color: #1e40af;
  font-size: 13px;
  margin: 0 0 6px;
}
.limit-reasoning-section p {
  margin: 0;
  white-space: pre-wrap;
}
.limit-reasoning-section ul {
  margin: 0;
  padding-left: 18px;
}
.limit-reasoning-section li {
  margin: 4px 0;
}
.limit-reasoning-news-time {
  color: #64748b;
  display: inline-block;
  font-size: 12px;
  margin-right: 6px;
  min-width: 38px;
}
.limit-reasoning-section a {
  color: #2563eb;
  text-decoration: none;
}
.limit-reasoning-section a:hover {
  text-decoration: underline;
}
</style>
