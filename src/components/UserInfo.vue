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
      <button @click="toggleChangePassword" class="change-password-btn">修改密码</button>
      <button @click="logout" class="logout-btn">退出</button>
    </div>
    <div v-if="showChangePassword" class="change-password-panel">
      <div class="change-password-row">
        <label>当前密码</label>
        <input
          v-model="oldPassword"
          type="password"
          class="change-password-input"
          placeholder="请输入当前密码"
        />
      </div>
      <div class="change-password-row">
        <label>新密码</label>
        <input
          v-model="newPassword"
          type="password"
          class="change-password-input"
          placeholder="请输入新密码（至少8位）"
        />
      </div>
      <div class="change-password-row">
        <label>确认新密码</label>
        <input
          v-model="confirmPassword"
          type="password"
          class="change-password-input"
          placeholder="请再次输入新密码"
        />
      </div>
      <div v-if="changeError" class="change-password-error">{{ changeError }}</div>
      <div v-if="changeSuccess" class="change-password-success">{{ changeSuccess }}</div>
      <div class="change-password-actions">
        <button
          @click="submitChangePassword"
          :disabled="changing"
          class="change-password-btn primary"
        >
          {{ changing ? '提交中...' : '提交修改' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, ref } from 'vue'
import { changePassword } from '../api/user'

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

    const showChangePassword = ref(false)
    const oldPassword = ref('')
    const newPassword = ref('')
    const confirmPassword = ref('')
    const changing = ref(false)
    const changeError = ref('')
    const changeSuccess = ref('')

    const toggleChangePassword = () => {
      showChangePassword.value = !showChangePassword.value
      changeError.value = ''
      changeSuccess.value = ''
      oldPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
    }

    const submitChangePassword = async () => {
      changeError.value = ''
      changeSuccess.value = ''

      if (!oldPassword.value || !newPassword.value || !confirmPassword.value) {
        changeError.value = '所有字段都不能为空'
        return
      }

      if (newPassword.value !== confirmPassword.value) {
        changeError.value = '两次输入的新密码不一致'
        return
      }

      if (newPassword.value.length < 8) {
        changeError.value = '新密码长度不能少于8位'
        return
      }

      changing.value = true
      try {
        const res = await changePassword(oldPassword.value, newPassword.value)
        changeSuccess.value = res.message || '密码修改成功'
        oldPassword.value = ''
        newPassword.value = ''
        confirmPassword.value = ''
        
        // Prompt user to re-login after successful password change
        setTimeout(() => {
          if (confirm('密码修改成功！为确保安全，请重新登录。现在退出登录？')) {
            logout()
          }
        }, 800)
      } catch (err) {
        changeError.value = err.message || '修改密码失败，请重试'
      } finally {
        changing.value = false
      }
    }

    return {
      userInitials,
      logout,
      showChangePassword,
      oldPassword,
      newPassword,
      confirmPassword,
      changing,
      changeError,
      changeSuccess,
      toggleChangePassword,
      submitChangePassword
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

.change-password-panel {
  margin-top: 10px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.change-password-row {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
}

.change-password-row label {
  font-size: 12px;
  color: #555;
  margin-bottom: 4px;
}

.change-password-input {
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #ddd;
  font-size: 12px;
}

.change-password-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.change-password-btn {
  padding: 6px 10px;
  margin-right: 6px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.change-password-btn.primary:hover {
  background: #2980b9;
}

.change-password-error {
  margin-top: 4px;
  font-size: 12px;
  color: #e74c3c;
}

.change-password-success {
  margin-top: 4px;
  font-size: 12px;
  color: #27ae60;
}
</style>
