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
.quick-stock-item { display:flex; align-items:center; padding:10px; cursor:pointer; border-bottom:1px solid #f0f0f0; transition:background-color 0.12s, transform 0.12s; background:#ffffff; color:#0f172a; font-weight:600; }
.quick-stock-item:hover { background-color:#eef6ff; transform:translateY(-1px); }
.quick-stock-item.selected { background-color:#cfe8ff; border-left:4px solid #0466c8; color:#0b2540; }
.quick-stock-symbol { font-weight:700; margin-right:10px; min-width:80px; background:linear-gradient(135deg,#0466c8,#0353a4); color:#ffffff !important; padding:4px 10px; border-radius:6px; letter-spacing:0.5px; box-shadow:0 2px 4px rgba(3,83,164,0.25); }
.quick-stock-name { flex:1; color:#102a43; font-weight:600; }
.selected-indicator { color:#03467a; font-weight:800; }
.force-high-contrast .quick-stock-item { background:#fff !important; color:#0a0f18 !important; }
.force-high-contrast .quick-stock-item.selected { background:#bcdfff !important; }
.quick-select-actions { display: flex; justify-content: flex-end; gap: 10px; }

@media (max-width: 768px) {
  .quick-select-modal { width: 95%; max-height: 90vh; }
}
</style>
