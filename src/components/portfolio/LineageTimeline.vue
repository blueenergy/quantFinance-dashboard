<template>
  <section v-if="entries.length" class="timeline-section">
    <h3>观察 / 调仓时间线</h3>
    <p class="timeline-hint muted">调仓节点可展开查看买卖明细；观察日折叠段默认收起，点开看每日相对该日实际持仓的买/卖与换手。</p>
    <ul class="timeline-list">
      <li
        v-for="(entry, idx) in entries"
        :key="entry.type === 'monitor_fold' ? `fold-${entry.end}-${idx}` : entry.node.plan_id"
        :class="entryClass(entry)"
      >
        <template v-if="entry.type === 'monitor_fold'">
          <div class="timeline-fold-head">
            <button
              type="button"
              class="timeline-expand"
              :aria-expanded="expandedFoldKey === foldKey(entry)"
              @click="toggleFold(entry)"
            >
              {{ expandedFoldKey === foldKey(entry) ? '▾' : '▸' }}
            </button>
            <strong>{{ entry.end }} ~ {{ entry.start }}</strong>
            <span>观察 {{ entry.count }} 次</span>
            <span v-if="entry.maxDrift > 0" title="相对该日实际持仓的 would-be 换手">最大漂移换手 {{ pct(entry.maxDrift) }}</span>
            <span class="timeline-fold-hint">点开看每日买/卖</span>
          </div>
          <div v-if="expandedFoldKey === foldKey(entry)" class="timeline-fold-body">
            <p class="timeline-detail-note">观察日未执行，以下为若当日调仓、相对该日实际持仓的理论变化（不是相对上一观察日目标）。</p>
            <TimelineNode
              v-for="node in foldNodes(entry)"
              :key="node.plan_id"
              :node="node"
              :expanded="expandedFoldNodeId === node.plan_id"
              compact
              @toggle="toggleFoldNode(node.plan_id)"
            />
          </div>
        </template>
        <TimelineNode
          v-else
          :node="entry.node"
          :expanded="expandedPlanId === entry.node.plan_id"
          @toggle="$emit('toggle-detail', entry.node.plan_id)"
        />
      </li>
    </ul>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import TimelineNode from './TimelineNode.vue'

defineProps({
  entries: { type: Array, default: () => [] },
  expandedPlanId: { type: String, default: '' },
})

defineEmits(['toggle-detail'])

const expandedFoldKey = ref('')
const expandedFoldNodeId = ref('')

function foldKey(entry) {
  return `fold-${entry?.end}-${entry?.start}`
}

function foldNodes(entry) {
  return entry?.nodes || []
}

function toggleFold(entry) {
  const key = foldKey(entry)
  expandedFoldKey.value = expandedFoldKey.value === key ? '' : key
  expandedFoldNodeId.value = ''
}

function toggleFoldNode(planId) {
  expandedFoldNodeId.value = expandedFoldNodeId.value === planId ? '' : planId
}

function pct(value) {
  const number = Number(value)
  return Number.isFinite(number) ? `${(number * 100).toFixed(2)}%` : '-'
}

function entryClass(entry) {
  if (entry.type === 'monitor_fold') return 'timeline-item timeline-fold'
  const node = entry.node
  if (node.status === 'rejected') return 'timeline-item timeline-rejected'
  if (node.action_required) return 'timeline-item timeline-strong'
  if (node.node_type === 'rebalance') return 'timeline-item timeline-strong'
  return 'timeline-item'
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

.timeline-fold-head {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.timeline-fold-hint {
  color: #64748b;
  font-size: 12px;
}

.timeline-fold-body {
  margin-top: 10px;
}

.timeline-fold-body :deep(.timeline-node) {
  border-top: 1px dashed #e2e8f0;
  padding: 8px 0;
}

.timeline-fold-body :deep(.timeline-node:first-of-type) {
  border-top: none;
  padding-top: 0;
}

.timeline-detail-note {
  color: #92400e;
  font-size: 12px;
  margin: 0 0 8px;
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
</style>
