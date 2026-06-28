<template>
  <section>
    <div class="exec-header">
      <button
        type="button"
        class="exec-toggle"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        <span class="exec-caret">{{ expanded ? '▼' : '▶' }}</span>
        <h3>{{ isLive ? '已平仓成交历史' : '纸面已平仓成交历史' }}</h3>
      </button>
      <span class="exec-summary muted">
        已平 {{ displayTotals.closedCount }} 笔 ·
        净盈亏
        <span :class="signClass(displayTotals.netPnl)">{{ signedMoney(displayTotals.netPnl) }}</span>
      </span>
    </div>
    <template v-if="expanded">
    <label class="exec-filter">
      <input v-model="showAll" type="checkbox">
      显示全部成交明细（含持有中）
    </label>
    <div v-if="!displayRows.length" class="muted">{{ showAll ? '暂无成交记录。' : '暂无已平仓成交记录。' }}</div>
    <div v-else class="table-wrap compact">
      <table>
        <thead>
          <tr>
            <th>调仓日</th>
            <th>代码</th>
            <th>名称</th>
            <th>买入日</th>
            <th>买价</th>
            <th>卖出日</th>
            <th>卖价</th>
            <th>数量</th>
            <th>买入额</th>
            <th>持有收益</th>
            <th>净盈亏</th>
            <th>费用</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, idx) in displayRows"
            :key="`${row.trade_id || row.buy_order_id || row.symbol}-${idx}`"
            :class="{ 'open-trade': row.status === 'open' }"
          >
            <td>{{ row.rebalance_date || '-' }}</td>
            <td>{{ row.symbol || '-' }}</td>
            <td>{{ row.name || '-' }}</td>
            <td>{{ row.buy_date || '-' }}</td>
            <td>{{ num(row.buy_price) }}</td>
            <td>{{ row.sell_date || '-' }}</td>
            <td>
              <span v-if="row.status === 'open'" class="badge-open">持有中</span>
              <span v-else>{{ num(row.sell_price) }}</span>
            </td>
            <td>{{ money(row.quantity) }}</td>
            <td>{{ money(row.buy_amount) }}</td>
            <td :class="signClass(row.holding_return)">{{ pct(row.holding_return) }}</td>
            <td :class="signClass(row.net_pnl)">{{ signedMoney(row.net_pnl) }}</td>
            <td>{{ money(row.fee) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="totals-row">
            <td colspan="8">合计（{{ displayTotals.count }} 笔 · 已平 {{ displayTotals.closedCount }} / 持有 {{ displayTotals.openCount }}）</td>
            <td>{{ money(displayTotals.buyAmount) }}</td>
            <td></td>
            <td :class="signClass(displayTotals.netPnl)">{{ signedMoney(displayTotals.netPnl) }}</td>
            <td>{{ money(displayTotals.fee) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <p v-if="displayRows.length" class="muted combo-note">
      成交明细按 <strong>FIFO（先进先出）</strong> 将每笔卖出与对应买入批次配对，一行为一段往返；未平仓部分以“持有中”行按最新价估算浮动盈亏。
      <template v-if="isLive">
        上方汇总卡片的「已实现盈亏」按<strong>加权平均成本法</strong>计算，与本表净盈亏合计在分批建仓/部分卖出时口径不同，全部平仓后两者一致。
      </template>
      <template v-else>
        纸面成交来自各调仓日开盘价模拟执行（portfolio_paper_executions），不含佣金。
      </template>
    </p>
    </template>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { money, num, signClass } from '../../composables/usePortfolioPlanFormat'

const props = defineProps({
  rows: { type: Array, default: () => [] },
  totals: { type: Object, default: () => ({ count: 0, closedCount: 0, openCount: 0, buyAmount: 0, netPnl: 0, fee: 0 }) },
  isLive: { type: Boolean, default: false },
})

const expanded = ref(false)
const showAll = ref(false)

const displayRows = computed(() =>
  showAll.value ? props.rows : props.rows.filter((row) => row.status !== 'open'),
)

const displayTotals = computed(() => {
  let netPnl = 0
  let fee = 0
  let buyAmount = 0
  let closedCount = 0
  let openCount = 0
  for (const row of displayRows.value) {
    const pnl = Number(row.net_pnl)
    if (Number.isFinite(pnl)) netPnl += pnl
    const f = Number(row.fee)
    if (Number.isFinite(f)) fee += f
    const amt = Number(row.buy_amount)
    if (Number.isFinite(amt)) buyAmount += amt
    if (row.status === 'open') openCount += 1
    else closedCount += 1
  }
  return { count: displayRows.value.length, closedCount, openCount, netPnl, fee, buyAmount }
})

function pct(value) {
  const number = Number(value)
  return Number.isFinite(number) ? `${(number * 100).toFixed(2)}%` : '-'
}

function signedMoney(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  const formatted = Math.abs(number).toLocaleString('zh-CN', { maximumFractionDigits: 0 })
  return `${number >= 0 ? '+' : '-'}${formatted}`
}
</script>

<style scoped>
section h3 {
  color: #111827;
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}

.exec-header {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 20px 0 8px;
}

.exec-toggle {
  align-items: center;
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  gap: 8px;
  padding: 0;
}

.exec-caret {
  color: #6b7280;
  font-size: 11px;
}

.exec-summary {
  font-size: 13px;
}

.exec-filter {
  align-items: center;
  color: #374151;
  cursor: pointer;
  display: inline-flex;
  font-size: 13px;
  gap: 6px;
  margin: 0 0 8px;
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

.open-trade td {
  background: #f8fafc;
}

.badge-open {
  background: #eff6ff;
  border: 1px solid #93c5fd;
  border-radius: 4px;
  color: #1d4ed8;
  font-size: 12px;
  padding: 1px 6px;
  white-space: nowrap;
}

.totals-row td {
  background: #f3f4f6;
  border-top: 2px solid #d1d5db;
  font-weight: 700;
}

.combo-note {
  margin-top: 8px;
}

.positive {
  color: #dc2626;
}

.negative {
  color: #16a34a;
}

.pos {
  color: #dc2626;
}

.neg {
  color: #16a34a;
}
</style>
