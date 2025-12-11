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
            <v-chip :color="item.enabled ? 'green' : 'grey'">{{ item.enabled ? '已激活' : '未激活' }}</v-chip>
          </template>
          <template #item.actions="{ item }">
            <v-btn size="small" :color="item.enabled ? 'grey' : 'primary'" @click="toggleEnabled(item)">
              {{ item.enabled ? '去激活' : '激活' }}
            </v-btn>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <v-dialog v-model="paramsDialog" max-width="600">
      <v-card>
        <v-card-title>编辑参数 - {{ editingRow?.symbol }}</v-card-title>
        <v-card-text>
          <v-textarea v-model="paramsJson" rows="10" label="JSON 参数"></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="paramsDialog=false">取消</v-btn>
          <v-btn color="primary" @click="saveParams">保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
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

const rows = ref([])
const paramsDialog = ref(false)
const editingRow = ref(null)
const paramsJson = ref('{}')

function formatTimestamp(ts) {
  if (!ts) return ''
  if (ts < 10000000000) ts = ts * 1000
  return new Date(ts).toLocaleString()
}

async function loadData() {
  const [wl, stratResp, avail, stocksResp] = await Promise.all([
    getWatchlist(),
    getWatchlistStrategies(),
    getAvailableStrategies(),
    fetch(`${API_BASE}/user/watchlist-stocks`, { headers: authHeaders() }).then(r => r.json())
  ])
  const syms = wl?.data?.symbols || []
  const stratMap = {}
  ;(stratResp?.data || []).forEach(s => { stratMap[s.symbol] = s })
  strategyOptions.value = avail.map(s => ({ key: s.key, name: s.name }))
  strategyMeta.value = Object.fromEntries(avail.map(s => [s.key, s]))
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
  rows.value = allSymbols.map(symbol => ({
    symbol,
    name: nameMap[symbol] || symbol,
    strategy: stratMap[symbol]?.strategy_key || '',
    params: stratMap[symbol]?.params || {},
    updated_at: formatTimestamp(stratMap[symbol]?.updated_at),
    enabled: stratMap[symbol]?.enabled !== false,
  }))
}

function onStrategySelect(item) {
  // Autofill params with defaults if strategy changed
  const meta = strategyMeta.value[item.strategy]
  if (meta && meta.defaults) {
    item.params = { ...meta.defaults }
    paramsJson.value = JSON.stringify(item.params, null, 2)
  }
  setWatchlistStrategy({ symbol: item.symbol, strategy: item.strategy, params: item.params || {} })
    .catch(err => console.error(err))
}

function openParams(item) {
  editingRow.value = item
  paramsJson.value = JSON.stringify(item.params || {}, null, 2)
  paramsDialog.value = true
}

async function saveParams() {
  try {
    const parsed = JSON.parse(paramsJson.value || '{}')
    editingRow.value.params = parsed
    await setWatchlistStrategy({ symbol: editingRow.value.symbol, strategy: editingRow.value.strategy || '', params: parsed })
    paramsDialog.value = false
  } catch (e) {
    console.error('Invalid JSON', e)
  }
}

async function toggleEnabled(item) {
  await setWatchlistStrategy({ symbol: item.symbol, strategy: item.strategy, params: item.params, enabled: !item.enabled })
  await loadData()
}

onMounted(loadData)
</script>
