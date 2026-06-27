<template>
  <div v-if="visible" class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-card">
      <h3>确认手动调仓</h3>
      <p v-if="isLivePortfolio" class="muted">
        实盘组合：将按实盘持仓即时下发买/卖委托（交易器盘中约 1 秒轮询执行），并落一条 origin=manual 计划留痕。
      </p>
      <p v-else class="muted">
        纸面组合：将按当前纸面持仓即时按<strong>实时价</strong>成交买/卖，并写入纸面快照/净值；同时落一条 origin=manual 计划留痕。
      </p>
      <p v-if="highRiskRows.length" class="muted">高风险标的已默认清仓，可在上方表格调整目标股数。</p>
      <ul class="manual-preview">
        <li v-for="row in rows" :key="row.symbol">
          {{ row.symbol }} {{ row.name || '' }}：
          {{ row.shares }} → {{ row.target }}
          （{{ formatShareDelta(row.delta) }}）
        </li>
      </ul>
      <p v-if="willPauseAfterManual" class="warning-text">全部卖空后将暂停该组合自动调仓。</p>
      <label class="checkbox-row">
        <input :checked="excludeAfter" type="checkbox" @change="$emit('update:excludeAfter', $event.target.checked)">
        将卖出的标的加入排除名单（下次策略调仓不再买回）
      </label>
      <div class="modal-actions">
        <button type="button" @click="$emit('close')">取消</button>
        <button type="button" :disabled="submitting" @click="$emit('confirm')">
          {{ submitting ? '提交中…' : (isLivePortfolio ? '确认并下单' : '确认生成计划') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatShareDelta } from '../../composables/usePortfolioPlanFormat'

defineProps({
  visible: { type: Boolean, default: false },
  isLivePortfolio: { type: Boolean, default: false },
  highRiskRows: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  willPauseAfterManual: { type: Boolean, default: false },
  excludeAfter: { type: Boolean, default: false },
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

button:disabled {
  border-color: #9ca3af;
  color: #6b7280;
  cursor: not-allowed;
  opacity: 1;
}
</style>
