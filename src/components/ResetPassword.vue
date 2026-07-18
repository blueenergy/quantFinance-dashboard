<template>
  <div class="reset-container">
    <div class="reset-form">
      <h2>重置密码</h2>
      
      <div v-if="!token">
        <div class="error-message">
          无效的重置链接，请重新申请密码重置。
        </div>
        <div class="back-link">
          <a href="#" @click.prevent="goToLogin">返回登录</a>
        </div>
      </div>

      <div v-else-if="success">
        <div class="success-message">
          {{ success }}
        </div>
        <div class="back-link">
          <a href="#" @click.prevent="goToLogin">前往登录</a>
        </div>
      </div>

      <form v-else @submit.prevent="handleResetPassword">
        <div class="form-group">
          <label for="newPassword">新密码:</label>
          <input
            id="newPassword"
            v-model="newPassword"
            type="password"
            required
            placeholder="请输入新密码（至少8位）"
            minlength="8"
          />
        </div>

        <div class="form-group">
          <label for="confirmPassword">确认密码:</label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            required
            placeholder="请再次输入新密码"
          />
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <button type="submit" :disabled="loading" class="submit-btn">
          {{ loading ? '处理中...' : '重置密码' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  name: 'ResetPassword',
  props: {
    token: {
      type: String,
      default: ''
    }
  },
  emits: ['done'],
  setup(props, { emit }) {
    const newPassword = ref('')
    const confirmPassword = ref('')
    const loading = ref(false)
    const error = ref('')
    const success = ref('')

    const handleResetPassword = async () => {
      if (!newPassword.value || !confirmPassword.value) {
        error.value = '请填写所有字段'
        return
      }

      if (newPassword.value.length < 8) {
        error.value = '密码长度不能少于8位'
        return
      }

      if (newPassword.value !== confirmPassword.value) {
        error.value = '两次输入的密码不一致'
        return
      }

      loading.value = true
      error.value = ''

      try {
        const response = await fetch('/api/user/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: props.token,
            new_password: newPassword.value
          })
        })

        const data = await response.json()

        if (response.ok) {
          success.value = data.message || '密码重置成功'
          newPassword.value = ''
          confirmPassword.value = ''
        } else {
          error.value = data.detail || '密码重置失败，请重试'
        }
      } catch (err) {
        error.value = '网络错误，请重试'
      } finally {
        loading.value = false
      }
    }

    const goToLogin = () => {
      emit('done')
    }

    return {
      newPassword,
      confirmPassword,
      loading,
      error,
      success,
      handleResetPassword,
      goToLogin
    }
  }
}
</script>

<style scoped>
.reset-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  padding-bottom: 48px;
  box-sizing: border-box;
}

.reset-form {
  background: white;
  padding: 40px;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 400px;
}

.reset-form h2 {
  text-align: center;
  margin-bottom: 30px;
  color: #333;
  font-size: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  color: #555;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 5px;
  font-size: 16px;
  transition: border-color 0.3s;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.error-message {
  color: #e74c3c;
  font-size: 14px;
  margin-bottom: 15px;
  text-align: center;
  padding: 10px;
  background: #fdf2f2;
  border: 1px solid #f5c6cb;
  border-radius: 5px;
}

.success-message {
  color: #27ae60;
  font-size: 14px;
  margin-bottom: 15px;
  text-align: center;
  padding: 10px;
  background: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 5px;
}

.submit-btn {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;
  transition: opacity 0.3s;
}

.submit-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.back-link {
  text-align: center;
  margin-top: 20px;
}

.back-link a {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
}

.back-link a:hover {
  text-decoration: underline;
}
</style>
