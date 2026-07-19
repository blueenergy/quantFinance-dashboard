<template>
  <section>
    <h4>{{ live ? '实盘资金曲线' : '组合血缘 Paper 净值' }}</h4>
    <div v-if="realtimeEquity" class="realtime-equity">
      <div><span>{{ live ? '实盘实时估算权益' : '实时估算权益' }}</span><strong>{{ money(realtimeEquity.equity) }}</strong></div>
      <div><span>较最新落库净值</span><strong>{{ signedMoney(realtimeEquity.change) }} / {{ signedPct(realtimeEquity.change_pct) }}</strong></div>
      <div><span>实时市值</span><strong>{{ money(realtimeEquity.market_value) }}</strong></div>
      <div><span>现金</span><strong>{{ money(realtimeEquity.cash) }}</strong></div>
      <div><span>更新时间</span><strong>{{ realtimeEquity.latest_update || '-' }}</strong></div>
    </div>
    <p v-if="!rows.length" class="muted">{{ live ? '暂无实盘资金曲线，盘后任务落库后显示。' : '暂无组合血缘 paper 净值。' }}</p>
    <template v-else>
      <div class="equity-summary">
        <div><span>最新权益</span><strong>{{ money(rows[rows.length - 1]?.equity) }}</strong></div>
        <div><span>累计收益</span><strong>{{ signedPct(chart.latestReturn) }}</strong></div>
        <div><span>最近变化</span><strong>{{ signedMoney(rows[rows.length - 1]?.change) }}</strong></div>
      </div>
      <div class="equity-chart" :aria-label="live ? 'Live equity curve' : 'Paper equity curve'">
        <svg viewBox="0 0 640 220" role="img">
          <line x1="28" y1="28" x2="28" y2="192" /><line x1="28" y1="192" x2="612" y2="192" />
          <polyline :points="chart.points" />
          <circle v-for="point in chart.points.split(' ')" :key="point" :cx="point.split(',')[0]" :cy="point.split(',')[1]" r="3" />
          <text x="36" y="22">{{ money(chart.max) }}</text><text x="36" y="186">{{ money(chart.min) }}</text>
          <text v-for="label in chart.labels" :key="label.text" :x="label.x" :y="label.y" :text-anchor="label.anchor">{{ label.text }}</text>
        </svg>
      </div>
      <div class="table-wrap compact">
        <table>
          <thead><tr><th>日期</th><th v-if="!live">来源 plan</th><th>权益</th><th>日变化</th><th>日变化率</th><th>现金</th><th>市值</th></tr></thead>
          <tbody>
            <tr v-for="point in rows.slice().reverse()" :key="point.date">
              <td>{{ point.date }}</td>
              <td v-if="!live" class="truncate" :title="point.plan_id || '-'">{{ shortPlanId(point.plan_id) }}</td>
              <td>{{ money(point.equity) }}</td><td>{{ signedMoney(point.change) }}</td><td>{{ signedPct(point.changePct) }}</td>
              <td>{{ money(point.cash) }}</td><td>{{ money(point.market_value) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<script setup>
import { money, shortPlanId, signedMoney, signedPct } from '../../composables/usePortfolioPlanFormat'

defineProps({
  live: { type: Boolean, default: false },
  realtimeEquity: { type: Object, default: null },
  rows: { type: Array, default: () => [] },
  chart: { type: Object, required: true },
})
</script>
