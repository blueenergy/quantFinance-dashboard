<template>
  <div class="ai-logs-table" v-if="records.length > 0">
    <table>
      <thead>
        <tr>
          <th>用户名</th>
          <th>用户ID</th>
          <th>股票代码</th>
          <th>服务商</th>
          <th>模型</th>
          <th>分析时间</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in records" :key="row._id">
          <td>{{ row.username || '-' }}</td>
          <td>{{ row.user_id }}</td>
          <td>{{ row.symbol }}</td>
          <td>{{ row.provider }}</td>
          <td>{{ row.model }}</td>
          <td>{{ formatDate(row.timestamp) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
  <div v-else class="empty-msg">暂无分析记录</div>
</template>
<script setup>
defineProps({
  records: { type: Array, default: () => [] },
  formatDate: { type: Function, required: true }
})
</script>
<style scoped>
.empty-msg { padding:12px; font-size:13px; color: var(--color-muted); }
</style>