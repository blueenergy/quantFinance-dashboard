<template>
  <div class="admin-dashboard">
    <!-- 管理员导航 -->
    <div class="admin-nav">
      <h2>🛠️ 管理员控制台</h2>
      <div class="nav-buttons">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          @click="activeTab = tab.id"
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

      <div class="users-table" v-if="users.length > 0">
        <table>
          <thead>
            <tr>
              <th>用户名</th>
              <th>邮箱</th>
              <th>姓名</th>
              <th>状态</th>
              <th>权限</th>
              <th>注册时间</th>
              <th>最后登录</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>{{ user.username }}</td>
              <td>{{ user.email }}</td>
              <td>{{ user.full_name || '-' }}</td>
              <td>
                <span :class="['status', user.is_active ? 'active' : 'inactive']">
                  {{ user.is_active ? '激活' : '禁用' }}
                </span>
              </td>
              <td>
                <span :class="['role', user.is_admin ? 'admin' : 'user']">
                  {{ user.is_admin ? '管理员' : '普通用户' }}
                </span>
              </td>
              <td>{{ formatDate(user.created_at) }}</td>
              <td>{{ formatDate(user.last_login) || '从未' }}</td>
              <td>
                <button 
                  @click="toggleUserStatus(user)"
                  :class="['action-btn', user.is_active ? 'disable' : 'enable']"
                  :disabled="user.username === currentUser?.username"
                >
                  {{ user.is_active ? '禁用' : '激活' }}
                </button>
                <button @click="viewUserDetail(user)" class="action-btn view">
                  详情
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页 -->
      <div class="pagination" v-if="usersPagination">
        <button 
          @click="loadUsers(usersPagination.page - 1)"
          :disabled="usersPagination.page <= 1"
          class="page-btn"
        >
          上一页
        </button>
        <span class="page-info">
          第 {{ usersPagination.page }} 页，共 {{ usersPagination.total_pages }} 页
        </span>
        <button 
          @click="loadUsers(usersPagination.page + 1)"
          :disabled="usersPagination.page >= usersPagination.total_pages"
          class="page-btn"
        >
          下一页
        </button>
      </div>
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

      <div class="logs-table" v-if="loginLogs.length > 0">
        <table>
          <thead>
            <tr>
              <th>用户名</th>
              <th>IP地址</th>
              <th>浏览器</th>
              <th>登录时间</th>
              <th>状态</th>
              <th>失败原因</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in loginLogs" :key="log._id">
              <td>{{ log.username }}</td>
              <td>{{ log.ip_address }}</td>
              <td class="user-agent">{{ formatUserAgent(log.user_agent) }}</td>
              <td>{{ formatDate(log.login_time) }}</td>
              <td>
                <span :class="['status', log.success ? 'success' : 'failed']">
                  {{ log.success ? '成功' : '失败' }}
                </span>
              </td>
              <td>{{ log.failure_reason || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页 -->
      <div class="pagination" v-if="logsPagination">
        <button 
          @click="loadLoginLogs(logsPagination.page - 1)"
          :disabled="logsPagination.page <= 1"
          class="page-btn"
        >
          上一页
        </button>
        <span class="page-info">
          第 {{ logsPagination.page }} 页，共 {{ logsPagination.total_pages }} 页
        </span>
        <button 
          @click="loadLoginLogs(logsPagination.page + 1)"
          :disabled="logsPagination.page >= logsPagination.total_pages"
          class="page-btn"
        >
          下一页
        </button>
      </div>
    </div>

    <!-- 管理员操作日志 -->
    <div v-if="activeTab === 'admin-logs'" class="admin-logs-section">
      <div class="section-header">
        <h3>⚙️ 管理员操作日志</h3>
      </div>

      <div class="logs-table" v-if="adminLogs.length > 0">
        <table>
          <thead>
            <tr>
              <th>管理员</th>
              <th>操作</th>
              <th>目标用户</th>
              <th>详情</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in adminLogs" :key="log._id">
              <td>{{ log.admin_username }}</td>
              <td>{{ log.action }}</td>
              <td>{{ log.target_username || '-' }}</td>
              <td class="details">{{ log.details }}</td>
              <td>{{ formatDate(log.timestamp) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 用户详情模态框 -->
    <div v-if="selectedUser" class="modal-overlay" @click="closeUserDetail">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>👤 用户详情</h3>
          <button @click="closeUserDetail" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div class="user-info">
            <p><strong>用户名:</strong> {{ selectedUser.username }}</p>
            <p><strong>邮箱:</strong> {{ selectedUser.email }}</p>
            <p><strong>姓名:</strong> {{ selectedUser.full_name || '未设置' }}</p>
            <p><strong>状态:</strong> {{ selectedUser.is_active ? '激活' : '禁用' }}</p>
            <p><strong>权限:</strong> {{ selectedUser.is_admin ? '管理员' : '普通用户' }}</p>
            <p><strong>注册时间:</strong> {{ formatDate(selectedUser.created_at) }}</p>
            <p><strong>最后登录:</strong> {{ formatDate(selectedUser.last_login) || '从未' }}</p>
          </div>
          
          <div v-if="selectedUserStats" class="user-stats">
            <h4>📊 用户统计</h4>
            <p><strong>自选股数量:</strong> {{ selectedUserStats.watchlist_count }}</p>
            
            <h4>🔐 最近登录记录</h4>
            <div class="recent-logins">
              <div v-for="login in selectedUserStats.recent_logins" :key="login._id" class="login-record">
                <span class="login-time">{{ formatDate(login.login_time) }}</span>
                <span class="login-ip">{{ login.ip_address }}</span>
                <span :class="['login-status', login.success ? 'success' : 'failed']">
                  {{ login.success ? '成功' : '失败' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 加载提示 -->
    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'AdminDashboard',
  props: {
    currentUser: Object
  },
  data() {
    return {
      activeTab: 'overview',
      loading: false,
      
      // 导航标签
      tabs: [
        { id: 'overview', name: '概览', icon: '📊' },
        { id: 'users', name: '用户管理', icon: '👥' },
        { id: 'logs', name: '登录日志', icon: '📋' },
        { id: 'admin-logs', name: '管理员日志', icon: '⚙️' }
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
      adminLogsPagination: null
    }
  },
  computed: {
    maxLoginCount() {
      if (!this.statistics?.trends?.daily_logins) return 1
      return Math.max(...this.statistics.trends.daily_logins.map(d => d.count)) || 1
    }
  },
  async mounted() {
    await this.loadStatistics()
    await this.loadUsers()
  },
  methods: {
    // 加载统计数据
    async loadStatistics() {
      try {
        this.loading = true
        const response = await axios.get('/api/admin/statistics')
        if (response.data.success) {
          this.statistics = response.data.data
        }
      } catch (error) {
        console.error('加载统计数据失败:', error)
        alert('加载统计数据失败')
      } finally {
        this.loading = false
      }
    },
    
    // 加载用户列表
    async loadUsers(page = 1) {
      try {
        this.loading = true
        const params = { page, page_size: 20 }
        if (this.userSearch) {
          params.search = this.userSearch
        }
        
        const response = await axios.get('/api/admin/users', { params })
        if (response.data.success) {
          this.users = response.data.data.users
          this.usersPagination = response.data.data.pagination
        }
      } catch (error) {
        console.error('加载用户列表失败:', error)
        alert('加载用户列表失败')
      } finally {
        this.loading = false
      }
    },
    
    // 搜索用户
    searchUsers() {
      this.loadUsers(1)
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
        const params = { 
          page, 
          page_size: 50,
          success_only: this.showSuccessOnly
        }
        
        const response = await axios.get('/api/admin/login-logs', { params })
        if (response.data.success) {
          this.loginLogs = response.data.data.logs
          this.logsPagination = response.data.data.pagination
        }
      } catch (error) {
        console.error('加载登录日志失败:', error)
        alert('加载登录日志失败')
      } finally {
        this.loading = false
      }
    },
    
    // 加载管理员日志
    async loadAdminLogs(page = 1) {
      try {
        this.loading = true
        const response = await axios.get('/api/admin/actions', {
          params: { page, page_size: 50 }
        })
        if (response.data.success) {
          this.adminLogs = response.data.data.actions
          this.adminLogsPagination = response.data.data.pagination
        }
      } catch (error) {
        console.error('加载管理员日志失败:', error)
        alert('加载管理员日志失败')
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

/* 状态标签 - 蓝白指示器 */
.status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border: 1px solid;
}

.status.active, .status.success {
  background: #dcfce7;
  color: #166534;
  border-color: #16a34a;
}

.status.inactive, .status.failed {
  background: #fef2f2;
  color: #991b1b;
  border-color: #dc2626;
}

/* 角色标签 */
.role {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border: 1px solid;
}

.role.admin {
  background: #fef3c7;
  color: #92400e;
  border-color: #f59e0b;
}

.role.user {
  background: #dbeafe;
  color: #1e40af;
  border-color: #3b82f6;
}

/* 操作按钮 - 蓝白功能按钮 */
.action-btn {
  padding: 6px 12px;
  border: 1px solid;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  margin-right: 4px;
  transition: all 0.15s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: #ffffff;
}

.action-btn.enable {
  color: #16a34a;
  border-color: #16a34a;
}

.action-btn.disable {
  color: #dc2626;
  border-color: #dc2626;
}

.action-btn.view {
  color: #3b82f6;
  border-color: #3b82f6;
}

.action-btn:hover:not(:disabled) {
  background: #3b82f6;
  color: #ffffff;
  border-color: #3b82f6;
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 分页样式 - 蓝白导航 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin: 40px 0;
}

.page-btn {
  padding: 8px 16px;
  background: #ffffff;
  color: #64748b;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-weight: 500;
  font-size: 14px;
  min-width: 48px;
  text-align: center;
}

.page-btn:hover:not(:disabled) {
  background: #f1f5f9;
  color: #475569;
  border-color: #cbd5e1;
}

.page-btn.active {
  background: #3b82f6;
  color: #ffffff;
  border-color: #3b82f6;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
  margin: 0 20px;
  font-variant-numeric: tabular-nums;
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

/* 状态标签 - 极简指示器 */
.status {
  padding: 4px 8px;
  border-radius: 0;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border: 1px solid;
}

.status.active, .status.success {
  background: #ffffff;
  color: #2e7d32;
  border-color: #2e7d32;
}

.status.inactive, .status.failed {
  background: #ffffff;
  color: #d32f2f;
  border-color: #d32f2f;
}

/* 角色标签 */
.role {
  padding: 4px 8px;
  border-radius: 0;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border: 1px solid;
}

.role.admin {
  background: #ffffff;
  color: #f57c00;
  border-color: #f57c00;
}

.role.user {
  background: #ffffff;
  color: #1976d2;
  border-color: #1976d2;
}

/* 操作按钮 - 极简功能按钮 */
.action-btn {
  padding: 6px 12px;
  border: 1px solid;
  border-radius: 0;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  margin-right: 4px;
  transition: all 0.15s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: #ffffff;
}

.action-btn.enable {
  color: #2e7d32;
  border-color: #2e7d32;
}

.action-btn.disable {
  color: #d32f2f;
  border-color: #d32f2f;
}

.action-btn.view {
  color: #1976d2;
  border-color: #1976d2;
}

.action-btn:hover:not(:disabled) {
  background: #000000;
  color: #ffffff;
  border-color: #000000;
}

.action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* 分页样式 - 极简导航 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1px;
  margin: 40px 0;
}

.page-btn {
  padding: 8px 16px;
  background: #ffffff;
  color: #666666;
  border: 1px solid #e0e0e0;
  border-radius: 0;
  cursor: pointer;
  transition: all 0.15s ease;
  font-weight: 400;
  font-size: 14px;
  min-width: 48px;
  text-align: center;
}

.page-btn:hover:not(:disabled) {
  background: #f0f0f0;
  color: #333333;
}

.page-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-info {
  color: #888888;
  font-size: 14px;
  font-weight: 400;
  margin: 0 20px;
  font-variant-numeric: tabular-nums;
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

/* 分页样式 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin: 20px 0;
}

.page-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #8a2be2 0%, #9a4cf2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.page-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #9a2bf2 0%, #aa5cf3 100%);
  transform: translateY(-2px);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  color: #cccccc;
  font-size: 0.9em;
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
