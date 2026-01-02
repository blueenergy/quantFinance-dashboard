<template>
  <div class="upgrade-request">
    <h3>服务升级申请</h3>
    
    <!-- 用户申请升级表单 -->
    <div v-if="!isCurrentUserAdmin" class="section">
      <div class="controls">
        <select v-model="targetServiceLevel" class="select">
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
import { ref, onMounted } from 'vue'

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
          // Try to parse error response as JSON, fallback to text if it's not JSON
          let errorMessage = '未知错误'
          try {
            const errorResult = await response.json()
            errorMessage = errorResult.detail || errorResult.message || '未知错误'
          } catch {
            // If response is not JSON (e.g., HTML error page), get text content
            errorMessage = await response.text()
            // Extract error message from HTML if possible, or use generic message
            if (errorMessage.includes('Internal Server Error')) {
              errorMessage = '服务器内部错误'
            } else if (errorMessage.length > 100) {
              errorMessage = '请求失败，请检查服务器状态'
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
        } else {
          console.error('Failed to load upgrade requests:', response.status)
        }
      } catch (error) {
        console.error('Error loading upgrade requests:', error)
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
        } else {
          console.error('Failed to load user upgrade requests:', response.status)
        }
      } catch (error) {
        console.error('Error loading user upgrade requests:', error)
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
          // Try to parse error response as JSON, fallback to text if it's not JSON
          let errorMessage = '未知错误'
          try {
            const errorResult = await response.json()
            errorMessage = errorResult.detail || errorResult.message || '未知错误'
          } catch {
            // If response is not JSON (e.g., HTML error page), get text content
            errorMessage = await response.text()
            // Extract error message from HTML if possible, or use generic message
            if (errorMessage.includes('Internal Server Error')) {
              errorMessage = '服务器内部错误'
            } else if (errorMessage.length > 100) {
              errorMessage = '请求失败，请检查服务器状态'
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
      await new Promise(resolve => setTimeout(resolve, 0))
      checkIfAdmin()
      // Only load user upgrade requests if the user is not an admin
      if (!isCurrentUserAdmin.value) {
        await loadUserUpgradeRequests()
      }
      // Load admin upgrade requests if the user is an admin
      if (isCurrentUserAdmin.value) {
        await loadUpgradeRequests()
      }
    })
    
    return {
      targetServiceLevel,
      upgradeReason,
      upgradeRequestResult,
      upgradeRequestSuccess,
      upgradeRequests,
      userUpgradeRequests,
      isCurrentUserAdmin,
      submitUpgradeRequest,
      loadUpgradeRequests,
      loadUserUpgradeRequests,
      processRequest,
      getServiceLevelName,
      getStatusText,
      formatDate
    }
  }
}
</script>

<style scoped>
.upgrade-request {
  margin-top: 20px;
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