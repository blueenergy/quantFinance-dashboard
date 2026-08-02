<template>
  <table class="param-grid-table">
    <thead>
      <tr>
        <th>参数</th>
        <th>默认值</th>
        <th>实验值</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.key">
        <td class="param-name">
          <span class="param-key">{{ row.key }}</span>
          <small v-if="row.label && row.label !== row.key" class="param-desc">{{ row.label }}</small>
        </td>
        <td class="param-current">{{ formatParamDisplay(row.baseline) }}</td>
        <td class="param-next">
          <input
            :value="row.experimentRaw"
            :placeholder="formatParamDisplay(row.baseline)"
            @input="onInput(row.key, $event.target.value)"
          />
          <span v-if="row.levelCount > 1" class="level-badge">{{ row.levelCount }} 档</span>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup>
import { computed } from 'vue'
import { formatParamDisplay } from '../../utils/strategyLabParams'
import { inferParamType, parseExperimentValues } from '../../utils/backtestComboPayload'

const props = defineProps({
  paramsWithDesc: { type: Object, default: () => ({}) },
  experimentValues: { type: Object, default: () => ({}) },
  paramLabels: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:experimentValues'])

const rows = computed(() => {
  const out = []
  const desc = props.paramsWithDesc || {}
  for (const [key, cfg] of Object.entries(desc)) {
    const baseline = cfg?.value
    const experimentRaw = props.experimentValues?.[key] ?? ''
    let levelCount = 1
    if (String(experimentRaw).trim()) {
      try {
        levelCount = parseExperimentValues(experimentRaw, baseline).length
      } catch {
        levelCount = 1
      }
    }
    out.push({
      key,
      label: props.paramLabels?.[key] || key,
      baseline,
      experimentRaw,
      levelCount,
      type: inferParamType(baseline),
    })
  }
  return out
})

function onInput(key, value) {
  const next = { ...(props.experimentValues || {}), [key]: value }
  emit('update:experimentValues', next)
}
</script>

<style scoped>
.param-grid-table {
  border-collapse: collapse;
  width: 100%;
}

th,
td {
  border-bottom: 1px solid #e2e8f0;
  padding: 8px;
  text-align: left;
  vertical-align: top;
}

th {
  color: #475569;
  font-size: 12px;
}

.param-key {
  font-weight: 600;
}

.param-desc {
  color: #64748b;
  display: block;
}

.param-next {
  display: flex;
  align-items: center;
  gap: 8px;
}

.param-next input {
  flex: 1;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 6px 8px;
  font: inherit;
}

.level-badge {
  background: #eff6ff;
  color: #1d4ed8;
  border-radius: 999px;
  font-size: 11px;
  padding: 2px 8px;
  white-space: nowrap;
}
</style>
