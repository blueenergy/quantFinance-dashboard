<template>
  <section>
    <h4>Paper 成交</h4>
    <p v-if="!executions.length" class="muted">暂无 paper 成交。</p>
    <div v-else class="table-wrap">
      <table>
        <thead><tr><th class="col-date">日期</th><th class="col-symbol">代码</th><th class="col-name">名称</th><th>动作</th><th>数量</th><th>买入价格</th><th>当前价格</th><th>涨跌幅</th><th>金额</th><th>阻塞原因</th></tr></thead>
        <tbody>
          <tr v-for="execution in executions" :key="execution.execution_id">
            <td class="col-date">{{ execution.execute_date || '-' }}</td><td class="col-symbol">{{ execution.symbol || '-' }}</td>
            <td class="col-name">{{ execution.name || '-' }}</td><td>{{ execution.action || '-' }}</td><td>{{ execution.quantity ?? 0 }}</td>
            <td>{{ num(execution.price) }}</td><td>{{ num(currentPrice(execution)) }}</td><td>{{ returnPct(execution) }}</td>
            <td>{{ money(execution.amount) }}</td><td>{{ execution.blocker || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { money, num, signedPct } from '../../composables/usePortfolioPlanFormat'

const props = defineProps({
  executions: { type: Array, default: () => [] },
  realtimePrices: { type: Object, default: () => ({}) },
})

function currentPrice(execution) {
  return props.realtimePrices[execution?.symbol]
}

function returnPct(execution) {
  const entry = Number(execution?.price)
  const current = Number(currentPrice(execution))
  if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(current)) return '-'
  return signedPct(current / entry - 1)
}
</script>
