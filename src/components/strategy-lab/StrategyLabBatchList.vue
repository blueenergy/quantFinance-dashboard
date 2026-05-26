<template>
  <aside class="card batch-list">
    <div class="section-title-row compact">
      <div>
        <p class="section-kicker">批量回测 · 单次实验维度</p>
        <h3>实验列表</h3>
      </div>
      <span class="type-badge batch-badge">Batch 实验</span>
    </div>
    <p class="subtitle">每条是一次具体批量回测；Loop 的每一轮也会落成一条实验记录。</p>
    <div class="list-action-block">
      <button class="primary" :disabled="submitting" @click="emit('submit-batch')">
        用上方配置创建实验
      </button>
      <span v-if="createMessage" class="message">{{ createMessage }}</span>
    </div>
    <button
      v-for="batch in batches"
      :key="batch.batch_id"
      class="batch-row experiment-row"
      :class="{
        active: selectedBatchId === batch.batch_id,
        'loop-iteration-batch': Boolean(batch.loop_id),
      }"
      @click="emit('select-batch', batch.batch_id)"
    >
      <span class="row-type">
        {{ loopIterationByBatchId[batch.batch_id] ? `第 ${loopIterationByBatchId[batch.batch_id].iteration} 轮` : (batch.loop_id ? 'Loop' : '实验') }}
      </span>
      <strong>{{ loopIterationByBatchId[batch.batch_id]?.batch_name || batch.name }}</strong>
      <span>{{ batch.universe_type }} {{ batch.universe_value || '' }}</span>
      <small v-if="batch.loop_id">
        Loop：{{ loopNameById[batch.loop_id] || batch.loop_id }} · {{ batch.status }}
      </small>
      <small v-else>单次回测：{{ batch.strategy_key }} · {{ batch.status }}</small>
    </button>
  </aside>
</template>

<script setup>
defineProps({
  batches: { type: Array, required: true },
  selectedBatchId: { type: String, default: '' },
  loopIterationByBatchId: { type: Object, required: true },
  loopNameById: { type: Object, required: true },
  submitting: { type: Boolean, default: false },
  createMessage: { type: String, default: '' },
})

const emit = defineEmits(['submit-batch', 'select-batch'])
</script>

<style scoped>
.card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
  padding: 16px;
}

.batch-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title-row {
  align-items: flex-start;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.section-title-row.compact {
  align-items: center;
}

.section-kicker {
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  margin: 0 0 4px;
}

h3,
p {
  margin: 0;
}

.subtitle {
  color: #64748b;
  margin-top: 6px;
}

.type-badge,
.row-type {
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  padding: 5px 8px;
  white-space: nowrap;
}

.batch-badge,
.experiment-row .row-type {
  background: #dcfce7;
  color: #166534;
}

.list-action-block {
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 4px;
  padding-bottom: 10px;
}

button {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  padding: 8px 12px;
}

.primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

.batch-row {
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
}

.experiment-row {
  border-color: #bbf7d0;
  background: #fbfefc;
}

.experiment-row.loop-iteration-batch {
  border-color: #c7d2fe;
  background: #f8faff;
}

.batch-row.active {
  border-color: #2563eb;
  background: #eff6ff;
}

.batch-row span,
.batch-row small {
  color: #64748b;
}

.message {
  color: #2563eb;
}
</style>
