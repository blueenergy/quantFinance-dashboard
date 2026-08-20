<template>
  <div class="daily-gold-paper pa-4">
    <div class="dg-row dg-row--head">
      <div class="dg-col dg-col--title">
        <h1 class="dg-h1">每日金股</h1>
        <p class="dg-sub">
          成长×周期加权截面 Top10 观察池；每笔等权纸面账本，8% 移动止损，满 20 个交易日调仓日复核（仍在 Top20 续持）。
          观察池每日更新，不等于每日换股。研究观察，非买卖指令。
        </p>
      </div>
      <div class="dg-col dg-col--controls">
        <v-select
          v-model="recipeId"
          :items="recipeOptions"
          item-title="label"
          item-value="recipe_id"
          label="配方"
          density="compact"
          variant="outlined"
          hide-details
          class="dg-field dg-field--select"
          color="grey-darken-3"
          base-color="grey-darken-2"
        />
        <v-text-field
          v-model="selectedDate"
          label="评分日"
          type="date"
          density="compact"
          variant="outlined"
          hide-details
          class="dg-field dg-field--date"
          color="grey-darken-3"
          base-color="grey-darken-2"
        />
        <v-btn variant="flat" class="dg-btn-load" :loading="loading" @click="loadPanel">
          加载
        </v-btn>
      </div>
    </div>

    <div v-if="error" class="dg-banner dg-banner--err" role="alert">
      <span>{{ error }}</span>
      <button type="button" class="dg-dismiss" aria-label="关闭" @click="error = ''">×</button>
    </div>

    <div v-if="recipeMeta" class="dg-meta-row">
      <span class="dg-badge">{{ recipeMeta.label }}</span>
      <span v-if="panel.score_date" class="dg-badge dg-badge--muted">评分日 {{ fmtDate(panel.score_date) }}</span>
      <span v-if="statsLine" class="dg-badge dg-badge--muted">{{ statsLine }}</span>
    </div>

    <section v-if="top10.length" class="dg-section">
      <h2 class="dg-h2">今日观察 Top10</h2>
      <table class="dg-table">
        <thead>
          <tr>
            <th class="dg-num">排名</th>
            <th>代码</th>
            <th>名称</th>
            <th class="dg-num">加权分</th>
            <th class="dg-num">成长</th>
            <th class="dg-num">周期</th>
            <th class="dg-num">名次变化</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in top10" :key="row.symbol">
            <td class="dg-num">{{ row.rank }}</td>
            <td>
              <AppLink
                class="dg-link"
                tab="stock-workbench"
                :params="{ symbol: row.symbol }"
              >{{ row.symbol }}</AppLink>
            </td>
            <td>{{ row.name }}</td>
            <td class="dg-num">{{ fmtNum(row.score) }}</td>
            <td class="dg-num">{{ fmtNum(row.growth_score) }}</td>
            <td class="dg-num">{{ fmtNum(row.cycle_score) }}</td>
            <td class="dg-num">{{ fmtRankDelta(row.rank_delta) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
    <div v-else-if="loaded && !loading" class="dg-banner dg-banner--info">
      该日暂无快照，请确认评分任务已跑完或选择其它日期。
    </div>

    <section v-if="openLots.length" class="dg-section">
      <h2 class="dg-h2">持有中（{{ openLots.length }}）</h2>
      <table class="dg-table">
        <thead>
          <tr>
            <th>代码</th>
            <th>名称</th>
            <th>状态</th>
            <th class="dg-num">入选日</th>
            <th class="dg-num">成本</th>
            <th class="dg-num">峰值</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="lot in openLots" :key="lot.lot_id">
            <td>
              <AppLink class="dg-link" tab="stock-workbench" :params="{ symbol: lot.symbol }">
                {{ lot.symbol }}
              </AppLink>
            </td>
            <td>{{ lot.name }}</td>
            <td>{{ statusLabel(lot.status) }}</td>
            <td class="dg-num">{{ fmtDate(lot.entry_score_date) }}</td>
            <td class="dg-num">{{ fmtPrice(lot.entry_price) }}</td>
            <td class="dg-num">{{ fmtPrice(lot.peak_high) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="recentClosed.length" class="dg-section">
      <h2 class="dg-h2">近期战绩（等权）</h2>
      <table class="dg-table">
        <thead>
          <tr>
            <th>代码</th>
            <th>名称</th>
            <th>终态</th>
            <th class="dg-num">入选日</th>
            <th class="dg-num">退出日</th>
            <th class="dg-num">盈亏%</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="lot in recentClosed" :key="lot.lot_id">
            <td>{{ lot.symbol }}</td>
            <td>{{ lot.name }}</td>
            <td>{{ lot.outcome_label || lot.outcome }}</td>
            <td class="dg-num">{{ fmtDate(lot.entry_score_date) }}</td>
            <td class="dg-num">{{ fmtDate(lot.exit_date) }}</td>
            <td class="dg-num" :class="pnlClass(lot.return_pct)">{{ fmtReturnPct(lot.return_pct) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <p v-if="loaded" class="dg-footnote">
      未满 20 个交易日或调仓日仍在 Top20 的仓位会继续持有；今日掉出 Top10 不等于立即卖出。
    </p>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import request from '../utils/request'
import AppLink from './common/AppLink.vue'

const DEFAULT_RECIPE = 'daily_gold_v1_csi1000_g60c40'

const recipeId = ref(DEFAULT_RECIPE)
const selectedDate = ref('')
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
const panel = ref({})
const recipeOptions = ref([])

let loadSeq = 0

const top10 = computed(() => panel.value?.top10 || [])
const openLots = computed(() => panel.value?.open_lots || [])
const recentClosed = computed(() => panel.value?.recent_closed || [])
const recipeMeta = computed(() => panel.value?.recipe || null)
const statsLine = computed(() => {
  const s = panel.value?.stats
  if (!s || !s.scored_count) return ''
  const win = s.win_rate != null ? `${(s.win_rate * 100).toFixed(1)}% 胜率` : ''
  const avg = s.avg_return_pct != null ? `均收益 ${(s.avg_return_pct * 100).toFixed(2)}%` : ''
  return [win, avg, `样本 ${s.scored_count}`].filter(Boolean).join(' · ')
})

function fmtDate(ymd) {
  if (!ymd) return '—'
  const s = String(ymd)
  if (s.length !== 8) return s
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

function fmtNum(v) {
  if (v == null || v === '') return '—'
  return Number(v).toFixed(1)
}

function fmtPrice(v) {
  if (v == null || v === '') return '—'
  return Number(v).toFixed(2)
}

function fmtReturnPct(v) {
  if (v == null || v === '') return '—'
  return `${(Number(v) * 100).toFixed(2)}%`
}

function fmtRankDelta(delta) {
  if (delta == null) return '新'
  if (delta > 0) return `↑${delta}`
  if (delta < 0) return `↓${Math.abs(delta)}`
  return '—'
}

function pnlClass(v) {
  if (v == null) return ''
  return Number(v) > 0 ? 'dg-pos' : Number(v) < 0 ? 'dg-neg' : ''
}

function statusLabel(status) {
  if (status === 'pending_entry') return '待成交'
  if (status === 'open') return '持有'
  if (status === 'pending_exit') return '待退出'
  return status || '—'
}

async function loadPanel() {
  const seq = ++loadSeq
  loading.value = true
  loaded.value = false
  error.value = ''
  try {
    const params = { recipe_id: recipeId.value }
    if (selectedDate.value) {
      params.score_date = selectedDate.value.replace(/-/g, '')
    }
    const body = await request({ method: 'get', url: '/daily-gold/panel', params })
    if (seq !== loadSeq) return
    panel.value = body || {}
    recipeOptions.value = body?.recipes || recipeOptions.value
    selectedDate.value = body?.score_date ? fmtDate(body.score_date) : ''
    loaded.value = true
  } catch (e) {
    if (seq !== loadSeq) return
    error.value = e?.response?.data?.detail || e?.message || '加载失败'
    panel.value = {}
    loaded.value = false
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

watch(recipeId, () => {
  selectedDate.value = ''
  loadPanel()
})

onMounted(() => {
  loadPanel()
})
</script>

<style scoped>
.daily-gold-paper {
  background: #f5f5f5;
  color: #111;
  min-height: 100%;
}

.dg-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.dg-h1 {
  font-size: 1.35rem;
  font-weight: 700;
  margin: 0 0 0.35rem;
}

.dg-h2 {
  font-size: 1.05rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
}

.dg-sub {
  margin: 0;
  max-width: 52rem;
  font-size: 0.88rem;
  line-height: 1.45;
  color: #333;
}

.dg-col--controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.dg-field {
  min-width: 10rem;
}

.dg-btn-load {
  background: #222 !important;
  color: #fff !important;
}

.dg-banner {
  padding: 0.6rem 0.75rem;
  margin-bottom: 0.75rem;
  border: 1px solid #bbb;
}

.dg-banner--err {
  background: #fdecea;
  color: #611a15;
}

.dg-banner--info {
  background: #eef6ff;
  color: #1a3a5c;
}

.dg-dismiss {
  float: right;
  border: none;
  background: transparent;
  font-size: 1.2rem;
  cursor: pointer;
}

.dg-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
}

.dg-badge {
  display: inline-block;
  padding: 0.15rem 0.45rem;
  border: 1px solid #999;
  background: #fff;
  font-size: 0.78rem;
}

.dg-badge--muted {
  color: #444;
}

.dg-section {
  margin-bottom: 1.25rem;
  padding: 0.75rem;
  background: #fff;
  border: 1px solid #bbb;
}

.dg-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
}

.dg-table th,
.dg-table td {
  border: 1px solid #bbb;
  padding: 0.35rem 0.45rem;
}

.dg-table thead th {
  background: #eee;
  font-weight: 600;
}

.dg-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.dg-link {
  color: #0d47a1;
  text-decoration: none;
}

.dg-link:hover {
  text-decoration: underline;
}

.dg-pos {
  color: #1b5e20;
}

.dg-neg {
  color: #b71c1c;
}

.dg-footnote {
  font-size: 0.8rem;
  color: #555;
  margin: 0.5rem 0 0;
}
</style>
