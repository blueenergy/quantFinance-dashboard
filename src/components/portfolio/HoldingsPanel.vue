<template>
  <section class="holdings-section">
    <div class="holdings-header">
      <h3>最新持仓</h3>
      <div class="holdings-actions">
        <button type="button" :disabled="!selectedLatestPlanId || riskLoading" @click="$emit('load-risk')">
          {{ riskLoading ? '体检中…' : '风控体检' }}
        </button>
        <button type="button" :disabled="!manualChangeRows.length" @click="$emit('open-manual')">
          提交手动调仓
        </button>
        <button
          type="button"
          class="danger"
          :disabled="!latestHoldingRows.length || liquidateSubmitting"
          @click="$emit('open-liquidate')"
        >
          {{ isLivePortfolio ? '实盘一键清仓' : '纸面一键清仓' }}
        </button>
        <button
          v-if="isLivePortfolio"
          type="button"
          :disabled="externalManualSubmitting"
          @click="$emit('open-external-manual')"
        >
          {{ externalManualSubmitting ? '补录中…' : '补录 miniQMT 手工操作' }}
        </button>
      </div>
    </div>
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
            <td>{{ num(row.last_price) }}</td>
            <td>{{ money(row.market_value) }}</td>
            <td :class="signClass(holdingTotalPnl(row))" :title="holdingPnlTitle(row)">
              {{ signedMoney(holdingTotalPnl(row)) }}
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
                  class="llm-risk-tag"
                  :class="`risk-${holdingRowRisk(row).llm.severity || 'none'}`"
                  :title="llmRiskTitle(holdingRowRisk(row))"
                >LLM</span>
                <button
                  v-if="holdingRowRisk(row)?.llm"
                  type="button"
                  class="llm-risk-copy"
                  :title="llmCopyTitle(holdingRowRisk(row))"
                  @click.stop="copyLlmRisk(holdingRowRisk(row), row.symbol)"
                >
                  {{ copiedLlmRiskSymbol === row.symbol ? '已复制' : '复制' }}
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="isExpanded(row.symbol)" class="detail-row">
            <td :colspan="13">
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

    <section v-if="benchData" class="lineup-card bench-candidates-card">
      <div class="lineup-header">
        <div>
          <h3>替补候选</h3>
          <p class="muted lineup-hint">
            当前不在持仓中的策略候选，按算法评分排序。评分快照 {{ benchData.score_date || '-' }} ·
            替补池约 {{ benchData.bench_multiplier }}×Top{{ benchData.top_n }}。
          </p>
        </div>
        <button type="button" class="link-btn" @click="$emit('toggle-bench')">
          {{ benchExpanded ? '收起' : '展开' }}
        </button>
      </div>
      <div v-if="benchExpanded">
        <div v-if="benchLoading" class="muted">加载替补候选中…</div>
        <template v-else>
          <div class="bench-risk-bar">
            <span v-if="benchRisk" class="bench-risk-summary">
              AI风控：<b class="risk-high">{{ benchRisk.high || 0 }}高</b>
              / <b class="risk-medium">{{ benchRisk.medium || 0 }}中</b>
              / <b class="risk-low">{{ benchRisk.low || 0 }}低</b>
            </span>
            <span v-else class="muted">替补候选可先体检，高风险候选上场前会二次确认。</span>
            <button
              type="button"
              class="link-btn"
              :disabled="benchRiskLoading || !benchData.bench?.length"
              @click="$emit('load-bench-risk')"
            >
              {{ benchRiskLoading ? 'AI 风控运行中…' : '运行 AI 风控' }}
            </button>
            <button
              type="button"
              class="link-btn"
              :disabled="benchLlmRiskLoading || !benchData.bench?.length"
              @click="$emit('load-bench-llm-risk')"
            >
              {{ benchLlmRiskLoading ? 'LLM 风控运行中…' : '运行 LLM 风控' }}
            </button>
          </div>
          <div v-if="benchData.bench?.length" class="table-wrap">
            <table class="lineup-table">
              <thead>
                <tr>
                  <th>排名</th>
                  <th>代码</th>
                  <th>名称</th>
                  <th>行业</th>
                  <th>分数</th>
                  <th>最新收盘</th>
                  <th>AI风控</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in benchData.bench" :key="row.symbol">
                  <td>{{ row.rank }}</td>
                  <td>{{ row.symbol }}</td>
                  <td>{{ row.name || '-' }}</td>
                  <td>{{ row.industry || '-' }}</td>
                  <td>{{ num(row.score_value) }}</td>
                  <td class="bench-price-cell" :title="benchDailyTitle(row)">
                    <span>{{ num(row.latest_close) }}</span>
                    <small v-if="row.latest_trade_date">{{ formatBenchTradeDate(row.latest_trade_date) }}</small>
                    <small
                      v-if="row.latest_pct_chg != null"
                      :class="signClass(row.latest_pct_chg)"
                    >
                      {{ pctSigned(row.latest_pct_chg) }}
                    </small>
                  </td>
                  <td>
                    <div class="risk-tags">
                      <span
                        v-if="benchRowRisk(row)"
                        class="risk-badge"
                        :class="`risk-${riskDisplaySeverity(benchRowRisk(row))}`"
                        :title="aiRiskTitle(benchRowRisk(row))"
                      >
                        {{ riskSeverityLabel(riskDisplaySeverity(benchRowRisk(row))) }}
                      </span>
                      <span v-else class="muted">-</span>
                      <span
                        v-if="benchRowRisk(row)?.llm"
                        class="llm-risk-tag"
                        :class="`risk-${benchRowRisk(row).llm.severity || 'none'}`"
                        :title="llmRiskTitle(benchRowRisk(row))"
                      >LLM</span>
                      <button
                        v-if="benchRowRisk(row)?.llm"
                        type="button"
                        class="llm-risk-copy"
                        :title="llmCopyTitle(benchRowRisk(row))"
                        @click.stop="copyLlmRisk(benchRowRisk(row), row.symbol)"
                      >
                        {{ copiedLlmRiskSymbol === row.symbol ? '已复制' : '复制' }}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="muted">暂无替补候选。</p>
        </template>
      </div>
    </section>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import AppLink from '../common/AppLink.vue'
import {
  formatShareDelta,
  aiRiskTitle,
  llmRiskTitle,
  money,
  num,
  pctSigned,
  riskDisplaySeverity,
  riskSeverityLabel,
  signClass,
} from '../../composables/usePortfolioPlanFormat'
import { copyTextToClipboard } from '../../utils/clipboard'

const props = defineProps({
  selectedLatestPlanId: { type: String, default: '' },
  riskLoading: { type: Boolean, default: false },
  manualChangeRows: { type: Array, default: () => [] },
  latestHoldingRows: { type: Array, default: () => [] },
  tradesBySymbol: { type: Object, default: () => ({}) },
  liquidateSubmitting: { type: Boolean, default: false },
  isLivePortfolio: { type: Boolean, default: false },
  externalManualSubmitting: { type: Boolean, default: false },
  holdingsRisk: { type: Object, default: null },
  holdingsRiskBySymbol: { type: Object, default: () => ({}) },
  holdingPlanRiskBySymbol: { type: Object, default: () => ({}) },
  holdingsRiskBySymbolHigh: { type: Array, default: () => [] },
  benchData: { type: Object, default: null },
  benchExpanded: { type: Boolean, default: false },
  benchLoading: { type: Boolean, default: false },
  benchRisk: { type: Object, default: null },
  benchRiskBySymbol: { type: Object, default: () => ({}) },
  benchRiskLoading: { type: Boolean, default: false },
  benchLlmRiskLoading: { type: Boolean, default: false },
  effectiveTarget: { type: Function, required: true },
  manualDelta: { type: Function, required: true },
  riskRowClass: { type: Function, required: true },
  formatRiskTime: { type: Function, required: true },
  halfTargetShares: { type: Function, required: true },
  signedMoney: { type: Function, required: true },
})

const copiedLlmRiskSymbol = ref('')

function llmCopyTitle(risk) {
  return `${llmRiskTitle(risk)}\n\n点击复制完整 LLM 风控文本`
}

let copiedResetTimer = null
async function copyLlmRisk(risk, symbol) {
  const ok = await copyTextToClipboard(llmRiskTitle(risk))
  if (!ok) return
  copiedLlmRiskSymbol.value = symbol
  if (copiedResetTimer) clearTimeout(copiedResetTimer)
  copiedResetTimer = setTimeout(() => {
    if (copiedLlmRiskSymbol.value === symbol) copiedLlmRiskSymbol.value = ''
  }, 2000)
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
  const ruleRisk = symbolRisk(props.holdingsRiskBySymbol, row?.symbol)
  const planRisk = symbolRisk(props.holdingPlanRiskBySymbol, row?.symbol)
  return mergeRisk(ruleRisk, planRisk)
}

function benchRowRisk(row) {
  const rowRisk = row?.ai_risk || null
  const keyedRisk = symbolRisk(props.benchRiskBySymbol, row?.symbol)
  return mergeRisk(rowRisk, keyedRisk)
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

defineEmits([
  'load-risk',
  'open-manual',
  'open-liquidate',
  'open-external-manual',
  'update-target',
  'open-swap',
  'quick-reduce',
  'toggle-bench',
  'load-bench-risk',
  'load-bench-llm-risk',
])

const expandedSymbols = ref(new Set())

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

function pct(value) {
  const number = Number(value)
  return Number.isFinite(number) ? `${(number * 100).toFixed(2)}%` : '-'
}

function formatBenchTradeDate(value) {
  const text = String(value || '')
  if (text.length === 8) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
  return text || '-'
}

function benchDailyTitle(row) {
  const parts = [
    `${row.name || row.symbol || '-'} ${row.symbol || ''}`.trim(),
    `日期：${formatBenchTradeDate(row.latest_trade_date)}`,
    `开：${num(row.latest_open)}`,
    `高：${num(row.latest_high)}`,
    `低：${num(row.latest_low)}`,
    `收：${num(row.latest_close)}`,
    `昨收：${num(row.latest_pre_close)}`,
    `涨跌：${num(row.latest_change)}`,
    `涨跌幅：${pctSigned(row.latest_pct_chg)}`,
    `成交量：${money(row.latest_volume)}`,
    `成交额：${money(row.latest_amount)}`,
    `更新：${row.latest_update_time || '-'}`,
    `来源：${row.latest_price_source || '-'}`,
  ]
  return parts.join('\n')
}
</script>

<style scoped>
.holdings-section {
  margin-top: 8px;
}

.holdings-header {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 8px;
}

.holdings-header h3,
.lineup-header h3 {
  color: #111827;
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}

.holdings-actions {
  display: flex;
  gap: 8px;
}

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
  color: #111827;
  font-size: 13px;
  font-weight: 600;
}

tbody tr:hover td {
  background: #f9fafb;
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

.risk-badge.risk-high {
  background: #fee2e2;
  color: #dc2626;
}

.risk-badge.risk-medium {
  background: #ffedd5;
  color: #c2410c;
}

.risk-badge.risk-low {
  background: #fef9c3;
  color: #a16207;
}

.risk-badge.risk-none {
  background: #ecfdf5;
  color: #047857;
}

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
  cursor: help;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
  padding: 1px 5px;
}

.llm-risk-tag.risk-high {
  background: #fee2e2;
  border-color: #f87171;
  color: #b91c1c;
}

.llm-risk-tag.risk-medium {
  background: #ffedd5;
  border-color: #fb923c;
  color: #c2410c;
}

.llm-risk-tag.risk-low {
  background: #fef9c3;
  border-color: #facc15;
  color: #854d0e;
}

.llm-risk-tag.risk-none {
  background: #ecfdf5;
  border-color: #34d399;
  color: #047857;
}

.llm-risk-copy {
  background: #fff;
  border: 1px solid #c7d2fe;
  border-radius: 999px;
  color: #4338ca;
  cursor: pointer;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
  padding: 1px 5px;
}

.llm-risk-copy:hover {
  background: #eef2ff;
}

.risk-row-high {
  background: #fff7f7;
}

.detail-toggle-cell {
  white-space: nowrap;
}

.detail-toggle {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  color: #1d4ed8;
  cursor: pointer;
  font-size: 12px;
  padding: 3px 10px;
}

.detail-toggle:hover {
  background: #e5e7eb;
}

.detail-row td {
  background: #f9fafb;
  padding: 0;
}

.detail-wrap {
  overflow-x: auto;
  padding: 8px 12px 12px;
}

.detail-table {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 12px;
  width: 100%;
}

.detail-table th,
.detail-table td {
  padding: 6px 10px;
}

.detail-table .open-trade td {
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

.stock-workbench-link {
  background: transparent;
  border: 0;
  color: #1d4ed8;
  cursor: pointer;
  font-weight: 600;
  padding: 0;
  text-decoration: none;
}

.stock-workbench-link:hover {
  text-decoration: underline;
}

.lineup-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  margin-top: 16px;
  padding: 16px;
}

.lineup-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.lineup-hint {
  margin: 6px 0 0;
}

.bench-risk-bar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: space-between;
  margin: 8px 0;
}

.bench-risk-summary {
  font-size: 12px;
}

.bench-risk-summary .risk-high {
  color: #dc2626;
}

.bench-risk-summary .risk-medium {
  color: #c2410c;
}

.bench-risk-summary .risk-low {
  color: #a16207;
}

.lineup-table {
  width: 100%;
}

.bench-price-cell small {
  color: #64748b;
  display: block;
  font-size: 11px;
  line-height: 1.3;
}

.bench-price-cell small.pos {
  color: #dc2626;
}

.bench-price-cell small.neg {
  color: #16a34a;
}

.fast-actions {
  white-space: nowrap;
}

.fast-actions .fast-btn {
  background: #fff;
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

.fast-btn-swap {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}

.fast-btn-swap:hover {
  background: #dbeafe;
  border-color: #93c5fd;
}

.fast-btn-reduce {
  background: #fff7ed;
  border-color: #fcd9a8;
  color: #b45309;
}

.fast-btn-reduce:hover {
  background: #ffedd5;
  border-color: #fbbf24;
}

.fast-btn-clear {
  background: #fef2f2;
  border-color: #fca5a5;
  color: #b91c1c;
}

.fast-btn-clear:hover {
  background: #fee2e2;
  border-color: #f87171;
}

button {
  background: #fff;
  border: 1px solid #111827;
  border-radius: 4px;
  color: #111827;
  cursor: pointer;
  font-weight: 500;
  padding: 8px 10px;
}

button.danger {
  background: #dc2626;
  border-color: #dc2626;
  color: #fff;
}

button:disabled {
  border-color: #9ca3af;
  color: #6b7280;
  cursor: not-allowed;
  opacity: 1;
}

.link-btn {
  background: none;
  border: none;
  color: #c2410c;
  cursor: pointer;
  padding: 0;
}

.pos {
  color: #dc2626;
}

.neg {
  color: #16a34a;
}
</style>
