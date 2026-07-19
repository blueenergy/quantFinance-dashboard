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
  background: rgba(15, 23, 42, 0.76);
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 18px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
  display: grid;
  gap: 22px;
  grid-template-columns: minmax(0, 1fr) auto;
  margin-bottom: 16px;
  padding: 24px;
}
.eyebrow {
  color: #93c5fd;
  font-size: 12px;
  letter-spacing: .08em;
  margin: 0 0 5px;
  text-transform: uppercase;
}
.hero-main h1 {
  color: #f8fafc;
  font-size: 34px;
  margin: 0;
}
.hero-main h1 span {
  color: #94a3b8;
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
  background: rgba(96, 165, 250, .12);
  border: 1px solid rgba(96, 165, 250, .24);
  border-radius: 999px;
  color: #bfdbfe;
  padding: 5px 10px;
}
.section-status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}
.section-status-chip {
  background: rgba(34, 197, 94, .10);
  border: 1px solid rgba(34, 197, 94, .30);
  border-radius: 14px;
  color: #dcfce7;
  cursor: pointer;
  display: grid;
  gap: 2px;
  min-width: 116px;
  padding: 9px 12px;
  text-align: left;
}
.section-status-chip:hover {
  background: rgba(34, 197, 94, .18);
}
.section-status-chip.is-missing {
  background: rgba(148, 163, 184, .10);
  border-color: rgba(148, 163, 184, .24);
  color: #cbd5e1;
}
.section-status-chip.is-stale {
  background: rgba(245, 158, 11, .12);
  border-color: rgba(245, 158, 11, .35);
  color: #fde68a;
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
  background: rgba(30, 41, 59, .78);
  border-radius: 14px;
  padding: 14px;
}
.hero-metrics small {
  color: #94a3b8;
  display: block;
  font-size: 12px;
}
.hero-metrics strong {
  color: #f8fafc;
  display: block;
  font-size: 22px;
  margin: 4px 0;
}
.hero-metrics .muted,
.price-change-line {
  color: #94a3b8;
  display: block;
  font-size: 12px;
  line-height: 1.35;
}
.price-change-line {
  cursor: help;
}
.price-change-line.is-up {
  color: #ef4444;
}
.price-change-line.is-down {
  color: #22c55e;
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
