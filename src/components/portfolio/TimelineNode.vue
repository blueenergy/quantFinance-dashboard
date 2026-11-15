<template>
  <div class="timeline-node" :class="nodeClass">
    <div class="timeline-node-head">
      <button
        v-if="items.length"
        type="button"
        class="timeline-expand"
        :aria-expanded="expanded"
        @click="$emit('toggle')"
      >
        {{ expanded ? '▾' : '▸' }}
      </button>
      <strong>{{ node.date }}</strong>
      <span class="node-type">{{ nodeTypeLabel(node.node_type) }}</span>
      <span>{{ node.today_state }}</span>
      <span v-if="node.drift_brief?.buy_count">买 {{ node.drift_brief.buy_count }}</span>
      <span v-if="node.drift_brief?.sell_count">卖 {{ node.drift_brief.sell_count }}</span>
      <span v-if="node.drift_brief?.estimated_turnover != null" title="相对该日实际持仓的 would-be 换手">换手 {{ pct(node.drift_brief.estimated_turnover) }}</span>
      <span v-if="tradePlanId" class="timeline-plan-id">交易计划ID <code>{{ tradePlanId }}</code></span>
    </div>
    <div v-if="expanded && items.length" class="timeline-trade-detail">
      <p v-if="node.drift_brief?.mode === 'drift'" class="timeline-detail-note">观察日未执行，以下为若当日调仓、相对该日实际持仓的理论买卖。</p>
      <div class="table-wrap compact">
        <table>
          <thead>
            <tr>
              <th>方向</th>
              <th>代码</th>
              <th>名称</th>
              <th>变动股数</th>
              <th>持仓 → 目标</th>
              <th>估算金额</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in items" :key="`${node.plan_id}-${row.symbol}`">
              <td>
                <span class="action-tag" :class="row.action === 'buy' ? 'tag-buy' : 'tag-sell'">
                  {{ row.action === 'buy' ? '买' : '卖' }}
                </span>
              </td>
              <td>{{ row.symbol }}</td>
              <td>{{ row.name || '-' }}</td>
              <td>{{ formatShareDelta(row.delta_shares) }}</td>
              <td>{{ row.current_shares }} → {{ row.target_shares }}</td>
              <td>{{ money(row.estimated_amount) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatShareDelta, money } from '../../composables/usePortfolioPlanFormat'

const props = defineProps({
  node: { type: Object, required: true },
  expanded: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
})

defineEmits(['toggle'])

const items = computed(() => props.node?.drift_brief?.items || [])
const nodeClass = computed(() => ({
  'timeline-node--compact': props.compact,
  'timeline-node--strong': props.node?.node_type === 'rebalance',
  'timeline-node--rejected': props.node?.status === 'rejected',
}))
const tradePlanId = computed(() => {
  const isTradePlan = props.node?.record_kind === 'trade_plan' || props.node?.node_type === 'rebalance'
  return isTradePlan ? (props.node?.plan_id || '') : ''
})

function pct(value) {
  const number = Number(value)
  return Number.isFinite(number) ? `${(number * 100).toFixed(2)}%` : '-'
}

function nodeTypeLabel(nodeType) {
  if (nodeType === 'rebalance') return '调仓'
  if (nodeType === 'manual') return '补录'
  return '观察'
}
</script>

<style scoped>
.timeline-node {
  min-width: 0;
}

.timeline-node strong {
  color: #0f172a;
}

.timeline-node-head {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.timeline-node--compact .timeline-node-head {
  gap: 8px;
}

.timeline-node--strong .node-type {
  color: #1d4ed8;
  font-weight: 600;
}

.timeline-node--rejected .node-type {
  color: #991b1b;
  font-weight: 600;
}

.timeline-expand {
  background: transparent;
  border: none;
  color: #1d4ed8;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
}

.timeline-plan-id {
  color: #475569;
  word-break: break-all;
}

.timeline-plan-id code {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  color: #0f172a;
  padding: 1px 4px;
}

.timeline-trade-detail {
  margin-top: 10px;
  width: 100%;
}

.timeline-detail-note {
  color: #92400e;
  font-size: 12px;
  margin: 0 0 8px;
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

tbody tr:hover td {
  background: #f9fafb;
}

tbody tr:last-child td {
  border-bottom: none;
}

.action-tag {
  border-radius: 3px;
  color: #fff;
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  min-width: 20px;
  text-align: center;
}

.action-tag.tag-buy {
  background: #dc2626;
}

.action-tag.tag-sell {
  background: #16a34a;
}
</style>
