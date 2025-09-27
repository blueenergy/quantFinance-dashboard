<template>
  <div v-if="show" class="modal-overlay" @click="close">
    <div class="modal-content quick-select-modal" @click.stop>
      <h4>快速选择热门股票</h4>
      <div class="quick-select-tabs">
        <button v-for="category in quickSelectCategories" :key="category.key" @click="$emit('select-category', category.key)" :class="['tab-btn', { active: selectedCategory === category.key }]">
          {{ category.name }}
        </button>
      </div>
      <div class="quick-select-content">
        <div v-for="stock in stocksForCategory" :key="stock.symbol" @click="$emit('toggle-stock', stock.symbol)" :class="['quick-stock-item', { selected: selectedStocks.includes(stock.symbol) }]">
          <span class="quick-stock-symbol">{{ stock.symbol }}</span>
          <span class="quick-stock-name">{{ stock.name }}</span>
          <span v-if="selectedStocks.includes(stock.symbol)" class="selected-indicator">✓</span>
        </div>
      </div>
      <div class="quick-select-actions">
        <button @click="$emit('apply')" class="btn-apply">应用选择 ({{ selectedStocks.length }})</button>
        <button @click="close" class="btn-cancel">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, computed } from 'vue'

const props = defineProps({
  show: Boolean,
  quickSelectCategories: Array,
  selectedCategory: String,
  selectedStocks: Array
})

const stocksForCategory = computed(() => {
  const cat = props.quickSelectCategories.find(c => c.key === props.selectedCategory)
  return cat ? cat.stocks : []
})
const emit = defineEmits(['select-category','toggle-stock','apply','close'])
function close() { emit('close') }
</script>

<style scoped>
/* QuickSelect modal styles moved from StockRanking.vue */
.quick-select-modal { max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; }
.quick-select-tabs { display: flex; margin-bottom: 15px; border-bottom: 1px solid #ddd; }
.tab-btn { padding: 8px 16px; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; font-size: 14px; }
.tab-btn.active { border-bottom-color: #007bff; color: #007bff; font-weight: bold; }
.quick-select-content { max-height: 300px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 15px; }
.quick-stock-item { display: flex; align-items: center; padding: 10px; cursor: pointer; border-bottom: 1px solid #f0f0f0; transition: background-color 0.2s; }
.quick-stock-item:hover { background-color: #f8f9fa; }
.quick-stock-item.selected { background-color: #e7f3ff; border-left: 3px solid #007bff; }
.quick-stock-symbol { font-weight: bold; margin-right: 10px; min-width: 80px; }
.quick-stock-name { flex: 1; color: #666; }
.selected-indicator { color: #007bff; font-weight: bold; }
.quick-select-actions { display: flex; justify-content: flex-end; gap: 10px; }

@media (max-width: 768px) {
  .quick-select-modal { width: 95%; max-height: 90vh; }
}
</style>
