<template>
  <div>
    <v-card>
      <v-card-title>交易活动记录</v-card-title>
      <v-card-text>
        <div class="d-flex ga-2 mb-3">
          <v-btn
            size="small"
            :color="viewMode === 'signals' ? 'primary' : 'default'"
            @click="setViewMode('signals')"
          >
            交易信号
          </v-btn>
          <v-btn
            size="small"
            :color="viewMode === 'executions' ? 'primary' : 'default'"
            @click="setViewMode('executions')"
          >
            交易记录
          </v-btn>
          <v-btn
            size="small"
            :color="viewMode === 'summary' ? 'primary' : 'default'"
            @click="setViewMode('summary')"
          >
            统计视图
          </v-btn>
        </div>
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

        <v-row v-if="executionStats && viewMode === 'executions'" class="mb-4">
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text class="text-center">
                <div class="text-h5">{{ executionStats.total_trades }}</div>
                <div class="text-subtitle-1">总交易数</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text class="text-center">
                <div class="text-h5" style="color: #4caf50;">{{ executionStats.buy_trades }}</div>
                <div class="text-subtitle-1">买入交易</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text class="text-center">
                <div class="text-h5" style="color: #f44336;">{{ executionStats.sell_trades }}</div>
                <div class="text-subtitle-1">卖出交易</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text class="text-center">
                <div class="text-h5">{{ executionStats.total_symbols }}</div>
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
          v-if="viewMode !== 'summary'"
          :items="filteredTrades"
          :headers="headers"
          :loading="loading"
          class="elevation-1"
          :items-per-page="pageSize"
          :page="currentPage"
          :items-length="totalTrades"
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

        <v-data-table
          v-else
          :items="filteredSummaryRows"
          :headers="summaryHeaders"
          :loading="loading"
          class="elevation-1"
          :items-per-page="pageSize"
          :page="currentPage"
          :items-length="filteredSummaryRows.length"
          @update:page="updatePage"
          @click:row="onSummaryRowClick"
        >
          <template #item.realized_pnl="{ item }">
            {{ item.realized_pnl?.toFixed(2) || '-' }}
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
const viewMode = ref('executions');
const searchSymbol = ref('');
const selectedStrategy = ref('');
const statusFilter = ref('executed');
const selectedDate = ref('');
const dateRangeType = ref('all'); // 'all', 'single', 'range', 'recent7', 'recent30'
const startDate = ref('');
const endDate = ref('');
const currentPage = ref(1);
const pageSize = ref(20);
const loading = ref(false);
const errorMessage = ref('');
const totalTrades = ref(0);
const summaryRows = ref([]);
const totalRealizedPnl = ref(0);

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
  { title: '状态', key: 'status' },
  { title: '订单号', key: 'order_id' }
];

const summaryHeaders = [
  { title: '股票代码', key: 'symbol' },
  { title: '股票名称', key: 'stock_name' },
  { title: '策略', key: 'strategy' },
  { title: '交易笔数', key: 'total_trades' },
  { title: '净持仓', key: 'net_quantity' },
  { title: '已实现盈亏', key: 'realized_pnl' },
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

const filteredSummaryRows = computed(() => {
  let result = summaryRows.value;

  if (searchSymbol.value) {
    result = result.filter(row =>
      row.symbol?.toLowerCase().includes(searchSymbol.value.toLowerCase())
    );
  }

  if (selectedStrategy.value) {
    result = result.filter(row => row.strategy === selectedStrategy.value);
  }

  return result;
});

const executionStats = computed(() => {
  if (viewMode.value !== 'executions') return null;
  const items = filteredTrades.value;
  if (!items || items.length === 0) {
    return {
      total_trades: 0,
      buy_trades: 0,
      sell_trades: 0,
      total_symbols: 0,
      symbols: [],
    };
  }
  let buy = 0;
  let sell = 0;
  const symbolsSet = new Set();
  for (const t of items) {
    const side = (t.direction || t.side || t.action || '').toUpperCase();
    if (side === 'BUY') buy += 1;
    if (side === 'SELL') sell += 1;
    if (t.symbol) symbolsSet.add(t.symbol);
  }
  return {
    total_trades: items.length,
    buy_trades: buy,
    sell_trades: sell,
    total_symbols: symbolsSet.size,
    symbols: Array.from(symbolsSet),
  };
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
      limit: 1000,
      skip: 0,
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
    totalTrades.value = response.total ?? trades.value.length;
    
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
    if (viewMode.value !== 'executions') {
      stats.value = null;
      return;
    }
    const response = await tradeApi.getTradeExecutionStats();
    stats.value = response.stats || null;
  } catch (error) {
    console.error('Failed to load stats:', error);
    stats.value = null;
  }
}

async function loadSummary() {
  try {
    loading.value = true;
    errorMessage.value = '';

    const params = {};
    if (dateRangeType.value === 'recent7') {
      params.days = 7;
    } else if (dateRangeType.value === 'recent30') {
      params.days = 30;
    } else if (dateRangeType.value === 'range') {
      if (startDate.value) params.start_date = startDate.value;
      if (endDate.value) params.end_date = endDate.value;
    }

    const response = await tradeApi.getTradePnlSummary(params);
    summaryRows.value = response.data || [];
    totalRealizedPnl.value = response.total_realized_pnl ?? 0;

    if (summaryRows.value.length === 0) {
      errorMessage.value = response.message || '暂无统计数据';
    }
  } catch (error) {
    console.error('Failed to load PnL summary:', error);
    errorMessage.value = `Failed to load PnL summary: ${error.message || 'Unknown error'}`;
    summaryRows.value = [];
  } finally {
    loading.value = false;
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

function setViewMode(mode) {
  if (viewMode.value === mode) return;
  viewMode.value = mode;
  if (mode === 'executions') {
    statusFilter.value = 'executed';
  } else if (mode === 'signals') {
    statusFilter.value = 'pending';
  }
  currentPage.value = 1;
  if (mode === 'summary') {
    loadSummary();
  } else {
    loadTrades();
    loadStats();
  }
}

function refreshData() {
  currentPage.value = 1;
  if (viewMode.value === 'summary') {
    loadSummary();
  } else {
    loadTrades();
    loadStats();
  }
}

function updatePage(page) {
  currentPage.value = page;
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

function onSummaryRowClick(event, row) {
  const item = row?.item;
  if (!item) return;
  searchSymbol.value = item.symbol || '';
  selectedStrategy.value = item.strategy || '';
  viewMode.value = 'executions';
  statusFilter.value = 'executed';
  currentPage.value = 1;
  loadTrades();
  loadStats();
}

// Watchers
watch([searchSymbol, selectedStrategy, statusFilter, dateRangeType, selectedDate, startDate, endDate], () => {
  currentPage.value = 1;
  if (viewMode.value === 'summary') {
    loadSummary();
  } else {
    loadTrades();
    loadStats();
  }
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