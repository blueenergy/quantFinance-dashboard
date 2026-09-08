<template>
  <section class="portfolio-identity-card">
    <div class="identity-row">
      <div class="identity-main">
        <strong :title="portfolio.strategy_template_id">
          {{ portfolio.strategy_name || portfolio.strategy_template_id }}
        </strong>
        <span
          v-if="venueLabel"
          class="venue-badge"
          :class="`mode-${portfolio.execution_venue}`"
        >
          {{ venueLabel }}
        </span>
        <span v-if="portfolio.paused" class="paused-pill">已暂停</span>
        <span v-if="paramLine" class="meta">{{ paramLine }}</span>
        <span v-if="rangeText" class="meta">{{ rangeText }}</span>
        <span v-if="planCountText" class="meta">{{ planCountText }}</span>
      </div>
      <button
        type="button"
        class="copy-hash"
        :disabled="!portfolio.params_hash"
        :title="portfolio.params_hash || ''"
        @click="copyParamsHash"
      >
        {{ copyButtonLabel }}
      </button>
    </div>
    <p v-if="paperLine" class="paper-line">{{ paperLine }}</p>
    <div v-if="portfolio.paused" class="paused-banner">
      <span>该组合已暂停自动调仓（上次手动清仓或主动暂停）。</span>
      <button type="button" :disabled="resumeSubmitting" @click="$emit('resume-lineage')">
        恢复自动调仓
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { money } from '../../composables/usePortfolioPlanFormat'
import { copyTextToClipboard } from '../../utils/clipboard'
import { executionVenueLabel } from '../../utils/portfolioOverviewFormat'

const props = defineProps({
  portfolio: { type: Object, required: true },
  resumeSubmitting: { type: Boolean, default: false },
})

defineEmits(['resume-lineage'])

const copyState = ref('')
let copyTimer = null

const venueLabel = computed(() => executionVenueLabel(props.portfolio.execution_venue))

const hashShort = computed(() => {
  if (props.portfolio.params_hash_short) return props.portfolio.params_hash_short
  const hash = String(props.portfolio.params_hash || '')
  return hash ? hash.slice(0, 8) : ''
})

const copyButtonLabel = computed(() => {
  if (copyState.value === 'ok') return '已复制'
  if (copyState.value === 'fail') return '复制失败'
  return hashShort.value ? `#${hashShort.value} 复制` : '复制'
})

const paramLine = computed(() => {
  if (props.portfolio.param_summary) return props.portfolio.param_summary
  const parts = []
  if (props.portfolio.universe_index) parts.push(props.portfolio.universe_index)
  if (props.portfolio.top_n != null) parts.push(`Top${props.portfolio.top_n}`)
  if (props.portfolio.rebalance_days != null) parts.push(`${props.portfolio.rebalance_days}日调仓`)
  if (props.portfolio.construction_mode) parts.push(props.portfolio.construction_mode)
  return parts.join(' · ')
})

const rangeText = computed(() => {
  const start = props.portfolio.first_base_date
  const end = props.portfolio.last_base_date
  if (start && end) return `${start} → ${end}`
  return end || start || ''
})

const planCountText = computed(() => {
  if (props.portfolio.plan_count == null) return ''
  return `${props.portfolio.plan_count} 期`
})

const paperLine = computed(() => {
  if (props.portfolio.execution_venue !== 'paper') return ''
  const parts = [
    `快照 ${props.portfolio.paper_snapshot_date || '无快照'}`,
    `持仓 ${props.portfolio.paper_holding_count ?? 0} 只`,
    `权益 ${money(props.portfolio.paper_equity)}`,
  ]
  const mode = paperExecutionModeLabel(props.portfolio.paper_execution_mode)
  if (mode) parts.push(mode)
  return parts.join(' · ')
})

function paperExecutionModeLabel(mode) {
  if (mode === 'auto_shadow') return '自动跟跑'
  if (mode === 'manual_review') return '人工审核'
  return ''
}

async function copyParamsHash() {
  const hash = props.portfolio.params_hash
  if (!hash) return
  const ok = await copyTextToClipboard(hash)
  copyState.value = ok ? 'ok' : 'fail'
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => { copyState.value = '' }, 2000)
}

onBeforeUnmount(() => {
  if (copyTimer) clearTimeout(copyTimer)
})
</script>

<style scoped>
.portfolio-identity-card {
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  margin-bottom: 16px;
  padding: 10px 14px;
}

.identity-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  justify-content: space-between;
}

.identity-main {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
  min-width: 0;
}

.identity-main strong {
  color: #0f172a;
  font-size: 15px;
}

.meta {
  color: #64748b;
  font-size: 13px;
}

.venue-badge,
.paused-pill {
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
}

.venue-badge.mode-live {
  background: #dbeafe;
  color: #1d4ed8;
}

.venue-badge.mode-paper {
  background: #f1f5f9;
  color: #334155;
}

.paused-pill {
  background: #ffedd5;
  color: #9a3412;
}

.paper-line {
  color: #64748b;
  font-size: 12px;
  margin: 6px 0 0;
}

.copy-hash {
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  color: #334155;
  cursor: pointer;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  padding: 4px 8px;
}

.copy-hash:disabled {
  color: #9ca3af;
  cursor: not-allowed;
}

.paused-banner {
  align-items: center;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-top: 10px;
  padding: 10px 12px;
}

.paused-banner button {
  background: #fff;
  border: 1px solid #111827;
  border-radius: 4px;
  color: #111827;
  cursor: pointer;
  font-weight: 500;
  padding: 8px 10px;
}

.paused-banner button:disabled {
  border-color: #9ca3af;
  color: #6b7280;
  cursor: not-allowed;
}
</style>
