<template>
  <div class="notification-center">
    <!-- Notification Bell Icon -->
    <div class="notification-bell" @click="togglePanel">
      <span class="bell-icon">🔔</span>
      <span v-if="unreadCount > 0" class="badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
    </div>

    <!-- Notification Panel -->
    <div v-if="showPanel" class="notification-panel">
      <div class="panel-header">
        <h4>📬 通知中心</h4>
        <div class="header-actions">
          <button 
            v-if="unreadCount > 0" 
            @click="markAllRead" 
            class="mark-all-btn"
            title="全部标记已读"
          >
            ✓ 全部已读
          </button>
          <button @click="showSettings = true" class="settings-btn" title="通知设置">⚙️</button>
          <button @click="togglePanel" class="close-btn">×</button>
        </div>
      </div>

      <div class="panel-tabs">
        <button 
          :class="['tab', { active: activeTab === 'all' }]"
          @click="activeTab = 'all'; loadNotifications()"
        >
          全部 ({{ notifications.length }})
        </button>
        <button 
          :class="['tab', { active: activeTab === 'unread' }]"
          @click="activeTab = 'unread'; loadNotifications()"
        >
          未读 ({{ unreadCount }})
        </button>
      </div>

      <div class="notifications-list">
        <div v-if="loading" class="loading">加载中...</div>
        
        <div v-else-if="notifications.length === 0" class="empty-state">
          <p>{{ activeTab === 'unread' ? '没有未读通知' : '暂无通知' }}</p>
        </div>

        <div 
          v-else
          v-for="notification in notifications" 
          :key="notification._id"
          :class="['notification-item', { unread: !notification.is_read }]"
          @click="handleNotificationClick(notification)"
        >
          <div class="notification-icon">{{ getNotificationIcon(notification.type) }}</div>
          <div class="notification-content">
            <div class="notification-title">{{ notification.title }}</div>
            <div class="notification-message">{{ notification.message }}</div>
            <div class="notification-time">{{ formatTime(notification.created_at) }}</div>
          </div>
          <button 
            @click.stop="deleteNotification(notification._id)"
            class="delete-btn"
            title="删除"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>

    <!-- Settings Modal -->
    <div v-if="showSettings" class="modal-overlay" @click="showSettings = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>⚙️ 通知设置</h3>
          <button @click="showSettings = false" class="close-btn">×</button>
        </div>

        <div class="modal-body">
          <div class="setting-section">
            <h4>Worker 超时警告</h4>
            <div class="setting-row">
              <label>
                <input 
                  type="checkbox" 
                  v-model="settings.worker_timeout_enabled"
                  @change="saveSettings"
                >
                启用超时警告
              </label>
            </div>
            <div class="setting-row" v-if="settings.worker_timeout_enabled">
              <label>
                超时阈值:
                <input 
                  type="number" 
                  v-model.number="settings.worker_timeout_threshold_minutes"
                  @change="saveSettings"
                  min="1"
                  max="30"
                  class="input-number"
                >
                分钟
              </label>
            </div>
          </div>

          <div class="setting-section">
            <h4>信号通知</h4>
            <div class="setting-row">
              <label>
                <input 
                  type="checkbox" 
                  v-model="settings.signal_notification_enabled"
                  @change="saveSettings"
                >
                启用信号生成通知
              </label>
            </div>
          </div>

          <div class="setting-section">
            <h4>日报推送</h4>
            <div class="setting-row">
              <label>
                <input 
                  type="checkbox" 
                  v-model="settings.daily_report_enabled"
                  @change="saveSettings"
                >
                启用每日工作报告
              </label>
            </div>
            <div class="setting-row" v-if="settings.daily_report_enabled">
              <label>
                发送时间:
                <input 
                  type="time" 
                  v-model="settings.daily_report_time"
                  @change="saveSettings"
                  class="input-time"
                >
              </label>
            </div>
          </div>

          <div class="setting-section">
            <h4>邮件通知</h4>
            <div class="setting-row">
              <label>
                <input 
                  type="checkbox" 
                  v-model="settings.email_notifications_enabled"
                  @change="saveSettings"
                >
                启用邮件通知
              </label>
            </div>
            <div class="setting-row" v-if="settings.email_notifications_enabled">
              <label>
                邮箱: {{ settings.email || '未设置' }}
              </label>
            </div>
            <div class="setting-row" v-if="settings.email_notifications_enabled">
              <button @click="sendTestEmail" class="test-email-btn" :disabled="testEmailSending">
                {{ testEmailSending ? '发送中...' : '📧 发送测试邮件' }}
              </button>
              <span v-if="testEmailResult" class="test-result">{{ testEmailResult }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
import axios from 'axios'

export default {
  name: 'NotificationCenter',
  setup() {
    const showPanel = ref(false)
    const showSettings = ref(false)
    const activeTab = ref('all')
    const loading = ref(false)
    const notifications = ref([])
    const unreadCount = ref(0)
    const settings = ref({
      worker_timeout_enabled: true,
      worker_timeout_threshold_minutes: 3,
      signal_notification_enabled: true,
      daily_report_enabled: true,
      daily_report_time: '17:00',
      email_notifications_enabled: false,
      email: ''
    })
    const testEmailSending = ref(false)
    const testEmailResult = ref('')

    let pollInterval = null

    const loadNotifications = async () => {
      loading.value = true
      try {
        const unreadOnly = activeTab.value === 'unread'
        const response = await axios.get('/api/notifications', {
          params: { unread_only: unreadOnly, limit: 50 }
        })
        
        if (response.data.success) {
          notifications.value = response.data.data.notifications
          unreadCount.value = response.data.data.unread_count
        }
      } catch (error) {
        console.error('Failed to load notifications:', error)
      } finally {
        loading.value = false
      }
    }

    const loadSettings = async () => {
      try {
        const response = await axios.get('/api/notifications/settings')
        if (response.data.success) {
          settings.value = { ...settings.value, ...response.data.data }
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      }
    }

    const saveSettings = async () => {
      try {
        await axios.put('/api/notifications/settings', settings.value)
      } catch (error) {
        console.error('Failed to save settings:', error)
      }
    }

    const togglePanel = () => {
      showPanel.value = !showPanel.value
      if (showPanel.value) {
        loadNotifications()
        // Start polling when the panel is opened
        if (!pollInterval) {
          pollInterval = setInterval(() => {
            loadNotifications()
          }, 60000) // Set interval to 1 minute
        }
      } else {
        // Stop polling when the panel is closed
        if (pollInterval) {
          clearInterval(pollInterval)
          pollInterval = null
        }
      }
    }

    const handleNotificationClick = async (notification) => {
      if (!notification.is_read) {
        try {
          await axios.post(`/api/notifications/${notification._id}/read`)
          notification.is_read = true
          unreadCount.value = Math.max(0, unreadCount.value - 1)
        } catch (error) {
          console.error('Failed to mark as read:', error)
        }
      }

      // Handle notification action based on type
      if (notification.type === 'worker_timeout' && notification.data?.symbol) {
        // Navigate to worker monitor
        // emit('navigate-to-worker-monitor')
      } else if (notification.type === 'signal_generated' && notification.data?.order_id) {
        // Navigate to trade executions
        // emit('navigate-to-trade-executions')
      } else if (notification.type === 'user_registration') {
        // 新用户注册通知，显示提示信息
        alert(`新用户注册待审批

用户名: ${notification.data?.username || 'N/A'}
邮箱: ${notification.data?.email || 'N/A'}

请前往管理员控制台 > 用户管理 进行审批。`)
        showPanel.value = false  // 关闭通知面板
      }
    }

    const markAllRead = async () => {
      try {
        await axios.post('/api/notifications/read-all')
        notifications.value.forEach(n => n.is_read = true)
        unreadCount.value = 0
      } catch (error) {
        console.error('Failed to mark all as read:', error)
      }
    }

    const deleteNotification = async (id) => {
      try {
        await axios.delete(`/api/notifications/${id}`)
        notifications.value = notifications.value.filter(n => n._id !== id)
      } catch (error) {
        console.error('Failed to delete notification:', error)
      }
    }

    const sendTestEmail = async () => {
      testEmailSending.value = true
      testEmailResult.value = ''
      
      try {
        const response = await axios.post('/api/notifications/test-email')
        if (response.data.success) {
          testEmailResult.value = '✅ 测试邮件已发送'
        }
      } catch (error) {
        testEmailResult.value = '❌ 发送失败: ' + (error.response?.data?.detail || error.message)
      } finally {
        testEmailSending.value = false
        setTimeout(() => {
          testEmailResult.value = ''
        }, 5000)
      }
    }

    const getNotificationIcon = (type) => {
      const icons = {
        worker_timeout: '⚠️',
        signal_generated: '⚡',
        daily_report: '📊',
        system_alert: '🔔',
        user_registration: '👤'  // 新用户注册通知图标
      }
      return icons[type] || '📝'
    }

    const formatTime = (timestamp) => {
      if (!timestamp) return ''
      
      // 处理ISO格式字符串或Unix时间戳
      let date
      if (typeof timestamp === 'string') {
        date = new Date(timestamp)  // ISO字符串
      } else {
        date = new Date(timestamp * 1000)  // Unix时间戳
      }
      
      const now = new Date()
      const diff = Math.floor((now - date) / 1000)

      if (diff < 60) return '刚刚'
      if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
      if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
      if (diff < 604800) return `${Math.floor(diff / 86400)}天前`
      
      return date.toLocaleDateString('zh-CN')
    }

    onMounted(() => {
      loadSettings()
      // Initial load of notifications without starting polling
      loadNotifications()
    })

    onUnmounted(() => {
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    })

    return {
      showPanel,
      showSettings,
      activeTab,
      loading,
      notifications,
      unreadCount,
      settings,
      testEmailSending,
      testEmailResult,
      loadNotifications,
      saveSettings,
      togglePanel,
      handleNotificationClick,
      markAllRead,
      deleteNotification,
      sendTestEmail,
      getNotificationIcon,
      formatTime
    }
  }
}
</script>

<style scoped>
.notification-center {
  position: relative;
}

.notification-bell {
  position: relative;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: background 0.2s;
}

.notification-bell:hover {
  background: rgba(255, 255, 255, 0.1);
}

.bell-icon {
  font-size: 20px;
}

.badge {
  position: absolute;
  top: 2px;
  right: 2px;
  background: #e74c3c;
  color: white;
  font-size: 10px;
  font-weight: bold;
  padding: 2px 5px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.notification-panel {
  position: absolute;
  top: 50px;
  right: 0;
  width: 400px;
  max-height: 600px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.panel-header h4 {
  margin: 0;
  font-size: 16px;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.mark-all-btn,
.settings-btn {
  padding: 4px 8px;
  background: #f0f0f0;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.mark-all-btn:hover,
.settings-btn:hover {
  background: #e0e0e0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 30px;
  height: 30px;
  line-height: 1;
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid #e0e0e0;
}

.tab {
  flex: 1;
  padding: 12px;
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  color: #666;
  border-bottom: 2px solid transparent;
}

.tab.active {
  color: #667eea;
  border-bottom-color: #667eea;
  font-weight: 600;
}

.notifications-list {
  flex: 1;
  overflow-y: auto;
  max-height: 450px;
}

.loading,
.empty-state {
  padding: 40px 20px;
  text-align: center;
  color: #999;
}

.notification-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background 0.2s;
}

.notification-item:hover {
  background: #f8f9fa;
}

.notification-item.unread {
  background: #e3f2fd;
}

.notification-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-weight: 600;
  font-size: 14px;
  color: #333;
  margin-bottom: 4px;
}

.notification-message {
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
}

.notification-time {
  font-size: 11px;
  color: #999;
}

.delete-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  opacity: 0.5;
  padding: 0;
}

.delete-btn:hover {
  opacity: 1;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
}

.modal-body {
  padding: 20px;
}

.setting-section {
  margin-bottom: 24px;
}

.setting-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #333;
}

.setting-row {
  margin-bottom: 12px;
}

.setting-row label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #666;
}

.input-number,
.input-time {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  width: 80px;
}

.test-email-btn {
  padding: 8px 16px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.test-email-btn:hover:not(:disabled) {
  background: #2980b9;
}

.test-email-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.test-result {
  margin-left: 8px;
  font-size: 12px;
}
</style>
