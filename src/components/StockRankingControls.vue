<template>
  <div class="control-section">
    <div class="control-group" style="gap: 32px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <label>显示模式：</label>
  <select :value="viewMode" @change="handleViewModeChangeDebug">
          <option value="ranking">排行榜模式</option>
          <option value="selected">指定股票模式</option>
          <option value="watchlist">自选股模式</option>
          <option value="hs300">沪深300模式</option>
        </select>
      </div>
      <!-- debug: show the received viewMode from parent -->
      <div style="margin-left:12px; color:#666; font-size:13px;">
        (child viewMode: <strong>{{ viewMode }}</strong>)
      </div>
  <div v-show="viewMode !== 'selected'" style="display: flex; align-items: center; gap: 10px;">
        <label>选择日期：</label>
    <input type="date" :value="selectedDate" @change="handleDateChange" class="date-input" :max="maxDate" @click="handleMaybeOpenAvailableDatesTop" />
      </div>
    </div>

    <div v-if="viewMode === 'ranking' || viewMode === 'watchlist'" class="control-group">
      <label v-if="viewMode === 'ranking'">显示数量：</label>
      <select v-if="viewMode === 'ranking'" :value="displayLimit" @change="handleDisplayLimitChange">
        <option value="10">Top 10</option>
        <option value="50">Top 50</option>
        <option value="100">Top 100</option>
        <option value="200">Top 200</option>
      </select>
      <label style="margin-left: 24px;">排名策略：</label>
      <select :value="rankingStrategy" @change="handleRankingStrategyChange">
        <option value="balanced">均衡</option>
        <option value="aggressive">激进</option>
        <option value="conservative">保守</option>
        <option value="defensive">防御</option>
        <option value="value_oriented">价值型</option>
        <option value="trading_oriented">交易型</option>
        <option value="growth_oriented">成长型</option>
        <option value="cycle_oriented">周期型</option>
      </select>
    </div>

  <div v-show="viewMode === 'selected'" class="control-group">
      <div class="stock-input-area">
        <label>选择股票：</label>
        <div class="input-row">
          <input
            :value="stockInput"
            @keyup.enter="$emit('add-stock')"
            @input="handleStockInput"
            placeholder="输入股票代码，如: 000001, 002129..."
            class="stock-input"
          />
          <button @click="handleAddStock" class="btn-add">添加</button>
          <button @click="$emit('clear-selected-stocks')" class="btn-clear">清空</button>
        </div>

        <div v-if="stockSuggestions.length > 0" class="suggestions-list">
          <div
            v-for="suggestion in stockSuggestions"
            :key="suggestion.symbol"
            @click="handleSuggestionClick(suggestion)"
            class="suggestion-item"
          >
            {{ suggestion.symbol }} - {{ suggestion.name }}
          </div>
        </div>

        <div v-if="selectedStocks.length > 0" class="selected-stocks">
          <span
            v-for="symbol in selectedStocks"
            :key="symbol"
            class="stock-tag"
          >
            {{ symbol }}
            <button @click="handleRemoveStock(symbol)" class="tag-remove">×</button>
          </span>
        </div>

        <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
          <label>策略：</label>
       <select :value="rankingStrategy" @change="handleRankingStrategyChange" style="padding:6px; font-size:14px;">
            <option value="balanced">均衡</option>
            <option value="aggressive">激进</option>
            <option value="conservative">保守</option>
            <option value="defensive">防御</option>
            <option value="value_oriented">价值型</option>
            <option value="trading_oriented">交易型</option>
            <option value="growth_oriented">成长型</option>
            <option value="cycle_oriented">周期型</option>
          </select>
        </div>

        <div class="multi-date-area" style="margin-top:12px; width:100%;">
          <div style="display:flex; gap:8px; align-items:center;">
            <button @click="handleOpenAvailableDates" class="btn-add">查看可用评分日期</button>
            <button @click="handleClearSelectedDates" class="btn-clear">清空已选日期</button>
          </div>
          <div class="helper-text" style="margin-top:6px;">先选中单只股票后点击查看该股票的评分日期</div>

          <div v-if="selectedDates.length > 0" class="selected-dates" style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
            <div v-for="date in selectedDates" :key="date" class="date-chip" style="background:#fff; border:1px solid #ddd; padding:6px 8px; border-radius:6px; display:flex; align-items:center; gap:8px;">
              <strong>{{ formatDateDisplay(date) }}</strong>
              <button @click="handleRemoveDate(date)" class="tag-remove">×</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="viewMode === 'watchlist'" class="control-group">
      <span class="watchlist-info">📋 显示您的自选股评分 ({{ watchlistLength }} 只)</span>
      <button @click="$emit('view-watchlist-stocks')" class="btn-manage-watchlist">查看自选股详情</button>
      <button @click="$emit('clear-watchlist')" class="btn-clear-watchlist">清空自选股</button>
    </div>

    <div v-if="viewMode === 'hs300'" class="control-group">
      <div class="hs300-info">
        <span class="index-info">📈 沪深300指数成分股 <span v-if="hs300StocksLength > 0">({{ hs300StocksLength }} 只)</span><span v-else-if="hs300Loading">加载中...</span></span>
      </div>
      <button @click="$emit('refresh-hs300')" class="btn-refresh" :disabled="hs300Loading">{{ hs300Loading ? '刷新中...' : '🔄 刷新成分股' }}</button>
      <button @click="$emit('export-hs300')" class="btn-export-info">📊 导出成分股信息</button>
    </div>

    <div class="control-group">
      <button @click="$emit('export-scores')" class="btn-export">导出数据</button>
      <span class="last-update">最后更新: {{ lastUpdateTime }}</span>
    </div>
  </div>
</template>

<script setup>
import { toRefs, onMounted, watch } from 'vue'

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

function handleViewModeChange(e) { emit('change-view-mode', extractEventValue(e)) }
// improved debug: log extracted value
function handleViewModeChangeDebug(e) { emit('change-view-mode', extractEventValue(e)) }
function handleDateChange(e) { emit('change-date', extractEventValue(e)) }
function handleDisplayLimitChange(e) { emit('change-display-limit', extractEventValue(e)) }
function handleRankingStrategyChange(e) { emit('change-ranking-strategy', extractEventValue(e)) }
function handleStockInput(e) { emit('stock-input', extractEventValue(e)) }
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
      addStockCb.value()
      return
    }
    if (onAddStock && onAddStock.value) {
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
  color: #666;
  font-size: 14px;
}

.last-update {
  color: #666;
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
  color: #6c757d;
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

</style>
