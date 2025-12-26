<template>
  <v-dialog v-model="dialog" max-width="600">
    <v-card>
      <v-card-title>账户与安全设置</v-card-title>
      <v-card-text class="pa-0">
        <v-tabs v-model="activeTab" grow>
          <v-tab value="account">证券账户配置</v-tab>
          <v-tab value="security">密码修改</v-tab>
        </v-tabs>

        <v-card-text>
          <v-window v-model="activeTab">
            <!-- 证券账户配置标签页 -->
            <v-window-item value="account">
              <SecuritiesAccountManager :embedded="true" />
            </v-window-item>

            <!-- 密码修改标签页 -->
            <v-window-item value="security">
              <v-form @submit.prevent="changePassword">
                <v-text-field
                  v-model="oldPassword"
                  label="当前密码"
                  type="password"
                  required
                ></v-text-field>
                <v-text-field
                  v-model="newPassword"
                  label="新密码"
                  type="password"
                  required
                ></v-text-field>
                <v-text-field
                  v-model="confirmNewPassword"
                  label="确认新密码"
                  type="password"
                  required
                ></v-text-field>
                <v-btn 
                  color="primary" 
                  type="submit" 
                  :disabled="!isPasswordFormValid || changingPassword"
                  :loading="changingPassword"
                >
                  修改密码
                </v-btn>
              </v-form>
              <v-alert v-if="passwordMessage" :type="passwordMessageType" class="mt-2">
                {{ passwordMessage }}
              </v-alert>
            </v-window-item>
          </v-window>
        </v-card-text>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="closeDialog">关闭</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { changePassword as apiChangePassword } from '../api/user'
import SecuritiesAccountManager from './SecuritiesAccountManager.vue'

const dialog = ref(false)
const activeTab = ref('account')
const oldPassword = ref('')
const newPassword = ref('')
const confirmNewPassword = ref('')
const changingPassword = ref(false)
const passwordMessage = ref('')
const passwordMessageType = ref('success')

// 密码表单验证
const isPasswordFormValid = computed(() => {
  return oldPassword.value && 
         newPassword.value && 
         confirmNewPassword.value && 
         newPassword.value === confirmNewPassword.value &&
         newPassword.value.length >= 8
})

// 打开对话框
function openDialog() {
  dialog.value = true
  // 重置表单
  resetPasswordForm()
}

// 关闭对话框
function closeDialog() {
  dialog.value = false
  resetPasswordForm()
}

// 重置密码表单
function resetPasswordForm() {
  oldPassword.value = ''
  newPassword.value = ''
  confirmNewPassword.value = ''
  changingPassword.value = false
  passwordMessage.value = ''
  passwordMessageType.value = 'success'
}

// 修改密码
async function changePassword() {
  if (!isPasswordFormValid.value) {
    passwordMessage.value = '请检查密码输入是否正确'
    passwordMessageType.value = 'error'
    return
  }

  changingPassword.value = true
  passwordMessage.value = ''

  try {
    await apiChangePassword(oldPassword.value, newPassword.value)
    passwordMessage.value = '密码修改成功！'
    passwordMessageType.value = 'success'
    
    // 重置表单
    setTimeout(() => {
      resetPasswordForm()
    }, 2000)
  } catch (error) {
    passwordMessage.value = error.message || '密码修改失败，请重试'
    passwordMessageType.value = 'error'
  } finally {
    changingPassword.value = false
  }
}

// 暴露方法给父组件使用
defineExpose({
  openDialog,
  closeDialog
})
</script>