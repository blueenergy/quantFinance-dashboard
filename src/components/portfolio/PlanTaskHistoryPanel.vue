<template>
  <section class="card task-list-card">
    <div class="task-list-header">
      <div>
        <h3>最近生成任务</h3>
        <p class="muted">
          {{ tasks.length }} 条最近任务
          <span v-if="latestTask"> · 最新 {{ latestTask.status }} / {{ latestTask.strategy_template_id }} / {{ latestTask.base_date }}</span>
        </p>
      </div>
      <div class="task-list-actions">
        <button @click="$emit('toggle')">{{ expanded ? '折叠' : '展开' }}</button>
        <button :disabled="loading" @click="$emit('refresh')">刷新任务</button>
      </div>
    </div>
    <template v-if="expanded">
      <p v-if="loading" class="muted">正在加载任务...</p>
      <p v-else-if="!tasks.length" class="muted">暂无生成任务。</p>
      <div v-else class="table-wrap compact generation-task-table">
        <table>
          <thead><tr><th>created_at</th><th>status</th><th>strategy</th><th>base_date</th><th>mode</th><th>attempts</th><th>worker</th><th>plan/error</th></tr></thead>
          <tbody>
            <tr v-for="task in tasks" :key="task.task_id" :class="{ active: currentTaskId === task.task_id }" @click="$emit('select', task)">
              <td>{{ task.created_at || '-' }}</td><td>{{ task.status || '-' }}</td>
              <td class="truncate" :title="task.strategy_template_id">{{ task.strategy_template_id || '-' }}</td>
              <td>{{ task.base_date || '-' }}</td><td>{{ task.mode || '-' }}</td><td>{{ task.attempts ?? 0 }}</td>
              <td class="truncate" :title="task.worker_id">{{ task.worker_id || '-' }}</td>
              <td class="truncate" :title="task.plan_id || task.error_message || task.task_id">{{ task.plan_id || task.error_message || task.task_id }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<script setup>
defineProps({
  tasks: { type: Array, default: () => [] },
  latestTask: { type: Object, default: null },
  currentTaskId: { type: String, default: '' },
  expanded: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})

defineEmits(['toggle', 'refresh', 'select'])
</script>
