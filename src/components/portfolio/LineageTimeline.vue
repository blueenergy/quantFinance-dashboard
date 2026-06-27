<template>
  <section v-if="entries.length" class="timeline-section">
    <h3>观察 / 调仓时间线</h3>
    <p class="timeline-hint muted">调仓节点可展开查看买卖明细；观察日折叠段仅显示漂移摘要。</p>
    <ul class="timeline-list">
      <li
        v-for="(entry, idx) in entries"
        :key="entry.type === 'monitor_fold' ? `fold-${entry.end}-${idx}` : entry.node.plan_id"
        :class="entryClass(entry)"
      >
        <template v-if="entry.type === 'monitor_fold'">
          <strong>{{ entry.end }} ~ {{ entry.start }}</strong>
          <span>观察 {{ entry.count }} 次</span>
          <span v-if="entry.maxDrift > 0">最大漂移换手 {{ pct(entry.maxDrift) }}</span>
        </template>
        <template v-else>
          <div class="timeline-node-head">
            <button
              v-if="tradeItems(entry.node).length"
              type="button"
              class="timeline-expand"
              :aria-expanded="expandedPlanId === entry.node.plan_id"
              @click="$emit('toggle-detail', entry.node.plan_id)"
            >
              {{ expandedPlanId === entry.node.plan_id ? '▾' : '▸' }}
            </button>
            <strong>{{ entry.node.date }}</strong>
            <span class="node-type">{{ nodeTypeLabel(entry.node.node_type) }}</span>
            <span>{{ entry.node.today_state }}</span>
            <span v-if="entry.node.drift_brief?.buy_count">买 {{ entry.node.drift_brief.buy_count }}</span>
            <span v-if="entry.node.drift_brief?.sell_count">卖 {{ entry.node.drift_brief.sell_count }}</span>
            <span v-if="entry.node.drift_brief?.estimated_turnover != null">换手 {{ pct(entry.node.drift_brief.estimated_turnover) }}</span>
            <span v-if="tradePlanId(entry.node)" class="timeline-plan-id">交易计划ID <code>{{ tradePlanId(entry.node) }}</code></span>
          </div>
          <div
            v-if="expandedPlanId === entry.node.plan_id && tradeItems(entry.node).length"
            class="timeline-trade-detail"
          >
            <p v-if="entry.node.drift_brief?.mode === 'drift'" class="timeline-detail-note">观察日未执行，以下为若今日调仓的理论买卖。</p>
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
                  <tr v-for="row in tradeItems(entry.node)" :key="`${entry.node.plan_id}-${row.symbol}`">
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
        </template>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { formatShareDelta, money } from '../../composables/usePortfolioPlanFormat'

defineProps({
  entries: { type: Array, default: () => [] },
  expandedPlanId: { type: String, default: '' },
})

defineEmits(['toggle-detail'])

function pct(value) {
  const number = Number(value)
  return Number.isFinite(number) ? `${(number * 100).toFixed(2)}%` : '-'
}

function nodeTypeLabel(nodeType) {
  if (nodeType === 'rebalance') return '调仓'
  if (nodeType === 'manual') return '补录'
  return '观察'
}

function entryClass(entry) {
  if (entry.type === 'monitor_fold') return 'timeline-item timeline-fold'
  const node = entry.node
  if (node.status === 'rejected') return 'timeline-item timeline-rejected'
  if (node.action_required) return 'timeline-item timeline-strong'
  if (node.node_type === 'rebalance') return 'timeline-item timeline-strong'
  return 'timeline-item'
}

function tradeItems(node) {
  return node?.drift_brief?.items || []
}

function tradePlanId(node) {
  if (!node) return ''
  const isTradePlan = node.record_kind === 'trade_plan' || node.node_type === 'rebalance'
  return isTradePlan ? (node.plan_id || '') : ''
}
</script>

<style scoped>
.timeline-section {
  margin-bottom: 16px;
}

.timeline-section h3 {
  color: #111827;
  font-size: 15px;
  font-weight: 600;
  margin: 20px 0 8px;
}

.timeline-hint {
  color: #374151;
  font-size: 12px;
  margin: -4px 0 8px;
}

.timeline-list {
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  list-style: none;
  margin: 0;
  overflow: hidden;
  padding: 0;
}

.timeline-item {
  border-bottom: 1px solid #e5e7eb;
  color: #64748b;
  display: block;
  font-size: 13px;
  padding: 10px 12px;
}

.timeline-item:last-child {
  border-bottom: none;
}

.timeline-item strong {
  color: #0f172a;
}

.timeline-fold {
  background: #f8fafc;
}

.timeline-strong {
  background: #fff;
  color: #1e293b;
  font-weight: 500;
}

.timeline-rejected {
  background: #f8fafc;
  color: #64748b;
}

.timeline-node-head {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
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

.timeline-strong .node-type {
  color: #1d4ed8;
  font-weight: 600;
}

.timeline-rejected .node-type {
  color: #991b1b;
  font-weight: 600;
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
