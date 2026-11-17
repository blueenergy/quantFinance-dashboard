<template>
  <aside class="card catalog-panel">
    <div class="catalog-head">
      <div>
        <h3>模型目录</h3>
        <p class="muted">
          按生命周期状态管理模型；点击一行查看配方、验证、artifact 与状态历史。
        </p>
      </div>
      <button type="button" :disabled="loading" @click="$emit('refresh')">刷新</button>
    </div>

    <div class="state-board">
      <button
        v-for="item in stateCards"
        :key="item.key"
        type="button"
        class="state-card"
        :class="[item.key, { active: stateFilterActive(item.key) }]"
        @click="toggleState(item.key)"
      >
        <span>{{ item.label }}</span>
        <strong>{{ stateCount(item.key) }}</strong>
      </button>
      <div class="state-card accepted">
        <span>accepted</span>
        <strong>{{ summary?.accepted ?? 0 }}</strong>
      </div>
    </div>

    <p v-if="summary?.active_stale" class="stale-alert">
      {{ summary.active_stale }} 个 active 模型最近预测不是最新交易日。
    </p>

    <div class="catalog-filters">
      <select :value="filters.index_code" @change="patch({ index_code: $event.target.value })">
        <option value="">全部指数池</option>
        <option v-for="code in indexOptions" :key="code" :value="code">{{ code }}</option>
      </select>
      <select :value="filters.accepted" @change="patch({ accepted: $event.target.value })">
        <option value="">全部 accepted</option>
        <option value="true">accepted = true</option>
        <option value="false">accepted = false</option>
      </select>
      <input
        :value="filters.q"
        type="search"
        placeholder="搜索 model_id / family"
        @input="patch({ q: $event.target.value })"
      />
      <button
        v-if="filters.state || filters.index_code || filters.accepted || filters.q"
        type="button"
        class="clear-filters"
        @click="clearFilters"
      >
        清除筛选
      </button>
    </div>

    <p v-if="loading" class="muted">加载中...</p>
    <p v-else-if="!models.length" class="muted">没有匹配的模型。</p>

    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>模型</th>
            <th>指数</th>
            <th>状态</th>
            <th>accepted</th>
            <th>验证</th>
            <th>training gate</th>
            <th>最近预测</th>
            <th>日期/条数</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="model in models"
            :key="model.model_id"
            :class="{ active: selectedModelId === model.model_id }"
            @click="$emit('select-model', model.model_id)"
          >
            <td class="model-cell">
              <strong>{{ model.model_id }}</strong>
              <small>{{ model.family_id || '-' }}</small>
            </td>
            <td>{{ model.index_code || '-' }}</td>
            <td>
              <span class="state-badge" :class="model.state">{{ stateLabel(model.state) }}</span>
            </td>
            <td>
              <span :class="['accepted-pill', model.accepted ? 'yes' : 'no']">
                {{ model.accepted ? '是' : '否' }}
              </span>
            </td>
            <td>{{ validationLabel(model) }}</td>
            <td>{{ gateLabel(model) }}</td>
            <td>
              {{ model.health?.last_prediction_date || '-' }}
              <small v-if="model.health?.stale_days" class="stale-days">
                · {{ model.health.stale_days }}d
              </small>
              <small v-if="model.health?.status" class="health-status" :class="model.health.status">
                {{ healthLabel(model.health.status) }}
              </small>
            </td>
            <td class="num-cell">
              {{ model.health?.date_count ?? 0 }} / {{ model.health?.prediction_count ?? 0 }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </aside>
</template>

<script setup>
const props = defineProps({
  summary: { type: Object, default: null },
  models: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  filters: { type: Object, required: true },
  selectedModelId: { type: String, default: '' },
  indexOptions: {
    type: Array,
    default: () => ['csi1000', 'csi500', 'hs300', 'a500', 'csi2000'],
  },
})

const emit = defineEmits(['update:filters', 'select-model', 'refresh'])

const stateCards = [
  { key: 'live', label: '实盘' },
  { key: 'shadow', label: '影子' },
  { key: 'validated', label: '已验收' },
  { key: 'research', label: '研究中' },
  { key: 'retired', label: '已退役' },
  { key: 'rejected', label: '已否决' },
]

function stateLabel(state) {
  return {
    live: '实盘',
    shadow: '影子',
    validated: '已验收',
    research: '研究中',
    retired: '已退役',
    rejected: '已否决',
  }[state] || state || '-'
}

function stateCount(key) {
  return props.summary?.states?.[key] ?? 0
}

function stateFilterActive(key) {
  return String(props.filters.state || '').split(',').filter(Boolean).includes(key)
}

function toggleState(key) {
  patch({ state: stateFilterActive(key) ? '' : key })
}

function patch(values) {
  emit('update:filters', values)
}

function clearFilters() {
  emit('update:filters', { state: '', index_code: '', accepted: '', q: '' })
}

function validationLabel(model) {
  const validation = model.validation
  if (!validation) return '-'
  return `${validation.protocol || '-'} / ${validation.verdict || '-'}`
}

function gateLabel(model) {
  const gate = model.operational_gate
  if (!gate) return '-'
  if (gate.passed) return 'pass'
  return gate.reason ? `fail · ${gate.reason}` : 'fail'
}

function healthLabel(status) {
  return {
    current: 'current',
    stale: 'stale',
    inactive: 'inactive',
    no_predictions: '无预测',
  }[status] || status
}
</script>

<style scoped>
.catalog-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  overflow: hidden;
}

.catalog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.catalog-head h3 {
  margin: 0 0 4px;
  color: #0f172a;
}

.catalog-head p {
  margin: 0;
  color: #64748b;
  font-size: 13px;
}

.catalog-head button,
.clear-filters {
  border: 1px solid #0f6bdc;
  border-radius: 8px;
  background: #0f6bdc;
  color: #fff;
  padding: 7px 11px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.catalog-head button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.state-board {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
  gap: 8px;
}

.state-card {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  background: #f8fafc;
  color: #334155;
  text-align: left;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.state-card strong {
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}

.state-card.active {
  border-color: #0f6bdc;
  background: #eff6ff;
}

.state-card.live.active { border-color: #059669; background: #ecfdf5; }
.state-card.shadow.active { border-color: #2563eb; background: #eff6ff; }
.state-card.validated.active { border-color: #7c3aed; background: #f5f3ff; }
.state-card.research.active { border-color: #64748b; background: #f8fafc; }
.state-card.retired.active { border-color: #d97706; background: #fffbeb; }
.state-card.rejected.active { border-color: #dc2626; background: #fef2f2; }

.state-card.accepted {
  cursor: default;
  background: #fff;
}

.stale-alert {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid #fdba74;
  border-radius: 8px;
  background: #fff7ed;
  color: #9a3412;
  font-size: 12px;
}

.catalog-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.catalog-filters select,
.catalog-filters input {
  min-width: 0;
  flex: 1 1 130px;
  padding: 6px 8px;
  border: 1px solid #d7dde7;
  border-radius: 8px;
  background: #fff;
  color: #172033;
  font: inherit;
  font-size: 12px;
}

.clear-filters {
  border-color: #d7dde7;
  background: #fff;
  color: #334155;
}

.table-wrap {
  min-height: 0;
  overflow: auto;
  border: 1px solid #e6eaf0;
  border-radius: 10px;
}

table {
  width: 100%;
  min-width: 940px;
  border-collapse: collapse;
  font-size: 12px;
}

th,
td {
  padding: 8px 10px;
  border-bottom: 1px solid #eef2f7;
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}

th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f8fafc;
  color: #64748b;
  font-weight: 600;
}

tbody tr {
  cursor: pointer;
}

tbody tr:hover {
  background: #f8fafc;
}

tbody tr.active {
  background: #eff6ff;
}

.model-cell {
  max-width: 280px;
  white-space: normal;
}

.model-cell strong {
  display: block;
  color: #0f172a;
  overflow-wrap: anywhere;
}

.model-cell small {
  display: block;
  margin-top: 2px;
  color: #64748b;
}

.num-cell {
  font-variant-numeric: tabular-nums;
}

.stale-days {
  color: #b45309;
}

.health-status {
  display: inline-block;
  margin-left: 5px;
  padding: 1px 5px;
  border-radius: 999px;
  font-size: 10px;
  background: #f1f5f9;
  color: #64748b;
}

.health-status.current { background: #dcfce7; color: #047857; }
.health-status.stale { background: #fef3c7; color: #b45309; }
.health-status.no_predictions { background: #fee2e2; color: #b91c1c; }

.state-badge,
.accepted-pill {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.state-badge.live { background: #dcfce7; color: #047857; }
.state-badge.shadow { background: #dbeafe; color: #1d4ed8; }
.state-badge.validated { background: #ede9fe; color: #6d28d9; }
.state-badge.research { background: #f1f5f9; color: #475569; }
.state-badge.retired { background: #fef3c7; color: #b45309; }
.state-badge.rejected { background: #fee2e2; color: #b91c1c; }

.accepted-pill.yes { background: #dcfce7; color: #047857; }
.accepted-pill.no { background: #f1f5f9; color: #64748b; }

@media (max-width: 900px) {
  .state-board {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
