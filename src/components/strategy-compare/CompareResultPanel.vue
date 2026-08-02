<template>
  <section class="compare-result-panel card">
    <header class="section-header">
      <div>
        <h4>对比结果</h4>
        <p class="muted">共 {{ rows.length }} 组参数组合</p>
      </div>
      <div v-if="sweepView.sweep_axes?.length" class="combo-pill muted">
        {{ experimentSummaryText }}
      </div>
    </header>

    <div v-if="sweepView.sweep_axes?.length" class="axis-strip">
      <div v-for="axis in sweepView.sweep_axes" :key="axis.key" class="axis-strip-item">
        <span class="axis-strip-label">{{ axis.label }}</span>
        <span class="axis-strip-values">
          {{ axis.values.map((value) => formatAxisValue(axis, value)).join(' · ') }}
        </span>
      </div>
    </div>

    <div class="sweep-tabs" role="tablist">
      <button
        type="button"
        role="tab"
        :class="{ active: activeTab === 'facet' }"
        @click="activeTab = 'facet'"
      >
        分面对比
      </button>
      <button
        type="button"
        role="tab"
        :class="{ active: activeTab === 'grid' }"
        @click="activeTab = 'grid'"
      >
        全量表格
      </button>
    </div>

    <div v-if="activeTab === 'facet'" class="panel-body">
      <p v-if="!hasFacetAxes" class="muted empty-hint">当前任务没有多档扫参轴，请查看全量表格。</p>
      <template v-else>
        <div class="toolbar">
          <span class="toolbar-label">对比维度</span>
          <div class="pill-group">
            <button
              v-for="axis in sweepView.sweep_axes"
              :key="axis.key"
              type="button"
              class="pill"
              :class="{ active: facetAxisKey === axis.key }"
              @click="facetAxisKey = axis.key"
            >
              {{ axis.label }}
            </button>
          </div>
        </div>

        <div class="facet-cards">
          <button
            v-for="entry in facetEntries"
            :key="`${facetAxisKey}-${entry.label}`"
            type="button"
            class="facet-card"
            :class="{ active: facetValuesEqual(facetValue, entry.value) }"
            @click="facetValue = entry.value"
          >
            <div class="facet-card-head">
              <strong>{{ entry.label }}</strong>
              <span v-if="facetValuesEqual(facetValue, entry.value)" class="viewing-badge">查看中</span>
            </div>
            <div class="facet-card-metrics">
              <span><em>收益</em>{{ pct(entry.row?.total_return) }}</span>
              <span><em>夏普</em>{{ num(entry.row?.sharpe_ratio, 3) }}</span>
              <span><em>回撤</em>{{ pct(entry.row?.max_drawdown) }}</span>
              <span><em>胜率</em>{{ pct(entry.row?.win_rate) }}</span>
              <span><em>交易</em>{{ entry.row?.total_trades ?? '-' }}</span>
            </div>
            <p v-if="isLowSample(entry.row)" class="facet-warn">交易过少（{{ entry.row?.total_trades ?? 0 }} 笔），不宜单凭收益判断</p>
          </button>
        </div>

        <div v-if="facetDetailRows.length" class="facet-detail-block">
          <div class="subsection-head">
            <h5>{{ selectedFacetLabel }} · 档位明细</h5>
            <span class="muted">{{ facetDetailRows.length }} 行</span>
          </div>
          <CompareResultTable
            :rows="facetDetailRows"
            :sort-key="sortKey"
            :sort-order="sortOrder"
            :pct="pct"
            :num="num"
            @sort="emit('sort', $event)"
          />
        </div>
      </template>
    </div>

    <div v-else class="panel-body">
      <div v-if="sweepView.sweep_axes?.length" class="filter-panel">
        <div v-for="axis in sweepView.sweep_axes" :key="`filter-${axis.key}`" class="filter-group">
          <span class="toolbar-label">{{ axis.label }}</span>
          <div class="pill-group">
            <button
              type="button"
              class="pill"
              :class="{ active: !gridFilters[axis.key]?.length }"
              @click="gridFilters[axis.key] = []"
            >
              全部
            </button>
            <button
              v-for="value in axis.values"
              :key="`${axis.key}-${JSON.stringify(value)}`"
              type="button"
              class="pill"
              :class="{ active: isFilterActive(axis.key, value) }"
              @click="toggleFilter(axis.key, value)"
            >
              {{ formatAxisValue(axis, value) }}
            </button>
          </div>
        </div>
      </div>

      <p class="muted grid-meta">显示 {{ pageState.items.length }} / {{ pageState.total }} 行</p>

      <CompareResultTable
        :rows="pageState.items"
        :sort-key="sortKey"
        :sort-order="sortOrder"
        :rank-offset="(pageState.page - 1) * pageState.pageSize"
        :pct="pct"
        :num="num"
        @sort="emit('sort', $event)"
      />

      <div v-if="pageState.totalPages > 1" class="pager">
        <button type="button" class="secondary-btn" :disabled="page <= 1" @click="page -= 1">上一页</button>
        <span class="muted">第 {{ pageState.page }} / {{ pageState.totalPages }} 页</span>
        <button type="button" class="secondary-btn" :disabled="page >= pageState.totalPages" @click="page += 1">下一页</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import {
  buildFacetEntries,
  filterRowsByAxis,
  filterRowsBySelections,
  formatAxisValue,
  isLowSample,
} from '../../utils/backtestSweepView'
import CompareResultTable from './CompareResultTable.vue'

const props = defineProps({
  rows: { type: Array, default: () => [] },
  sweepView: { type: Object, default: () => ({ sweep_axes: [], rows: [] }) },
  sortKey: { type: String, default: 'total_return' },
  sortOrder: { type: String, default: 'desc' },
  pct: { type: Function, required: true },
  num: { type: Function, required: true },
})

const emit = defineEmits(['sort'])

const activeTab = ref('facet')
const facetAxisKey = ref('')
const facetValue = ref(undefined)
const page = ref(1)
const pageSize = 50
const gridFilters = reactive({})

const hasFacetAxes = computed(() => (props.sweepView.sweep_axes || []).length > 0)

const experimentSummaryText = computed(() => {
  const axes = props.sweepView.sweep_axes || []
  if (!axes.length) return ''
  return axes.map((axis) => `${axis.label} ${axis.values.length} 档`).join(' · ')
})

const facetAxis = computed(() =>
  (props.sweepView.sweep_axes || []).find((axis) => axis.key === facetAxisKey.value),
)

const facetEntries = computed(() =>
  buildFacetEntries(props.rows, facetAxis.value, props.sortKey),
)

const selectedFacetLabel = computed(() => {
  const entry = facetEntries.value.find((item) => facetValuesEqual(facetValue.value, item.value))
  return entry?.label || '未选择'
})

const facetDetailRows = computed(() => {
  if (facetValue.value === undefined || !facetAxis.value) return []
  return filterRowsByAxis(props.rows, facetAxis.value, facetValue.value)
})

const filteredGridRows = computed(() =>
  filterRowsBySelections(props.rows, props.sweepView.sweep_axes || [], gridFilters),
)

const pageState = computed(() => {
  const total = filteredGridRows.value.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page.value, totalPages)
  const start = (safePage - 1) * pageSize
  return {
    page: safePage,
    pageSize,
    total,
    totalPages,
    items: filteredGridRows.value.slice(start, start + pageSize),
  }
})

watch(
  () => props.sweepView.sweep_axes,
  (axes) => {
    if (!axes?.length) {
      activeTab.value = 'grid'
      return
    }
    if (!facetAxisKey.value || !axes.some((axis) => axis.key === facetAxisKey.value)) {
      facetAxisKey.value = axes[0].key
      facetValue.value = axes[0].values?.[0]
    }
    for (const axis of axes) {
      if (!Array.isArray(gridFilters[axis.key])) gridFilters[axis.key] = []
    }
  },
  { immediate: true },
)

watch(facetEntries, (entries) => {
  if (!entries.length) {
    facetValue.value = undefined
    return
  }
  if (facetValue.value === undefined || !entries.some((e) => facetValuesEqual(facetValue.value, e.value))) {
    facetValue.value = entries[0].value
  }
})

function facetValuesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function isFilterActive(axisKey, value) {
  const selected = gridFilters[axisKey] || []
  return selected.some((item) => JSON.stringify(item) === JSON.stringify(value))
}

function toggleFilter(axisKey, value) {
  const selected = gridFilters[axisKey] || []
  const idx = selected.findIndex((item) => JSON.stringify(item) === JSON.stringify(value))
  if (idx >= 0) {
    selected.splice(idx, 1)
  } else {
    selected.push(value)
  }
  gridFilters[axisKey] = selected
  page.value = 1
}
</script>

<style scoped>
.card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  min-width: 0;
}

.panel-body {
  min-width: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.muted {
  color: #64748b;
}

.axis-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.axis-strip-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
}

.sweep-tabs {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.sweep-tabs button {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #334155;
  border-radius: 999px;
  padding: 6px 14px;
  cursor: pointer;
}

.sweep-tabs button.active {
  background: #0f6bdc;
  border-color: #0f6bdc;
  color: #fff;
}

.toolbar,
.filter-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.toolbar-label {
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
}

.pill-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pill {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}

.pill.active {
  background: #eff6ff;
  border-color: #2563eb;
  color: #1d4ed8;
}

.facet-cards {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.facet-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
  padding: 12px;
  text-align: left;
  cursor: pointer;
}

.facet-card.active {
  border-color: #2563eb;
  box-shadow: 0 0 0 1px #2563eb;
}

.facet-card-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
}

.facet-card-metrics em {
  color: #64748b;
  font-style: normal;
  margin-right: 4px;
}

.viewing-badge {
  background: #dbeafe;
  color: #1d4ed8;
  border-radius: 999px;
  font-size: 11px;
  padding: 2px 8px;
}

.facet-warn {
  color: #b45309;
  font-size: 11px;
  margin: 8px 0 0;
}

.pager {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.secondary-btn {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
}
</style>
