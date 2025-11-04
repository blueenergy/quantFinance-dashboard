<template>
  <div class="logs-table" v-if="logs.length > 0">
    <table>
      <thead>
        <tr>
          <th>管理员</th>
          <th>操作</th>
          <th>目标用户</th>
          <th>详情</th>
          <th>时间</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="log in logs" :key="log._id">
          <td>{{ log.admin_username }}</td>
          <td>{{ log.action }}</td>
          <td>{{ log.target_username || '-' }}</td>
          <td class="details">{{ log.details }}</td>
          <td>{{ formatDate(log.timestamp) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
  <div v-else class="empty-msg">暂无管理员操作日志</div>
</template>
<script setup>
defineProps({
  logs: { type: Array, default: () => [] },
  formatDate: { type: Function, required: true }
})
</script>
<style scoped>
.details { max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.empty-msg { padding:12px; font-size:13px; color: var(--color-muted); }
</style>