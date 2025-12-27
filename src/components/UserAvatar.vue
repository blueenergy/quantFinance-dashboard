<template>
  <div class="user-avatar-menu">
    <div class="user-info-brief" @click="toggleMenu">
      <div class="user-avatar">
        {{ userInitials }}
      </div>
      <span class="username">{{ displayUsername }}</span>
      <span class="dropdown-arrow">▼</span>
    </div>
    
    <div v-if="showMenu" class="dropdown-menu">
      <div class="menu-header">
        <div class="menu-avatar">
          {{ userInitials }}
        </div>
        <div class="menu-user-info">
          <div class="menu-username">{{ displayUsername }}</div>
          <div class="menu-email">{{ user?.email || 'N/A' }}</div>
        </div>
      </div>
      <div class="menu-divider"></div>
      <button @click="logout" class="menu-logout-btn">
        <span class="logout-icon">🚪</span> 退出登录
      </button>
    </div>
  </div>
</template>

<script>
import { computed, ref } from 'vue'

export default {
  name: 'UserAvatar',
  props: {
    user: {
      type: Object,
      required: true
    }
  },
  emits: ['logout'],
  setup(props, { emit }) {
    const showMenu = ref(false)
    
    const userInitials = computed(() => {
      if (!props.user) return 'U'
      
      // Handle case where user might have full_name property
      const displayName = props.user.full_name || props.user.username || 'User'
      if (!displayName || typeof displayName !== 'string') return 'U'
      
      return displayName.charAt(0).toUpperCase()
    })

    const displayUsername = computed(() => {
      if (!props.user) return 'User'
      return props.user.username || props.user.full_name || 'User'
    })

    const toggleMenu = () => {
      showMenu.value = !showMenu.value
    }

    const logout = () => {
      showMenu.value = false
      emit('logout')
    }

    // 点击外部关闭菜单
    const handleClickOutside = (event) => {
      const menu = document.querySelector('.user-avatar-menu')
      if (menu && !menu.contains(event.target)) {
        showMenu.value = false
      }
    }

    // 监听点击事件
    document.addEventListener('click', handleClickOutside)

    return {
      showMenu,
      userInitials,
      displayUsername,
      toggleMenu,
      logout
    }
  }
}
</script>

<style scoped>
.user-avatar-menu {
  position: relative;
  display: inline-block;
}

.user-info-brief {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: background-color 0.3s;
  user-select: none;
}

.user-info-brief:hover {
  background: rgba(255, 255, 255, 0.2);
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 14px;
}

.username {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.dropdown-arrow {
  font-size: 10px;
  color: #666;
}

.dropdown-menu {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 8px;
  width: 240px;
  padding: 12px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

.menu-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
}

.menu-avatar {
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

.menu-user-info {
  flex: 1;
}

.menu-username {
  font-weight: 600;
  color: #333;
  font-size: 15px;
}

.menu-email {
  font-size: 12px;
  color: #666;
}

.menu-divider {
  height: 1px;
  background: #eee;
  margin: 12px 0;
}

.menu-logout-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border: none;
  background: #f8f9fa;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #e74c3c;
  transition: background-color 0.3s;
}

.menu-logout-btn:hover {
  background: #e74c3c;
  color: white;
}

.logout-icon {
  font-size: 16px;
}
</style>