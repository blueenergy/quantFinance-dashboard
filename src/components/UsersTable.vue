<template>
  <div class="users-table" v-if="users.length > 0">
    <table>
      <thead>
        <tr>
          <th>用户名</th>
          <th>邮箱</th>
          <th>姓名</th>
          <th>状态</th>
          <th>权限</th>
          <th>注册时间</th>
          <th>最后登录</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users" :key="user.id">
          <td>{{ user.username }}</td>
          <td>{{ user.email }}</td>
          <td>{{ user.full_name || '-' }}</td>
          <td>
            <span :class="user.is_active ? 'tag tag-status-active' : 'tag tag-status-inactive'">{{ user.is_active ? '激活' : '禁用' }}</span>
          </td>
          <td>
            <span :class="user.is_admin ? 'tag tag-role-admin' : 'tag tag-role-user'">{{ user.is_admin ? '管理员' : '普通用户' }}</span>
          </td>
          <td>{{ formatDate(user.created_at) }}</td>
          <td>{{ formatDate(user.last_login) || '从未' }}</td>
          <td>
            <button
              @click="emitToggle(user)"
              class="btn-base btn-sm"
              :class="user.is_active ? 'btn-gradient-red' : 'btn-gradient-green'"
              :disabled="user.username === currentUser?.username"
            >{{ user.is_active ? '禁用' : '激活' }}</button>
            <button @click="emitDetail(user)" class="btn-base btn-sm btn-gradient-blue">详情</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <div v-else class="empty-msg">暂无用户</div>
</template>

<script setup>
const props = defineProps({
  users: { type: Array, default: () => [] },
  currentUser: { type: Object, default: null },
  formatDate: { type: Function, required: true }
})
const emit = defineEmits(['toggle-status','view-detail'])
const emitToggle = (u) => emit('toggle-status', u)
const emitDetail = (u) => emit('view-detail', u)
</script>

<style scoped>
.empty-msg { padding:12px; font-size:13px; color: var(--color-muted); }
</style>