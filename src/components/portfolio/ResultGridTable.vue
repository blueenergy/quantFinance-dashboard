<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th v-for="axis in sweepAxes" :key="axis.key">{{ axis.label }}</th>
          <th>Variant</th>
          <th>TopN</th>
          <th>收益</th>
          <th>超额</th>
          <th>Sharpe</th>
          <th>回撤</th>
          <th>综合分</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, idx) in rows"
          :key="rowKey(row, idx)"
          :class="{ 'selected-result-row': isSelectedRow(row) }"
        >
          <td>
            {{ rankOffset + idx + 1 }}
            <span v-if="isSelectedRow(row)" class="selected-badge">已选</span>
          </td>
          <td v-for="axis in sweepAxes" :key="`${axis.key}-${idx}`">
            {{ formatAxisValue(axis.key, row[axis.key]) }}
          </td>
          <td>{{ row.variant || '-' }}</td>
          <td>{{ row.top_n }}</td>
          <td>{{ pct(row.cumulative_return) }}</td>
          <td>{{ pct(row.index_excess_cumulative_return) }}</td>
          <td>{{ num(row.sharpe) }}</td>
          <td>{{ pct(row.max_drawdown) }}</td>
          <td>{{ num(row.risk_adjusted_score, 3) }}</td>
          <td class="detail-cell">
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
const props = defineProps({
  rows: { type: Array, default: () => [] },
  sweepAxes: { type: Array, default: () => [] },
  selectedRow: { type: Object, default: null },
  rankOffset: { type: Number, default: 0 },
  formatAxisValue: { type: Function, required: true },
  pct: { type: Function, required: true },
  num: { type: Function, required: true },
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
      && row.trailing_stop_pct === props.selectedRow.trailing_stop_pct
    )
}
</script>
