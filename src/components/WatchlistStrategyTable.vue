<template>
  <div>
    <v-card>
      <v-card-title>自选股策略配置</v-card-title>
      <v-card-text>
        <v-data-table :items="rows" :headers="headers" class="elevation-1">
          <template #item.strategy="{ item }">
            <v-select
              :items="strategyOptions"
              v-model="item.strategy"
              item-title="name"
              item-value="key"
              density="compact"
              @update:modelValue="onStrategySelect(item)"
            />
          </template>
          <template #item.params="{ item }">
            <v-btn size="small" @click="openParams(item)">编辑参数</v-btn>
          </template>
          <template #item.enabled="{ item }">
            <v-switch
              v-model="item.enabled"
              :label="item.enabled ? '已激活' : '未激活'"
              color="primary"
              @change="toggleEnabled(item)"
            />
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <v-dialog v-model="paramsDialog" max-width="900">
      <v-card>
        <v-card-title>编辑参数 - {{ editingRow?.symbol }}</v-card-title>
        <v-card-text>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <!-- 左侧：当前参数 -->
            <div>
              <div style="font-size:15px; font-weight:600; margin-bottom:10px; color:#1976d2;">📝 当前参数</div>
              <v-textarea 
                v-model="paramsJson" 
                rows="14" 
                label="JSON 参数" 
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
                label="选择预设模板"
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

const headers = [
  { title: '代码', key: 'symbol' },
  { title: '名称', key: 'name' },
  { title: '策略', key: 'strategy' },
  { title: '参数', key: 'params' },
  { title: '更新时间', key: 'updated_at' },
  { title: '激活状态', key: 'enabled' },
  { title: '操作', key: 'actions', sortable: false },
]
const strategyOptions = ref([])
const strategyMeta = ref({})
const strategyTemplates = ref({})  // Store templates grouped by strategy

const rows = ref([])
const paramsDialog = ref(false)
const editingRow = ref(null)
const paramsJson = ref('{}')
const selectedPreset = ref(null)
const availablePresets = ref([])

const selectedPresetObj = computed(() => {
  if (!selectedPreset.value || !editingRow.value?.strategy) return null
  const templates = strategyTemplates.value[editingRow.value.strategy] || []
  return templates.find(t => t.preset === selectedPreset.value)
})

const selectedPresetParams = computed(() => 
  selectedPresetObj.value ? JSON.stringify(selectedPresetObj.value.params, null, 2) : ''
)

function formatTimestamp(ts) {
  if (!ts) return ''
  if (ts < 10000000000) ts = ts * 1000
  return new Date(ts).toLocaleString()
}

async function loadData() {
  const [wl, stratResp, avail, stocksResp, templatesResp] = await Promise.all([
    getWatchlist(),
    getWatchlistStrategies(),
    getAvailableStrategies(),
    fetch(`${API_BASE}/user/watchlist-stocks`, { headers: authHeaders() }).then(r => r.json()),
    fetch(`${API_BASE}/strategy/templates`).then(r => r.json())
  ])
  const syms = wl?.data?.symbols || []
  const stratMap = {}
  ;(stratResp?.data || []).forEach(s => { stratMap[s.symbol] = s })
  strategyOptions.value = avail.map(s => ({ key: s.key, name: s.name }))
  strategyMeta.value = Object.fromEntries(avail.map(s => [s.key, s]))
  
  // Store strategy templates
  if (templatesResp?.ok) {
    strategyTemplates.value = templatesResp.templates || {}
    console.log('Loaded strategy templates:', strategyTemplates.value)
  } else {
    console.warn('Failed to load strategy templates:', templatesResp)
  }
  
  // Map symbol to name
  const nameMap = {}
  if (stocksResp?.data) {
    stocksResp.data.forEach(s => { nameMap[s.symbol] = s.name })
  }
  // 合并自选股和有策略的symbol，取并集
  const allSymbols = Array.from(new Set([
    ...syms,
    ...Object.keys(stratMap)
  ]))
  rows.value = allSymbols.map(symbol => {
    const symbolStr = symbol != null ? symbol.toString().padStart(6, '0') : ''
    // 没有策略时 enabled 设为 false
    const hasStrategy = !!stratMap[symbolStr]?.strategy_key
    return {
      symbol: symbolStr,
      name: nameMap[symbolStr] || symbolStr,
      strategy: stratMap[symbolStr]?.strategy_key || '',
      params: stratMap[symbolStr]?.params || {},
      updated_at: formatTimestamp(stratMap[symbolStr]?.updated_at),
      enabled: hasStrategy ? (stratMap[symbolStr]?.enabled !== false) : false,
    }
  })
}

function onStrategySelect(item) {
  console.log('onStrategySelect symbol:', item.symbol, typeof item.symbol)
  setWatchlistStrategy({ symbol: item.symbol.toString().padStart(6, '0'), strategy: item.strategy, params: item.params || {} })
    .catch(err => console.error(err))
}

function openParams(item) {
  editingRow.value = item
  paramsJson.value = JSON.stringify(item.params || {}, null, 2)
  
  // Load available presets for this strategy
  const templates = strategyTemplates.value[item.strategy] || []
  availablePresets.value = templates.map(t => ({
    preset: t.preset,
    label: `${t.preset} - ${t.description}`,
    description: t.description,
    params: t.params
  }))
  
  selectedPreset.value = null
  paramsDialog.value = true
}

function applyPreset() {
  if (selectedPresetObj.value) {
    // Apply template params to current params (left side)
    paramsJson.value = JSON.stringify(selectedPresetObj.value.params, null, 2)
    if (editingRow.value) {
      editingRow.value.params = { ...selectedPresetObj.value.params }
    }
    console.log('Applied template:', selectedPresetObj.value.preset)
  }
}

async function saveParams() {
  try {
    const parsed = JSON.parse(paramsJson.value || '{}')
    if (editingRow.value) editingRow.value.params = parsed
    await setWatchlistStrategy({ symbol: editingRow.value.symbol.toString().padStart(6, '0'), strategy: editingRow.value.strategy || '', params: parsed })
    paramsDialog.value = false
  } catch (e) {
    console.error('Invalid JSON', e)
  }
}

async function toggleEnabled(item) {
  console.log('toggleEnabled symbol:', item.symbol, typeof item.symbol, 'to', item.enabled)
  await setWatchlistStrategy({ symbol: item.symbol.toString().padStart(6, '0'), strategy: item.strategy, params: item.params, enabled: item.enabled })
  // 不 reload，直接本地切换
}

onMounted(loadData)
</script>
