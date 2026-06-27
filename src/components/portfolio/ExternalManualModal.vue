<template>
  <div v-if="visible" class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-card wide">
      <h3>补录 miniQMT 手工操作</h3>
      <p class="muted">
        用于你已经在 miniQMT 直接买/卖的情况。这里不会再下单，只会把成交补进组合实盘账本留痕；
        支持部分减仓/加仓或全部清仓。只需填方向、数量和成交价，费用默认 0，成交时间/批次号/说明由系统自动填充。
      </p>
      <div class="table-wrap compact external-fill-table">
        <table>
          <thead>
            <tr>
              <th>方向</th>
              <th>代码</th>
              <th>名称</th>
              <th>数量</th>
              <th>成交价</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in rows" :key="row.key">
              <td>
                <select :value="row.action" @change="$emit('update-row', idx, 'action', $event.target.value)">
                  <option value="sell">卖出</option>
                  <option value="buy">买入</option>
                </select>
              </td>
              <td>
                <span v-if="!row.editableSymbol">{{ row.symbol }}</span>
                <input
                  v-else
                  :value="row.symbol"
                  type="text"
                  placeholder="如 600000.SH"
                  @input="$emit('update-row', idx, 'symbol', $event.target.value)"
                >
              </td>
              <td>{{ row.name || '-' }}</td>
              <td>
                <input
                  :value="row.filled_size"
                  type="number"
                  min="1"
                  step="100"
                  @input="$emit('update-row', idx, 'filled_size', $event.target.value)"
                >
              </td>
              <td>
                <input
                  :value="row.filled_price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  @input="$emit('update-row', idx, 'filled_price', $event.target.value)"
                >
              </td>
              <td>
                <button type="button" class="link-btn" @click="$emit('remove-row', idx)">移除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <button type="button" class="add-row-btn" @click="$emit('add-row')">+ 添加一笔</button>
      <p class="muted">
        结果持仓 = 当前持仓 + 手工买入 − 手工卖出。默认只更新账本，不影响后续策略调仓建议。
      </p>
      <label class="checkbox-row">
        <input :checked="excludeAfter" type="checkbox" @change="$emit('update:excludeAfter', $event.target.checked)">
        将清空（卖到 0）的标的加入排除名单（通常不需要）
      </label>
      <label class="checkbox-row">
        <input :checked="pauseLineage" type="checkbox" @change="$emit('update:pauseLineage', $event.target.checked)">
        若清空全部持仓，则暂停该组合自动调仓（通常不需要）
      </label>
      <div class="modal-actions">
        <button type="button" @click="$emit('close')">取消</button>
        <button type="button" :disabled="submitting || !ready" @click="$emit('confirm')">
          {{ submitting ? '补录中…' : '确认补录' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  rows: { type: Array, default: () => [] },
  excludeAfter: { type: Boolean, default: false },
  pauseLineage: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  ready: { type: Boolean, default: false },
})

defineEmits([
  'close',
  'confirm',
  'add-row',
  'remove-row',
  'update-row',
  'update:excludeAfter',
  'update:pauseLineage',
])
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

.modal-card.wide {
  max-width: 920px;
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

.table-wrap {
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  overflow-x: auto;
}

.table-wrap.compact table {
  font-size: 13px;
}

table {
  border-collapse: collapse;
  width: 100%;
}

th,
td {
  border-bottom: 1px solid #e5e7eb;
  color: #111827;
  padding: 10px 12px;
  text-align: left;
}

th {
  background: #f3f4f6;
  color: #111827;
  font-size: 13px;
  font-weight: 600;
}

.external-fill-table {
  margin-top: 10px;
}

.external-fill-table td {
  vertical-align: middle;
}

.external-fill-table input,
.external-fill-table select {
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  box-sizing: border-box;
  color: #111827;
  max-width: 180px;
  padding: 7px 8px;
  width: 100%;
}

.add-row-btn {
  background: none;
  border: 1px dashed #94a3b8;
  border-radius: 4px;
  color: #2563eb;
  cursor: pointer;
  margin-top: 8px;
  padding: 6px 10px;
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

.link-btn {
  background: none;
  border: none;
  color: #c2410c;
  cursor: pointer;
  padding: 0;
}

button:disabled {
  border-color: #9ca3af;
  color: #6b7280;
  cursor: not-allowed;
  opacity: 1;
}
</style>
