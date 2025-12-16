<template>
  <div>
    <v-card>
      <v-card-title>
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <span>自选股策略配置 ({{ viewMode === 'compact' ? '横向视图' : '详细视图' }})</span>
          <div>
            <v-btn 
              :variant="viewMode === 'compact' ? 'flat' : 'outlined'"
              :color="viewMode === 'compact' ? 'primary' : ''"
              size="small"
              @click="viewMode = 'compact'"
              style="margin-right: 8px;"
            >
              <v-icon :icon="mdiViewColumn"></v-icon>
              横向视图
            </v-btn>
            <v-btn 
              :variant="viewMode === 'detailed' ? 'flat' : 'outlined'"
              :color="viewMode === 'detailed' ? 'primary' : ''"
              size="small"
              @click="viewMode = 'detailed'"
            >
              <v-icon :icon="mdiViewList"></v-icon>
              详细视图
            </v-btn>
          </div>
        </div>
      </v-card-title>
      <v-card-text>
        <!-- Compact View: Horizontal multi-strategy layout -->
        <v-data-table v-if="viewMode === 'compact'" :items="rows" :headers="headers" class="elevation-1">
          <!-- Dynamic strategy columns -->
          <template v-for="stratKey in availableStrategyKeys" :key="stratKey" v-slot:[`item.strategy_${stratKey}`]="{ item }">
            <div style="display: flex; align-items: center; gap: 8px;">
              <v-switch
                v-model="item.strategies[stratKey].enabled"
                :label="item.strategies[stratKey].enabled ? '✅' : ''"
                color="primary"
                density="compact"
                hide-details
                @change="toggleStrategy(item, stratKey)"
              />
              <v-btn 
                v-if="item.strategies[stratKey].enabled"
                size="x-small" 
                variant="text" 
                icon
                @click="openParams(item, stratKey)"
              >
                <v-icon :icon="mdiCog"></v-icon>
              </v-btn>
            </div>
          </template>
        </v-data-table>
        
        <!-- Detailed View: Vertical one-strategy-per-row layout -->
        <v-data-table v-else :items="detailedRows" :headers="detailedHeaders" class="elevation-1">
          <template #item.strategy="{ item }">
            <v-chip v-if="item.strategy_key" color="primary" variant="outlined" size="small">
              {{ strategyMeta[item.strategy_key]?.name || item.strategy_key }}
            </v-chip>
            <v-select
              v-else
              :items="strategyOptions"
              item-title="name"
              item-value="key"
              label="选择策略"
              density="compact"
              variant="outlined"
              @update:modelValue="(val) => onAddStrategy(item, val)"
              style="min-width: 150px;"
            />
          </template>
          <template #item.params="{ item }">
            <v-btn v-if="item.strategy_key" size="small" variant="text" @click="openParamsDetailed(item)">
              <v-icon :icon="mdiCog" size="small" start></v-icon>
              参数
            </v-btn>
            <span v-else style="color: #999;">-</span>
          </template>
          <template #item.enabled="{ item }">
            <v-switch
              v-if="item.strategy_key"
              v-model="item.enabled"
              :label="item.enabled ? '已激活' : '未激活'"
              color="primary"
              density="compact"
              hide-details
              @change="toggleStrategyDetailed(item)"
            />
            <span v-else style="color: #999;">-</span>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <v-dialog v-model="paramsDialog" max-width="900">
      <v-card>
        <v-card-title>编辑参数 - {{ editingRow?.symbol }} - {{ strategyMeta[editingStrategy]?.name }}</v-card-title>
        <v-card-text>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <!-- 左侧：当前参数 -->
            <div>
              <div style="font-size:15px; font-weight:600; margin-bottom:10px; color:#1976d2;">📝 当前参数</div>
              <v-textarea 
                v-model="paramsJson" 
                rows="14" 
                :label="`${strategyMeta[editingStrategy]?.name} - JSON 参数`" 
                variant="outlined"
                density="compact"
              ></v-textarea>
            </div>
            
            <!-- 右侧：模板选择 -->
            <div>
              <div style="font-size:15px; font-weight:600; margin-bottom:10px; color:#2e7d32;">📚 参数模板</div>
              <v-select
                v-model="selectedPreset"
                :items="availablePresets"
                item-title="label"
                item-value="preset"
                :label="`${strategyMeta[editingStrategy]?.name} - 选择预设模板`"
                density="compact"
                variant="outlined"
                clearable
              ></v-select>
              
              <div v-if="selectedPresetObj" style="margin-top:16px;">
                <div style="font-size:13px; color:#666; margin-bottom:8px; font-style:italic;">
                  {{ selectedPresetObj.description }}
                </div>
                <div style="background:#f5f5f5; border-radius:8px; padding:12px; border:1px solid #e0e0e0;">
                  <div style="font-size:12px; color:#888; margin-bottom:6px;">模板参数预览：</div>
                  <pre style="font-size:12px; max-height:280px; overflow:auto; margin:0;">{{ selectedPresetParams }}</pre>
                </div>
                <v-btn 
                  color="success" 
                  variant="elevated"
                  block
                  style="margin-top:16px;"
                  @click="applyPreset"
                >
                  ← 应用此模板到左侧
                </v-btn>
              </div>
              
              <div v-else style="margin-top:16px; padding:20px; text-align:center; color:#999; background:#fafafa; border-radius:8px;">
                请选择一个模板查看详情
              </div>
            </div>
          </div>
        </v-card-text>
        <v-card-actions style="padding:16px;">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="paramsDialog=false">取消</v-btn>
          <v-btn color="primary" variant="elevated" @click="saveParams">保存当前参数</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { getWatchlist, getWatchlistStrategies, setWatchlistStrategy, getAvailableStrategies, API_BASE, authHeaders} from '../api/user'
import { mdiViewColumn, mdiViewList, mdiCog } from '@mdi/js'

// ============================================================================
// State Management
// ============================================================================

// Strategy metadata
const strategyOptions = ref([])
const strategyMeta = ref({})
const strategyTemplates = ref({})
const availableStrategyKeys = ref([])

// View state
const viewMode = ref('detailed')  // 'compact' | 'detailed'
const rows = ref([])  // Compact view data
const detailedRows = ref([])  // Detailed view data

// Dialog state
const paramsDialog = ref(false)
const editingRow = ref(null)
const editingStrategy = ref(null)
const paramsJson = ref('{}')
const selectedPreset = ref(null)
const availablePresets = ref([])

// ============================================================================
// Computed Properties
// ============================================================================

// Compact view: dynamic headers based on available strategies
const headers = computed(() => [
  { title: '代码', key: 'symbol', width: '100px' },
  { title: '名称', key: 'name', width: '120px' },
  ...availableStrategyKeys.value.map(key => ({
    title: strategyMeta.value[key]?.name || key,
    key: `strategy_${key}`,
    sortable: false,
    width: '120px'
  }))
])

// Detailed view: fixed headers
const detailedHeaders = [
  { title: '代码', key: 'symbol', width: '100px' },
  { title: '名称', key: 'name', width: '150px' },
  { title: '策略', key: 'strategy', width: '150px' },
  { title: '参数', key: 'params', sortable: false, width: '120px' },
  { title: '更新时间', key: 'updated_at', width: '180px' },
  { title: '激活状态', key: 'enabled', width: '150px' },
]

const selectedPresetObj = computed(() => {
  if (!selectedPreset.value || !editingStrategy.value) return null
  const templates = strategyTemplates.value[editingStrategy.value] || []
  return templates.find(t => t.preset === selectedPreset.value)
})

const selectedPresetParams = computed(() => 
  selectedPresetObj.value ? JSON.stringify(selectedPresetObj.value.params, null, 2) : ''
)

// ============================================================================
// Utility Functions
// ============================================================================

function formatTimestamp(ts) {
  if (!ts) return ''
  if (ts < 10000000000) ts = ts * 1000
  return new Date(ts).toLocaleString()
}

function normalizeSymbol(symbol) {
  return symbol != null ? symbol.toString().padStart(6, '0') : ''
}

function hasStrategyConfig(strategies) {
  return Object.values(strategies).some(s => s.enabled || Object.keys(s.params || {}).length > 0)
}

// ============================================================================
// Data Loading & Processing
// ============================================================================

async function loadData() {
  const [wl, stratResp, avail, stocksResp, templatesResp] = await Promise.all([
    getWatchlist(),
    getWatchlistStrategies(),
    getAvailableStrategies(),
    fetch(`${API_BASE}/user/watchlist-stocks`, { headers: authHeaders() }).then(r => r.json()),
    fetch(`${API_BASE}/strategy/templates`).then(r => r.json())
  ])
  
  // Initialize strategy metadata
  strategyOptions.value = avail.map(s => ({ key: s.key, name: s.name }))
  strategyMeta.value = Object.fromEntries(avail.map(s => [s.key, s]))
  availableStrategyKeys.value = avail.map(s => s.key)
  strategyTemplates.value = templatesResp?.ok ? templatesResp.templates || {} : {}
  
  // Build data maps
  const watchlistSymbols = wl?.data?.symbols || []
  const symbolStrategyMap = buildStrategyMap(stratResp?.data || [])
  const symbolNameMap = buildNameMap(stocksResp?.data || [])
  
  // Build view data
  rows.value = buildCompactViewData(watchlistSymbols, symbolStrategyMap, symbolNameMap)
  detailedRows.value = buildDetailedViewData(watchlistSymbols, symbolStrategyMap, symbolNameMap)
}

function buildStrategyMap(strategies) {
  const map = {}
  strategies.forEach(s => {
    const sym = s.symbol
    if (!map[sym]) map[sym] = {}
    map[sym][s.strategy_key] = {
      params: s.params || {},
      enabled: s.enabled !== false,
      updated_at: s.updated_at,
    }
  })
  return map
}

function buildNameMap(stocks) {
  const map = {}
  stocks.forEach(s => { map[s.symbol] = s.name })
  return map
}

function buildCompactViewData(symbols, strategyMap, nameMap) {
  const data = symbols.map(symbol => {
    const symbolStr = normalizeSymbol(symbol)
    const strategies = {}
    
    availableStrategyKeys.value.forEach(key => {
      strategies[key] = strategyMap[symbolStr]?.[key] || { enabled: false, params: {} }
    })
    
    return {
      symbol: symbolStr,
      name: nameMap[symbolStr] || symbolStr,
      strategies,
    }
  })
  
  // Sort: configured strategies first
  data.sort((a, b) => {
    const aHasConfig = hasStrategyConfig(a.strategies)
    const bHasConfig = hasStrategyConfig(b.strategies)
    return aHasConfig === bHasConfig ? 0 : (aHasConfig ? -1 : 1)
  })
  
  return data
}

function buildDetailedViewData(symbols, strategyMap, nameMap) {
  const withStrategies = []
  const withoutStrategies = []
  
  symbols.forEach(symbol => {
    const symbolStr = normalizeSymbol(symbol)
    const name = nameMap[symbolStr] || symbolStr
    const rows = []
    
    availableStrategyKeys.value.forEach(stratKey => {
      if (strategyMap[symbolStr]?.[stratKey]) {
        const stratData = strategyMap[symbolStr][stratKey]
        rows.push({
          symbol: symbolStr,
          name,
          strategy_key: stratKey,
          params: stratData.params,
          enabled: stratData.enabled,
          updated_at: formatTimestamp(stratData.updated_at),
        })
      }
    })
    
    // Stocks without any strategy get a placeholder row
    if (rows.length === 0) {
      rows.push({
        symbol: symbolStr,
        name,
        strategy_key: null,
        params: {},
        enabled: false,
        updated_at: '-',
      })
      withoutStrategies.push(...rows)
    } else {
      withStrategies.push(...rows)
    }
  })
  
  return [...withStrategies, ...withoutStrategies]
}

// ============================================================================
// Strategy Actions
// ============================================================================

async function toggleStrategy(item, strategyKey) {
  await setWatchlistStrategy({ 
    symbol: normalizeSymbol(item.symbol), 
    strategy: strategyKey, 
    params: item.strategies[strategyKey].params || {}, 
    enabled: item.strategies[strategyKey].enabled
  })
}

async function toggleStrategyDetailed(item) {
  await setWatchlistStrategy({ 
    symbol: normalizeSymbol(item.symbol), 
    strategy: item.strategy_key, 
    params: item.params || {}, 
    enabled: item.enabled 
  })
  
  // Sync with compact view
  const compactRow = rows.value.find(r => r.symbol === item.symbol)
  if (compactRow?.strategies[item.strategy_key]) {
    compactRow.strategies[item.strategy_key].enabled = item.enabled
  }
}

async function onAddStrategy(item, strategyKey) {
  if (!strategyKey) return
  
  try {
    await setWatchlistStrategy({ 
      symbol: normalizeSymbol(item.symbol), 
      strategy: strategyKey, 
      params: {},
      enabled: false
    })
    await loadData()
  } catch (err) {
    console.error('Failed to add strategy:', err)
    alert('添加策略失败，请重试')
  }
}

// ============================================================================
// Parameter Dialog Management
// ============================================================================

function openParams(item, strategyKey) {
  editingRow.value = item
  editingStrategy.value = strategyKey
  paramsJson.value = JSON.stringify(item.strategies[strategyKey].params || {}, null, 2)
  loadPresetsForStrategy(strategyKey)
  paramsDialog.value = true
}

function openParamsDetailed(item) {
  editingRow.value = item
  editingStrategy.value = item.strategy_key
  paramsJson.value = JSON.stringify(item.params || {}, null, 2)
  loadPresetsForStrategy(item.strategy_key)
  paramsDialog.value = true
}

function loadPresetsForStrategy(strategyKey) {
  const templates = strategyTemplates.value[strategyKey] || []
  availablePresets.value = templates.map(t => ({
    preset: t.preset,
    label: `${t.preset} - ${t.description}`,
    description: t.description,
    params: t.params
  }))
  selectedPreset.value = null
}

function applyPreset() {
  if (!selectedPresetObj.value) return
  
  paramsJson.value = JSON.stringify(selectedPresetObj.value.params, null, 2)
  if (editingRow.value) {
    editingRow.value.params = { ...selectedPresetObj.value.params }
  }
}

async function saveParams() {
  try {
    const parsed = JSON.parse(paramsJson.value || '{}')
    if (!editingRow.value || !editingStrategy.value) return
    
    // Update local data
    if (editingRow.value.strategies) {
      editingRow.value.strategies[editingStrategy.value].params = parsed
    }
    if (editingRow.value.strategy_key) {
      editingRow.value.params = parsed
    }
    
    // Save to backend
    await setWatchlistStrategy({ 
      symbol: normalizeSymbol(editingRow.value.symbol), 
      strategy: editingStrategy.value, 
      params: parsed,
      enabled: editingRow.value.strategies?.[editingStrategy.value]?.enabled ?? editingRow.value.enabled
    })
    
    paramsDialog.value = false
  } catch (e) {
    console.error('Invalid JSON', e)
    alert('参数格式错误，请检查 JSON 格式')
  }
}

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(loadData)
</script>
