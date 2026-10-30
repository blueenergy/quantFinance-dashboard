<template>
  <section v-if="report" class="workbench-card earnings-report-card">
    <div class="card-title-row">
      <h3>AI 财报解读</h3>
      <span class="muted">
        {{ report.report_kind || '定期报告' }} · {{ formatDate(report.ann_date) }}
      </span>
    </div>

    <div class="report-head">
      <span :class="['report-score', scoreClass]">{{ report.score ?? '—' }}/10</span>
      <span class="report-beat">{{ report.beat_miss || '—' }}</span>
      <span v-if="report.industry" class="muted">{{ report.industry }}</span>
    </div>

    <p v-if="report.verdict" class="report-verdict">{{ report.verdict }}</p>

    <div class="financial-metrics">
      <div>
        <span>营收</span>
        <strong>{{ fmtAmount(report.key_numbers?.revenue) }}</strong>
      </div>
      <div>
        <span>营收同比</span>
        <strong>{{ fmtPct(report.key_numbers?.revenue_yoy) }}</strong>
      </div>
      <div>
        <span>归母净利</span>
        <strong>{{ fmtAmount(report.key_numbers?.net_profit) }}</strong>
      </div>
      <div>
        <span>归母同比</span>
        <strong>{{ fmtPct(report.key_numbers?.net_profit_yoy) }}</strong>
      </div>
      <div>
        <span>扣非同比</span>
        <strong>{{ fmtPct(report.key_numbers?.deduct_net_profit_yoy) }}</strong>
      </div>
      <div>
        <span>毛利率</span>
        <strong>{{ fmtPct(report.key_numbers?.gross_margin) }}</strong>
      </div>
    </div>

    <div v-if="progressText" class="muted report-progress">年度预期进度 {{ progressText }}</div>

    <ul v-if="report.risk_flags?.length" class="report-risks">
      <li v-for="risk in report.risk_flags.slice(0, 3)" :key="risk">{{ risk }}</li>
    </ul>

    <details class="report-details">
      <summary>完整解读</summary>
      <p class="report-narrative">{{ report.narrative }}</p>
      <div v-if="report.highlights?.length" class="report-list">
        <strong>亮点</strong>
        <ul><li v-for="h in report.highlights" :key="h">{{ h }}</li></ul>
      </div>
      <div v-if="report.follow_ups?.length" class="report-list">
        <strong>后续跟踪</strong>
        <ul><li v-for="f in report.follow_ups" :key="f">{{ f }}</li></ul>
      </div>
    </details>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { earningsWatchApi } from '../../api/earningsWatch'

const props = defineProps({
  symbol: {
    type: String,
    default: '',
  },
})

const report = ref(null)

const fetchReport = async () => {
  report.value = null
  if (!props.symbol) return
  try {
    const res = await earningsWatchApi.listReports({
      symbol: props.symbol,
      days: 365,
      limit: 1,
    })
    if (res?.success) report.value = (res.data || [])[0] || null
  } catch (e) {
    console.debug('earnings report fetch failed', e)
  }
}

watch(() => props.symbol, fetchReport, { immediate: true })

const scoreClass = computed(() => {
  const score = Number(report.value?.score)
  if (!Number.isFinite(score)) return ''
  if (score >= 8) return 'score-high'
  if (score >= 5) return 'score-medium'
  return 'score-low'
})

const progressText = computed(() => {
  const c = report.value?.consensus || {}
  if (c.ytd_vs_annual_consensus_pct == null) return ''
  const delta = c.progress_delta_pp
  if (delta == null) return `${c.ytd_vs_annual_consensus_pct.toFixed(1)}%`
  const ly = c.ytd_vs_annual_consensus_pct - delta
  return `${c.ytd_vs_annual_consensus_pct.toFixed(1)}%（去年同期 ${ly.toFixed(2)}%，${delta > 0 ? '+' : ''}${delta.toFixed(2)}pp）`
})

const formatDate = (value) => {
  const s = String(value || '')
  if (s.length !== 8) return s || '—'
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

const fmtAmount = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿`
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(1)}万`
  return `${n.toFixed(0)}`
}

const fmtPct = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? `${n > 0 ? '+' : ''}${n.toFixed(1)}%` : '—'
}
</script>

<style scoped>
.earnings-report-card {
  margin-bottom: 16px;
}
.report-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.report-score {
  font-size: 1.2rem;
  font-weight: 600;
}
.score-high { color: #81c784; }
.score-medium { color: #ffd54f; }
.score-low { color: #e57373; }
.report-beat {
  padding: 2px 10px;
  border-radius: 12px;
  background: rgba(25, 118, 210, 0.15);
  color: #64b5f6;
  font-size: 0.85rem;
}
.report-verdict {
  margin: 8px 0 12px;
  color: var(--text-color, #ddd);
  line-height: 1.6;
}
.report-progress {
  margin-top: 10px;
}
.report-risks {
  margin: 12px 0 0 18px;
  padding: 0;
  color: var(--text-muted, #aaa);
  font-size: 0.9rem;
  line-height: 1.6;
}
.report-details {
  margin-top: 12px;
}
.report-details summary {
  cursor: pointer;
  color: #64b5f6;
  font-size: 0.9rem;
}
.report-narrative {
  margin-top: 12px;
  padding: 14px;
  border-radius: 6px;
  background: var(--surface-ground, #1e1e1e);
  color: var(--text-color, #ddd);
  font-size: 0.9rem;
  line-height: 1.7;
}
.report-list {
  margin-top: 10px;
}
.report-list ul {
  margin: 6px 0 0 18px;
  padding: 0;
}
.report-list li {
  margin-bottom: 4px;
}
</style>
