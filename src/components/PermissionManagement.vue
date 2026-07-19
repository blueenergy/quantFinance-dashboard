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
import request from '../utils/request'
import UpgradeRequest from './UpgradeRequest.vue'
import EntitlementsMatrix from './EntitlementsMatrix.vue'

function extractErrorMessage(err) {
  const data = err.response?.data
  if (typeof data === 'string') {
    if (data.includes('Internal Server Error')) return '服务器内部错误'
    if (data.length > 100) return '请求失败，请检查服务器状态'
    return data || '未知错误'
  }
  if (data && typeof data === 'object') {
    return data.detail || data.message || '未知错误'
  }
  return err.message || '未知错误'
}

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
        const data = await request({
          method: 'get',
          url: '/permissions/strategies',
        })
        strategies.value = data.strategies || []
        if (strategies.value.length > 0) {
          selectedStrategy.value = strategies.value[0].key
        }
      } catch (error) {
        console.error('Failed to load strategies:', error.response?.status || error)
      }
    }
    
    // 获取服务级别定义
    const loadServiceLevels = async () => {
      try {
        const data = await request({
          method: 'get',
          url: '/permissions/service-levels',
        })
        serviceLevels.value = data.service_levels || {}
      } catch (error) {
        console.error('Failed to load service levels:', error.response?.status || error)
      }
    }
    
    // 更新用户权限
    const updateUserPermission = async () => {
      if (!username.value) {
        userPermissionResult.value = '请输入用户名'
        return
      }
      
      try {
        await request({
          method: 'put',
          url: `/permissions/user/${username.value}`,
          data: { service_level: selectedUserLevel.value },
        })
        userPermissionResult.value = `用户 ${username.value} 权限已更新为 ${selectedUserLevel.value}`
      } catch (error) {
        userPermissionResult.value = `更新失败: ${extractErrorMessage(error)}`
      }
    }
    
    // 更新策略权限
    const updateStrategyPermission = async () => {
      if (!selectedStrategy.value) {
        strategyPermissionResult.value = '请选择策略'
        return
      }
      
      try {
        await request({
          method: 'put',
          url: `/permissions/strategy/${selectedStrategy.value}`,
          data: { min_service_level: selectedStrategyLevel.value },
        })
        strategyPermissionResult.value = `策略 ${selectedStrategy.value} 权限已更新为 ${selectedStrategyLevel.value}`
        await loadStrategies()
      } catch (error) {
        strategyPermissionResult.value = `更新失败: ${extractErrorMessage(error)}`
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