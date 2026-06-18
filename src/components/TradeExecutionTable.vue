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

        <v-row v-if="viewMode === 'summary'" class="mb-4">
          <v-col cols="12" md="4">
            <v-card>
              <v-card-text class="text-center">
                <div class="text-h6">{{ summaryPnlStats.totalRealized.toFixed(2) }}</div>
                <div class="text-subtitle-2">总已实现盈亏</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="4">
            <v-card>
              <v-card-text class="text-center">
                <div class="text-h6">{{ summaryPnlStats.totalUnrealized.toFixed(2) }}</div>
                <div class="text-subtitle-2">总浮盈（未实现）</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="4">
            <v-card>
              <v-card-text class="text-center">
                <div class="text-h6">{{ summaryPnlStats.total.toFixed(2) }}</div>
                <div class="text-subtitle-2">总盈亏（已实现 + 浮盈）</div>
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

        <template v-if="viewMode !== 'summary'">
        <v-data-table
          :items="filteredTrades"
          :headers="tableHeaders"
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
            {{ getStrategyName(item.strategy_name || item.strategy) || '-' }}
          </template>
          <template #item.order_id="{ item }">
            <div class="d-flex flex-column">
              <span class="text-body-2 text-break">{{ item.order_id || '—' }}</span>
              <span
                v-if="item.broker_order_id || item.qmt_order_id"
                class="text-caption text-medium-emphasis"
              >
                券商 {{ item.broker_order_id || item.qmt_order_id }}
              </span>
            </div>
          </template>
          <template #item.signal_diag="{ item }">
            <span v-if="viewMode === 'signals'" class="text-caption text-medium-emphasis">{{ formatSubmittedDiagnostics(item) }}</span>
          </template>
          <template #item.actions="{ item }">
            <div v-if="viewMode === 'signals'" class="d-flex flex-column ga-1 align-start py-1">
              <v-btn
                v-if="canShowReprice(item)"
                size="small"
                variant="tonal"
                color="primary"
                @click="openRepriceDialog(item)"
              >
                重新定价
              </v-btn>
              <template v-else-if="isSubmittedSignal(item)">
                <v-btn size="x-small" variant="tonal" color="secondary" @click="openSubmittedHelp(item)">
                  应怎么做
                </v-btn>
                <v-btn size="x-small" variant="text" @click="refreshData">刷新列表</v-btn>
              </template>
              <span v-else class="text-caption text-disabled">—</span>
            </div>
          </template>
        </v-data-table>

        <v-dialog v-model="repriceDialog" max-width="560" persistent>
          <v-card>
            <v-card-text v-if="repriceLoading" class="text-center py-8">加载预览…</v-card-text>
            <template v-else-if="repricePreview">
            <v-card-title>重新定价买入 — {{ repricePreview.symbol }}</v-card-title>
            <v-card-text>
              <p class="text-body-2">原订单 {{ repriceOrderId }}，基准数量 {{ repricePreview.size }}</p>
              <p class="text-caption">
                市场参考价: {{ repricePreview.market_reference_price != null ? Number(repricePreview.market_reference_price).toFixed(3) : '—' }}
                ({{ repricePreview.market_reference_source || '—' }})
              </p>
              <p class="text-caption">
                建议限价: {{ repricePreview.suggested_effective_limit_price != null ? Number(repricePreview.suggested_effective_limit_price).toFixed(3) : '—' }}
              </p>
              <p v-if="repriceNotionalDisplay" class="text-caption">预计金额 ≈ {{ repriceNotionalDisplay }}</p>
              <p v-if="repriceVsMarketPctDisplay != null" class="text-caption">相对市场参考偏离: {{ repriceVsMarketPctDisplay }}%</p>
              <v-divider class="my-3" />
              <v-text-field
                v-model.number="repriceLimit"
                label="限价 (必填)"
                type="number"
                step="0.01"
                variant="outlined"
                density="compact"
              />
              <v-text-field
                v-model.number="repriceSize"
                label="数量 (可选，留空沿用原单)"
                type="number"
                variant="outlined"
                density="compact"
              />
              <v-text-field v-model="repriceReason" label="原因说明" variant="outlined" density="compact" />
              <v-alert v-if="repriceError" type="error" density="compact" class="mt-2">{{ repriceError }}</v-alert>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="closeRepriceDialog">取消</v-btn>
              <v-btn color="primary" :loading="repriceSubmitting" @click="submitRepriceConfirm">确认生成新信号</v-btn>
            </v-card-actions>
            </template>
          </v-card>
        </v-dialog>

        <v-dialog v-model="submittedHelpOpen" max-width="560">
          <v-card v-if="submittedHelpItem">
            <v-card-title class="text-wrap">已报单（{{ submittedHelpItem.symbol }}）可以做什么</v-card-title>
            <v-card-text class="text-body-2">
              <p class="mb-2">
                订单号：<code>{{ submittedHelpItem.order_id }}</code>
                <template v-if="submittedHelpItem.broker_order_id || submittedHelpItem.qmt_order_id">
                  ；券商委托：<code>{{ submittedHelpItem.broker_order_id || submittedHelpItem.qmt_order_id }}</code>
                </template>
                ；方向：<strong>{{ (submittedHelpItem.action || submittedHelpItem.direction || '').toUpperCase() }}</strong>
              </p>
              <ul class="pl-4 mb-0">
                <li class="mb-2">
                  当前为「已报单」：说明已在券商侧挂单。左侧「挂单诊断」会显示限价、市场参考、挂单时长等（数据由本机
                  <strong>quantTrader</strong> 轮询写入 Mongo，需进程在线且能连上同一数据库）。
                </li>
                <li v-if="isSubmittedBuy(submittedHelpItem)" class="mb-2">
                  <strong>买入</strong>：若市价明显高于限价，买单往往难以成交。长时间未成交时，quantTrader
                  会对买单做超时撤单；撤单完成后状态变为「已取消」，此时本页会出现「<strong>重新定价</strong>」按钮，可人工确认后生成新的买入信号。
                </li>
                <li v-else class="mb-2">
                  <strong>卖出</strong>：若市价明显低于限价，卖单可能长时间挂在盘上；请结合诊断中的价格偏离判断。卖单超时撤单逻辑与买单类似，由 quantTrader 执行。
                </li>
                <li class="mb-2">可先点击「<strong>刷新列表</strong>」查看最新状态与诊断字段。</li>
                <li>若长期无变化：检查 quantTrader 日志、券商连接，以及本页日期筛选是否过窄（可切换到「所有日期」）。</li>
              </ul>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn color="primary" variant="text" @click="submittedHelpOpen = false">知道了</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
        </template>

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
          <template #item.unrealized_pnl="{ item }">
            {{ item.unrealized_pnl?.toFixed(2) || '-' }}
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import * as tradeApi from '../api/tradeExecution.js';

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

// Reactive data
const trades = ref([]);
const strategies = ref([]); // Will be loaded from global strategy API
const viewMode = ref('executions');
const searchSymbol = ref('');
const selectedStrategy = ref('');
const statusFilter = ref('executed');
const selectedDate = ref('');
const dateRangeType = ref('recent30'); // 'all', 'single', 'range', 'recent7', 'recent30'
const startDate = ref('');
const endDate = ref('');
const currentPage = ref(1);
const pageSize = ref(20);
const loading = ref(false);
const errorMessage = ref('');
const totalTrades = ref(0);
const summaryRows = ref([]);
const totalRealizedPnl = ref(0);
const totalUnrealizedPnl = ref(0);

const repriceDialog = ref(false);
const repriceSubmitting = ref(false);
const repriceLoading = ref(false);
const repriceOrderId = ref('');
const repricePreview = ref(null);
const repriceLimit = ref(null);
const repriceSize = ref(null);
const repriceReason = ref('');
const repriceError = ref('');

const submittedHelpOpen = ref(false);
const submittedHelpItem = ref(null);

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
  { title: '订单号 / 券商', key: 'order_id' }
];

const tableHeaders = computed(() => {
  const base = [...headers];
  if (viewMode.value === 'signals') {
    base.push({ title: '挂单诊断', key: 'signal_diag', sortable: false });
    base.push({ title: '操作', key: 'actions', sortable: false, width: '200px' });
  }
  return base;
});

const repriceNotionalDisplay = computed(() => {
  const px = Number(repriceLimit.value);
  const sz = Number(repriceSize.value);
  const baseSz = Number(repricePreview.value?.size);
  const q = Number.isFinite(sz) && sz > 0 ? sz : baseSz;
  if (!Number.isFinite(px) || px <= 0 || !Number.isFinite(q) || q <= 0) return null;
  return (px * q).toFixed(2);
});

const repriceVsMarketPctDisplay = computed(() => {
  const m = Number(repricePreview.value?.market_reference_price);
  const px = Number(repriceLimit.value);
  if (!Number.isFinite(m) || m <= 0 || !Number.isFinite(px)) return null;
  return (((px - m) / m) * 100).toFixed(2);
});

const summaryHeaders = [
  { title: '股票代码', key: 'symbol' },
  { title: '股票名称', key: 'stock_name' },
  { title: '策略', key: 'strategy' },
  { title: '交易笔数', key: 'total_trades' },
  { title: '净持仓', key: 'net_quantity' },
  { title: '已实现盈亏', key: 'realized_pnl' },
  { title: '浮盈', key: 'unrealized_pnl' },
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
    result = result.filter(trade => {
      const tradeStrategy = trade.strategy_name || trade.strategy;
      // Check both strategy key and Chinese name
      return tradeStrategy === selectedStrategy.value || 
             getStrategyName(tradeStrategy) === selectedStrategy.value;
    });
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
    result = result.filter(row => {
      const rowStrategy = row.strategy;
      // Check both strategy key and Chinese name
      return rowStrategy === selectedStrategy.value || 
             getStrategyName(rowStrategy) === selectedStrategy.value;
    });
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

const summaryPnlStats = computed(() => {
  const realized = Number(totalRealizedPnl.value || 0);
  const unrealized = Number(totalUnrealizedPnl.value || 0);
  return {
    totalRealized: realized,
    totalUnrealized: unrealized,
    total: realized + unrealized,
  };
});

const strategyOptions = computed(() => {
  return ['', ...strategies.value].map(strategy => ({
    title: getStrategyName(strategy) || strategy || '所有策略',
    value: strategy
  }));
});

// Function to get strategy Chinese name
function getStrategyName(strategyKey) {
  if (!strategyKey) return strategyKey;
  
  // Manual trading special case
  if (strategyKey === 'manual') return '手动交易';
  
  // Try to find in available strategies list
  const strategyObj = availableStrategies.value?.find(s => s.key === strategyKey);
  if (strategyObj) {
    return strategyObj.name || strategyObj.key;
  }
  
  // Fallback to key if not found
  return strategyKey;
}

// Available strategies from API for name lookup
const availableStrategies = ref([]);

// Load available strategy metadata for name lookup
async function loadStrategyMetadata() {
  try {
    const token = localStorage.getItem('access_token')
    const response = await fetch(`${API_BASE}/strategy/strategies`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (!response.ok) throw new Error('Failed to load strategy metadata')
    const strategiesData = await response.json()
    availableStrategies.value = strategiesData.strategies || []
    
    console.log('策略元数据加载成功:', availableStrategies.value.length, '个策略')
  } catch (error) {
    console.error('Failed to load strategy metadata:', error);
    availableStrategies.value = [];
  }
}

// Methods
function formatDate(timestamp) {
  if (!timestamp) return '-';
  // Fix: Handle both timestamp formats (seconds and milliseconds)
  const timestampMs = timestamp > 1e10 ? timestamp : timestamp * 1000;
  const date = new Date(timestampMs);
  return date.toLocaleString('zh-CN');
}

function rawSignalStatus(item) {
  return String(item.raw_signal_status || item.status || '').toLowerCase();
}

function canShowReprice(item) {
  const raw = rawSignalStatus(item);
  const action = String(item.action || item.direction || '').toLowerCase();
  return action === 'buy' && ['cancelled', 'canceled', 'partial_cancelled'].includes(raw);
}

function isSubmittedSignal(item) {
  const st = String(item.status || '').toUpperCase();
  if (st === 'SUBMITTED') return true;
  return rawSignalStatus(item) === 'submitted';
}

function isSubmittedBuy(item) {
  const action = String(item.action || item.direction || '').toLowerCase();
  return isSubmittedSignal(item) && action === 'buy';
}

function formatSubmittedDiagnostics(item) {
  const st = String(item.status || '').toUpperCase();
  const action = String(item.action || item.direction || '').toLowerCase();
  if (st !== 'SUBMITTED' && rawSignalStatus(item) !== 'submitted') return '';
  const parts = [];
  const lim = item.effective_limit_price;
  const mkt = item.last_market_price;
  if (lim != null && lim !== '') parts.push(`限价 ${Number(lim).toFixed(3)}`);
  if (mkt != null && mkt !== '') {
    parts.push(`市价参考 ${Number(mkt).toFixed(3)}`);
    if (lim != null && lim !== '' && Number(mkt) > 0) {
      const pct =
        action === 'sell'
          ? ((Number(mkt) - Number(lim)) / Number(mkt) * 100).toFixed(2)
          : ((Number(lim) - Number(mkt)) / Number(mkt) * 100).toFixed(2);
      parts.push(`${action === 'sell' ? '卖单' : '买单'}偏离 ${pct}%`);
    }
  }
  if (item.submitted_age_seconds != null && item.submitted_age_seconds !== '') {
    const s = Math.max(0, Number(item.submitted_age_seconds));
    const mm = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    parts.push(`已挂单 ${mm}分${ss}秒`);
  }
  if (item.broker_status_msg) parts.push(String(item.broker_status_msg));
  return parts.join(' · ') || '—';
}

function openSubmittedHelp(item) {
  submittedHelpItem.value = item;
  submittedHelpOpen.value = true;
}

async function openRepriceDialog(item) {
  repriceError.value = '';
  repriceReason.value = '';
  repriceOrderId.value = item.order_id || '';
  repriceDialog.value = true;
  repricePreview.value = null;
  repriceLimit.value = null;
  repriceSize.value = null;
  repriceLoading.value = true;
  try {
    const data = await tradeApi.previewTraderSignalReprice(repriceOrderId.value);
    repricePreview.value = data;
    repriceLimit.value =
      data.suggested_effective_limit_price ?? data.market_reference_price ?? null;
    repriceSize.value = data.size ?? null;
  } catch (e) {
    repriceError.value = e?.message || String(e);
    repricePreview.value = {
      success: false,
      symbol: item.symbol,
      size: item.quantity || item.size,
    };
  } finally {
    repriceLoading.value = false;
  }
}

function closeRepriceDialog() {
  repriceDialog.value = false;
  repricePreview.value = null;
  repriceSubmitting.value = false;
}

async function submitRepriceConfirm() {
  repriceError.value = '';
  const lim = Number(repriceLimit.value);
  if (!Number.isFinite(lim) || lim <= 0) {
    repriceError.value = '请输入有效限价';
    return;
  }
  const body = {
    effective_limit_price: lim,
    reason: repriceReason.value || '',
  };
  const sz = Number(repriceSize.value);
  if (Number.isFinite(sz) && sz > 0) {
    body.size = Math.floor(sz);
  }
  repriceSubmitting.value = true;
  try {
    await tradeApi.confirmTraderSignalReprice(repriceOrderId.value, body);
    closeRepriceDialog();
    await loadTrades();
  } catch (e) {
    repriceError.value = e?.message || String(e);
  } finally {
    repriceSubmitting.value = false;
  }
}

async function loadTrades() {
  try {
    loading.value = true;
    errorMessage.value = '';
    
    // 使用新的融合 API
    const params = {
      limit: 200,
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
    } else if (dateRangeType.value === 'all') {
      params.all_dates = true;
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
      } else if (dateRangeType.value === 'recent30') {
        errorMessage.value = '最近30天没有交易记录，可切换到“所有日期”查看历史记录。';
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

async function loadSummary() {
  try {
    loading.value = true;
    errorMessage.value = '';

    const params = {};
    if (dateRangeType.value === 'recent7') {
      params.days = 7;
    } else if (dateRangeType.value === 'recent30') {
      params.days = 30;
    } else if (dateRangeType.value === 'all') {
      params.all_dates = true;
    } else if (dateRangeType.value === 'range') {
      if (startDate.value) params.start_date = startDate.value;
      if (endDate.value) params.end_date = endDate.value;
    }

    const response = await tradeApi.getTradePnlSummary(params);
    summaryRows.value = response.data || [];
    totalRealizedPnl.value = response.total_realized_pnl ?? 0;
    totalUnrealizedPnl.value = response.total_unrealized_pnl ?? 0;

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
    // Load available strategies from the global strategy API
    const token = localStorage.getItem('access_token')
    const response = await fetch(`${API_BASE}/strategy/strategies`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (!response.ok) throw new Error('Failed to load strategies')
    const strategiesData = await response.json()
    
    // Extract just the strategy keys
    strategies.value = strategiesData.strategies?.map(s => s.key) || []
    
    // Add manual trading option
    if (!strategies.value.includes('manual')) {
      strategies.value.push('manual')
    }
    
    console.log('交易执行页面策略列表加载成功:', strategies.value.length, '个策略')
  } catch (error) {
    console.error('Failed to load strategies from global API, falling back to trade strategies:', error);
    
    // Fallback to original trade strategies API
    try {
      const response = await tradeApi.getTradeStrategies();
      strategies.value = response.strategies || [];
      
      // Add manual trading option
      if (!strategies.value.includes('manual')) {
        strategies.value.push('manual')
      }
    } catch (fallbackError) {
      console.error('Failed to load strategies from both APIs:', fallbackError);
      strategies.value = [];
    }
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
  }
}

function refreshData() {
  currentPage.value = 1;
  if (viewMode.value === 'summary') {
    loadSummary();
  } else {
    loadTrades();
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
    'FAILED': 'red',
    'CANCELLED': 'grey',
    'PARTIAL_CANCELLED': 'deep-orange',
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
}

// Watchers
watch([searchSymbol, selectedStrategy, statusFilter, dateRangeType, selectedDate, startDate, endDate], () => {
  currentPage.value = 1;
  if (viewMode.value === 'summary') {
    loadSummary();
  } else {
    loadTrades();
  }
});

// Lifecycle
onMounted(() => {
  loadTrades();
  loadStrategies();
  loadStrategyMetadata();
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