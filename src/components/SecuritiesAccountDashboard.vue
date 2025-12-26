<template>
  <v-card>
    <v-card-title>
      <div class="d-flex justify-space-between align-center w-100">
        <span>账户工作台</span>
        <v-btn size="small" @click="openSecuritySettings">账户与安全设置</v-btn>
      </div>
    </v-card-title>
    
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

    <!-- 账户与安全设置对话框 -->
    <AccountSecuritySettings ref="accountSecuritySettings" />
  </v-card>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { getTraderAccount, getTraderPositions } from '../api/trader'
import AccountSecuritySettings from './AccountSecuritySettings.vue'

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

// 账户与安全设置对话框引用
const accountSecuritySettings = ref(null)

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
    const data = await getTraderAccount()
    // 如果后端没有返回有效数据，使用默认值
    overview.value = data || {
      total_assets: 0,
      available_cash: 0,
      market_value: 0,
      daily_pnl: 0,
      daily_pnl_ratio: 0
    }
  } catch (error) {
    console.error('获取账户概览失败:', error)
    // 设置默认值
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
    const data = await getTraderPositions()
    positions.value = Array.isArray(data) ? data.map(item => ({
      ...item,
      // Vuetify data table 需要 raw 属性
      raw: item
    })) : []
  } catch (error) {
    console.error('获取持仓数据失败:', error)
    positions.value = []
  }
}

// 刷新数据
async function refreshData() {
  await Promise.all([
    loadOverview(),
    loadPositions()
  ])
}

// 打开账户与安全设置对话框
function openSecuritySettings() {
  if (accountSecuritySettings.value) {
    accountSecuritySettings.value.openDialog()
  }
}

onMounted(() => {
  refreshData()
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
</style>