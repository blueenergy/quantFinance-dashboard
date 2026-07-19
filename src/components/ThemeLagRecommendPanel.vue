<template>
  <div class="theme-lag-paper pa-4">
    <div class="tl-row tl-row--head">
      <div class="tl-col tl-col--title">
        <h1 class="tl-h1">主题补涨候选</h1>
        <p class="tl-sub">
          主线概念 ∩ 指数成分 · 小涨补涨池（数据来自 quant_data；叙事来自已完成的分析任务）。
          「模拟买入价」为验证规则中的锚定日 P₀（收盘）；「退出（日 / 价）」与「规则盈亏%」来自同锚定日验证结果；未跑验证时多为「—」。
        </p>
      </div>
      <div class="tl-col tl-col--controls">
        <v-text-field
          v-model="selectedDate"
          label="交易日"
          type="date"
          density="compact"
          variant="outlined"
          hide-details
          class="tl-field tl-field--date"
          color="grey-darken-3"
          base-color="grey-darken-2"
        />
        <v-select
          v-model="indexStoreKey"
          :items="indexOptions"
          item-title="title"
          item-value="value"
          label="指数池"
          density="compact"
          variant="outlined"
          hide-details
          class="tl-field tl-field--select"
          color="grey-darken-3"
          base-color="grey-darken-2"
        />
        <v-btn
          variant="flat"
          class="tl-btn-load"
          :loading="loading"
          @click="loadPanel"
        >
          加载
        </v-btn>
        <v-btn
          v-if="subscribedForCurrentIndex"
          variant="outlined"
          class="tl-btn-sub"
          :loading="subActionLoading"
          :disabled="!hasAuthToken"
          @click="unsubscribeCurrent"
        >
          退订验证通知
        </v-btn>
        <v-btn
          v-else
          variant="outlined"
          class="tl-btn-sub"
          :loading="subActionLoading"
          :disabled="!hasAuthToken"
          @click="subscribeCurrent"
        >
          订阅验证结果通知
        </v-btn>
        <span v-if="!hasAuthToken" class="tl-hint">登录后可订阅「该指数池」验证更新（站内通知）</span>
      </div>
    </div>

    <div v-if="error" class="tl-banner tl-banner--err" role="alert">
      <span>{{ error }}</span>
      <button type="button" class="tl-dismiss" aria-label="关闭" @click="error = ''">×</button>
    </div>

    <div v-if="metaLine" class="tl-meta-row">
      <span class="tl-badge">{{ metaLine }}</span>
      <span v-if="narrativeModel" class="tl-badge tl-badge--muted">模型 {{ narrativeModel }}</span>
      <span v-if="narrativeStatus" class="tl-badge tl-badge--muted">叙事 {{ narrativeStatusLabel }}</span>
    </div>

    <div v-if="bucketGroups.length" class="tl-buckets mb-6">
      <v-expansion-panels variant="accordion" class="tl-panels">
        <v-expansion-panel v-for="g in bucketGroups" :key="g.key" class="tl-panel">
          <v-expansion-panel-title class="tl-panel-title">
            <span class="tl-panel-name">{{ g.title }}</span>
            <span class="tl-count">{{ g.rows.length }} 只</span>
          </v-expansion-panel-title>
          <v-expansion-panel-text class="tl-panel-body">
            <table class="tl-table">
              <thead>
                <tr>
                  <th>代码</th>
                  <th>名称</th>
                  <th class="tl-num">当日涨幅%</th>
                  <th class="tl-num">上限阈值</th>
                  <th class="tl-num">下限阈值</th>
                  <th
                    class="tl-num"
                    title="锚定日 P₀：与 theme_lag_candidate_validation 使用的 volume_price 收盘一致"
                  >
                    模拟买入价
                  </th>
                  <th class="tl-col-exit" title="规则验证：止盈/止损/期满的退出日收盘价；数据不足见单元格提示">
                    退出（日 / 价）
                  </th>
                  <th class="tl-num" title="相对 P₀ 的已实现收益率（小数比×100 为百分点）">规则盈亏%</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in g.rows" :key="r.symbol">
                  <td>{{ r.symbol }}</td>
                  <td>{{ r.name }}</td>
                  <td class="tl-num">{{ fmtPct(r.pct_chg) }}</td>
                  <td class="tl-num">{{ fmtPct(r.max_candidate_pct) }}</td>
                  <td class="tl-num">{{ fmtPct(r.min_candidate_pct) }}</td>
                  <td class="tl-num" :title="fmtSimBuyTitle(r)">{{ fmtSimBuy(r) }}</td>
                  <td class="tl-col-exit" :title="fmtExitTitle(r)">{{ fmtExitDayPrice(r) }}</td>
                  <td class="tl-num" :title="fmtRulePnlTitle(r)">{{ fmtRulePnl(r) }}</td>
                </tr>
              </tbody>
            </table>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </div>
    <div v-else-if="loaded && !loading" class="tl-banner tl-banner--info">
      {{ emptyCandidatesMessage }}
    </div>

    <div v-if="narrativeHtml" class="tl-narrative">
      <h2 class="tl-h2">AI 复盘说明</h2>
      <div class="theme-lag-md" v-html="narrativeHtml" />
    </div>
    <div
      v-else-if="loaded && narrativeBlock && narrativeBlock.status !== 'completed'"
      class="tl-banner tl-banner--warn"
    >
      叙事任务状态：<strong>{{ narrativeBlock.status }}</strong>
      <span v-if="narrativeBlock.error"> — {{ narrativeBlock.error }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import request from '../utils/request'

function todayYmdDash() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const selectedDate = ref(todayYmdDash())
const indexStoreKey = ref('csi1000')
const indexOptions = [
  { title: '中证1000', value: 'csi1000' },
  { title: '中证500', value: 'csi500' },
  /* 与 quant-data-engine 默认 index_constituents 同步键一致（000300.SH -> hs300） */
  { title: '沪深300', value: 'hs300' },
]

const loading = ref(false)
const subActionLoading = ref(false)
const subscriptions = ref([])
const hasAuthToken = ref(false)
const loaded = ref(false)
const error = ref('')
const candidates = ref([])
const narrativeBlock = ref(null)
const resolvedTradeDate = ref('')

let themeLagLoadSeq = 0

function refreshAuthFlag() {
  hasAuthToken.value = !!localStorage.getItem('access_token')
}

const subscribedForCurrentIndex = computed(() => {
  const sk = indexStoreKey.value
  return (subscriptions.value || []).some((s) => s.index_store_key === sk && s.enabled !== false)
})

async function fetchSubscriptions() {
  refreshAuthFlag()
  if (!hasAuthToken.value) {
    subscriptions.value = []
    return
  }
  try {
    const body = await request({
      method: 'get',
      url: '/user/theme-lag-validation-subscriptions',
    })
    subscriptions.value = body?.data?.items || []
  } catch {
    subscriptions.value = []
  }
}

async function subscribeCurrent() {
  refreshAuthFlag()
  if (!hasAuthToken.value) {
    error.value = '请先登录后再订阅验证通知'
    return
  }
  subActionLoading.value = true
  error.value = ''
  try {
    await request({
      method: 'post',
      url: '/user/theme-lag-validation-subscriptions',
      data: { index_store_key: indexStoreKey.value, enabled: true },
    })
    await fetchSubscriptions()
  } catch (e) {
    const msg = e.response?.data?.detail || e.message || String(e)
    error.value = typeof msg === 'string' ? msg : '订阅失败'
  } finally {
    subActionLoading.value = false
  }
}

async function unsubscribeCurrent() {
  refreshAuthFlag()
  if (!hasAuthToken.value) {
    return
  }
  subActionLoading.value = true
  error.value = ''
  try {
    const sk = encodeURIComponent(indexStoreKey.value)
    await request({
      method: 'delete',
      url: `/user/theme-lag-validation-subscriptions/${sk}`,
    })
    await fetchSubscriptions()
  } catch (e) {
    const msg = e.response?.data?.detail || e.message || String(e)
    error.value = typeof msg === 'string' ? msg : '退订失败'
  } finally {
    subActionLoading.value = false
  }
}

const metaLine = computed(() => {
  if (!resolvedTradeDate.value) return ''
  return `数据日 ${resolvedTradeDate.value} · ${indexStoreKey.value} · 候选 ${candidates.value.length} 条`
})

const narrativeModel = computed(() => narrativeBlock.value?.model || '')
const narrativeStatus = computed(() => narrativeBlock.value?.status || '')

const narrativeStatusLabel = computed(() => {
  const s = narrativeStatus.value
  if (!s) return ''
  const map = {
    completed: '已完成',
    pending: '排队中',
    processing: '分析中',
    failed: '失败',
    completed_with_parse_error: '解析异常',
  }
  return map[s] || s
})

/** 无候选：常见原因是该日对该 index_store_key 未跑过 theme_lag（与是否跑过沪深300/中证1000等一一对应） */
const emptyCandidatesMessage = computed(() => {
  const pool = indexStoreKey.value || 'csi1000'
  return (
    `当前指数池为「${pool}」、该交易日下没有主题补涨候选数据，列表为空。` +
    `若尚未用该指数跑过 quant-data-engine 的 theme_lag_candidates（` +
    `\`--index-store-key ${pool}\`），属正常现象；默认往往只跑中证 1000（csi1000）。`
  )
})

function fmtPct(v) {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return '—'
  return n.toFixed(2)
}

/** YYYYMMDD → YYYY-MM-DD */
function fmtYmdDash(s) {
  if (!s) return ''
  const d = String(s).replace(/\D/g, '').slice(0, 8)
  if (d.length !== 8) return String(s)
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
}

function fmtExitDayPrice(r) {
  const d = r?.validation_exit_trade_date
  const p = r?.validation_exit_price
  if (d && p !== null && p !== undefined && p !== '') {
    const n = Number(p)
    if (!Number.isNaN(n)) return `${fmtYmdDash(d)} / ${n.toFixed(2)}`
  }
  const o = r?.validation_outcome
  if (o === 'insufficient_data') return '数据不足'
  if (o) return '—'
  return '—'
}

function fmtSimBuy(r) {
  const p = r?.validation_p0
  if (p === null || p === undefined || p === '') return '—'
  const n = Number(p)
  if (Number.isNaN(n)) return '—'
  return n.toFixed(2)
}

function fmtSimBuyTitle(r) {
  if (r?.validation_p0 != null && r?.validation_p0 !== '' && !Number.isNaN(Number(r.validation_p0)))
    return '锚定日 P₀（与验证任务 volume_price 收盘口径一致）'
  return '尚无验证结果（无 P₀）'
}

function fmtRulePnl(r) {
  const raw = r?.validation_return_pct
  if (raw === null || raw === undefined || raw === '') return '—'
  const n = Number(raw)
  if (Number.isNaN(n)) return '—'
  const pct = n * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

function fmtRulePnlTitle(r) {
  const o = r?.validation_outcome
  if (r?.validation_return_pct != null && r?.validation_return_pct !== '' && !Number.isNaN(Number(r.validation_return_pct)))
    return '相对 P₀ 的已实现收益率（验证规则）'
  if (o === 'insufficient_data') return '数据不足，无有效收益率'
  return '尚无验证结果'
}

function fmtExitTitle(r) {
  const o = r?.validation_outcome
  const map = {
    take_profit: '规则验证：止盈（退出日收盘）',
    stop_loss: '规则验证：止损（退出日收盘）',
    expire: '规则验证：期满（第3根有效收盘）',
    insufficient_data: '规则验证：有效收盘不足或缺锚定价 P₀',
  }
  if (o && map[o]) return map[o]
  if (r?.validation_exit_trade_date && r?.validation_exit_price != null && r?.validation_exit_price !== '')
    return '规则验证：退出日收盘价'
  return '尚无验证结果（未跑 theme_lag_candidate_validation 或无该标的记录）'
}

const bucketGroups = computed(() => {
  const rows = candidates.value || []
  const m = new Map()
  for (const r of rows) {
    const rank = r.bucket_rank ?? 0
    const name = r.bucket_name || r.bucket_id || '未命名桶'
    const key = `${rank}-${r.bucket_id || name}`
    if (!m.has(key)) {
      m.set(key, {
        key,
        title: `#${rank} ${name}`,
        rows: [],
      })
    }
    m.get(key).rows.push(r)
  }
  return Array.from(m.values()).sort((a, b) => {
    const ra = a.rows[0]?.bucket_rank ?? 0
    const rb = b.rows[0]?.bucket_rank ?? 0
    return ra - rb
  })
})

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderMarkdown(text) {
  if (!text) return ''
  let out = String(text)
  out = out.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, _lang, code) =>
    `<pre class="code-block"><code>${escHtml(code.trimEnd())}</code></pre>`)
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code class="inline-code">${escHtml(c)}</code>`)
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/\n/g, '<br>')
  return out
}

const narrativeHtml = computed(() => {
  const nb = narrativeBlock.value
  if (!nb || nb.status !== 'completed') return ''
  return renderMarkdown(nb.narrative_markdown || '')
})

async function loadPanel() {
  const seq = ++themeLagLoadSeq
  refreshAuthFlag()
  error.value = ''
  loading.value = true
  loaded.value = false
  /* 避免切换指数/日期后仍短暂显示上一池的候选与叙事 */
  candidates.value = []
  narrativeBlock.value = null
  resolvedTradeDate.value = ''
  try {
    const td = selectedDate.value
    const sk = indexStoreKey.value
    const body = await request({
      method: 'get',
      url: '/theme-lag-panel',
      params: { trade_date: td, index_store_key: sk },
    })
    if (seq !== themeLagLoadSeq) {
      return
    }
    if (!body?.success) {
      error.value = body?.error || body?.detail || '加载失败'
      candidates.value = []
      narrativeBlock.value = null
      return
    }
    if (seq !== themeLagLoadSeq) {
      return
    }
    resolvedTradeDate.value = body.trade_date || td.replace(/-/g, '')
    candidates.value = Array.isArray(body.candidates) ? body.candidates : []
    narrativeBlock.value = body.narrative || null
  } catch (e) {
    if (seq !== themeLagLoadSeq) {
      return
    }
    const msg = e.response?.data?.detail || e.message || String(e)
    error.value = typeof msg === 'string' ? msg : '请求失败'
    candidates.value = []
    narrativeBlock.value = null
  } finally {
    if (seq === themeLagLoadSeq) {
      loading.value = false
      loaded.value = true
    }
    void fetchSubscriptions()
  }
}

/** 须在 loadPanel 定义之后：指数池或交易日变化自动拉数（含首次）；seq 丢弃过期请求 */
watch(
  [indexStoreKey, selectedDate],
  () => {
    void loadPanel()
  },
  { immediate: true },
)

watch(indexStoreKey, () => {
  void fetchSubscriptions()
})

onMounted(() => {
  refreshAuthFlag()
  void fetchSubscriptions()
})
</script>

<style scoped>
.theme-lag-paper {
  background: #ffffff;
  color: #111111;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  max-width: 1200px;
  margin: 0 auto;
}

.tl-h1 {
  font-size: 1.35rem;
  font-weight: 700;
  margin: 0 0 0.35rem;
  color: #000;
}

.tl-h2 {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0 0 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #ccc;
  color: #000;
}

.tl-sub {
  margin: 0;
  font-size: 0.875rem;
  color: #333;
  line-height: 1.45;
}

.tl-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.tl-col--controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: flex-start;
  justify-content: flex-end;
}

.tl-field--date {
  max-width: 180px;
}

.tl-field--select {
  min-width: 160px;
  max-width: 220px;
}

.tl-btn-load {
  background: #111 !important;
  color: #fff !important;
  text-transform: none;
  letter-spacing: normal;
  font-weight: 600;
}

.tl-btn-sub {
  text-transform: none;
  letter-spacing: normal;
  font-weight: 500;
  border-color: #333 !important;
  color: #111 !important;
}

.tl-hint {
  width: 100%;
  flex-basis: 100%;
  font-size: 0.8rem;
  color: #555;
  margin-top: 0.25rem;
}

.tl-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.tl-badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  font-size: 0.8rem;
  border: 1px solid #333;
  color: #111;
  background: #fafafa;
}

.tl-badge--muted {
  border-color: #999;
  color: #333;
  background: #fff;
}

.tl-banner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  border: 1px solid;
}

.tl-banner--err {
  background: #fff5f5;
  border-color: #c00;
  color: #600;
}

.tl-banner--info {
  background: #f7f7f7;
  border-color: #999;
  color: #222;
}

.tl-banner--warn {
  background: #fffbf0;
  border-color: #b8860b;
  color: #422;
}

.tl-dismiss {
  flex-shrink: 0;
  border: none;
  background: transparent;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  color: #333;
  padding: 0 0.25rem;
}

.tl-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  color: #111;
}

.tl-table th,
.tl-table td {
  border: 1px solid #bbb;
  padding: 0.4rem 0.5rem;
  text-align: left;
}

.tl-table thead th {
  background: #eee;
  font-weight: 600;
  color: #000;
}

.tl-table tbody tr:nth-child(even) {
  background: #fafafa;
}

.tl-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.tl-col-exit {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  min-width: 9.5rem;
}

.tl-narrative {
  margin-top: 1.25rem;
  padding: 1rem;
  border: 1px solid #ccc;
  background: #fff;
  color: #111;
}

.theme-lag-md :deep(.code-block) {
  background: #f0f0f0;
  border: 1px solid #ccc;
  padding: 0.75rem;
  border-radius: 2px;
  overflow-x: auto;
  margin: 0.5rem 0;
  font-size: 0.82rem;
  color: #111;
}

.theme-lag-md :deep(.code-block code) {
  color: #111;
  white-space: pre-wrap;
  word-break: break-word;
}

.theme-lag-md :deep(.inline-code) {
  background: #eee;
  border: 1px solid #ccc;
  padding: 0 0.25rem;
  border-radius: 2px;
  font-size: 0.85em;
  color: #000;
}

.theme-lag-md :deep(strong) {
  color: #000;
}

/* Vuetify expansion：白底黑字、细边框 */
.tl-panels :deep(.v-expansion-panel) {
  background: #fff !important;
  color: #111 !important;
  border: 1px solid #bbb;
  margin-bottom: 0.35rem;
}

.tl-panels :deep(.v-expansion-panel-title) {
  min-height: 44px;
  color: #111 !important;
  font-weight: 600;
}

.tl-panels :deep(.v-expansion-panel-title__overlay) {
  background: #f5f5f5 !important;
}

.tl-panels :deep(.v-expansion-panel-text__wrapper) {
  padding: 0.5rem 0.75rem 0.75rem !important;
  background: #fff !important;
}

.tl-panel-name {
  color: #000;
}

.tl-count {
  margin-left: 0.5rem;
  font-size: 0.8rem;
  font-weight: 400;
  color: #444;
}

/* 输入框：浅色底、深色字 */
.tl-field :deep(.v-field) {
  background: #fff !important;
  color: #111 !important;
}

.tl-field :deep(.v-field__input) {
  color: #111 !important;
  min-height: 40px;
}

.tl-field :deep(input) {
  color: #111 !important;
}

.tl-field :deep(.v-label) {
  color: #333 !important;
}
</style>
