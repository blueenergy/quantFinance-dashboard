<template>
  <div>
    <v-card>
      <v-card-title>交易活动记录</v-card-title>
      <v-card-text>
        <div class="d-flex flex-wrap ga-4 mb-4">
          <v-text-field
            v-model="searchSymbol"
            label="搜索股票代码"
            density="compact"
            variant="outlined"
            hide-details
          />
          <v-select
            v-model="selectedStrategy"
            :items="strategyOptions"
            label="策略筛选"
            density="compact"
            variant="outlined"
            hide-details
          />
          <v-select
            v-model="statusFilter"
            :items="statusFilterOptions"
            label="状态筛选"
            density="compact"
            variant="outlined"
            hide-details
          />
          <v-select
            v-model="dateRangeType"
            :items="dateRangeOptions"
            label="日期范围"
            density="compact"
            variant="outlined"
            hide-details
          />
          <v-text-field
            v-if="dateRangeType === 'single'"
            v-model="selectedDate"
            type="date"
            label="选择日期"
            density="compact"
            variant="outlined"
            hide-details
          />
          <v-text-field
            v-if="dateRangeType === 'range'"
            v-model="startDate"
            type="date"
            label="开始日期"
            density="compact"
            variant="outlined"
            hide-details
          />
          <v-text-field
            v-if="dateRangeType === 'range'"
            v-model="endDate"
            type="date"
            label="结束日期"
            density="compact"
            variant="outlined"
            hide-details
          />
          <v-btn color="primary" @click="refreshData">刷新</v-btn>
        </div>

        <v-row v-if="stats" class="mb-4">
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text class="text-center">
                <div class="text-h5">{{ stats.total_trades }}</div>
                <div class="text-subtitle-1">总交易数</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text class="text-center">
                <div class="text-h5" style="color: #4caf50;">{{ stats.buy_trades }}</div>
                <div class="text-subtitle-1">买入交易</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text class="text-center">
                <div class="text-h5" style="color: #f44336;">{{ stats.sell_trades }}</div>
                <div class="text-subtitle-1">卖出交易</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text class="text-center">
                <div class="text-h5">{{ stats.total_symbols }}</div>
                <div class="text-subtitle-1">涉及股票</div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Error/Info Alert -->
        <v-alert
          v-if="errorMessage"
          :type="trades.length === 0 && !loading ? 'info' : 'warning'"
          class="mb-4"
          closable
          @click:close="errorMessage = ''"
        >
          {{ errorMessage }}
        </v-alert>

        <v-data-table
          :items="filteredTrades"
          :headers="headers"
          :loading="loading"
          class="elevation-1"
          :items-per-page="pageSize"
          :page="currentPage"
          @update:page="updatePage"
        >
          <template #item.timestamp="{ item }">
            {{ formatDate(item.timestamp) }}
          </template>
          <template #item.stock_name="{ item }">
            {{ item.stock_name || item.name || '-' }}
          </template>
          <template #item.side="{ item }">
            <span :class="(item.direction || item.side || item.action)?.toLowerCase()">{{ item.direction || item.side || item.action || '-' }}</span>
          </template>
          <template #item.status="{ item }">
            <v-chip :color="getStatusColor(item.status)" size="small">
              {{ item.status || '-' }}
            </v-chip>
          </template>
          <template #item.target_price="{ item }">
            {{ item.target_price?.toFixed(2) || item.price?.toFixed(2) || '-' }}
          </template>
          <template #item.filled_price="{ item }">
            {{ item.filled_price?.toFixed(2) || '-' }}
          </template>
          <template #item.quantity="{ item }">
            {{ item.quantity || item.size || '-' }}
          </template>
          <template #item.strategy="{ item }">
            {{ item.strategy_name || item.strategy || '-' }}
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import * as tradeApi from '../api/tradeExecution.js';

// Reactive data
const trades = ref([]);
const stats = ref(null);
const strategies = ref([]);
const searchSymbol = ref('');
const selectedStrategy = ref('');
const statusFilter = ref('all');
const selectedDate = ref('');
const dateRangeType = ref('all'); // 'all', 'single', 'range', 'recent7', 'recent30'
const startDate = ref('');
const endDate = ref('');
const currentPage = ref(1);
const pageSize = ref(20);
const loading = ref(false);
const errorMessage = ref('');

// 状态筛选选项
const statusFilterOptions = [
  { title: '全部', value: 'all' },
  { title: '仅已执行', value: 'executed' },
  { title: '仅待执行', value: 'pending' }
];

// 日期范围选项
const dateRangeOptions = [
  { title: '所有日期', value: 'all' },
  { title: '最近7天', value: 'recent7' },
  { title: '最近30天', value: 'recent30' },
  { title: '单一日期', value: 'single' },
  { title: '日期范围', value: 'range' }
];

// Headers for data table
const headers = [
  { title: '时间', key: 'timestamp' },
  { title: '股票代码', key: 'symbol' },
  { title: '股票名称', key: 'stock_name' },
  { title: '策略', key: 'strategy' },
  { title: '方向', key: 'side' },
  { title: '目标价', key: 'target_price' },
  { title: '成交价', key: 'filled_price' },
  { title: '数量', key: 'quantity' },
  { title: '状态', key: 'status' }
];

// Computed properties
const filteredTrades = computed(() => {
  let result = trades.value;
  
  // Filter by symbol
  if (searchSymbol.value) {
    result = result.filter(trade => 
      trade.symbol?.toLowerCase().includes(searchSymbol.value.toLowerCase())
    );
  }
  
  // Filter by strategy
  if (selectedStrategy.value) {
    result = result.filter(trade => 
      (trade.strategy_name || trade.strategy) === selectedStrategy.value
    );
  }
  
  // Filter by date
  if (selectedDate.value) {
    result = result.filter(trade => {
      if (!trade.timestamp) return false;
      // Fix: Handle both timestamp formats (seconds and milliseconds)
      const timestampMs = trade.timestamp > 1e10 ? trade.timestamp : trade.timestamp * 1000;
      const tradeDate = new Date(timestampMs).toISOString().split('T')[0];
      return tradeDate === selectedDate.value;
    });
  }
  
  return result;
});

const strategyOptions = computed(() => {
  return ['', ...strategies.value].map(strategy => ({
    title: strategy || '所有策略',
    value: strategy
  }));
});

// Methods
function formatDate(timestamp) {
  if (!timestamp) return '-';
  // Fix: Handle both timestamp formats (seconds and milliseconds)
  const timestampMs = timestamp > 1e10 ? timestamp : timestamp * 1000;
  const date = new Date(timestampMs);
  return date.toLocaleString('zh-CN');
}

async function loadTrades() {
  try {
    loading.value = true;
    errorMessage.value = '';
    
    // 使用新的融合 API
    const params = {
      limit: pageSize.value,
      skip: (currentPage.value - 1) * pageSize.value
    };
    
    // 添加状态筛选
    if (statusFilter.value && statusFilter.value !== 'all') {
      params.status_filter = statusFilter.value;
    }
    
    // 处理日期筛选
    if (dateRangeType.value === 'recent7') {
      params.days = 7;
    } else if (dateRangeType.value === 'recent30') {
      params.days = 30;
    } else if (dateRangeType.value === 'range') {
      if (startDate.value) params.start_date = startDate.value;
      if (endDate.value) params.end_date = endDate.value;
    }
    
    const response = await tradeApi.getAllTradeActivities(params);
    trades.value = response.data || [];
    
    // Show message if no data
    if (trades.value.length === 0) {
      if (response.message) {
        errorMessage.value = response.message;
      } else {
        errorMessage.value = 'No trade activities found. Start trading to see data here.';
      }
    }
    
  } catch (error) {
    console.error('Failed to load trades:', error);
    errorMessage.value = `Failed to load trade data: ${error.message || 'Unknown error'}`;
    trades.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadStats() {
  try {
    const response = await tradeApi.getTradeActivitiesStats();
    // Use the new merged stats API
    stats.value = response.stats || null;
  } catch (error) {
    console.error('Failed to load stats:', error);
    stats.value = null;
  }
}

async function loadStrategies() {
  try {
    const response = await tradeApi.getTradeStrategies();
    // Fix: Access response.strategies directly as that's what the backend returns
    strategies.value = response.strategies || [];
  } catch (error) {
    console.error('Failed to load strategies:', error);
    strategies.value = [];
  }
}

function refreshData() {
  currentPage.value = 1;
  loadTrades();
  loadStats();
}

function updatePage(page) {
  currentPage.value = page;
  loadTrades();
}

function getStatusColor(status) {
  const statusUpper = (status || '').toUpperCase();
  const colorMap = {
    'FILLED': 'green',
    'PENDING': 'orange',
    'RETRY': 'amber',
    'SUBMITTED': 'blue',
    'FAILED': 'red'
  };
  return colorMap[statusUpper] || 'grey';
}

// Watchers
watch([searchSymbol, selectedStrategy, statusFilter, dateRangeType, selectedDate, startDate, endDate], () => {
  currentPage.value = 1;
  loadTrades();
});

// Lifecycle
onMounted(() => {
  loadTrades();
  loadStats();
  loadStrategies();
});
</script>

<style scoped>
.buy {
  color: #4caf50;
  font-weight: 600;
}

.sell {
  color: #f44336;
  font-weight: 600;
}
</style>