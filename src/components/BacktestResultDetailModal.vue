<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="backtest-result-modal-overlay"
      @click.self="emit('close')"
    >
      <div
        class="backtest-result-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @keydown.esc.stop="emit('close')"
      >
        <header class="modal-header">
          <div>
            <h3>{{ title }}</h3>
            <p v-if="subtitle" class="muted">{{ subtitle }}</p>
          </div>
          <button type="button" class="close-btn" aria-label="关闭" @click="emit('close')">✕</button>
        </header>
        <div class="modal-body">
          <BacktestResultDetail
            :result="result"
            :meta="meta"
            :loading="loading"
            :loading-message="loadingMessage"
            :error="error"
            :trade-limit="tradeLimit"
          >
            <template v-if="$slots.actions" #actions>
              <slot name="actions" />
            </template>
          </BacktestResultDetail>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import BacktestResultDetail from './BacktestResultDetail.vue'

defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '回测结果' },
  subtitle: { type: String, default: '' },
  result: { type: Object, default: null },
  meta: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
  loadingMessage: { type: String, default: '加载结果中…' },
  error: { type: String, default: '' },
  tradeLimit: { type: Number, default: 20 },
})

const emit = defineEmits(['close'])
</script>

<style scoped>
.backtest-result-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 4200;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 32px 16px;
  overflow: auto;
}

.backtest-result-modal {
  width: min(1000px, 100%);
  max-height: calc(100vh - 64px);
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #0f172a;
}

.muted {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 13px;
}

.close-btn {
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  width: 28px;
  height: 28px;
}

.close-btn:hover {
  color: #475569;
}

.modal-body {
  padding: 16px 20px 24px;
  overflow: auto;
  min-height: 0;
}
</style>
