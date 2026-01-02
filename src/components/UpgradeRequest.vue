<template>
  <div class="upgrade-request">
    <h3>服务升级申请</h3>
    
    <!-- 用户申请升级表单 -->
    <div v-if="!isCurrentUserAdmin" class="section">
      <!-- 当前服务级别信息 -->
      <div class="current-level-info">
        <h4>📦 当前服务级别</h4>
        <div class="level-card current">
          <div class="level-header">
            <span class="level-name">{{ getServiceLevelName(currentUser?.service_level || 'free') }}</span>
            <span class="level-badge">当前</span>
          </div>
          <div v-if="serviceLevels && serviceLevels[currentUser?.service_level || 'free']" class="level-features">
            <p class="level-desc">{{ serviceLevels[currentUser?.service_level || 'free'].description }}</p>
            <ul>
              <li v-for="(value, key) in serviceLevels[currentUser?.service_level || 'free'].features" :key="key">
                <span class="feature-name">{{ getFeatureName(key) }}:</span>
                <span class="feature-value">{{ formatFeatureValue(value) }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- 升级选择 -->
      <div class="upgrade-selection">
        <h4>🚀 选择升级目标</h4>
        <div class="controls">
          <select v-model="targetServiceLevel" class="select" @change="onTargetLevelChange">
            <option value="basic">基础版</option>
            <option value="vip">VIP版</option>
            <option value="premium">专业版</option>
          </select>
          <textarea 
            v-model="upgradeReason" 
            placeholder="请输入升级理由（可选）" 
            class="textarea"
            rows="3"
          ></textarea>
          <button @click="submitUpgradeRequest" class="btn btn-primary">提交升级申请</button>
        </div>
        <div v-if="upgradeRequestResult" class="result" :class="{'success': upgradeRequestSuccess, 'error': !upgradeRequestSuccess}">
          {{ upgradeRequestResult }}
        </div>
      </div>

      <!-- 目标服务级别信息 -->
      <div v-if="serviceLevels && serviceLevels[targetServiceLevel]" class="target-level-info">
        <h4>✨ 目标级别详情</h4>
        <div class="level-card target">
          <div class="level-header">
            <span class="level-name">{{ getServiceLevelName(targetServiceLevel) }}</span>
            <span class="level-badge target">升级目标</span>
          </div>
          <div class="level-features">
            <p class="level-desc">{{ serviceLevels[targetServiceLevel].description }}</p>
            <ul>
              <li v-for="(value, key) in serviceLevels[targetServiceLevel].features" :key="key"
                  :class="{ 'feature-upgraded': isFeatureUpgraded(key, value) }">
                <span class="feature-name">{{ getFeatureName(key) }}:</span>
                <span class="feature-value">{{ formatFeatureValue(value) }}</span>
                <span v-if="isFeatureUpgraded(key, value)" class="upgrade-indicator">↑ 升级</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 管理员处理升级请求 -->
    <div v-if="isCurrentUserAdmin" class="section">
      <h4>待处理升级申请</h4>
      <div v-if="upgradeRequests.length > 0">
        <table class="table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>当前级别</th>
              <th>目标级别</th>
              <th>申请理由</th>
              <th>申请时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in upgradeRequests" :key="request.id">
              <td>{{ request.username }}</td>
              <td>{{ getServiceLevelName(request.current_service_level) }}</td>
              <td>{{ getServiceLevelName(request.target_service_level) }}</td>
              <td>{{ request.reason || '无' }}</td>
              <td>{{ formatDate(request.created_at) }}</td>
              <td>
                <button @click="processRequest(request.id, 'approved')" class="btn btn-success">批准</button>
                <button @click="processRequest(request.id, 'rejected')" class="btn btn-danger">拒绝</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else>
        <p>暂无待处理的升级申请</p>
      </div>
    </div>
    
    <!-- 用户查看自己的申请状态 -->
    <div v-if="!isCurrentUserAdmin" class="section">
      <h4>我的升级申请记录</h4>
      <div v-if="userUpgradeRequests.length > 0">
        <table class="table">
          <thead>
            <tr>
              <th>目标级别</th>
              <th>申请理由</th>
              <th>状态</th>
              <th>申请时间</th>
              <th>处理时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in userUpgradeRequests" :key="request.id">
              <td>{{ getServiceLevelName(request.target_service_level) }}</td>
              <td>{{ request.reason || '无' }}</td>
              <td>
                <span :class="'status-' + request.status">{{ getStatusText(request.status) }}</span>
              </td>
              <td>{{ formatDate(request.created_at) }}</td>
              <td>{{ request.updated_at ? formatDate(request.updated_at) : '未处理' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else>
        <p>暂无升级申请记录</p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch } from 'vue'

const API_BASE = import.meta.env.VITE_API_BASE || "/api"

export default {
  name: 'UpgradeRequest',
  props: {
    currentUser: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    const targetServiceLevel = ref('vip')
    const upgradeReason = ref('')
    const upgradeRequestResult = ref('')
    const upgradeRequestSuccess = ref(false)
    const upgradeRequests = ref([])
    const userUpgradeRequests = ref([])
    const isCurrentUserAdmin = ref(false)
    const serviceLevels = ref(null)
    
    // 检查当前用户是否为管理员
    const checkIfAdmin = () => {
      // 初始化为非管理员
      isCurrentUserAdmin.value = false
      
      if (!props.currentUser) {
        return
      }
      
      // 检查是否为管理员
      const isAdmin = props.currentUser.username === 'admin' || 
                     props.currentUser.is_admin === true
      
      // 如果用户是admin或明确标记为管理员，则设为true
      if (isAdmin) {
        isCurrentUserAdmin.value = true
      }
      // 否则默认为非管理员（对于普通用户）
      else {
        isCurrentUserAdmin.value = false
      }
    }
    
    // 获取服务级别名称
    const getServiceLevelName = (level) => {
      const levelNames = {
        'free': '免费版',
        'basic': '基础版',
        'vip': 'VIP版',
        'premium': '专业版'
      }
      return levelNames[level] || level
    }
    
    // 获取状态文本
    const getStatusText = (status) => {
      const statusText = {
        'pending': '待处理',
        'approved': '已批准',
        'rejected': '已拒绝'
      }
      return statusText[status] || status
    }
    
    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return 'N/A'
      const date = new Date(dateString)
      return date.toLocaleString('zh-CN')
    }
    
    // 获取功能名称
    const getFeatureName = (key) => {
      const featureNames = {
        'max_strategies': '最大策略数',
        'max_symbols': '最大股票数',
        'backtest_access': '回测功能',
        'live_trading': '实盘交易',
        'vip_strategies': 'VIP策略',
        'priority_support': '优先支持',
        'custom_indicators': '自定义指标'
      }
      return featureNames[key] || key
    }
    
    // 格式化功能值
    const formatFeatureValue = (value) => {
      if (typeof value === 'boolean') {
        return value ? '✓ 支持' : '✗ 不支持'
      }
      return value
    }
    
    // 判断功能是否升级
    const isFeatureUpgraded = (key, targetValue) => {
      const currentLevel = props.currentUser?.service_level || 'free'
      if (!serviceLevels.value || !serviceLevels.value[currentLevel]) {
        return false
      }
      
      const currentValue = serviceLevels.value[currentLevel].features[key]
      
      // 布尔值比较
      if (typeof targetValue === 'boolean') {
        return targetValue === true && currentValue !== true
      }
      
      // 数值比较
      if (typeof targetValue === 'number') {
        return targetValue > (currentValue || 0)
      }
      
      return false
    }
    
    // 目标级别变化时
    const onTargetLevelChange = () => {
      // 目标级别已变化
    }
    
    // 加载服务级别定义
    const loadServiceLevels = async () => {
      try {
        const token = localStorage.getItem('access_token')
        const headers = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        
        const response = await fetch(`${API_BASE}/permissions/service-levels`, {
          headers
        })
        
        if (response.ok) {
          const data = await response.json()
          serviceLevels.value = data.service_levels
        }
      } catch (error) {
        // 加载失败，使用默认值
      }
    }
    
    // 提交升级申请
    const submitUpgradeRequest = async () => {
      try {
        const token = localStorage.getItem('access_token')
        const headers = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        
        const currentUsername = props.currentUser.username || props.currentUser.name
        if (!currentUsername) {
          upgradeRequestResult.value = '用户信息不完整，无法提交升级申请'
          upgradeRequestSuccess.value = false
          return
        }
        
        const response = await fetch(`${API_BASE}/permissions/upgrade-requests`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            username: currentUsername,
            target_service_level: targetServiceLevel.value,
            reason: upgradeReason.value
          })
        })
        
        // Check if response is ok before trying to parse JSON
        if (response.ok) {
          const result = await response.json()
          upgradeRequestResult.value = result.message
          upgradeRequestSuccess.value = true
          // 重新加载用户申请记录
          await loadUserUpgradeRequests()
          // 清空表单
          upgradeReason.value = ''
        } else {
          // 先克隆响应以便可以多次读取
          const responseClone = response.clone()
          let errorMessage = '未知错误'
          
          // 首先尝试作为JSON解析
          try {
            const errorResult = await response.json()
            errorMessage = errorResult.detail || errorResult.message || '未知错误'
          } catch {
            // 如果JSON解析失败，使用克隆的响应读取文本
            try {
              const textContent = await responseClone.text()
              // 提取HTML中的错误消息或使用通用消息
              if (textContent.includes('Internal Server Error')) {
                errorMessage = '服务器内部错误'
              } else if (textContent.length > 100) {
                errorMessage = '请求失败，请检查服务器状态'
              } else {
                errorMessage = textContent || '未知错误'
              }
            } catch {
              errorMessage = `HTTP ${response.status}: ${response.statusText}`
            }
          }
          upgradeRequestResult.value = `申请失败: ${errorMessage}`
          upgradeRequestSuccess.value = false
        }
      } catch (error) {
        upgradeRequestResult.value = `申请失败: ${error.message}`
        upgradeRequestSuccess.value = false
      }
    }
    
    // 加载待处理的升级申请（仅管理员）
    const loadUpgradeRequests = async () => {
      if (!isCurrentUserAdmin.value) return
      
      try {
        const token = localStorage.getItem('access_token')
        const headers = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        
        const response = await fetch(`${API_BASE}/permissions/upgrade-requests`, {
          headers
        })
        
        if (response.ok) {
          const data = await response.json()
          // 只显示待处理的申请
          upgradeRequests.value = data.requests.filter(req => req.status === 'pending')
        }
      } catch (error) {
        // 加载失败
      }
    }
    
    // 加载用户自己的升级申请记录
    const loadUserUpgradeRequests = async () => {
      try {
        const token = localStorage.getItem('access_token')
        const headers = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        
        const response = await fetch(`${API_BASE}/permissions/upgrade-requests`, {
          headers
        })
        
        if (response.ok) {
          const data = await response.json()
          // 只显示当前用户的申请
          const currentUsername = props.currentUser.username || props.currentUser.name
          userUpgradeRequests.value = data.requests.filter(
            req => req.username === currentUsername
          ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) // 按时间倒序
        }
      } catch (error) {
        // 加载失败
      }
    }
    
    // 处理升级申请（仅管理员）
    const processRequest = async (requestId, status) => {
      if (!isCurrentUserAdmin.value) return
      
      try {
        const token = localStorage.getItem('access_token')
        const headers = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        
        const response = await fetch(`${API_BASE}/permissions/upgrade-requests/${requestId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            status: status,
            processed_by: props.currentUser.username
          })
        })
        
        // Check if response is ok before trying to parse JSON
        if (response.ok) {
          const result = await response.json()
          // 更新本地列表
          if (status === 'approved') {
            upgradeRequestResult.value = `申请已批准: ${result.message}`
          } else {
            upgradeRequestResult.value = `申请已拒绝: ${result.message}`
          }
          // 重新加载请求列表
          await loadUpgradeRequests()
        } else {
          // 先克隆响应以便可以多次读取
          const responseClone = response.clone()
          let errorMessage = '未知错误'
          
          // 首先尝试作为JSON解析
          try {
            const errorResult = await response.json()
            errorMessage = errorResult.detail || errorResult.message || '未知错误'
          } catch {
            // 如果JSON解析失败，使用克隆的响应读取文本
            try {
              const textContent = await responseClone.text()
              // 提取HTML中的错误消息或使用通用消息
              if (textContent.includes('Internal Server Error')) {
                errorMessage = '服务器内部错误'
              } else if (textContent.length > 100) {
                errorMessage = '请求失败，请检查服务器状态'
              } else {
                errorMessage = textContent || '未知错误'
              }
            } catch {
              errorMessage = `HTTP ${response.status}: ${response.statusText}`
            }
          }
          upgradeRequestResult.value = `处理失败: ${errorMessage}`
        }
      } catch (error) {
        upgradeRequestResult.value = `处理失败: ${error.message}`
      }
    }
    
    onMounted(async () => {
      // Wait a bit to ensure props are available
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // 加载服务级别信息
      await loadServiceLevels()
      
      // 如果 currentUser 存在且有 username，则立即检查
      if (props.currentUser && props.currentUser.username) {
        checkIfAdmin()
        // Only load user upgrade requests if the user is not an admin
        if (!isCurrentUserAdmin.value) {
          await loadUserUpgradeRequests()
        }
        // Load admin upgrade requests if the user is an admin
        if (isCurrentUserAdmin.value) {
          await loadUpgradeRequests()
        }
      }
    })
    
    // 监听 currentUser 的变化
    watch(() => props.currentUser, (newUser, oldUser) => {
      // 只在 newUser 存在且有 username 时才处理
      if (newUser && newUser.username) {
        checkIfAdmin()
        // 重新加载数据
        if (isCurrentUserAdmin.value) {
          loadUpgradeRequests()
        } else {
          loadUserUpgradeRequests()
        }
      }
    }, { deep: true })
    
    return {
      targetServiceLevel,
      upgradeReason,
      upgradeRequestResult,
      upgradeRequestSuccess,
      upgradeRequests,
      userUpgradeRequests,
      isCurrentUserAdmin,
      serviceLevels,
      submitUpgradeRequest,
      loadUpgradeRequests,
      loadUserUpgradeRequests,
      processRequest,
      getServiceLevelName,
      getStatusText,
      formatDate,
      getFeatureName,
      formatFeatureValue,
      isFeatureUpgraded,
      onTargetLevelChange
    }
  }
}
</script>

<style scoped>
.upgrade-request {
  margin-top: 20px;
}

/* 当前级别信息卡片 */
.current-level-info,
.target-level-info,
.upgrade-selection {
  margin-bottom: 30px;
}

.current-level-info h4,
.target-level-info h4,
.upgrade-selection h4 {
  margin-bottom: 15px;
  color: #333;
  font-size: 18px;
}

.level-card {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  background: #f9f9f9;
}

.level-card.current {
  border-color: #17a2b8;
  background: linear-gradient(135deg, #e0f7fa 0%, #f9f9f9 100%);
}

.level-card.target {
  border-color: #28a745;
  background: linear-gradient(135deg, #e8f5e9 0%, #f9f9f9 100%);
}

.level-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 2px solid rgba(0,0,0,0.1);
}

.level-name {
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.level-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.level-badge.current {
  background: #17a2b8;
  color: white;
}

.level-badge.target {
  background: #28a745;
  color: white;
}

.level-features {
  margin-top: 15px;
}

.level-desc {
  color: #666;
  margin-bottom: 15px;
  font-size: 14px;
}

.level-features ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.level-features li {
  padding: 8px 12px;
  margin-bottom: 6px;
  background: white;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #e0e0e0;
}

.level-features li.feature-upgraded {
  background: #fff8e1;
  border-color: #ffc107;
}

.feature-name {
  font-weight: 500;
  color: #555;
  min-width: 120px;
}

.feature-value {
  color: #333;
  font-weight: 600;
}

.upgrade-indicator {
  color: #ff9800;
  font-size: 12px;
  font-weight: 600;
  margin-left: 10px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 15px;
}

.textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
  resize: vertical;
}

.result {
  padding: 10px;
  border-radius: 4px;
  margin-top: 10px;
}

.result.success {
  background-color: #d4edda;
  border: 1px solid #c3e6cb;
  color: #155724;
}

.result.error {
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
}

.btn-success {
  background-color: #28a745;
  color: white;
  margin-right: 5px;
}

.btn-success:hover {
  background-color: #218838;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover {
  background-color: #c82333;
}

.status-pending {
  color: #856404;
  background-color: #fff3cd;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
}

.status-approved {
  color: #155724;
  background-color: #d4edda;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
}

.status-rejected {
  color: #721c24;
  background-color: #f8d7da;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
}
</style>