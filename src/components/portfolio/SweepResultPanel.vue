<template>
  <section class="sweep-result-panel">
    <header v-if="sweepView.sweep_axes?.length" class="sweep-summary">
      <h4>实验摘要</h4>
      <p class="muted">{{ experimentSummaryText }}</p>
      <div class="axis-tags">
        <span v-for="axis in sweepView.sweep_axes" :key="axis.key" class="axis-tag">
          {{ axis.label }}: {{ axis.values.map((value) => formatAxisValue(axis.key, value)).join(', ') }}
        </span>
      </div>
    </header>

    <div class="sweep-tabs">
      <button type="button" :class="{ active: activeTab === 'facet' }" @click="activeTab = 'facet'">分面对比</button>
      <button type="button" :class="{ active: activeTab === 'grid' }" @click="activeTab = 'grid'">全量表格</button>
    </div>

    <div v-if="activeTab === 'facet'">
      <p v-if="!hasFacetAxes" class="muted">当前任务没有多档扫参轴，请查看全量表格。</p>
      <template v-else>
        <label class="facet-axis-picker">
          对比维度
          <select v-model="facetAxisKey">
            <option v-for="axis in sweepView.sweep_axes" :key="axis.key" :value="axis.key">{{ axis.label }}</option>
          </select>
        </label>

        <div class="facet-best-table-wrap">
          <table>
            <thead>
              <tr>
                <th>档位</th>
                <th>Variant</th>
                <th>TopN</th>
                <th>收益</th>
                <th>超额</th>
                <th>综合分</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="entry in facetEntries"
                :key="`${facetAxisKey}-${entry.label}`"
                :class="{ 'selected-result-row': isSelectedRow(entry.row) }"
                @click="facetValue = entry.value"
              >
                <td>{{ entry.label }}</td>
                <td>{{ entry.row?.variant || '-' }}</td>
                <td>{{ entry.row?.top_n ?? '-' }}</td>
                <td>{{ pct(entry.row?.cumulative_return) }}</td>
                <td>{{ pct(entry.row?.index_excess_cumulative_return) }}</td>
                <td>{{ num(entry.row?.risk_adjusted_score, 3) }}</td>
                <td class="detail-cell">
                  <button type="button" class="link-btn" @click="selectRow(entry.row)">选为候选</button>
                  <button
                    v-if="entry.row?.combo_key && entry.row?.has_detail !== false"
                    type="button"
                    class="link-btn"
                    @click="$emit('open-combo', entry.row)"
                  >
                    成交
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="facetDetailRows.length" class="facet-detail-block">
          <h5>
            {{ selectedFacetLabel }} 档位明细
            <span class="muted">（{{ facetDetailRows.length }} 行）</span>
          </h5>
          <ResultGridTable
            :rows="facetDetailRows"
            :sweep-axes="sweepView.sweep_axes"
            :selected-row="selectedRow"
            :format-axis-value="formatAxisValue"
            :pct="pct"
            :num="num"
            @select-row="selectRow"
            @open-combo="$emit('open-combo', $event)"
          />
        </div>
      </template>
    </div>

    <div v-else>
      <div class="grid-filters">
        <label v-for="axis in sweepView.sweep_axes" :key="`filter-${axis.key}`">
          {{ axis.label }}
          <select v-model="gridFilters[axis.key]" multiple size="3">
            <option v-for="value in axis.values" :key="`${axis.key}-${value}`" :value="value">
              {{ formatAxisValue(axis.key, value) }}
            </option>
          </select>
        </label>
        <button type="button" class="secondary-btn" @click="resetGridFilters">清空筛选</button>
      </div>

      <p class="muted grid-meta">
        显示 {{ pageState.items.length }} / {{ pageState.total }} 行
        <span v-if="rowCountTotal > rows.length">（Mongo 预览 {{ rows.length }} 行，完整数据见 JSON 产物）</span>
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
        @open-combo="$emit('open-combo', $event)"
      />

      <div class="pager">
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
  paginateRows,
} from '../utils/sweepResultView'
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
const facetValue = ref(null)
const page = ref(1)
const pageSize = 50
const gridFilters = reactive({})

const rows = computed(() => props.resultDetail?.rows || [])
const rowCountTotal = computed(() => Number(props.resultDetail?.row_count_total || rows.value.length))
const sweepView = computed(() => buildSweepResultView(props.resultDetail, props.job?.params || props.resultDetail?.params))
const experimentSummaryText = computed(() => experimentSummary(sweepView.value))
const hasFacetAxes = computed(() => (sweepView.value.sweep_axes || []).length > 0)

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
  if (facetValue.value == null) return '全部'
  return formatAxisValue(facetAxisKey.value, facetValue.value)
})

const facetDetailRows = computed(() => {
  if (facetValue.value == null && facetEntries.value.length) {
    const first = facetEntries.value[0]
    return filterRowsByFacet(rows.value, facetAxisKey.value, first.value)
  }
  if (facetValue.value != null) {
    return filterRowsByFacet(rows.value, facetAxisKey.value, facetValue.value)
  }
  return []
})

watch(facetAxisKey, () => {
  facetValue.value = facetEntries.value[0]?.value ?? null
})

watch(facetEntries, (entries) => {
  if (!entries.length) {
    facetValue.value = null
    return
  }
  if (!entries.some((entry) => entry.value === facetValue.value)) {
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

function isSelectedRow(row) {
  if (!row || !props.selectedRow) return false
  return row === props.selectedRow
    || (row.combo_key && row.combo_key === props.selectedRow.combo_key)
    || (
      row.top_n === props.selectedRow.top_n
      && row.variant === props.selectedRow.variant
      && row.score_variant === props.selectedRow.score_variant
      && row.trailing_stop_pct === props.selectedRow.trailing_stop_pct
    )
}

function resetGridFilters() {
  for (const axis of sweepView.value.sweep_axes || []) {
    gridFilters[axis.key] = []
  }
}
</script>

<style scoped>
.sweep-result-panel {
  display: grid;
  gap: 16px;
}

.sweep-summary h4 {
  margin: 0 0 6px;
}

.axis-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.axis-tag {
  display: inline-flex;
  padding: 4px 10px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #334155;
  font-size: 12px;
}

.sweep-tabs {
  display: flex;
  gap: 8px;
}

.sweep-tabs button {
  border: 1px solid #dbe3ee;
  background: #fff;
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
}

.sweep-tabs button.active {
  border-color: #0f6bdc;
  color: #0f6bdc;
  background: #eff6ff;
}

.facet-axis-picker,
.grid-filters label {
  display: grid;
  gap: 4px;
  font-size: 13px;
}

.grid-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: end;
}

.facet-best-table-wrap,
.grid-meta,
.pager {
  margin-top: 8px;
}

.facet-detail-block {
  margin-top: 16px;
}

.pager {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
