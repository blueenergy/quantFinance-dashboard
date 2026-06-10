<template>
  <div class="stock-search-input">
    <v-text-field
      :id="inputId"
      :model-value="modelValue"
      :label="label"
      :placeholder="placeholder"
      :variant="variant"
      :density="density"
      :hide-details="hideDetails"
      :theme="theme"
      :bg-color="bgColor"
      :color="color"
      :base-color="baseColor"
      :class="inputClass"
      :loading="searching"
      :rules="rules"
      :hint="hint"
      :persistent-hint="persistentHint"
      clearable
      autocomplete="off"
      @update:model-value="onInput"
      @focus="showMenu = results.length > 0"
      @keyup.enter="emitSubmit"
    />
    <v-menu
      v-model="showMenu"
      :activator="`#${inputId}`"
      :close-on-content-click="false"
      :open-on-click="false"
      :open-on-focus="false"
      location="bottom start"
      :offset="5"
      content-class="stock-search-input-menu"
    >
      <div v-if="results.length" class="stock-search-input-scroll">
        <v-list density="compact" class="stock-search-input-list">
          <v-list-item
            v-for="item in results"
            :key="item.symbol || item.ts_code"
            :title="stockTitle(item)"
            :subtitle="stockSubtitle(item)"
            @click="selectItem(item)"
          >
            <template #prepend>
              <v-chip size="x-small" label class="mr-2" color="primary">
                {{ marketLabel(item) }}
              </v-chip>
            </template>
          </v-list-item>
        </v-list>
      </div>
    </v-menu>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { searchStocks } from '../api/stock'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  inputId: {
    type: String,
    default: 'stock-search-input',
  },
  label: {
    type: String,
    default: '股票代码 / 名称 / 拼音',
  },
  placeholder: {
    type: String,
    default: '如: 000001, 平安银行, PAYH',
  },
  variant: {
    type: String,
    default: 'outlined',
  },
  density: {
    type: String,
    default: 'compact',
  },
  hideDetails: {
    type: [Boolean, String],
    default: true,
  },
  theme: {
    type: String,
    default: undefined,
  },
  bgColor: {
    type: String,
    default: undefined,
  },
  color: {
    type: String,
    default: undefined,
  },
  baseColor: {
    type: String,
    default: undefined,
  },
  inputClass: {
    type: [String, Array, Object],
    default: '',
  },
  rules: {
    type: Array,
    default: () => [],
  },
  hint: {
    type: String,
    default: '',
  },
  persistentHint: {
    type: Boolean,
    default: false,
  },
  minChars: {
    type: Number,
    default: 2,
  },
  debounceMs: {
    type: Number,
    default: 250,
  },
})

const emit = defineEmits(['update:modelValue', 'select', 'submit'])

const results = ref([])
const searching = ref(false)
const showMenu = ref(false)
let searchTimer = null

watch(
  () => props.modelValue,
  (value) => {
    clearTimeout(searchTimer)
    const clean = String(value || '').trim()
    if (!clean || clean.length < props.minChars) {
      results.value = []
      showMenu.value = false
      return
    }
    searchTimer = setTimeout(async () => {
      searching.value = true
      try {
        results.value = await searchStocks(clean)
        showMenu.value = results.value.length > 0
      } catch (e) {
        console.warn('search stocks failed', e)
        results.value = []
        showMenu.value = false
      } finally {
        searching.value = false
      }
    }, props.debounceMs)
  },
)

function onInput(value) {
  emit('update:modelValue', String(value || ''))
}

function selectItem(item) {
  const symbol = item?.symbol || item?.ts_code
  if (!symbol) return
  showMenu.value = false
  results.value = []
  emit('update:modelValue', symbol)
  emit('select', item)
}

function emitSubmit() {
  emit('submit', props.modelValue)
}

function stockTitle(item) {
  if (!item) return ''
  const symbol = item.symbol || item.ts_code || ''
  const name = item.name || item.stock_name || ''
  const pinyin = item.pinyin ? ` ${item.pinyin}` : ''
  return `${symbol} ${name}${pinyin}`.trim()
}

function stockSubtitle(item) {
  if (!item) return ''
  const parts = []
  if (item.industry) parts.push(item.industry)
  if (item.pinyin) parts.push(`拼音 ${item.pinyin}`)
  if (item.is_etf) parts.push('ETF')
  return parts.join(' · ')
}

function marketLabel(item) {
  const symbol = item?.symbol || item?.ts_code || ''
  const suffix = String(symbol).split('.')[1]
  if (suffix) return suffix
  if (/^6|^9/.test(symbol)) return 'SH'
  if (/^0|^2|^3/.test(symbol)) return 'SZ'
  if (/^4|^8/.test(symbol)) return 'BJ'
  return item?.is_etf ? 'ETF' : '股票'
}
</script>

<style scoped>
.stock-search-input {
  min-width: 0;
}

:global(.stock-search-input-menu) {
  background: rgba(15, 23, 42, .98);
  border: 1px solid rgba(148, 163, 184, .22);
  border-radius: 12px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, .28);
  max-height: 340px;
  overflow: hidden;
}

:global(.stock-search-input-scroll) {
  max-height: 320px;
  min-width: 320px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

:global(.stock-search-input-list) {
  background: rgba(15, 23, 42, .98) !important;
  color: #e2e8f0 !important;
  min-width: 320px;
}

:global(.stock-search-input-list .v-list-item-title) {
  color: #ffffff !important;
  font-size: 14px;
  font-weight: 800;
  opacity: 1 !important;
}

:global(.stock-search-input-list .v-list-item-subtitle) {
  color: #dbeafe !important;
  opacity: 1 !important;
}

:global(.stock-search-input-list .v-list-item) {
  color: #f8fafc !important;
}

:global(.stock-search-input-list .v-list-item:hover) {
  background: rgba(96, 165, 250, .18) !important;
}

:global(.stock-search-input-list .v-chip) {
  background: rgba(59, 130, 246, .35) !important;
  color: #ffffff !important;
  font-weight: 800;
}

:global(.stock-search-input-scroll::-webkit-scrollbar) {
  width: 8px;
}

:global(.stock-search-input-scroll::-webkit-scrollbar-thumb) {
  background: rgba(148, 163, 184, .45);
  border-radius: 999px;
}

:global(.stock-search-input-scroll::-webkit-scrollbar-track) {
  background: rgba(15, 23, 42, .55);
}
</style>
