<template>
  <div class="backtest-deploy-actions">
    <p v-if="message" class="deploy-message" :class="messageKind" role="status">
      {{ message }}
    </p>

    <div class="action-row">
      <template v-if="confirming">
        <span class="confirm-copy">
          确认将 {{ payload.symbol }} · {{ payload.strategy_key }} 部署到实盘？
        </span>
        <button
          type="button"
          class="confirm-deploy-btn"
          :disabled="deploying"
          @click="submitDeploy"
        >
          {{ deploying ? '部署中…' : '确认部署' }}
        </button>
        <button
          type="button"
          class="cancel-confirm-btn"
          :disabled="deploying"
          @click="cancelConfirm"
        >
          取消
        </button>
      </template>

      <button
        v-else
        type="button"
        class="deploy-btn"
        :disabled="deploying || deployed"
        @click="beginConfirm"
      >
        {{ deploying ? '部署中…' : deployed ? '已部署' : '部署到实盘' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import {
  deployBacktestToLive,
  getDeployBacktestBlockReason,
} from '../utils/deployBacktestToLive'
import request from '../utils/request'

const props = defineProps({
  payload: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['deployed'])

const confirming = ref(false)
const deploying = ref(false)
const deployed = ref(false)
const message = ref('')
const messageKind = ref('')

watch(
  () => props.payload,
  () => {
    confirming.value = false
    deploying.value = false
    deployed.value = false
    message.value = ''
    messageKind.value = ''
  },
  { deep: true },
)

function beginConfirm() {
  const blocked = getDeployBacktestBlockReason(props.payload)
  if (blocked) {
    message.value = blocked
    messageKind.value = 'error'
    return
  }
  message.value = ''
  messageKind.value = ''
  confirming.value = true
}

function cancelConfirm() {
  confirming.value = false
}

async function submitDeploy() {
  if (deploying.value) return
  deploying.value = true
  message.value = ''
  messageKind.value = ''

  try {
    await deployBacktestToLive(props.payload, { requestFn: request })
    confirming.value = false
    deployed.value = true
    message.value = '部署成功，策略已配置到实盘。'
    messageKind.value = 'success'
    window.dispatchEvent(
      new CustomEvent('watchlist-strategy-updated', {
        detail: {
          symbol: props.payload.symbol,
          strategy_key: props.payload.strategy_key,
          enabled: true,
        },
      }),
    )
    emit('deployed')
  } catch (error) {
    message.value = error?.response?.data?.detail || error?.message || '部署失败'
    messageKind.value = 'error'
  } finally {
    deploying.value = false
  }
}
</script>

<style scoped>
.backtest-deploy-actions {
  display: flex;
  flex: 1 1 100%;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.confirm-copy {
  color: #334155;
  font-size: 13px;
}

.deploy-message {
  margin: 0;
  font-size: 13px;
}

.deploy-message.success {
  color: #15803d;
}

.deploy-message.error {
  color: #b91c1c;
}

.deploy-btn,
.confirm-deploy-btn,
.cancel-confirm-btn {
  padding: 9px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.deploy-btn,
.confirm-deploy-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.cancel-confirm-btn {
  background: #f1f5f9;
  color: #475569;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
