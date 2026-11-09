<template>
  <v-dialog
    :model-value="visible"
    max-width="680"
    persistent
    @update:model-value="onToggle"
  >
    <v-card v-if="guard">
      <v-card-title class="guard-title">
        {{ isStart ? '启动策略前确认持仓接管' : '停止策略前确认持仓' }}
      </v-card-title>

      <v-card-text>
        <div class="guard-headline">
          <span class="guard-symbol">{{ guard.symbol }}</span>
          <span class="guard-strategy">{{ guard.strategy_name || guard.strategy_key }}</span>
        </div>
        <div class="guard-account">{{ accountText }}</div>

        <div class="guard-grid">
          <div class="guard-item">
            <span>策略管理</span>
            <strong>{{ fmtQty(position.managed_qty) }} 股</strong>
          </div>
          <div class="guard-item">
            <span>账户持仓</span>
            <strong>{{ fmtQty(position.broker_qty) }} 股</strong>
          </div>
          <div class="guard-item">
            <span>底仓</span>
            <strong>{{ fmtQty(position.core_qty) }} 股</strong>
          </div>
          <div class="guard-item">
            <span>可卖</span>
            <strong>{{ fmtQty(position.can_use_volume) }} 股</strong>
          </div>
        </div>

        <div v-if="hasPrice" class="guard-pnl">
          成本 {{ fmtPrice(position.avg_price) }} · 现价 {{ fmtPrice(position.last_price) }}
          <span :class="pnlClass">
            浮动 {{ fmtMoney(position.unrealized_pnl) }}（{{ fmtPct(position.unrealized_pnl_pct) }}）
          </span>
        </div>
        <div v-if="position.entry_price" class="guard-entry">
          入场 {{ position.entry_date || '—' }} @ {{ fmtPrice(position.entry_price) }}
        </div>

        <v-alert
          v-for="(warning, index) in warnings"
          :key="index"
          type="warning"
          variant="tonal"
          density="compact"
          class="guard-alert"
        >
          {{ warning }}
        </v-alert>

        <div v-if="!isStart && hasPendingBuys" class="guard-pending">
          <div class="guard-pending-line">
            在途买单 {{ pending.buy.count }} 笔 / {{ fmtQty(pending.buy.qty) }} 股
          </div>
          <v-checkbox
            v-model="cancelPendingBuys"
            density="compact"
            hide-details
            label="同时请求撤销在途买单"
          />
        </div>

        <div class="guard-note">
          {{ isStart
            ? '启动后策略会按 state / 券商快照恢复持仓管理，不会补买原仓位；持仓数量以实际同步为准。'
            : '停止后该策略不再产生任何买卖信号；保留持仓意味着止损/止盈不再生效。' }}
        </div>
        <div v-if="!isStart && sessionNote" class="guard-note">{{ sessionNote }}</div>
        <div v-if="!isStart && !guard.can_auto_clear" class="guard-warn">
          系统无法自动确认可清仓数量；如需卖出请到持仓页手动操作。
        </div>
      </v-card-text>

      <v-card-actions class="guard-actions">
        <v-spacer />
        <v-btn variant="text" :disabled="busy" @click="cancel">取消</v-btn>
        <template v-if="isStart">
          <v-btn color="success" :disabled="busy" @click="start">
            {{ startButtonLabel }}
          </v-btn>
        </template>
        <template v-else>
          <v-btn variant="outlined" color="warning" :disabled="busy" @click="keep">
            停止但保留持仓
          </v-btn>
          <v-btn
            color="error"
            :disabled="busy || !guard.can_auto_clear"
            @click="clear"
          >
            停止并清仓{{ clearLabel }}
          </v-btn>
        </template>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useStrategyPositionGuard } from '../composables/strategyPositionGuard'

const { visible, guard, busy, mode, decide } = useStrategyPositionGuard()

const cancelPendingBuys = ref(false)

watch(guard, () => {
  cancelPendingBuys.value = false
})

const isStart = computed(() => mode.value === 'start')

const position = computed(() => guard.value?.position || {})
const account = computed(() => guard.value?.account || {})
const pending = computed(() => guard.value?.pending || {
  buy: { count: 0, qty: 0, order_ids: [] },
  sell: { count: 0, qty: 0, order_ids: [] },
})
const warnings = computed(() => guard.value?.warnings || [])

const accountText = computed(() => {
  if (!account.value.bound) return '未绑定证券账户（仅生成观察信号）'
  const id = account.value.account_id || '—'
  return `${id}（${account.value.broker || '未知券商'}）`
})

const hasPrice = computed(() => (
  Number(position.value.avg_price) > 0 || Number(position.value.last_price) > 0
))

const hasPendingBuys = computed(() => Number(pending.value.buy?.count || 0) > 0)

const pnlClass = computed(() => (
  Number(position.value.unrealized_pnl) >= 0 ? 'pnl-positive' : 'pnl-negative'
))

const clearLabel = computed(() => {
  const qty = Number(guard.value?.clear_qty || 0)
  return qty > 0 ? `（卖出 ${fmtQty(qty)} 股）` : ''
})

const startButtonLabel = computed(() => {
  const qty = Number(position.value.managed_qty)
  return Number.isFinite(qty) && qty > 0
    ? `启动并接管（${fmtQty(qty)} 股）`
    : '启动'
})

const sessionNote = computed(() => {
  const session = guard.value?.session
  if (!session || session.is_open) return ''
  const next = fmtDateTime(session.next_open_at)
  return next
    ? `当前非交易时段，清仓委托将在 ${next} 执行。`
    : '当前非交易时段，清仓委托将在下一交易时段执行。'
})

function isNum(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value))
}

function fmtQty(value) {
  if (!isNum(value)) return '—'
  return Number(value).toLocaleString('zh-CN')
}

function fmtPrice(value) {
  if (!isNum(value) || Number(value) === 0) return '—'
  return Number(value).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

function fmtMoney(value) {
  if (!isNum(value)) return '—'
  const num = Number(value)
  const sign = num >= 0 ? '+' : '-'
  return `${sign}¥${Math.abs(num).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
}

function fmtPct(value) {
  if (!isNum(value)) return '—'
  const num = Number(value)
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`
}

function fmtDateTime(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function onToggle(value) {
  if (!value) cancel()
}

function cancel() {
  decide(null)
}

function keep() {
  decide('keep')
}

function clear() {
  decide('clear', { cancelPendingBuys: cancelPendingBuys.value })
}

function start() {
  decide('start')
}
</script>

<style scoped>
.guard-title {
  font-size: 18px;
  font-weight: 700;
}

.guard-actions {
  flex-wrap: wrap;
  gap: 8px;
}

.guard-headline {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 2px;
}

.guard-symbol {
  font-size: 20px;
  font-weight: 700;
  color: #1976d2;
}

.guard-strategy {
  font-size: 14px;
  color: #555;
}

.guard-account {
  font-size: 13px;
  color: #777;
  margin-bottom: 12px;
}

.guard-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.guard-item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  background: #f5f7fa;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 13px;
}

.guard-item span {
  color: #666;
}

.guard-item strong {
  font-size: 15px;
  color: #333;
}

.guard-pnl {
  font-size: 13px;
  color: #555;
  margin-bottom: 4px;
}

.guard-entry {
  font-size: 12px;
  color: #777;
  margin-bottom: 10px;
}

.guard-alert {
  margin-bottom: 8px;
  font-size: 13px;
}

.guard-pending {
  margin-bottom: 8px;
  font-size: 13px;
}

.guard-pending-line {
  margin-bottom: 2px;
}

.guard-note {
  font-size: 12px;
  color: #666;
  line-height: 1.5;
  margin-top: 8px;
}

.guard-warn {
  font-size: 12px;
  color: #c62828;
  line-height: 1.5;
  margin-top: 8px;
}

.pnl-positive {
  color: #2e7d32;
  font-weight: 600;
}

.pnl-negative {
  color: #c62828;
  font-weight: 600;
}

@media (max-width: 600px) {
  .guard-grid {
    grid-template-columns: 1fr;
  }
}
</style>
