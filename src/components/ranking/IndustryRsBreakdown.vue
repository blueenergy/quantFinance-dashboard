<template>
  <div class="industry-rs-breakdown">
    <p v-if="details?.error" class="breakdown-error">{{ details.error }}</p>
    <p v-else-if="!windows.length" class="breakdown-error">
      当前 API 只返回了行业RS总分，未返回 20 / 60 / 120 日窗口拆解。请确认 quantFinance 后端已重启并包含最新的 industry_rs 明细接口代码。
    </p>

    <div v-if="industryLabel" class="industry-meta">
      <span class="industry-meta-label">所属行业</span>
      <span class="industry-meta-value">{{ industryLabel }}</span>
      <span v-if="levelLabel" class="industry-meta-level">{{ levelLabel }}</span>
    </div>

    <div v-if="scoreFormula" class="score-formula">
      <span class="formula-label">明细重算</span>
      <span class="formula-part">基准 50</span>
      <span class="formula-operator">+</span>
      <span class="formula-part">窗口合计 {{ formatPoints(scoreFormula.window_points) }}</span>
      <span class="formula-operator">+</span>
      <span class="formula-part">共振 {{ formatPoints(scoreFormula.resonance_bonus) }}</span>
      <span class="formula-operator">=</span>
      <span class="formula-total">{{ formatScore(scoreFormula.raw_score) }}</span>
      <template v-if="isClipped">
        <span class="formula-operator">→</span>
        <span class="formula-total">{{ formatScore(clippedScore) }}</span>
      </template>
    </div>
    <p v-if="isClipped" class="clip-note">
      最终得分裁剪到 [0, 100]：原始 {{ formatScore(scoreFormula.raw_score) }} 超出区间，取 {{ formatScore(clippedScore) }}。
    </p>
    <p v-if="scoreMismatch" class="score-mismatch">
      说明：榜单中已存的行业RS为 {{ formatScore(storedScore) }}，本弹窗按当前行情明细重算为 {{ formatScore(computedScore) }}。建议补跑回填以让榜单分与明细完全一致。
    </p>

    <div v-if="windows.length" class="window-table-wrap">
      <h5 class="section-title">多窗口收益对比</h5>
      <table class="window-table">
        <thead>
          <tr>
            <th>窗口</th>
            <th>个股收益</th>
            <th>行业指数收益</th>
            <th>相对强弱(RS)</th>
            <th>窗口得分</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in windows" :key="row.window">
            <td>{{ row.window }} 日</td>
            <td :class="returnClass(row.stock_return)">{{ formatReturn(row.stock_return) }}</td>
            <td :class="returnClass(row.index_return)">{{ formatReturn(row.index_return) }}</td>
            <td :class="returnClass(row.rs)">{{ formatReturn(row.rs) }}</td>
            <td>{{ formatPoints(row.points) }}</td>
          </tr>
        </tbody>
      </table>
      <p class="window-note">收益按评分日收盘相对窗口前第 N 个交易日收盘计算；RS = 个股收益 − 行业指数收益。</p>
    </div>

    <p v-if="resonance" class="resonance-note">{{ resonance }}</p>
    <p v-if="resonanceBonus != null && resonanceBonus !== 0" class="resonance-bonus">
      多窗口共振加减分：{{ resonanceBonus > 0 ? '+' : '' }}{{ resonanceBonus }}
    </p>

    <IndustryRsExplainer />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import IndustryRsExplainer from './IndustryRsExplainer.vue'

const props = defineProps({
  details: { type: Object, default: null },
})

const industry = computed(() => props.details?.industry || null)

const industryLabel = computed(() => {
  const ind = industry.value
  if (!ind) return ''
  const name = ind.name || '—'
  const code = ind.code || ''
  return code ? `${name}（${code}）` : name
})

const levelLabel = computed(() => {
  const level = industry.value?.level
  if (!level) return ''
  return `申万 ${String(level).toUpperCase()}`
})

const windows = computed(() => {
  const rows = Array.isArray(props.details?.windows) ? props.details.windows : []
  return rows.filter((w) => w?.status === 'ok')
})

const resonance = computed(() => props.details?.resonance || '')
const resonanceBonus = computed(() => props.details?.resonance_bonus ?? null)
const scoreFormula = computed(() => props.details?.score_formula || null)
const storedScore = computed(() => props.details?.stored_score ?? null)
const computedScore = computed(() => props.details?.computed_score ?? props.details?.score ?? null)
const scoreMismatch = computed(() => (
  storedScore.value != null &&
  computedScore.value != null &&
  Math.abs(Number(storedScore.value) - Number(computedScore.value)) >= 0.01
))
const clippedScore = computed(() => {
  const raw = scoreFormula.value?.raw_score
  if (raw == null || Number.isNaN(Number(raw))) return null
  return Math.max(0, Math.min(100, Number(raw)))
})
const isClipped = computed(() => {
  const raw = scoreFormula.value?.raw_score
  if (raw == null || Number.isNaN(Number(raw)) || clippedScore.value == null) return false
  return Math.abs(Number(raw) - clippedScore.value) >= 0.01
})

function formatReturn(v) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  const n = Number(v) * 100
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function formatPoints(v) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  const n = Number(v)
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}`
}

function formatScore(v) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return Number(v).toFixed(2)
}

function returnClass(v) {
  if (v == null || Number.isNaN(Number(v))) return 'return-na'
  const n = Number(v)
  if (n > 0) return 'return-up'
  if (n < 0) return 'return-down'
  return 'return-flat'
}
</script>

<style scoped>
.industry-rs-breakdown { margin-top: 8px; }
.breakdown-error {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff8e1;
  border: 1px solid #ffe082;
  color: #8d6e00;
  font-size: 13px;
  line-height: 1.5;
}
.industry-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f4f5ff;
  border: 1px solid #e0e3f5;
  margin-bottom: 14px;
}
.score-formula {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #334155;
  font-size: 13px;
}
.formula-label {
  font-size: 12px;
  color: #64748b;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eef2ff;
}
.formula-part { font-weight: 600; }
.formula-operator { color: #94a3b8; }
.formula-total {
  color: #5c6bc0;
  font-weight: 800;
}
.clip-note {
  margin: -6px 0 12px;
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
}
.score-mismatch {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff8e1;
  border: 1px solid #ffe082;
  color: #8d6e00;
  font-size: 13px;
  line-height: 1.5;
}
.industry-meta-label {
  font-size: 12px;
  font-weight: 600;
  color: #5c6bc0;
}
.industry-meta-value {
  font-size: 14px;
  font-weight: 700;
  color: #1f2937;
}
.industry-meta-level {
  font-size: 12px;
  color: #64748b;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eef2ff;
}
.section-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 700;
  color: #334155;
}
.window-table-wrap { margin-bottom: 12px; }
.window-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.window-table th,
.window-table td {
  border: 1px solid #e2e8f0;
  padding: 8px 10px;
  text-align: center;
}
.window-table th {
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
}
.window-note,
.resonance-note,
.resonance-bonus {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
}
.resonance-note { color: #334155; font-weight: 500; }
.return-up { color: #c62828; font-weight: 700; }
.return-down { color: #2e7d32; font-weight: 700; }
.return-flat { color: #616161; font-weight: 600; }
.return-na { color: #9e9e9e; }
</style>
