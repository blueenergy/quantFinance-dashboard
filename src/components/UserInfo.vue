<template>
  <div class="user-info">
    <div class="user-avatar">
      {{ userInitials }}
    </div>
    <div class="user-details">
      <span class="username">{{ user.username }}</span>
      <span class="user-email">{{ user.email }}</span>
    </div>
    <div class="user-actions">
      <button @click="logout" class="logout-btn">退出</button>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'

export default {
  name: 'UserInfo',
  props: {
    user: {
      type: Object,
      required: true
    }
  },
  emits: ['logout'],
  setup(props, { emit }) {
    const userInitials = computed(() => {
      if (props.user.full_name) {
        return props.user.full_name.charAt(0).toUpperCase()
      }
      return props.user.username.charAt(0).toUpperCase()
    })

    const logout = () => {
      // 清除本地存储
      localStorage.removeItem('access_token')
      localStorage.removeItem('user_info')
      emit('logout')
    }

    return {
      userInitials,
      logout
    }
  }
}
</script>

<style scoped>
.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  backdrop-filter: blur(10px);
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 16px;
}

.user-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.username {
  font-weight: 600;
  color: #333;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logout-btn {
  padding: 6px 12px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.logout-btn:hover {
  background: #c0392b;
}
</style>
