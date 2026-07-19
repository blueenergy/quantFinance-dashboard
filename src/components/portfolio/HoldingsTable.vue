<template>
  <p v-if="holdingsRisk?.reviewed_count" class="muted holdings-risk-summary">
    持仓风控：高 {{ holdingsRisk.high }} · 中 {{ holdingsRisk.medium }} · 低 {{ holdingsRisk.low }}
    <span v-if="holdingsRisk.checked_at"> · 更新 {{ formatRiskTime(holdingsRisk.checked_at) }}</span>
  </p>
  <div v-if="!latestHoldingRows.length" class="muted">暂无当前持仓。</div>
  <div v-else class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>代码</th>
          <th>名称</th>
          <th>买入日</th>
          <th>当前</th>
          <th>目标</th>
          <th>变动</th>
          <th>均价</th>
          <th>现价</th>
          <th>市值</th>
          <th>盈亏</th>
          <th>今日盈亏</th>
          <th>快思考</th>
          <th>明细</th>
          <th>风控</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="row in latestHoldingRows" :key="row.symbol">
          <tr :class="riskRowClass(row.symbol)">
            <td>
              <AppLink
                v-if="row.symbol"
                tab="stock-workbench"
                :params="{ symbol: row.symbol }"
                class="stock-workbench-link"
              >
                {{ row.symbol }}
              </AppLink>
              <span v-else>-</span>
            </td>
            <td>{{ row.name || '-' }}</td>
            <td>{{ row.buy_date || '-' }}</td>
            <td>{{ row.shares }}</td>
            <td>
              <input
                :value="effectiveTarget(row.symbol)"
                type="number"
                min="0"
                step="100"
                class="target-input"
                @input="$emit('update-target', row.symbol, $event.target.value)"
              >
            </td>
            <td :class="signClass(manualDelta(row))">{{ formatShareDelta(manualDelta(row)) }}</td>
            <td>{{ num(row.avg_cost) }}</td>
            <td :title="holdingPriceTitle(row)">{{ num(row.last_price) }}</td>
            <td>{{ money(row.market_value) }}</td>
            <td :class="signClass(holdingTotalPnl(row))" :title="holdingPnlTitle(row)">
              {{ signedMoney(holdingTotalPnl(row)) }}
            </td>
            <td :class="signClass(row.day_pnl)" :title="holdingDayPnlTitle(row)">
              {{ signedMoney(row.day_pnl) }}
            </td>
            <td class="fast-actions">
              <button type="button" class="fast-btn fast-btn-swap" @click="$emit('open-swap', row)">换股</button>
              <button type="button" class="fast-btn fast-btn-reduce" @click="$emit('quick-reduce', row, halfTargetShares(row))">减半</button>
              <button type="button" class="fast-btn fast-btn-clear" @click="$emit('quick-reduce', row, 0)">清仓</button>
            </td>
            <td class="detail-toggle-cell">
              <button
                v-if="symbolTrades(row.symbol).length"
                type="button"
                class="detail-toggle"
                :aria-expanded="isExpanded(row.symbol)"
                @click="toggleDetail(row.symbol)"
              >
                {{ isExpanded(row.symbol) ? '收起' : `展开(${symbolTrades(row.symbol).length})` }}
              </button>
              <span v-else class="muted">-</span>
            </td>
            <td>
              <div class="risk-tags">
                <span
                  v-if="holdingRowRisk(row)"
                  class="risk-badge"
                  :class="`risk-${riskDisplaySeverity(holdingRowRisk(row))}`"
                  :title="aiRiskTitle(holdingRowRisk(row))"
                >
                  {{ riskSeverityLabel(riskDisplaySeverity(holdingRowRisk(row))) }}
                </span>
                <span v-else class="muted">-</span>
                <span
                  v-if="holdingRowRisk(row)?.llm"
                  class="llm-risk-tag llm-risk-tag--btn"
                  :class="[`risk-${holdingRowRisk(row).llm.severity || 'none'}`, { 'is-active': llmDetailKey === llmKey('holding', row) }]"
                  title="点击查看/放大完整风险分析"
                  role="button"
                  tabindex="0"
                  @click.stop="openLlm(holdingRowRisk(row), row, 'holding', $event)"
                  @keydown.enter.stop="openLlm(holdingRowRisk(row), row, 'holding', $event)"
                >风险</span>
                <span
                  v-if="holdingRowOpportunity(row)?.llm"
                  class="llm-risk-tag llm-risk-tag--btn llm-opportunity-tag"
                  :class="[`opportunity-${holdingRowOpportunity(row).llm.strength || 'none'}`, { 'is-active': llmDetailKey === llmKey('holding-opp', row) }]"
                  title="点击查看/放大完整 LLM 机会"
                  role="button"
                  tabindex="0"
                  @click.stop="openLlm(holdingRowOpportunity(row), row, 'holding-opp', $event, 'opportunity')"
                  @keydown.enter.stop="openLlm(holdingRowOpportunity(row), row, 'holding-opp', $event, 'opportunity')"
                >机会</span>
                <AppLink
                  v-for="finding in internalSwotFindings(row, 'strength')"
                  :key="`holding-strength-${finding.finding_key}`"
                  class="internal-swot-tag internal-swot-tag--strength"
                  :href="internalSwotHref(row.symbol, 'strength', finding.finding_key)"
                  :title="finding.summary || finding.finding_key"
                  @click.stop
                >优势</AppLink>
                <AppLink
                  v-for="finding in internalSwotFindings(row, 'weakness')"
                  :key="`holding-weakness-${finding.finding_key}`"
                  class="internal-swot-tag internal-swot-tag--weakness"
                  :href="internalSwotHref(row.symbol, 'weakness', finding.finding_key)"
                  :title="finding.summary || finding.finding_key"
                  @click.stop
                >劣势</AppLink>
              </div>
            </td>
          </tr>
          <tr v-if="isExpanded(row.symbol)" class="detail-row">
            <td :colspan="14">
              <div class="detail-wrap">
                <table class="detail-table">
                  <thead>
                    <tr>
                      <th>调仓日</th>
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
                      v-for="(trade, tIdx) in symbolTrades(row.symbol)"
                      :key="`${trade.trade_id || trade.buy_order_id || trade.symbol}-${tIdx}`"
                      :class="{ 'open-trade': trade.status === 'open' }"
                    >
                      <td>{{ trade.rebalance_date || '-' }}</td>
                      <td>{{ trade.buy_date || '-' }}</td>
                      <td>{{ num(trade.buy_price) }}</td>
                      <td>{{ trade.sell_date || '-' }}</td>
                      <td>
                        <span v-if="trade.status === 'open'" class="badge-open">持有中</span>
                        <span v-else>{{ num(trade.sell_price) }}</span>
                      </td>
                      <td>{{ money(trade.quantity) }}</td>
                      <td>{{ money(trade.buy_amount) }}</td>
                      <td :class="signClass(trade.holding_return)">{{ pct(trade.holding_return) }}</td>
                      <td :class="signClass(trade.net_pnl)">{{ signedMoney(trade.net_pnl) }}</td>
                      <td>{{ money(trade.fee) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </td>
          </tr>
        </template>
      </tbody>
      <tfoot>
        <tr class="holdings-total-row">
          <td colspan="8">合计</td>
          <td>{{ money(holdingsTotals.marketValue) }}</td>
          <td :class="signClass(holdingsTotals.totalPnl)">{{ signedMoney(holdingsTotals.totalPnl) }}</td>
          <td :class="signClass(holdingsTotals.dayPnl)">{{ signedMoney(holdingsTotals.hasDayPnl ? holdingsTotals.dayPnl : null) }}</td>
          <td colspan="3"></td>
        </tr>
      </tfoot>
    </table>
    <p v-if="holdingsRiskBySymbolHigh.length" class="muted">
      高风险提示：
      <span
        v-for="item in holdingsRiskBySymbolHigh"
        :key="item.symbol"
        :title="aiRiskTitle(item.ai_risk)"
      >
        {{ item.symbol }}（{{ item.ai_risk?.reasons?.join('、') || '风险' }}）
      </span>
    </p>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import AppLink from '../common/AppLink.vue'
import { buildDeepLinkHref } from '../../utils/appDeepLinks.js'
import {
  aiRiskTitle,
  formatShareDelta,
  money,
  num,
  pct,
  pctSigned,
  riskDisplaySeverity,
  riskSeverityLabel,
  signClass,
} from '../../composables/usePortfolioPlanFormat'

const props = defineProps({
  latestHoldingRows: { type: Array, default: () => [] },
  tradesBySymbol: { type: Object, default: () => ({}) },
  holdingsRisk: { type: Object, default: null },
  holdingsRiskBySymbol: { type: Object, default: () => ({}) },
  holdingPlanRiskBySymbol: { type: Object, default: () => ({}) },
  holdingPlanOpportunityBySymbol: { type: Object, default: () => ({}) },
  holdingPlanInternalSwotBySymbol: { type: Object, default: () => ({}) },
  holdingsRiskBySymbolHigh: { type: Array, default: () => [] },
  llmDetailKey: { type: String, default: '' },
  effectiveTarget: { type: Function, required: true },
  manualDelta: { type: Function, required: true },
  riskRowClass: { type: Function, required: true },
  formatRiskTime: { type: Function, required: true },
  halfTargetShares: { type: Function, required: true },
  signedMoney: { type: Function, required: true },
})

const emit = defineEmits(['update-target', 'open-swap', 'quick-reduce', 'open-llm'])
const expandedSymbols = ref(new Set())

function llmKey(scope, row) {
  return `${scope}:${row?.symbol || row?.name || 'unknown'}`
}

function openLlm(payload, row, scope, event, mode = 'risk') {
  emit('open-llm', { payload, row, scope, event, mode })
}

function symbolRisk(map, symbol) {
  const text = String(symbol || '')
  return map?.[text] || map?.[text.split('.')[0]] || null
}

function mergeRisk(primary, secondary) {
  const merged = { ...(secondary || {}), ...(primary || {}) }
  if (primary?.llm || secondary?.llm) merged.llm = primary?.llm || secondary?.llm
  return Object.keys(merged).length ? merged : null
}

function holdingRowRisk(row) {
  return mergeRisk(
    symbolRisk(props.holdingsRiskBySymbol, row?.symbol),
    symbolRisk(props.holdingPlanRiskBySymbol, row?.symbol),
  )
}

function holdingRowOpportunity(row) {
  return symbolRisk(props.holdingPlanOpportunityBySymbol, row?.symbol) || row?.ai_opportunity || null
}

function holdingInternalSwot(row) {
  return symbolRisk(props.holdingPlanInternalSwotBySymbol, row?.symbol) || row?.internal_swot || null
}

function internalSwotFindings(row, dimension) {
  const findings = holdingInternalSwot(row)?.[dimension]?.findings
  return Array.isArray(findings) ? findings : []
}

function internalSwotHref(symbol, dimension, findingKey) {
  return buildDeepLinkHref('stock-workbench', { symbol, panel: 'swot', dimension, findingKey })
}

function numericOrZero(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function holdingTotalPnl(row) {
  return numericOrZero(row?.realized_pnl) + numericOrZero(row?.unrealized_pnl)
}

function holdingPnlTitle(row) {
  return [
    `已实现：${props.signedMoney(numericOrZero(row?.realized_pnl))}`,
    `浮动：${props.signedMoney(numericOrZero(row?.unrealized_pnl))}`,
    `合计：${props.signedMoney(holdingTotalPnl(row))}`,
  ].join('\n')
}

function sourceLabel(source) {
  const labels = {
    realtime: '实时',
    daily_close: '日线收盘',
    paper_mark: '纸面快照',
    market: '行情',
    avg_cost: '成本价',
  }
  return labels[source] || source || '-'
}

function holdingPriceTitle(row) {
  return [
    `现价：${num(row?.last_price)}`,
    `昨收：${num(row?.previous_close)}`,
    `来源：${sourceLabel(row?.price_source || row?.last_price_source)}`,
    `更新：${row?.price_as_of || row?.realtime_doc?.updated_at || row?.realtime_doc?.realtime_trade_time || '-'}`,
  ].join('\n')
}

function holdingDayPnlTitle(row) {
  return [
    `今日盈亏：${props.signedMoney(row?.day_pnl)}`,
    `单股涨跌：${props.signedMoney(row?.day_change)}`,
    `涨跌幅：${pctSigned(row?.day_change_pct)}`,
    `昨收：${num(row?.previous_close)}`,
  ].join('\n')
}

const holdingsTotals = computed(() => (
  props.latestHoldingRows.reduce((acc, row) => {
    acc.marketValue += numericOrZero(row?.market_value)
    acc.totalPnl += holdingTotalPnl(row)
    const dayPnl = Number(row?.day_pnl)
    if (Number.isFinite(dayPnl)) {
      acc.dayPnl += dayPnl
      acc.hasDayPnl = true
    }
    return acc
  }, { marketValue: 0, totalPnl: 0, dayPnl: 0, hasDayPnl: false })
))

function symbolTrades(symbol) {
  return props.tradesBySymbol[symbol] || []
}

function isExpanded(symbol) {
  return expandedSymbols.value.has(symbol)
}

function toggleDetail(symbol) {
  const next = new Set(expandedSymbols.value)
  if (next.has(symbol)) next.delete(symbol)
  else next.add(symbol)
  expandedSymbols.value = next
}
</script>

<style scoped>
.muted {
  color: #374151;
  font-size: 13px;
  margin: 0;
}

.holdings-risk-summary {
  margin-bottom: 8px;
}

.table-wrap {
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  overflow-x: auto;
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
  font-size: 13px;
  font-weight: 600;
}

tbody tr:hover td {
  background: #f9fafb;
}

tfoot td {
  background: #f8fafc;
  font-weight: 700;
}

.holdings-total-row td {
  border-bottom: 0;
}

.target-input {
  max-width: 88px;
  width: 88px;
}

.risk-badge {
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
}

.risk-badge.risk-high { background: #fee2e2; color: #dc2626; }
.risk-badge.risk-medium { background: #ffedd5; color: #c2410c; }
.risk-badge.risk-low { background: #fef9c3; color: #a16207; }
.risk-badge.risk-none { background: #ecfdf5; color: #047857; }

.risk-tags {
  align-items: center;
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}

.llm-risk-tag {
  background: #eef2ff;
  border: 1px solid #818cf8;
  border-radius: 999px;
  color: #3730a3;
  cursor: pointer;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
  padding: 1px 5px;
}

.llm-risk-tag:hover { filter: brightness(0.97); }
.llm-risk-tag.is-active { box-shadow: 0 0 0 2px #6366f1; }
.llm-risk-tag.risk-high { background: #fee2e2; border-color: #f87171; color: #b91c1c; }
.llm-risk-tag.risk-medium { background: #ffedd5; border-color: #fb923c; color: #c2410c; }
.llm-risk-tag.risk-low { background: #fef9c3; border-color: #facc15; color: #854d0e; }
.llm-risk-tag.risk-none { background: #ecfdf5; border-color: #34d399; color: #047857; }
.llm-risk-tag.opportunity-high { background: #dcfce7; border-color: #22c55e; color: #15803d; }
.llm-risk-tag.opportunity-medium { background: #e0f2fe; border-color: #38bdf8; color: #0369a1; }
.llm-risk-tag.opportunity-low { background: #ecfccb; border-color: #84cc16; color: #4d7c0f; }
.llm-risk-tag.opportunity-none { background: #f1f5f9; border-color: #cbd5e1; color: #64748b; }

.internal-swot-tag {
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  display: inline-flex;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  padding: 4px 8px;
  text-decoration: none;
}

.internal-swot-tag--strength { background: #eef2ff; border-color: #818cf8; color: #4338ca; }
.internal-swot-tag--weakness { background: #fff7ed; border-color: #fdba74; color: #c2410c; }
.risk-row-high { background: #fff7f7; }
.detail-toggle-cell, .fast-actions { white-space: nowrap; }

.detail-toggle {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  color: #1d4ed8;
  cursor: pointer;
  font-size: 12px;
  padding: 3px 10px;
}

.detail-toggle:hover { background: #e5e7eb; }
.detail-row td { background: #f9fafb; padding: 0; }
.detail-wrap { overflow-x: auto; padding: 8px 12px 12px; }

.detail-table {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 12px;
  width: 100%;
}

.detail-table th,
.detail-table td { padding: 6px 10px; }
.detail-table .open-trade td { background: #f8fafc; }

.badge-open {
  background: #eff6ff;
  border: 1px solid #93c5fd;
  border-radius: 4px;
  color: #1d4ed8;
  font-size: 12px;
  padding: 1px 6px;
  white-space: nowrap;
}

.stock-workbench-link {
  background: transparent;
  border: 0;
  color: #1d4ed8;
  cursor: pointer;
  font-weight: 600;
  padding: 0;
  text-decoration: none;
}

.stock-workbench-link:hover { text-decoration: underline; }

button {
  background: #fff;
  border: 1px solid #111827;
  border-radius: 4px;
  color: #111827;
  cursor: pointer;
  font-weight: 500;
  padding: 8px 10px;
}

.fast-btn {
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  display: inline-block;
  font-size: 12px;
  line-height: 1.4;
  margin: 2px 4px 2px 0;
  padding: 3px 10px;
  transition: background 0.15s, border-color 0.15s;
}

.fast-btn-swap { background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; }
.fast-btn-swap:hover { background: #dbeafe; border-color: #93c5fd; }
.fast-btn-reduce { background: #fff7ed; border-color: #fcd9a8; color: #b45309; }
.fast-btn-reduce:hover { background: #ffedd5; border-color: #fbbf24; }
.fast-btn-clear { background: #fef2f2; border-color: #fca5a5; color: #b91c1c; }
.fast-btn-clear:hover { background: #fee2e2; border-color: #f87171; }
.pos { color: #dc2626; }
.neg { color: #16a34a; }
</style>
