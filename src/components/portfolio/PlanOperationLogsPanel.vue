<template>
  <section class="operation-log-panel">
    <div class="task-list-header">
      <div><h4>操作日志</h4><p class="muted">保留 reject/restore 与重生成任务的入队与完成记录。</p></div>
      <div class="task-list-actions"><button :disabled="loading || disabled" @click="$emit('refresh')">刷新日志</button></div>
    </div>
    <p v-if="loading" class="muted">正在加载日志...</p>
    <p v-else-if="!logs.length" class="muted">暂无操作日志。</p>
    <div v-else class="table-wrap compact operation-log-table">
      <table>
        <thead><tr><th>time</th><th>operation</th><th>symbol</th><th>status</th><th>task</th><th>message</th></tr></thead>
        <tbody>
          <tr v-for="log in logs" :key="log.log_id">
            <td>{{ log.created_at || '-' }}</td><td>{{ log.operation_type || '-' }}</td>
            <td>{{ log.operation_symbol || '-' }}</td><td>{{ log.status || '-' }}</td>
            <td class="truncate" :title="log.task_id || '-'">{{ log.task_id || '-' }}</td>
            <td class="truncate" :title="log.message || '-'">{{ log.message || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
defineProps({
  logs: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

defineEmits(['refresh'])
</script>
