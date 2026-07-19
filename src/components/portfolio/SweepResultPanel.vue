<template>
  <section class="sweep-result-panel card">
    <header class="section-header">
      <div>
        <h4>结果排行</h4>
        <p class="muted">
          共 {{ rowCountTotal }} 组参数组合
          <span v-if="rowCountTotal > rows.length"> · 界面预览 {{ rows.length }} 行</span>
        </p>
        <p v-if="selectedRow && candidateSummary" class="candidate-strip">
          <span class="candidate-strip-label">发布候选</span>
          {{ candidateSummary }}
        </p>
      </div>
      <div v-if="sweepView.sweep_axes?.length" class="combo-pill muted">
        {{ experimentSummaryText }}
      </div>
    </header>

    <div v-if="sweepView.sweep_axes?.length" class="axis-strip">
      <div v-for="axis in sweepView.sweep_axes" :key="axis.key" class="axis-strip-item">
        <span class="axis-strip-label">{{ axis.label }}</span>
        <span class="axis-strip-values">
          {{ axis.values.map((value) => formatAxisValue(axis.key, value)).join(' · ') }}
        </span>
      </div>
    </div>

    <div class="sweep-tabs" role="tablist">
      <button
        type="button"
        role="tab"
        :class="{ active: activeTab === 'facet' }"
        :aria-selected="activeTab === 'facet'"
        @click="activeTab = 'facet'"
      >
        分面对比
      </button>
      <button
        type="button"
        role="tab"
        :class="{ active: activeTab === 'grid' }"
        :aria-selected="activeTab === 'grid'"
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
        <p class="facet-hint muted">
          点击档位卡片查看下方明细。橙色高亮行是<strong>发布候选</strong>（将保存为参数预设），与当前查看的档位无关。
        </p>

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
              <span><em>TopN</em>{{ entry.row?.top_n ?? '-' }}</span>
              <span><em>收益</em>{{ pct(entry.row?.cumulative_return) }}</span>
              <span><em>超额</em>{{ pct(entry.row?.index_excess_cumulative_return) }}</span>
              <span><em>综合分</em>{{ num(entry.row?.risk_adjusted_score, 3) }}</span>
            </div>
            <div class="facet-card-actions" @click.stop>
              <button type="button" class="link-btn" @click="selectRow(entry.row)">选为候选</button>
              <button
                v-if="entry.row?.combo_key && entry.row?.has_detail !== false"
                type="button"
                class="link-btn"
                @click="openCombo(entry.row)"
              >
                成交明细
              </button>
            </div>
          </button>
        </div>

        <div v-if="facetDetailRows.length" class="facet-detail-block">
          <div class="subsection-head">
            <h5>{{ selectedFacetLabel }} · 档位明细</h5>
            <span class="muted">{{ facetDetailRows.length }} 行</span>
          </div>
          <ResultGridTable
            :rows="facetDetailRows"
            :sweep-axes="detailAxes"
            :selected-row="selectedRow"
            :format-axis-value="formatAxisValue"
            :pct="pct"
            :num="num"
            compact
            @select-row="selectRow"
            @open-combo="openCombo"
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
              :key="`${axis.key}-${value}`"
              type="button"
              class="pill"
              :class="{ active: isFilterActive(axis.key, value) }"
              @click="toggleFilter(axis.key, value)"
            >
              {{ formatAxisValue(axis.key, value) }}
            </button>
          </div>
        </div>
      </div>

      <p class="muted grid-meta">
        显示 {{ pageState.items.length }} / {{ pageState.total }} 行
      </p>

      <ResultGridTable
        :rows="pageState.items"
        :sweep-axes="sweepView.sweep_axes"
        :selected-row="selectedRow"
        :rank-offset="(pageState.page - 1) * pageState.pageSize"
        :format-axis-value="formatAxisValue"
        :pct="pct"
        :num="num"
        @select-row="selectRow"
        @open-combo="openCombo"
      />

      <div v-if="pageState.totalPages > 1" class="pager">
        <button type="button" class="secondary-btn" :disabled="pageState.page <= 1" @click="page -= 1">上一页</button>
        <span class="muted">第 {{ pageState.page }} / {{ pageState.totalPages }} 页</span>
        <button type="button" class="secondary-btn" :disabled="pageState.page >= pageState.totalPages" @click="page += 1">下一页</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import {
  buildSweepResultView,
  experimentSummary,
  filterRowsByFacet,
  filterRowsBySelections,
  formatAxisValue,
  normalizeAxisValue,
  paginateRows,
} from '../../utils/sweepResultView'
import ResultGridTable from './ResultGridTable.vue'

const props = defineProps({
  resultDetail: { type: Object, default: null },
  job: { type: Object, default: null },
  selectedRow: { type: Object, default: null },
  pct: { type: Function, required: true },
  num: { type: Function, required: true },
})

const emit = defineEmits(['select-row', 'open-combo'])

const activeTab = ref('facet')
const facetAxisKey = ref('')
// undefined = no facet selected; null is a valid value (trailing stop off).
const facetValue = ref(undefined)
const page = ref(1)
const pageSize = 50
const gridFilters = reactive({})

const rows = computed(() => props.resultDetail?.rows || [])
const rowCountTotal = computed(() => Number(props.resultDetail?.row_count_total || rows.value.length))
const sweepView = computed(() => buildSweepResultView(props.resultDetail, props.job?.params || props.resultDetail?.params))
const experimentSummaryText = computed(() => experimentSummary(sweepView.value))
const hasFacetAxes = computed(() => (sweepView.value.sweep_axes || []).length > 0)

const candidateSummary = computed(() => {
  const row = props.selectedRow
  if (!row) return ''
  const parts = []
  const axisKeys = new Set()
  for (const axis of sweepView.value.sweep_axes || []) {
    axisKeys.add(axis.key)
    const label = formatAxisValue(axis.key, row[axis.key])
    if (label && label !== '-') parts.push(`${axis.label} ${label}`)
  }
  if (row.variant) parts.push(row.variant)
  if (!axisKeys.has('top_n') && row.top_n != null) parts.push(`Top${row.top_n}`)
  const score = props.num(row.risk_adjusted_score, 3)
  if (score && score !== '-') parts.push(`综合分 ${score}`)
  return parts.join(' · ')
})

const detailAxes = computed(() =>
  (sweepView.value.sweep_axes || []).filter((axis) => axis.key !== facetAxisKey.value))

watch(
  () => sweepView.value.sweep_axes,
  (axes) => {
    if (!axes?.length) {
      activeTab.value = 'grid'
      return
    }
    if (!facetAxisKey.value || !axes.some((axis) => axis.key === facetAxisKey.value)) {
      facetAxisKey.value = axes[0].key
    }
    for (const axis of axes) {
      if (!Array.isArray(gridFilters[axis.key])) gridFilters[axis.key] = []
    }
  },
  { immediate: true },
)

const facetEntries = computed(() => sweepView.value.facet_best?.[facetAxisKey.value] || [])

const selectedFacetLabel = computed(() => {
  if (facetValue.value === undefined) return ''
  return formatAxisValue(facetAxisKey.value, facetValue.value)
})

const facetDetailRows = computed(() => {
  if (facetValue.value === undefined) return []
  return filterRowsByFacet(rows.value, facetAxisKey.value, facetValue.value)
})

function facetValuesEqual(left, right) {
  if (left === right) return true
  if (left === undefined || right === undefined) return false
  return normalizeAxisValue(facetAxisKey.value, left) === normalizeAxisValue(facetAxisKey.value, right)
}

watch(facetAxisKey, () => {
  facetValue.value = facetEntries.value[0]?.value
})

watch(facetEntries, (entries) => {
  if (!entries.length) {
    facetValue.value = undefined
    return
  }
  if (facetValue.value === undefined || !entries.some((entry) => facetValuesEqual(entry.value, facetValue.value))) {
    facetValue.value = entries[0].value
  }
}, { immediate: true })

const filteredGridRows = computed(() => filterRowsBySelections(rows.value, gridFilters))
const pageState = computed(() => paginateRows(filteredGridRows.value, page.value, pageSize))

watch(gridFilters, () => {
  page.value = 1
}, { deep: true })

function selectRow(row) {
  emit('select-row', row)
}

function openCombo(row) {
  emit('open-combo', row)
}

function isFilterActive(axisKey, value) {
  const selected = gridFilters[axisKey] || []
  return selected.some((item) => normalizeAxisValue(axisKey, item) === normalizeAxisValue(axisKey, value))
}

function toggleFilter(axisKey, value) {
  const normalized = normalizeAxisValue(axisKey, value)
  const current = [...(gridFilters[axisKey] || [])]
  const index = current.findIndex((item) => normalizeAxisValue(axisKey, item) === normalized)
  if (index >= 0) {
    current.splice(index, 1)
  } else {
    current.push(value)
  }
  gridFilters[axisKey] = current
}
</script>

<style scoped>
.sweep-result-panel {
  display: grid;
  gap: 18px;
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.section-header h4 {
  margin: 0 0 4px;
}

.combo-pill {
  padding: 6px 12px;
  border-radius: 999px;
  background: #f8fafc;
  border: 1px solid #e6eaf0;
  font-size: 12px;
  white-space: nowrap;
}

.candidate-strip {
  margin: 6px 0 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  font-size: 12px;
  color: #9a3412;
  line-height: 1.5;
}

.candidate-strip-label {
  display: inline-block;
  margin-right: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f97316;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.axis-strip {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #edf0f5;
}

.axis-strip-item {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 13px;
}

.axis-strip-label {
  color: #64748b;
  font-weight: 700;
  min-width: 72px;
}

.axis-strip-values {
  color: #334155;
}

.sweep-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border-radius: 10px;
  background: #f1f5f9;
  width: fit-content;
}

.sweep-tabs button {
  border: none;
  background: transparent;
  border-radius: 8px;
  padding: 7px 14px;
  cursor: pointer;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
}

.sweep-tabs button.active {
  background: #fff;
  color: #0f6bdc;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .08);
}

.panel-body {
  display: grid;
  gap: 16px;
}

.toolbar,
.filter-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
}

.toolbar-label {
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  min-width: 64px;
}

.pill-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pill {
  border: 1px solid #d7dde7;
  background: #fff;
  color: #334155;
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
}

.pill.active {
  border-color: #0f6bdc;
  background: #eff6ff;
  color: #0f6bdc;
  font-weight: 700;
}

.facet-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.facet-card {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid #e6eaf0;
  border-radius: 12px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition: border-color .15s ease, box-shadow .15s ease;
}

.facet-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 2px 8px rgba(15, 23, 42, .06);
}

.facet-card.active {
  border-color: #0f6bdc;
  background: #eff6ff;
  box-shadow: 0 0 0 1px rgba(15, 107, 220, .15);
}

.viewing-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: #0f6bdc;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.facet-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}

.facet-hint strong {
  color: #c2410c;
  font-weight: 700;
}

.facet-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.facet-card-head strong {
  font-size: 15px;
  color: #172033;
}

.facet-card-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  font-size: 13px;
}

.facet-card-metrics em {
  display: block;
  margin-bottom: 2px;
  color: #94a3b8;
  font-size: 11px;
  font-style: normal;
  font-weight: 700;
}

.facet-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.subsection-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.subsection-head h5 {
  margin: 0;
  font-size: 14px;
}

.filter-panel {
  display: grid;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #edf0f5;
  border-radius: 10px;
  background: #fcfdff;
}

.grid-meta,
.empty-hint {
  margin: 0;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.link-btn {
  border: none;
  background: transparent;
  color: #0f6bdc;
  padding: 0;
  cursor: pointer;
  font: inherit;
  text-decoration: underline;
}

.secondary-btn {
  border: 1px solid #d7dde7;
  background: #fff;
  color: #334155;
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
}

.secondary-btn:disabled {
  opacity: .45;
  cursor: not-allowed;
}

.muted {
  color: #64748b;
}

.card {
  background: #fff;
  border: 1px solid #e6eaf0;
  border-radius: 14px;
  padding: 22px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
}
</style>
