<template>
  <v-card>
    <v-card-title class="d-flex justify-space-between align-center">
      <span>💼 账户工作台</span>
      <v-btn
        v-if="securitiesAccounts.length > 0 && !isObservationMode"
        color="primary"
        variant="flat"
        size="small"
        :disabled="!isMiniQmtConnected"
        @click="openTradeDialog(null, 'buy')"
      >
        💹 交易
      </v-btn>
    </v-card-title>
    
    <!-- 账户切换器 -->
    <v-card-text v-if="securitiesAccounts.length > 0">
      <v-select
        v-model="selectedAccountId"
        :items="accountOptions"
        label="选择账户"
        variant="outlined"
        density="compact"
        @update:model-value="onAccountChange"
      >
        <template #selection="{ item }">
          <span class="account-type-chip" :class="item.raw.account_type">
            {{ item.raw.account_type === 'simulated' ? '🧪' : '💼' }}
          </span>
          <span class="ml-2">{{ item.title }}</span>
        </template>
        <template #item="{ props, item }">
          <v-list-item v-bind="props">
            <template #prepend>
              <span class="account-type-icon">
                {{ item.raw.account_type === 'simulated' ? '🧪' : '💼' }}
              </span>
            </template>
            <template #append>
              <v-chip
                size="x-small"
                :color="item.raw.account_type === 'simulated' ? 'blue' : 'green'"
              >
                {{ item.raw.account_type === 'simulated' ? '观察模式' : '真实交易' }}
              </v-chip>
            </template>
          </v-list-item>
        </template>
      </v-select>
      
      <!-- 观察模式提示 -->
      <v-alert v-if="currentAccount && currentAccount.account_type === 'simulated'" type="info" variant="tonal" class="mt-2">
        <div class="d-flex align-center">
          <span>👀</span>
          <div class="ml-2">
            <strong>观察模式</strong>：下方数据为根据交易信号模拟计算的盈亏，实际未执行交易<br>
            <small>配置真实券商账户后，quantTrader 将自动执行交易信号</small>
          </div>
        </div>
      </v-alert>

      <v-alert v-else-if="currentAccount && !isMiniQmtConnected" type="warning" variant="tonal" class="mt-2">
        <div class="d-flex align-center">
          <span>⚠️</span>
          <div class="ml-2">
            <strong>miniQMT 未连接或心跳已过期</strong>：下方金额和持仓来自本地数据库最近一次同步快照，仅供参考，具体金额以 miniQMT 客户端为准。<br>
            <small>{{ traderConnectionText }}；{{ accountSnapshotText }}</small>
          </div>
        </div>
      </v-alert>

      <v-alert v-else-if="currentAccount" type="success" variant="tonal" class="mt-2">
        <strong>miniQMT 已连接</strong>
        <small class="ml-2">{{ traderConnectionText }}；{{ accountSnapshotText }}</small>
      </v-alert>
    </v-card-text>
    
    <v-card-text v-else>
      <v-alert type="info" border="start" variant="tonal" density="compact" class="mb-4">
        您还没有添加证券账户，请先在顶部菜单的“用户管理”中添加证券账户。
      </v-alert>
    </v-card-text>
    
    <!-- 账户概览 -->
    <v-card class="mb-4">
      <v-card-title>账户概览</v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="4">
            <v-card color="blue-lighten-5" class="pa-4">
              <div class="text-subtitle-2">总资产</div>
              <div class="text-h5 font-weight-bold">{{ displayAccountCurrency(overview.total_assets) }}</div>
              <div v-if="!accountDataReliable" class="stale-data-note">本地库快照，以 miniQMT 为准</div>
            </v-card>
          </v-col>
          <v-col cols="12" md="4">
            <v-card color="green-lighten-5" class="pa-4">
              <div class="text-subtitle-2">可用资金</div>
              <div class="text-h5 font-weight-bold">{{ displayAccountCurrency(overview.available_cash) }}</div>
              <div v-if="!accountDataReliable" class="stale-data-note">本地库快照，以 miniQMT 为准</div>
            </v-card>
          </v-col>
          <v-col cols="12" md="4">
            <v-card color="orange-lighten-5" class="pa-4">
              <div class="text-subtitle-2">持仓市值</div>
              <div class="text-h5 font-weight-bold">{{ displayAccountCurrency(overview.market_value) }}</div>
              <div v-if="!accountDataReliable" class="stale-data-note">本地库快照，以 miniQMT 为准</div>
            </v-card>
          </v-col>
          <!--
            当日盈亏卡片已移除：miniQMT 账户资产不提供当日盈亏，
            详见 quantTrader/KNOWN_LIMITATIONS.md（已知 limitation，暂不实现）。
          -->
        </v-row>
      </v-card-text>
    </v-card>

    <!-- 账户资金曲线 -->
    <v-card class="mb-4">
      <v-card-title class="d-flex flex-wrap align-center justify-space-between ga-2">
        <span>账户资金曲线</span>
        <div class="d-flex align-center ga-2">
          <v-btn-toggle v-model="equityMode" mandatory density="compact" variant="outlined">
            <v-btn value="total" size="small">总资产</v-btn>
            <v-btn value="adjusted" size="small">剔除出入金</v-btn>
          </v-btn-toggle>
          <v-btn
            size="small"
            variant="outlined"
            color="primary"
            :disabled="!selectedAccountId || isObservationMode"
            @click="openCashFlowDialog"
          >
            记录出入金
          </v-btn>
        </div>
      </v-card-title>
      <v-card-text>
        <p v-if="!accountEquityRows.length" class="muted-text">暂无账户资金曲线快照，盘后任务落库后显示。</p>
        <template v-else>
          <div class="equity-summary">
            <div>
              <span>{{ equityMode === 'adjusted' ? '最新净值（剔除出入金）' : '最新总资产' }}</span>
              <strong>{{ formatCurrency(latestEquity) }}</strong>
            </div>
            <div>
              <span>{{ equityMode === 'adjusted' ? '累计交易盈亏' : '累计总资产变化' }}</span>
              <strong :class="pnlClass(latestEquityChange)">{{ formatSignedCurrency(latestEquityChange) }}</strong>
            </div>
            <div>
              <span>当日交易盈亏</span>
              <strong :class="pnlClass(accountEquityRows[accountEquityRows.length - 1]?.daily_pnl)">
                {{ formatSignedCurrencyOrDash(accountEquityRows[accountEquityRows.length - 1]?.daily_pnl) }}
              </strong>
            </div>
            <div>
              <span>最新快照</span>
              <strong>{{ formatEquitySnapshotLabel(accountEquityRows[accountEquityRows.length - 1]) }}</strong>
            </div>
          </div>
          <div class="equity-chart" aria-label="Account equity curve">
            <div class="equity-chart-inner">
              <svg
                viewBox="0 0 640 220"
                role="img"
                @mousemove="onEquityHover"
                @mouseleave="onEquityLeave"
              >
                <line x1="28" y1="28" x2="28" y2="192" />
                <line x1="28" y1="192" x2="612" y2="192" />
                <polyline :points="accountEquityChart.points" />
                <circle
                  v-for="point in accountEquityChart.points.split(' ')"
                  :key="point"
                  :cx="point.split(',')[0]"
                  :cy="point.split(',')[1]"
                  r="3"
                />
                <circle
                  v-if="accountEquityChart.live"
                  class="equity-live-dot"
                  :cx="accountEquityChart.live.x"
                  :cy="accountEquityChart.live.y"
                  r="5"
                />
                <line
                  v-if="hoveredEquityPoint"
                  class="equity-hover-line"
                  :x1="hoveredEquityPoint.x"
                  y1="28"
                  :x2="hoveredEquityPoint.x"
                  y2="192"
                />
                <circle
                  v-if="hoveredEquityPoint"
                  class="equity-hover-dot"
                  :cx="hoveredEquityPoint.x"
                  :cy="hoveredEquityPoint.y"
                  r="4.5"
                />
                <text x="36" y="22">{{ formatCurrency(accountEquityChart.max) }}</text>
                <text x="36" y="186">{{ formatCurrency(accountEquityChart.min) }}</text>
                <text
                  v-for="label in accountEquityChart.labels"
                  :key="label.text"
                  :x="label.x"
                  :y="label.y"
                  :text-anchor="label.anchor"
                >
                  {{ label.text }}
                </text>
              </svg>
              <div
                v-if="hoveredEquityPoint"
                class="equity-tooltip"
                :class="hoveredEquityTooltipClass"
                :style="hoveredEquityTooltipStyle"
              >
                <div class="equity-tooltip-head">
                  {{ formatEquitySnapshotLabel(hoveredEquityPoint) }}
                </div>
                <div class="equity-tooltip-row">
                  <span>总资产</span>
                  <strong>{{ formatCurrency(hoveredEquityPoint.equity) }}</strong>
                </div>
                <div v-if="equityMode === 'adjusted'" class="equity-tooltip-row">
                  <span>剔除出入金净值</span>
                  <strong>{{ formatCurrency(hoveredEquityPoint.flow_adjusted_equity) }}</strong>
                </div>
                <div class="equity-tooltip-row">
                  <span>{{ hoveredEquityPoint.is_intraday ? '较昨收总资产（含出入金）' : '较上一日总资产（含出入金）' }}</span>
                  <strong
                    v-if="hoveredEquityPoint.change !== null"
                    :class="hoveredEquityPoint.change >= 0 ? 'is-up' : 'is-down'"
                  >
                    {{ formatSignedCurrency(hoveredEquityPoint.change) }}<template v-if="hoveredEquityPoint.change_ratio !== null">（{{ formatSignedPercent(hoveredEquityPoint.change_ratio * 100) }}）</template>
                  </strong>
                  <strong v-else>—</strong>
                </div>
                <div v-if="hasDailyPnl(hoveredEquityPoint)" class="equity-tooltip-row">
                  <span>当日交易盈亏</span>
                  <strong :class="hoveredEquityPoint.daily_pnl >= 0 ? 'is-up' : 'is-down'">
                    {{ formatSignedCurrency(hoveredEquityPoint.daily_pnl) }}<template v-if="hoveredEquityPoint.daily_pnl_ratio != null">（{{ formatSignedPercent(hoveredEquityPoint.daily_pnl_ratio * 100) }}）</template>
                  </strong>
                </div>
                <div class="equity-tooltip-row">
                  <span>{{ equityMode === 'adjusted' ? '较区间起点净值' : '较区间起点总资产' }}</span>
                  <strong>
                    {{ formatSignedCurrency(
                      equityMode === 'adjusted'
                        ? hoveredEquityPoint.flow_adjusted_change_from_start
                        : hoveredEquityPoint.change_from_start
                    ) }}
                  </strong>
                </div>
              </div>
            </div>
          </div>
          <p class="equity-note">{{ equityNote }}</p>
          <details v-if="cashFlows.length" class="cash-flow-details">
            <summary>出入金记录（{{ cashFlows.length }}）</summary>
            <div
              v-for="flow in cashFlows"
              :key="flow._id || flow.id"
              class="cash-flow-row"
            >
              <span>{{ formatEquityDate(flow.date) }}</span>
              <strong>{{ formatSignedCurrency(flow.amount) }}</strong>
              <span class="cash-flow-note">{{ flow.note || '—' }}</span>
              <v-btn size="x-small" variant="text" color="error" @click="removeCashFlow(flow)">
                删除
              </v-btn>
            </div>
          </details>
        </template>
      </v-card-text>
    </v-card>

    <!-- 持仓表 -->
    <v-card class="mb-4">
      <v-card-title>持仓详情</v-card-title>
      <v-card-text>
        <v-data-table 
          :items="enrichedPositions" 
          :headers="positionHeaders" 
          class="elevation-1"
          :sort-by="[{ key: 'market_value', order: 'desc' }]"
        >
          <template #item.profit_loss_ratio="{ item }">
            <span :class="item.raw.profit_loss_ratio >= 0 ? 'red--text' : 'green--text'">
              {{ formatPercent(item.raw.profit_loss_ratio) }}
            </span>
          </template>
          <template #item.profit_loss="{ item }">
            <span :class="item.raw.profit_loss >= 0 ? 'red--text' : 'green--text'">
              {{ formatCurrency(item.raw.profit_loss) }}
            </span>
          </template>
          <template #item.market_value="{ item }">
            {{ formatCurrency(item.raw.market_value) }}
          </template>
          <template #item.cost_price="{ item }">
            {{ formatPositionPrice(item.raw.cost_price, item.raw) }}
          </template>
          <template #item.current_price="{ item }">
            {{ formatPositionPrice(item.raw.current_price, item.raw) }}
          </template>
          <template #item.quantity="{ item }">
            {{ item.raw.quantity || 0 }}
          </template>
          <template #item.available_qty="{ item }">
            {{ item.raw.available_qty || 0 }}
          </template>
          <template #item.frozen_qty="{ item }">
            {{ item.raw.frozen_qty || item.raw.frozen_quantity || 0 }}
          </template>
          
          <!-- 操作列 -->
          <template #item.actions="{ item }">
            <div class="d-flex gap-1">
              <v-btn
                color="info"
                variant="text"
                size="x-small"
                @click="openHistoryDialog(item.raw)"
              >
                明细
              </v-btn>
              <v-btn
                v-if="!isObservationMode"
                color="primary"
                variant="tonal"
                size="x-small"
                :disabled="!isMiniQmtConnected"
                @click="openTradeDialog(item.raw, 'sell')"
              >
                交易
              </v-btn>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- 透视分析 -->
    <v-card>
      <v-card-title>透视分析</v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="6">
            <v-card>
              <v-card-title>持仓集中度</v-card-title>
              <v-card-text>
                <div v-for="position in topPositions" :key="position.symbol" class="mb-2">
                  <div class="d-flex justify-space-between">
                    <span>{{ position.raw.stock_name || position.raw.symbol }}</span>
                    <span>{{ formatPercent(position.raw.market_value / overview.market_value) }}</span>
                  </div>
                  <v-progress-linear 
                    :value="Math.min(100, (position.market_value / overview.market_value) * 100)" 
                    height="10" 
                    class="mb-2"
                  ></v-progress-linear>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="6">
            <v-card>
              <v-card-title>风险提示</v-card-title>
              <v-card-text>
                <v-alert 
                  v-if="largestPositionRatio > 0.2" 
                  type="warning"
                  border="start"
                >
                  警告：最大持仓占比过高 ({{ formatPercent(largestPositionRatio) }} > 20%)，请注意风险分散
                </v-alert>
                <v-alert 
                  v-else 
                  type="success"
                  border="start"
                >
                  持仓分布合理 (最大持仓占比: {{ formatPercent(largestPositionRatio) }})
                </v-alert>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
    
    <!-- 交易对话框 -->
    <TradeDialog
      v-model="tradeDialogVisible"
      :prefill-symbol="tradeDialogSymbol"
      :prefill-name="tradeDialogName"
      :prefill-action="tradeDialogAction"
      :prefill-available-qty="tradeDialogAvailableQty"
      :prefill-current-price="tradeDialogCurrentPrice"
      :securities-account-id="selectedAccountId"
      :available-cash="overview.available_cash"
      :positions="enrichedPositions"
      @success="onTradeSuccess"
    />
    
    <!-- 交易历史对话框 -->
    <v-dialog v-model="historyDialogVisible" max-width="800px" scrollable>
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center">
          <span>{{ historyDialogStock }} 交易明细</span>
          <v-btn icon size="small" variant="text" @click="historyDialogVisible = false">
            ✕
          </v-btn>
        </v-card-title>
        
        <hr class="divider" />
        
        <v-card-text>
          <v-progress-linear v-if="historyLoading" indeterminate color="primary" />
          
          <v-alert v-else-if="historyError" type="error" variant="tonal">
            {{ historyError }}
          </v-alert>
          
          <v-alert v-else-if="tradeHistory.length === 0" type="info" variant="tonal">
            暂无交易记录
          </v-alert>
          
          <v-data-table
            v-else
            :items="tradeHistory"
            :headers="historyHeaders"
            density="compact"
            class="elevation-0"
            :items-per-page="-1"
          >
            <template #item.action="{ item }">
              <v-chip
                :color="(item.action || item.side || '').toLowerCase() === 'buy' ? 'success' : 'error'"
                size="small"
                variant="flat"
              >
                {{ (item.action || item.side || '').toLowerCase() === 'buy' ? '买入' : '卖出' }}
              </v-chip>
            </template>
            <template #item.filled_price="{ item }">
              {{ formatHistoryFilledPrice(item.filled_price || item.price || 0) }}
            </template>
            <template #item.filled_qty="{ item }">
              {{ item.filled_size || item.filled_qty || item.size || item.quantity || 0 }}
            </template>
            <template #item.amount="{ item }">
              ¥{{ (parseFloat(item.filled_price || item.price || 0) * parseFloat(item.filled_size || item.filled_qty || item.size || item.quantity || 0)).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
            </template>
            <template #item.datetime="{ item }">
              {{ item.datetime || item.date || (item.timestamp ? new Date(item.timestamp * 1000).toLocaleString('zh-CN') : '-') }}
            </template>
            <template #item.strategy="{ item }">
              {{ item.strategy_name || item.strategy || '-' }}
            </template>
            <template #item.status="{ item }">
              <v-chip
                :color="(item.status || '').toLowerCase() === 'filled' ? 'success' : 'grey'"
                size="small"
                variant="tonal"
              >
                {{ {'filled': '已成交', 'partial_filled': '部分成交', 'rejected': '已拒绝', 'failed': '失败', 'pending': '待执行'}[(item.status || '').toLowerCase()] || '已成交' }}
              </v-chip>
            </template>
          </v-data-table>
        </v-card-text>
        
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="historyDialogVisible = false">关闭</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    
    <v-dialog v-model="cashFlowDialog" max-width="440">
      <v-card>
        <v-card-title>记录出入金</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="cashFlowForm.date"
            type="date"
            label="日期"
            density="compact"
          />
          <v-select
            v-model="cashFlowForm.direction"
            :items="cashFlowDirections"
            item-title="title"
            item-value="value"
            label="方向"
            density="compact"
          />
          <v-text-field
            v-model="cashFlowForm.amount"
            type="number"
            label="金额（元）"
            density="compact"
            min="0.01"
            step="0.01"
          />
          <v-text-field
            v-model="cashFlowForm.note"
            label="备注（可选）"
            density="compact"
          />
          <v-alert
            v-if="cashFlowError"
            type="error"
            variant="tonal"
            density="compact"
          >
            {{ cashFlowError }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="cashFlowDialog = false">取消</v-btn>
          <v-btn color="primary" :loading="cashFlowSaving" @click="saveCashFlow">保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 成功提示 -->
    <v-snackbar v-model="snackbar" color="success" :timeout="3000">
      {{ snackbarMessage }}
    </v-snackbar>
  </v-card>
</template>

<script setup>
import { ref, onMounted, computed, inject } from 'vue'
import {
  createTraderCashFlow,
  deleteTraderCashFlow,
  getTraderAccount,
  getTraderAccountEquity,
  getTraderCashFlows,
  getTraderPositions,
  getSecuritiesAccounts,
  getTradeSignals,
  getTraderHeartbeats,
} from '../api/trader'
import { getTradeExecutionsBySymbol } from '../api/trading'
import { useVisibilityAwarePolling } from '../composables/useVisibilityAwarePolling.js'
import { assetTypeForPosition, priceDigitsForAsset } from '../utils/assetPriceFormat.js'
import TradeDialog from './TradeDialog.vue'

// 证券账户列表
const securitiesAccounts = ref([])
// 当前选中的账户ID
const selectedAccountId = ref(null)
const traderHeartbeats = ref([])
const HEARTBEAT_FRESH_SECONDS = 180

// 账户概览数据
const overview = ref({
  total_assets: 0,
  available_cash: 0,
  market_value: 0,
  daily_pnl: 0,
  daily_pnl_ratio: 0
})
const accountEquity = ref([])
const cashFlows = ref([])
const equityMode = ref('total')
const cashFlowDialog = ref(false)
const cashFlowSaving = ref(false)
const cashFlowError = ref('')
const cashFlowForm = ref({
  date: '',
  direction: 'deposit',
  amount: '',
  note: '',
})
const cashFlowDirections = [
  { title: '入金', value: 'deposit' },
  { title: '出金', value: 'withdrawal' },
]

// 持仓数据
const positions = ref([])

// 持仓表头
const positionHeaders = [
  { title: '股票代码', key: 'symbol' },
  { title: '股票名称', key: 'stock_name' },
  { title: '持仓数量', key: 'quantity' },
  { title: '可用数量', key: 'available_qty' },
  { title: '冻结数量', key: 'frozen_qty' },
  { title: '成本价', key: 'cost_price' },
  { title: '当前价', key: 'current_price' },
  { title: '市值', key: 'market_value' },
  { title: '浮盈', key: 'profit_loss' },
  { title: '浮盈比例', key: 'profit_loss_ratio' },
  { title: '所属券商', key: 'broker' },
  { title: '账户号', key: 'account_id' },
  { title: '操作', key: 'actions', sortable: false, width: '80px' }
]

// 账户选项（用于v-select）
const accountOptions = computed(() => {
  return securitiesAccounts.value.map(acc => ({
    value: acc.id,
    title: `${acc.broker} - ${acc.account_id}`,
    raw: acc
  }))
})

// 当前选中的账户
const currentAccount = computed(() => {
  return securitiesAccounts.value.find(acc => acc.id === selectedAccountId.value)
})

// 是否为观察模式
const isObservationMode = computed(() => {
  return currentAccount.value && currentAccount.value.account_type === 'simulated'
})

const selectedTraderHeartbeat = computed(() => {
  if (!currentAccount.value || isObservationMode.value) return null
  const accountId = String(currentAccount.value.account_id || '')
  const securitiesAccountId = String(currentAccount.value.id || currentAccount.value._id || currentAccount.value.securities_account_id || '')
  return traderHeartbeats.value.find(hb => {
    const hbSecuritiesAccountId = String(hb.securities_account_id || '')
    const hbAccountId = String(hb.account_id || '')
    const hbWorkerId = String(hb.worker_id || '')
    return (
      (securitiesAccountId && hbSecuritiesAccountId === securitiesAccountId) ||
      (accountId && hbAccountId === accountId) ||
      (securitiesAccountId && hbWorkerId.includes(securitiesAccountId)) ||
      (accountId && hbWorkerId.includes(accountId))
    )
  }) || null
})

const heartbeatAgeSeconds = computed(() => {
  const lastSeenAt = Number(selectedTraderHeartbeat.value?.last_seen_at || 0)
  if (!lastSeenAt) return null
  return Math.max(0, Math.floor(Date.now() / 1000 - lastSeenAt))
})

const isMiniQmtConnected = computed(() => {
  if (isObservationMode.value) return true
  if (!selectedTraderHeartbeat.value || heartbeatAgeSeconds.value === null) return false
  const status = String(selectedTraderHeartbeat.value.status || '').toLowerCase()
  if (['stopped', 'failed', 'error', 'offline', 'disconnected'].includes(status)) return false
  return heartbeatAgeSeconds.value <= HEARTBEAT_FRESH_SECONDS
})

const accountDataReliable = computed(() => {
  return isObservationMode.value || isMiniQmtConnected.value
})

const traderConnectionText = computed(() => {
  if (isObservationMode.value) return '观察模式不依赖 miniQMT 实时连接'
  const heartbeat = selectedTraderHeartbeat.value
  if (!heartbeat) return '当前账户没有匹配到 quantTrader heartbeat'
  const ageText = formatDuration(heartbeatAgeSeconds.value)
  const lastSeen = heartbeat.last_seen_at ? new Date(heartbeat.last_seen_at * 1000).toLocaleString('zh-CN') : '-'
  return `状态 ${heartbeat.status || '-'}，最后心跳 ${ageText} 前（${lastSeen}）`
})

const accountSnapshotText = computed(() => {
  if (isObservationMode.value) return '数据由观察模式模拟计算'
  const syncedAt = Number(overview.value?.synced_at || 0)
  if (!syncedAt) return '本地数据库暂无账户同步时间'
  const syncedAtText = new Date(syncedAt * 1000).toLocaleString('zh-CN')
  const ageText = formatDuration(Math.max(0, Math.floor(Date.now() / 1000 - syncedAt)))
  return `本地数据库同步于 ${syncedAtText}（${ageText} 前）`
})

const flowBaselineDate = computed(() => {
  if (!cashFlows.value.length) return ''
  const firstFlowDate = [...cashFlows.value]
    .map(flow => String(flow.date || ''))
    .filter(Boolean)
    .sort()[0]
  if (!firstFlowDate) return ''
  const candidates = accountEquity.value
    .filter(point => !point.is_stale && String(point.date || '') < firstFlowDate)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
  return candidates.length ? String(candidates[candidates.length - 1].date || '') : ''
})

const accountEquityRows = computed(() => {
  const sortedRows = [...accountEquity.value]
    // Stale rows are duplicated snapshots written while the broker sync was
    // dead; plotting them draws fake flat plateaus between real observations.
    .filter(point => !point.is_stale)
    .filter(point => Number.isFinite(Number(point.total_asset ?? point.equity)))
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
  const baselineDate = equityMode.value === 'adjusted' ? flowBaselineDate.value : ''
  const rows = baselineDate
    ? sortedRows.filter(point => String(point.date || '') >= baselineDate)
    : sortedRows
  return rows
    .map((point, index, rows) => {
      const equity = Number(point.total_asset ?? point.equity)
      const first = Number(rows[0]?.total_asset ?? rows[0]?.equity)
      const previous = index > 0 ? Number(rows[index - 1].total_asset ?? rows[index - 1].equity) : NaN
      const change = Number.isFinite(previous) ? equity - previous : null
      const changeRatio = change !== null && previous !== 0 ? change / previous : null
      const changeFromStart = Number.isFinite(first) ? equity - first : null
      const adjustedEquity = Number(point.flow_adjusted_equity ?? equity)
      const firstAdjusted = Number(
        rows[0]?.flow_adjusted_equity ?? rows[0]?.total_asset ?? rows[0]?.equity,
      )
      const adjustedChangeFromStart = Number.isFinite(firstAdjusted)
        ? adjustedEquity - firstAdjusted
        : null
      const displayEquity = equityMode.value === 'adjusted' ? adjustedEquity : equity
      return {
        ...point,
        equity,
        adjusted_equity: adjustedEquity,
        display_equity: displayEquity,
        change,
        change_ratio: changeRatio,
        change_from_start: changeFromStart,
        flow_adjusted_change_from_start: adjustedChangeFromStart,
      }
    })
})

const latestEquity = computed(() => {
  const rows = accountEquityRows.value
  const last = rows[rows.length - 1]
  return last ? last.display_equity : null
})

const latestEquityChange = computed(() => {
  const rows = accountEquityRows.value
  const last = rows[rows.length - 1]
  if (!last) return null
  return equityMode.value === 'adjusted'
    ? last.flow_adjusted_change_from_start
    : last.change_from_start
})

const equityNote = computed(() => {
  const rows = accountEquityRows.value
  const row = rows[rows.length - 1]
  if (equityMode.value === 'adjusted') {
    if (!cashFlows.value.length) return '暂无出入金记录，净值曲线目前与总资产相同。'
    const baseline = flowBaselineDate.value
    const baselineText = baseline ? `从 ${formatEquityDate(baseline)} 起算；` : ''
    return `已剔除已记录的出入金（${baselineText}未记录的出入金仍会计入盈亏）。`
  }
  if (row?.daily_pnl_method === 'total_asset_delta_minus_external_flow') {
    const flow = Number(row.external_flow)
    if (Number.isFinite(flow) && flow !== 0) {
      return `总资产含入金/出金；当日交易盈亏已剔除确认的出入金 ${formatCurrency(flow)}。`
    }
    return '总资产含入金/出金；当日交易盈亏按已记录出入金调整，未记录的出入金仍会计入盈亏。'
  }
  return '总资产含入金/出金；当日交易盈亏按收盘持仓估算，不含费用和分红。'
})

const accountEquityChart = computed(() => {
  const rows = accountEquityRows.value
  if (!rows.length) return { points: '', coords: [], live: null, labels: [], min: 0, max: 0 }
  const values = rows.map(row => row.display_equity)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const width = 640
  const height = 220
  const pad = 28
  const coords = rows.map((row, index) => {
    const x = rows.length === 1 ? width / 2 : pad + (index * (width - pad * 2)) / (rows.length - 1)
    const y = height - pad - ((row.display_equity - min) * (height - pad * 2)) / span
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) }
  })
  const lastRow = rows[rows.length - 1]
  return {
    points: coords.map(point => `${point.x},${point.y}`).join(' '),
    coords,
    live: lastRow.is_intraday ? coords[coords.length - 1] : null,
    min,
    max,
    labels: [
      { text: formatEquityDate(rows[0].date), x: pad, y: height - 6, anchor: 'start' },
      {
        text: lastRow.is_intraday ? '今日实时' : formatEquityDate(lastRow.date),
        x: width - pad,
        y: height - 6,
        anchor: 'end',
      },
    ],
  }
})

// 鼠标悬停资金曲线：吸附到最近的采样点，显示该点资产与较上一交易日的变动。
const hoveredEquityIndex = ref(null)

const hoveredEquityPoint = computed(() => {
  const index = hoveredEquityIndex.value
  if (index === null) return null
  const rows = accountEquityRows.value
  const row = rows[index]
  const coords = accountEquityChart.value.coords[index]
  if (!row || !coords) return null
  return { ...row, x: coords.x, y: coords.y }
})

const hoveredEquityTooltipClass = computed(() => {
  const point = hoveredEquityPoint.value
  if (!point) return ''
  return {
    'is-start': point.x < 170,
    'is-end': point.x > 470,
    'is-below': point.y < 100,
  }
})

const hoveredEquityTooltipStyle = computed(() => {
  const point = hoveredEquityPoint.value
  if (!point) return {}
  return {
    left: `${(point.x / 640) * 100}%`,
    top: `${(point.y / 220) * 100}%`,
  }
})

function onEquityHover(event) {
  const rows = accountEquityRows.value
  const coords = accountEquityChart.value.coords
  if (!rows.length || !coords.length) return
  const rect = event.currentTarget.getBoundingClientRect()
  if (!rect.width) return
  const viewX = ((event.clientX - rect.left) / rect.width) * 640
  let nearest = 0
  for (let index = 1; index < coords.length; index += 1) {
    if (Math.abs(coords[index].x - viewX) < Math.abs(coords[nearest].x - viewX)) {
      nearest = index
    }
  }
  hoveredEquityIndex.value = nearest
}

function onEquityLeave() {
  hoveredEquityIndex.value = null
}

// 计算最大持仓占比
const largestPositionRatio = computed(() => {
  if (enrichedPositions.value.length === 0 || !overview.value.market_value) return 0
  const sortedPositions = [...enrichedPositions.value].sort((a, b) => b.raw.market_value - a.raw.market_value)
  return sortedPositions.length > 0 ? sortedPositions[0].raw.market_value / overview.value.market_value : 0
})

// 获取前几大持仓
const topPositions = computed(() => {
  return [...enrichedPositions.value]
    .sort((a, b) => b.raw.market_value - a.raw.market_value)
    .slice(0, 5)
})

function positionQuantity(row) {
  const raw = row?.raw || row || {}
  for (const field of ['quantity', 'qty', 'volume', 'shares', 'current_volume', 'total_volume']) {
    if (raw[field] !== undefined && raw[field] !== null) {
      const value = Number(raw[field])
      return Number.isFinite(value) ? value : 0
    }
  }
  return 0
}

// 计算丰富化的持仓数据，使用数据库中的已有数据
const enrichedPositions = computed(() => {
  return positions.value.filter(item => positionQuantity(item) > 0).map(item => {
    const pos = item.raw;
    
    // 使用数据库中的平均成本、浮盈和浮盈比例数据
    return {
      ...item,
      raw: {
        ...pos,
        cost_price: pos.avg_cost || pos.cost_price,
        profit_loss: pos.unrealized_pnl || 0,
        profit_loss_ratio: pos.unrealized_pnl_pct || 0
      }
    };
  });
})

// 格式化货币
function formatCurrency(value) {
  if (value === undefined || value === null) return 'N/A'
  return '¥' + parseFloat(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

// 价格按标的 tick 展示：ETF 3 位小数，股票 2 位（金额类字段仍保持 2 位）
function formatPositionPrice(value, row) {
  if (value === undefined || value === null || value === '') return 'N/A'
  const number = Number(value)
  if (!Number.isFinite(number)) return 'N/A'
  const digits = priceDigitsForAsset(assetTypeForPosition(row))
  return '¥' + number.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

// 交易明细成交价：按当前查看的标的识别 ETF / 股票
function formatHistoryFilledPrice(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  const digits = priceDigitsForAsset(assetTypeForPosition({ symbol: historyDialogSymbol.value }))
  return '¥' + number.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

function displayAccountCurrency(value) {
  return formatCurrency(value || 0)
}

function formatSignedCurrency(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 'N/A'
  const formatted = formatCurrency(Math.abs(number))
  return `${number >= 0 ? '+' : '-'}${formatted}`
}

function formatSignedCurrencyOrDash(value) {
  const number = Number(value)
  return Number.isFinite(number) ? formatSignedCurrency(number) : '—'
}

function hasDailyPnl(point) {
  return point?.daily_pnl !== null
    && point?.daily_pnl !== undefined
    && Number.isFinite(Number(point.daily_pnl))
}

// A-share convention: red = up/gain, green = down/loss.
function pnlClass(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number === 0) return ''
  return number > 0 ? 'is-up' : 'is-down'
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '未知'
  const value = Number(seconds)
  if (!Number.isFinite(value)) return '未知'
  if (value < 60) return `${Math.floor(value)}秒`
  if (value < 3600) return `${Math.floor(value / 60)}分${Math.floor(value % 60)}秒`
  return `${Math.floor(value / 3600)}小时${Math.floor((value % 3600) / 60)}分`
}

// 格式化百分比
function formatPercent(value) {
  if (value === undefined || value === null) return 'N/A'
  // 数据库中的unrealized_pnl_pct字段已经是百分比形式（例如3.406表示3.406%）
  return parseFloat(value).toFixed(2) + '%';
}

// 涨跌幅（入参已是百分比数值，例如 0.93 -> +0.93%）
function formatSignedPercent(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 'N/A'
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`
}

// 资金曲线日期：20261106 -> 2026-11-06
function formatEquityDate(value) {
  const text = String(value || '')
  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
  }
  return text || '-'
}

// 最新快照标签：盘中实时点显示同步时刻，日终帧标注“日终”
function formatEquitySnapshotLabel(row) {
  if (!row) return '-'
  const dateText = formatEquityDate(row.date)
  if (!row.is_intraday) return `${dateText} 日终`
  const syncedAt = Number(row.live_synced_at ?? row.source_synced_at)
  if (!Number.isFinite(syncedAt) || syncedAt <= 0) return `${dateText} 实时`
  const timeText = new Date(syncedAt * 1000).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${dateText} ${timeText} 实时`
}

// 加载账户概览
async function loadOverview() {
  try {
    // 如果是观察模式，使用模拟计算
    if (isObservationMode.value) {
      overview.value = await calculateSimulatedOverview()
      return
    }
    
    // 真实账户：从后端获取
    const data = await getTraderAccount(selectedAccountId.value)
    overview.value = data || {
      total_assets: 0,
      available_cash: 0,
      market_value: 0,
      daily_pnl: 0,
      daily_pnl_ratio: 0
    }
  } catch (error) {
    console.error('获取账户概览失败:', error)
    overview.value = {
      total_assets: 0,
      available_cash: 0,
      market_value: 0,
      daily_pnl: 0,
      daily_pnl_ratio: 0
    }
  }
}

// 加载持仓数据
async function loadPositions() {
  try {
    // 如果是观察模式，使用模拟计算
    if (isObservationMode.value) {
      positions.value = await calculateSimulatedPositions()
      return
    }
    
    // 真实账户：从后端获取
    const data = await getTraderPositions(selectedAccountId.value)
    positions.value = Array.isArray(data) ? data.map(item => ({
      ...item,
      raw: item
    })) : []
  } catch (error) {
    console.error('获取持仓数据失败:', error)
    positions.value = []
  }
}

async function loadTraderHeartbeats() {
  try {
    traderHeartbeats.value = await getTraderHeartbeats(50)
  } catch (error) {
    console.error('获取 quantTrader heartbeat 失败:', error)
    traderHeartbeats.value = []
  }
}

async function loadAccountEquity() {
  if (isObservationMode.value || !selectedAccountId.value) {
    accountEquity.value = []
    return
  }
  try {
    accountEquity.value = await getTraderAccountEquity(selectedAccountId.value, { include_live: true })
  } catch (error) {
    console.error('获取账户资金曲线失败:', error)
    accountEquity.value = []
  }
}

async function loadCashFlows() {
  if (isObservationMode.value || !selectedAccountId.value) {
    cashFlows.value = []
    return
  }
  try {
    const rows = await getTraderCashFlows(selectedAccountId.value)
    cashFlows.value = [...rows].sort(
      (a, b) => String(b.date || '').localeCompare(String(a.date || '')),
    )
  } catch (error) {
    console.error('获取出入金记录失败:', error)
    cashFlows.value = []
  }
}

function localDateInputValue() {
  const now = new Date()
  const offsetMs = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10)
}

function openCashFlowDialog() {
  cashFlowError.value = ''
  cashFlowForm.value = {
    date: localDateInputValue(),
    direction: 'deposit',
    amount: '',
    note: '',
  }
  cashFlowDialog.value = true
}

async function saveCashFlow() {
  cashFlowError.value = ''
  const amount = Number(cashFlowForm.value.amount)
  if (!cashFlowForm.value.date) {
    cashFlowError.value = '请选择日期'
    return
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    cashFlowError.value = '金额必须大于 0'
    return
  }
  cashFlowSaving.value = true
  try {
    const signedAmount = cashFlowForm.value.direction === 'withdrawal' ? -amount : amount
    await createTraderCashFlow({
      securities_account_id: selectedAccountId.value,
      date: String(cashFlowForm.value.date).replace(/-/g, ''),
      amount: signedAmount,
      note: cashFlowForm.value.note,
    })
    cashFlowDialog.value = false
    await Promise.all([loadCashFlows(), loadAccountEquity()])
  } catch (error) {
    const detail = error?.response?.data?.detail
    cashFlowError.value = (typeof detail === 'string' && detail) || error?.message || '保存失败'
  } finally {
    cashFlowSaving.value = false
  }
}

async function removeCashFlow(flow) {
  const flowId = flow?._id || flow?.id
  if (!flowId) return
  if (!window.confirm(
    `删除 ${formatEquityDate(flow.date)} 的出入金 ${formatSignedCurrency(flow.amount)}？`,
  )) return
  try {
    await deleteTraderCashFlow(flowId)
    await Promise.all([loadCashFlows(), loadAccountEquity()])
  } catch (error) {
    console.error('删除出入金失败:', error)
    snackbarMessage.value = error?.message || '删除出入金失败'
    snackbar.value = true
  }
}

// 观察模式：根据交易信号计算模拟盈亏
async function calculateSimulatedOverview() {
  const initial_cash = currentAccount.value?.initial_cash || 1000000
  const simulatedPositions = await calculateSimulatedPositions()
  
  const market_value = simulatedPositions.reduce((sum, pos) => sum + (pos.raw.market_value || 0), 0)
  const cash = initial_cash - simulatedPositions.reduce((sum, pos) => {
    return sum + (pos.raw.cost_price * pos.raw.quantity)
  }, 0)
  
  return {
    total_assets: cash + market_value,
    available_cash: cash,
    market_value: market_value,
    daily_pnl: 0,  // 观察模式不计算日盈亏
    daily_pnl_ratio: 0
  }
}

// 观察模式：根据交易信号计算模拟持仓
async function calculateSimulatedPositions() {
  try {
    // 获取所有交易信号
    const signals = await getTradeSignals(selectedAccountId.value)
    
    // 按照时间顺序排序
    signals.sort((a, b) => a.timestamp - b.timestamp)
    
    // 计算每个股票的持仓
    const positionMap = {}
    
    for (const signal of signals) {
      const symbol = signal.symbol
      if (!positionMap[symbol]) {
        positionMap[symbol] = {
          symbol: symbol,
          stock_name: signal.stock_name || symbol,
          quantity: 0,
          cost_price: 0,
          total_cost: 0
        }
      }
      
      const pos = positionMap[symbol]
      
      if (signal.action === 'buy') {
        // 买入：更新平均成本
        const buyAmount = signal.price * signal.size
        pos.total_cost += buyAmount
        pos.quantity += signal.size
        pos.cost_price = pos.total_cost / pos.quantity
      } else if (signal.action === 'sell') {
        // 卖出：按照平均成本计算
        const sellQty = Math.min(signal.size, pos.quantity)
        pos.quantity -= sellQty
        pos.total_cost = pos.cost_price * pos.quantity
      }
    }
    
    // 转换为数组并计算市值和盈亏（使用最后一个信号的价格作为当前价）
    const positions = Object.values(positionMap)
      .filter(pos => pos.quantity > 0)
      .map(pos => {
        // 找到最后一个信号的价格作为当前价
        const lastSignal = signals.filter(s => s.symbol === pos.symbol).pop()
        const current_price = lastSignal ? lastSignal.price : pos.cost_price
        
        const market_value = current_price * pos.quantity
        const profit_loss = market_value - (pos.cost_price * pos.quantity)
        const profit_loss_ratio = pos.cost_price > 0 ? (profit_loss / (pos.cost_price * pos.quantity)) * 100 : 0
        
        return {
          ...pos,
          current_price: current_price,
          market_value: market_value,
          profit_loss: profit_loss,
          profit_loss_ratio: profit_loss_ratio,
          available_qty: pos.quantity,
          frozen_qty: 0,
          broker: currentAccount.value?.broker || '模拟交易',
          account_id: currentAccount.value?.account_id || '',
          raw: null  // 先设为null
        }
      })
    
    // 为每个 position 设置 raw 属性
    return positions.map(pos => ({
      ...pos,
      raw: pos
    }))
    
  } catch (error) {
    console.error('计算模拟持仓失败:', error)
    return []
  }
}

// 加载证券账户列表
async function loadSecuritiesAccounts() {
  try {
    const accounts = await getSecuritiesAccounts()
    securitiesAccounts.value = Array.isArray(accounts) ? accounts : []
    
    // 如果没有选中账户，默认选择第一个
    if (securitiesAccounts.value.length > 0 && !selectedAccountId.value) {
      selectedAccountId.value = securitiesAccounts.value[0].id
    }
  } catch (error) {
    console.error('获取证券账户失败:', error)
    securitiesAccounts.value = []
  }
}

// 账户切换事件
function onAccountChange() {
  console.log('切换到账户:', selectedAccountId.value)
  refreshData()
}

// 刷新数据
async function refreshData() {
  await loadTraderHeartbeats()
  await Promise.all([
    loadOverview(),
    loadPositions(),
    loadAccountEquity(),
    loadCashFlows()
  ])
}

onMounted(async () => {
  // 先加载账户列表
  await loadSecuritiesAccounts()
  // 然后加载数据
  if (selectedAccountId.value) {
    await refreshData()
  }
})

// 账户工作台可见时每 60s 刷新一次，让资金曲线跟随账户同步延伸出今日实时点。
// 账户由 quantTrader 每分钟同步一次，轮询频率与之对齐。
const shellActiveTab = inject('shellActiveTab', null)
const isAccountTabActive = computed(() => shellActiveTab?.value === 'securities')
useVisibilityAwarePolling(() => {
  if (selectedAccountId.value) refreshData()
}, 60000, isAccountTabActive)

// ========== 交易对话框相关 ==========
const tradeDialogVisible = ref(false)
const tradeDialogSymbol = ref('')
const tradeDialogName = ref('')
const tradeDialogAction = ref('buy')
const tradeDialogAvailableQty = ref(0)
const tradeDialogCurrentPrice = ref(0)
const snackbar = ref(false)
const snackbarMessage = ref('')

/**
 * 打开交易对话框
 * @param {Object|null} position - 持仓数据（卖出时传入）
 * @param {string} action - 'buy' | 'sell'
 */
function openTradeDialog(position, action = 'buy') {
  if (position) {
    // 从持仓表格点击卖出
    tradeDialogSymbol.value = position.symbol || ''
    tradeDialogName.value = position.stock_name || position.name || ''
    tradeDialogAvailableQty.value = position.available_qty || 0
    tradeDialogCurrentPrice.value = position.current_price || 0
  } else {
    // 点击顶部交易按钮
    tradeDialogSymbol.value = ''
    tradeDialogName.value = ''
    tradeDialogAvailableQty.value = 0
    tradeDialogCurrentPrice.value = 0
  }
  tradeDialogAction.value = action
  tradeDialogVisible.value = true
}

/**
 * 交易成功回调
 */
function onTradeSuccess(result) {
  snackbarMessage.value = `委托已提交: ${result.order_id}`
  snackbar.value = true
  // 刷新数据
  refreshData()
}

// ========== 交易历史对话框相关 ==========
const historyDialogVisible = ref(false)
const historyDialogStock = ref('')
const historyDialogSymbol = ref('')
const historyLoading = ref(false)
const historyError = ref('')
const tradeHistory = ref([])

const historyHeaders = [
  { title: '时间', key: 'datetime', width: '160px' },
  { title: '方向', key: 'action', width: '80px' },
  { title: '数量', key: 'filled_qty' },
  { title: '成交价', key: 'filled_price' },
  { title: '成交金额', key: 'amount' },
  { title: '策略', key: 'strategy' },
  { title: '状态', key: 'status' }
]

/**
 * 打开交易历史对话框
 */
async function openHistoryDialog(position) {
  historyDialogStock.value = position.stock_name || position.symbol || ''
  historyDialogSymbol.value = position.symbol || ''
  historyDialogVisible.value = true
  historyLoading.value = true
  historyError.value = ''
  tradeHistory.value = []

  try {
    if (isObservationMode.value) {
      // 观察模式：获取交易信号记录作为历史
      // API 支持传入 symbol 筛选 (需要在 api/trader.js 中支持)
      const signals = await getTradeSignals(selectedAccountId.value, null, position.symbol)
      
      tradeHistory.value = signals.map(sig => ({
        datetime: sig.created_at || new Date(sig.timestamp * 1000).toLocaleString(),
        action: sig.action,
        filled_qty: sig.size,
        filled_price: sig.price || '市价',
        amount: (sig.price || position.current_price || 0) * sig.size,
        strategy: sig.strategy || 'Manual',
        status: sig.status
      }))
    } else {
      // 实盘模式：获取真实成交记录
      const data = await getTradeExecutionsBySymbol(position.symbol)
      tradeHistory.value = Array.isArray(data) ? data : (data.data || [])
    }
  } catch (e) {
    historyError.value = e.message || '获取交易记录失败'
    console.error('Fetch history failed:', e)
  } finally {
    historyLoading.value = false
  }
}
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
.account-type-chip {
  display: inline-block;
  font-size: 18px;
}
.account-type-chip.simulated {
  color: #667eea;
}
.account-type-chip.real {
  color: #28a745;
}
.account-type-icon {
  font-size: 24px;
  margin-right: 8px;
}
.ml-2 {
  margin-left: 8px;
}
.divider {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin: 0;
}
.gap-1 {
  gap: 4px;
}
.muted-text {
  color: rgba(var(--v-theme-on-surface), 0.55);
}
.equity-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.equity-summary div {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 8px;
  padding: 10px;
}
.equity-summary span {
  display: block;
  color: rgba(var(--v-theme-on-surface), 0.55);
  font-size: 12px;
}
.equity-note {
  margin: 8px 0 0;
  color: rgba(var(--v-theme-on-surface), 0.55);
  font-size: 12px;
  line-height: 1.5;
}
.cash-flow-details {
  margin-top: 12px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  padding-top: 8px;
}
.cash-flow-details summary {
  color: rgba(var(--v-theme-on-surface), 0.65);
  cursor: pointer;
  font-size: 12px;
  margin-bottom: 6px;
}
.cash-flow-row {
  align-items: center;
  border-bottom: 1px dashed rgba(var(--v-theme-on-surface), 0.12);
  display: grid;
  gap: 8px;
  grid-template-columns: 90px 100px minmax(0, 1fr) auto;
  padding: 6px 0;
  font-size: 12px;
}
.cash-flow-row:last-child {
  border-bottom: 0;
}
.cash-flow-note {
  color: rgba(var(--v-theme-on-surface), 0.6);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 600px) {
  .cash-flow-row {
    grid-template-columns: 1fr auto;
  }
  .cash-flow-note {
    grid-column: 1 / -1;
  }
}
.equity-chart {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 8px;
  padding: 8px;
}
.equity-chart svg {
  width: 100%;
  height: auto;
}
.equity-chart line {
  stroke: rgba(var(--v-theme-on-surface), 0.2);
}
.equity-chart polyline {
  fill: none;
  stroke: rgb(var(--v-theme-primary));
  stroke-width: 3;
}
.equity-chart circle {
  fill: rgb(var(--v-theme-primary));
}
.equity-chart circle.equity-live-dot {
  fill: none;
  stroke: rgb(var(--v-theme-primary));
  stroke-width: 2;
}
.equity-chart text {
  fill: rgba(var(--v-theme-on-surface), 0.55);
  font-size: 12px;
}
.equity-chart-inner {
  position: relative;
}
.equity-chart line.equity-hover-line {
  stroke: rgba(var(--v-theme-on-surface), 0.45);
  stroke-dasharray: 3 3;
}
.equity-chart circle.equity-hover-dot {
  fill: rgb(var(--v-theme-primary));
  stroke: #fff;
  stroke-width: 1.5;
}
.equity-tooltip {
  position: absolute;
  z-index: 5;
  min-width: 190px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(18, 18, 18, 0.9);
  color: #fff;
  font-size: 12px;
  line-height: 1.55;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
  transform: translate(-50%, calc(-100% - 10px));
}
.equity-tooltip.is-start {
  transform: translate(0, calc(-100% - 10px));
}
.equity-tooltip.is-end {
  transform: translate(-100%, calc(-100% - 10px));
}
.equity-tooltip.is-below {
  transform: translate(-50%, 10px);
}
.equity-tooltip.is-start.is-below {
  transform: translate(0, 10px);
}
.equity-tooltip.is-end.is-below {
  transform: translate(-100%, 10px);
}
.equity-tooltip-head {
  font-weight: 600;
  margin-bottom: 4px;
}
.equity-tooltip-row {
  display: flex;
  justify-content: space-between;
  gap: 18px;
}
.equity-tooltip-row span {
  opacity: 0.7;
}
.equity-summary strong.is-up {
  color: #dc2626;
}
.equity-summary strong.is-down {
  color: #15803d;
}
.equity-tooltip-row strong.is-up {
  color: #f87171;
}
.equity-tooltip-row strong.is-down {
  color: #4ade80;
}
</style>
