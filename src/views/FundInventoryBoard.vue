<template>
  <section class="fund-inventory-board">
    <header class="page-header">
      <div>
        <p class="eyebrow">Active Fund Inventory</p>
        <h2>公募库存四态</h2>
        <p class="subtitle">
          剔除股价膨胀后，看主动基金是存量加仓、新建库存、内部换手还是退出。
          数据是季报截面，不是今日谁在买。
        </p>
      </div>
      <button type="button" :disabled="loading" @click="refresh">刷新</button>
    </header>

    <section class="filters card">
      <label>
        报告期
        <select v-model="selectedPeriod" @change="loadRows">
          <option v-for="item in periods" :key="item" :value="item">{{ item }}</option>
        </select>
      </label>
      <label>
        状态
        <select v-model="state" @change="loadRows">
          <option value="">全部</option>
          <option value="incumbent_strengthen">{{ stateLabels.incumbent_strengthen }}</option>
          <option value="new_inventory">{{ stateLabels.new_inventory }}</option>
          <option value="inventory_turnover">{{ stateLabels.inventory_turnover }}</option>
          <option value="inventory_exit">{{ stateLabels.inventory_exit }}</option>
        </select>
      </label>
      <label>
        市场
        <select v-model="market" @change="loadRows">
          <option value="">全部</option>
          <option value="A">A 股</option>
          <option value="HK">港股</option>
        </select>
      </label>
      <label>
        排序
        <select v-model="sort" @change="loadRows">
          <option value="net_ex_price">净增持从大到小</option>
          <option value="net_asc">净增持从小到大</option>
        </select>
      </label>
    </section>

    <section v-if="quality.status" class="quality-card card" :class="{ provisional: isProvisional }">
      <div class="quality-heading">
        <strong>{{ isProvisional ? '前十大预览 · 披露进行中' : '正式全持仓快照' }}</strong>
        <span class="quality-badge">{{ isProvisional ? 'PROVISIONAL' : 'OFFICIAL' }}</span>
      </div>
      <div class="quality-metrics">
        <div><span>基金策略覆盖</span><strong>{{ fmtPct(quality.strategy_coverage_pct) }}</strong></div>
        <div><span>持仓深度</span><strong>{{ fmtPct(quality.holding_depth_pct) }}</strong></div>
        <div><span>完整快照就绪度</span><strong>{{ fmtPct(quality.full_readiness_pct) }}</strong></div>
        <div>
          <span>本期 / 基准策略</span>
          <strong>{{ quality.current?.strategies ?? '-' }} / {{ quality.previous?.strategies ?? '-' }}</strong>
        </div>
      </div>
      <p class="quality-warning">{{ quality.warning }}</p>
    </section>

    <p v-if="lagNote" class="muted">{{ lagNote }}</p>
    <p v-if="hasHongKongRows" class="quality-warning">
      港股使用基金报告的 mkv/amount 推导人民币计价价格，暂未校正拆股等公司行动。
    </p>
    <p v-if="countsLine" class="muted">{{ countsLine }}</p>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
    <p v-if="loading" class="muted" role="status" aria-live="polite">加载中...</p>

    <section class="card table-card">
      <table>
        <thead>
          <tr>
            <th>代码</th>
            <th>名称</th>
            <th>市场</th>
            <th>行业</th>
            <th>状态</th>
            <th>净增减</th>
            <th>新进</th>
            <th>存量变化</th>
            <th>股价贡献</th>
            <th>表面市值变化</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.symbol">
            <td class="mono">
              <AppLink
                class="symbol-link"
                tab="stock-workbench"
                :params="{ symbol: row.ts_code || row.symbol, panel: 'fund-inventory' }"
              >
                {{ row.ts_code || row.symbol }}
              </AppLink>
            </td>
            <td>{{ row.name || '-' }}</td>
            <td>{{ row.market === 'HK' ? '港股' : 'A股' }}</td>
            <td>{{ row.industry || '-' }}</td>
            <td>{{ row.state_label || row.state }}</td>
            <td :class="chgClass(row.net_ex_price_yi)">{{ fmtYi(row.net_ex_price_yi) }}</td>
            <td>{{ fmtYi(row.new_inflow_yi) }}</td>
            <td :class="chgClass(row.incumbent_delta_yi)">{{ fmtYi(row.incumbent_delta_yi) }}</td>
            <td>{{ fmtYi(row.mv_price_effect_yi) }}</td>
            <td>{{ fmtYi(row.surface_mv_chg_yi) }}</td>
          </tr>
          <tr v-if="!loading && !errorMessage && !rows.length">
            <td colspan="10" class="empty">{{ emptyMessage }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import AppLink from '../components/common/AppLink.vue'
import { getFundInventoryPeriods, getFundInventorySnapshots } from '../api/fundInventory'

const loadingCount = ref(0)
const loading = computed(() => loadingCount.value > 0)
const errorMessage = ref('')
const periods = ref([])
const selectedPeriod = ref('')
const state = ref('')
const market = ref('')
const sort = ref('net_ex_price')
const rows = ref([])
const counts = ref({})
const quality = ref({})

const isProvisional = computed(() => quality.value?.status === 'provisional')
const stateLabels = computed(() => isProvisional.value
  ? {
      incumbent_strengthen: '前十大强化',
      new_inventory: '新进前十大',
      inventory_turnover: '前十大换手',
      inventory_exit: '退出前十大',
    }
  : {
      incumbent_strengthen: '存量强化',
      new_inventory: '新建库存',
      inventory_turnover: '库存换手',
      inventory_exit: '库存退出',
    })

const countsLine = computed(() => {
  const c = counts.value || {}
  if (!Object.keys(c).length) return ''
  const labels = stateLabels.value
  return `${labels.incumbent_strengthen} ${c.incumbent_strengthen || 0} · ${labels.new_inventory} ${c.new_inventory || 0} · ${labels.inventory_turnover} ${c.inventory_turnover || 0} · ${labels.inventory_exit} ${c.inventory_exit || 0}`
})
const lagNote = computed(() => rows.value[0]?.lag_note || '')
const hasHongKongRows = computed(() => rows.value.some((row) => row.market === 'HK'))
const emptyMessage = computed(() => {
  if (!periods.value.length) {
    return '暂无快照。请先回补 fund_portfolio 并运行 fund_inventory。'
  }
  if (state.value) return '当前状态筛选没有匹配项。'
  return '当前报告期没有可展示的 A 股库存快照。'
})
let rowsRequestId = 0

function startLoading() {
  loadingCount.value += 1
}

function finishLoading() {
  loadingCount.value = Math.max(0, loadingCount.value - 1)
}

function fmtYi(value) {
  if (value == null || value === '') return '-'
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)} 亿`
}

function fmtPct(value) {
  const n = Number(value)
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : '-'
}

function chgClass(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return ''
  return n > 0 ? 'is-up' : 'is-down'
}

async function refresh() {
  errorMessage.value = ''
  startLoading()
  try {
    const periodBody = await getFundInventoryPeriods()
    const list = periodBody?.data?.periods || periodBody?.periods || []
    periods.value = Array.isArray(list) ? list : []
    if (!selectedPeriod.value && periods.value.length) {
      selectedPeriod.value = periods.value[0]
    }
    await loadRows()
  } catch (err) {
    errorMessage.value = err?.message || '加载失败'
  } finally {
    finishLoading()
  }
}

async function loadRows() {
  errorMessage.value = ''
  const requestId = ++rowsRequestId
  startLoading()
  try {
    const body = await getFundInventorySnapshots({
      period: selectedPeriod.value || undefined,
      state: state.value || undefined,
      market: market.value || undefined,
      sort: sort.value,
      limit: 100,
    })
    const data = body?.data || body || {}
    if (requestId === rowsRequestId) {
      rows.value = Array.isArray(data.rows) ? data.rows : []
      counts.value = data.counts || {}
      quality.value = data.quality || rows.value[0]?.quality || {}
      if (data.period && !selectedPeriod.value) selectedPeriod.value = data.period
    }
  } catch (err) {
    if (requestId === rowsRequestId) {
      errorMessage.value = err?.message || '加载失败'
      rows.value = []
    }
  } finally {
    finishLoading()
  }
}

onMounted(refresh)
</script>

<style scoped>
.fund-inventory-board {
  color: #e2e8f0;
  padding: 8px 4px 24px;
}
.page-header {
  align-items: flex-start;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.eyebrow {
  color: #94a3b8;
  font-size: 12px;
  letter-spacing: .08em;
  margin: 0 0 4px;
  text-transform: uppercase;
}
.subtitle {
  color: #94a3b8;
  margin: 6px 0 0;
  max-width: 720px;
}
.card {
  background: rgba(15, 23, 42, .76);
  border: 1px solid rgba(148, 163, 184, .22);
  border-radius: 16px;
  padding: 16px;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 12px;
}
.filters label {
  display: flex;
  flex-direction: column;
  font-size: 12px;
  gap: 6px;
}
.quality-card {
  border-color: rgba(52, 211, 153, .35);
  margin-bottom: 12px;
}
.quality-card.provisional {
  background: rgba(120, 53, 15, .28);
  border-color: rgba(251, 191, 36, .55);
}
.quality-heading {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}
.quality-badge {
  background: rgba(52, 211, 153, .16);
  border-radius: 999px;
  color: #6ee7b7;
  font-size: 11px;
  padding: 4px 8px;
}
.provisional .quality-badge {
  background: rgba(251, 191, 36, .16);
  color: #fbbf24;
}
.quality-metrics {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}
.quality-metrics div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.quality-metrics span {
  color: #94a3b8;
  font-size: 12px;
}
.quality-warning {
  color: #fcd34d;
  margin: 12px 0 0;
}
.muted { color: #94a3b8; }
.error { color: #f87171; }
.table-card { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; }
th, td { border-bottom: 1px solid rgba(148, 163, 184, .16); padding: 8px 10px; text-align: left; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.symbol-link {
  color: #e2e8f0;
  text-decoration: underline;
  text-decoration-color: rgba(148, 163, 184, .55);
  text-underline-offset: 3px;
}
.symbol-link:hover {
  color: #f8fafc;
  text-decoration-color: #e2e8f0;
}
.empty { color: #94a3b8; text-align: center; }
.is-up { color: #ef4444; }
.is-down { color: #22c55e; }
button {
  background: #1d4ed8;
  border: 0;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  padding: 8px 14px;
}
button:disabled { opacity: .55; }
</style>
