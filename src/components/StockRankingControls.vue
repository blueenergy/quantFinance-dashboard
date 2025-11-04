<template>
  <div class="control-section">
  <v-row class="control-group gap-md" align="center">
      <v-col cols="12" sm="6" md="4">
        <div class="flex-row-center gap-sm">
          <label class="label-fixed">显示模式：</label>
          <v-select
            v-model="internalViewMode"
            :items="viewModeOptions"
            item-title="label"
            item-value="value"
            density="compact"
            variant="outlined"
            @update:modelValue="onLocalViewModeChange"
            :menu-props="{ maxHeight: 320 }"
          />
        </div>
  <div class="mt-xs text-muted info-inline">(child viewMode: <strong>{{ viewMode }}</strong>)</div>
      </v-col>

      <v-col cols="12" sm="6" md="4" v-show="viewMode !== 'selected'">
        <div class="flex-row-center gap-sm">
          <label class="label-fixed">选择日期：</label>
          <v-text-field
            v-model="internalSelectedDate"
            type="date"
            :max="maxDate"
            density="compact"
            variant="outlined"
            @click="handleMaybeOpenAvailableDatesTop"
          />
        </div>
      </v-col>
    </v-row>

    <v-row v-if="viewMode === 'ranking' || viewMode === 'watchlist'" class="control-group" align="center">
      <v-col cols="12" sm="4">
        <label v-if="viewMode === 'ranking'">显示数量：</label>
        <v-select
          v-if="viewMode === 'ranking'"
          v-model="internalDisplayLimit"
          :items="displayLimitOptions"
          item-title="label"
          item-value="value"
          density="compact"
          variant="outlined"
        />
      </v-col>
      <v-col cols="12" sm="6">
        <label style="margin-left: 0">排名策略：</label>
  <v-select
    v-model="internalRankingStrategy"
    :items="rankingStrategyOptions"
    item-title="label"
    item-value="value"
    density="compact"
    variant="outlined"
  />
      </v-col>
    </v-row>

    <v-row v-show="viewMode === 'selected'" class="control-group">
      <v-col cols="12">
        <div class="stock-input-area">
          <label>选择股票：</label>
          <div class="flex-row-center gap-sm">
            <v-text-field
              v-model="internalStockInput"
              placeholder="输入股票代码，如: 000001, 002129..."
              density="compact"
              variant="outlined"
              @keydown.enter="handleAddStock"
            />
            <v-btn color="primary" @click="handleAddStock" small>添加</v-btn>
            <v-btn text @click="$emit('clear-selected-stocks')" small>清空</v-btn>
          </div>

          <div v-if="stockSuggestions.length > 0" class="suggestions-list">
            <div v-for="suggestion in stockSuggestions" :key="suggestion.symbol" @click="handleSuggestionClick(suggestion)" class="suggestion-item">{{ suggestion.symbol }} - {{ suggestion.name }}</div>
          </div>

          <div v-if="selectedStocks.length > 0" class="selected-stocks mt-sm">
            <v-chip v-for="symbol in selectedStocks" :key="symbol" class="ma-1" closable @click:close="handleRemoveStock(symbol)">{{ symbol }}</v-chip>
          </div>

          <div class="flex-row-center gap-sm mt-sm">
            <label>策略：</label>
            <v-select
              v-model="internalRankingStrategy"
              :items="rankingStrategyOptions"
              item-title="label"
              item-value="value"
              density="compact"
              variant="outlined"
              style="min-width:160px;"
            />
          </div>

          <div class="multi-date-area mt-md" style="width:100%;">
            <div class="flex-row-center gap-sm">
              <v-btn small color="primary" @click="handleOpenAvailableDates">查看可用评分日期</v-btn>
              <v-btn small text @click="handleClearSelectedDates">清空已选日期</v-btn>
            </div>
            <div class="helper-text mt-xs">先选中单只股票后点击查看该股票的评分日期</div>

            <div v-if="selectedDates.length > 0" class="selected-dates mt-sm flex-row flex-wrap gap-sm">
              <div v-for="date in selectedDates" :key="date" class="date-chip chip">
                <strong>{{ formatDateDisplay(date) }}</strong>
                <v-btn icon small @click="handleRemoveDate(date)">×</v-btn>
              </div>
            </div>
          </div>
        </div>
      </v-col>
    </v-row>

    <v-row v-if="viewMode === 'watchlist'" class="control-group">
      <v-col cols="12">
        <span class="watchlist-info">📋 显示您的自选股评分 ({{ watchlistLength }} 只)</span>
        <v-btn text @click="$emit('view-watchlist-stocks')" class="ml-2">查看自选股详情</v-btn>
        <v-btn text @click="$emit('clear-watchlist')" class="ml-2">清空自选股</v-btn>
      </v-col>
    </v-row>

    <v-row v-if="viewMode === 'hs300'" class="control-group">
      <v-col cols="12">
        <div class="hs300-info">
          <span class="index-info">📈 沪深300指数成分股 <span v-if="hs300StocksLength > 0">({{ hs300StocksLength }} 只)</span><span v-else-if="hs300Loading">加载中...</span></span>
        </div>
        <v-btn small @click="$emit('refresh-hs300')" :disabled="hs300Loading">{{ hs300Loading ? '刷新中...' : '🔄 刷新成分股' }}</v-btn>
        <v-btn small text @click="$emit('export-hs300')">📊 导出成分股信息</v-btn>
      </v-col>
    </v-row>

    <v-row class="control-group" align="center">
      <v-col cols="12">
        <v-btn text @click="$emit('export-scores')">导出数据</v-btn>
        <span class="last-update">最后更新: {{ lastUpdateTime }}</span>
      </v-col>
    </v-row>
  </div>
</template>

<script setup>
import { toRefs, computed, onMounted } from 'vue'

// define emits explicitly so we can call them from safe handlers
const emit = defineEmits([
  'change-view-mode', 'change-date', 'change-display-limit', 'change-ranking-strategy',
  'stock-input', 'add-stock', 'clear-selected-stocks', 'select-suggestion', 'remove-stock',
  // distinct events: top date input requests a maybe-open hook, while the selected-mode button
  // explicitly requests opening available-dates for the currently selected symbol.
  'maybe-open-available-dates-top', 'open-available-dates-selected', 'clear-selected-dates', 'remove-date',
  'view-watchlist-stocks', 'clear-watchlist', 'refresh-hs300', 'export-hs300', 'export-scores'
])

const props = defineProps({
  viewMode: { type: String, default: 'ranking' },
  selectedDate: { type: String, default: '' },
  maxDate: { type: String, default: new Date().toISOString().slice(0,10) },
  displayLimit: { type: [String, Number], default: 50 },
  rankingStrategy: { type: String, default: 'balanced' },
  stockInput: { type: String, default: '' },
  stockSuggestions: { type: Array, default: () => [] },
  selectedStocks: { type: Array, default: () => [] },
  selectedDates: { type: Array, default: () => [] },
  watchlistLength: { type: Number, default: 0 },
  hs300StocksLength: { type: Number, default: 0 },
  hs300Loading: { type: Boolean, default: false },
  lastUpdateTime: { type: String, default: '' }
  ,
  // Optional callback props (allow parent to inject functions directly)
  onSelectSuggestion: { type: Function, default: null },
  onAddStock: { type: Function, default: null }
  ,
  // legacy 'onX' names collide with Vue's event listener merging; prefer explicit names
  selectSuggestionCb: { type: Function, default: null },
  addStockCb: { type: Function, default: null }
})


import { formatDateDisplay } from '../utils/scoreUtils.js'

// expose utilities to template
const refs = toRefs(props)
// Destructure for template access (template unwraps refs automatically)
const viewMode = refs.viewMode
const selectedDate = refs.selectedDate
const maxDate = refs.maxDate || { value: new Date().toISOString().slice(0,10) }
const displayLimit = refs.displayLimit
const rankingStrategy = refs.rankingStrategy
const stockInput = refs.stockInput
const stockSuggestions = refs.stockSuggestions
const selectedStocks = refs.selectedStocks
const selectedDates = refs.selectedDates
const watchlistLength = refs.watchlistLength
const hs300StocksLength = refs.hs300StocksLength
const hs300Loading = refs.hs300Loading
const lastUpdateTime = refs.lastUpdateTime

// Options constants (avoid large inline arrays causing template parse ambiguity)
const viewModeOptions = [
  { label: '排行榜模式', value: 'ranking' },
  { label: '指定股票模式', value: 'selected' },
  { label: '自选股模式', value: 'watchlist' },
  { label: '沪深300模式', value: 'hs300' },
  { label: '中证500模式', value: 'csi500' },
  { label: '中证A500模式', value: 'a500' },
  { label: '科创50模式', value: 'star50' },
]
const rankingStrategyOptions = [
  {label:'均衡',value:'balanced'},
  {label:'激进',value:'aggressive'},
  {label:'保守',value:'conservative'},
  {label:'防御',value:'defensive'},
  {label:'价值型',value:'value_oriented'},
  {label:'交易型',value:'trading_oriented'},
  {label:'成长型',value:'growth_oriented'},
  {label:'周期型',value:'cycle_oriented'},
]

// callback refs (use safe names to avoid Vue auto-merging 'onX' listener props)
const selectSuggestionCb = refs.selectSuggestionCb
const addStockCb = refs.addStockCb
// keep backwards compatibility variables (in case parent passed old names)
const onSelectSuggestion = refs.onSelectSuggestion
const onAddStock = refs.onAddStock

// No runtime debug probes in production build

// Defensive emit helpers: extract value whether caller passes an Event or a primitive
function extractEventValue(e) {
  try {
    if (e && typeof e === 'object' && 'target' in e && e.target && 'value' in e.target) return e.target.value
  } catch (err) {
    // fallthrough
  }
  // If it's a primitive value already, just return it
  return e
}

// Computed v-model wrappers to simplify bindings
const internalViewMode = computed({
  get: () => viewMode.value,
  set: v => { emit('change-view-mode', v) }
})
function onLocalViewModeChange(val) {
  try { console.debug('[StockRankingControls] onLocalViewModeChange ->', val) } catch(e) {}
  emit('change-view-mode', val)
}
const internalSelectedDate = computed({
  get: () => selectedDate.value,
  set: v => { emit('change-date', v) }
})
const internalDisplayLimit = computed({
  get: () => displayLimit.value,
  set: v => { emit('change-display-limit', v) }
})
const internalRankingStrategy = computed({
  get: () => rankingStrategy.value,
  set: v => { emit('change-ranking-strategy', v) }
})
const internalStockInput = computed({
  get: () => stockInput.value,
  set: v => { emit('stock-input', v) }
})
const displayLimitOptions = [
  { label: 'Top 10', value: 10 },
  { label: 'Top 50', value: 50 },
  { label: 'Top 100', value: 100 },
  { label: 'Top 200', value: 200 }
]
function handleMaybeOpenAvailableDatesTop() { emit('maybe-open-available-dates-top') }
function handleSelectSuggestion(suggestion) { try { emit('select-suggestion', suggestion) } catch (e) { console.error('emit select-suggestion failed', e) } }
// debug helper: log when suggestion clicked (templates call this)
function handleSuggestionClick(suggestion) {
  // prefer direct callback if provided by parent
  try {
    // prefer direct callback if provided by parent (new safe prop)
    if (selectSuggestionCb && selectSuggestionCb.value) {
      selectSuggestionCb.value(suggestion)
      return
    }
    // fallback to older 'onSelectSuggestion' prop if present
    if (onSelectSuggestion && onSelectSuggestion.value) {
      onSelectSuggestion.value(suggestion)
      return
    }
  } catch (e) {
    console.error('selectSuggestion callback failed', e)
  }
  // fallback to emit
  try { emit('select-suggestion', suggestion) } catch (e) { console.error('emit select-suggestion failed', e) }
}

function handleAddStock() {
  try {
    if (addStockCb && addStockCb.value) {
      try { console.debug('[StockRankingControls] calling addStockCb') } catch (err) {}
      addStockCb.value()
      return
    }
    if (onAddStock && onAddStock.value) {
      try { console.debug('[StockRankingControls] calling onAddStock') } catch (err) {}
      onAddStock.value()
      return
    }
  } catch (e) {
    console.error('addStock callback failed', e)
  }
  try { emit('add-stock') } catch (e) { console.error('emit add-stock failed', e) }
}
function handleRemoveStock(symbol) { try { emit('remove-stock', symbol) } catch (e) { console.error('emit remove-stock failed', e) } }
function handleOpenAvailableDates() { try { emit('open-available-dates-selected') } catch (e) { console.error('emit open-available-dates-selected failed', e) } }
function handleClearSelectedDates() { try { emit('clear-selected-dates') } catch (e) { console.error('emit clear-selected-dates failed', e) } }
function handleRemoveDate(date) { try { emit('remove-date', date) } catch (e) { console.error('emit remove-date failed', e) } }

onMounted(() => {
  // (cleanup) debug overlay removed
})
</script>

<style scoped>
/* Control panel styles moved from StockRanking.vue */
.control-section {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.control-group {
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.control-group:last-child {
  margin-bottom: 0;
}

.stock-input-area {
  flex: 1;
  min-width: 300px;
  position: relative;
}

.input-row {
  display: flex;
  gap: 10px;
  margin-top: 5px;
}

.stock-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.btn-add, .btn-clear, .btn-export, .btn-manage-watchlist, .btn-clear-watchlist {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
  margin-right: 10px;
}

.btn-add {
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
}

.btn-clear, .btn-clear-watchlist {
  background: linear-gradient(135deg, #dc3545, #c82333);
  color: white;
}


.btn-export {
  background: linear-gradient(135deg, #6f42c1, #5a31a8);
  color: white;
}

.btn-manage-watchlist {
  background: linear-gradient(135deg, #17a2b8, #138496);
  color: white;
}


.suggestions-list {
  position: absolute;
  z-index: 1000;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
  margin-top: 2px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  width: 100%;
}

.suggestion-item {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
}

.suggestion-item:hover {
  background-color: #f8f9fa;
}

.selected-stocks {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.stock-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  background: linear-gradient(135deg, #007bff, #0056b3);
  color: white;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.tag-remove {
  background: none;
  border: none;
  color: white;
  margin-left: 5px;
  cursor: pointer;
  font-weight: bold;
  padding: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tag-remove:hover {
  background-color: rgba(255,255,255,0.2);
}

.watchlist-info {
  color: var(--color-muted);
  font-size: 14px;
}

.last-update {
  color: var(--color-muted);
  font-size: 12px;
  margin-left: 10px;
}

.date-input {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  margin-left: 8px;
  margin-right: 8px;
}

.helper-text {
  color: var(--color-subtle);
  font-size: 12px;
}

.date-chip select {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 4px 6px;
}

.btn-refresh, .btn-export-info {
  background: linear-gradient(135deg, #3498db, #2980b9);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
}

.btn-refresh:disabled {
  background: linear-gradient(135deg, #bdc3c7, #95a5a6);
  cursor: not-allowed;
}

.btn-export-info {
  background: linear-gradient(135deg, #9b59b6, #8e44ad);
}

/* small utility kept local */
.quick-select-actions { display:flex; justify-content:flex-end; gap:10px; }
.selected-dates { margin-top: 8px; }

/* New utility mappings for extracted inline styles */
.label-fixed { min-width:72px; }
.info-inline { font-size:13px; }
.date-chip { display:flex; align-items:center; }

</style>
