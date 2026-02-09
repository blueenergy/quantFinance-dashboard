<template>
  <div class="ladder-tier-card mb-4">
    <!-- 梯队标题 -->
    <div class="tier-header d-flex align-center justify-space-between pa-3" :style="{ borderLeftColor: `var(--v-theme-${color})` }">
      <div class="d-flex align-center">
        <span class="tier-icon mr-2">{{ icon }}</span>
        <span class="text-h6 font-weight-bold">{{ tierLabel }}</span>
        <v-chip size="small" class="ml-2" :color="color">
          {{ stocks.length }}只
        </v-chip>
      </div>
      <v-btn
        v-if="collapsed !== undefined"
        icon
        size="small"
        variant="text"
        @click="isExpanded = !isExpanded"
      >
        <span>{{ isExpanded ? '▲' : '▼' }}</span>
      </v-btn>
    </div>

    <!-- 板块聚合统计 -->
    <div v-if="Object.keys(sectorAggregation).length > 0" class="sector-summary px-3 py-2">
      <v-chip 
        v-for="(count, sector) in sortedSectors" 
        :key="sector" 
        size="small" 
        class="mr-2 mb-1"
        variant="outlined"
      >
        {{ sector }} {{ count }}只
      </v-chip>
    </div>

    <!-- 股票列表 -->
    <v-expand-transition>
      <div v-show="isExpanded || collapsed === undefined" class="stock-list pa-3">
        <div 
          v-for="stock in displayedStocks" 
          :key="stock.symbol" 
          class="stock-item d-flex align-center justify-space-between py-2"
        >
          <div class="stock-info">
            <span class="stock-name font-weight-medium">{{ stock.name }}</span>
            <span class="stock-symbol text-grey ml-2">{{ stock.symbol }}</span>
            <v-chip v-if="stock.streak >= 4" size="x-small" color="red" class="ml-2">
              {{ stock.streak }}连板
            </v-chip>
          </div>
          <div class="stock-meta d-flex align-center">
            <v-chip size="x-small" variant="tonal" class="mr-2">
              {{ stock.sector }}
            </v-chip>
            <span class="seal-info text-caption text-grey">
              {{ formatTime(stock.limit_up_time) }}
              <span v-if="stock.open_count > 0" class="text-orange ml-1">
                开{{ stock.open_count }}次
              </span>
            </span>
          </div>
        </div>

        <!-- 展开更多 -->
        <div v-if="stocks.length > maxDisplay && !showAll" class="text-center mt-2">
          <v-btn size="small" variant="text" @click="showAll = true">
            查看全部 {{ stocks.length }} 只
            ▼
          </v-btn>
        </div>
      </div>
    </v-expand-transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  tier: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: '📊'
  },
  color: {
    type: String,
    default: 'primary'
  },
  stocks: {
    type: Array,
    default: () => []
  },
  sectorAggregation: {
    type: Object,
    default: () => ({})
  },
  collapsed: {
    type: Boolean,
    default: undefined
  }
})

const isExpanded = ref(props.collapsed !== true)
const showAll = ref(false)
const maxDisplay = 10

// 梯队标签
const tierLabel = computed(() => {
  switch (props.tier) {
    case '4+': return '四板及以上'
    case '3': return '三板'
    case '2': return '二板'
    case '1': return '首板'
    default: return `${props.tier}板`
  }
})

// 按数量排序的板块
const sortedSectors = computed(() => {
  const entries = Object.entries(props.sectorAggregation)
  entries.sort((a, b) => b[1] - a[1])
  return Object.fromEntries(entries.slice(0, 5))
})

// 显示的股票（限制数量）
const displayedStocks = computed(() => {
  if (showAll.value) return props.stocks
  return props.stocks.slice(0, maxDisplay)
})

// 格式化时间
function formatTime(timeValue) {
  if (!timeValue && timeValue !== 0) return ''
  
  // 转换为字符串
  let timeStr = String(timeValue)
  
  // 如果是数字格式（如 92500 表示 09:25:00）
  if (/^\d+$/.test(timeStr)) {
    // 补足6位
    timeStr = timeStr.padStart(6, '0')
    return `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}`
  }
  
  // 如果已经包含冒号（如 "09:25:00"）
  if (timeStr.includes(':')) {
    return timeStr.slice(0, 5)
  }
  
  return timeStr
}
</script>

<style scoped>
.ladder-tier-card {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.tier-header {
  background: rgba(255, 255, 255, 0.05);
  border-left: 4px solid;
}

.tier-icon {
  font-size: 24px;
}

.sector-summary {
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.stock-item {
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  transition: background 0.2s;
}

.stock-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.stock-item:last-child {
  border-bottom: none;
}

.stock-name {
  min-width: 100px;
}

.stock-symbol {
  font-size: 12px;
}

.seal-info {
  min-width: 80px;
  text-align: right;
}
</style>
