<template>
  <v-card>
    <v-card-title>
      <span>账户工作台</span>
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
    </v-card-text>
    
    <v-card-text v-else>
      <v-alert type="info" border="left">
        您还没有添加证券账户，请先在顶部菜单的“用户管理”中添加证券账户。
      </v-alert>
    </v-card-text>
    
    <!-- 账户概览 -->
    <v-card class="mb-4">
      <v-card-title>账户概览</v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="3">
            <v-card color="blue-lighten-5" class="pa-4">
              <div class="text-subtitle-2">总资产</div>
              <div class="text-h5 font-weight-bold">{{ formatCurrency(overview.total_assets || 0) }}</div>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card color="green-lighten-5" class="pa-4">
              <div class="text-subtitle-2">可用资金</div>
              <div class="text-h5 font-weight-bold">{{ formatCurrency(overview.available_cash || 0) }}</div>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card color="orange-lighten-5" class="pa-4">
              <div class="text-subtitle-2">持仓市值</div>
              <div class="text-h5 font-weight-bold">{{ formatCurrency(overview.market_value || 0) }}</div>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card :color="overview.daily_pnl >= 0 ? 'green-lighten-5' : 'red-lighten-5'" class="pa-4">
              <div class="text-subtitle-2">当日盈亏</div>
              <div class="text-h5 font-weight-bold">{{ formatCurrency(overview.daily_pnl || 0) }}</div>
              <div :class="overview.daily_pnl >= 0 ? 'green--text' : 'red--text'">
                ({{ formatPercent(overview.daily_pnl_ratio || 0) }})
              </div>
            </v-card>
          </v-col>
        </v-row>
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
            <span :class="item.raw.profit_loss_ratio >= 0 ? 'green--text' : 'red--text'">
              {{ formatPercent(item.raw.profit_loss_ratio) }}
            </span>
          </template>
          <template #item.profit_loss="{ item }">
            <span :class="item.raw.profit_loss >= 0 ? 'green--text' : 'red--text'">
              {{ formatCurrency(item.raw.profit_loss) }}
            </span>
          </template>
          <template #item.market_value="{ item }">
            {{ formatCurrency(item.raw.market_value) }}
          </template>
          <template #item.cost_price="{ item }">
            {{ formatCurrency(item.raw.cost_price) }}
          </template>
          <template #item.current_price="{ item }">
            {{ formatCurrency(item.raw.current_price) }}
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
                  border="left"
                >
                  警告：最大持仓占比过高 ({{ formatPercent(largestPositionRatio) }} > 20%)，请注意风险分散
                </v-alert>
                <v-alert 
                  v-else 
                  type="success"
                  border="left"
                >
                  持仓分布合理 (最大持仓占比: {{ formatPercent(largestPositionRatio) }})
                </v-alert>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-card>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { getTraderAccount, getTraderPositions, getSecuritiesAccounts, getTradeSignals } from '../api/trader'

// 证券账户列表
const securitiesAccounts = ref([])
// 当前选中的账户ID
const selectedAccountId = ref(null)

// 账户概览数据
const overview = ref({
  total_assets: 0,
  available_cash: 0,
  market_value: 0,
  daily_pnl: 0,
  daily_pnl_ratio: 0
})

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
  { title: '账户号', key: 'account_id' }
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

// 计算丰富化的持仓数据，使用数据库中的已有数据
const enrichedPositions = computed(() => {
  return positions.value.map(item => {
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

// 格式化百分比
function formatPercent(value) {
  if (value === undefined || value === null) return 'N/A'
  // 数据库中的unrealized_pnl_pct字段已经是百分比形式（例如3.406表示3.406%）
  return parseFloat(value).toFixed(2) + '%';
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
  await Promise.all([
    loadOverview(),
    loadPositions()
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
</style>