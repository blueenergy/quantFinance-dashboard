<template>
  <div>
    <v-card>
      <v-card-title>交易执行记录</v-card-title>
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
            <span :class="(item.side || item.action)?.toLowerCase()">{{ item.side || item.action || '-' }}</span>
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
const selectedDate = ref('');
const dateRangeType = ref('all'); // 'all', 'single', 'range', 'recent7', 'recent30'
const startDate = ref('');
const endDate = ref('');
const currentPage = ref(1);
const pageSize = ref(20);
const loading = ref(false);

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
    let response;
    
    // 构建查询参数
    const params = new URLSearchParams();
    params.append('limit', pageSize.value);
    params.append('skip', (currentPage.value - 1) * pageSize.value);
    
    // 处理日期筛选
    if (dateRangeType.value === 'recent7') {
      params.append('days', '7');
    } else if (dateRangeType.value === 'recent30') {
      params.append('days', '30');
    } else if (dateRangeType.value === 'single' && selectedDate.value) {
      // 单一日期，使用原有的 date API
      response = await tradeApi.getTradeExecutionsByDate(selectedDate.value, pageSize.value, (currentPage.value - 1) * pageSize.value);
      trades.value = response.data || [];
      loading.value = false;
      return;
    } else if (dateRangeType.value === 'range') {
      if (startDate.value) params.append('start_date', startDate.value);
      if (endDate.value) params.append('end_date', endDate.value);
    }
    // dateRangeType === 'all' 时不添加任何日期参数
    
    // 处理股票代码筛选
    if (searchSymbol.value) {
      response = await tradeApi.getTradeExecutionsBySymbol(searchSymbol.value, pageSize.value, (currentPage.value - 1) * pageSize.value);
    } else {
      // 使用带日期参数的 API
      const res = await fetch(`/api/trade-executions/?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      if (!res.ok) throw new Error(`Failed to fetch trade executions: ${res.status}`);
      response = await res.json();
    }
    
    trades.value = response.data || [];
  } catch (error) {
    console.error('Failed to load trades:', error);
    trades.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadStats() {
  try {
    const response = await tradeApi.getTradeExecutionStats();
    // Fix: Access response.stats directly as that's what the backend returns
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

// Watchers
watch([searchSymbol, selectedStrategy, dateRangeType, selectedDate, startDate, endDate], () => {
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