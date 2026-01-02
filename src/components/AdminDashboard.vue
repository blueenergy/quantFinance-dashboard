<template>
  <div class="admin-dashboard">
    <!-- 管理员导航 -->
    <div class="admin-nav">
      <h2>🛠️ 管理员控制台</h2>
      <div class="nav-buttons">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          @click="switchTab(tab.id)"
          :class="['nav-btn', { active: activeTab === tab.id }]"
        >
          {{ tab.icon }} {{ tab.name }}
        </button>
      </div>
    </div>

    <!-- 统计概览 -->
    <div v-if="activeTab === 'overview'" class="overview-section">
      <h3>系统概览</h3>
      <div class="stats-grid" v-if="statistics">
        <div class="stat-card">
          <div class="stat-content">
            <div class="stat-number">{{ statistics.users.total }}</div>
            <div class="stat-label">总用户数</div>
            <div class="stat-detail">今日新增: {{ statistics.users.today_new }}</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-content">
            <div class="stat-number">{{ statistics.users.active }}</div>
            <div class="stat-label">活跃用户</div>
            <div class="stat-detail">管理员: {{ statistics.users.admin }}</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-content">
            <div class="stat-number">{{ statistics.logins.successful }}</div>
            <div class="stat-label">成功登录</div>
            <div class="stat-detail">今日: {{ statistics.logins.today_successful }}</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-content">
            <div class="stat-number">{{ statistics.logins.failed }}</div>
            <div class="stat-label">失败登录</div>
            <div class="stat-detail">总计: {{ statistics.logins.total }}</div>
          </div>
        </div>
      </div>

      <!-- 登录趋势图 -->
      <div class="trend-chart" v-if="statistics && statistics.trends">
        <h4>📈 近7天登录趋势</h4>
        <div class="chart-container">
          <div 
            v-for="day in statistics.trends.daily_logins" 
            :key="day.date"
            class="chart-bar"
            :style="{ height: `${(day.count / maxLoginCount) * 100}%` }"
          >
            <div class="bar-label">{{ day.date.split('-')[2] }}</div>
            <div class="bar-value">{{ day.count }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 数据采集监控 -->
    <div v-if="activeTab === 'data-collection'" class="data-collection-section">
      <DataCollectionMonitor />
    </div>

    <!-- Worker 节点监控 -->
    <div v-if="activeTab === 'worker-nodes'" class="worker-nodes-section">
      <WorkerNodesMonitor />
    </div>

    <!-- Worker 组监控 -->
    <div v-if="activeTab === 'worker-groups'" class="worker-groups-section">
      <WorkerGroupsMonitor />
    </div>

    <!-- 用户管理 -->
    <div v-if="activeTab === 'users'" class="users-section">
      <div class="section-header">
        <h3>👥 用户管理</h3>
        <div class="search-bar">
          <input
            v-model="userSearch"
            @input="searchUsers"
            placeholder="搜索用户名、邮箱或姓名..."
            class="search-input"
          >
        </div>
      </div>
      <UsersTable
        :users="users"
        :current-user="currentUser"
        :format-date="formatDate"
        @toggle-status="toggleUserStatus"
        @view-detail="viewUserDetail"
      />
      <Pagination v-if="usersPagination" :page="usersPagination.page" :total-pages="usersPagination.total_pages" @change="loadUsers" />
    </div>

    <!-- 权限管理 -->
    <div v-if="activeTab === 'permissions'" class="permissions-section">
      <PermissionManagement :current-user="currentUser" />
    </div>

    <!-- 登录日志 -->
    <div v-if="activeTab === 'logs'" class="logs-section">
      <div class="section-header">
        <h3>📋 登录日志</h3>
        <div class="log-filters">
          <label>
            <input
              v-model="showSuccessOnly"
              @change="loadLoginLogs(1)"
              type="checkbox"
            >
            仅显示成功登录
          </label>
        </div>
      </div>
      <LoginLogsTable :logs="loginLogs" :format-date="formatDate" :format-user-agent="formatUserAgent" />
      <Pagination v-if="logsPagination" :page="logsPagination.page" :total-pages="logsPagination.total_pages" @change="loadLoginLogs" />
    </div>

    <!-- 管理员操作日志 -->
    <div v-if="activeTab === 'admin-logs'" class="admin-logs-section">
      <div class="section-header">
        <h3>⚙️ 管理员操作日志</h3>
      </div>
      <AdminLogsTable :logs="adminLogs" :format-date="formatDate" />
    </div>

    <!-- AI分析日志 -->
    <div v-if="activeTab === 'ai-logs'" class="ai-logs-section">
      <div class="section-header">
        <h3>🧠 AI 分析日志</h3>
      </div>
      <AIAnalysisLogsTable :logs="aiAnalysisLogs" :format-date="formatDate" @view-detail="viewAILogDetail" />
      <Pagination v-if="aiLogsPagination" :page="aiLogsPagination.page" :total-pages="aiLogsPagination.total_pages" @change="loadAIAnalysisLogs" />
    </div>

    <!-- AI用户分析记录（复用 aiAnalysisLogs 数据集） -->
    <div v-if="activeTab === 'ai-logs'" class="ai-logs-section">
      <div class="section-header">
        <h3>🤖 用户AI分析统计</h3>
      </div>
      <AIUserAnalysisTable :records="aiAnalysisLogs" :format-date="formatDate" />
    </div>

    <!-- 用户详情模态框 -->
    <UserDetailModal :user="selectedUser" :stats="selectedUserStats" :format-date="formatDate" @close="closeUserDetail" />

    <!-- 加载提示 -->
    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>
  </div>
</template>

<script>
import axios from 'axios'
import Pagination from './Pagination.vue'
import UsersTable from './UsersTable.vue'
import LoginLogsTable from './LoginLogsTable.vue'
import AdminLogsTable from './AdminLogsTable.vue'
import AIAnalysisLogsTable from './AIAnalysisLogsTable.vue'
import AIUserAnalysisTable from './AIUserAnalysisTable.vue'
import UserDetailModal from './UserDetailModal.vue'
import DataCollectionMonitor from './DataCollectionMonitor.vue'
import WorkerNodesMonitor from './WorkerNodesMonitor.vue'
import PermissionManagement from './PermissionManagement.vue'
import WorkerGroupsMonitor from './WorkerGroupsMonitor.vue'

export default {
  name: 'AdminDashboard',
  components: { 
    Pagination, 
    UsersTable, 
    LoginLogsTable, 
    AdminLogsTable, 
    AIAnalysisLogsTable, 
    AIUserAnalysisTable, 
    UserDetailModal,
    DataCollectionMonitor,
    WorkerNodesMonitor,
    PermissionManagement,
    WorkerGroupsMonitor
  },
  props: {
    currentUser: Object
  },
  data() {
    return {
      activeTab: 'overview',
      loading: false,
      searchTimer: null,
      
      // 导航标签
      tabs: [
        { id: 'overview', name: '概览', icon: '📊' },
        { id: 'data-collection', name: '数据采集', icon: '📡' },
        { id: 'worker-nodes', name: 'Worker节点', icon: '🖥️' },
        { id: 'worker-groups', name: 'Worker组', icon: '📦' },
        { id: 'users', name: '用户管理', icon: '👥' },
        { id: 'permissions', name: '权限管理', icon: '🔐' },
        { id: 'logs', name: '登录日志', icon: '📋' },
        { id: 'admin-logs', name: '管理员日志', icon: '⚙️' },
        { id: 'ai-logs', name: 'AI分析日志', icon: '🧠' }
      ],
      
      // 统计数据
      statistics: null,
      
      // 用户管理
      users: [],
      usersPagination: null,
      userSearch: '',
      selectedUser: null,
      selectedUserStats: null,
      
      // 登录日志
      loginLogs: [],
      logsPagination: null,
      showSuccessOnly: false,
      
      // 管理员日志
      adminLogs: [],
      adminLogsPagination: null,
      
      // AI分析日志
      aiAnalysisLogs: [],
      aiLogsPagination: null
    }
  },
  computed: {
    maxLoginCount() {
      if (!this.statistics?.trends?.daily_logins) return 1
      return Math.max(...this.statistics.trends.daily_logins.map(d => d.count)) || 1
    }
  },
  async mounted() {
    // 恢复上次的管理后台内部标签页
    const savedAdminTab = localStorage.getItem('adminDashboardTab')
    if (savedAdminTab && this.tabs.some(tab => tab.id === savedAdminTab)) {
      this.activeTab = savedAdminTab
      console.log('[AdminDashboard] 恢复管理后台标签页:', savedAdminTab)
    } else {
      // 如果没有保存的标签页，保存当前默认值
      localStorage.setItem('adminDashboardTab', this.activeTab)
      console.log('[AdminDashboard] 首次访问，保存默认标签页:', this.activeTab)
    }
    
    // 并行加载初始数据以降低首屏等待时间
    await Promise.all([
      this.loadStatistics(),
      this.loadUsers(),
      this.loadAIAnalysisLogs()
    ])
  },
  methods: {
    // 切换标签页
    switchTab(tabId) {
      this.activeTab = tabId
      localStorage.setItem('adminDashboardTab', tabId)
      console.log('[AdminDashboard] 切换标签页:', tabId, '已保存到localStorage')
    },
    // 通用 GET 请求助手：成功返回 data.data 部分，失败抛出错误
    async apiGet(url, params = {}) {
      const response = await axios.get(url, { params })
      if (!response.data || response.data.success !== true) {
        const msg = response.data?.message || '请求失败'
        throw new Error(msg)
      }
      return response.data.data
    },
    // 加载统计数据
    async loadStatistics() {
      try {
        this.loading = true
        const data = await this.apiGet('/api/admin/statistics')
        this.statistics = data
      } catch (error) {
        console.error('加载统计数据失败:', error)
        alert(error.message || '加载统计数据失败')
      } finally {
        this.loading = false
      }
    },
    
    // 加载用户列表
    async loadUsers(page = 1) {
      try {
        this.loading = true
        const params = { page, page_size: 20 }
        if (this.userSearch) params.search = this.userSearch.trim()
        const data = await this.apiGet('/api/admin/users', params)
        this.users = data.users
        this.usersPagination = data.pagination
      } catch (error) {
        console.error('加载用户列表失败:', error)
        alert(error.message || '加载用户列表失败')
      } finally {
        this.loading = false
      }
    },
    
    // 搜索用户
    searchUsers() {
      // 输入防抖，减少频繁请求
      if (this.searchTimer) clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => {
        this.loadUsers(1)
      }, 300)
    },
    
    // 切换用户状态
    async toggleUserStatus(user) {
      if (user.username === this.currentUser?.username) {
        alert('不能禁用自己的账户')
        return
      }
      
      const action = user.is_active ? '禁用' : '激活'
      if (!confirm(`确定要${action}用户 ${user.username} 吗？`)) {
        return
      }
      
      try {
        this.loading = true
        const response = await axios.put(`/api/admin/users/${user.id}/status`, {
          is_active: !user.is_active
        })
        
        if (response.data.success) {
          alert(response.data.message)
          await this.loadUsers(this.usersPagination?.page || 1)
          await this.loadStatistics()
        }
      } catch (error) {
        console.error('更新用户状态失败:', error)
        alert('更新用户状态失败')
      } finally {
        this.loading = false
      }
    },
    
    // 查看用户详情
    async viewUserDetail(user) {
      try {
        this.loading = true
        const response = await axios.get(`/api/admin/users/${user.id}`)
        if (response.data.success) {
          this.selectedUser = response.data.data.user
          this.selectedUserStats = response.data.data.statistics
        }
      } catch (error) {
        console.error('获取用户详情失败:', error)
        alert('获取用户详情失败')
      } finally {
        this.loading = false
      }
    },
    
    // 关闭用户详情
    closeUserDetail() {
      this.selectedUser = null
      this.selectedUserStats = null
    },
    
    // 加载登录日志
    async loadLoginLogs(page = 1) {
      try {
        this.loading = true
        const params = { page, page_size: 50, success_only: this.showSuccessOnly }
        const data = await this.apiGet('/api/admin/login-logs', params)
        this.loginLogs = data.logs
        this.logsPagination = data.pagination
      } catch (error) {
        console.error('加载登录日志失败:', error)
        alert(error.message || '加载登录日志失败')
      } finally {
        this.loading = false
      }
    },
    
    // 加载管理员日志
    async loadAdminLogs(page = 1) {
      try {
        this.loading = true
        const data = await this.apiGet('/api/admin/actions', { page, page_size: 50 })
        this.adminLogs = data.actions
        this.adminLogsPagination = data.pagination
      } catch (error) {
        console.error('加载管理员日志失败:', error)
        alert(error.message || '加载管理员日志失败')
      } finally {
        this.loading = false
      }
    },
    
    // 加载AI分析日志
    async loadAIAnalysisLogs(page = 1) {
      try {
        this.loading = true
        const data = await this.apiGet('/api/admin/analysis-logs', { page, page_size: 50 })
        this.aiAnalysisLogs = data.logs
        const pag = data.pagination
        this.aiLogsPagination = {
          page: pag.page,
          page_size: pag.page_size,
          total: pag.total,
          total_pages: Math.ceil(pag.total / pag.page_size)
        }
      } catch (error) {
        console.error('加载AI分析日志失败:', error)
        alert(error.message || '加载AI分析日志失败')
      } finally {
        this.loading = false
      }
    },
    
    // 监听标签切换
    async tabChanged() {
      if (this.activeTab === 'logs' && this.loginLogs.length === 0) {
        await this.loadLoginLogs()
      } else if (this.activeTab === 'admin-logs' && this.adminLogs.length === 0) {
        await this.loadAdminLogs()
      } else if (this.activeTab === 'ai-logs' && this.aiAnalysisLogs.length === 0) {
        await this.loadAIAnalysisLogs()
      }
    },
    
    // 格式化日期
    formatDate(dateStr) {
      if (!dateStr) return null
      return new Date(dateStr).toLocaleString('zh-CN')
    },
    
    // 格式化User Agent
    formatUserAgent(ua) {
      if (!ua) return 'Unknown'
      
      // 简化显示
      if (ua.includes('Chrome')) return 'Chrome'
      if (ua.includes('Firefox')) return 'Firefox'
      if (ua.includes('Safari')) return 'Safari'
      if (ua.includes('Edge')) return 'Edge'
      
      return ua.length > 50 ? ua.substring(0, 50) + '...' : ua
    }
  },
  watch: {
    activeTab() {
      this.tabChanged()
    }
  }
}
</script>

<style scoped>
/* 管理员蓝白色调UI样式 - 专业、清爽、现代 */
.admin-dashboard {
  min-height: 100vh;
  background: #f8fafc;
  color: #1e293b;
  font-family: 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
  padding: 20px;
  line-height: 1.6;
}

/* 导航样式 - 蓝白专业工具栏 */
.admin-nav {
  margin-bottom: 40px;
  background: #ffffff;
  padding: 32px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

.admin-nav h2 {
  margin: 0 0 24px 0;
  color: #0f172a;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.2px;
}

.nav-buttons {
  display: flex;
  gap: 1px;
  flex-wrap: wrap;
  background: #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}

.nav-btn {
  padding: 12px 20px;
  background: #f1f5f9;
  color: #64748b;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  font-weight: 500;
  font-size: 14px;
  min-width: 120px;
  text-align: center;
}

.nav-btn:hover {
  background: #e2e8f0;
  color: #475569;
}

.nav-btn.active {
  background: #3b82f6;
  color: #ffffff;
}

/* 统计概览样式 - 蓝白数据卡片 */
.overview-section {
  margin-bottom: 40px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1px;
  margin-bottom: 40px;
  background: #e2e8f0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.stat-card {
  background: #ffffff;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 120px;
  transition: background-color 0.15s ease;
}

.stat-card:hover {
  background: #f8fafc;
}

.stat-content {
  text-align: center;
}

.stat-number {
  font-size: 36px;
  font-weight: 700;
  color: #1e40af;
  margin: 0 0 8px 0;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 12px;
  color: #64748b;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 500;
}

.stat-detail {
  font-size: 11px;
  color: #94a3b8;
  margin: 4px 0 0 0;
  font-weight: 400;
}

/* 趋势图样式 - 蓝白图表设计 */
.trend-chart {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  backdrop-filter: blur(10px);
  border-radius: 15px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.trend-chart h4 {
  margin-bottom: 20px;
  color: #8a2be2;
}

.chart-container {
  display: flex;
  align-items: end;
  justify-content: space-between;
  height: 200px;
  gap: 10px;
}

.chart-bar {
  flex: 1;
  background: linear-gradient(to top, #8a2be2, #9a4cf2);
  border-radius: 5px 5px 0 0;
  position: relative;
  min-height: 20px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  transition: all 0.3s ease;
}

.chart-bar:hover {
  background: linear-gradient(to top, #9a2bf2, #aa5cf3);
  transform: scale(1.05);
}

.bar-label {
  position: absolute;
  bottom: -25px;
  font-size: 0.8em;
  color: #cccccc;
}

.bar-value {
  position: absolute;
  top: -25px;
  font-size: 0.9em;
  color: #ffffff;
  font-weight: bold;
}

/* 表格样式 */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h3 {
  color: #8a2be2;
  margin: 0;
}

.search-bar {
  flex: 1;
  max-width: 400px;
  margin-left: 20px;
}

.search-input {
  width: 100%;
  padding: 12px 15px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 25px;
  color: white;
  font-size: 14px;
}

.search-input::placeholder {
  color: #6b7280;
}

/* 数据表格样式 - 蓝白专业设计 */
.users-table, .logs-table {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 40px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

/* 权限管理样式 */
.permissions-section {
  margin-bottom: 40px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 16px 20px;
  text-align: left;
  border-bottom: 1px solid #f1f5f9;
}

th {
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 1px;
  border-bottom: 1px solid #e2e8f0;
}

td {
  color: #1e293b;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

tr:hover {
  background: #f8fafc;
}

tr:last-child td {
  border-bottom: none;
}


/* 模态框样式 - 蓝白对话框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 40px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px rgba(15, 23, 42, 0.25);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f1f5f9;
}

.modal-header h3 {
  margin: 0;
  color: #0f172a;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #64748b;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.close-btn:hover {
  color: #1e293b;
  background: #f1f5f9;
}

.modal-body {
  color: #1e293b;
  line-height: 1.6;
}

.user-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 32px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 500;
}

.info-value {
  font-size: 14px;
  color: #0f172a;
  font-weight: 500;
}

/* 搜索输入框 */
.search-section {
  margin-bottom: 32px;
}

.search-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  background: #ffffff;
  color: #1e293b;
  transition: all 0.15s ease;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-input::placeholder {
  color: #94a3b8;
}

/* 图表容器 */
.chart-section {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 30px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

.chart-section h3 {
  margin: 0 0 20px 0;
  color: #0f172a;
  font-size: 18px;
  font-weight: 600;
}

.chart-container {
  display: flex;
  align-items: end;
  justify-content: space-between;
  height: 200px;
  gap: 12px;
  padding: 0 10px;
}

.chart-bar {
  flex: 1;
  background: linear-gradient(to top, #3b82f6, #60a5fa);
  border-radius: 4px 4px 0 0;
  position: relative;
  min-height: 10px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  transition: all 0.3s ease;
  border: 1px solid #2563eb;
}

.chart-bar:hover {
  background: linear-gradient(to top, #2563eb, #3b82f6);
  transform: scaleY(1.05);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.bar-label {
  position: absolute;
  bottom: -25px;
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

.bar-value {
  position: absolute;
  top: -25px;
  font-size: 13px;
  color: #0f172a;
  font-weight: 600;
  background: #f8fafc;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .nav-buttons {
    flex-direction: column;
  }
  
  .nav-btn {
    border-radius: 6px;
    margin-bottom: 1px;
  }
  
  .user-info {
    grid-template-columns: 1fr;
  }
  
  .modal-content {
    width: 95%;
    margin: 20px;
    padding: 24px;
  }
}


/* 模态框样式 - 极简对话框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.status {
  padding: 4px 12px;
  border-radius: 15px;
  font-size: 0.85em;
  font-weight: bold;
}

.status.active, .status.success {
  background: rgba(46, 204, 113, 0.2);
  color: #2ecc71;
  border: 1px solid #2ecc71;
}

.status.inactive, .status.failed {
  background: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
  border: 1px solid #e74c3c;
}

.role {
  padding: 4px 12px;
  border-radius: 15px;
  font-size: 0.85em;
  font-weight: bold;
}

.role.admin {
  background: rgba(230, 126, 34, 0.2);
  color: #e67e22;
  border: 1px solid #e67e22;
}

.role.user {
  background: rgba(52, 152, 219, 0.2);
  color: #3498db;
  border: 1px solid #3498db;
}

.action-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85em;
  margin-right: 5px;
  transition: all 0.3s ease;
}

.action-btn.enable {
  background: #2ecc71;
  color: white;
}

.action-btn.disable {
  background: #e74c3c;
  color: white;
}

.action-btn.view {
  background: #3498db;
  color: white;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}


/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: linear-gradient(135deg, #2a2a5e 0%, #3a3a7e 100%);
  border-radius: 15px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  border: 1px solid rgba(138, 43, 226, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header h3 {
  margin: 0;
  color: #8a2be2;
}

.close-btn {
  background: none;
  border: none;
  color: #ffffff;
  font-size: 1.5em;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.modal-body {
  padding: 20px;
}

.user-info p {
  margin: 10px 0;
  color: #ffffff;
}

.user-stats {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.user-stats h4 {
  color: #8a2be2;
  margin-bottom: 15px;
}

.recent-logins {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.login-record {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

.login-time {
  color: #ffffff;
  font-size: 0.9em;
}

.login-ip {
  color: #cccccc;
  font-size: 0.85em;
}

.login-status {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.8em;
  font-weight: bold;
}

/* 过滤器样式 */
.log-filters {
  display: flex;
  gap: 20px;
  align-items: center;
}

.log-filters label {
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.log-filters input[type="checkbox"] {
  accent-color: #8a2be2;
}

/* 长文本处理 */
.user-agent, .details {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 加载样式 */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #8a2be2;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(138, 43, 226, 0.3);
  border-top: 4px solid #8a2be2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .admin-dashboard {
    padding: 10px;
  }
  
  .nav-buttons {
    flex-direction: column;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .section-header {
    flex-direction: column;
    align-items: stretch;
    gap: 15px;
  }
  
  .search-bar {
    margin-left: 0;
    max-width: none;
  }
  
  table {
    font-size: 0.85em;
  }
  
  th, td {
    padding: 10px 8px;
  }
  
  .modal-content {
    width: 95%;
    margin: 20px;
    padding: 24px;
  }
}

.modal-content {
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 0;
  padding: 40px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-header h3 {
  margin: 0;
  color: #1a1a1a;
  font-size: 18px;
  font-weight: 500;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666666;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #000000;
}

.modal-body {
  color: #2c2c2c;
  line-height: 1.6;
}

.user-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 32px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 11px;
  color: #888888;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 500;
}

.info-value {
  font-size: 14px;
  color: #1a1a1a;
  font-weight: 400;
}

/* 搜索输入框 */
.search-section {
  margin-bottom: 32px;
}

.search-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 0;
  font-size: 14px;
  background: #ffffff;
  color: #2c2c2c;
  transition: border-color 0.15s ease;
}

.search-input:focus {
  outline: none;
  border-color: #000000;
}

.search-input::placeholder {
  color: #aaaaaa;
}
</style>
