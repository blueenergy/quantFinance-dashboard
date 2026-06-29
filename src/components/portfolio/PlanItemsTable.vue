<template>
  <div class="table-wrap" :class="{ compact: compact }">
    <table v-if="mode === 'reprice'" class="plan-items-table">
      <thead>
        <tr>
          <th class="col-stock">标的</th>
          <th>计划价→新价</th>
          <th>目标股数</th>
          <th>Δ股数</th>
          <th>价格来源</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in items" :key="row.symbol">
          <td>{{ row.symbol }}</td>
          <td>{{ num(row.old_estimated_price) }} → {{ num(row.new_estimated_price) }}</td>
          <td>{{ row.old_target_shares ?? 0 }} → {{ row.new_target_shares ?? 0 }}</td>
          <td>{{ row.old_delta_shares ?? 0 }} → {{ row.new_delta_shares ?? 0 }}</td>
          <td>
            <span :class="priceSourceClass(row.price_source)">{{ priceSourceLabel(row.price_source) }}</span>
            <small v-if="row.price_as_of">{{ formatPriceAsOf(row.price_as_of) }}</small>
          </td>
        </tr>
      </tbody>
    </table>

    <table v-else-if="mode === 'pending'" class="plan-items-table">
      <thead>
        <tr>
          <th>方向</th>
          <th>标的</th>
          <th>行业</th>
          <th>加权分</th>
          <th>当前</th>
          <th>目标</th>
          <th>变化</th>
          <th>预估价</th>
          <th v-if="showOverlay">现价</th>
          <th v-if="showOverlay">最新排名</th>
          <th>预估金额</th>
          <th>AI风控</th>
          <th v-if="showOverlay">提示</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in items" :key="row.symbol">
          <td>
            <span class="action-tag" :class="planItemActionClass(row.action)">
              {{ planItemActionLabel(row.action) }}
            </span>
          </td>
          <td class="col-stock" :title="`${row.name || ''} ${row.symbol || ''}`">
            <AppLink
              tab="stock-workbench"
              :params="{ symbol: row.symbol }"
              class="stock-workbench-link pending-stock-link"
            >
              <span class="stock-workbench-link__name pending-stock-link__name">{{ row.name || row.symbol || '-' }}</span>
            </AppLink>
          </td>
          <td>{{ row.industry || '-' }}</td>
          <td>{{ num(row.score_value) }}</td>
          <td>{{ row.current_shares ?? 0 }}</td>
          <td>{{ row.target_shares ?? 0 }}</td>
          <td :class="signClass(row.delta_shares)">{{ formatShareDelta(row.delta_shares) }}</td>
          <td>{{ num(row.estimated_price) }}</td>
          <td v-if="showOverlay" class="col-num">
            <span :class="priceSourceClass(row.live_price_source)">{{ num(row.live_price) }}</span>
            <small v-if="row.live_price_as_of" class="price-as-of" :title="row.live_price_as_of">
              {{ priceSourceLabel(row.live_price_source) }} {{ formatPriceAsOf(row.live_price_as_of) }}
            </small>
            <small v-if="row.price_drift_pct != null" class="price-drift">{{ pctSigned(row.price_drift_pct) }}</small>
          </td>
          <td v-if="showOverlay" class="col-narrow">
            <span>{{ row.latest_rank ?? '-' }}</span>
            <small
              v-if="row.rank_delta != null"
              :class="row.rank_delta > 0 ? 'rank-up' : row.rank_delta < 0 ? 'rank-down' : ''"
            >
              {{ row.rank_delta > 0 ? `↑${row.rank_delta}` : row.rank_delta < 0 ? `↓${Math.abs(row.rank_delta)}` : '—' }}
            </small>
            <small v-if="row.dropped_out_of_top_n" class="dropped-flag">掉出TopN</small>
          </td>
          <td>{{ money(row.estimated_amount) }}</td>
          <td>
            <span
              v-if="row.ai_risk"
              class="risk-badge"
              :class="`risk-${row.ai_risk.severity || 'none'}`"
              :title="(row.ai_risk.reasons || []).join('、')"
            >
              {{ riskSeverityLabel(row.ai_risk.severity) }}
            </span>
            <span v-else class="muted">-</span>
          </td>
          <td v-if="showOverlay" class="risk-reasons">
            <span
              v-for="warning in (row.warnings || [])"
              :key="`${row.symbol}-warn-${warning}`"
              class="risk-chip warn"
              :title="blockerText(warning)"
            >
              {{ blockerText(warning) }}
            </span>
            <span
              v-for="blocker in (row.blockers || [])"
              :key="`${row.symbol}-block-${blocker}`"
              class="risk-chip"
              :title="blocker"
            >
              {{ blockerText(blocker) }}
            </span>
            <span v-if="!(row.warnings || []).length && !(row.blockers || []).length" class="muted">-</span>
          </td>
        </tr>
      </tbody>
    </table>

    <table v-else class="plan-items-table">
      <thead>
        <tr>
          <th v-if="canReselectItems" class="col-select">选</th>
          <th class="col-narrow">Rank</th>
          <th class="col-stock">标的</th>
          <th class="col-ind">行业</th>
          <th class="col-num">{{ selectedPlanHasLiveSignals ? '策略股数' : '当前股数' }}</th>
          <th class="col-num">目标股数</th>
          <th v-if="selectedPlanIsMonitorNoTrade" class="col-num">漂移</th>
          <th v-if="selectedPlanHasLiveSignals" class="col-num">账户股数</th>
          <th v-if="selectedPlanHasLiveSignals" class="col-num">已成交</th>
          <th v-if="selectedPlanHasLiveSignals" class="col-num">剩余</th>
          <th v-if="selectedPlanHasLiveSignals" class="col-narrow">实盘状态</th>
          <th class="col-num">预估价</th>
          <th class="col-num">现价</th>
          <th class="col-narrow">最新排名</th>
          <th class="col-narrow">候选</th>
          <th v-if="canReselectItems" class="col-action">操作</th>
          <th class="col-airisk">AI风控</th>
          <th class="col-risk">风险</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="`${item.symbol}-${item.rank}`">
          <td v-if="canReselectItems" class="col-select">
            <input
              type="checkbox"
              :checked="isReselectSelected(item.symbol)"
              :disabled="!canSelectReselectItem(item) || actionLoading || reselectBusy"
              @change="$emit('toggle-reselect', item.symbol, $event.target.checked)"
            >
          </td>
          <td class="col-narrow">{{ item.rank ?? '-' }}</td>
          <td class="col-stock" :title="`${actionBadge(item).label} ${item.name || ''} ${item.symbol || ''}`">
            <AppLink
              tab="stock-workbench"
              :params="{ symbol: item.symbol }"
              class="stock-workbench-link"
            >
              <span class="action-tag" :class="actionBadge(item).cls">{{ actionBadge(item).text }}</span>
              <span class="stock-workbench-link__name">{{ item.name || item.symbol || '-' }}</span>
              <span v-if="item.symbol" class="stock-workbench-link__symbol">{{ item.symbol }}</span>
            </AppLink>
          </td>
          <td class="col-ind" :title="item.industry || ''">{{ item.industry || '-' }}</td>
          <td class="col-num">{{ item.current_shares ?? 0 }}</td>
          <td class="col-num">{{ item.target_shares ?? 0 }}</td>
          <td v-if="selectedPlanIsMonitorNoTrade" class="col-num drift-cell" :class="driftBadge(item).cls">
            {{ driftBadge(item).text }}
          </td>
          <td v-if="selectedPlanHasLiveSignals" class="col-num">{{ item.account_current_shares ?? '-' }}</td>
          <td v-if="selectedPlanHasLiveSignals" class="col-num">{{ item.live_filled_qty ?? 0 }}</td>
          <td v-if="selectedPlanHasLiveSignals" class="col-num">{{ item.live_remaining_qty ?? Math.abs(item.delta_shares ?? 0) }}</td>
          <td v-if="selectedPlanHasLiveSignals" class="col-narrow">{{ item.live_status || '-' }}</td>
          <td class="col-num">{{ num(item.estimated_price) }}</td>
          <td class="col-num">
            <span :class="priceSourceClass(item.live_price_source)">{{ num(item.live_price) }}</span>
            <small v-if="item.live_price_as_of" class="price-as-of" :title="item.live_price_as_of">
              {{ priceSourceLabel(item.live_price_source) }} {{ formatPriceAsOf(item.live_price_as_of) }}
            </small>
            <small v-if="item.price_drift_pct != null" class="price-drift">{{ pctSigned(item.price_drift_pct) }}</small>
          </td>
          <td class="col-narrow">
            <span>{{ item.latest_rank ?? '-' }}</span>
            <small v-if="item.rank_delta != null" :class="item.rank_delta > 0 ? 'rank-up' : item.rank_delta < 0 ? 'rank-down' : ''">
              {{ item.rank_delta > 0 ? `↑${item.rank_delta}` : item.rank_delta < 0 ? `↓${Math.abs(item.rank_delta)}` : '—' }}
            </small>
            <small v-if="item.dropped_out_of_top_n" class="dropped-flag">掉出TopN</small>
          </td>
          <td class="col-narrow">{{ item.candidate_appearances ?? 0 }}</td>
          <td v-if="canReselectItems" class="col-action">
            <button
              v-if="selectedPlanExcluded.includes(item.symbol)"
              class="link-btn"
              :disabled="actionLoading || reselectBusy"
              @click="$emit('reselect', item.symbol, true)"
            >{{ reselectBusy && pendingReselectSymbol === item.symbol ? '恢复中…' : '恢复' }}</button>
            <button
              v-else-if="item.rank != null && (item.current_shares ?? 0) > 0"
              class="link-btn danger"
              :disabled="actionLoading || reselectBusy"
              title="移出目标并清仓该持仓，由候选池补一只新标的"
              @click="$emit('reselect', item.symbol, false)"
            >{{ reselectBusy && pendingReselectSymbol === item.symbol ? '处理中…' : '清仓' }}</button>
            <button
              v-else-if="item.rank != null"
              class="link-btn"
              :disabled="actionLoading || reselectBusy"
              title="拒绝该买入推荐，用候选池下一名替换"
              @click="$emit('reselect', item.symbol, false)"
            >{{ reselectBusy && pendingReselectSymbol === item.symbol ? '处理中…' : '换一只' }}</button>
            <span v-else>-</span>
          </td>
          <td class="col-airisk">
            <span
              v-if="aiRiskBadge(item).show"
              class="ai-risk-tag"
              :class="aiRiskBadge(item).cls"
              :title="aiRiskBadge(item).title"
            >{{ aiRiskBadge(item).text }}</span>
            <span v-else>-</span>
          </td>
          <td class="col-risk" :title="(item.blockers || []).join(', ')">{{ (item.blockers || []).join(', ') || '-' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AppLink from '../common/AppLink.vue'
import {
  actionBadge,
  aiRiskBadge,
  blockerText,
  driftBadge,
  formatPriceAsOf,
  formatShareDelta,
  money,
  num,
  pctSigned,
  planItemActionClass,
  planItemActionLabel,
  priceSourceClass,
  priceSourceLabel,
  riskSeverityLabel,
  signClass,
} from '../../composables/usePortfolioPlanFormat'

const props = defineProps({
  items: { type: Array, default: () => [] },
  overlay: { type: Object, default: null },
  mode: { type: String, default: 'plan' },
  compact: { type: Boolean, default: false },
  canReselectItems: { type: Boolean, default: false },
  selectedPlanHasLiveSignals: { type: Boolean, default: false },
  selectedPlanIsMonitorNoTrade: { type: Boolean, default: false },
  selectedReselectSymbols: { type: Object, default: () => new Set() },
  selectedPlanExcluded: { type: Array, default: () => [] },
  actionLoading: { type: Boolean, default: false },
  reselectBusy: { type: Boolean, default: false },
  pendingReselectSymbol: { type: String, default: '' },
})

defineEmits(['toggle-reselect', 'reselect'])

const showOverlay = computed(() => Boolean(props.overlay?.enabled !== false))

function isReselectSelected(symbol) {
  return props.selectedReselectSymbols?.has?.(symbol)
}

function canSelectReselectItem(item) {
  return Boolean(item?.symbol && item.rank != null && !props.selectedPlanExcluded.includes(item.symbol))
}
</script>

<style scoped>
.table-wrap {
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  overflow-x: auto;
}

.table-wrap.compact table {
  font-size: 13px;
}

.plan-items-table {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
}

.plan-items-table th,
.plan-items-table td {
  border-bottom: 1px solid #e5e7eb;
  color: #111827;
  font-size: 12px;
  overflow: hidden;
  padding: 3px 5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plan-items-table th {
  background: #f3f4f6;
  color: #111827;
  font-weight: 600;
}

.plan-items-table tbody tr:hover td {
  background: #f9fafb;
}

.plan-items-table tbody tr:last-child td {
  border-bottom: none;
}

.plan-items-table .col-num {
  text-align: right;
  width: 54px;
}

.plan-items-table .col-narrow {
  width: 44px;
}

.plan-items-table .col-select {
  text-align: center;
  width: 32px;
}

.plan-items-table .col-stock {
  width: 138px;
}

.plan-items-table .col-ind {
  width: 62px;
}

.plan-items-table .col-action {
  overflow: visible;
  width: 60px;
}

.plan-items-table .col-action .link-btn {
  padding: 1px 6px;
}

.plan-items-table .col-risk {
  width: 84px;
}

.plan-items-table .col-airisk {
  width: 52px;
  text-align: center;
}

.symbol-line {
  display: block;
}

.price-source-realtime {
  color: #1f9d55;
}

.price-source-daily {
  color: #b8860b;
}

.price-source-none {
  color: #d12b2b;
}

.price-as-of,
.price-drift,
.dropped-flag {
  color: var(--muted, #888);
  display: block;
  font-size: 11px;
}

.rank-up {
  color: #1f9d55;
}

.rank-down {
  color: #d12b2b;
}

.risk-chip {
  background: #fee2e2;
  border: 1px solid #fca5a5;
  border-radius: 4px;
  color: #991b1b;
  display: inline-block;
  font-size: 11px;
  margin-right: 4px;
  padding: 1px 4px;
}

.risk-chip.warn {
  background: #fff7e6;
  border-color: #e08e0b;
  color: #9a6700;
}

.ai-risk-tag {
  border-radius: 3px;
  color: #fff;
  cursor: help;
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  min-width: 22px;
  padding: 0 4px;
  text-align: center;
}

.ai-risk-tag.risk-high {
  background: #d12b2b;
}

.ai-risk-tag.risk-medium {
  background: #e08e0b;
}

.ai-risk-tag.risk-low {
  background: #b8860b;
}

.ai-risk-tag.risk-none {
  background: #1f9d55;
}

.stock-workbench-link {
  align-items: center;
  background: transparent;
  border: 0;
  color: #1d4ed8;
  cursor: pointer;
  display: inline-flex;
  gap: 4px;
  max-width: 100%;
  min-width: 0;
  padding: 0;
  text-align: left;
  text-decoration: none;
}

.stock-workbench-link:hover .stock-workbench-link__name,
.stock-workbench-link:hover .stock-workbench-link__symbol {
  text-decoration: underline;
}

.stock-workbench-link__name {
  font-weight: 700;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stock-workbench-link__symbol {
  color: #6b7280;
  flex-shrink: 0;
  font-size: 11px;
}

.pending-stock-link__name {
  overflow: visible;
  text-overflow: clip;
}

.action-tag {
  border-radius: 3px;
  color: #fff;
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  min-width: 16px;
  padding: 0 4px;
  text-align: center;
}

.action-tag.tag-buy,
.action-tag.tag-keep {
  background: #d12b2b;
}

.action-tag.tag-sell {
  background: #1f9d55;
}

.action-tag.tag-hold {
  background: #64748b;
}

.action-tag.tag-skip {
  background: #94a3b8;
}

.drift-cell.drift-buy {
  color: #d12b2b;
}

.drift-cell.drift-sell {
  color: #1f9d55;
}

.risk-reasons {
  white-space: normal;
}
</style>
