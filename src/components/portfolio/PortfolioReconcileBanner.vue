<template>
  <section class="reconcile-banner">
    <div class="reconcile-head">
      <strong>⚠ 系统账本与券商实时持仓不一致</strong>
      <button
        type="button"
        :disabled="!isLivePortfolio"
        @click="$emit('open-external-manual')"
      >
        补录 miniQMT 手工操作
      </button>
    </div>
    <p class="muted">
      可能是 miniQMT 端手工买卖后系统尚未记录。补录后账本即可与券商对齐。
      <span v-if="reconcileData?.account_synced_at">
        · 券商同步于 {{ formatSyncedAt(reconcileData.account_synced_at) }}
      </span>
    </p>
    <div class="table-wrap">
      <table class="lineup-table">
        <thead>
          <tr>
            <th>代码</th>
            <th>名称</th>
            <th>账本股数</th>
            <th>券商股数</th>
            <th>差异</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in reconcileData?.diffs || []" :key="row.symbol">
            <td>{{ row.symbol }}</td>
            <td>{{ row.name || '-' }}</td>
            <td>{{ row.ledger_shares }}</td>
            <td>{{ row.account_shares }}</td>
            <td :class="row.diff > 0 ? 'pos' : 'neg'">{{ formatShareDelta(row.diff) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { formatShareDelta } from '../../composables/usePortfolioPlanFormat'
import { formatSyncedAt } from '../../utils/portfolioOverviewFormat'

defineProps({
  reconcileData: { type: Object, default: null },
  isLivePortfolio: { type: Boolean, default: false },
})

defineEmits(['open-external-manual'])
</script>

<style scoped>
.reconcile-banner {
  background: #fef2f2;
  border: 1px solid #fca5a5;
  border-radius: 10px;
  margin-bottom: 16px;
  padding: 14px 16px;
}

.reconcile-head {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 6px;
}

.reconcile-head strong {
  color: #b91c1c;
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
  font-size: 13px;
  font-weight: 600;
}

tbody tr:hover td {
  background: #f9fafb;
}

.pos {
  color: #047857;
  font-weight: 600;
}

.neg {
  color: #b91c1c;
  font-weight: 600;
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
}
</style>
