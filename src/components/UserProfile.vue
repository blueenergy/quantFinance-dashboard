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
        </div>

        <!-- AI服务配置标签页 -->
        <div v-if="activeTab === 'ai'" class="tab-panel">
          <h3>🤖 AI服务配置</h3>
          
          <div class="ai-config-section">
            <h4>配置管理</h4>
            <div class="config-list">
              <div 
                v-for="(config, index) in aiConfigs" 
                :key="config.id"
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
import { ref, reactive, onMounted } from 'vue'
import axios from 'axios'

// Rely on Vite proxy configuration instead of setting baseURL
// Vite will proxy /api/* requests to http://localhost:3001

export default {
  name: 'UserProfile',
  setup() {
    // 标签页管理
    const activeTab = ref('personal')
    const tabs = [
      { key: 'personal', title: '个人资料' },
      { key: 'security', title: '安全设置' },
      { key: 'ai', title: 'AI服务' },
      { key: 'securities', title: '证券账户' }
    ]
    
    // 个人资料
    const profile = reactive({
      username: '',
      email: '',
      full_name: '',
      email_verified: false
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
        password: '',
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
        password: '' // 不显示现有密码
      })
      showAddAccountModal.value = true
    }
    
    // 保存账户
    const saveAccount = async () => {
      // 真实账户必须填写券商、账户ID和密码
      if (currentAccount.account_type === 'real') {
        if (!currentAccount.broker) {
          alert('请选择券商')
          return
        }
        if (!currentAccount.account_id) {
          alert('请输入账户ID')
          return
        }
        if (!currentAccount.password) {
          alert('请输入密码')
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
</style>