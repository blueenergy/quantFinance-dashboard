<template>
  <div class="logs-table" v-if="logs.length > 0">
    <table>
      <thead>
        <tr>
          <th>任务ID</th>
          <th>状态</th>
          <th>创建时间</th>
          <th>完成时间</th>
          <th>耗时 (秒)</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="log in logs" :key="log.task_id">
          <td>{{ log.task_id }}</td>
          <td><span :class="log.status === '成功' ? 'tag tag-status-success' : 'tag tag-status-failed'">{{ log.status }}</span></td>
          <td>{{ formatDate(log.created_at) }}</td>
          <td>{{ formatDate(log.completed_at) || '-' }}</td>
          <td>{{ log.duration || '-' }}</td>
          <td>
            <button @click="emitDetail(log)" class="btn-base btn-sm btn-gradient-blue">详情</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <div v-else class="empty-msg">暂无AI分析任务日志</div>
</template>
<script setup>
const props = defineProps({
  logs: { type: Array, default: () => [] },
  formatDate: { type: Function, required: true }
})
const emit = defineEmits(['view-detail'])
const emitDetail = (l) => emit('view-detail', l)
</script>
<style scoped>
.empty-msg { padding:12px; font-size:13px; color: var(--color-muted); }
</style>