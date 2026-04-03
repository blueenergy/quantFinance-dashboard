<template>
  <div class="permission-management">
    <h2>权限管理</h2>

    <!-- 权益矩阵（仅管理员；先行配置，运行时后续接入） -->
    <div class="section matrix-wrap">
      <EntitlementsMatrix />
    </div>
    
    <!-- 用户权限管理 -->
    <div class="section">
      <h3>用户权限管理</h3>
      <div class="controls">
        <input 
          v-model="username" 
          placeholder="输入用户名" 
          class="input"
        />
        <select v-model="selectedUserLevel" class="select">
          <option value="free">免费版</option>
          <option value="basic">基础版</option>
          <option value="vip">VIP版</option>
          <option value="premium">专业版</option>
        </select>
        <button @click="updateUserPermission" class="btn btn-primary">更新用户权限</button>
      </div>
      <div v-if="userPermissionResult" class="result">
        {{ userPermissionResult }}
      </div>
    </div>

    <!-- 策略权限管理 -->
    <div class="section">
      <h3>策略权限管理</h3>
      <div class="controls">
        <select v-model="selectedStrategy" class="select">
          <option v-for="strategy in strategies" :key="strategy.key" :value="strategy.key">
            {{ strategy.name }} ({{ strategy.key }}) - {{ strategy.min_service_level }}
          </option>
        </select>
        <select v-model="selectedStrategyLevel" class="select">
          <option value="free">免费版</option>
          <option value="basic">基础版</option>
          <option value="vip">VIP版</option>
          <option value="premium">专业版</option>
        </select>
        <button @click="updateStrategyPermission" class="btn btn-primary">更新策略权限</button>
      </div>
      <div v-if="strategyPermissionResult" class="result">
        {{ strategyPermissionResult }}
      </div>
    </div>
    
    <!-- 服务级别定义 -->
    <div class="section">
      <h3>服务级别定义</h3>
      <div v-if="serviceLevels">
        <div v-for="(level, key) in serviceLevels" :key="key" class="service-level">
          <h4>{{ level.name }} ({{ key }})</h4>
          <p>{{ level.description }}</p>
          <ul>
            <li v-for="(value, feature) in level.features" :key="feature">
              {{ feature }}: {{ value }}
            </li>
          </ul>
        </div>
      </div>
    </div>
    
    <!-- 策略列表 -->
    <div class="section">
      <h3>策略权限列表</h3>
      <table class="table">
        <thead>
          <tr>
            <th>策略键</th>
            <th>策略名称</th>
            <th>最低服务级别</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="strategy in strategies" :key="strategy.key">
            <td>{{ strategy.key }}</td>
            <td>{{ strategy.name }}</td>
            <td>{{ getServiceLevelName(strategy.min_service_level) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- 升级申请 -->
    <div class="section">
      <upgrade-request :current-user="currentUser" />
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import UpgradeRequest from './UpgradeRequest.vue'
import EntitlementsMatrix from './EntitlementsMatrix.vue'

const API_BASE = import.meta.env.VITE_API_BASE || "/api"

export default {
  name: 'PermissionManagement',
  components: {
    UpgradeRequest,
    EntitlementsMatrix,
  },
  props: {
    currentUser: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    const username = ref('')
    const selectedUserLevel = ref('free')
    const selectedStrategy = ref('')
    const selectedStrategyLevel = ref('free')
    const strategies = ref([])
    const serviceLevels = ref({})
    const userPermissionResult = ref('')
    const strategyPermissionResult = ref('')

    // 获取所有策略权限
    const loadStrategies = async () => {
      try {
        const token = localStorage.getItem('access_token')
        const headers = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        
        const response = await fetch(`${API_BASE}/permissions/strategies`, {
          headers
        })
        
        if (response.ok) {
          const data = await response.json()
          strategies.value = data.strategies || []
          if (strategies.value.length > 0) {
            selectedStrategy.value = strategies.value[0].key
          }
        } else {
          console.error('Failed to load strategies:', response.status)
        }
      } catch (error) {
        console.error('Error loading strategies:', error)
      }
    }
    
    // 获取服务级别定义
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
          serviceLevels.value = data.service_levels || {}
        } else {
          console.error('Failed to load service levels:', response.status)
        }
      } catch (error) {
        console.error('Error loading service levels:', error)
      }
    }
    
    // 更新用户权限
    const updateUserPermission = async () => {
      if (!username.value) {
        userPermissionResult.value = '请输入用户名'
        return
      }
      
      try {
        const token = localStorage.getItem('access_token')
        const headers = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        
        const response = await fetch(`${API_BASE}/permissions/user/${username.value}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            service_level: selectedUserLevel.value
          })
        })
        
        // Check if response is ok before trying to parse JSON
        if (response.ok) {
          const result = await response.json()
          userPermissionResult.value = `用户 ${username.value} 权限已更新为 ${selectedUserLevel.value}`
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
          userPermissionResult.value = `更新失败: ${errorMessage}`
        }
      } catch (error) {
        userPermissionResult.value = `更新失败: ${error.message}`
      }
    }
    
    // 更新策略权限
    const updateStrategyPermission = async () => {
      if (!selectedStrategy.value) {
        strategyPermissionResult.value = '请选择策略'
        return
      }
      
      try {
        const token = localStorage.getItem('access_token')
        const headers = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        
        const response = await fetch(`${API_BASE}/permissions/strategy/${selectedStrategy.value}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            min_service_level: selectedStrategyLevel.value
          })
        })
        
        // Check if response is ok before trying to parse JSON
        if (response.ok) {
          const result = await response.json()
          strategyPermissionResult.value = `策略 ${selectedStrategy.value} 权限已更新为 ${selectedStrategyLevel.value}`
          // 重新加载策略列表
          await loadStrategies()
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
          strategyPermissionResult.value = `更新失败: ${errorMessage}`
        }
      } catch (error) {
        strategyPermissionResult.value = `更新失败: ${error.message}`
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
    
    onMounted(async () => {
      await loadStrategies()
      await loadServiceLevels()
    })
    
    return {
      username,
      selectedUserLevel,
      selectedStrategy,
      selectedStrategyLevel,
      strategies,
      serviceLevels,
      userPermissionResult,
      strategyPermissionResult,
      currentUser: props.currentUser,
      updateUserPermission,
      updateStrategyPermission,
      getServiceLevelName,
    }
  }
}
</script>

<style scoped>
.permission-management {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.section {
  margin-bottom: 30px;
  padding: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: #f9f9f9;
}

.section h3 {
  margin-top: 0;
  color: #333;
}

.controls {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  flex-wrap: wrap;
  align-items: center;
}

.input, .select {
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
}

.input {
  min-width: 200px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover {
  background-color: #0056b3;
}

.result {
  padding: 10px;
  background-color: #e9f7ef;
  border: 1px solid #28a745;
  border-radius: 4px;
  color: #155724;
  margin-top: 10px;
}

.result.error {
  background-color: #fdecea;
  border-color: #e74c3c;
  color: #c0392b;
}

.hint {
  font-size: 13px;
  color: #555;
  line-height: 1.5;
  margin-bottom: 16px;
}

.muted {
  color: #888;
}

.service-level {
  margin-bottom: 20px;
  padding: 15px;
  background-color: white;
  border-radius: 6px;
  border-left: 4px solid #007bff;
}

.service-level h4 {
  margin-top: 0;
  color: #007bff;
}

.service-level ul {
  margin: 10px 0;
  padding-left: 20px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  background-color: white;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.table th,
.table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.table th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #495057;
}

.table tr:hover {
  background-color: #f8f9fa;
}
</style>