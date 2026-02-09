<template>
  <v-dialog v-model="dialogVisible" max-width="500px" persistent>
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center">
        <span>{{ isEditing ? '修改委托' : (isSell ? '卖出' : '买入') }}</span>
        <v-btn icon size="small" variant="text" @click="close">
          ✕
        </v-btn>
      </v-card-title>

      <hr class="divider" />

      <v-card-text>
        <!-- 买卖切换（放在最前面） -->
        <v-btn-toggle
          v-model="form.action"
          mandatory
          class="mb-4"
          color="primary"
          divided
          @update:model-value="onActionChange"
        >
          <v-btn value="buy" :color="form.action === 'buy' ? 'success' : ''">
            买入
          </v-btn>
          <v-btn value="sell" :color="form.action === 'sell' ? 'error' : ''">
            卖出
          </v-btn>
        </v-btn-toggle>

        <!-- 买入：手动输入股票代码 -->
        <!-- 买入：股票搜索与自动补全 -->
        <!-- 买入：股票搜索与自动补全 (自定义实现) -->
        <!-- 买入：股票搜索与自动补全 (自定义实现) -->
        <!-- 买入：股票搜索与自动补全 (自定义实现) -->
        <div v-if="form.action === 'buy'">
          <v-text-field
            id="stock-search-input"
            v-model="form.symbol"
            label="股票代码/名称/拼音"
            placeholder="如: 000001, 平安银行, PAYH"
            variant="outlined"
            density="compact"
            class="mb-3"
            :loading="isSearchingStock"
            :rules="[v => !!v || '请输入股票代码']"
            hint="输入2位以上自动搜索，6位数字自动补全"
            persistent-hint
            clearable
            @update:model-value="handleStockInput"
            @focus="showStockMenu = !!stockSearchResults.length"
          />

          <v-menu
            v-model="showStockMenu"
            activator="#stock-search-input"
            :close-on-content-click="false"
            location="bottom start"
            :open-on-click="false"
            :open-on-focus="false"
            :offset="5"
          >
            <v-list v-if="stockSearchResults.length" density="compact" max-height="300">
              <v-list-item
                v-for="item in stockSearchResults"
                :key="item.value"
                :title="item.title"
                :subtitle="item.value"
                @click="selectStock(item)"
              >
                <template #prepend>
                  <v-chip size="x-small" label class="mr-2">{{ item.value.split('.')[1] || 'Unknown' }}</v-chip>
                </template>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>
        
        <!-- 卖出：从持仓中选择（已预填时显示只读） -->
        <v-select
          v-else-if="form.action === 'sell' && !prefillSymbol"
          v-model="selectedPosition"
          :items="positionOptions"
          label="选择持仓股票"
          variant="outlined"
          density="compact"
          class="mb-3"
          item-title="label"
          item-value="value"
          return-object
          :rules="[v => !!v || '请选择股票']"
        >
          <template #item="{ item, props }">
            <v-list-item v-bind="props">
              <template #subtitle>
                可卖: {{ item.raw.availableQty }} 股 | 现价: ¥{{ item.raw.currentPrice }}
              </template>
            </v-list-item>
          </template>
        </v-select>

        <!-- 预填股票显示（从持仓表格点击卖出） -->
        <v-text-field
          v-else-if="form.action === 'sell' && prefillSymbol"
          :model-value="`${stockName} (${form.symbol})`"
          label="股票"
          variant="outlined"
          density="compact"
          class="mb-3"
          readonly
          disabled
        />

        <!-- 数量输入 -->
        <v-text-field
          v-model.number="form.size"
          label="数量 (股)"
          type="number"
          variant="outlined"
          density="compact"
          class="mb-2"
          :rules="sizeRules"
          :hint="sizeHint"
          persistent-hint
        />

        <!-- 卖出快捷数量按钮 -->
        <div v-if="form.action === 'sell' && availableQty > 0" class="d-flex gap-2 mb-3 flex-wrap">
          <v-btn size="x-small" variant="tonal" @click="setQuickSell(1)">全部</v-btn>
          <v-btn size="x-small" variant="tonal" @click="setQuickSell(2)">1/2</v-btn>
          <v-btn size="x-small" variant="tonal" @click="setQuickSell(3)">1/3</v-btn>
          <v-btn size="x-small" variant="tonal" @click="setQuickSell(4)">1/4</v-btn>
          <v-btn size="x-small" variant="tonal" @click="setQuickSell(5)">1/5</v-btn>
        </div>

        <!-- 委托类型切换 -->
        <v-btn-toggle
          v-model="priceType"
          mandatory
          class="mb-3"
          color="primary"
          divided
          density="compact"
        >
          <v-btn value="market" size="small">市价</v-btn>
          <v-btn value="limit" size="small">限价</v-btn>
        </v-btn-toggle>

        <!-- 限价输入（仅限价时显示） -->
        <v-text-field
          v-if="priceType === 'limit'"
          v-model.number="form.price"
          label="委托价格 (元)"
          type="number"
          variant="outlined"
          density="compact"
          class="mb-3"
          :placeholder="currentPrice ? `参考现价 ${currentPrice}` : '输入委托价格'"
          step="0.01"
          min="0"
          :rules="[v => !!v || '请输入价格', v => v > 0 || '价格必须大于0']"
        />

        <!-- 预估金额（仅当有现价或限价时显示） -->
        <v-card v-if="currentPrice > 0" variant="tonal" class="mb-3">
          <v-card-text class="py-2">
            <div class="d-flex justify-space-between">
              <span>预估金额</span>
              <span class="text-h6 font-weight-bold">
                ¥ {{ formatNumber(estimatedAmount) }}
              </span>
            </div>
            <div v-if="form.action === 'buy' && availableCash" class="text-caption text-grey">
              可用资金: ¥ {{ formatNumber(availableCash) }}
            </div>
          </v-card-text>
        </v-card>

        <!-- 错误提示 -->
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-3">
          {{ error }}
        </v-alert>
      </v-card-text>

      <hr class="divider" />

      <v-card-actions>
        <v-btn variant="text" @click="close">取消</v-btn>
        <v-spacer />
        <v-btn
          :color="form.action === 'buy' ? 'success' : 'error'"
          variant="flat"
          :loading="loading"
          :disabled="!isValid"
          @click="confirmOrder"
        >
          {{ form.action === 'buy' ? '确认买入' : '确认卖出' }}
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- 确认对话框 -->
    <v-dialog v-model="confirmDialog" max-width="400px">
      <v-card>
        <v-card-title>确认委托</v-card-title>
        <v-card-text>
          <p>您确定要以下委托吗？</p>
          <v-table density="compact" class="mt-2">
            <tbody>
              <tr>
                <td>股票</td>
                <td class="font-weight-bold">{{ stockName }} ({{ form.symbol }})</td>
              </tr>
              <tr>
                <td>操作</td>
                <td :class="form.action === 'buy' ? 'text-success' : 'text-error'" class="font-weight-bold">
                  {{ form.action === 'buy' ? '买入' : '卖出' }}
                </td>
              </tr>
              <tr>
                <td>数量</td>
                <td class="font-weight-bold">{{ form.size }} 股</td>
              </tr>
              <tr>
                <td>委托方式</td>
                <td class="font-weight-bold">
                  {{ priceType === 'market' ? '市价委托' : `限价 ¥${form.price}` }}
                </td>
              </tr>
              <tr v-if="currentPrice > 0 || (priceType === 'limit' && form.price > 0)">
                <td>预估金额</td>
                <td class="font-weight-bold">¥ {{ formatNumber(estimatedAmount) }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="confirmDialog = false">取消</v-btn>
          <v-spacer />
          <v-btn
            :color="form.action === 'buy' ? 'success' : 'error'"
            variant="flat"
            :loading="loading"
            @click="submitOrder"
          >
            确认
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { createManualSignal } from '../api/trading'
import { searchStocks } from '../api/stock'

const props = defineProps({
  modelValue: Boolean,
  prefillSymbol: String,
  prefillName: String,
  prefillAction: String,
  prefillAvailableQty: Number,
  prefillCurrentPrice: Number,
  availableCash: Number,
  positions: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue', 'success'])

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const form = ref({
  symbol: '',
  action: 'buy',
  size: 100,
  price: null // 虽然移除了输入框，但在逻辑中可能还需要用到，或者在提交时处理
})

const loading = ref(false)
const error = ref('')
const confirmDialog = ref(false)
const selectedPosition = ref(null)
const priceType = ref('market')  // 'market' | 'limit'



// 持仓下拉选项
const positionOptions = computed(() => {
  return props.positions
    .filter(p => (p.raw?.available_qty || 0) > 0)
    .map(p => ({
      label: `${p.raw?.stock_name || p.raw?.symbol} (${p.raw?.symbol})`,
      value: p.raw?.symbol,
      availableQty: p.raw?.available_qty || 0,
      currentPrice: p.raw?.current_price || 0,
      name: p.raw?.stock_name || ''
    }))
})

// 切换买卖时重置（但保留已预填的股票代码）
function onActionChange() {
  // 如果是从持仓表格进入的（有prefillSymbol），切换时保留股票代码
  if (!props.prefillSymbol) {
    form.value.symbol = ''
  }
  form.value.size = form.value.action === 'sell' ? 0 : 100
  selectedPosition.value = null
}

// 监听持仓选择，同步到 form
watch(selectedPosition, (pos) => {
  if (pos) {
    form.value.symbol = pos.value
    form.value.size = pos.availableQty
  }
})

// 从 props 初始化
watch(() => props.modelValue, (visible) => {
  if (visible) {
    form.value = {
      symbol: props.prefillSymbol || '',
      action: props.prefillAction || 'buy',
      size: props.prefillAction === 'sell' ? props.prefillAvailableQty : 100
    }
    selectedPosition.value = null
    error.value = ''
  }
}, { immediate: true })

// 重置 priceType 和预填价格
watch(() => props.modelValue, (visible) => {
  if (visible) {
    priceType.value = 'market'
    form.value.price = null
  }
})

// 切换到限价时，预填当前价格
watch(priceType, (type) => {
  if (type === 'limit' && currentPrice.value > 0) {
    form.value.price = currentPrice.value
  }
})

const isSell = computed(() => form.value.action === 'sell')
const isEditing = computed(() => false)
const stockName = computed(() => props.prefillName || form.value.symbol)
const availableQty = computed(() => props.prefillAvailableQty || 0)
const currentPrice = computed(() => props.prefillCurrentPrice || 0)

const estimatedAmount = computed(() => {
  // 限价用输入价格，市价用现价
  const price = priceType.value === 'limit' ? (form.value.price || 0) : (currentPrice.value || 0)
  return (price * (form.value.size || 0)).toFixed(2)
})

const sizeHint = computed(() => {
  if (form.value.action === 'sell' && availableQty.value > 0) {
    return `可卖: ${availableQty.value} 股`
  }
  return '必须为100的整数倍'
})

const sizeRules = [
  v => !!v || '请输入数量',
  v => v > 0 || '数量必须大于0',
  v => {
    // 卖出全仓时允许零股
    if (form.value.action === 'sell' && availableQty.value > 0 && Number(v) === availableQty.value) return true
    return v % 100 === 0 || '必须为100的整数倍'
  },
  v => {
    if (form.value.action === 'sell' && availableQty.value > 0 && v > availableQty.value) {
      return `可卖数量不足 (最多${availableQty.value}股)`
    }
    return true
  }
]

// 股票代码格式验证
const symbolPattern = /^\d{6}\.(SZ|SH|BJ)$/i

const isValid = computed(() => {
  const f = form.value
  if (!f.symbol || !symbolPattern.test(f.symbol)) return false
  if (!f.size || f.size <= 0) return false
  // 卖出全仓允许零股，否则必须整手
  if (f.action === 'sell' && availableQty.value > 0 && Number(f.size) === availableQty.value) {
    // pass
  } else if (f.size % 100 !== 0) {
    return false
  }
  if (f.action === 'sell' && availableQty.value > 0 && f.size > availableQty.value) return false
  // 限价时必须输入价格
  if (priceType.value === 'limit' && (!f.price || f.price <= 0)) return false
  return true
})


/**
 * 设置卖出快捷数量
 * @param {number} ratio - 比例分母 (1=全部, 2=1/2, etc.)
 */
function setQuickSell(ratio) {
  if (ratio === 1) {
    // 全部卖出
    form.value.size = availableQty.value
  } else {
    // 按比例卖出，向下取整到100
    const qty = Math.floor(availableQty.value / ratio / 100) * 100
    form.value.size = Math.max(0, qty)
  }
}

function close() {
  dialogVisible.value = false
}

function confirmOrder() {
  if (!isValid.value) return
  confirmDialog.value = true
}

async function submitOrder() {
  loading.value = true
  error.value = ''

  try {
    // 市价传 null，限价传实际价格
    const orderPrice = priceType.value === 'market' ? null : form.value.price
    const result = await createManualSignal(
      form.value.symbol.toUpperCase(),
      form.value.action,
      form.value.size,
      orderPrice
    )

    if (result.success) {
      confirmDialog.value = false
      dialogVisible.value = false
      emit('success', result)
    } else {
      error.value = result.message || '委托失败'
    }
  } catch (e) {
    error.value = e.message || '委托失败'
  } finally {
    loading.value = false
  }
}


function formatNumber(num) {
  return parseFloat(num).toLocaleString('zh-CN', { minimumFractionDigits: 2 })
}

// 股票搜索相关
const stockSearchResults = ref([])
const isSearchingStock = ref(false)
const showStockMenu = ref(false)
let searchTimeout = null

function handleStockInput(val) {
  if (!val) {
    showStockMenu.value = false
    stockSearchResults.value = []
    return
  }
  
  val = val.trim()
  
  // 1. 自动补全后缀逻辑（输入6位纯数字时）
  if (/^\d{6}$/.test(val)) {
    let suffix = ''
    if (val.startsWith('6') || val.startsWith('9')) {
      suffix = '.SH'
    } else if (val.startsWith('0') || val.startsWith('3') || val.startsWith('2')) {
      suffix = '.SZ'
    } else if (val.startsWith('4') || val.startsWith('8')) {
      suffix = '.BJ'
    }
    
    if (suffix) {
      setTimeout(() => {
        form.value.symbol = val + suffix
        // 自动补全后清除搜索结果并关闭菜单
        stockSearchResults.value = []
        showStockMenu.value = false
      }, 0)
      return
    }
  }

  // 2. 搜索逻辑（防抖）
  // 已经有后缀的不搜索
  if (/\.(SZ|SH|BJ)$/i.test(val)) {
    showStockMenu.value = false
    return
  }

  if (val.length < 2) return

  if (searchTimeout) clearTimeout(searchTimeout)
  
  searchTimeout = setTimeout(async () => {
    isSearchingStock.value = true
    try {
      const results = await searchStocks(val)
      stockSearchResults.value = results.map(s => ({
        title: `${s.name} (${s.symbol})`,
        value: s.symbol,
        raw: s
      }))
      showStockMenu.value = results.length > 0
    } catch (e) {
      console.error(e)
    } finally {
      isSearchingStock.value = false
    }
  }, 300)
}

function selectStock(item) {
  form.value.symbol = item.value
  showStockMenu.value = false
}
</script>

<style scoped>
.divider {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin: 0;
}
</style>
