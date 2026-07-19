<template>
  <section v-if="visible">
    <div class="section-head">
      <h4>目标持仓与交易明细</h4>
      <div class="ai-risk-bar">
        <span v-if="aiRiskSummary" class="ai-risk-summary">
          规则风控：<b class="risk-high">{{ aiRiskSummary.high || 0 }}高</b>
          / <b class="risk-medium">{{ aiRiskSummary.medium || 0 }}中</b>
          / <b class="risk-low">{{ aiRiskSummary.low || 0 }}低</b>
        </span>
        <span v-if="llmRiskSummary" class="ai-risk-summary">
          AI风险/机会：{{ llmRiskSummary.industry_count || 0 }}行业 / {{ llmRiskSummary.symbol_count || 0 }}标的
          <template v-if="llmRiskSummary.source === 'ledger'"> · 个股台账</template>
        </span>
        <span v-if="riskSnapshot" class="ai-risk-summary risk-snapshot-hint">
          决策快照({{ riskSnapshot.decision_point }})：{{ riskSnapshot.summary?.symbol_count || 0 }}标的
          · {{ formatSnapshotAt(riskSnapshot.captured_at) }}
        </span>
        <button v-if="canReselectItems" class="link-btn" :disabled="actionLoading || reselectBusy" title="点选全部 AI 高风险标的；已全部勾选时再点可取消" @click="$emit('select-high-risk')">
          勾选高风险
        </button>
        <button v-if="canReselectItems" class="link-btn link-btn--primary" :disabled="actionLoading || reselectBusy || !selectedReselectCount" title="一次性排除勾选标的并重算候选池补位" @click="$emit('bulk-reselect')">
          批量换股 {{ selectedReselectCount ? `(${selectedReselectCount})` : '' }}
        </button>
        <button class="link-btn" :disabled="aiRiskRunning" @click="$emit('run-ai-risk')">
          <span v-if="aiRiskRunning" class="spinner" />{{ aiRiskRunning ? '规则风控运行中…' : '运行规则风控' }}
        </button>
        <button class="link-btn" :disabled="llmRiskRunning" @click="$emit('run-llm-risk')">
          <span v-if="llmRiskRunning" class="spinner" />{{ llmRiskRunning ? `AI 风险/机会分析 ${llmRiskMeta.summary || '运行中…'}` : '运行 AI 风险/机会分析' }}
        </button>
      </div>
    </div>
    <p v-if="reselectStatus.state !== 'idle'" class="reselect-status" :class="`is-${reselectStatus.state}`">
      <span v-if="reselectStatus.state === 'running'" class="spinner" />{{ reselectStatus.text }}
    </p>
    <p v-if="reselectTaskMeta.taskId" class="reselect-meta">task {{ reselectTaskMeta.taskId }} · {{ reselectTaskMeta.status || '-' }}</p>
    <p v-if="lastReselectSummary" class="reselect-summary">{{ lastReselectSummary }}</p>
    <div v-if="canReselectItems && excludedSymbols.length" class="excluded-bar">
      <span class="excluded-label">已排除：</span>
      <span v-for="symbol in excludedSymbols" :key="symbol" class="excluded-chip">
        {{ symbol }}
        <button class="link-btn" :disabled="actionLoading || reselectBusy" @click="$emit('reselect', symbol, true)">
          {{ reselectBusy && pendingReselectSymbol === symbol ? '恢复中…' : '恢复' }}
        </button>
      </span>
    </div>
    <PlanItemsTable
      mode="plan"
      :items="items"
      :overlay="overlay"
      :plan-id="planId"
      :can-reselect-items="canReselectItems"
      :selected-plan-has-live-signals="hasLiveSignals"
      :selected-plan-is-monitor-no-trade="monitorNoTrade"
      :selected-reselect-symbols="selectedReselectSymbols"
      :selected-plan-excluded="excludedSymbols"
      :action-loading="actionLoading"
      :reselect-busy="reselectBusy"
      :pending-reselect-symbol="pendingReselectSymbol"
      @toggle-reselect="(symbol, checked) => $emit('toggle-reselect', symbol, checked)"
      @reselect="(symbol, restore) => $emit('reselect', symbol, restore)"
      @risk-changed="$emit('risk-changed')"
    />
  </section>
</template>

<script setup>
import PlanItemsTable from './PlanItemsTable.vue'
import { formatSnapshotAt } from '../../composables/usePortfolioPlanFormat'

defineProps({
  visible: { type: Boolean, default: true },
  items: { type: Array, default: () => [] },
  overlay: { type: Object, default: null },
  planId: { type: String, default: '' },
  aiRiskSummary: { type: Object, default: null },
  llmRiskSummary: { type: Object, default: null },
  riskSnapshot: { type: Object, default: null },
  aiRiskRunning: { type: Boolean, default: false },
  llmRiskRunning: { type: Boolean, default: false },
  llmRiskMeta: { type: Object, default: () => ({}) },
  canReselectItems: { type: Boolean, default: false },
  selectedReselectCount: { type: Number, default: 0 },
  actionLoading: { type: Boolean, default: false },
  reselectBusy: { type: Boolean, default: false },
  reselectStatus: { type: Object, default: () => ({ state: 'idle', text: '' }) },
  reselectTaskMeta: { type: Object, default: () => ({}) },
  lastReselectSummary: { type: String, default: '' },
  excludedSymbols: { type: Array, default: () => [] },
  pendingReselectSymbol: { type: String, default: '' },
  selectedReselectSymbols: { type: Object, default: () => new Set() },
  hasLiveSignals: { type: Boolean, default: false },
  monitorNoTrade: { type: Boolean, default: false },
})

defineEmits([
  'select-high-risk', 'bulk-reselect', 'run-ai-risk', 'run-llm-risk',
  'toggle-reselect', 'reselect', 'risk-changed',
])
</script>
