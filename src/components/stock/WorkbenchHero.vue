<template>
  <section class="hero-card">
    <div class="hero-main">
      <p class="eyebrow">{{ industry || '行业未覆盖' }}</p>
      <h1>{{ name || fallbackSymbol }} <span>{{ symbol }}</span></h1>
      <div class="hero-tags">
        <span v-if="industryL2">{{ industryL2 }}</span>
        <span v-if="industryL3">{{ industryL3 }}</span>
        <span v-for="code in indexCodes" :key="code">{{ code }}</span>
      </div>
      <div class="section-status-row">
        <button
          v-for="item in sectionStatusItems"
          :key="item.key"
          type="button"
          class="section-status-chip"
          :class="{ 'is-missing': !item.found, 'is-stale': item.stale }"
          :title="item.title"
          @click="$emit('select-panel', item.panel)"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.found ? '已覆盖' : '暂无' }}</strong>
          <small v-if="item.asOf">{{ item.asOf }}</small>
        </button>
      </div>
    </div>
    <div class="hero-metrics">
      <div>
        <small>最新价</small>
        <strong>{{ fmtNumber(latestPrice) }}</strong>
        <span v-if="quoteLoading" class="muted">行情刷新中…</span>
        <span
          v-else
          class="price-change-line"
          :class="changeClass"
          :title="priceChangeTitle"
        >
          日涨跌幅 {{ fmtPct(latestPctChange) }}
        </span>
      </div>
      <div>
        <small>综合评分</small>
        <strong>{{ fmtNumber(compositeScore) }}</strong>
        <span>{{ ratingText }}</span>
      </div>
      <div>
        <small>数据日期</small>
        <strong>评分 {{ scoreDate || '-' }}</strong>
        <span>行情 {{ quoteDate || '未覆盖' }}</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { fmtNumber, fmtPct } from '../../utils/workbenchFormat'

defineProps({
  name: { type: String, default: '' },
  symbol: { type: String, default: '' },
  fallbackSymbol: { type: String, default: '' },
  industry: { type: String, default: '' },
  industryL2: { type: String, default: '' },
  industryL3: { type: String, default: '' },
  indexCodes: { type: Array, default: () => [] },
  sectionStatusItems: { type: Array, default: () => [] },
  latestPrice: { type: [Number, String], default: null },
  latestPctChange: { type: [Number, String], default: null },
  changeClass: { type: String, default: '' },
  priceChangeTitle: { type: String, default: '' },
  quoteLoading: { type: Boolean, default: false },
  compositeScore: { type: [Number, String], default: null },
  ratingText: { type: String, default: '' },
  scoreDate: { type: String, default: '' },
  quoteDate: { type: String, default: '' },
})

defineEmits(['select-panel'])
</script>

<style scoped>
.hero-card {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: 18px;
  box-shadow: var(--surface-shadow);
  display: grid;
  gap: 22px;
  grid-template-columns: minmax(0, 1fr) auto;
  margin-bottom: 16px;
  padding: 24px;
}
.eyebrow {
  color: var(--color-primary);
  font-size: 12px;
  letter-spacing: .08em;
  margin: 0 0 5px;
  text-transform: uppercase;
}
.hero-main h1 {
  color: var(--text-primary);
  font-size: 34px;
  margin: 0;
}
.hero-main h1 span {
  color: var(--text-muted);
  font-size: 20px;
  font-weight: 500;
}
.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.hero-tags span {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  color: #1d4ed8;
  padding: 5px 10px;
}
.section-status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}
.section-status-chip {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 14px;
  color: #15803d;
  cursor: pointer;
  display: grid;
  gap: 2px;
  min-width: 116px;
  padding: 9px 12px;
  text-align: left;
}
.section-status-chip:hover {
  background: #dcfce7;
}
.section-status-chip.is-missing {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: var(--text-subtle);
}
.section-status-chip.is-stale {
  background: #fffbeb;
  border-color: #fcd34d;
  color: #b45309;
}
.section-status-chip span {
  font-size: 12px;
  opacity: .86;
}
.section-status-chip strong {
  font-size: 14px;
}
.section-status-chip small {
  color: inherit;
  font-size: 11px;
  opacity: .72;
}
.hero-metrics {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, 130px);
}
.hero-metrics div {
  background: var(--surface-bg-muted);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 14px;
}
.hero-metrics small {
  color: var(--text-muted);
  display: block;
  font-size: 12px;
}
.hero-metrics strong {
  color: var(--text-primary);
  display: block;
  font-size: 22px;
  margin: 4px 0;
}
.hero-metrics .muted,
.price-change-line {
  color: var(--text-muted);
  display: block;
  font-size: 12px;
  line-height: 1.35;
}
.price-change-line {
  cursor: help;
}
.price-change-line.is-up {
  color: #dc2626;
}
.price-change-line.is-down {
  color: #15803d;
}
@media (max-width: 980px) {
  .hero-card {
    grid-template-columns: 1fr;
  }
  .hero-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
