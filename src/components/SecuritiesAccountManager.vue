<template>
  <v-card>
    <v-card-title>
      <div class="d-flex justify-space-between align-center w-100">
        <span>证券账户管理</span>
        <v-btn v-if="!embedded" size="small" @click="openSecuritySettings">账户与安全设置</v-btn>
      </div>
    </v-card-title>
    <v-card-text>
      <v-data-table :items="accounts" :headers="headers" class="elevation-1">
        <template #item.actions="{ item }">
          <v-btn size="small" @click="editAccount(item)">编辑</v-btn>
          <v-btn size="small" color="error" @click="deleteAccount(item)">删除</v-btn>
        </template>
      </v-data-table>
      <v-btn color="primary" @click="openDialog">新增账户</v-btn>
    </v-card-text>
    <v-dialog v-model="dialog" max-width="500">
      <v-card>
        <v-card-title>{{ editing ? '编辑账户' : '新增账户' }}</v-card-title>
        <v-card-text>
          <v-select
            v-model="form.broker"
            :items="brokerOptions"
            label="券商"
            required
          ></v-select>
          <v-text-field v-model="form.account_id" label="账户" required></v-text-field>
          <v-text-field v-model="form.password" label="密码" type="password" required></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closeDialog">取消</v-btn>
          <v-btn color="primary" @click="saveAccount">保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    
    <!-- 账户与安全设置对话框 -->
    <AccountSecuritySettings v-if="!embedded" ref="accountSecuritySettings" />
  </v-card>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { getSecuritiesAccounts, createSecuritiesAccount, updateSecuritiesAccount, deleteSecuritiesAccount } from '../api/user'
import AccountSecuritySettings from './AccountSecuritySettings.vue'

const props = defineProps({
  embedded: {
    type: Boolean,
    default: false
  }
})

const accounts = ref([])
const headers = [
  { title: '券商', key: 'broker' },
  { title: '账户', key: 'account_id' },
  { title: '创建时间', key: 'created_at' },
  { title: '更新时间', key: 'updated_at' },
  { title: '操作', key: 'actions', sortable: false },
]
const dialog = ref(false)
const editing = ref(false)
const brokerOptions = ['国金证券']
const form = reactive({ broker: brokerOptions[0], account_id: '', password: '' })
let editingId = null

// 账户与安全设置对话框引用
const accountSecuritySettings = ref(null)

async function loadAccounts() {
  accounts.value = await getSecuritiesAccounts()
}
function openDialog() {
  editing.value = false
  Object.assign(form, { broker: brokerOptions[0], account_id: '', password: '' })
  dialog.value = true
}
function closeDialog() {
  dialog.value = false
}
function editAccount(item) {
  editing.value = true
  Object.assign(form, { broker: item.broker, account_id: item.account_id, password: item.password })
  editingId = item.account_id
  dialog.value = true
}
async function saveAccount() {
  if (editing.value) {
    await updateSecuritiesAccount(editingId, { ...form })
  } else {
    await createSecuritiesAccount({ ...form })
  }
  dialog.value = false
  await loadAccounts()
}
async function deleteAccount(item) {
  await deleteSecuritiesAccount(item.account_id)
  await loadAccounts()
}

// 打开账户与安全设置对话框
function openSecuritySettings() {
  if (accountSecuritySettings.value) {
    accountSecuritySettings.value.openDialog()
  }
}

onMounted(loadAccounts)
</script>

<style scoped>
.w-100 {
  width: 100%;
}
.d-flex {
  display: flex;
}
.justify-space-between {
  justify-content: space-between;
}
.align-center {
  align-items: center;
}
</style>
