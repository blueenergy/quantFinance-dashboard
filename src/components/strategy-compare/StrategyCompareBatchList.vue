<template>
  <aside class="card batch-list">
    <div class="section-title-row">
      <div>
        <p class="section-kicker">策略对比</p>
        <h3>对比实验</h3>
      </div>
      <span class="type-badge">Compare</span>
    </div>
    <p class="subtitle">多标的 × 多策略 × 多预设 × 参数网格的一次批量回测。</p>
    <div class="list-action-block">
      <button type="button" class="primary" @click="emit('create')">新建对比实验</button>
    </div>
    <p v-if="loading" class="muted">加载中…</p>
    <button
      v-for="batch in batches"
      :key="batch.batch_id"
      type="button"
      class="batch-row"
      :class="{ active: selectedBatchId === batch.batch_id }"
      @click="emit('select', batch.batch_id)"
    >
      <strong>{{ batch.name }}</strong>
      <span>{{ formatSymbols(batch) }}</span>
      <small>
        {{ batch.combos_count || 1 }} 组合
        <template v-if="(batch.symbols_count || 0) > 1">
          · {{ batch.symbols_count }} 标的
        </template>
        · {{ batch.status }}
        <template v-if="batch.summary">
          · {{ batch.summary.completed || 0 }}/{{ batch.summary.total || 0 }}
        </template>
      </small>
    </button>
    <p v-if="!loading && !batches.length" class="muted empty">暂无对比实验，点击上方创建。</p>
  </aside>
</template>

<script setup>
defineProps({
  batches: { type: Array, default: () => [] },
  selectedBatchId: { type: String, default: '' },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['create', 'select'])

function formatSymbols(batch) {
  const preview = batch?.symbols_preview || batch?.symbols || []
  if (preview.length) {
    if (preview.length <= 2) return preview.join(', ')
    return `${preview.slice(0, 2).join(', ')} 等${batch.symbols_count || preview.length}只`
  }
  return batch?.universe_value || ''
}
</script>

<style scoped>
.card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
}

.batch-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.section-kicker {
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  margin: 0 0 4px;
}

h3,
p {
  margin: 0;
}

.subtitle {
  color: #64748b;
  margin-top: 6px;
  font-size: 13px;
}

.type-badge {
  background: #eff6ff;
  color: #1d4ed8;
  border-radius: 999px;
  font-size: 12px;
  padding: 4px 10px;
}

.list-action-block {
  margin: 12px 0;
}

.primary {
  border: 1px solid #0f6bdc;
  background: #0f6bdc;
  color: #fff;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font: inherit;
}

.batch-row {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.batch-row.active {
  border-color: #2563eb;
  background: #eff6ff;
}

.muted {
  color: #64748b;
}

.empty {
  margin-top: 8px;
}
</style>
