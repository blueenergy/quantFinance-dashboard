<template>
  <div class="workbench-analysis-panel">
    <section class="workbench-card">
      <div class="card-title-row">
        <h3>AI 命中率</h3>
        <span class="muted">
          <template v-if="sectionLoadingAi">刷新中…</template>
          <template v-else>基于已完成的历史评估</template>
        </span>
      </div>
      <div class="financial-metrics">
        <div>
          <span>综合命中率</span>
          <strong>{{ fmtPctPlain(evaluationSummary.hit_rate) }}</strong>
        </div>
        <div>
          <span>严格准确率</span>
          <strong>{{ fmtPctPlain(evaluationSummary.accuracy_rate) }}</strong>
        </div>
        <div>
          <span>已评估 / 最近分析</span>
          <strong>{{ evaluationSummary.evaluated_count || 0 }} / {{ evaluationSummary.recent_analyses || analysisHistory.length }}</strong>
        </div>
        <div>
          <span>待评估</span>
          <strong>{{ evaluationSummary.pending_count || 0 }} 条</strong>
        </div>
      </div>
      <div v-if="evaluationRows.length" class="evaluation-list">
        <article v-for="row in evaluationRows.slice(0, 3)" :key="row.history_id" class="evaluation-item">
          <div>
            <span>{{ row.analysis_created_at || '-' }}</span>
            <strong>{{ row.title || '历史分析' }}</strong>
            <small>{{ row.summary || row.short_review || '暂无评估摘要' }}</small>
          </div>
          <b :class="['evaluation-badge', row.outcome_accuracy || 'unknown']">
            {{ accuracyLabel(row.outcome_accuracy) }}
          </b>
        </article>
      </div>
      <div v-else class="muted-block">
        暂无已完成评估。可在个股深度分析历史中手动触发评估，完成后这里会汇总命中率。
      </div>
    </section>

    <section class="workbench-card">
      <div class="card-title-row">
        <h3>交易状态</h3>
        <span class="muted">
          <template v-if="sectionLoadingTrading">刷新中…</template>
          <template v-else>自选 / 策略 / 持仓 / 信号</template>
        </span>
      </div>
      <div class="financial-metrics">
        <div>
          <span>自选状态</span>
          <strong>{{ watchlistContext.in_watchlist ? '已加入' : '未加入' }}</strong>
        </div>
        <div>
          <span>绑定策略</span>
          <strong>{{ watchlistStrategies.length }} 个</strong>
        </div>
        <div>
          <span>持仓记录</span>
          <strong>{{ tradingPositions.length }} 条</strong>
        </div>
        <div>
          <span>最近信号</span>
          <strong>{{ recentTradeSignals.length }} 条</strong>
        </div>
      </div>
      <div
        v-if="watchlistStrategies.length || tradingPositions.length || recentTradeSignals.length"
        class="trading-context-grid"
      >
        <article v-if="watchlistStrategies.length">
          <h4>自选策略</h4>
          <p v-for="row in watchlistStrategies.slice(0, 3)" :key="`${row.symbol}-${row.strategy_key}`">
            {{ row.strategy_key || row.strategy || '未命名策略' }}
            <span>{{ row.enabled === false ? '停用' : '启用' }}</span>
          </p>
        </article>
        <article v-if="tradingPositions.length">
          <h4>持仓</h4>
          <p
            v-for="row in tradingPositions.slice(0, 3)"
            :key="`${row.symbol}-${row.securities_account_id || row.account_id || row.updated_at}`"
          >
            数量 {{ row.quantity ?? row.shares ?? row.volume ?? '-' }}
            <span>成本 {{ fmtNumber(row.avg_cost ?? row.cost_basis ?? row.cost_price) }}</span>
          </p>
        </article>
        <article v-if="recentTradeSignals.length">
          <h4>交易信号</h4>
          <p
            v-for="row in recentTradeSignals.slice(0, 3)"
            :key="row.order_id || `${row.symbol}-${row.timestamp}`"
          >
            {{ row.action || row.signal_type || '-' }}
            <span>{{ row.status || row.created_at || row.timestamp || '-' }}</span>
          </p>
        </article>
      </div>
      <div v-else class="muted-block">暂无自选策略、持仓或交易信号。</div>
    </section>

    <section class="workbench-card">
      <div class="card-title-row">
        <h3>深度分析</h3>
        <div class="analysis-actions">
          <span v-if="sectionLoadingAi" class="muted">刷新中…</span>
          <v-select
            :model-value="analysisMode"
            :items="analysisModeOptions"
            density="compact"
            variant="outlined"
            hide-details
            class="analysis-mode-select"
            @update:model-value="$emit('update:analysisMode', $event)"
          />
          <v-btn
            color="primary"
            variant="tonal"
            :loading="analysisSubmitting"
            :disabled="!stockSymbol || stockSymbol === '-'"
            @click="$emit('submit')"
          >
            {{ deepAnalysis?.analysis ? '重新分析' : '开始深度分析' }}
          </v-btn>
        </div>
      </div>
      <v-alert v-if="analysisSubmitError" type="error" variant="tonal" class="mb-3">
        {{ analysisSubmitError }}
      </v-alert>
      <v-alert v-if="analysisSubmitStatus" type="info" variant="tonal" class="mb-3">
        {{ analysisSubmitStatus }}
      </v-alert>
      <div v-if="deepAnalysis?.created_at" class="analysis-time">
        最近分析时间：{{ deepAnalysis.created_at }}
      </div>
      <AnalysisDetailContent
        v-if="deepAnalysis?.analysis"
        :analysis="deepAnalysis.analysis"
        :analysis-mode="deepAnalysis.analysis_mode || 'classic'"
        layout="stacked"
        mode="stock"
        show-mode
      />
      <div v-else class="muted-block">暂无深度分析，可点击上方按钮直接发起分析任务。</div>
    </section>

    <section class="workbench-card">
      <div class="card-title-row">
        <h3>最近分析历史</h3>
        <span class="muted">最近 {{ analysisHistory.length }} 条</span>
      </div>
      <div v-if="analysisHistory.length" class="analysis-history-list">
        <button
          v-for="item in analysisHistory"
          :key="item.id || item.created_at"
          type="button"
          class="analysis-history-item"
          :class="{ active: item.id && item.id === deepAnalysis?.id }"
          @click="$emit('select-history', item)"
        >
          <span>{{ item.created_at || '-' }}</span>
          <strong>{{ analysisHistoryTitle(item) }}</strong>
          <small>
            {{ item.analysis_mode || 'classic' }}
            <b
              v-if="evaluationByHistoryId[item.id]"
              :class="['evaluation-inline-badge', evaluationByHistoryId[item.id].outcome_accuracy || 'unknown']"
            >
              {{ accuracyLabel(evaluationByHistoryId[item.id].outcome_accuracy) }}
            </b>
          </small>
        </button>
      </div>
      <div v-else class="muted-block">暂无历史分析。</div>
    </section>
  </div>
</template>

<script setup>
import AnalysisDetailContent from '../AnalysisDetailContent.vue'
import { fmtNumber, fmtPctPlain } from '../../utils/workbenchFormat'

defineProps({
  evaluationSummary: { type: Object, default: () => ({}) },
  evaluationRows: { type: Array, default: () => [] },
  analysisHistory: { type: Array, default: () => [] },
  evaluationByHistoryId: { type: Object, default: () => ({}) },
  deepAnalysis: { type: Object, default: null },
  watchlistContext: { type: Object, default: () => ({}) },
  watchlistStrategies: { type: Array, default: () => [] },
  tradingPositions: { type: Array, default: () => [] },
  recentTradeSignals: { type: Array, default: () => [] },
  sectionLoadingAi: { type: Boolean, default: false },
  sectionLoadingTrading: { type: Boolean, default: false },
  stockSymbol: { type: String, default: '' },
  analysisMode: { type: String, default: 'multi_expert_v1' },
  analysisModeOptions: { type: Array, default: () => [] },
  analysisSubmitting: { type: Boolean, default: false },
  analysisSubmitStatus: { type: String, default: '' },
  analysisSubmitError: { type: String, default: '' },
})

defineEmits(['update:analysisMode', 'submit', 'select-history'])

function analysisHistoryTitle(item) {
  const analysis = item?.analysis || {}
  return analysis.final_conclusion
    || analysis.investment_advice
    || analysis.long_term_forecast
    || analysis.mid_term_forecast
    || analysis.short_term_forecast
    || item?.stock_name
    || '查看分析详情'
}

function accuracyLabel(value) {
  return {
    accurate: '准确',
    mixed: '部分准确',
    inaccurate: '不准确',
  }[value] || value || '未评估'
}
</script>

<style scoped>
.analysis-mode-select {
  min-width: 140px;
}

.analysis-time {
  color: #94a3b8;
  font-size: 13px;
  margin: -4px 0 14px;
}

.analysis-history-list,
.evaluation-list {
  display: grid;
  gap: 10px;
}

.evaluation-list {
  margin-top: 14px;
}

.evaluation-item {
  align-items: center;
  background: rgba(30, 41, 59, .62);
  border: 1px solid rgba(148, 163, 184, .16);
  border-radius: 12px;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr) auto;
  padding: 12px 14px;
}

.evaluation-item span,
.evaluation-item small {
  color: #94a3b8;
  display: block;
  font-size: 12px;
}

.evaluation-item strong {
  color: #f8fafc;
  display: block;
  margin: 2px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.evaluation-badge,
.evaluation-inline-badge {
  border: 1px solid rgba(148, 163, 184, .24);
  border-radius: 999px;
  color: #cbd5e1;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 8px;
  white-space: nowrap;
}

.evaluation-badge.accurate,
.evaluation-inline-badge.accurate {
  background: rgba(34, 197, 94, .14);
  border-color: rgba(34, 197, 94, .34);
  color: #86efac;
}

.evaluation-badge.mixed,
.evaluation-inline-badge.mixed {
  background: rgba(234, 179, 8, .14);
  border-color: rgba(234, 179, 8, .34);
  color: #fde68a;
}

.evaluation-badge.inaccurate,
.evaluation-inline-badge.inaccurate {
  background: rgba(239, 68, 68, .14);
  border-color: rgba(239, 68, 68, .34);
  color: #fca5a5;
}

.evaluation-inline-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 7px;
}

.analysis-history-item {
  background: rgba(30, 41, 59, .62);
  border: 1px solid rgba(148, 163, 184, .16);
  border-radius: 12px;
  color: #cbd5e1;
  cursor: pointer;
  display: grid;
  gap: 6px;
  grid-template-columns: 170px minmax(0, 1fr) 110px;
  padding: 12px 14px;
  text-align: left;
}

.analysis-history-item:hover,
.analysis-history-item.active {
  background: rgba(96, 165, 250, .14);
  border-color: rgba(96, 165, 250, .34);
}

.analysis-history-item span,
.analysis-history-item small {
  color: #94a3b8;
  font-size: 12px;
}

.analysis-history-item strong {
  color: #f8fafc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trading-context-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin-top: 14px;
}

.trading-context-grid article {
  background: rgba(30, 41, 59, .56);
  border: 1px solid rgba(148, 163, 184, .14);
  border-radius: 12px;
  padding: 14px;
}

.trading-context-grid h4 {
  color: #e2e8f0;
  margin: 0 0 10px;
}

.trading-context-grid p {
  color: #f8fafc;
  display: flex;
  gap: 8px;
  justify-content: space-between;
  margin: 8px 0 0;
}

.trading-context-grid span {
  color: #94a3b8;
}

@media (max-width: 700px) {
  .workbench-analysis-panel .card-title-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .workbench-analysis-panel .analysis-actions {
    justify-content: flex-start;
    width: 100%;
  }

  .workbench-analysis-panel .financial-metrics,
  .workbench-analysis-panel .analysis-history-item {
    grid-template-columns: 1fr;
  }
}
</style>
