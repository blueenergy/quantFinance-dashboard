<template>
  <div class="user-profile">
    <div class="profile-header">
      <h2>👤 用户配置中心</h2>
    </div>

    <div class="profile-tabs">
      <div class="tab-buttons">
        <button 
          v-for="tab in tabs" 
          :key="tab.key"
          :class="['tab-btn', { active: activeTab === tab.key }]"
          @click="switchTab(tab.key)"
        >
          {{ tab.title }}
        </button>
      </div>

      <div class="tab-content">
        <!-- 个人资料标签页 -->
        <div v-if="activeTab === 'personal'" class="tab-panel">
          <h3>📝 个人资料</h3>
          <div class="form-group">
            <label>用户名</label>
            <input 
              v-model="profile.username" 
              type="text" 
              class="form-control" 
              :disabled="true"
              placeholder="用户名不可修改"
            />
          </div>
          
          <div class="form-group">
            <label>邮箱</label>
            <div class="email-input-group">
              <input 
                v-model="profile.email" 
                type="email" 
                class="form-control" 
                :disabled="!isEditingEmail"
                placeholder="请输入邮箱地址"
              />
              <button 
                v-if="!isEditingEmail" 
                @click="startEditEmail" 
                class="edit-btn"
              >
                ✏️ 修改
              </button>
              <button 
                v-else 
                @click="confirmEditEmail" 
                class="save-btn"
              >
                ✓ 保存
              </button>
            </div>
            <div v-if="emailVerificationRequired" class="verification-notice">
              <p>📧 邮箱验证链接已发送至您的邮箱，请查收并点击验证链接</p>
              <button @click="resendVerification" class="resend-btn">重新发送验证邮件</button>
            </div>
          </div>
          
          <div class="form-group">
            <label>全名</label>
            <input 
              v-model="profile.full_name" 
              type="text" 
              class="form-control" 
              placeholder="请输入您的全名"
            />
          </div>
          
          <div class="form-actions">
            <button @click="saveProfile" class="save-btn">保存资料</button>
          </div>
        </div>

        <!-- 安全设置标签页 -->
        <div v-if="activeTab === 'security'" class="tab-panel">
          <h3>🔒 安全设置</h3>
          
          <div class="security-section">
            <h4>密码管理</h4>
            <div class="form-group">
              <label>当前密码</label>
              <input 
                v-model="passwordChange.old_password" 
                type="password" 
                class="form-control" 
                placeholder="请输入当前密码"
              />
            </div>
            
            <div class="form-group">
              <label>新密码</label>
              <input 
                v-model="passwordChange.new_password" 
                type="password" 
                class="form-control" 
                placeholder="请输入新密码（至少8位）"
              />
            </div>
            
            <div class="form-group">
              <label>确认新密码</label>
              <input 
                v-model="passwordChange.confirm_password" 
                type="password" 
                class="form-control" 
                placeholder="请再次输入新密码"
              />
            </div>
            
            <div class="form-actions">
              <button @click="changePassword" class="save-btn">修改密码</button>
            </div>
          </div>
          
          <div class="security-section">
            <h4>双因素认证</h4>
            <div class="form-group">
              <label class="checkbox-label">
                <input 
                  v-model="securitySettings.two_factor_enabled" 
                  type="checkbox" 
                  @change="toggleTwoFactor"
                />
                启用双因素认证
              </label>
            </div>
          </div>
          
          <!-- API Token 管理 -->
          <div class="security-section">
            <h4>🔑 API Token 管理</h4>
            <p class="section-description">用于 quantTrader 远程连接</p>
            
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
              <button @click="generateNewToken" class="save-btn" :disabled="tokenGenerating">
                {{ tokenGenerating ? '⏳ 生成中...' : (apiToken ? '🔄 重新生成' : '✨ 生成 Token') }}
              </button>
              <button v-if="apiToken" @click="revokeToken" class="delete-btn" :disabled="tokenGenerating">
                🗑️ 撤销
              </button>
            </div>
            
            <div v-if="tokenError" class="error-message">{{ tokenError }}</div>
            <div v-if="tokenSuccess" class="success-message">{{ tokenSuccess }}</div>
            
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
        </div>

        <!-- AI服务配置标签页 -->
        <div v-if="activeTab === 'ai'" class="tab-panel">
          <h3>🤖 AI服务配置</h3>
          
          <div class="ai-config-section">
            <h4>配置管理</h4>
            <div class="config-list">
              <div 
                v-for="(config, index) in aiConfigs" 
                :key="`ai-cfg-${index}-${config.id || 'na'}`"
                :class="['config-item', { active: config.id === activeAIConfigId }]"
              >
                <div class="config-info">
                  <span class="config-name">{{ config.name || config.provider || '未命名配置' }} - {{ config.model || '默认模型' }}</span>
                  <span class="config-status">{{ config.id === activeAIConfigId ? '当前激活' : '' }}</span>
                </div>
                <div class="config-actions">
                  <button @click="activateConfig(config.id)" class="activate-btn" :disabled="config.id === activeAIConfigId">
                    {{ config.id === activeAIConfigId ? '已激活' : '激活' }}
                  </button>
                  <button @click="editConfig(index)" class="edit-btn">编辑</button>
                  <button @click="deleteConfig(index)" class="delete-btn">删除</button>
                </div>
              </div>
            </div>
            
            <button @click="addNewConfig" class="add-config-btn">+ 添加新配置</button>
          </div>
          
          <div class="ai-config-form" v-if="showConfigForm">
            <h4>{{ editingConfigIndex !== null ? '编辑配置' : '添加新配置' }}</h4>
            
            <div class="form-group">
              <label>配置名称</label>
              <input 
                v-model="currentConfig.name" 
                type="text" 
                class="form-control" 
                placeholder="给配置起个名称，如：我的OpenAI配置"
              />
            </div>
            
            <div class="form-group">
              <label>LLM提供商</label>
              <input 
                v-model="currentConfig.provider" 
                type="text" 
                class="form-control" 
                placeholder="请输入提供商名称，如：openai, deepseek, 或其他自定义提供商"
              />
            </div>
            
            <div class="form-group">
              <label>API密钥</label>
              <div class="api-key-group">
                <input 
                  v-model="currentConfig.api_key" 
                  :type="showApiKey ? 'text' : 'password'" 
                  class="form-control" 
                  placeholder="请输入API密钥"
                />
                <button @click="toggleApiKeyVisibility" class="toggle-btn">
                  {{ showApiKey ? '🙈 隐藏' : '👁️ 显示' }}
                </button>
              </div>
            </div>
            
            <div class="form-group">
              <label>API基础URL</label>
              <div class="api-url-group">
                <input 
                  v-model="currentConfig.base_url" 
                  type="url" 
                  class="form-control" 
                  placeholder="请输入API基础URL"
                />
                <button @click="applyDefaultSettings" class="apply-default-btn" type="button">自动填充</button>
              </div>
            </div>
            
            <div class="form-group">
              <label>模型名称</label>
              <input 
                v-model="currentConfig.model" 
                type="text" 
                class="form-control" 
                placeholder="请输入模型名称"
              />
            </div>
            
            <div class="form-actions">
              <button @click="saveCurrentConfig" class="save-btn">{{ editingConfigIndex !== null ? '更新配置' : '保存配置' }}</button>
              <button @click="cancelEdit" class="cancel-btn">取消</button>
            </div>
          </div>
        </div>

        <!-- 证券账户管理标签页 -->
        <div v-if="activeTab === 'securities'" class="tab-panel">
          <h3>🏦 证券账户管理</h3>
          
          <div class="securities-actions">
            <button @click="showAddAccountModal = true" class="add-btn">+ 添加账户</button>
          </div>
          
          <div v-if="securitiesAccounts.length === 0" class="no-accounts">
            <p>暂无证券账户，请添加账户以开始交易</p>
          </div>
          
          <div v-else class="accounts-list">
            <div 
              v-for="account in securitiesAccounts" 
              :key="account.id" 
              class="account-item"
              :class="{ 'simulated-account': account.account_type === 'simulated' }"
            >
              <div class="account-header">
                <div class="account-title">
                  <span class="broker-name">{{ account.broker }}</span>
                  <span class="account-type-badge" :class="account.account_type">
                    {{ account.account_type === 'simulated' ? '🧪 模拟' : '💼 真实' }}
                  </span>
                </div>
                <div class="account-actions">
                  <button @click="editAccount(account)" class="edit-btn">编辑</button>
                  <button @click="deleteAccount(account.id)" class="delete-btn">删除</button>
                </div>
              </div>
              <div class="account-details">
                <div class="detail-row">
                  <span class="detail-label">账户ID:</span>
                  <span class="detail-value">{{ account.account_id }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">数据库ID:</span>
                  <span class="detail-value id-monospace">{{ account.id }}</span>
                  <button @click="copyToClipboard(account.id)" class="copy-btn" title="复制ID">📋</button>
                </div>
                <div v-if="account.account_type === 'simulated' && account.initial_cash" class="detail-row">
                  <span class="detail-label">初始资金:</span>
                  <span class="detail-value">￥{{ account.initial_cash.toLocaleString() }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">创建时间:</span>
                  <span class="detail-value">{{ formatDate(account.created_at) }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 单账户限制提示 -->
          <div v-if="securitiesAccounts.length > 0" class="info-notice" style="margin-top: 16px;">
            <small style="color: #666;">
              💡 当前版本每个用户只支持一个账户。如需多账户，请注册多个用户。
            </small>
          </div>
        </div>
        
        <!-- 服务升级标签页 -->
        <div v-if="activeTab === 'permissions'" class="tab-panel">
          <h3>🚀 服务升级</h3>
          <div class="upgrade-section">
            <UpgradeRequest :current-user="profile" />
          </div>
        </div>
      </div>
    </div>

    <!-- 添加证券账户模态框 -->
    <div v-if="showAddAccountModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h4>{{ editingAccount ? '编辑账户' : '添加证券账户' }}</h4>
          <button @click="closeModal" class="close-btn">×</button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label>账户类型</label>
            <select 
              v-model="currentAccount.account_type" 
              class="form-control"
            >
              <option value="simulated">模拟账户（推荐）</option>
              <option value="real">真实账户</option>
            </select>
            <small class="form-hint">
              <strong>观察模式：</strong>Worker 会生成交易信号，但 quantTrader 不会执行，您可以观察信号质量<br>
              <strong>真实交易：</strong>配置后 quantTrader 会自动执行交易信号
            </small>
          </div>
          
          <!-- 模拟账户特有字段 -->
          <div v-if="currentAccount.account_type === 'simulated'" class="form-group">
            <label>初始资金（元）</label>
            <input 
              v-model.number="currentAccount.initial_cash" 
              type="number" 
              class="form-control" 
              placeholder="默认 1,000,000 元"
              step="10000"
            />
            <small class="form-hint">
              用于前端显示模拟盈亏，默认100万元
            </small>
          </div>
          
          <!-- 观察模式提示信息 -->
          <div v-if="currentAccount.account_type === 'simulated'" class="form-group">
            <div class="info-box">
              <span class="info-icon">👀</span>
              <div>
                <div><strong>观察模式</strong>可以让您：</div>
                <ul style="margin: 8px 0; padding-left: 20px;">
                  <li>看到 Worker 生成的所有交易信号</li>
                  <li>评估策略的信号质量</li>
                  <li>零风险体验完整流程</li>
                  <li>随时切换到真实交易</li>
                </ul>
                <div style="margin-top: 8px; color: #666;">
                  提示：quantTrader 会自动跳过观察模式账户的信号执行
                </div>
              </div>
            </div>
          </div>
          
          <!-- 真实账户才需要选择券商 -->
          <div v-if="currentAccount.account_type === 'real'" class="form-group">
            <label>券商</label>
            <select 
              v-model="currentAccount.broker" 
              class="form-control"
            >
              <option value="">请选择券商</option>
              <option value="中信证券">中信证券</option>
              <option value="华泰证券">华泰证券</option>
              <option value="国泰君安">国泰君安</option>
              <option value="国金证券">国金证券</option>
              <option value="招商证券">招商证券</option>
              <option value="东方财富">东方财富</option>
              <option value="广发证券">广发证券</option>
              <option value="光大证券">光大证券</option>
              <option value="海通证券">海通证券</option>
              <option value="其他">其他</option>
            </select>
          </div>
          
          <!-- 真实账户才需要输入账户ID -->
          <div v-if="currentAccount.account_type === 'real'" class="form-group">
            <label>账户ID</label>
            <input 
              v-model="currentAccount.account_id" 
              type="text" 
              class="form-control" 
              placeholder="请输入账户ID"
            />
            <small class="form-hint">
              <strong>提示：</strong>真实交易需要在 quantTrader 中配置券商账户密码，此处无需填写密码。
            </small>
          </div>
        </div>
        
        <div class="modal-footer">
          <button @click="closeModal" class="cancel-btn">取消</button>
          <button @click="saveAccount" class="save-btn">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, computed } from 'vue'
import axios from 'axios'
import UpgradeRequest from './UpgradeRequest.vue'

// Rely on Vite proxy configuration instead of setting baseURL
// Vite will proxy /api/* requests to http://localhost:3001

export default {
  name: 'UserProfile',
  components: {
    UpgradeRequest
  },
  setup() {
    // 标签页管理
    const activeTab = ref('personal')
    const tabs = [
      { key: 'personal', title: '个人资料' },
      { key: 'security', title: '安全设置' },
      { key: 'ai', title: 'AI服务' },
      { key: 'securities', title: '证券账户' },
      { key: 'permissions', title: '服务升级' }
    ]
    
    // 个人资料
    const profile = reactive({
      username: '',
      email: '',
      full_name: '',
      email_verified: false,
      is_admin: false,
      service_level: 'free'
    })
    
    // 邮箱编辑状态
    const isEditingEmail = ref(false)
    const emailVerificationRequired = ref(false)
    
    // 密码修改
    const passwordChange = reactive({
      old_password: '',
      new_password: '',
      confirm_password: ''
    })
    
    // 安全设置
    const securitySettings = reactive({
      two_factor_enabled: false
    })
    
    // API Token 管理
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
    
    // AI配置 - 支持多配置
    const aiConfigs = ref([])
    const activeAIConfigId = ref(null)
    const showConfigForm = ref(false)
    const editingConfigIndex = ref(null)
    
    const currentConfig = reactive({
      id: '',
      name: '',
      provider: '',
      api_key: '',
      base_url: '',
      model: '',
      created_at: null,
      updated_at: null
    })
    const showApiKey = ref(false)
    
    // 证券账户
    const securitiesAccounts = ref([])
    const showAddAccountModal = ref(false)
    const editingAccount = ref(false)
    const currentAccount = reactive({
      id: '',
      broker: '',
      account_id: '',
      account_type: 'simulated',  // 默认模拟账户
      initial_cash: 1000000  // 默认100万
    })
    
    // 切换标签页
    const switchTab = (tabKey) => {
      activeTab.value = tabKey
      
      // 根据标签页加载相应数据
      if (tabKey === 'personal') {
        loadProfile()
      } else if (tabKey === 'security') {
        loadSecuritySettings()
      } else if (tabKey === 'ai') {
        loadAIConfig()
      } else if (tabKey === 'securities') {
        loadSecuritiesAccounts()
      } else if (tabKey === 'permissions') {
        // 确保加载最新的用户信息（包括 is_admin）
        loadProfile()
      }
    }
    
    // 加载用户资料
    const loadProfile = async () => {
      try {
        const response = await axios.get('/api/user/profile')
        if (response.data && response.data.user) {
          const user = response.data.user
          profile.username = user.username
          profile.email = user.email
          profile.full_name = user.full_name
          profile.email_verified = user.email_verified || false
          profile.is_admin = user.is_admin || false
          profile.service_level = user.service_level || 'free'
        }
      } catch (error) {
        console.error('加载用户资料失败:', error)
      }
    }
    
    // 保存用户资料
    const saveProfile = async () => {
      try {
        const response = await axios.put('/api/user/profile', {
          full_name: profile.full_name
        })
        
        if (response.data.success) {
          alert('个人资料保存成功！')
        }
      } catch (error) {
        console.error('保存个人资料失败:', error)
        alert('保存失败: ' + (error.response?.data?.detail || error.message))
      }
    }
    
    // 开始编辑邮箱
    const startEditEmail = () => {
      isEditingEmail.value = true
    }
    
    // 确认编辑邮箱
    const confirmEditEmail = async () => {
      if (!profile.email) {
        alert('请输入邮箱地址')
        return
      }
      
      try {
        const response = await axios.put('/api/user/email', {
          email: profile.email
        })
        
        if (response.data.success) {
          emailVerificationRequired.value = true
          isEditingEmail.value = false
          alert('邮箱地址已更新，验证邮件已发送到您的邮箱')
        }
      } catch (error) {
        console.error('更新邮箱失败:', error)
        alert('更新邮箱失败: ' + (error.response?.data?.detail || error.message))
      }
    }
    
    // 重新发送验证邮件
    const resendVerification = async () => {
      try {
        await axios.post('/api/user/resend-verification')
        alert('验证邮件已重新发送')
      } catch (error) {
        console.error('发送验证邮件失败:', error)
        alert('发送验证邮件失败')
      }
    }
    
    // 加载安全设置
    const loadSecuritySettings = async () => {
      // 加载双因素认证状态等安全设置
      try {
        const response = await axios.get('/api/user/security-settings')
        if (response.data) {
          securitySettings.two_factor_enabled = response.data.two_factor_enabled || false
        }
      } catch (error) {
        console.error('加载安全设置失败:', error)
      }
      
      // 加载 API Token
      apiToken.value = localStorage.getItem('access_token') || ''
      if (apiToken.value) {
        calculateTokenExpiry()
      }
    }
    
    // 修改密码
    const changePassword = async () => {
      if (passwordChange.new_password !== passwordChange.confirm_password) {
        alert('新密码和确认密码不匹配')
        return
      }
      
      if (passwordChange.new_password.length < 8) {
        alert('新密码长度不能少于8位')
        return
      }
      
      try {
        const response = await axios.post('/api/user/change-password', {
          old_password: passwordChange.old_password,
          new_password: passwordChange.new_password
        })
        
        if (response.data.success) {
          alert('密码修改成功')
          passwordChange.old_password = ''
          passwordChange.new_password = ''
          passwordChange.confirm_password = ''
        }
      } catch (error) {
        console.error('修改密码失败:', error)
        alert('修改密码失败: ' + (error.response?.data?.detail || error.message))
      }
    }
    
    // 切换双因素认证
    const toggleTwoFactor = async () => {
      try {
        await axios.put('/api/user/two-factor', {
          enabled: securitySettings.two_factor_enabled
        })
        alert(securitySettings.two_factor_enabled ? '双因素认证已启用' : '双因素认证已禁用')
      } catch (error) {
        console.error('更新双因素认证设置失败:', error)
        securitySettings.two_factor_enabled = !securitySettings.two_factor_enabled
        alert('更新设置失败')
      }
    }
    
    // API Token 方法
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
          
          // 30秒后自动隐藏
          setTimeout(() => {
            tokenRevealed.value = false
          }, 30000)
        }
      } catch (err) {
        // 如果没有 refresh endpoint，提示用户重新登录
        if (err.response?.status === 404) {
          tokenError.value = '请重新登录以获取新 Token'
          
          setTimeout(() => {
            // logout logic can be added here if needed
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
    
    // 加载AI配置
    const loadAIConfig = async () => {
      try {
        // 获取激活的配置ID
        const profileResponse = await axios.get('/api/user/profile')
        if (profileResponse.data && profileResponse.data.user) {
          const user = profileResponse.data.user
          activeAIConfigId.value = user.active_llm_config_id || null
        }
        
        // 获取所有LLM配置
        const response = await axios.get('/api/user/llm-configs')
        if (response.data) {
          aiConfigs.value = response.data
        }
      } catch (error) {
        console.error('加载AI配置失败:', error)
        // 即使加载失败也显示错误信息
        alert('加载AI配置失败: ' + (error.response?.data?.detail || error.message))
      }
    }
    

    
    // 获取默认API基础URL
    const getDefaultBaseUrl = () => {
      if (currentConfig.provider.toLowerCase().includes('openai')) {
        return 'https://api.openai.com/v1'
      } else if (currentConfig.provider.toLowerCase().includes('deepseek')) {
        return 'https://api.deepseek.com/v1'
      } else if (currentConfig.provider.toLowerCase().includes('anthropic')) {
        return 'https://api.anthropic.com/v1'
      } else if (currentConfig.provider.toLowerCase().includes('google')) {
        return 'https://generativelanguage.googleapis.com/v1'
      } else if (currentConfig.provider.toLowerCase().includes('azure')) {
        return '' // Azure需要用户指定特定端点
      }
      return ''
    }
    
    // 获取默认模型
    const getDefaultModel = () => {
      if (currentConfig.provider.toLowerCase().includes('openai')) {
        return 'gpt-3.5-turbo'
      } else if (currentConfig.provider.toLowerCase().includes('deepseek')) {
        return 'deepseek-chat'
      } else if (currentConfig.provider.toLowerCase().includes('anthropic')) {
        return 'claude-3-haiku-20240307'
      } else if (currentConfig.provider.toLowerCase().includes('google')) {
        return 'gemini-pro'
      }
      return ''
    }
    
    // 切换API密钥可见性
    const toggleApiKeyVisibility = () => {
      showApiKey.value = !showApiKey.value
    }
    
    // 添加新配置
    const addNewConfig = () => {
      resetCurrentConfig()
      editingConfigIndex.value = null
      showConfigForm.value = true
    }
    
    // 编辑配置
    const editConfig = (index) => {
      const config = aiConfigs.value[index]
      Object.assign(currentConfig, {
        id: config.id,
        name: config.name,
        provider: config.provider,
        api_key: '', // 不加载API密钥出于安全考虑
        base_url: config.base_url,
        model: config.model
      })
      editingConfigIndex.value = index
      showConfigForm.value = true
    }
    
    // 删除配置
    const deleteConfig = async (index) => {
      if (!confirm('确定要删除这个配置吗？此操作不可恢复。')) {
        return
      }
      
      try {
        const config = aiConfigs.value[index]
        await axios.delete(`/api/user/llm-configs/${config.id}`)
        aiConfigs.value.splice(index, 1)
        
        // 如果删除的是激活的配置，取消激活
        if (config.id === activeAIConfigId.value) {
          activeAIConfigId.value = null
        }
        
        alert('配置删除成功')
      } catch (error) {
        console.error('删除配置失败:', error)
        alert('删除失败: ' + (error.response?.data?.detail || error.message))
      }
    }
    
    // 激活配置
    const activateConfig = async (configId) => {
      try {
        const response = await axios.post(`/api/user/llm-configs/${configId}/activate`)
        activeAIConfigId.value = configId
        
        // 根据后端返回的消息显示不同的提示
        if (response.data.message && response.data.message.includes('已经是激活状态')) {
          alert('配置已经是激活状态')
        } else {
          alert('配置激活成功')
        }
        
        // 激活之后重新加载用户下载地的active_llm_config_id以确保后续检查昐样
        const profileResponse = await axios.get('/api/user/profile', {
          params: { t: Date.now() }
        })
        if (profileResponse.data && profileResponse.data.user) {
          activeAIConfigId.value = profileResponse.data.user.active_llm_config_id || null
          console.log('[激活配置] 成功更新active_llm_config_id:', activeAIConfigId.value)
        }
      } catch (error) {
        console.error('激活配置失败:', error)
        alert('激活失败: ' + (error.response?.data?.detail || error.message))
      }
    }
    
    // 保存当前配置
    const saveCurrentConfig = async () => {
      if (!currentConfig.name || !currentConfig.provider) {
        alert('请填写配置名称和提供商')
        return
      }
      
      try {
        if (editingConfigIndex.value !== null) {
          // 更新现有配置
          const configId = aiConfigs.value[editingConfigIndex.value].id
          const response = await axios.put(`/api/user/llm-configs/${configId}`, {
            name: currentConfig.name,
            provider: currentConfig.provider,
            api_key: currentConfig.api_key || undefined, // 如果为空则不更新API密钥
            base_url: currentConfig.base_url,
            model: currentConfig.model
          })
          
          // 更新本地数组
          Object.assign(aiConfigs.value[editingConfigIndex.value], response.data)
        } else {
          // 创建新配置
          const response = await axios.post('/api/user/llm-configs', {
            name: currentConfig.name,
            provider: currentConfig.provider,
            api_key: currentConfig.api_key,
            base_url: currentConfig.base_url,
            model: currentConfig.model
          })
          
          aiConfigs.value.push(response.data)
        }
        
        alert(editingConfigIndex.value !== null ? '配置更新成功' : '配置保存成功')
        resetCurrentConfig()
        showConfigForm.value = false
      } catch (error) {
        console.error('保存配置失败:', error)
        alert('保存失败: ' + (error.response?.data?.detail || error.message))
      }
    }
    
    // 取消编辑
    const cancelEdit = () => {
      resetCurrentConfig()
      showConfigForm.value = false
      editingConfigIndex.value = null
    }
    
    // 重置当前配置
    const resetCurrentConfig = () => {
      Object.assign(currentConfig, {
        id: '',
        name: '',
        provider: '',
        api_key: '',
        base_url: '',
        model: ''
      })
    }
    
    // 应用默认设置
    const applyDefaultSettings = () => {
      if (!currentConfig.provider) {
        alert('请先输入提供商名称')
        return
      }
      
      currentConfig.base_url = getDefaultBaseUrl()
      currentConfig.model = getDefaultModel()
      
      if (!currentConfig.base_url) {
        alert('未能识别提供商类型，无法自动填充基础URL，请手动输入')
      }
      if (!currentConfig.model) {
        alert('未能识别提供商类型，无法自动填充模型名称，请手动输入')
      }
    }
    
    // 加载证券账户
    const loadSecuritiesAccounts = async () => {
      try {
        const response = await axios.get('/api/user/securities_accounts')
        securitiesAccounts.value = response.data || []
        
        // 调试：打印账户数据
        console.log('=== 证券账户加载成功 ===')
        console.log('账户数量:', securitiesAccounts.value.length)
        securitiesAccounts.value.forEach((acc, index) => {
          console.log(`账户 ${index + 1}:`, {
            id: acc.id,
            broker: acc.broker,
            account_id: acc.account_id,
            account_type: acc.account_type
          })
        })
        
        // 检查是否有重复的 id
        const ids = securitiesAccounts.value.map(acc => acc.id)
        const uniqueIds = new Set(ids)
        if (ids.length !== uniqueIds.size) {
          console.error('⚠️ 警告：发现重复的账户ID！')
          console.error('所有ID:', ids)
        }
      } catch (error) {
        console.error('加载证券账户失败:', error)
      }
    }
    
    // 显示添加账户模态框
    const showAddAccount = () => {
      editingAccount.value = false
      Object.assign(currentAccount, {
        id: '',
        broker: '',
        account_id: '',
        account_type: 'simulated',
        initial_cash: 1000000
      })
      showAddAccountModal.value = true
    }
    
    // 编辑账户
    const editAccount = (account) => {
      editingAccount.value = true
      Object.assign(currentAccount, {
        id: account.id,
        broker: account.broker,
        account_id: account.account_id,
        account_type: account.account_type || 'simulated',  // 使用原有的账户类型
        initial_cash: account.initial_cash || 1000000  // 使用原有的初始资金
      })
      showAddAccountModal.value = true
    }
    
    // 保存账户
    const saveAccount = async () => {
      // 真实账户必须填写券商和账户ID
      if (currentAccount.account_type === 'real') {
        if (!currentAccount.broker) {
          alert('请选择券商')
          return
        }
        if (!currentAccount.account_id) {
          alert('请输入账户ID')
          return
        }
      }
      // 模拟账户不需要任何输入验证
      
      try {
        let response
        if (editingAccount.value) {
          // 更新现有账户
          const updateData = {
            broker: currentAccount.broker,
            account_type: currentAccount.account_type
          }
          // 真实账户才需要账户ID
          if (currentAccount.account_type === 'real') {
            updateData.account_id = currentAccount.account_id
          }
          response = await axios.put(`/api/user/securities_accounts/${currentAccount.id}`, updateData)
        } else {
          // 创建新账户
          const createData = {
            broker: currentAccount.broker,
            account_type: currentAccount.account_type
          }
          
          if (currentAccount.account_type === 'real') {
            createData.account_id = currentAccount.account_id
          } else {
            // 模拟账户：account_id 在后端自动生成，只发送初始资金
            createData.initial_cash = currentAccount.initial_cash || 1000000
          }
          
          response = await axios.post('/api/user/securities_accounts', createData)
        }
        
        if (response.data) {
          alert(editingAccount.value ? '账户更新成功' : '账户添加成功')
          closeModal()
          loadSecuritiesAccounts() // 重新加载账户列表
        }
      } catch (error) {
        console.error('保存账户失败:', error)
        alert('保存失败: ' + (error.response?.data?.detail || error.message))
      }
    }
    
    // 删除账户
    const deleteAccount = async (accountId) => {
      if (!confirm('确定要删除这个证券账户吗？此操作不可恢复。')) {
        return
      }
      
      try {
        await axios.delete(`/api/user/securities_accounts/${accountId}`)
        alert('账户删除成功')
        loadSecuritiesAccounts() // 重新加载账户列表
      } catch (error) {
        console.error('删除账户失败:', error)
        
        // 如果是404，说明账户已经不存在了，直接刷新列表
        if (error.response?.status === 404) {
          alert('账户不存在或已被删除，将刷新列表')
          loadSecuritiesAccounts() // 刷新列表移除UI中的该账户
        } else if (error.response?.status === 403) {
          alert('无权删除此账户')
        } else {
          alert('删除失败: ' + (error.response?.data?.detail || error.message))
        }
      }
    }
    
    // 关闭模态框
    const closeModal = () => {
      showAddAccountModal.value = false
    }
    
    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return '未知'
      return new Date(dateString).toLocaleString('zh-CN')
    }
    
    // 复制到剪贴板
    const copyToClipboard = async (text) => {
      try {
        await navigator.clipboard.writeText(text)
        alert('已复制到剪贴板')
      } catch (err) {
        // 备用方案
        const textarea = document.createElement('textarea')
        textarea.value = text
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        alert('已复制到剪贴板')
      }
    }
    
    // 初始化加载个人资料
    onMounted(async () => {
      loadProfile()
      
      // 同时加载AI配置信息（获取激活配置ID和所有配置）
      try {
        // 首先获取激活配置ID
        const profileResponse = await axios.get('/api/user/profile')
        if (profileResponse.data && profileResponse.data.user) {
          const user = profileResponse.data.user
          activeAIConfigId.value = user.active_llm_config_id || null
        }
        
        // 然后获取所有配置（但不等待，这样不会阻塞页面加载）
        loadAIConfig()
      } catch (error) {
        console.error('加载AI配置信息失败:', error)
      }
    })
    
    return {
      activeTab,
      tabs,
      switchTab,
      
      // 个人资料
      profile,
      isEditingEmail,
      emailVerificationRequired,
      startEditEmail,
      confirmEditEmail,
      resendVerification,
      saveProfile,
      
      // 密码修改
      passwordChange,
      changePassword,
      
      // 安全设置
      securitySettings,
      toggleTwoFactor,
      loadSecuritySettings,
      
      // API Token 管理
      apiToken,
      tokenRevealed,
      tokenCopied,
      tokenGenerating,
      tokenError,
      tokenSuccess,
      tokenExpires,
      apiBaseUrl,
      maskedToken,
      toggleTokenVisibility,
      copyToken,
      generateNewToken,
      revokeToken,
      
      // AI配置
      aiConfigs,
      activeAIConfigId,
      showConfigForm,
      editingConfigIndex,
      currentConfig,
      showApiKey,
      toggleApiKeyVisibility,
      loadAIConfig,
      addNewConfig,
      editConfig,
      deleteConfig,
      activateConfig,
      saveCurrentConfig,
      cancelEdit,
      getDefaultBaseUrl,
      getDefaultModel,
      applyDefaultSettings,
      
      // 证券账户
      securitiesAccounts,
      showAddAccountModal,
      editingAccount,
      currentAccount,
      loadSecuritiesAccounts,
      showAddAccount,
      editAccount,
      saveAccount,
      deleteAccount,
      closeModal,
      
      // 工具函数
      formatDate,
      copyToClipboard
    }
  }
}
</script>

<style scoped>
.user-profile {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
  background: #f8f9fa;
  border-radius: 8px;
  min-height: 600px;
}

.profile-header {
  margin-bottom: 20px;
}

.profile-header h2 {
  margin: 0;
  color: #333;
  font-size: 24px;
}

.profile-tabs {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  overflow: hidden;
}

.tab-buttons {
  display: flex;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
}

.tab-btn {
  flex: 1;
  padding: 15px 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  transition: all 0.3s;
}

.tab-btn:hover {
  background: #e9ecef;
}

.tab-btn.active {
  color: #007bff;
  border-bottom: 3px solid #007bff;
  background: white;
}

.tab-content {
  padding: 20px;
}

.tab-panel {
  min-height: 400px;
}

.tab-panel h3 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #333;
  font-size: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #555;
}

.form-control {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-control:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.form-hint {
  display: block;
  margin-top: 5px;
  font-size: 12px;
  color: #6c757d;
}

.info-box {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  background: #e3f2fd;
  border-left: 4px solid #2196f3;
  border-radius: 4px;
  font-size: 14px;
  color: #0d47a1;
}

.info-box div {
  line-height: 1.6;
}

.info-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.email-input-group {
  display: flex;
  gap: 10px;
  align-items: center;
}

.edit-btn, .save-btn, .resend-btn, .test-btn {
  padding: 8px 16px;
  border: 1px solid #007bff;
  background: #007bff;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.edit-btn:hover, .save-btn:hover, .resend-btn:hover, .test-btn:hover {
  background: #0056b3;
}

.form-actions {
  margin-top: 20px;
  display: flex;
  gap: 10px;
}

.security-section {
  margin-bottom: 30px;
  padding: 15px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  background: #f8f9fa;
}

.security-section h4 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #333;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.api-key-group {
  display: flex;
  gap: 10px;
}

.api-url-group {
  display: flex;
  gap: 10px;
}

.apply-default-btn {
  padding: 10px 12px;
  border: 1px solid #28a745;
  background: #28a745;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}

.apply-default-btn:hover {
  background: #218838;
  border-color: #1e7e34;
}

.toggle-btn {
  padding: 10px 12px;
  border: 1px solid #ddd;
  background: #f8f9fa;
  border-radius: 4px;
  cursor: pointer;
}

.securities-actions {
  margin-bottom: 20px;
}

.add-btn {
  padding: 10px 16px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.no-accounts {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}

.accounts-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.account-item {
  padding: 15px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  background: white;
  transition: all 0.3s;
}

.account-item:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.account-item.simulated-account {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-color: #667eea;
}

.account-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.account-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.broker-name {
  font-weight: 600;
  color: #333;
}

.account-type-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.account-type-badge.simulated {
  background: #667eea;
  color: white;
}

.account-type-badge.real {
  background: #28a745;
  color: white;
}

.account-id {
  color: #6c757d;
  font-family: monospace;
}

.account-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: #666;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-label {
  font-weight: 500;
  color: #555;
  min-width: 80px;
}

.detail-value {
  color: #333;
}

.id-monospace {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
}

.copy-btn {
  background: transparent;
  border: 1px solid #ddd;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: #f0f0f0;
  border-color: #007bff;
}

.account-details span {
  display: inline-flex;
  align-items: center;
}

.account-actions {
  display: flex;
  gap: 8px;
}

.delete-btn {
  padding: 4px 8px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.delete-btn:hover {
  background: #c82333;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h4 {
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6c757d;
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  padding: 15px 20px;
  border-top: 1px solid #e9ecef;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.ai-config-section {
  margin-bottom: 30px;
}

.ai-config-section h4 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #333;
  border-bottom: 1px solid #e9ecef;
  padding-bottom: 8px;
}

.config-list {
  margin-bottom: 15px;
}

.config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  margin-bottom: 8px;
  background: #f8f9fa;
}

.config-item.active {
  border-color: #007bff;
  background: #e7f3ff;
}

.config-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.config-name {
  font-weight: 600;
  color: #333;
}

.config-status {
  font-size: 12px;
  color: #28a745;
  font-weight: 500;
}

.config-actions {
  display: flex;
  gap: 8px;
}

.activate-btn {
  padding: 6px 12px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.activate-btn:hover:not(:disabled) {
  background: #0056b3;
}

.activate-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.edit-btn {
  padding: 6px 12px;
  background: #17a2b8;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.edit-btn:hover {
  background: #138496;
}

.delete-btn {
  padding: 6px 12px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.delete-btn:hover {
  background: #c82333;
}

.add-config-btn {
  padding: 10px 16px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.add-config-btn:hover {
  background: #218838;
}

.ai-config-form {
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 20px;
  background: #f8f9fa;
  margin-top: 20px;
}

.cancel-btn {
  padding: 8px 16px;
  border: 1px solid #6c757d;
  background: #6c757d;
  color: white;
  border-radius: 4px;
  cursor: pointer;
}

.cancel-btn:hover {
  background: #5a6268;
}

.verification-notice {
  margin-top: 10px;
  padding: 10px;
  background: #d1ecf1;
  border: 1px solid #bee5eb;
  border-radius: 4px;
  color: #0c5460;
}

.verification-notice p {
  margin: 0 0 10px 0;
}

/* API Token Styles */
.section-description {
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

.error-message {
  padding: 8px 12px;
  background: #f8d7da;
  color: #721c24;
  border-radius: 4px;
  font-size: 12px;
  margin-top: 8px;
}

.success-message {
  padding: 8px 12px;
  background: #d4edda;
  color: #155724;
  border-radius: 4px;
  font-size: 12px;
  margin-top: 8px;
}
</style>