<template>
  <div class="activate-container">
    <div class="activate-card">
      <h2>账户开通</h2>

      <div v-if="!token" class="no-token">
        <p class="message">请从注册邮件中的「完成开通」链接近此页面。若需要重新获取邮件，可填写下面邮箱（仅对<strong>未开通</strong>的待审注册生效）。</p>
        <div class="resend resend-standalone">
          <input
            v-model="resendEmail"
            type="email"
            placeholder="注册时使用的邮箱"
            class="input"
          />
          <button
            type="button"
            class="btn"
            :disabled="resendLoading"
            @click="handleResend"
          >
            {{ resendLoading ? '发送中…' : '重发开通邮件' }}
          </button>
          <p v-if="resendMessage" class="resend-ok">{{ resendMessage }}</p>
        </div>
        <div class="actions">
          <a href="#" @click.prevent="goLogin" class="link">前往登录</a>
        </div>
      </div>

      <div v-else-if="loading" class="message info">正在处理，请稍候…</div>

      <div v-else-if="error" class="message error">
        {{ error }}
        <div v-if="showResend" class="resend">
          <p>输入注册邮箱，重新发送开通邮件：</p>
          <input
            v-model="resendEmail"
            type="email"
            placeholder="注册时使用的邮箱"
            class="input"
          />
          <button
            type="button"
            class="btn"
            :disabled="resendLoading"
            @click="handleResend"
          >
            {{ resendLoading ? '发送中…' : '重发开通邮件' }}
          </button>
          <p v-if="resendMessage" class="resend-ok">{{ resendMessage }}</p>
        </div>
      </div>

      <div v-else-if="result" class="message" :class="result.success ? 'success' : 'error'">
        {{ result.message }}
        <p v-if="result.activation_path === 'admin' && result.success" class="hint">
          若您已知晓账户由管理员开通，可忽略此页说明，直接登录即可。
        </p>
        <p v-if="result.code === 'already_activated' && result.activation_path === 'self' && result.success" class="hint">
          再次打开同一链接时也会看到此说明，请直接前往登录页。
        </p>
        <div class="actions">
          <a href="#" @click.prevent="goLogin" class="link">前往登录</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'

export default {
  name: 'AccountActivate',
  props: {
    token: { type: String, default: '' }
  },
  emits: ['done'],
  setup(props) {
    const loading = ref(true)
    const error = ref('')
    const result = ref(null)
    const showResend = ref(false)
    const resendEmail = ref('')
    const resendLoading = ref(false)
    const resendMessage = ref('')

    const goLogin = () => {
      window.history.replaceState({}, document.title, window.location.origin + '/')
      window.location.href = window.location.origin + '/'
    }

    const doActivate = async () => {
      if (!props.token) {
        loading.value = false
        return
      }
      showResend.value = false
      error.value = ''
      result.value = null
      loading.value = true
      try {
        const response = await fetch('/api/auth/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: props.token })
        })
        const data = await response.json().catch(() => ({}))
        if (data.success && (data.code === 'activated' || data.code === 'already_activated')) {
          result.value = data
        } else if (data && (data.message || !data.success)) {
          if (data.code === 'expired' || data.code === 'stale_token') {
            showResend.value = true
          }
          error.value = data.message || '开通失败，请重试或联系管理员。'
        } else {
          error.value = '开通失败，请重试或联系管理员。'
        }
      } catch (e) {
        error.value = '网络错误，请稍后重试。'
      } finally {
        loading.value = false
      }
    }

    const handleResend = async () => {
      if (!resendEmail.value.trim()) {
        resendMessage.value = '请输入邮箱'
        return
      }
      resendLoading.value = true
      resendMessage.value = ''
      try {
        const response = await fetch('/api/auth/resend-activation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: resendEmail.value.trim() })
        })
        const data = await response.json().catch(() => ({}))
        if (response.ok) {
          resendMessage.value = data.message || '如邮箱有待开通申请，请查收邮件。'
        } else {
          resendMessage.value = '发送失败，请稍后重试。'
        }
      } catch (e) {
        resendMessage.value = '网络错误，请稍后重试。'
      } finally {
        resendLoading.value = false
      }
    }

    onMounted(() => {
      doActivate()
    })

    return {
      loading,
      error,
      result,
      showResend,
      resendEmail,
      resendLoading,
      resendMessage,
      goLogin,
      handleResend
    }
  }
}
</script>

<style scoped>
.activate-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  padding: 24px;
  padding-bottom: 48px;
  box-sizing: border-box;
}

.activate-card {
  width: 100%;
  max-width: 480px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
  padding: 32px 28px;
  box-sizing: border-box;
}

h2 {
  text-align: center;
  margin: 0 0 24px;
  font-size: 22px;
  color: #1f2937;
}

.message {
  font-size: 15px;
  line-height: 1.65;
  color: #374151;
}

.message.success { color: #047857; }
.message.error { color: #b91c1c; }
.message.info { color: #4b5563; text-align: center; }

.hint {
  margin-top: 12px;
  font-size: 13px;
  color: #6b7280;
}

.actions {
  margin-top: 20px;
  text-align: center;
}

.link {
  color: #4f46e5;
  font-weight: 600;
  text-decoration: none;
}
.link:hover { text-decoration: underline; }

.resend {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
  font-size: 14px;
  color: #4b5563;
}

.resend-ok {
  margin-top: 8px;
  color: #047857;
  font-size: 13px;
}

.input {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  margin: 8px 0 12px;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
}

.btn {
  display: inline-block;
  width: 100%;
  padding: 10px 16px;
  background: #4f46e5;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.no-token { margin-top: 4px; }
.no-token .resend-standalone { margin-top: 16px; }
</style>
