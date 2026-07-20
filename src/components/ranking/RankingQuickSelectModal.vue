<template>
  <div v-if="show" class="modal-overlay" @click="emit('close')">
    <div class="modal-content quick-select-modal" @click.stop>
      <h4>快速选择热门股票</h4>

      <div class="quick-select-tabs-wrapper">
        <button
          v-if="showTabsScrollLeft"
          type="button"
          class="tabs-nav left"
          aria-label="向左滚动分类"
          @click="scrollTabs('left')"
        >
          ‹
        </button>
        <div ref="tabsScrollRef" class="quick-select-tabs" @scroll="updateTabsScrollState">
          <button
            v-for="category in categories"
            :key="category.key"
            type="button"
            :class="['tab-btn', { active: selectedCategory === category.key }]"
            @click="selectCategory(category.key)"
          >
            <span class="tab-label">{{ category.name }}</span>
            <span
              v-if="getCategorySelectedCount(category.key) > 0"
              class="tab-badge"
              :title="formatCategoryBadgeTitle(category.key)"
            >
              {{ getCategorySelectedCount(category.key) }}
            </span>
          </button>
        </div>
        <button
          v-if="showTabsScrollRight"
          type="button"
          class="tabs-nav right"
          aria-label="向右滚动分类"
          @click="scrollTabs('right')"
        >
          ›
        </button>
      </div>

      <div class="quick-select-content">
        <div v-if="isCurrentIndex && currentIndexLoading" class="category-state text-bold">
          正在加载{{ currentIndexName }}成分股...
        </div>
        <div v-else-if="isCurrentIndex && currentCategoryStocks.length === 0" class="category-state">
          未获取到成分股数据。
          <button type="button" class="btn-primary-lite ml-sm" @click="emit('reload-index', selectedCategory)">
            重新加载
          </button>
        </div>
        <template v-else>
          <div v-if="isCurrentIndex && currentCategoryStocks.length > 0" class="bulk-select-bar">
            <button
              type="button"
              class="btn-base btn-sm btn-gradient-green"
              :disabled="currentSelectedCount === currentCategoryStocks.length"
              @click="emit('select-all-index', selectedCategory)"
            >
              全选{{ currentIndexName }} ({{ currentCategoryStocks.length }})
            </button>
            <button
              type="button"
              class="btn-base btn-sm btn-gradient-gray"
              :disabled="currentSelectedCount === 0"
              @click="emit('deselect-all-index', selectedCategory)"
            >
              取消选择
            </button>
            <span class="bulk-selected-count">
              已选 {{ currentSelectedCount }} / {{ currentCategoryStocks.length }}
            </span>
          </div>

          <button
            v-for="stock in currentCategoryStocks"
            :key="stock.symbol"
            type="button"
            :class="['quick-stock-item', { selected: isSelectedStock(stock.symbol) }]"
            @click="emit('toggle-stock', stock.symbol)"
          >
            <span class="quick-stock-symbol">{{ stock.symbol }}</span>
            <span class="quick-stock-name">{{ stock.name }}</span>
            <span v-if="isSelectedStock(stock.symbol)" class="selected-indicator">✓</span>
          </button>
        </template>
      </div>

      <div class="quick-select-actions">
        <button type="button" class="btn-base btn-md btn-gradient-green" @click="emit('apply')">
          应用选择 ({{ selectedStocks.length }})
        </button>
        <button type="button" class="btn-base btn-md btn-gradient-gray" @click="emit('close')">
          取消
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const INDEX_META = {
  hs300: '沪深300',
  a500: '中证A500',
  csi500: '中证500',
  csi1000: '中证1000',
  csi2000: '中证2000',
  star50: '科创50'
}

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  categories: {
    type: Array,
    default: () => []
  },
  selectedCategory: {
    type: String,
    default: ''
  },
  selectedStocks: {
    type: Array,
    default: () => []
  },
  indexStocks: {
    type: Object,
    default: () => ({})
  },
  indexLoading: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits([
  'update:selectedCategory',
  'toggle-stock',
  'select-all-index',
  'deselect-all-index',
  'reload-index',
  'apply',
  'close'
])

const tabsScrollRef = ref(null)
const showTabsScrollLeft = ref(false)
const showTabsScrollRight = ref(false)

const selectedSet = computed(() => new Set(props.selectedStocks))
const isCurrentIndex = computed(() => Object.hasOwn(INDEX_META, props.selectedCategory))
const currentIndexName = computed(() => INDEX_META[props.selectedCategory] || '')
const currentIndexLoading = computed(() => Boolean(props.indexLoading[props.selectedCategory]))
const currentCategoryStocks = computed(() => {
  if (isCurrentIndex.value) {
    return props.indexStocks[props.selectedCategory] || []
  }
  return props.categories.find(category => category.key === props.selectedCategory)?.stocks || []
})
const currentSelectedCount = computed(
  () => currentCategoryStocks.value.filter(stock => selectedSet.value.has(stock.symbol)).length
)

function categoryStocks(key) {
  if (Object.hasOwn(INDEX_META, key)) {
    return props.indexStocks[key] || []
  }
  return props.categories.find(category => category.key === key)?.stocks || []
}

function getCategorySelectedCount(key) {
  return categoryStocks(key).filter(stock => selectedSet.value.has(stock.symbol)).length
}

function formatCategoryBadgeTitle(key) {
  return `已选 ${getCategorySelectedCount(key)} / 总 ${categoryStocks(key).length}`
}

function isSelectedStock(symbol) {
  return selectedSet.value.has(symbol)
}

function selectCategory(key) {
  emit('update:selectedCategory', key)
}

function updateTabsScrollState() {
  const element = tabsScrollRef.value
  if (!element) {
    showTabsScrollLeft.value = false
    showTabsScrollRight.value = false
    return
  }
  showTabsScrollLeft.value = element.scrollLeft > 5
  showTabsScrollRight.value = element.scrollWidth - element.clientWidth - element.scrollLeft > 5
}

function scrollTabs(direction) {
  const element = tabsScrollRef.value
  if (!element) return
  const delta = Math.round(element.clientWidth * 0.6)
  element.scrollTo({
    left: direction === 'left' ? element.scrollLeft - delta : element.scrollLeft + delta,
    behavior: 'smooth'
  })
}

watch(
  () => props.show,
  async show => {
    if (!show) return
    await nextTick()
    updateTabsScrollState()
  }
)

watch(
  () => props.categories.length,
  async () => {
    await nextTick()
    updateTabsScrollState()
  }
)

onMounted(() => {
  window.addEventListener('resize', updateTabsScrollState)
  updateTabsScrollState()
})

onUnmounted(() => {
  window.removeEventListener('resize', updateTabsScrollState)
})
</script>

<style scoped>
.quick-select-modal {
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
}

.quick-select-modal h4 {
  position: relative;
  margin-bottom: 16px;
  padding-left: 6px;
  background: linear-gradient(90deg, #ff9800, #ffb300, #ffd54f);
  background-clip: text;
  color: #7a4100;
  font-size: 24px;
  font-weight: 900;
  letter-spacing: 1.5px;
  text-shadow: 0 2px 12px rgba(255, 152, 0, 0.35), 0 1px 0 #fff;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.quick-select-modal h4::before {
  position: absolute;
  top: 50%;
  left: 0;
  width: 4px;
  height: 70%;
  border-radius: 2px;
  background: linear-gradient(180deg, #ffb300, #ff8c00);
  box-shadow: 0 0 6px rgba(255, 140, 0, 0.6);
  content: '';
  transform: translateY(-50%);
}

.quick-select-tabs-wrapper {
  display: flex;
  position: relative;
  align-items: stretch;
  gap: 4px;
}

.quick-select-tabs {
  display: flex;
  min-width: 0;
  margin-bottom: 15px;
  overflow-x: auto;
  border-bottom: 1px solid #cbd5e1;
  scrollbar-color: #64748b transparent;
  scrollbar-width: thin;
  scroll-behavior: smooth;
}

.quick-select-tabs::-webkit-scrollbar {
  height: 8px;
}

.quick-select-tabs::-webkit-scrollbar-track {
  background: transparent;
}

.quick-select-tabs::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.45);
}

.tabs-nav {
  display: flex;
  width: 34px;
  flex: 0 0 34px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  background: linear-gradient(135deg, #0466c8, #0353a4);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  color: #fff;
  cursor: pointer;
  font-size: 20px;
  font-weight: 700;
  transition: transform 0.18s;
}

.tabs-nav:hover {
  transform: translateY(-2px);
}

.tabs-nav:active {
  transform: translateY(0);
}

.tabs-nav.left {
  order: -1;
}

.tabs-nav.right {
  order: 2;
}

.tab-btn {
  position: relative;
  flex: 0 0 auto;
  margin-right: 4px;
  padding: 8px 16px;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 8px 8px 0 0;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  color: #0f172a;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  transition: background 0.18s, color 0.18s, transform 0.18s, box-shadow 0.18s;
}

.tab-btn.active {
  border-bottom-color: #0466c8;
  background: linear-gradient(135deg, #dbeeff, #fff);
  box-shadow: 0 3px 10px rgba(4, 102, 200, 0.25);
  color: #023e8a;
  font-weight: 800;
}

.tab-btn:not(.active):hover {
  background: #e2e8f0;
  color: #0353a4;
  transform: translateY(-2px);
}

.tab-btn:focus-visible,
.tabs-nav:focus-visible,
.quick-stock-item:focus-visible {
  outline: 3px solid rgba(4, 102, 200, 0.55);
  outline-offset: -2px;
}

.tab-badge {
  display: inline-flex;
  min-width: 20px;
  height: 20px;
  margin-left: 6px;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  border-radius: 12px;
  background: linear-gradient(135deg, #c81e1e, #991b1b);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.quick-select-content {
  max-height: 300px;
  margin-bottom: 15px;
  overflow-y: auto;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
}

.category-state {
  padding: 24px 12px;
  color: #475569;
  text-align: center;
}

.category-state.text-bold {
  color: #0f3d66;
  font-weight: 700;
}

.bulk-select-bar {
  display: flex;
  position: sticky;
  z-index: 2;
  top: 0;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-bottom: 1px solid #cbd5e1;
  background: linear-gradient(90deg, #fff, #f1f5f9);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
}

.bulk-selected-count {
  margin-left: auto;
  padding: 4px 8px;
  border: 1px solid #bfdbfe;
  border-radius: 4px;
  background: #eaf4ff;
  color: #1e293b;
  font-size: 12px;
  font-weight: 700;
}

.quick-stock-item {
  display: flex;
  width: 100%;
  align-items: center;
  padding: 10px;
  border: 0;
  border-bottom: 1px solid #e2e8f0;
  background: #fff;
  color: #0f172a;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  text-align: left;
  transition: background-color 0.12s, transform 0.12s;
}

.quick-stock-item:hover {
  background: #e6f2ff;
  transform: translateY(-1px);
}

.quick-stock-item.selected {
  border-left: 4px solid #0466c8;
  background: #bfdbfe;
  color: #0b2540;
}

.quick-stock-symbol {
  min-width: 80px;
  margin-right: 10px;
  padding: 4px 10px;
  border-radius: 6px;
  background: linear-gradient(135deg, #0466c8, #0353a4);
  box-shadow: 0 2px 4px rgba(3, 83, 164, 0.25);
  color: #fff;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.quick-stock-name {
  flex: 1;
  color: #102a43;
  font-weight: 700;
}

.selected-indicator {
  color: #023e8a;
  font-weight: 900;
}

.quick-select-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

:global(.force-high-contrast) .quick-stock-item {
  background: #fff !important;
  color: #000 !important;
}

:global(.force-high-contrast) .quick-stock-item.selected {
  border-left-color: #001d6c !important;
  background: #9ac7ff !important;
}

@media (prefers-color-scheme: dark) {
  .tab-btn {
    background: #1e293b;
    color: #f8fafc;
  }

  .tab-btn.active {
    border-bottom-color: #93c5fd;
    background: linear-gradient(135deg, #164e80, #1e3a8a);
    color: #fff;
  }

  .tab-btn:not(.active):hover {
    background: #334155;
    color: #bfdbfe;
  }

  .tab-badge {
    background: linear-gradient(135deg, #dc2626, #991b1b);
  }
}

@media (max-width: 768px) {
  .quick-select-modal {
    width: 95%;
    max-height: 90vh;
  }

  .bulk-select-bar {
    flex-wrap: wrap;
  }

  .bulk-selected-count {
    width: 100%;
    margin-left: 0;
  }
}
</style>
