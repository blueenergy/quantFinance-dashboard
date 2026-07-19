<template>
  <section class="card worker-status-card">
    <div class="task-list-header">
      <div>
        <h3>Plan 生成 Worker</h3>
        <p class="muted">展示 quant-scorer 最近一次 heartbeat，辅助判断任务是否有人消费。</p>
      </div>
      <button :disabled="loading" @click="$emit('refresh')">刷新 worker</button>
    </div>
    <p v-if="loading" class="muted">正在加载 worker 状态...</p>
    <p v-else-if="!workers.length" class="muted">暂无 worker heartbeat。</p>
    <div v-else class="worker-status-grid">
      <div v-for="worker in workers" :key="worker.worker_id" class="worker-status-row">
        <span>{{ worker.worker_id }}</span><strong>{{ worker.status }}</strong>
        <small>last_seen: {{ worker.last_seen_at || '-' }}</small>
        <small v-if="worker.current_task_id">current_task: {{ worker.current_task_id }}</small>
        <small v-else-if="worker.last_task_id">last_task: {{ worker.last_task_id }}</small>
        <small v-if="worker.last_message">{{ worker.last_message }}</small>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({
  workers: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

defineEmits(['refresh'])
</script>
