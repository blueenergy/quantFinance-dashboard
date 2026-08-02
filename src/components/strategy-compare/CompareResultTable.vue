<template>
  <div class="table-wrap">
    <table class="compare-result-table">
      <thead>
        <tr>
          <th>#</th>
          <th>策略</th>
          <th>预设</th>
          <th
            v-for="col in metricColumns"
            :key="col.key"
            class="sortable"
            @click="emit('sort', col.key)"
          >
            {{ col.label }}
            <span v-if="sortKey === col.key" class="sort-mark">{{ sortOrder === 'desc' ? '↓' : '↑' }}</span>
          </th>
          <th class="status-col">状态</th>
          <th class="action-col">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="row.task_id || index" :class="{ 'low-sample': isLowSample(row) }">
          <td>{{ rankOffset + index + 1 }}</td>
          <td>{{ row.strategy_key }}</td>
          <td class="preset-cell">
            <button
              type="button"
              class="preset-trigger"
              :class="{ 'has-params': canShowParams(row) }"
              @mouseenter="(event) => openPopover(event, row)"
              @mouseleave="scheduleClosePopover"
              @focus="(event) => openPopover(event, row)"
              @blur="scheduleClosePopover"
            >
              <span class="preset-label">{{ presetLabel(row) }}</span>
            </button>
          </td>
          <td v-for="col in metricColumns" :key="`${row.task_id}-${col.key}`">
            {{ formatMetric(row, col.key) }}
          </td>
          <td class="status-col">
            <button
              v-if="isLowSample(row)"
              type="button"
              class="warn-badge"
              @mouseenter="(event) => openSampleHint(event, row)"
              @mouseleave="scheduleClosePopover"
              @focus="(event) => openSampleHint(event, row)"
              @blur="scheduleClosePopover"
            >
              回合过少
            </button>
            <span v-else-if="isPendingRow(row)" class="pending-badge">{{ statusLabel(row.status) }}</span>
            <span v-else class="status-text">{{ statusLabel(row.status) }}</span>
          </td>
          <td class="action-col">
            <button
              type="button"
              class="detail-btn"
              :disabled="!canOpenDetail(row)"
              :title="detailButtonTitle(row)"
              @click="emit('open-detail', row)"
            >
              详情
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <Teleport to="body">
    <div
      v-if="popover.visible"
      class="params-popover-portal"
      role="tooltip"
      :style="popoverStyle"
      @mouseenter="cancelClosePopover"
      @mouseleave="scheduleClosePopover"
    >
      <span class="popover-title">{{ popover.title }}</span>
      <ul v-if="popover.kind === 'params' && popover.entries.length" class="params-list">
        <li v-for="entry in popover.entries" :key="entry.key">
          <span class="param-key">{{ entry.key }}</span>
          <span class="param-value">{{ entry.value }}</span>
        </li>
      </ul>
      <p v-else class="popover-plain">{{ popover.plain }}</p>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive } from 'vue'
import {
  formatLowSampleHint,
  hasStrategyParams,
  isLowSample,
  listStrategyParamEntries,
} from '../../utils/backtestSweepView'

const props = defineProps({
  rows: { type: Array, default: () => [] },
  sortKey: { type: String, default: 'total_return' },
  sortOrder: { type: String, default: 'desc' },
  rankOffset: { type: Number, default: 0 },
  pct: { type: Function, required: true },
  num: { type: Function, required: true },
})

const emit = defineEmits(['sort', 'open-detail'])

const metricColumns = [
  { key: 'total_return', label: '总收益' },
  { key: 'sharpe_ratio', label: '夏普' },
  { key: 'max_drawdown', label: '最大回撤' },
  { key: 'win_rate', label: '胜率' },
  { key: 'total_trades', label: '平仓回合' },
  { key: 'invested_return', label: '投入收益' },
  { key: 'capital_utilization', label: '资金占用' },
]

const POPOVER_WIDTH = 280
const POPOVER_GAP = 8

const popover = reactive({
  visible: false,
  kind: 'params',
  title: '策略参数',
  entries: [],
  plain: '',
  left: 0,
  top: 0,
})

let closeTimer = null

const popoverStyle = computed(() => ({
  left: `${popover.left}px`,
  top: `${popover.top}px`,
  width: `${POPOVER_WIDTH}px`,
}))

function presetLabel(row) {
  return row.preset || 'default'
}

function canShowParams(row) {
  return hasStrategyParams(row) || Boolean(row?.combo_label)
}

function formatMetric(row, key) {
  if (key === 'total_return' || key === 'max_drawdown' || key === 'win_rate' || key === 'invested_return' || key === 'capital_utilization') {
    return props.pct(row[key])
  }
  return props.num(row[key], 3)
}

function isPendingRow(row) {
  const status = String(row?.status || '').toLowerCase()
  return ['pending', 'running', 'claimed'].includes(status)
}

function canOpenDetail(row) {
  const status = String(row?.status || '').toLowerCase()
  return Boolean(row?.task_id) && status === 'completed'
}

function detailButtonTitle(row) {
  if (!row?.task_id) return '缺少任务 ID'
  if (canOpenDetail(row)) return '查看交易与净值详情'
  return '仅已完成任务可查看详情'
}

function statusLabel(status) {
  const key = String(status || '').toLowerCase()
  const map = {
    pending: '排队中',
    claimed: '已领取',
    running: '执行中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
  }
  return map[key] || status || '-'
}

function cancelClosePopover() {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
}

function scheduleClosePopover() {
  cancelClosePopover()
  closeTimer = setTimeout(() => {
    popover.visible = false
  }, 120)
}

function positionPopover(event, estimatedHeight) {
  const rect = event.currentTarget.getBoundingClientRect()
  const maxLeft = window.innerWidth - POPOVER_WIDTH - 12
  const left = Math.max(12, Math.min(rect.left, maxLeft))
  let top = rect.bottom + POPOVER_GAP
  if (top + estimatedHeight > window.innerHeight - 12) {
    top = Math.max(12, rect.top - estimatedHeight - POPOVER_GAP)
  }
  return { left, top }
}

function openPopover(event, row) {
  if (!canShowParams(row)) return
  cancelClosePopover()

  const entries = listStrategyParamEntries(row)
  const estimatedHeight = entries.length
    ? 40 + entries.length * 24
    : 64
  const { left, top } = positionPopover(event, estimatedHeight)

  popover.visible = true
  popover.kind = 'params'
  popover.title = entries.length ? '策略参数' : '组合'
  popover.entries = entries
  popover.plain = row.combo_label || '—'
  popover.left = left
  popover.top = top
}

function openSampleHint(event, row) {
  cancelClosePopover()
  const { left, top } = positionPopover(event, 88)

  popover.visible = true
  popover.kind = 'sample'
  popover.title = '平仓回合说明'
  popover.entries = []
  popover.plain = formatLowSampleHint(row)
  popover.left = left
  popover.top = top
}

onBeforeUnmount(() => {
  cancelClosePopover()
})
</script>

<style scoped>
.table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.compare-result-table {
  border-collapse: collapse;
  width: max-content;
  min-width: 100%;
  table-layout: auto;
}

th,
td {
  border-bottom: 1px solid #e2e8f0;
  padding: 8px 10px;
  text-align: left;
  white-space: nowrap;
  vertical-align: middle;
}

th.sortable {
  cursor: pointer;
  user-select: none;
}

.sort-mark {
  color: #2563eb;
  font-size: 11px;
}

.preset-cell {
  overflow: visible;
}

.preset-trigger {
  display: inline-flex;
  align-items: center;
  max-width: 180px;
  border: none;
  background: transparent;
  padding: 0;
  font: inherit;
  text-align: left;
  color: inherit;
}

.preset-trigger.has-params {
  cursor: help;
}

.preset-trigger.has-params .preset-label {
  border-bottom: 1px dashed #94a3b8;
}

.preset-label {
  font-size: 13px;
  color: #334155;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-col {
  white-space: nowrap;
}

.action-col {
  white-space: nowrap;
}

.detail-btn {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #0f6bdc;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}

.detail-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  color: #94a3b8;
}

.status-text {
  white-space: nowrap;
}

.low-sample {
  background: #fffbeb;
}

.warn-badge,
.pending-badge {
  display: inline-block;
  border-radius: 999px;
  font-size: 11px;
  padding: 2px 8px;
  white-space: nowrap;
}

.warn-badge {
  border: none;
  background: #fef3c7;
  color: #92400e;
  cursor: help;
  font: inherit;
}

.pending-badge {
  background: #eff6ff;
  color: #1d4ed8;
}
</style>

<style>
.params-popover-portal {
  position: fixed;
  z-index: 4000;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);
  white-space: normal;
  pointer-events: auto;
}

.params-popover-portal .popover-title {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 6px;
}

.params-popover-portal .popover-plain {
  margin: 0;
  font-size: 12px;
  color: #334155;
  line-height: 1.4;
}

.params-popover-portal .params-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.params-popover-portal .params-list li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  line-height: 1.5;
  padding: 2px 0;
}

.params-popover-portal .param-key {
  color: #64748b;
  flex-shrink: 0;
}

.params-popover-portal .param-value {
  color: #0f172a;
  font-weight: 600;
  text-align: right;
}
</style>
