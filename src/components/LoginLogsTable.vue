<template>
  <div class="logs-table" v-if="logs.length > 0">
    <table>
      <thead>
        <tr>
          <th>用户名</th>
          <th>IP地址</th>
          <th>浏览器</th>
          <th>登录时间</th>
          <th>状态</th>
          <th>失败原因</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="log in logs" :key="log._id">
          <td>{{ log.username }}</td>
          <td>{{ log.ip_address }}</td>
          <td class="user-agent">{{ formatUserAgent(String(log.user_agent || '')) }}</td>
          <td>{{ formatDate(log.login_time) }}</td>
          <td><span :class="log.success ? 'tag tag-status-success' : 'tag tag-status-failed'">{{ log.success ? '成功' : '失败' }}</span></td>
          <td>{{ log.failure_reason || '-' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
  <div v-else class="empty-msg">暂无登录日志</div>
</template>
<script setup>
defineProps({
  logs: { type: Array, default: () => [] },
  formatDate: { type: Function, required: true },
  formatUserAgent: { type: Function, required: true }
})
</script>
<style scoped>
.empty-msg { padding:12px; font-size:13px; color: var(--color-muted); }
.user-agent { max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
</style>