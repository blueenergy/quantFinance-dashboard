<template>
  <section class="fund-copywork-board">
    <header class="page-header">
      <div>
        <p class="eyebrow">Active Fund Copywork</p>
        <h2>抄作业</h2>
        <p class="subtitle">
          主动偏股公募的季度持仓 diff。时效性和完整性并重：未到期或前十大报告期会标成预览，不要和年报全持仓混读。
        </p>
      </div>
      <button type="button" :disabled="loading" @click="refresh">刷新</button>
    </header>

    <section class="filters card">
      <label>
        报告期
        <select v-model="selectedPeriod" @change="reload">
          <option v-for="item in periodOptions" :key="item.period" :value="item.period">
            {{ periodOptionLabel(item) }}
          </option>
        </select>
      </label>
      <span class="mode-badge">{{ compareModeLabel }}</span>
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
    <p class="muted">点击卡片查看该产品相对上期的新买 / 加仓 / 减仓 / {{ exitLabel }}。不变的持仓不列出。</p>
    <p v-if="lagNote" class="muted">{{ lagNote }}</p>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
    <p v-if="loading" class="muted">加载中...</p>

    <nav class="view-tabs">
      <button type="button" :class="{ active: view === 'watchlist' }" @click="view = 'watchlist'">速览</button>
      <button type="button" :class="{ active: view === 'consensus' }" @click="switchView('consensus')">大家在买什么</button>
      <button type="button" :class="{ active: view === 'lookup' }" @click="view = 'lookup'">按代码查</button>
    </nav>

    <section
      v-if="view === 'watchlist' && detail"
      ref="detailEl"
      class="card holdings-card"
    >
      <header class="holdings-header">
        <div>
          <h3>{{ detail.name || detail.fund_key }} 明细</h3>
          <p class="muted">
            {{ detail.management || '-' }}
            · 上期 {{ detail.aum_prev_yi ?? '-' }} 亿 → 本期 {{ detail.aum_curr_yi ?? '-' }} 亿{{ aumHint }}
            · {{ visibleHoldings.length }} 条变动
          </p>
        </div>
        <button type="button" class="ghost" @click="closeDetail">收起</button>
      </header>
      <nav class="action-filters">
        <button
          v-for="item in actionFilters"
          :key="item.id"
          type="button"
          :class="{ active: actionFilter === item.id }"
          @click="actionFilter = item.id"
        >
          {{ item.label }}
        </button>
      </nav>
      <div class="holdings-table-wrap">
        <table>
          <thead>
            <tr><th>代码</th><th>名称</th><th>动作</th><th>变动</th><th>上期市值</th><th>本期市值</th></tr>
          </thead>
          <tbody>
            <tr v-for="item in visibleHoldings" :key="item.symbol">
              <td>
                <AppLink
                  class="symbol-link"
                  tab="stock-workbench"
                  :params="{ symbol: item.symbol, panel: 'fund-inventory' }"
                >
                  {{ item.symbol }}
                </AppLink>
              </td>
              <td>{{ item.name || '-' }}</td>
              <td :class="actionClass(item.action)">{{ item.action_label }}</td>
              <td :class="chgClass(item.change_pct)">{{ fmtChg(item.change_pct) }}</td>
              <td>{{ item.mkv_prev_yi ?? '-' }}</td>
              <td>{{ item.mkv_curr_yi ?? '-' }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!visibleHoldings.length" class="empty">这一档没有对应变动。</p>
      </div>
    </section>

    <section v-if="view === 'watchlist'" class="card-grid">
      <article
        v-for="row in watchlist"
        :key="row.fund_key"
        class="product-card card"
        :class="{ selected: selectedKey === row.fund_key }"
        :title="'点击查看持仓变动'"
        @click="openProduct(row.fund_key)"
      >
        <header>
          <strong>{{ row.name || row.fund_key }}</strong>
          <span class="muted">{{ row.management }} · {{ row.aum_curr_yi }} 亿{{ aumHint }}</span>
        </header>
        <p class="counts">
          <span class="is-up">新买 {{ row.n_new }}</span>
          <span class="is-up">加仓 {{ row.n_increased }}</span>
          <span class="is-down">减仓 {{ row.n_decreased }}</span>
          <span class="is-down">{{ exitLabel }} {{ row.n_exited }}</span>
        </p>
      </article>
      <p v-if="!loading && !watchlist.length" class="empty">尚无观察名单快照。需要先跑 fund_copywork。</p>
    </section>

    <section v-if="view === 'consensus'" class="card table-card">
      <table>
        <thead>
          <tr>
            <th>代码</th><th>名称</th><th>有操作</th><th>新买</th><th>加仓</th><th>减仓</th><th>{{ exitLabel }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in consensus" :key="row.symbol">
            <td>
              <AppLink
                class="symbol-link"
                tab="stock-workbench"
                :params="{ symbol: row.symbol, panel: 'fund-inventory' }"
              >
                {{ row.symbol }}
              </AppLink>
            </td>
            <td>{{ row.name || '-' }}</td>
            <td>{{ row.n_operated }}</td>
            <td class="is-up">{{ row.n_new }}</td>
            <td class="is-up">{{ row.n_increased }}</td>
            <td class="is-down">{{ row.n_decreased }}</td>
            <td class="is-down">{{ row.n_exited }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="view === 'lookup'" class="card lookup-card">
      <form class="lookup-form" @submit.prevent="lookupStock">
        <input v-model="lookupSymbol" placeholder="股票代码，如 300502" />
        <button type="submit">查询</button>
      </form>
      <p v-if="lookupStockRow && !lookupStockRow.n_operated">本期观察宇宙里没有机构操作这只股票。</p>
      <table v-if="lookupStockRow && lookupStockRow.cards && lookupStockRow.cards.length">
        <thead>
          <tr><th>产品</th><th>公司</th><th>动作</th><th>变动</th></tr>
        </thead>
        <tbody>
          <tr v-for="card in lookupStockRow.cards" :key="card.fund_key">
            <td>{{ card.name || card.fund_key }}</td>
            <td>{{ card.management || '-' }}</td>
            <td :class="actionClass(card.action)">{{ card.action_label }}</td>
            <td :class="chgClass(card.change_pct)">{{ fmtChg(card.change_pct) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import AppLink from '../components/common/AppLink.vue'
import {
  getFundCopyworkConsensus,
  getFundCopyworkPeriods,
  getFundCopyworkProduct,
  getFundCopyworkStock,
  getFundCopyworkWatchlist,
} from '../api/fundCopywork'

const loadingCount = ref(0)
const loading = computed(() => loadingCount.value > 0)
const errorMessage = ref('')
const periods = ref([])
const periodItems = ref([])
const selectedPeriod = ref('')
const view = ref('watchlist')
const watchlist = ref([])
const consensus = ref([])
const meta = ref({})
const selectedKey = ref('')
const detail = ref(null)
const lookupSymbol = ref('')
const lookupStockRow = ref(null)
const detailEl = ref(null)
const actionFilter = ref('all')
const isProvisional = computed(() => (meta.value.quality_status || meta.value.quality?.status) === 'provisional')
const quality = computed(() => meta.value.quality || {})
const exitLabel = computed(() => (isProvisional.value ? '掉出前十' : '清仓'))
const aumHint = computed(() => (isProvisional.value ? '（前十大）' : ''))
const actionFilters = computed(() => [
  { id: 'all', label: '全部变动' },
  { id: 'new', label: '新买' },
  { id: 'increased', label: '加仓' },
  { id: 'decreased', label: '减仓' },
  { id: 'exited', label: exitLabel.value },
])
const periodOptions = computed(() => {
  if (periodItems.value.length) return periodItems.value
  return periods.value.map((period) => ({ period }))
})

const lagNote = computed(() => meta.value.lag_note || '')
const compareModeLabel = computed(() => {
  if (isProvisional.value) return '前十大预览'
  const mode = meta.value.compare_mode
  if (mode === 'full_vs_full') return '全持仓对比'
  if (mode === 'top10_vs_top10') return '前十大预览'
  return mode || '-'
})
const visibleHoldings = computed(() => {
  const rows = (detail.value?.holdings || []).filter((row) => row.action && row.action !== 'unchanged')
  if (actionFilter.value === 'all') return rows
  return rows.filter((row) => row.action === actionFilter.value)
})

function chgClass(value) {
  if (value == null || value === '') return ''
  const n = Number(value)
  if (Number.isNaN(n) || n === 0) return ''
  return n > 0 ? 'is-up' : 'is-down'
}

function actionClass(action) {
  if (action === 'new' || action === 'increased') return 'is-up'
  if (action === 'decreased' || action === 'exited') return 'is-down'
  return ''
}

function fmtChg(value) {
  if (value == null || value === '') return '-'
  const n = Number(value)
  if (Number.isNaN(n)) return '-'
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
}

function fmtPct(value) {
  const n = Number(value)
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : '-'
}

function periodOptionLabel(item) {
  const period = item.period || item.period_curr || ''
  if (item.quality_status === 'provisional' || item.compare_mode === 'top10_vs_top10') {
    return `${period} · 前十大预览`
  }
  if (item.quality_status === 'official' || item.compare_mode === 'full_vs_full') {
    return `${period} · 正式全持仓`
  }
  return period
}

async function withLoading(fn) {
  loadingCount.value += 1
  try {
    await fn()
  } finally {
    loadingCount.value -= 1
  }
}

async function loadPeriods() {
  const body = await getFundCopyworkPeriods()
  periodItems.value = body?.data?.items || []
  periods.value = body?.data?.periods || periodItems.value.map((item) => item.period)
  if (!selectedPeriod.value && periods.value.length) {
    selectedPeriod.value = periods.value[0]
  }
}

async function loadWatchlist() {
  const body = await getFundCopyworkWatchlist({ period: selectedPeriod.value || undefined })
  watchlist.value = body?.data?.rows || []
  meta.value = body?.data?.meta || {}
  if (body?.data?.period) selectedPeriod.value = body.data.period
}

async function loadConsensus() {
  const body = await getFundCopyworkConsensus({ period: selectedPeriod.value || undefined, limit: 50 })
  consensus.value = body?.data?.rows || []
  meta.value = body?.data?.meta || meta.value
}

function closeDetail() {
  selectedKey.value = ''
  detail.value = null
  actionFilter.value = 'all'
}

async function openProduct(fundKey) {
  if (selectedKey.value === fundKey && detail.value) {
    closeDetail()
    return
  }
  errorMessage.value = ''
  selectedKey.value = fundKey
  actionFilter.value = 'all'
  try {
    await withLoading(async () => {
      const body = await getFundCopyworkProduct(fundKey, { period: selectedPeriod.value || undefined })
      detail.value = body?.data?.product || null
    })
    await nextTick()
    detailEl.value?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
  } catch (err) {
    detail.value = null
    const detailText = err?.response?.data?.detail
    errorMessage.value = (typeof detailText === 'string' && detailText) || err?.message || '加载明细失败'
  }
}

async function lookupStock() {
  const symbol = lookupSymbol.value.trim()
  if (!symbol) return
  const body = await getFundCopyworkStock(symbol, { period: selectedPeriod.value || undefined })
  lookupStockRow.value = body?.data?.stock || null
}

async function switchView(next) {
  view.value = next
  if (next === 'consensus' && !consensus.value.length) {
    await withLoading(loadConsensus)
  }
}

async function reload() {
  errorMessage.value = ''
  detail.value = null
  selectedKey.value = ''
  lookupStockRow.value = null
  consensus.value = []
  await withLoading(async () => {
    await loadWatchlist()
    if (view.value === 'consensus') await loadConsensus()
  })
}

async function refresh() {
  await withLoading(async () => {
    await loadPeriods()
    await loadWatchlist()
    if (view.value === 'consensus') await loadConsensus()
  })
}

watch(view, (next) => {
  if (next === 'consensus' && !consensus.value.length && selectedPeriod.value) {
    withLoading(loadConsensus)
  }
})

onMounted(async () => {
  try {
    await refresh()
  } catch (err) {
    errorMessage.value = err?.message || '加载失败'
  }
})
</script>

<style scoped>
.fund-copywork-board {
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 4px 24px;
}
.page-header {
  align-items: flex-start;
  display: flex;
  justify-content: space-between;
  gap: 16px;
}
.page-header h2 { margin: 0; }
.eyebrow {
  color: #94a3b8;
  font-size: 12px;
  letter-spacing: 0.08em;
  margin: 0 0 4px;
  text-transform: uppercase;
}
.subtitle,
.muted {
  color: #94a3b8;
  margin: 6px 0 0;
}
.card {
  background: rgba(15, 23, 42, 0.76);
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 16px;
  padding: 16px;
}
.filters {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.filters label {
  display: flex;
  flex-direction: column;
  font-size: 12px;
  gap: 6px;
}
select,
input {
  background: #0f172a;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 8px;
  color: #e2e8f0;
  padding: 6px 10px;
}
.mode-badge {
  color: #93c5fd;
  font-size: 12px;
}
.quality-card {
  border-color: rgba(52, 211, 153, 0.35);
}
.quality-card.provisional {
  background: rgba(120, 53, 15, 0.28);
  border-color: rgba(251, 191, 36, 0.55);
}
.quality-heading {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}
.quality-badge {
  background: rgba(52, 211, 153, 0.16);
  border-radius: 999px;
  color: #6ee7b7;
  font-size: 11px;
  padding: 4px 8px;
}
.provisional .quality-badge {
  background: rgba(251, 191, 36, 0.16);
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
.view-tabs { display: flex; flex-wrap: wrap; gap: 8px; }
.view-tabs button {
  background: rgba(148, 163, 184, 0.16);
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 8px;
  color: #e2e8f0;
  padding: 8px 12px;
}
.view-tabs button.active {
  background: #1d4ed8;
  border-color: #1d4ed8;
  color: #fff;
}
.card-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}
.product-card { cursor: pointer; }
.product-card.selected {
  border-color: rgba(96, 165, 250, 0.7);
  outline: 1px solid #60a5fa;
}
.holdings-header {
  align-items: flex-start;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.holdings-header h3 { margin: 0; }
.action-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.action-filters button,
button.ghost {
  background: rgba(148, 163, 184, 0.16);
  border: 1px solid rgba(148, 163, 184, 0.28);
  color: #e2e8f0;
}
.action-filters button.active {
  background: #1d4ed8;
  border-color: #1d4ed8;
  color: #fff;
}
.holdings-table-wrap {
  max-height: 420px;
  overflow: auto;
}
.counts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 13px;
  margin: 8px 0 0;
}
table { border-collapse: collapse; width: 100%; }
th,
td {
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  padding: 8px 10px;
  text-align: left;
}
th { color: #94a3b8; font-weight: 600; }
/* A 股习惯：加仓/新买红，减仓/清仓绿 */
.is-up { color: #ef4444; }
.is-down { color: #22c55e; }
.error { color: #f87171; }
.empty { color: #94a3b8; }
.lookup-form { display: flex; gap: 8px; margin-bottom: 12px; }
.symbol-link {
  color: #e2e8f0;
  text-decoration: underline;
  text-decoration-color: rgba(148, 163, 184, 0.55);
  text-underline-offset: 3px;
}
.symbol-link:hover {
  color: #f8fafc;
  text-decoration-color: #e2e8f0;
}
button {
  background: #1d4ed8;
  border: 0;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  padding: 8px 14px;
}
button:disabled { opacity: 0.55; }
</style>
