<template>
  <div class="login-container">
    <div class="login-form">
      <h2>{{ isLogin ? '用户登录' : '用户注册' }}</h2>
      
      <!-- 忘记密码模式 -->
      <form v-if="isForgotPassword" @submit.prevent="handleForgotPassword">
        <div class="form-group">
          <label for="resetEmail">邮箱:</label>
          <input
            id="resetEmail"
            v-model="forgotEmail"
            type="email"
            required
            placeholder="请输入注册时使用的邮箱"
          />
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <div v-if="success" class="success-message">
          {{ success }}
        </div>

        <button type="submit" :disabled="loading" class="submit-btn">
          {{ loading ? '发送中...' : '发送重置邮件' }}
        </button>

        <div class="toggle-mode">
          <p>
            <a href="#" @click.prevent="backToLogin">返回登录</a>
          </p>
        </div>
      </form>

      <!-- 登录/注册模式 -->
      <form v-else @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="username">用户名:</label>
          <input
            id="username"
            v-model="formData.username"
            type="text"
            required
            placeholder="请输入用户名"
          />
        </div>

        <div v-if="!isLogin" class="form-group">
          <label for="email">邮箱:</label>
          <input
            id="email"
            v-model="formData.email"
            type="email"
            required
            placeholder="请输入邮箱"
          />
        </div>

        <div v-if="!isLogin" class="form-group">
          <label for="fullName">姓名 (可选):</label>
          <input
            id="fullName"
            v-model="formData.full_name"
            type="text"
            placeholder="请输入姓名"
          />
        </div>

        <div class="form-group">
          <label for="password">密码:</label>
          <input
            id="password"
            v-model="formData.password"
            type="password"
            required
            placeholder="请输入密码"
          />
        </div>

        <div v-if="isLogin" class="forgot-password-link">
          <a href="#" @click.prevent="showForgotPassword">忘记密码？</a>
        </div>

        <div v-if="!isLogin" class="form-group">
          <label for="confirmPassword">确认密码:</label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            required
            placeholder="请再次输入密码"
          />
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <button type="submit" :disabled="loading" class="submit-btn">
          {{ loading ? '处理中...' : (isLogin ? '登录' : '注册') }}
        </button>
      </form>

      <div v-if="!isForgotPassword" class="toggle-mode">
        <p>
          {{ isLogin ? '还没有账号？' : '已有账号？' }}
          <a href="#" @click.prevent="toggleMode">
            {{ isLogin ? '立即注册' : '立即登录' }}
          </a>
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive } from 'vue'

export default {
  name: 'LoginForm',
  emits: ['login-success'],
  setup(props, { emit }) {
    const isLogin = ref(true)
    const isForgotPassword = ref(false)
    const loading = ref(false)
    const error = ref('')
    const success = ref('')
    const confirmPassword = ref('')
    const forgotEmail = ref('')

    const formData = reactive({
      username: '',
      email: '',
      full_name: '',
      password: ''
    })

    const resetForm = () => {
      formData.username = ''
      formData.email = ''
      formData.full_name = ''
      formData.password = ''
      confirmPassword.value = ''
      error.value = ''
      success.value = ''
    }

    const toggleMode = () => {
      isLogin.value = !isLogin.value
      resetForm()
    }

    const showForgotPassword = () => {
      isForgotPassword.value = true
      error.value = ''
      success.value = ''
      forgotEmail.value = ''
    }

    const backToLogin = () => {
      isForgotPassword.value = false
      error.value = ''
      success.value = ''
    }

    const handleForgotPassword = async () => {
      if (!forgotEmail.value) {
        error.value = '请输入邮箱地址'
        return
      }

      loading.value = true
      error.value = ''
      success.value = ''

      try {
        const response = await fetch('/api/user/forgot-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email: forgotEmail.value })
        })

        const data = await response.json()

        if (response.ok) {
          success.value = data.message || '如果该邮箱已注册，您将收到密码重置邮件'
          forgotEmail.value = ''
        } else {
          error.value = data.detail || '发送失败，请重试'
        }
      } catch (err) {
        error.value = '网络错误，请重试'
      } finally {
        loading.value = false
      }
    }

    const validateForm = () => {
      if (!formData.username || !formData.password) {
        error.value = '用户名和密码不能为空'
        return false
      }

      if (!isLogin.value) {
        if (!formData.email) {
          error.value = '邮箱不能为空'
          return false
        }
        if (formData.password !== confirmPassword.value) {
          error.value = '两次输入的密码不一致'
          return false
        }
        if (formData.password.length < 6) {
          error.value = '密码长度不能少于6位'
          return false
        }
      }

      return true
    }

    const handleSubmit = async () => {
      if (!validateForm()) return

      loading.value = true
      error.value = ''

      try {
        const endpoint = isLogin.value ? '/api/auth/login' : '/api/auth/register'
        const payload = isLogin.value 
          ? { username: formData.username, password: formData.password }
          : { 
              username: formData.username, 
              email: formData.email,
              full_name: formData.full_name || null,
              password: formData.password 
            }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })

        let data = null
        const contentType = response.headers.get('content-type')
        
        if (contentType && contentType.includes('application/json')) {
          const text = await response.text()
          if (text.trim()) {
            try {
              data = JSON.parse(text)
            } catch (e) {
              console.error('JSON解析错误:', e)
              throw new Error('服务器响应格式错误')
            }
          }
        }

        if (!response.ok) {
          const errorMessage = data?.detail || `请求失败 (${response.status})`
          throw new Error(errorMessage)
        }

        if (isLogin.value) {
          // 登录成功，让父组件处理认证状态
          emit('login-success', data)
        } else {
          // 注册成功，切换到登录模式
          error.value = ''
          alert('注册成功！您的账户正在等待管理员审批，审批通过后即可登录。')
          isLogin.value = true
          resetForm()
        }

      } catch (err) {
        error.value = err.message || '网络错误，请重试'
      } finally {
        loading.value = false
      }
    }

    return {
      isLogin,
      isForgotPassword,
      loading,
      error,
      success,
      formData,
      confirmPassword,
      forgotEmail,
      toggleMode,
      showForgotPassword,
      backToLogin,
      handleForgotPassword,
      handleSubmit
    }
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-form {
  background: white;
  padding: 40px;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 400px;
}

.login-form h2 {
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

.forgot-password-link {
  text-align: right;
  margin-bottom: 15px;
}

.forgot-password-link a {
  color: #667eea;
  text-decoration: none;
  font-size: 14px;
}

.forgot-password-link a:hover {
  text-decoration: underline;
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

.toggle-mode {
  text-align: center;
  margin-top: 20px;
}

.toggle-mode p {
  color: #666;
  margin: 0;
}

.toggle-mode a {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
}

.toggle-mode a:hover {
  text-decoration: underline;
}
</style>
