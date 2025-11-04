<template>
  <div v-if="user" class="modal-overlay" @click="emitClose">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>👤 用户详情</h3>
        <button @click="emitClose" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div class="user-info">
          <p><strong>用户名:</strong> {{ user.username }}</p>
          <p><strong>邮箱:</strong> {{ user.email }}</p>
          <p><strong>姓名:</strong> {{ user.full_name || '未设置' }}</p>
          <p><strong>状态:</strong> {{ user.is_active ? '激活' : '禁用' }}</p>
          <p><strong>权限:</strong> {{ user.is_admin ? '管理员' : '普通用户' }}</p>
          <p><strong>注册时间:</strong> {{ formatDate(user.created_at) }}</p>
          <p><strong>最后登录:</strong> {{ formatDate(user.last_login) || '从未' }}</p>
        </div>
        <div v-if="stats" class="user-stats">
          <h4>📊 用户统计</h4>
          <p><strong>自选股数量:</strong> {{ stats.watchlist_count }}</p>
          <h4>🔐 最近登录记录</h4>
          <div class="recent-logins">
            <div v-for="login in stats.recent_logins" :key="login._id" class="login-record">
              <span class="login-time">{{ formatDate(login.login_time) }}</span>
              <span class="login-ip">{{ login.ip_address }}</span>
              <span :class="login.success ? 'tag tag-status-success' : 'tag tag-status-failed'">{{ login.success ? '成功' : '失败' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
const props = defineProps({
  user: { type: Object, default: null },
  stats: { type: Object, default: null },
  formatDate: { type: Function, required: true }
})
const emit = defineEmits(['close'])
const emitClose = () => emit('close')
</script>
<style scoped>
.modal-content { max-width:600px; }
.login-record { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:8px 10px; background:rgba(0,0,0,0.04); border-radius:6px; }
.recent-logins { display:flex; flex-direction:column; gap:8px; }
@media (max-width:768px){ .modal-content { width:95%; } }
</style>