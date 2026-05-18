<template>
  <div class="sector-contrib-panel">
    <template v-if="loading">
      <h5 class="sector-contrib-title">{{ title }}</h5>
      <p class="sector-contrib-state">{{ loadingText }}</p>
    </template>
    <template v-else-if="error">
      <h5 class="sector-contrib-title">{{ title }}</h5>
      <p class="sector-contrib-state sector-contrib-state--error">{{ error }}</p>
    </template>
    <details
      v-else-if="payload?.success"
      :key="dataKey"
      class="sector-contrib-root-fold"
    >
      <summary class="sector-contrib-root-summary">
        <strong class="sector-contrib-summary-title">{{ title }}</strong>
        <span class="sector-contrib-root-hint">
          MA{{ effectiveMaPeriod }} · Top {{ topN }}（点击展开明细）
        </span>
      </summary>
      <div class="sector-contrib-root-body">
        <p v-if="description" class="sector-contrib-description">{{ description }}</p>
        <div class="sector-contrib-section-stack">
          <details
            v-if="leaderAmountRows.length"
            class="sector-contrib-fold"
          >
            <summary class="sector-contrib-fold-summary">
              多视角引领预览 · 资金 / 价格 / 波动 · 各 Top {{ payload.leader_preview_k || 5 }}
              <span class="sector-contrib-summary-hint">（点击展开）</span>
            </summary>
            <div class="sector-contrib-leader-stack">
              <p class="sector-contrib-intro">
                同一快照三种排序视角，非单一龙头定义；表宽可横向滑动。
              </p>
              <section class="sector-contrib-leader-block">
                <h6 class="sector-contrib-block-title">资金引领 · 成交额</h6>
                <ContributorLeaderTable :rows="leaderAmountRows" />
              </section>
              <section class="sector-contrib-leader-block">
                <h6 class="sector-contrib-block-title">价格引领 · 涨幅排序</h6>
                <ContributorLeaderTable :rows="leaderPctRows" />
              </section>
              <section class="sector-contrib-leader-block">
                <h6 class="sector-contrib-block-title">高波动辨识度 · |涨跌幅|</h6>
                <p class="sector-contrib-block-hint">按涨跌幅绝对值排序（无连板标签）。</p>
                <ContributorLeaderTable :rows="leaderVolatilityRows" />
              </section>
            </div>
          </details>

          <details class="sector-contrib-fold">
            <summary class="sector-contrib-fold-summary">
              MA{{ effectiveMaPeriod }} 分桶 · 站上 / 未站上均线 · 各 Top {{ topN }}
              <span class="sector-contrib-summary-hint">（点击展开）</span>
            </summary>
            <div class="sector-contrib-ma-grid">
              <section class="sector-contrib-ma-block">
                <h6 class="sector-contrib-block-title">站上均线 · Top {{ topN }}</h6>
                <ContributorMaTable :rows="topAboveRows" />
              </section>
              <section class="sector-contrib-ma-block">
                <h6 class="sector-contrib-block-title">未站上均线 · Top {{ topN }}</h6>
                <ContributorMaTable :rows="topBelowRows" />
              </section>
            </div>
          </details>
        </div>
      </div>
    </details>
    <template v-else-if="payload">
      <h5 class="sector-contrib-title">{{ title }}</h5>
      <p class="sector-contrib-state">{{ payload.error || emptyText }}</p>
    </template>
  </div>
</template>

<script setup>
import { computed, defineComponent, h } from 'vue'

const props = defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  payload: { type: Object, default: null },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  topN: { type: Number, required: true },
  maPeriod: { type: Number, default: 5 },
  dataKey: { type: String, default: '' },
  loadingText: { type: String, default: '贡献股加载中…' },
  emptyText: { type: String, default: '暂无贡献股数据' },
})
const emit = defineEmits(['show-reasoning'])

const effectiveMaPeriod = computed(() => props.payload?.ma_period || props.maPeriod)
const leaderAmountRows = computed(() => props.payload?.leader_amount_top || [])
const leaderPctRows = computed(() => props.payload?.leader_pct_chg_top || [])
const leaderVolatilityRows = computed(() => props.payload?.leader_volatility_top || [])
const topAboveRows = computed(() => props.payload?.top_above_ma || [])
const topBelowRows = computed(() => props.payload?.top_below_ma || [])

function formatPct(v) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  const n = Number(v)
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function formatAmountWan(yuan) {
  if (yuan == null || Number.isNaN(Number(yuan))) return '—'
  return (Number(yuan) / 10000).toFixed(1)
}

function formatPrice(p) {
  if (p == null || Number.isNaN(Number(p))) return '—'
  return Number(p).toFixed(2)
}

function formatMargin(m) {
  if (m == null || Number.isNaN(Number(m))) return '—'
  return Number(m).toFixed(3)
}

function showReasoning(row) {
  emit('show-reasoning', {
    ...row,
    trade_date: props.payload?.trade_date || props.payload?.snapshot_time || '',
  })
}

function renderReasoningCell(row) {
  if (!row?.limit_up_seen && !row?.limit_up_reasoning_available) {
    return h('td', { class: 'sector-contrib-link-cell sector-contrib-link-cell--empty' }, '—')
  }
  if (!row?.limit_up_reasoning_available) {
    const label = row?.limit_up_status === 'broken' ? '炸板无解读' : '未就绪'
    return h('td', { class: 'sector-contrib-link-cell' }, [
      h('span', { class: 'sector-contrib-link-muted', title: '系统暂未找到可用的涨停归因 LLM 解读' }, label),
    ])
  }
  return h('td', { class: 'sector-contrib-link-cell' }, [
    h(
      'button',
      {
        class: 'sector-contrib-link-btn',
        type: 'button',
        title: '查看系统已有的涨停归因与 LLM 解读',
        onClick: (event) => {
          event.stopPropagation()
          showReasoning(row)
        },
      },
      '涨停归因',
    ),
  ])
}

function renderCells(row, includeMargin) {
  const cells = [
    row.symbol,
    row.name,
    formatPrice(row.close),
    formatPct(row.pct_chg),
    formatAmountWan(row.amount_yuan),
  ]
  if (includeMargin) cells.push(formatMargin(row.margin_to_ma))
  return [
    ...cells.map((value) => h('td', value)),
    renderReasoningCell(row),
  ]
}

const ContributorLeaderTable = defineComponent({
  name: 'ContributorLeaderTable',
  props: { rows: { type: Array, required: true } },
  setup(tableProps) {
    return () => h('div', { class: 'sector-contrib-table-scroll' }, [
      h('table', { class: 'sector-contrib-table sector-contrib-table--leader' }, [
        h('thead', [
          h('tr', ['代码', '名称', '股价', '涨跌%', '成交额(万)', '联动'].map((label) => h('th', label))),
        ]),
        h('tbody', tableProps.rows.map((row) => h('tr', { key: row.symbol }, renderCells(row, false)))),
      ]),
    ])
  },
})

const ContributorMaTable = defineComponent({
  name: 'ContributorMaTable',
  props: { rows: { type: Array, required: true } },
  setup(tableProps) {
    return () => h('div', { class: 'sector-contrib-table-scroll' }, [
      h('table', { class: 'sector-contrib-table sector-contrib-table--ma' }, [
        h('thead', [
          h('tr', ['代码', '名称', '股价', '涨跌%', '成交额(万)', '距均线', '联动'].map((label) => h('th', label))),
        ]),
        h('tbody', tableProps.rows.map((row) => h('tr', { key: row.symbol }, renderCells(row, true)))),
      ]),
    ])
  },
})
</script>

<style scoped>
.sector-contrib-panel {
  min-width: 0;
}
.sector-contrib-title {
  font-size: 14px;
  margin: 0 0 6px;
}
.sector-contrib-state {
  color: #64748b;
  font-size: 12px;
  margin: 0;
  padding: 10px 0;
  text-align: center;
}
.sector-contrib-state--error {
  color: #b91c1c;
}
.sector-contrib-root-fold,
.sector-contrib-fold {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  min-width: 0;
  overflow: hidden;
}
.sector-contrib-root-summary,
.sector-contrib-fold-summary {
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  color: #334155;
  cursor: pointer;
  display: block;
  font-weight: 600;
  list-style: none;
  user-select: none;
}
.sector-contrib-root-summary {
  background: #f1f5f9;
  font-size: 13px;
  padding: 10px 12px;
}
.sector-contrib-fold-summary {
  font-size: 12px;
  padding: 8px 12px;
}
.sector-contrib-root-summary::-webkit-details-marker,
.sector-contrib-fold-summary::-webkit-details-marker {
  display: none;
}
.sector-contrib-root-summary::marker,
.sector-contrib-fold-summary::marker {
  content: '';
}
.sector-contrib-root-fold:not([open]) .sector-contrib-root-summary,
.sector-contrib-fold:not([open]) .sector-contrib-fold-summary {
  border-bottom: none;
}
.sector-contrib-summary-title {
  font-size: 14px;
}
.sector-contrib-root-hint {
  color: #64748b;
  display: block;
  font-size: 11px;
  font-weight: 400;
  margin-top: 4px;
}
.sector-contrib-summary-hint {
  color: #64748b;
  font-size: 11px;
  font-weight: 400;
  margin-left: 6px;
}
.sector-contrib-root-body {
  min-width: 0;
  padding: 10px 12px 12px;
}
.sector-contrib-description,
.sector-contrib-intro {
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
  margin: 0 0 10px;
}
.sector-contrib-section-stack,
.sector-contrib-leader-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.sector-contrib-leader-stack {
  padding: 10px 12px 12px;
}
.sector-contrib-leader-block,
.sector-contrib-ma-block {
  min-width: 0;
}
.sector-contrib-block-title {
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  margin: 0 0 6px;
}
.sector-contrib-block-hint {
  color: #64748b;
  font-size: 11px;
  line-height: 1.35;
  margin: -2px 0 6px;
}
.sector-contrib-ma-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: 1fr 1fr;
  padding: 10px 12px 12px;
}
.sector-contrib-table-scroll,
:deep(.sector-contrib-table-scroll) {
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.sector-contrib-table,
:deep(.sector-contrib-table) {
  border-collapse: collapse;
  margin-top: 0;
  width: 100%;
}
.sector-contrib-table--leader,
:deep(.sector-contrib-table--leader) {
  min-width: 500px;
}
.sector-contrib-table--ma,
:deep(.sector-contrib-table--ma) {
  min-width: 600px;
}
.sector-contrib-table th,
.sector-contrib-table td,
:deep(.sector-contrib-table th),
:deep(.sector-contrib-table td) {
  border: 1px solid #e2e8f0;
  font-size: 12px;
  padding: 5px 6px;
  text-align: center;
  white-space: nowrap;
}
.sector-contrib-table--leader th,
.sector-contrib-table--leader td,
:deep(.sector-contrib-table--leader th),
:deep(.sector-contrib-table--leader td) {
  font-size: 11px;
  padding: 4px 6px;
}
.sector-contrib-table th,
:deep(.sector-contrib-table th) {
  background: #f1f5f9;
}
.sector-contrib-table td:nth-child(2),
:deep(.sector-contrib-table td:nth-child(2)) {
  max-width: 9em;
  white-space: normal;
}
.sector-contrib-table tbody tr,
:deep(.sector-contrib-table tbody tr) {
  cursor: default;
}
.sector-contrib-table tbody tr:hover,
:deep(.sector-contrib-table tbody tr:hover) {
  background: #fff;
}
.sector-contrib-link-cell,
:deep(.sector-contrib-link-cell) {
  min-width: 70px;
}
.sector-contrib-link-cell--empty,
:deep(.sector-contrib-link-cell--empty) {
  color: #94a3b8;
}
.sector-contrib-link-muted,
:deep(.sector-contrib-link-muted) {
  color: #94a3b8;
  font-size: 11px;
  white-space: nowrap;
}
.sector-contrib-link-btn,
:deep(.sector-contrib-link-btn) {
  background: #fff7ed;
  border: 1px solid #fdba74;
  border-radius: 999px;
  color: #c2410c;
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
  padding: 3px 7px;
  white-space: nowrap;
}
.sector-contrib-link-btn:hover,
:deep(.sector-contrib-link-btn:hover) {
  background: #ffedd5;
  border-color: #fb923c;
}
@media (max-width: 900px) {
  .sector-contrib-ma-grid {
    grid-template-columns: 1fr;
  }
}
</style>
