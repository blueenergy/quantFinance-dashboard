<template>
  <div v-if="hasContent" class="score-provenance-header">
    <div class="prov-chips">
      <span v-if="meta.score_date" class="prov-chip">
        评分日 <strong>{{ formatDate(meta.score_date) }}</strong>
      </span>
      <span v-if="meta.algorithm_version" class="prov-chip">
        算法 <strong>{{ meta.algorithm_version }}</strong>
      </span>
      <span
        v-if="meta.details_schema_version != null"
        class="prov-chip"
        :class="{ 'prov-chip--legacy': meta.details_schema_version === 0 }"
      >
        详情结构 <strong>v{{ meta.details_schema_version }}</strong>
        <template v-if="meta.details_schema_version === 0">（历史文档）</template>
      </span>
      <span v-if="meta.lookahead_rule" class="prov-chip prov-chip--muted" :title="meta.lookahead_rule">
        前视规则
      </span>
      <span v-if="meta.reduced_mode" class="prov-chip prov-chip--warn">
        精简模式
      </span>
      <span
        v-if="meta.dimensions_computed?.length"
        class="prov-chip prov-chip--muted"
      >
        已计算 {{ meta.dimensions_computed.length }} 维
      </span>
    </div>

    <div v-if="expressNotice" class="express-banner">
      <span class="express-banner__icon">⚠️</span>
      <span>{{ expressNotice }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { extractExpressFromDetails, normalizeScoreMeta } from '../../utils/scoreDetail.js'

const props = defineProps({
  meta: { type: Object, default: null },
  details: { type: Object, default: null },
  scoreDate: { type: String, default: '' },
})

const meta = computed(() => normalizeScoreMeta(props.meta, props.details, props.scoreDate))

const hasContent = computed(() => {
  const m = meta.value
  return Boolean(
    m.score_date
    || m.algorithm_version
    || m.reduced_mode
    || expressNotice.value,
  )
})

const expressNotice = computed(() => {
  const express = {
    ...extractExpressFromDetails(props.details),
    ...(meta.value.express || {}),
  }
  if (!Object.keys(express).length) return ''
  const parts = []
  if (express.data_source || express.express_source) {
    parts.push(`数据来源：${express.data_source || express.express_source}`)
  }
  if (express.express_discount != null) {
    const pct = Math.round(Number(express.express_discount) * 100)
    parts.push(`快报折扣：综合分按 ${pct}% 计`)
  }
  return parts.join('；') || '含快报/ provisional 数据，正式财报后可能调整'
})

function formatDate(raw) {
  const s = String(raw || '')
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return s
}
</script>

<style scoped>
.score-provenance-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.prov-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.prov-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 0.78rem;
  background: #fff;
  border: 1px solid #e2e8f0;
  color: #475569;
}

.prov-chip strong {
  color: #1e293b;
  font-weight: 700;
}

.prov-chip--muted {
  color: #94a3b8;
  border-style: dashed;
}

.prov-chip--legacy {
  border-color: #fcd34d;
  background: #fffbeb;
}

.prov-chip--warn {
  border-color: #fca5a5;
  background: #fef2f2;
  color: #991b1b;
}

.express-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  background: #fff7ed;
  border: 1px solid #fdba74;
  color: #9a3412;
  font-size: 0.82rem;
  line-height: 1.4;
}

.express-banner__icon {
  flex-shrink: 0;
}
</style>
