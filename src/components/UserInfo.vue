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
      <button @click="toggleApiToken" class="api-token-btn">API Token</button>
      <button @click="toggleChangePassword" class="change-password-btn">修改密码</button>
      <button @click="logout" class="logout-btn">退出</button>
    </div>
    
    <!-- API Token 管理面板 -->
    <div v-if="showApiToken" class="api-token-panel">
      <h4>🔑 API Token 管理</h4>
      <p class="token-description">用于 quantTrader 远程连接</p>
      
      <div v-if="apiToken" class="token-display">
        <div class="token-header">
          <span class="token-label">当前 Token:</span>
          <button @click="copyToken" class="copy-btn" :class="{ copied: tokenCopied }">
            {{ tokenCopied ? '✓ 已复制' : '📋 复制' }}
          </button>
        </div>
        <div class="token-value" :class="{ revealed: tokenRevealed }">
          <code v-if="tokenRevealed">{{ apiToken }}</code>
          <code v-else>{{ maskedToken }}</code>
          <button @click="toggleTokenVisibility" class="reveal-btn">
            {{ tokenRevealed ? '👁️ 隐藏' : '👁️ 显示' }}
          </button>
        </div>
        <div class="token-info">
          <span class="token-expires">⏰ 过期时间: {{ tokenExpires || '7天后' }}</span>
        </div>
      </div>
      
      <div v-else class="no-token">
        <p>⚠️ 您还没有生成 API Token</p>
      </div>
      
      <div class="token-actions">
        <button @click="generateNewToken" class="generate-btn" :disabled="tokenGenerating">
          {{ tokenGenerating ? '⏳ 生成中...' : (apiToken ? '🔄 重新生成' : '✨ 生成 Token') }}
        </button>
        <button v-if="apiToken" @click="revokeToken" class="revoke-btn" :disabled="tokenGenerating">
          🗑️ 撤销
        </button>
      </div>
      
      <div v-if="tokenError" class="token-error">{{ tokenError }}</div>
      <div v-if="tokenSuccess" class="token-success">{{ tokenSuccess }}</div>
      
      <div class="token-usage-hint">
        <h5>📝 使用方法:</h5>
        <ol>
          <li>点击「生成 Token」按钮</li>
          <li>复制生成的 Token</li>
          <li>在 quantTrader 配置文件中填写:
            <pre>{
  "api_base_url": "{{ apiBaseUrl }}",
  "api_token": "your_copied_token_here"
}</pre>
          </li>
        </ol>
      </div>
      

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
import axios from 'axios'

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
    
    // API Token 管理
    const showApiToken = ref(false)
    const apiToken = ref(localStorage.getItem('access_token') || '')
    const tokenRevealed = ref(false)
    const tokenCopied = ref(false)
    const tokenGenerating = ref(false)
    const tokenError = ref('')
    const tokenSuccess = ref('')
    const tokenExpires = ref('')
    
    const apiBaseUrl = computed(() => {
      return window.location.origin + '/api'
    })
    
    const maskedToken = computed(() => {
      if (!apiToken.value) return ''
      const len = apiToken.value.length
      if (len <= 20) return '*'.repeat(len)
      return apiToken.value.substring(0, 10) + '...' + '*'.repeat(20) + '...' + apiToken.value.substring(len - 10)
    })
    
    const toggleApiToken = () => {
      showApiToken.value = !showApiToken.value
      tokenError.value = ''
      tokenSuccess.value = ''
      tokenCopied.value = false
      
      // 加载当前 token
      if (showApiToken.value) {
        apiToken.value = localStorage.getItem('access_token') || ''
        // 计算过期时间（如果 backend 返回了 expires_in）
        calculateTokenExpiry()
        

      }
    }
    
    const toggleTokenVisibility = () => {
      tokenRevealed.value = !tokenRevealed.value
    }
    
    const copyToken = async () => {
      if (!apiToken.value) return
      
      try {
        await navigator.clipboard.writeText(apiToken.value)
        tokenCopied.value = true
        tokenSuccess.value = 'Token 已复制到剪贴板'
        
        setTimeout(() => {
          tokenCopied.value = false
          tokenSuccess.value = ''
        }, 2000)
      } catch (err) {
        // 备用方案：使用 textarea
        const textarea = document.createElement('textarea')
        textarea.value = apiToken.value
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        
        tokenCopied.value = true
        tokenSuccess.value = 'Token 已复制到剪贴板'
        
        setTimeout(() => {
          tokenCopied.value = false
          tokenSuccess.value = ''
        }, 2000)
      }
    }
    
    const generateNewToken = async () => {
      if (apiToken.value && !confirm('重新生成会撤销当前 Token，所有使用旧 Token 的连接将失效。确定继续？')) {
        return
      }
      
      tokenError.value = ''
      tokenSuccess.value = ''
      tokenGenerating.value = true
      
      try {
        // 重新登录获取新 token（或调用专门的 refresh token API）
        const response = await axios.post('/api/auth/token/refresh')
        
        if (response.data.access_token) {
          apiToken.value = response.data.access_token
          localStorage.setItem('access_token', response.data.access_token)
          tokenSuccess.value = '✓ Token 生成成功！请立即复制保存'
          tokenRevealed.value = true
          calculateTokenExpiry()
          
          // 3秒后自动隐藏
          setTimeout(() => {
            tokenRevealed.value = false
          }, 30000)
        }
      } catch (err) {
        // 如果没有 refresh endpoint，提示用户重新登录
        if (err.response?.status === 404) {
          tokenError.value = '请重新登录以获取新 Token'
          
          setTimeout(() => {
            logout()
          }, 2000)
        } else {
          tokenError.value = err.response?.data?.detail || '生成 Token 失败'
        }
      } finally {
        tokenGenerating.value = false
      }
    }
    
    const revokeToken = async () => {
      if (!confirm('撤销 Token 后，所有使用该 Token 的连接将立即失效。确定继续？')) {
        return
      }
      
      tokenError.value = ''
      tokenSuccess.value = ''
      tokenGenerating.value = true
      
      try {
        await axios.post('/api/auth/token/revoke')
        apiToken.value = ''
        tokenSuccess.value = 'Token 已撤销'
      } catch (err) {
        // 如果没有 revoke endpoint，只清空本地
        if (err.response?.status === 404) {
          apiToken.value = ''
          tokenSuccess.value = 'Token 已从本地清除（服务端不支持撤销）'
        } else {
          tokenError.value = err.response?.data?.detail || '撤销失败'
        }
      } finally {
        tokenGenerating.value = false
      }
    }
    
    const calculateTokenExpiry = () => {
      // 这里可以解析 JWT 的 exp 字段，或者使用默认值
      // 简单处理：显示默认过期时间
      const expiryDays = 7 // 从 .env 中的 JWT_ACCESS_EXPIRE_MINUTES 计算
      const expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() + expiryDays)
      tokenExpires.value = expiryDate.toLocaleString('zh-CN')
    }

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
      showApiToken,
      apiToken,
      tokenRevealed,
      tokenCopied,
      tokenGenerating,
      tokenError,
      tokenSuccess,
      tokenExpires,
      apiBaseUrl,
      maskedToken,
      toggleApiToken,
      toggleTokenVisibility,
      copyToken,
      generateNewToken,
      revokeToken,
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

.change-password-btn:hover {
  background: #2980b9;
}

/* API Token Panel Styles */
.api-token-panel {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 10px;
  width: 450px;
  max-width: 90vw;
  padding: 20px;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  backdrop-filter: blur(10px);
}

.api-token-panel h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: #333;
}

.token-description {
  font-size: 12px;
  color: #666;
  margin: 0 0 16px 0;
}

.token-display {
  margin-bottom: 16px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.token-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.token-label {
  font-size: 12px;
  font-weight: 600;
  color: #555;
}

.copy-btn {
  padding: 4px 12px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: #2980b9;
}

.copy-btn.copied {
  background: #27ae60;
}

.token-value {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: white;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.token-value code {
  flex: 1;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 11px;
  color: #333;
  word-break: break-all;
  padding: 4px;
}

.token-value.revealed code {
  color: #e74c3c;
  font-weight: 500;
}

.reveal-btn {
  padding: 4px 8px;
  background: #95a5a6;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 10px;
  cursor: pointer;
  white-space: nowrap;
}

.reveal-btn:hover {
  background: #7f8c8d;
}

.token-info {
  margin-top: 8px;
  font-size: 11px;
  color: #666;
}

.no-token {
  padding: 16px;
  text-align: center;
  background: #fff3cd;
  border-radius: 8px;
  margin-bottom: 16px;
}

.no-token p {
  margin: 0;
  color: #856404;
  font-size: 13px;
}

.token-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.generate-btn {
  flex: 1;
  padding: 8px 16px;
  background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.generate-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(39, 174, 96, 0.3);
}

.generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.revoke-btn {
  padding: 8px 16px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s;
}

.revoke-btn:hover:not(:disabled) {
  background: #c0392b;
}

.revoke-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.token-error {
  padding: 8px 12px;
  background: #f8d7da;
  color: #721c24;
  border-radius: 4px;
  font-size: 12px;
  margin-top: 8px;
}

.token-success {
  padding: 8px 12px;
  background: #d4edda;
  color: #155724;
  border-radius: 4px;
  font-size: 12px;
  margin-top: 8px;
}

.token-usage-hint {
  margin-top: 16px;
  padding: 12px;
  background: #e3f2fd;
  border-radius: 8px;
  border-left: 4px solid #2196f3;
}

.token-usage-hint h5 {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: #1976d2;
}

.token-usage-hint ol {
  margin: 0;
  padding-left: 20px;
  font-size: 12px;
  color: #555;
}

.token-usage-hint ol li {
  margin-bottom: 6px;
}

.token-usage-hint pre {
  margin: 8px 0 0 0;
  padding: 8px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  font-size: 11px;
  overflow-x: auto;
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

.user-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.api-token-btn {
  padding: 6px 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s;
}

.api-token-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
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

/* LLM Configuration Styles */
.llm-config-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}

.llm-config-section h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #333;
}

.llm-config-description {
  font-size: 12px;
  color: #666;
  margin: 0 0 16px 0;
}

.llm-config-form {
  margin-top: 12px;
}

.form-row {
  margin-bottom: 12px;
}

.form-row label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #555;
  margin-bottom: 4px;
}

.config-input {
  width: 100%;
  padding: 8px 10px;
  border-radius: 4px;
  border: 1px solid #ddd;
  font-size: 12px;
  box-sizing: border-box;
}

.config-input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.save-btn {
  padding: 8px 16px;
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.save-btn:hover:not(:disabled) {
  background: #219a52;
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.reset-btn {
  padding: 8px 16px;
  background: #95a5a6;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.reset-btn:hover:not(:disabled) {
  background: #7f8c8d;
}

.reset-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.llm-config-error {
  padding: 8px 12px;
  background: #f8d7da;
  color: #721c24;
  border-radius: 4px;
  font-size: 12px;
  margin-top: 8px;
}

.llm-config-success {
  padding: 8px 12px;
  background: #d4edda;
  color: #155724;
  border-radius: 4px;
  font-size: 12px;
  margin-top: 8px;
}

.change-password-success {
  margin-top: 4px;
  font-size: 12px;
  color: #27ae60;
}
</style>
