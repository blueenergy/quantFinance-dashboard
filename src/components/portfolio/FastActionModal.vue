<template>
  <div v-if="visible" class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-card">
      <h3>{{ preview.title }}</h3>
      <p class="muted">{{ preview.description }}</p>
      <ul v-if="preview.items?.length" class="manual-preview">
        <li v-for="item in preview.items" :key="item.symbol">
          {{ item.symbol }} {{ item.name || '' }}：
          {{ item.current_shares }} → {{ item.target_shares }}
          （{{ formatShareDelta(item.delta_shares) }}）
          <span v-if="item.blockers?.length" class="warning-text"> · {{ item.blockers.join('、') }}</span>
          <div
            v-if="isLivePortfolio && item.reference_price != null && item.effective_limit_price != null"
            class="execution-price-note"
          >
            参考价 {{ formatPrice(item.reference_price) }}
            · {{ item.action === 'sell' ? '保护限价（最低可成交价）' : '保护限价（最高可成交价）' }}
            {{ formatPrice(item.effective_limit_price) }}
            <span v-if="item.max_slippage_bps != null"> · 最大滑点 {{ item.max_slippage_bps }} bps</span>
          </div>
        </li>
      </ul>
      <div v-if="preview.droppedTargets?.length" class="dropped-targets">
        <p class="warning-text">以下标的不会下单（券商可卖量不足或归一化后无变动）：</p>
        <ul class="manual-preview">
          <li v-for="row in preview.droppedTargets" :key="row.symbol">
            {{ row.symbol }}：{{ row.current_shares }} → 目标 {{ row.requested_target_shares }}
            · {{ row.reason_code }}
            <span v-if="row.account_available_shares != null">
              · 账户可卖 {{ row.account_available_shares }}
            </span>
          </li>
        </ul>
      </div>
      <p v-if="preview.cappedSymbols?.length" class="warning-text">
        {{ preview.cappedSymbols.join('、') }} 按账户可卖量缩量下单。
      </p>
      <p v-if="preview.blocked" class="warning-text">风控拦截，无法提交。</p>
      <div class="modal-actions">
        <button type="button" @click="$emit('close')">取消</button>
        <button
          type="button"
          :disabled="submitting || preview.blocked || !preview.items?.length"
          @click="$emit('confirm')"
        >
          {{ submitting ? '提交中…' : (isLivePortfolio ? '确认并下单' : '确认执行') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatShareDelta } from '../../composables/usePortfolioPlanFormat'

defineProps({
  visible: { type: Boolean, default: false },
  preview: {
    type: Object,
    default: () => ({
      title: '',
      description: '',
      items: [],
      droppedTargets: [],
      cappedSymbols: [],
      blocked: false,
    }),
  },
  submitting: { type: Boolean, default: false },
  isLivePortfolio: { type: Boolean, default: false },
})

defineEmits(['close', 'confirm'])

function formatPrice(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : '-'
}
</script>

<style scoped>
.modal-backdrop {
  align-items: center;
  background: rgba(17, 24, 39, 0.45);
  display: flex;
  inset: 0;
  justify-content: center;
  position: fixed;
  z-index: 50;
}

.modal-card {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  max-width: 520px;
  padding: 20px;
  width: calc(100% - 32px);
}

.modal-card h3 {
  color: #111827;
  margin-top: 0;
}

.muted {
  color: #374151;
  font-size: 13px;
  margin: 0;
}

.manual-preview {
  margin: 12px 0;
  padding-left: 18px;
}

.execution-price-note {
  color: #4b5563;
  font-size: 12px;
  margin-top: 4px;
}

.warning-text {
  color: #c2410c;
  font-weight: 600;
}

.dropped-targets {
  border-left: 3px solid #c2410c;
  margin: 12px 0;
  padding-left: 10px;
}

.dropped-targets p {
  margin: 0;
}

.dropped-targets .manual-preview {
  color: #4b5563;
  font-size: 12px;
  margin: 6px 0 0;
}

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
}

button {
  background: #fff;
  border: 1px solid #111827;
  border-radius: 4px;
  color: #111827;
  cursor: pointer;
  font-weight: 500;
  padding: 8px 10px;
}

button:disabled {
  border-color: #9ca3af;
  color: #6b7280;
  cursor: not-allowed;
  opacity: 1;
}
</style>
