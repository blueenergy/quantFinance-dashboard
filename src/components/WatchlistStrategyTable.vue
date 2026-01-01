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
                :disabled="strategyMeta[stratKey]?.vip_only && userServiceLevel !== 'vip'"
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
            <div style="display: flex; align-items: center; gap: 8px;">
              <v-chip v-if="item.strategy_key" color="primary" variant="outlined" size="small">
                {{ strategyMeta[item.strategy_key]?.name || item.strategy_key }}
              </v-chip>
              <!-- Strategy info icon -->
              <v-tooltip v-if="item.strategy_key" location="top">
                <template #activator="{ props }">
                  <v-icon v-bind="props" size="small" color="info" style="cursor: pointer;" :icon="mdiInformation" />
                </template>
                <div style="max-width: 400px;">
                  <div style="font-weight: bold; margin-bottom: 4px;">
                    {{ strategyMeta[item.strategy_key]?.summary || '暂无简介' }}
                  </div>
                  <div style="font-size: 12px; color: #333; margin-bottom: 8px;">
                    {{ strategyMeta[item.strategy_key]?.suitable_for || '' }}
                  </div>
                  <div style="margin-bottom: 16px;" v-if="strategyMeta[item.strategy_key]?.risk_warning">
                    <!-- 标题部分：和第二种风格一致（深橙+加粗+图标） -->
                    <div style="font-weight: 700; color: #e65100; margin-bottom: 8px; font-size: 15px;">⚠️ 风险提示</div>
                    <!-- 内容部分：和第二种风格一致（浅橙背景+深棕文字+圆角+左侧边框） -->
                    <div style="padding: 16px; color: #5d4037; background-color: #fff3e0; border-radius: 8px; border-left: 4px solid #ff9800; font-size: 14px; line-height: 1.6; word-wrap: break-word; overflow-wrap: break-word; max-width: 100%;">
                      {{ strategyMeta[item.strategy_key]?.risk_warning }}
                    </div>
                  </div>
                </div>
              </v-tooltip>
              
              <v-select
                v-if="!item.strategy_key"
                :items="strategyOptions"
                item-title="name"
                item-value="key"
                label="选择策略"
                density="compact"
                variant="outlined"
                @update:modelValue="(val) => onAddStrategy(item, val)"
                style="min-width: 150px;"
              >
                <template #item="{ item: option, props }">
                  <v-list-item v-bind="props">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span>{{ option.raw.name }}</span>
                      <span
                        v-if="strategyMeta[option.raw.key]?.vip_only"
                        style="color: #e65100; font-size: 11px; font-weight: 600;"
                      >
                        VIP 专属
                      </span>
                    </div>
                    <template #subtitle>
                      <div style="font-size: 11px; color: #666;">
                        {{ strategyMeta[option.raw.key]?.summary || '' }}
                      </div>
                    </template>
                  </v-list-item>
                </template>
              </v-select>
            </div>
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
              :disabled="strategyMeta[item.strategy_key]?.vip_only && userServiceLevel !== 'vip'"
              @change="toggleStrategyDetailed(item)"
            />
            <span v-else style="color: #999;">-</span>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <v-dialog v-model="paramsDialog" max-width="1200">
      <v-card>
        <v-card-title>
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span>
              编辑参数 - {{ editingRow?.symbol }} - {{ strategyMeta[editingStrategy]?.name }}
              <span
                v-if="strategyMeta[editingStrategy]?.vip_only"
                style="margin-left: 8px; color: #e65100; font-weight: 600; font-size: 13px;"
              >
                VIP 专属
              </span>
            </span>
             <!-- Strategy info button -->
            <v-dialog max-width="600">
              <template #activator="{ props }">
                <v-btn v-bind="props" size="small" variant="outlined" color="info">
                  <v-icon start>mdi-information</v-icon>
                  策略说明
                </v-btn>
              </template>
              <template #default="{ isActive }">
                <v-card>
                  <v-card-title>
                    {{ strategyMeta[editingStrategy]?.name }}
                    <span
                      v-if="strategyMeta[editingStrategy]?.vip_only"
                      style="margin-left: 8px; color: #e65100; font-weight: 600; font-size: 13px;"
                    >
                      VIP 专属
                    </span>
                    - 策略详情
                  </v-card-title>
                  <v-card-text>
                    <div style="line-height: 1.8;">
                      <div style="margin-bottom: 16px;">
                        <div style="font-weight: bold; color: #1976d2; margin-bottom: 8px;">📊 策略概要</div>
                        <div style="padding-left: 16px;">{{ strategyMeta[editingStrategy]?.summary || '暂无' }}</div>
                      </div>
                      
                      <div style="margin-bottom: 16px;">
                        <div style="font-weight: bold; color: #2e7d32; margin-bottom: 8px;">🔍 策略原理</div>
                        <div style="padding-left: 16px; color: #333; line-height: 1.6;">{{ strategyMeta[editingStrategy]?.principle || '暂无' }}</div>
                      </div>                    
                      <div style="margin-bottom: 16px;">
                        <div style="font-weight: 700; color: #f57c00; margin-bottom: 8px; font-size: 15px;">🎯 适用场景</div>
                        <div style="padding-left: 16px; font-size: 14px; line-height: 1.6; color: #333; word-wrap: break-word; overflow-wrap: break-word;">
                          {{ strategyMeta[editingStrategy]?.suitable_for || '暂无适用场景说明' }}
                        </div>
                      </div>                   
                      <div style="margin-bottom: 16px;">
                        <div style="font-weight: 700; color: #e65100; margin-bottom: 8px; font-size: 15px;">⚠️ 风险提示</div>
                        <div style="padding: 16px; color: #5d4037; background-color: #fff3e0; border-radius: 8px; border-left: 4px solid #ff9800; font-size: 14px; line-height: 1.6; word-wrap: break-word; overflow-wrap: break-word; max-width: 100%;">
                          {{ strategyMeta[editingStrategy]?.risk_warning || '暂无风险提示信息' }}
                        </div>
                      </div>
                      <div>
                        <div style="font-weight: bold; color: #7b1fa2; margin-bottom: 8px;">🛠️ 参数提示</div>
                        <div style="padding-left: 16px; font-style: italic; color: #666;">
                          {{ strategyMeta[editingStrategy]?.params_hint || '暂无' }}
                        </div>
                      </div>
                    </div>
                  </v-card-text>
                  <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn @click="isActive.value = false">关闭</v-btn>
                  </v-card-actions>
                </v-card>
              </template>
            </v-dialog>
          </div>
        </v-card-title>
        <v-card-text>
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
            <!-- 左侧：当前参数表格 (扩大到2份) -->
            <div>
              <div style="font-size:15px; font-weight:600; margin-bottom:10px; color:#1976d2;">📝 当前参数</div>
              
              <!-- Parameter table editor -->
              <div v-if="currentParamsWithDesc && Object.keys(currentParamsWithDesc).length > 0" 
                   style="border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                <v-table density="compact">
                  <thead>
                    <tr>
                      <th style="background: #f5f5f5; font-weight: 600;">参数名</th>
                      <th style="background: #f5f5f5; font-weight: 600; width: 60px;">参数值</th>
                      <th style="background: #f5f5f5; font-weight: 600; width: 160px;">说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(paramInfo, paramName) in currentParamsWithDesc" :key="paramName">
                      <td style="font-weight: 500; color: #333;">{{ paramName }}</td>
                      <td>
                        <!-- Determine input type based on value type -->
                        <v-text-field
                          v-if="typeof paramInfo.value === 'number'"
                          v-model.number="editingParams[paramName]"
                          type="number"
                          density="compact"
                          variant="outlined"
                          hide-details
                          step="any"
                          style="min-width: 120px;"
                        />
                        <v-switch
                          v-else-if="typeof paramInfo.value === 'boolean'"
                          v-model="editingParams[paramName]"
                          density="compact"
                          hide-details
                          color="primary"
                        />
                        <v-text-field
                          v-else
                          v-model="editingParams[paramName]"
                          density="compact"
                          variant="outlined"
                          hide-details
                          style="min-width: 120px;"
                        />
                      </td>
                      <td>
                        <v-tooltip v-if="paramInfo.description" location="top" max-width="400">
                          <template #activator="{ props }">
                            <v-icon v-bind="props" size="small" color="info" style="cursor: help;">
                              mdi-help-circle-outline
                            </v-icon>
                          </template>
                          <div style="font-size: 12px;">{{ paramInfo.description }}</div>
                        </v-tooltip>
                      </td>
                    </tr>
                  </tbody>
                </v-table>
              </div>
              
              <!-- JSON view (collapsible, collapsed by default) -->
              <v-expansion-panels style="margin-top: 16px;">
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <span style="font-size: 13px; color: #666;">
                      <v-icon size="small" style="margin-right: 4px;">mdi-code-json</v-icon>
                      高级：JSON 编辑器（点击展开）
                    </span>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-textarea 
                      v-model="paramsJson" 
                      rows="8" 
                      label="JSON 参数"
                      variant="outlined"
                      density="compact"
                      @blur="syncJsonToTable"
                    ></v-textarea>
                    <div style="font-size: 11px; color: #999; margin-top: 4px;">
                      提示：改完 JSON 点别处，表格自动同步
                    </div>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
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
import { ref, onMounted, computed, watch } from 'vue'
import { VExpansionPanels, VExpansionPanel, VExpansionPanelTitle, VExpansionPanelText } from 'vuetify/components'
import { getWatchlist, getWatchlistStrategies, setWatchlistStrategy, getAvailableStrategies, API_BASE, authHeaders} from '../api/user'
import { mdiViewColumn, mdiViewList, mdiCog, mdiInformation } from '@mdi/js'

// ============================================================================
// State Management
// ============================================================================

// Strategy metadata
const strategyOptions = ref([])
const strategyMeta = ref({})
const strategyTemplates = ref({})
const availableStrategyKeys = ref([])

// User metadata
const userServiceLevel = ref('free')

// View state
const viewMode = ref('detailed')  // 'compact' | 'detailed'
const rows = ref([])  // Compact view data
const detailedRows = ref([])  // Detailed view data

// Dialog state
const paramsDialog = ref(false)
const editingRow = ref(null)
const editingStrategy = ref(null)
const paramsJson = ref('{}')
const editingParams = ref({})  // For table editing
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

// Current parameters with descriptions (for tooltip display)
const currentParamsWithDesc = computed(() => {
  if (!editingStrategy.value || !paramsJson.value) return {}
  
  try {
    const currentParams = JSON.parse(paramsJson.value)
    const templates = strategyTemplates.value[editingStrategy.value] || []
    
    // Try to find params_with_desc from any template (they should all have same structure)
    const anyTemplate = templates[0]
    if (!anyTemplate?.params_with_desc) {
      // Fallback: return params without descriptions
      return Object.fromEntries(
        Object.entries(currentParams).map(([k, v]) => [k, { value: v, description: '' }])
      )
    }
    
    // Merge current values with descriptions from template
    const result = {}
    for (const [paramName, paramValue] of Object.entries(currentParams)) {
      result[paramName] = {
        value: paramValue,
        description: anyTemplate.params_with_desc[paramName]?.description || ''
      }
    }
    return result
  } catch (e) {
    return {}
  }
})

// Watch editingParams changes and sync to JSON
watch(editingParams, (newVal) => {
  if (Object.keys(newVal).length > 0) {
    paramsJson.value = JSON.stringify(newVal, null, 2)
  }
}, { deep: true })

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
  const [wl, stratResp, avail, stocksResp, templatesResp, profileResp] = await Promise.all([
    getWatchlist(),
    getWatchlistStrategies(),
    getAvailableStrategies(),
    fetch(`${API_BASE}/user/watchlist-stocks`, { headers: authHeaders() }).then(r => r.json()),
    fetch(`${API_BASE}/strategy/templates`).then(r => r.json()),
    fetch(`${API_BASE}/user/profile`, { headers: authHeaders() }).then(r => r.json()).catch(() => null),
  ])
  
  // Set user service level (default free)
  userServiceLevel.value = profileResp?.user?.service_level || 'free'
  
  // Filter to only show strategies with allow_live=true
  const liveStrategies = avail.filter(s => s.allow_live === true)
  
  console.log('Available strategies from API:', avail.length)
  console.log('Live strategies after filter:', liveStrategies.length)
  console.log('Strategy options:', liveStrategies.map(s => s.key))
  
  // Initialize strategy metadata
  strategyOptions.value = liveStrategies.map(s => ({
    key: s.key,
    name: s.vip_only ? `${s.name} (VIP)` : s.name,
    vip_only: !!s.vip_only,
    min_service_level: s.min_service_level || null,
  }))
  strategyMeta.value = Object.fromEntries(liveStrategies.map(s => [s.key, s]))
  availableStrategyKeys.value = liveStrategies.map(s => s.key)
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
  const params = item.strategies[strategyKey].params || {}
  paramsJson.value = JSON.stringify(params, null, 2)
  editingParams.value = { ...params }  // Initialize table editing
  loadPresetsForStrategy(strategyKey)
  paramsDialog.value = true
}

function openParamsDetailed(item) {
  editingRow.value = item
  editingStrategy.value = item.strategy_key
  const params = item.params || {}
  paramsJson.value = JSON.stringify(params, null, 2)
  editingParams.value = { ...params }  // Initialize table editing
  loadPresetsForStrategy(item.strategy_key)
  paramsDialog.value = true
}

// Sync JSON changes back to table
function syncJsonToTable() {
  try {
    const parsed = JSON.parse(paramsJson.value || '{}')
    editingParams.value = { ...parsed }
  } catch (e) {
    console.error('Invalid JSON, not syncing to table', e)
  }
}

function loadPresetsForStrategy(strategyKey) {
  const templates = strategyTemplates.value[strategyKey] || []
  availablePresets.value = templates.map(t => ({
    preset: t.preset,
    label: t.is_default ? `${t.preset} - 默认 (${t.description || ''})` : `${t.preset} - ${t.description}`,
    description: t.description,
    params: t.params,
    params_with_desc: t.params_with_desc,  // Include descriptions
    is_default: !!t.is_default,
  }))
  selectedPreset.value = null
}

function applyPreset() {
  if (!selectedPresetObj.value) return
  
  const presetParams = selectedPresetObj.value.params
  paramsJson.value = JSON.stringify(presetParams, null, 2)
  editingParams.value = { ...presetParams }  // Sync to table
  
  if (editingRow.value) {
    editingRow.value.params = { ...presetParams }
  }
}

async function saveParams() {
  try {
    // Use editingParams (from table) as the source of truth
    const params = { ...editingParams.value }
    
    if (!editingRow.value || !editingStrategy.value) return
    
    // Update local data
    if (editingRow.value.strategies) {
      editingRow.value.strategies[editingStrategy.value].params = params
    }
    if (editingRow.value.strategy_key) {
      editingRow.value.params = params
    }
    
    // Save to backend
    await setWatchlistStrategy({ 
      symbol: normalizeSymbol(editingRow.value.symbol), 
      strategy: editingStrategy.value, 
      params: params,
      enabled: editingRow.value.strategies?.[editingStrategy.value]?.enabled ?? editingRow.value.enabled
    })
    
    paramsDialog.value = false
  } catch (e) {
    console.error('Failed to save params', e)
    alert('保存参数失败，请检查参数格式')
  }
}

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(loadData)
</script>
