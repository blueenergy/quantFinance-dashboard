<template>
  <section class="reconcile-banner" :class="hasDrift ? 'is-drift' : 'is-manual'">
    <div class="reconcile-head">
      <strong>{{ hasDrift ? '⚠ 系统账本与券商实时持仓不一致' : '手工仓' }}</strong>
      <button
        v-if="hasDrift"
        type="button"
        :disabled="!isLivePortfolio"
        @click="$emit('open-external-manual')"
      >
        补录 miniQMT 手工操作
      </button>
    </div>
    <p class="muted">
      <template v-if="hasDrift">
        可能是 miniQMT 端手工买卖后系统尚未记录。补录后账本即可与券商对齐。
      </template>
      <template v-else>
        券商持有、但策略从未买入的仓位。策略不管理它们，也不计入账实核对告警。
      </template>
      <span v-if="reconcileData?.account_synced_at">
        · 券商同步于 {{ formatSyncedAt(reconcileData.account_synced_at) }}
      </span>
    </p>
    <div v-for="group in groups" :key="group.key" class="table-wrap">
      <p v-if="groups.length > 1" class="group-label">{{ group.label }}</p>
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
          <tr v-for="row in group.rows" :key="row.symbol">
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
import { computed } from 'vue'
import { formatShareDelta } from '../../composables/usePortfolioPlanFormat'
import { formatSyncedAt } from '../../utils/portfolioOverviewFormat'

const props = defineProps({
  reconcileData: { type: Object, default: null },
  isLivePortfolio: { type: Boolean, default: false },
})

defineEmits(['open-external-manual'])

// Drift is the alarm: the broker moved and we did not record it. Manual positions
// are informational: shares the strategy never bought, so there is nothing to
// re-sync. Both can be present at once, so render them as separate tables.
const hasDrift = computed(() => (props.reconcileData?.diffs || []).length > 0)

const groups = computed(() => {
  const out = []
  const diffs = props.reconcileData?.diffs || []
  const manual = props.reconcileData?.manual_positions || []
  if (diffs.length) out.push({ key: 'diffs', label: '账实差异', rows: diffs })
  if (manual.length) out.push({ key: 'manual', label: '手工仓', rows: manual })
  return out
})
</script>

<style scoped>
.reconcile-banner {
  background: #f9fafb;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  margin-bottom: 16px;
  padding: 14px 16px;
}

.reconcile-banner.is-drift {
  background: #fef2f2;
  border-color: #fca5a5;
}

.reconcile-head {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 6px;
}

.reconcile-head strong {
  color: #374151;
}

.reconcile-banner.is-drift .reconcile-head strong {
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
  margin-top: 10px;
  overflow-x: auto;
}

.group-label {
  background: #f3f4f6;
  color: #374151;
  font-size: 13px;
  font-weight: 600;
  margin: 0;
  padding: 8px 12px;
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
