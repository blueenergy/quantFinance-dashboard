<template>
  <section v-if="narrative" class="portfolio-narrative-card">
    <div class="narr-head">
      <h3>{{ narrative.title || '组合说明' }}</h3>
      <span v-if="narrative.status" class="narr-status">{{ narrative.status }}</span>
    </div>

    <p v-if="narrative.purpose" class="narr-purpose">{{ narrative.purpose }}</p>

    <p v-if="narrative.why" class="narr-line">
      <span class="narr-label">为什么</span>{{ narrative.why }}
    </p>

    <div v-if="facts.length" class="narr-facts">
      <span v-for="f in facts" :key="f.label" class="narr-fact">
        <em>{{ f.label }}</em>{{ f.value }}
      </span>
    </div>

    <p v-if="refs.length" class="narr-line narr-refs">
      <span class="narr-label">依据</span>
      <span v-for="r in refs" :key="r" class="narr-ref">{{ r }}</span>
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  narrative: { type: Object, default: null },
})

const facts = computed(() => {
  const n = props.narrative || {}
  return [
    n.started ? { label: '建立', value: n.started } : null,
    n.review_by ? { label: '复盘', value: n.review_by } : null,
    n.kill ? { label: '终止条件', value: n.kill } : null,
  ].filter(Boolean)
})

const refs = computed(() => {
  const list = props.narrative?.refs
  return Array.isArray(list) ? list.filter(Boolean) : []
})
</script>

<style scoped>
.portfolio-narrative-card {
  border: 1px solid #e5e7eb;
  border-left: 3px solid #6366f1;
  border-radius: 6px;
  background: #f8fafc;
  padding: 10px 14px;
  margin-bottom: 12px;
}

.narr-head {
  align-items: baseline;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
}

.narr-head h3 {
  font-size: 14px;
  font-weight: 700;
  margin: 0;
}

.narr-status {
  color: #475569;
  font-size: 12px;
}

.narr-purpose {
  font-size: 13px;
  margin: 0 0 6px;
}

.narr-line {
  color: #334155;
  font-size: 12px;
  line-height: 1.6;
  margin: 0 0 4px;
}

.narr-label {
  background: #e0e7ff;
  border-radius: 3px;
  color: #3730a3;
  font-size: 11px;
  margin-right: 6px;
  padding: 1px 5px;
}

.narr-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin-top: 4px;
}

.narr-fact {
  color: #475569;
  font-size: 12px;
}

.narr-fact em {
  color: #94a3b8;
  font-style: normal;
  margin-right: 4px;
}

.narr-ref {
  background: #eef2ff;
  border-radius: 3px;
  color: #4338ca;
  font-size: 11px;
  margin-right: 6px;
  padding: 1px 5px;
}
</style>
