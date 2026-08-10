<template>
  <section v-if="visible" class="catch-up-card" :class="{ 'has-items': rows.length }">
    <div class="catch-up-header">
      <div>
        <h3>待补齐</h3>
        <p class="muted">
          本期已撤或部成部撤的买单。改价确认后生成新信号，无需再去「交易记录」。
        </p>
      </div>
      <div class="catch-up-header-actions">
        <span v-if="rows.length" class="count-badge">{{ rows.length }} 笔</span>
        <button type="button" class="secondary" :disabled="loading" @click="$emit('refresh')">
          {{ loading ? '刷新中…' : '刷新' }}
        </button>
      </div>
    </div>

    <p v-if="error" class="warning-text">{{ error }}</p>
    <p v-else-if="loading && !rows.length" class="muted">加载待补齐订单…</p>
    <p v-else-if="!rows.length" class="muted empty-hint">当前没有需要补齐的已撤买单。</p>

    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>标的</th>
            <th>状态</th>
            <th>原数量</th>
            <th>已成</th>
            <th>待补</th>
            <th>原限价</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.order_id">
            <td>
              <strong>{{ row.symbol }}</strong>
              <span v-if="row.name" class="name">{{ row.name }}</span>
            </td>
            <td>{{ statusLabel(row.status) }}</td>
            <td>{{ row.size }}</td>
            <td>{{ row.filled_qty }}</td>
            <td><strong>{{ row.remaining_size }}</strong></td>
            <td>{{ formatPrice(row.effective_limit_price) }}</td>
            <td class="actions">
              <button type="button" @click="$emit('open', row)">改价补齐</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="dialogOpen" class="modal-backdrop" @click.self="$emit('close')">
      <div class="modal-card">
        <h3>改价补齐{{ preview?.symbol ? ` — ${preview.symbol}` : '' }}</h3>
        <p v-if="dialogLoading" class="muted">加载市场参考价…</p>
        <template v-else>
          <p class="muted">
            原订单 <code>{{ activeOrderId }}</code>
            <span v-if="preview?.size != null"> · 基准数量 {{ preview.size }}</span>
          </p>
          <p class="caption">
            市场参考价：{{ formatPrice(preview?.market_reference_price) }}
            <span v-if="preview?.market_reference_source">({{ preview.market_reference_source }})</span>
          </p>
          <p class="caption">
            建议限价：{{ formatPrice(preview?.suggested_effective_limit_price) }}
          </p>
          <label class="field">
            <span>限价（必填）</span>
            <input
              :value="limitPrice"
              type="number"
              step="0.01"
              min="0"
              @input="$emit('update:limitPrice', toNumber($event.target.value))"
            >
          </label>
          <label class="field">
            <span>数量（部成部撤默认待补数量）</span>
            <input
              :value="size"
              type="number"
              step="100"
              min="0"
              @input="$emit('update:size', toNumber($event.target.value))"
            >
          </label>
          <label class="field">
            <span>原因（可选）</span>
            <input
              :value="reason"
              type="text"
              placeholder="例如：跟市补齐"
              @input="$emit('update:reason', $event.target.value)"
            >
          </label>
          <p v-if="dialogError" class="warning-text">{{ dialogError }}</p>
          <div class="modal-actions">
            <button type="button" @click="$emit('close')">取消</button>
            <button
              type="button"
              class="primary"
              :disabled="dialogSubmitting || dialogLoading"
              @click="$emit('confirm')"
            >
              {{ dialogSubmitting ? '提交中…' : '确认补齐' }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  rows: { type: Array, default: () => [] },
  dialogOpen: { type: Boolean, default: false },
  dialogLoading: { type: Boolean, default: false },
  dialogSubmitting: { type: Boolean, default: false },
  dialogError: { type: String, default: '' },
  activeOrderId: { type: String, default: '' },
  preview: { type: Object, default: null },
  limitPrice: { type: [Number, String], default: null },
  size: { type: [Number, String], default: null },
  reason: { type: String, default: '' },
})

defineEmits([
  'refresh',
  'open',
  'close',
  'confirm',
  'update:limitPrice',
  'update:size',
  'update:reason',
])

function formatPrice(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(3) : '—'
}

function statusLabel(status) {
  if (status === 'partial_cancelled') return '部成部撤'
  if (status === 'cancelled' || status === 'canceled') return '已撤单'
  return status || '—'
}

function toNumber(value) {
  if (value === '' || value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
</script>

<style scoped>
.catch-up-card {
  background: #fff7ed;
  border: 1px solid #fdba74;
  border-radius: 8px;
  margin-bottom: 16px;
  padding: 14px 16px;
}

.catch-up-card:not(.has-items) {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.catch-up-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 10px;
}

.catch-up-header h3 {
  color: #9a3412;
  font-size: 16px;
  margin: 0 0 4px;
}

.catch-up-card:not(.has-items) .catch-up-header h3 {
  color: #111827;
}

.muted {
  color: #64748b;
  font-size: 13px;
  margin: 0;
}

.empty-hint {
  margin-top: 4px;
}

.warning-text {
  color: #b91c1c;
  font-size: 13px;
  margin: 8px 0 0;
}

.catch-up-header-actions {
  align-items: center;
  display: flex;
  gap: 8px;
}

.count-badge {
  background: #ea580c;
  border-radius: 999px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 10px;
  white-space: nowrap;
}

button {
  background: #ea580c;
  border: 1px solid #c2410c;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  min-height: 32px;
  padding: 6px 12px;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

button.secondary {
  background: #fff;
  border-color: #cbd5e1;
  color: #334155;
}

button.primary {
  background: #c2410c;
  border-color: #9a3412;
}

.table-wrap {
  margin-top: 8px;
  overflow-x: auto;
}

table {
  border-collapse: collapse;
  width: 100%;
}

th,
td {
  border-bottom: 1px solid #fed7aa;
  color: #111827;
  font-size: 13px;
  padding: 8px 6px;
  text-align: left;
}

th {
  color: #9a3412;
  font-weight: 600;
}

td .name {
  color: #78716c;
  display: block;
  font-size: 12px;
}

td.actions {
  text-align: right;
  white-space: nowrap;
}

.modal-backdrop {
  align-items: center;
  background: rgba(17, 24, 39, 0.45);
  bottom: 0;
  display: flex;
  justify-content: center;
  left: 0;
  padding: 16px;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 40;
}

.modal-card {
  background: #fff;
  border-radius: 10px;
  max-width: 440px;
  padding: 18px 20px;
  width: 100%;
}

.modal-card h3 {
  color: #111827;
  font-size: 16px;
  margin: 0 0 8px;
}

.caption {
  color: #64748b;
  font-size: 12px;
  margin: 4px 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 10px;
}

.field span {
  color: #334155;
  font-size: 12px;
}

.field input {
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-size: 14px;
  min-height: 36px;
  padding: 6px 10px;
}

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
}

code {
  font-size: 12px;
}
</style>
