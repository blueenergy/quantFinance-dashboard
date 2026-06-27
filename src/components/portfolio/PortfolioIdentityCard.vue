<template>
  <section class="portfolio-identity-card">
    <h3>组合标识</h3>
    <div class="identity-grid">
      <div>
        <span class="label">策略</span>
        <strong>{{ portfolio.strategy_name || portfolio.strategy_template_id }}</strong>
        <small>{{ portfolio.strategy_template_id }}</small>
      </div>
      <div>
        <span class="label">参数摘要</span>
        <strong>{{ portfolio.param_summary || '-' }}</strong>
        <small>
          universe {{ portfolio.universe_index || '-' }}
          · Top{{ portfolio.top_n ?? '-' }}
          · {{ portfolio.rebalance_days ?? '-' }} 日调仓
          · {{ portfolio.construction_mode || '-' }}
        </small>
      </div>
      <div>
        <span class="label">params_hash</span>
        <strong :title="portfolio.params_hash">{{ portfolio.params_hash_short || '-' }}</strong>
        <small>完整：{{ portfolio.params_hash || '-' }}</small>
      </div>
      <div>
        <span class="label">维护区间</span>
        <strong>{{ portfolio.first_base_date || '-' }} → {{ portfolio.last_base_date || '-' }}</strong>
        <small>{{ portfolio.plan_count }} 期 plan · 最新 {{ portfolio.latest_plan_type || '-' }} / {{ portfolio.latest_plan_status || '-' }}</small>
      </div>
      <div v-if="portfolio.execution_venue === 'paper'">
        <span class="label">纸面快照</span>
        <strong>{{ portfolio.paper_snapshot_date || '无快照' }}</strong>
        <small>持仓 {{ portfolio.paper_holding_count ?? 0 }} 只 · 权益 {{ money(portfolio.paper_equity) }}</small>
      </div>
      <div v-if="portfolio.paper_execution_mode">
        <span class="label">纸面执行</span>
        <strong>{{ paperExecutionModeLabel(portfolio.paper_execution_mode) }}</strong>
        <small v-if="portfolio.paper_execution_mode === 'auto_shadow'">调仓日自动批准，次日开盘价执行</small>
      </div>
      <div v-if="portfolio.paused">
        <span class="label">自动调仓</span>
        <strong class="negative">已暂停</strong>
        <small>手动清仓后暂停；可恢复自动调仓</small>
      </div>
    </div>
    <div v-if="portfolio.paused" class="paused-banner">
      <span>该组合已暂停自动调仓（上次手动清仓或主动暂停）。</span>
      <button type="button" :disabled="resumeSubmitting" @click="$emit('resume-lineage')">恢复自动调仓</button>
    </div>
  </section>
</template>

<script setup>
import { money } from '../../composables/usePortfolioPlanFormat'

defineProps({
  portfolio: { type: Object, required: true },
  resumeSubmitting: { type: Boolean, default: false },
})

defineEmits(['resume-lineage'])

function paperExecutionModeLabel(mode) {
  if (mode === 'auto_shadow') return '自动跟跑'
  if (mode === 'manual_review') return '人工审核'
  return mode || '-'
}
</script>

<style scoped>
.portfolio-identity-card {
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  margin-bottom: 16px;
  padding: 14px 16px;
}

.portfolio-identity-card h3 {
  color: #111827;
  font-size: 15px;
  margin: 0 0 12px;
}

.identity-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

.identity-grid .label {
  color: #64748b;
  display: block;
  font-size: 12px;
  margin-bottom: 4px;
}

.identity-grid strong {
  color: #0f172a;
  display: block;
  font-size: 14px;
}

.identity-grid small {
  color: #64748b;
  display: block;
  font-size: 12px;
  margin-top: 4px;
  word-break: break-all;
}

.negative {
  color: #16a34a;
}

.paused-banner {
  align-items: center;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-top: 12px;
  padding: 10px 12px;
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

button:disabled {
  border-color: #9ca3af;
  color: #6b7280;
  cursor: not-allowed;
  opacity: 1;
}
</style>
