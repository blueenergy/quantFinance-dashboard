<template>
  <div v-if="visible" class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-card">
      <h3>{{ isLivePortfolio ? '确认实盘清仓' : '确认纸面清仓' }}</h3>
      <p v-if="isLivePortfolio" class="muted">
        将按实盘持仓即时下发<strong>卖出</strong>信号，交易器盘中（约 1 秒轮询）提交券商执行；
        同时落一条 origin=manual 的清仓计划留痕。跌停等市场原因卖不出由市场决定，不会拦截。
      </p>
      <p v-else class="muted">
        将按当前纸面持仓即时按<strong>实时价</strong>成交清仓，并写入纸面快照/净值；同时落一条 origin=manual 计划留痕。
      </p>
      <ul class="manual-preview">
        <li v-for="sym in targets" :key="sym">
          {{ sym }} {{ holdingNameBySymbol[sym] || '' }}：{{ holdingSharesBySymbol[sym] || 0 }} → 0
        </li>
      </ul>
      <p v-if="!targets.length" class="warning-text">没有可清仓的持仓。</p>
      <label class="checkbox-row">
        <input :checked="excludeAfter" type="checkbox" @change="$emit('update:excludeAfter', $event.target.checked)">
        将清仓标的加入排除名单（下次策略调仓不再买回）
      </label>
      <div class="modal-actions">
        <button type="button" @click="$emit('close')">取消</button>
        <button
          type="button"
          class="danger"
          :disabled="submitting || !targets.length"
          @click="$emit('confirm')"
        >
          {{ submitting ? '提交中…' : (isLivePortfolio ? '确认清仓并下单' : '确认清仓') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  isLivePortfolio: { type: Boolean, default: false },
  targets: { type: Array, default: () => [] },
  holdingNameBySymbol: { type: Object, default: () => ({}) },
  holdingSharesBySymbol: { type: Object, default: () => ({}) },
  excludeAfter: { type: Boolean, default: true },
  submitting: { type: Boolean, default: false },
})

defineEmits(['close', 'confirm', 'update:excludeAfter'])
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

.warning-text {
  color: #c2410c;
  font-weight: 600;
}

.checkbox-row {
  align-items: center;
  display: flex;
  gap: 8px;
  margin: 12px 0;
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

button.danger {
  background: #dc2626;
  border-color: #dc2626;
  color: #fff;
}

button:disabled {
  border-color: #9ca3af;
  color: #6b7280;
  cursor: not-allowed;
  opacity: 1;
}
</style>
