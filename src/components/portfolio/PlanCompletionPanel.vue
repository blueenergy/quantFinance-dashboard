<template>
  <section v-if="visible" class="completion-card" :class="{ 'has-gaps': incompleteCount > 0 }">
    <div class="completion-header">
      <div>
        <h3>计划完成度</h3>
        <p class="muted">
          本期买卖标的：目标持仓 / 已成交 / 缺口。有缺口的排在前面。
        </p>
      </div>
      <div v-if="rows.length" class="summary-badges">
        <span class="badge done">完成 {{ completeCount }}</span>
        <span v-if="incompleteCount" class="badge gap">未完成 {{ incompleteCount }}</span>
      </div>
    </div>

    <p v-if="!rows.length" class="muted empty-hint">当前计划没有买卖变动标的。</p>
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>标的</th>
            <th>方向</th>
            <th>目标持仓</th>
            <th>计划变动</th>
            <th>已成交</th>
            <th>缺口</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="`${row.symbol}-${row.action}`"
            :class="{ incomplete: !row.complete, complete: row.complete }"
          >
            <td>
              <strong>{{ row.symbol }}</strong>
              <span v-if="row.name" class="name">{{ row.name }}</span>
            </td>
            <td>
              <span class="action" :class="row.action">{{ actionLabel(row.action) }}</span>
            </td>
            <td>{{ row.target_shares }}</td>
            <td>{{ formatPlanned(row) }}</td>
            <td>{{ row.filled_shares }}</td>
            <td>
              <strong v-if="!row.complete">{{ row.gap_shares }}</strong>
              <span v-else class="ok">0</span>
            </td>
            <td>{{ statusLabel(row) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  rows: { type: Array, default: () => [] },
})

const completeCount = computed(() => props.rows.filter((row) => row.complete).length)
const incompleteCount = computed(() => props.rows.length - completeCount.value)

function actionLabel(action) {
  if (action === 'buy') return '买'
  if (action === 'sell') return '卖'
  return action || '—'
}

function formatPlanned(row) {
  if (!row.planned_shares) return '0'
  return row.action === 'sell' ? `-${row.planned_shares}` : `+${row.planned_shares}`
}

function statusLabel(row) {
  if (row.complete) return '已完成'
  const map = {
    filled: '已完成',
    partial_filled: '部分成交',
    active: '执行中',
    cancelled: '已撤单',
    canceled: '已撤单',
    partial_cancelled: '部成部撤',
    failed: '失败',
    rejected: '拒绝',
    not_started: '未开始',
  }
  return map[row.live_status] || row.live_status || '未完成'
}
</script>

<style scoped>
.completion-card {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  margin-bottom: 16px;
  padding: 14px 16px;
}

.completion-card.has-gaps {
  background: #fffbeb;
  border-color: #fcd34d;
}

.completion-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 10px;
}

.completion-header h3 {
  color: #111827;
  font-size: 16px;
  margin: 0 0 4px;
}

.completion-card.has-gaps .completion-header h3 {
  color: #92400e;
}

.muted {
  color: #64748b;
  font-size: 13px;
  margin: 0;
}

.empty-hint {
  margin-top: 4px;
}

.summary-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.badge {
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 10px;
  white-space: nowrap;
}

.badge.done {
  background: #dcfce7;
  color: #166534;
}

.badge.gap {
  background: #fef3c7;
  color: #92400e;
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
  border-bottom: 1px solid #e2e8f0;
  color: #111827;
  font-size: 13px;
  padding: 8px 6px;
  text-align: left;
}

.has-gaps th {
  border-bottom-color: #fde68a;
  color: #92400e;
}

td .name {
  color: #78716c;
  display: block;
  font-size: 12px;
}

tr.incomplete {
  background: rgba(251, 191, 36, 0.12);
}

tr.complete {
  opacity: 0.72;
}

.action {
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  padding: 1px 6px;
}

.action.buy {
  background: #fee2e2;
  color: #b91c1c;
}

.action.sell {
  background: #dcfce7;
  color: #166534;
}

.ok {
  color: #16a34a;
}
</style>
