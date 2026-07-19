<template>
  <div class="table-wrap" :class="{ compact }">
    <table>
      <thead>
        <tr>
          <th class="col-rank">Rank</th>
          <th v-for="axis in sweepAxes" :key="axis.key" class="col-text">{{ axis.label }}</th>
          <th class="col-text">Variant</th>
          <th>TopN</th>
          <th>收益</th>
          <th>超额</th>
          <th>Sharpe</th>
          <th>回撤</th>
          <th>综合分</th>
          <th class="col-actions">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, idx) in rows"
          :key="rowKey(row, idx)"
          :class="{ 'selected-result-row': isSelectedRow(row) }"
        >
          <td class="col-rank">
            {{ rankOffset + idx + 1 }}
            <span v-if="isSelectedRow(row)" class="selected-badge">发布候选</span>
          </td>
          <td v-for="axis in sweepAxes" :key="`${axis.key}-${idx}`" class="col-text">
            {{ formatAxisValue(axis.key, row[axis.key]) }}
          </td>
          <td class="col-text">{{ row.variant || '-' }}</td>
          <td>{{ row.top_n }}</td>
          <td :class="signClass(row.cumulative_return)">{{ pct(row.cumulative_return) }}</td>
          <td :class="signClass(row.index_excess_cumulative_return)">{{ pct(row.index_excess_cumulative_return) }}</td>
          <td>{{ num(row.sharpe) }}</td>
          <td class="neg">{{ pct(row.max_drawdown) }}</td>
          <td>{{ num(row.risk_adjusted_score, 3) }}</td>
          <td class="col-actions detail-cell">
            <button type="button" class="link-btn" @click="$emit('select-row', row)">选为候选</button>
            <button
              v-if="row.combo_key && row.has_detail !== false"
              type="button"
              class="link-btn"
              @click="$emit('open-combo', row)"
            >
              成交
            </button>
            <span v-else class="muted">—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { rowMatchesAxis } from '../../utils/sweepResultView'

const props = defineProps({
  rows: { type: Array, default: () => [] },
  sweepAxes: { type: Array, default: () => [] },
  selectedRow: { type: Object, default: null },
  rankOffset: { type: Number, default: 0 },
  formatAxisValue: { type: Function, required: true },
  pct: { type: Function, required: true },
  num: { type: Function, required: true },
  compact: { type: Boolean, default: false },
})

defineEmits(['select-row', 'open-combo'])

function rowKey(row, idx) {
  return row.combo_key || `${row.score_variant}-${row.variant}-${row.top_n}-${row.trailing_stop_pct}-${idx}`
}

function isSelectedRow(row) {
  if (!row || !props.selectedRow) return false
  return row === props.selectedRow
    || (row.combo_key && row.combo_key === props.selectedRow.combo_key)
    || (
      row.top_n === props.selectedRow.top_n
      && row.variant === props.selectedRow.variant
      && row.score_variant === props.selectedRow.score_variant
      && rowMatchesAxis(row, 'trailing_stop_pct', props.selectedRow.trailing_stop_pct)
    )
}

function signClass(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number === 0) return 'mut'
  return number > 0 ? 'pos' : 'neg'
}
</script>

<style scoped>
.table-wrap {
  overflow-x: auto;
  border: 1px solid #e6eaf0;
  border-radius: 10px;
}

.table-wrap.compact table {
  font-size: 12px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th,
td {
  padding: 9px 10px;
  border-bottom: 1px solid #edf0f5;
  text-align: right;
  white-space: nowrap;
}

.compact th,
.compact td {
  padding: 7px 8px;
}

.col-text,
.col-actions,
.detail-cell {
  text-align: left;
}

.col-rank {
  text-align: left;
  min-width: 72px;
}

th {
  background: #f8fafc;
  color: #475569;
  font-weight: 700;
}

tbody tr:hover td {
  background: #fafbfc;
}

.selected-result-row td {
  background: #fff7ed;
  border-bottom-color: #fed7aa;
}

.selected-result-row td.col-rank {
  color: #c2410c;
  font-weight: 800;
}

.selected-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 2px 6px;
  border-radius: 999px;
  background: #f97316;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.pos { color: #d4380d; font-weight: 700; }
.neg { color: #389e0d; font-weight: 700; }
.mut { color: #94a3b8; }

.link-btn {
  border: none;
  background: transparent;
  color: #0f6bdc;
  padding: 2px 4px;
  cursor: pointer;
  font: inherit;
  text-decoration: underline;
}

.muted {
  color: #94a3b8;
}
</style>
