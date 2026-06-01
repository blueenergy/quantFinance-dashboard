<template>
  <v-container fluid class="trading-manual-panel">
    <div class="page-header">
      <div>
        <p class="eyebrow">Live Trading Monitor</p>
        <h2>实盘交易监控</h2>
        <p class="subtitle">集中查看实盘信号状态、成交回报、撤单中间态和需要人工处理的执行建议。</p>
      </div>
      <v-btn :loading="loading.active || loading.summary" color="primary" @click="refreshAll">刷新全部</v-btn>
    </div>

    <v-tabs v-model="activeTab" fixed-tabs>
      <!-- 信号状态概览 -->
      <v-tab value="summary" class="tab-text">信号状态概览</v-tab>
      <!-- 处理中订单 -->
      <v-tab value="active" class="tab-text">处理中订单</v-tab>
      <!-- 需人工处理 -->
      <v-tab value="attention" class="tab-text">需人工处理</v-tab>
      <!-- 失败信号管理 -->
      <v-tab value="failed" class="tab-text">失败信号管理</v-tab>
      <!-- 待重试信号 -->
      <v-tab value="retryPending" class="tab-text">待重试信号</v-tab>
      <!-- 手动下单 -->
      <v-tab value="manualOrder" class="tab-text">手动下单</v-tab>
    </v-tabs>

    <v-window v-model="activeTab" class="mt-4">
      <!-- 信号状态概览 -->
      <v-window-item value="summary">
        <v-row>
          <v-col 
            v-for="item in statusSummary" 
            :key="item.status"
            cols="12" 
            sm="6" 
            md="4" 
            lg="2"
          >
            <v-card 
              :class="getStatusCardClass(item.status)"
              @click="onStatusCardClick(item.status)"
              class="status-card"
            >
              <v-card-title class="text-h6">
                {{ getStatusLabel(item.status) }}
              </v-card-title>
              <v-card-text class="text-h4 font-weight-bold">
                {{ item.count }}
              </v-card-text>
              <v-card-actions>
                <v-icon :color="getStatusIconColor(item.status)">
                  {{ getStatusIcon(item.status) }}
                </v-icon>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>
      </v-window-item>

      <!-- 处理中订单 -->
      <v-window-item value="active">
        <v-card>
          <v-card-title class="d-flex justify-space-between align-center">
            <div>
              <h3>处理中订单</h3>
              <p class="text-body-2 text-medium-emphasis mb-0">
                覆盖 pending / submitted / partial_filled / cancel_requested / retry_pending 等活跃状态。
              </p>
            </div>
            <v-btn @click="refreshActiveSignals">刷新</v-btn>
          </v-card-title>

          <v-data-table
            :headers="activeSignalHeaders"
            :items="activeSignals"
            :loading="loading.active"
            :items-per-page="30"
            class="elevation-1"
          >
            <template v-slot:item.status="{ item }">
              <v-chip :color="getStatusTagColor(item.status)" label>
                {{ getStatusLabel(item.status) }}
              </v-chip>
            </template>

            <template v-slot:item.action="{ item }">
              <v-chip :color="item.action === 'buy' ? 'success' : 'error'" label>
                {{ item.action?.toUpperCase?.() || item.action }}
              </v-chip>
            </template>

            <template v-slot:item.symbol="{ item }">
              <div class="symbol-cell">
                <strong>{{ item.name || item.stock_name || item.symbol }}</strong>
                <span v-if="item.name || item.stock_name">{{ item.symbol }}</span>
              </div>
            </template>

            <template v-slot:item.filled_qty="{ item }">
              {{ item.filled_qty ?? 0 }} / {{ item.size ?? '-' }}
            </template>

            <template v-slot:item.remaining_size="{ item }">
              {{ remainingSize(item) }}
            </template>

            <template v-slot:item.effective_limit_price="{ item }">
              {{ formatPrice(item.effective_limit_price || item.price) }}
            </template>

            <template v-slot:item.age="{ item }">
              <span :class="{ 'text-error font-weight-bold': isStaleSignal(item), 'text-warning': isAttentionSignal(item) && !isStaleSignal(item) }">
                {{ formatAge(item.age_seconds) }}
              </span>
            </template>

            <template v-slot:item.diagnostic="{ item }">
              <div class="diagnostic-cell">
                <v-chip v-if="isStaleSignal(item)" color="error" size="small" label>超时</v-chip>
                <v-chip v-else-if="isAttentionSignal(item)" color="warning" size="small" label>关注</v-chip>
                <span>{{ diagnosticText(item) }}</span>
              </div>
            </template>

            <template v-slot:item.actions="{ item }">
              <v-btn size="small" color="info" @click="viewSignalDetail(item)" class="mr-2">详情</v-btn>
              <v-btn
                v-if="item.chase_suggestion"
                size="small"
                color="warning"
                @click="prefillManualOrderFromSignal(item)"
              >
                按建议补单
              </v-btn>
            </template>
          </v-data-table>
        </v-card>
      </v-window-item>

      <!-- 需人工处理 -->
      <v-window-item value="attention">
        <v-card>
          <v-card-title class="d-flex justify-space-between align-center">
            <div>
              <h3>需人工处理</h3>
              <p class="text-body-2 text-medium-emphasis mb-0">
                包含超时 submitted、cancel_requested、partial_cancelled、failed/rejected 以及待人工判断的追单建议。
              </p>
            </div>
            <v-btn @click="refreshActiveSignals">刷新</v-btn>
          </v-card-title>

          <v-data-table
            :headers="activeSignalHeaders"
            :items="attentionSignals"
            :loading="loading.active"
            :items-per-page="30"
            class="elevation-1"
          >
            <template v-slot:item.status="{ item }">
              <v-chip :color="getStatusTagColor(item.status)" label>
                {{ getStatusLabel(item.status) }}
              </v-chip>
            </template>
            <template v-slot:item.action="{ item }">
              <v-chip :color="item.action === 'buy' ? 'success' : 'error'" label>
                {{ item.action?.toUpperCase?.() || item.action }}
              </v-chip>
            </template>
            <template v-slot:item.symbol="{ item }">
              <div class="symbol-cell">
                <strong>{{ item.name || item.stock_name || item.symbol }}</strong>
                <span v-if="item.name || item.stock_name">{{ item.symbol }}</span>
              </div>
            </template>
            <template v-slot:item.filled_qty="{ item }">
              {{ item.filled_qty ?? 0 }} / {{ item.size ?? '-' }}
            </template>
            <template v-slot:item.remaining_size="{ item }">
              {{ remainingSize(item) }}
            </template>
            <template v-slot:item.effective_limit_price="{ item }">
              {{ formatPrice(item.effective_limit_price || item.price) }}
            </template>
            <template v-slot:item.age="{ item }">
              <span :class="{ 'text-error font-weight-bold': isStaleSignal(item), 'text-warning': !isStaleSignal(item) }">
                {{ formatAge(item.age_seconds) }}
              </span>
            </template>
            <template v-slot:item.diagnostic="{ item }">
              <div class="diagnostic-cell">
                <v-chip :color="isStaleSignal(item) ? 'error' : 'warning'" size="small" label>
                  {{ isStaleSignal(item) ? '超时' : '关注' }}
                </v-chip>
                <span>{{ diagnosticText(item) }}</span>
              </div>
            </template>
            <template v-slot:item.actions="{ item }">
              <v-btn size="small" color="info" @click="viewSignalDetail(item)" class="mr-2">详情</v-btn>
              <v-btn
                v-if="item.chase_suggestion"
                size="small"
                color="warning"
                @click="prefillManualOrderFromSignal(item)"
              >
                按建议补单
              </v-btn>
            </template>
          </v-data-table>
        </v-card>
      </v-window-item>

      <!-- 失败信号管理 -->
      <v-window-item value="failed">
        <v-card>
          <v-card-title class="d-flex justify-space-between align-center">
            <h3>失败的交易信号</h3>
            <div>
              <v-btn @click="refreshFailedSignals" class="mr-2">刷新</v-btn>
              <v-btn color="warning" @click="batchRetry('failed')">批量重试失败信号</v-btn>
            </div>
          </v-card-title>
          
          <v-data-table
            :headers="failedHeaders"
            :items="failedSignals"
            :loading="loading.failed"
            :items-per-page="failedPageSize"
            class="elevation-1"
          >
            <template v-slot:item.action="{ item }">
              <v-chip 
                :color="item.action === 'buy' ? 'success' : 'error'"
                label
              >
                {{ item.action.toUpperCase() }}
              </v-chip>
            </template>
            
            <template v-slot:item.price="{ item }">
              {{ item.price ? item.price : '市价' }}
            </template>
            
            <template v-slot:item.timestamp="{ item }">
              {{ formatTimestamp(item.timestamp) }}
            </template>
            
            <template v-slot:item.actions="{ item }">
              <v-btn 
                size="small" 
                color="primary" 
                @click="retrySignal(item.order_id)"
                class="mr-2"
              >
                重试
              </v-btn>
              <v-btn 
                size="small" 
                color="info" 
                @click="viewSignalDetail(item)"
              >
                详情
              </v-btn>
            </template>
          </v-data-table>
          
          <v-pagination
            v-model="failedPage"
            :length="Math.ceil(failedTotal / failedPageSize)"
            @update:modelValue="handleFailedPageChange"
            class="pa-4"
          ></v-pagination>
        </v-card>
      </v-window-item>

      <!-- 待重试信号 -->
      <v-window-item value="retryPending">
        <v-card>
          <v-card-title class="d-flex justify-space-between align-center">
            <h3>待重试的交易信号</h3>
            <div>
              <v-btn @click="refreshRetryPendingSignals" class="mr-2">刷新</v-btn>
              <v-btn color="warning" @click="batchRetry('retry_pending')">批量重试</v-btn>
            </div>
          </v-card-title>
          
          <v-data-table
            :headers="retryPendingHeaders"
            :items="retryPendingSignals"
            :loading="loading.retryPending"
            class="elevation-1"
          >
            <template v-slot:item.action="{ item }">
              <v-chip 
                :color="item.action === 'buy' ? 'success' : 'error'"
                label
              >
                {{ item.action.toUpperCase() }}
              </v-chip>
            </template>
            
            <template v-slot:item.timestamp="{ item }">
              {{ formatTimestamp(item.timestamp) }}
            </template>
            
            <template v-slot:item.actions="{ item }">
              <v-btn 
                size="small" 
                color="primary" 
                @click="retrySignal(item.order_id)"
                class="mr-2"
              >
                立即重试
              </v-btn>
              <v-btn 
                size="small" 
                color="info" 
                @click="viewSignalDetail(item)"
              >
                详情
              </v-btn>
            </template>
          </v-data-table>
        </v-card>
      </v-window-item>

      <!-- 手动下单 -->
      <v-window-item value="manualOrder">
        <v-card>
          <v-card-title>手动下单</v-card-title>
          <v-card-text>
            <v-form ref="manualOrderFormRef" @submit.prevent="submitManualOrder">
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="manualOrderForm.symbol"
                    label="股票代码 *"
                    placeholder="请输入股票代码，如: 002050.SZ"
                    required
                  ></v-text-field>
                </v-col>
                
                <v-col cols="12" md="6">
                  <v-select
                    v-model="manualOrderForm.action"
                    :items="[
                      { title: '买入', value: 'buy' },
                      { title: '卖出', value: 'sell' }
                    ]"
                    label="操作类型 *"
                    required
                  ></v-select>
                </v-col>
                
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="manualOrderForm.size"
                    label="交易数量 *"
                    type="number"
                    :min="100"
                    :step="100"
                    placeholder="请输入数量，通常为100的倍数"
                    required
                  ></v-text-field>
                </v-col>
                
                <v-col cols="12" md="6">
                  <v-select
                    v-model="manualOrderForm.priceType"
                    :items="[
                      { title: '市价', value: 'market' },
                      { title: '限价', value: 'limit' }
                    ]"
                    label="价格类型"
                  ></v-select>
                </v-col>
                
                <v-col 
                  v-if="manualOrderForm.priceType === 'limit'" 
                  cols="12" 
                  md="6"
                >
                  <v-text-field
                    v-model="manualOrderForm.price"
                    label="限价价格"
                    type="number"
                    :step="0.01"
                    placeholder="请输入限价"
                  ></v-text-field>
                </v-col>
                
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="manualOrderForm.strategy"
                    label="策略名称 *"
                    placeholder="请输入策略名称，如: manual"
                    required
                  ></v-text-field>
                </v-col>
              </v-row>
              
              <v-btn 
                type="submit"
                color="primary" 
                :loading="manualOrderSubmitting"
                :disabled="manualOrderSubmitting"
              >
                {{ manualOrderSubmitting ? '提交中...' : '提交订单' }}
              </v-btn>
              <v-btn @click="resetManualOrderForm" class="ml-2">重置</v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-window-item>
    </v-window>

    <!-- 信号详情弹窗 -->
    <v-dialog v-model="signalDetailVisible" max-width="760px">
      <v-card v-if="selectedSignal">
        <v-card-title>信号详情</v-card-title>
        <v-card-text>
          <v-list>
            <v-list-item>
              <v-list-item-title>订单ID</v-list-item-title>
              <v-list-item-subtitle>{{ selectedSignal.order_id }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>股票代码</v-list-item-title>
              <v-list-item-subtitle>{{ selectedSignal.symbol }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>操作</v-list-item-title>
              <v-list-item-subtitle>
                <v-chip 
                  :color="selectedSignal.action === 'buy' ? 'success' : 'error'"
                  label
                >
                  {{ selectedSignal.action.toUpperCase() }}
                </v-chip>
              </v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>数量</v-list-item-title>
              <v-list-item-subtitle>{{ selectedSignal.size }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>价格</v-list-item-title>
              <v-list-item-subtitle>
                {{ selectedSignal.price ? selectedSignal.price : '市价' }}
              </v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>保护限价 / 成交均价</v-list-item-title>
              <v-list-item-subtitle>
                {{ formatPrice(selectedSignal.effective_limit_price || selectedSignal.price) }} /
                {{ formatPrice(selectedSignal.avg_price) }}
              </v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>QMT订单 / Broker订单</v-list-item-title>
              <v-list-item-subtitle>{{ selectedSignal.qmt_order_id || selectedSignal.broker_order_id || '-' }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>已成 / 剩余</v-list-item-title>
              <v-list-item-subtitle>{{ selectedSignal.filled_qty ?? 0 }} / {{ remainingSize(selectedSignal) }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>策略</v-list-item-title>
              <v-list-item-subtitle>{{ selectedSignal.strategy }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>状态</v-list-item-title>
              <v-list-item-subtitle>
                <v-chip 
                  :color="getStatusTagColor(selectedSignal.status)"
                  label
                >
                  {{ getStatusLabel(selectedSignal.status) }}
                </v-chip>
              </v-list-item-subtitle>
            </v-list-item>
            <v-list-item v-if="selectedSignal.retry_count !== undefined">
              <v-list-item-title>重试次数</v-list-item-title>
              <v-list-item-subtitle>{{ selectedSignal.retry_count || 0 }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item v-if="selectedSignal.last_error">
              <v-list-item-title>错误信息</v-list-item-title>
              <v-list-item-subtitle>{{ selectedSignal.last_error }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item v-if="selectedSignal.cancel_requested_at">
              <v-list-item-title>撤单请求时间</v-list-item-title>
              <v-list-item-subtitle>{{ formatTimestamp(selectedSignal.cancel_requested_at) }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item v-if="selectedSignal.chase_suggestion">
              <v-list-item-title>追单建议</v-list-item-title>
              <v-list-item-subtitle>
                剩余 {{ selectedSignal.chase_suggestion.remaining_size ?? '-' }} 股，
                建议限价 {{ formatPrice(selectedSignal.chase_suggestion.suggested_limit_price) }}，
                滑点 {{ selectedSignal.chase_suggestion.suggested_max_slippage_bps ?? '-' }} bps，
                {{ selectedSignal.chase_suggestion.auto_resubmit ? '允许自动重挂' : '仅人工审查' }}
              </v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>时间</v-list-item-title>
              <v-list-item-subtitle>{{ formatTimestamp(selectedSignal.timestamp) }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="closeSignalDetail">关闭</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { computed, ref, reactive, onMounted } from 'vue'

// API base URL
const API_BASE = import.meta.env.VITE_API_BASE || "/api";

// Authentication headers
function authHeaders() {
  const token = localStorage.getItem("access_token");
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// 响应式数据
const activeTab = ref('summary')
const loading = reactive({
  summary: false,
  active: false,
  failed: false,
  retryPending: false
})

// 表格头定义
const failedHeaders = ref([
  { title: '订单ID', key: 'order_id', width: 180 },
  { title: '股票代码', key: 'symbol', width: 120 },
  { title: '操作', key: 'action', width: 80 },
  { title: '数量', key: 'size', width: 80 },
  { title: '价格', key: 'price', width: 100 },
  { title: '策略', key: 'strategy', width: 120 },
  { title: '错误信息', key: 'last_error' },
  { title: '时间', key: 'timestamp', width: 160 },
  { title: '操作', key: 'actions', width: 150, sortable: false }
])

const retryPendingHeaders = ref([
  { title: '订单ID', key: 'order_id', width: 180 },
  { title: '股票代码', key: 'symbol', width: 120 },
  { title: '操作', key: 'action', width: 80 },
  { title: '数量', key: 'size', width: 80 },
  { title: '重试次数', key: 'retry_count', width: 100 },
  { title: '错误信息', key: 'last_error' },
  { title: '时间', key: 'timestamp', width: 160 },
  { title: '操作', key: 'actions', width: 150, sortable: false }
])

const activeSignalHeaders = ref([
  { title: '状态', key: 'status', width: 120 },
  { title: '股票', key: 'symbol', width: 150 },
  { title: '方向', key: 'action', width: 80 },
  { title: '成交/总数', key: 'filled_qty', width: 110 },
  { title: '剩余', key: 'remaining_size', width: 90 },
  { title: '保护价', key: 'effective_limit_price', width: 100 },
  { title: 'QMT订单', key: 'qmt_order_id', width: 140 },
  { title: '等待', key: 'age', width: 100 },
  { title: '诊断', key: 'diagnostic', minWidth: 240 },
  { title: '操作', key: 'actions', width: 180, sortable: false }
])

// 状态概览
const statusSummary = ref([])
const activeSignals = ref([])
const failedSignals = ref([])
const retryPendingSignals = ref([])
const attentionSignals = computed(() => activeSignals.value.filter(isAttentionSignal))

// 分页
const failedPage = ref(1)
const failedPageSize = ref(20)
const failedTotal = ref(0)

// 手动下单表单
const manualOrderFormRef = ref()
const manualOrderSubmitting = ref(false)
const manualOrderForm = reactive({
  symbol: '',
  action: 'buy',
  size: 100,
  priceType: 'market', // 'market' or 'limit'
  price: null,
  strategy: 'manual'
})

// 信号详情
const signalDetailVisible = ref(false)
const selectedSignal = ref(null)

// API 方法
const get = async (endpoint, params = {}) => {
  const queryParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      queryParams.append(key, params[key]);
    }
  });
  
  const queryString = queryParams.toString();
  const url = queryString ? `${API_BASE}${endpoint}?${queryString}` : `${API_BASE}${endpoint}`;
  
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed: ${res.status}`);
  }
  return res.json();
};

const post = async (endpoint, data = {}) => {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed: ${res.status}`);
  }
  return res.json();
};

// 搜索股票
const searchStocks = async (query) => {
  if (!query || query.length < 1) {
    searchResults.value = []
    return
  }
  
  searchLoading.value = true
  try {
    const response = await get('/stock/search', { q: query })
    if (response.success) {
      // 格式化结果，添加显示文本
      searchResults.value = response.data.map(stock => ({
        ...stock,
        displayText: `${stock.symbol} ${stock.name || ''}`
      }))
    } else {
      searchResults.value = []
    }
  } catch (error) {
    console.error('搜索股票失败:', error)
    searchResults.value = []
  } finally {
    searchLoading.value = false
  }
}

// 方法
const fetchStatusSummary = async () => {
  loading.summary = true
  try {
    const response = await get('/trade-signals/status-summary')
    if (response.success) {
      // 转换为数组格式用于显示
      const summaryArray = Object.entries(response.summary).map(([status, count]) => ({
        status,
        count,
        label: getStatusLabel(status)
      }))
      statusSummary.value = summaryArray
    }
  } catch (error) {
    console.error('获取状态概览失败:', error)
    // 可以添加用户友好的错误提示
  } finally {
    loading.summary = false
  }
}

const fetchActiveSignals = async () => {
  loading.active = true
  try {
    const response = await get('/trader/live-signals', { limit: 200 })
    if (response.success) {
      activeSignals.value = (response.data || [])
        .map(enrichSignal)
        .filter(signal => isActiveOrAttentionStatus(signal.status))
        .sort((a, b) => {
          const aRank = isStaleSignal(a) ? 0 : isAttentionSignal(a) ? 1 : 2
          const bRank = isStaleSignal(b) ? 0 : isAttentionSignal(b) ? 1 : 2
          if (aRank !== bRank) return aRank - bRank
          return (b.age_seconds || 0) - (a.age_seconds || 0)
        })
    }
  } catch (error) {
    console.error('获取实盘信号失败:', error)
  } finally {
    loading.active = false
  }
}

const fetchFailedSignals = async (page = 1, pageSize = 20) => {
  loading.failed = true
  try {
    const response = await get('/trade-signals/failed', {
      limit: pageSize,
      skip: (page - 1) * pageSize
    })
    if (response.success) {
      failedSignals.value = response.data
      failedTotal.value = response.count
    }
  } catch (error) {
    console.error('获取失败信号失败:', error)
  } finally {
    loading.failed = false
  }
}

const fetchRetryPendingSignals = async () => {
  loading.retryPending = true
  try {
    const response = await get('/trade-signals/retry-pending', { limit: 100 })
    if (response.success) {
      retryPendingSignals.value = response.data
    }
  } catch (error) {
    console.error('获取待重试信号失败:', error)
  } finally {
    loading.retryPending = false
  }
}

const retrySignal = async (order_id) => {
  if (confirm(`确定要重试订单 ${order_id} 吗？`)) {
    try {
      const response = await post(`/trade-signals/manual-retry/${order_id}`)
      if (response.success) {
        alert(response.message || '重试成功')
        // 刷新相关数据
        if (activeTab.value === 'failed') {
          fetchFailedSignals(failedPage.value, failedPageSize.value)
        } else if (activeTab.value === 'retryPending') {
          fetchRetryPendingSignals()
        }
        fetchActiveSignals()
        fetchStatusSummary() // 更新概览
      }
    } catch (error) {
      alert('重试失败: ' + error.message)
    }
  }
}

const batchRetry = async (statusType) => {
  if (confirm(`确定要批量重试状态为 ${getStatusLabel(statusType)} 的信号吗？`)) {
    try {
      const response = await post('/trade-signals/batch-retry', {
        status_filter: statusType,
        limit: 50
      })
      
      if (response.success) {
        alert(response.message || '批量重试成功')
        // 刷新数据
        fetchFailedSignals(failedPage.value, failedPageSize.value)
        fetchRetryPendingSignals()
        fetchActiveSignals()
        fetchStatusSummary() // 更新概览
      }
    } catch (error) {
      alert('批量重试失败: ' + error.message)
    }
  }
}

const submitManualOrder = async () => {
  try {
    const payload = {
      symbol: manualOrderForm.symbol,
      action: manualOrderForm.action,
      size: parseInt(manualOrderForm.size),
      strategy: manualOrderForm.strategy
    }
    
    // 如果是限价单，添加价格
    if (manualOrderForm.priceType === 'limit' && manualOrderForm.price) {
      payload.price = parseFloat(manualOrderForm.price)
    }
    
    manualOrderSubmitting.value = true
    const response = await post('/trade-signals/manual-create', payload)
    if (response.success) {
      alert('手动订单创建成功: ' + response.order_id)
      resetManualOrderForm()
      fetchActiveSignals()
      fetchStatusSummary() // 更新概览
    }
  } catch (error) {
    alert('创建订单失败: ' + error.message)
  } finally {
    manualOrderSubmitting.value = false
  }
}

const resetManualOrderForm = () => {
  manualOrderForm.symbol = ''
  manualOrderForm.action = 'buy'
  manualOrderForm.size = 100
  manualOrderForm.priceType = 'market'
  manualOrderForm.price = null
  manualOrderForm.strategy = 'manual'
}

const viewSignalDetail = (signal) => {
  selectedSignal.value = signal
  signalDetailVisible.value = true
}

const closeSignalDetail = () => {
  signalDetailVisible.value = false
  selectedSignal.value = null
}

const refreshFailedSignals = () => {
  fetchFailedSignals(failedPage.value, failedPageSize.value)
}

const refreshRetryPendingSignals = () => {
  fetchRetryPendingSignals()
}

const refreshActiveSignals = () => {
  fetchActiveSignals()
}

const refreshAll = () => {
  fetchStatusSummary()
  fetchActiveSignals()
  fetchFailedSignals(failedPage.value, failedPageSize.value)
  fetchRetryPendingSignals()
}

const handleFailedPageChange = (page) => {
  fetchFailedSignals(page, failedPageSize.value)
}

const onStatusCardClick = (status) => {
  // 点击状态卡片时，切换到对应的标签页
  if (status === 'failed' || status === 'rejected') {
    activeTab.value = 'failed'
  } else if (status === 'retry_pending') {
    activeTab.value = 'retryPending'
  } else if (isActiveOrAttentionStatus(status)) {
    activeTab.value = 'active'
  }
}

const prefillManualOrderFromSignal = (signal) => {
  const suggestion = signal.chase_suggestion || {}
  manualOrderForm.symbol = signal.symbol || ''
  manualOrderForm.action = signal.action || 'sell'
  manualOrderForm.size = suggestion.remaining_size || remainingSize(signal) || signal.size || 100
  manualOrderForm.priceType = suggestion.suggested_limit_price ? 'limit' : 'market'
  manualOrderForm.price = suggestion.suggested_limit_price || null
  manualOrderForm.strategy = signal.strategy || signal.strategy_template_id || 'manual'
  activeTab.value = 'manualOrder'
  closeSignalDetail()
}

// 辅助函数
const getStatusLabel = (status) => {
  const labels = {
    'pending': '待执行',
    'retry_pending': '待重试',
    'submitted': '已提交',
    'filled': '已成交',
    'partial_filled': '部分成交',
    'cancel_requested': '撤单中',
    'partial_cancelled': '部成部撤',
    'cancelled': '已撤单',
    'executed': '已执行',
    'rejected': '已拒绝',
    'failed': '已失败'
  }
  return labels[status] || status
}

const getStatusIcon = (status) => {
  const icons = {
    'pending': 'mdi-timer-sand',
    'retry_pending': 'mdi-refresh',
    'submitted': 'mdi-paperclip',
    'filled': 'mdi-check-circle',
    'partial_filled': 'mdi-minus-circle',
    'cancel_requested': 'mdi-cancel',
    'partial_cancelled': 'mdi-alert-circle',
    'cancelled': 'mdi-cancel',
    'rejected': 'mdi-close-circle',
    'failed': 'mdi-alert'
  }
  return icons[status] || 'mdi-help-circle'
}

const getStatusIconColor = (status) => {
  const colors = {
    'pending': 'info',
    'retry_pending': 'warning',
    'submitted': 'primary',
    'filled': 'success',
    'partial_filled': 'warning',
    'cancel_requested': 'warning',
    'partial_cancelled': 'error',
    'cancelled': 'grey',
    'rejected': 'error',
    'failed': 'error'
  }
  return colors[status] || 'grey'
}

const getStatusTagColor = (status) => {
  const colors = {
    'pending': 'info',
    'retry_pending': 'warning',
    'submitted': 'primary',
    'filled': 'success',
    'partial_filled': 'warning',
    'cancel_requested': 'warning',
    'partial_cancelled': 'error',
    'cancelled': 'grey',
    'rejected': 'error',
    'failed': 'error'
  }
  return colors[status] || 'grey'
}

const getStatusCardClass = (status) => {
  const baseClass = 'status-card'
  const statusClasses = {
    'failed': 'bg-red-lighten-4',
    'rejected': 'bg-orange-lighten-4',
    'retry_pending': 'bg-orange-lighten-4',
    'cancel_requested': 'bg-orange-lighten-4',
    'partial_cancelled': 'bg-red-lighten-4',
    'pending': 'bg-blue-lighten-4',
    'submitted': 'bg-blue-lighten-4',
    'filled': 'bg-green-lighten-4'
  }
  return [baseClass, statusClasses[status] || 'bg-grey-lighten-4']
}

const formatTimestamp = (timestamp) => {
  if (!timestamp) return ''
  return new Date(timestamp * 1000).toLocaleString('zh-CN')
}

const formatPrice = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number.toFixed(2) : '-'
}

const nowSeconds = () => Math.floor(Date.now() / 1000)

const enrichSignal = (signal) => {
  const baseTime = Number(signal.updated_at || signal.submitted_at || signal.cancel_requested_at || signal.timestamp || signal.created_at || 0)
  return {
    ...signal,
    age_seconds: baseTime ? Math.max(0, nowSeconds() - baseTime) : 0,
  }
}

const remainingSize = (signal) => {
  const explicit = Number(signal.remaining_size)
  if (Number.isFinite(explicit)) return Math.max(0, explicit)
  const size = Number(signal.size || 0)
  const filled = Number(signal.filled_qty || signal.filled_size || 0)
  return Math.max(0, size - filled)
}

const isActiveOrAttentionStatus = (status) => [
  'pending',
  'retry_pending',
  'submitted',
  'partial_filled',
  'cancel_requested',
  'partial_cancelled',
  'failed',
  'rejected',
].includes(status)

const isStaleSignal = (signal) => {
  const age = Number(signal.age_seconds || 0)
  if (signal.status === 'submitted') return age >= 90
  if (signal.status === 'cancel_requested') return age >= 60
  if (signal.status === 'partial_filled') return age >= 180 && remainingSize(signal) > 0
  return false
}

const isAttentionSignal = (signal) => {
  if (!signal) return false
  if (isStaleSignal(signal)) return true
  if (['failed', 'rejected', 'partial_cancelled', 'cancel_requested'].includes(signal.status)) return true
  if (signal.status === 'partial_filled' && remainingSize(signal) > 0) return true
  if (signal.status === 'retry_pending') return true
  return Boolean(signal.chase_suggestion)
}

const diagnosticText = (signal) => {
  if (signal.chase_suggestion) {
    const suggestion = signal.chase_suggestion
    return `剩余 ${suggestion.remaining_size ?? remainingSize(signal)} 股，建议限价 ${formatPrice(suggestion.suggested_limit_price)}`
  }
  if (signal.last_error) return signal.last_error
  if (signal.status === 'submitted') return '等待券商成交或回报'
  if (signal.status === 'cancel_requested') return '已请求撤单，等待券商确认'
  if (signal.status === 'partial_filled') return `部分成交，剩余 ${remainingSize(signal)} 股`
  if (signal.status === 'retry_pending') return '等待重试条件满足'
  return '-'
}

const formatAge = (seconds) => {
  const value = Number(seconds || 0)
  if (value < 60) return `${value}s`
  if (value < 3600) return `${Math.floor(value / 60)}m ${value % 60}s`
  return `${Math.floor(value / 3600)}h ${Math.floor((value % 3600) / 60)}m`
}

// 生命周期
onMounted(() => {
  fetchStatusSummary()
  fetchActiveSignals()
  fetchFailedSignals()
  fetchRetryPendingSignals()
})
</script>

<style scoped>
.trading-manual-panel {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 16px;
}

.page-header h2 {
  margin: 0 0 4px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #607d8b;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.subtitle {
  margin: 0;
  color: #607d8b;
}

.symbol-cell {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
}

.symbol-cell span {
  color: #78909c;
  font-size: 12px;
}

.diagnostic-cell {
  display: flex;
  gap: 8px;
  align-items: center;
  white-space: normal;
}

.status-card {
  cursor: pointer;
  transition: all 0.3s;
  border-radius: 8px;
  overflow: hidden;
}

.status-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

/* Ensure tab text is visible */
:deep(.v-tab) {
  color: #fff !important; /* White text for better visibility */
}

:deep(.v-tab--selected) {
  color: #fff !important; /* Keep white text for selected tab */
}

/* Override potential background issues */
.tab-text {
  color: #fff !important;
}

:deep(.v-tab.v-tab--selected .tab-text) {
  color: #fff !important;
}
</style>