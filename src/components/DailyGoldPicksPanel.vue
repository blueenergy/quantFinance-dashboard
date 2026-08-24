<template>
  <div class="daily-gold-paper pa-4">
    <div class="dg-row dg-row--head">
      <div class="dg-col dg-col--title">
        <h1 class="dg-h1">每日金股</h1>
        <p class="dg-sub">
          成长×周期加权截面 Top10 观察池；每笔等权纸面账本，8% 移动止损，亏损止损后冷却 5 个交易日，满 20 个交易日调仓日复核（仍在 Top20 续持）。
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
        <v-btn variant="flat" class="dg-btn-load" :loading="loading" @click="loadPanel()">
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
      <span v-if="lastRefreshedAt" class="dg-badge dg-badge--muted">
        行情每 60 秒刷新 · 页面更新 {{ fmtClock(lastRefreshedAt) }}
      </span>
    </div>

    <section v-if="loaded" class="dg-performance" aria-labelledby="dg-performance-title">
      <div class="dg-performance__head">
        <div>
          <span class="dg-performance__eyebrow">
            {{ strategyTwr ? '策略指数（可变投入 TWR）' : '过去整体战绩' }}
          </span>
          <h2
            id="dg-performance-title"
            class="dg-performance__title"
            :class="pnlClass(strategyTwr?.cumulative_return ?? stats.avg_return_pct)"
          >
            {{ strategyTwr ? `累计收益 ${fmtSignedPct(strategyTwr.cumulative_return)}` : performanceSummary.title }}
          </h2>
        </div>
        <span v-if="panel.score_date" class="dg-performance__asof">
          截至 {{ fmtDate(panel.score_date) }}
        </span>
      </div>
      <p class="dg-performance__description">
        {{ strategyTwr ? twrDescription : performanceSummary.description }}
      </p>
      <div v-if="strategyTwr || stats.scored_count" class="dg-performance__metrics">
        <div v-if="strategyTwr" class="dg-metric">
          <span>TWR 累计收益</span>
          <strong :class="pnlClass(strategyTwr.cumulative_return)">
            {{ fmtSignedPct(strategyTwr.cumulative_return) }}
          </strong>
        </div>
        <div v-if="strategyTwr" class="dg-metric">
          <span>最大回撤</span>
          <strong :class="pnlClass(strategyTwr.max_drawdown)">
            {{ fmtPct(strategyTwr.max_drawdown, 2) }}
          </strong>
        </div>
        <div v-if="strategyTwr" class="dg-metric">
          <span>当前 / 历史最多持有</span>
          <strong>{{ strategyTwr.active_lots }} / {{ strategyTwr.peak_active_lots }} 笔</strong>
        </div>
        <div class="dg-metric">
          <span>已结束样本</span>
          <strong>{{ stats.scored_count }}</strong>
        </div>
        <div class="dg-metric">
          <span>盈利 / 亏损</span>
          <strong><em class="dg-pos">{{ stats.win_count }}</em> / <em class="dg-neg">{{ stats.loss_count }}</em></strong>
        </div>
        <div class="dg-metric">
          <span>单笔胜率</span>
          <strong>{{ fmtPct(stats.win_rate, 1) }}</strong>
        </div>
        <div class="dg-metric">
          <span>平均每笔</span>
          <strong :class="pnlClass(stats.avg_return_pct)">{{ fmtSignedPct(stats.avg_return_pct) }}</strong>
        </div>
        <div class="dg-metric">
          <span>平均盈亏比</span>
          <strong>{{ fmtRatio(stats.payoff_ratio ?? stats.profit_factor) }}</strong>
        </div>
      </div>
    </section>

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
            <th class="dg-num">入场冷却</th>
            <th>入选原因</th>
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
            <td class="dg-num">
              <span v-if="row.entry_blocked_reason === 'losing_stop_cooldown'" class="dg-neg">
                剩余 {{ row.cooldown_remaining_trading_days }} 日
              </span>
              <span v-else>—</span>
            </td>
            <td class="dg-reason">{{ selectionReason(row) }}</td>
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
            <th class="dg-num" title="当前真实股价，盘中优先用实时快照">现价</th>
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
            <td
              class="dg-num"
              :class="pnlClass(lot.unrealized_return_pct)"
              :title="currentPriceTitle(lot)"
            >
              {{ fmtPrice(lot.current_price) }}
              <small v-if="lot.unrealized_return_pct != null" class="dg-cell-note">
                {{ fmtSignedPct(lot.unrealized_return_pct) }}
              </small>
            </td>
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
            <th class="dg-num" title="假设该股票退出后一直持有，以最新可用价格按后复权口径计算">至今涨跌幅</th>
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
            <td
              class="dg-num"
              :class="pnlClass(lot.hold_to_latest_return_pct)"
              :title="lot.hold_to_latest_date ? `最新估值日 ${fmtDate(lot.hold_to_latest_date)}` : ''"
            >
              {{ fmtReturnPct(lot.hold_to_latest_return_pct) }}
              <small v-if="lot.hold_to_latest_date" class="dg-cell-note">
                {{ marketMarkLabel(lot) }}
              </small>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <p v-if="loaded" class="dg-footnote">
      策略指数假设每个新 lot 投入相同资金单位，以时间加权收益率剔除追加和撤回资金的影响；它不代表固定本金账户。
      当前 TWR 未计交易成本；成本、现价与峰值显示真实价格，浮盈浮亏和 8% 回撤按后复权序列计算，避免除权除息造成假亏损。
      未满 20 个交易日或调仓日仍在 Top20 的仓位会继续持有；今日掉出 Top10 不等于立即卖出。
      “若持有至今”是假设退出后继续持有的事后观察值，不计入策略胜率、单笔收益或 TWR。
    </p>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
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
const lastRefreshedAt = ref(null)

let loadSeq = 0
let autoRefreshTimer = null
let autoRefreshInFlight = false
const AUTO_REFRESH_MS = 60_000

const top10 = computed(() => panel.value?.top10 || [])
const openLots = computed(() => panel.value?.open_lots || [])
const recentClosed = computed(() => panel.value?.recent_closed || [])
const recipeMeta = computed(() => panel.value?.recipe || null)
const stats = computed(() => panel.value?.stats || {})
const strategyTwr = computed(() => panel.value?.strategy_twr || null)
const statsLine = computed(() => {
  const s = stats.value
  if (!s || !s.scored_count) return ''
  const twr = strategyTwr.value?.cumulative_return != null
    ? `TWR ${(strategyTwr.value.cumulative_return * 100).toFixed(2)}%`
    : ''
  const win = s.win_rate != null ? `${(s.win_rate * 100).toFixed(1)}% 胜率` : ''
  const avg = s.avg_return_pct != null ? `均收益 ${(s.avg_return_pct * 100).toFixed(2)}%` : ''
  return [twr, win, avg, `样本 ${s.scored_count}`].filter(Boolean).join(' · ')
})
const twrDescription = computed(() => {
  const twr = strategyTwr.value
  if (!twr) return ''
  return [
    '每个新 lot 按相同初始资金单位计入，资金追加和退出不会直接改变收益率。',
    `当前持有 ${twr.active_lots || 0} 笔，历史最大回撤 ${fmtPct(twr.max_drawdown, 2)}。`,
    `单笔账本平均收益 ${fmtSignedPct(stats.value.avg_return_pct)}，单笔胜率 ${fmtPct(stats.value.win_rate, 1)}。`,
  ].join('')
})
const performanceSummary = computed(() => {
  const s = stats.value
  const count = Number(s.scored_count || 0)
  if (!count) {
    return {
      title: '尚无足够的已结束交易样本',
      description: '新账本正在积累中；至少完成一批退出后，才能形成胜率、平均收益和盈亏比。',
    }
  }

  const avg = Number(s.avg_return_pct || 0)
  const winRate = Number(s.win_rate || 0)
  let assessment = '历史平均收益接近持平'
  if (avg > 0 && winRate >= 0.5) {
    assessment = '历史平均收益为正，且胜率过半'
  } else if (avg > 0) {
    assessment = '历史平均收益为正，但胜率未过半'
  } else if (avg < 0 && winRate >= 0.5) {
    assessment = '胜率过半，但历史平均收益为负'
  } else if (avg < 0) {
    assessment = '历史平均收益为负，且胜率未过半'
  }

  const exits = []
  if (s.trailing_stop_count) exits.push(`回撤退出 ${s.trailing_stop_count} 笔`)
  if (s.expire_count) exits.push(`排名复核退出 ${s.expire_count} 笔`)
  const insufficient = Number(s.insufficient_data_count || 0)
  const sampleNote = count < 20 ? '样本少于 20 笔，结论仅供观察。' : '样本已覆盖至少 20 笔已结束交易。'
  return {
    title: assessment,
    description: [
      `${s.win_count || 0} 笔盈利、${s.loss_count || 0} 笔亏损，平均每笔 ${fmtSignedPct(s.avg_return_pct)}。`,
      exits.length ? `${exits.join('、')}。` : '',
      insufficient ? `另有 ${insufficient} 笔因数据不足未计入绩效。` : '',
      sampleNote,
    ].filter(Boolean).join(''),
  }
})

function fmtDate(ymd) {
  if (!ymd) return '—'
  const s = String(ymd)
  if (s.length !== 8) return s
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

function fmtClock(value) {
  if (!(value instanceof Date)) return '—'
  return value.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function fmtMarketTimestamp(value, fallbackDate) {
  const text = String(value || '')
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})(?:[ T](\d{2}:\d{2}))?/)
  if (compact) {
    const date = `${compact[1]}-${compact[2]}-${compact[3]}`
    return compact[4] ? `${date} ${compact[4]}` : date
  }
  const separated = text.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/)
  if (separated) {
    return separated[2] ? `${separated[1]} ${separated[2]}` : separated[1]
  }
  return fmtDate(fallbackDate)
}

function quoteSourceLabel(priceSource, dataSource) {
  const sourceKind = priceSource === 'realtime' ? '盘中实时' : '日线收盘'
  const sourceLabels = {
    miniqmt_full_market_daily: 'miniQMT',
    miniqmt: 'miniQMT',
    tushare_rt_k_daily: 'Tushare',
    tushare: 'Tushare',
    eastmoney_snapshot: '东财',
  }
  const dataLabel = sourceLabels[dataSource] || dataSource
  return dataLabel ? `${sourceKind} · ${dataLabel}` : sourceKind
}

function marketSourceLabel(lot) {
  return quoteSourceLabel(lot?.hold_to_latest_price_source, lot?.hold_to_latest_data_source)
}

function currentPriceTitle(lot) {
  if (lot?.current_price == null) return ''
  const updatedAt = fmtMarketTimestamp(
    lot?.current_price_updated_at,
    lot?.current_price_date,
  )
  return `${quoteSourceLabel(lot?.current_price_source, lot?.current_price_data_source)} · ${updatedAt}`
}

function marketMarkLabel(lot) {
  const updatedAt = fmtMarketTimestamp(
    lot?.hold_to_latest_updated_at,
    lot?.hold_to_latest_date,
  )
  return `${marketSourceLabel(lot)} · ${updatedAt}`
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

function fmtSignedPct(v, digits = 2) {
  if (v == null || v === '') return '—'
  const value = Number(v) * 100
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`
}

function fmtPct(v, digits = 1) {
  if (v == null || v === '') return '—'
  return `${(Number(v) * 100).toFixed(digits)}%`
}

function fmtRatio(v) {
  if (v == null || v === '') return '—'
  return Number(v).toFixed(2)
}

function fmtRankDelta(delta) {
  if (delta == null) return '新'
  if (delta > 0) return `↑${delta}`
  if (delta < 0) return `↓${Math.abs(delta)}`
  return '—'
}

function selectionReason(row) {
  const growthWeight = Number(recipeMeta.value?.growth_weight ?? 0.6)
  const cycleWeight = Number(recipeMeta.value?.cycle_weight ?? 0.4)
  const growth = row?.growth_score == null ? null : Number(row.growth_score)
  const cycle = row?.cycle_score == null ? null : Number(row.cycle_score)
  let driver = '成长与周期综合'
  if (Number.isFinite(growth) && Number.isFinite(cycle)) {
    const growthContribution = growth * growthWeight
    const cycleContribution = cycle * cycleWeight
    const totalContribution = Math.abs(growthContribution) + Math.abs(cycleContribution)
    const relativeGap = totalContribution
      ? Math.abs(growthContribution - cycleContribution) / totalContribution
      : 0
    if (relativeGap < 0.15) {
      driver = '双因子贡献均衡'
    } else if (growthContribution > cycleContribution) {
      driver = '成长贡献主导'
    } else {
      driver = '周期贡献主导'
    }
  }
  const growthPct = Math.round(growthWeight * 100)
  const cyclePct = Math.round(cycleWeight * 100)
  const rank = row?.rank ? `第 ${row.rank} 名` : '进入 Top10'
  const rankChange = Number(row?.rank_delta || 0)
  const change = rankChange > 0 ? `，较前日升 ${rankChange} 名` : ''
  return `${driver}，${growthPct}:${cyclePct} 加权后${rank}${change}`
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

async function loadPanel(options = {}) {
  const silent = options?.silent === true
  const useLatest = options?.useLatest === true
  const seq = ++loadSeq
  if (!silent) {
    loading.value = true
    loaded.value = false
    error.value = ''
  }
  try {
    const params = { recipe_id: recipeId.value }
    if (!useLatest && selectedDate.value) {
      params.score_date = selectedDate.value.replace(/-/g, '')
    }
    const body = await request({ method: 'get', url: '/daily-gold/panel', params })
    if (seq !== loadSeq) return
    panel.value = body || {}
    recipeOptions.value = body?.recipes || recipeOptions.value
    selectedDate.value = body?.score_date ? fmtDate(body.score_date) : ''
    lastRefreshedAt.value = new Date()
    loaded.value = true
  } catch (e) {
    if (seq !== loadSeq) return
    if (silent) return
    error.value = e?.response?.data?.detail || e?.message || '加载失败'
    panel.value = {}
    loaded.value = false
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

async function autoRefresh() {
  if (autoRefreshInFlight || document.visibilityState === 'hidden') return
  autoRefreshInFlight = true
  try {
    await loadPanel({
      silent: true,
      useLatest: !panel.value?.is_historical,
    })
  } finally {
    autoRefreshInFlight = false
  }
}

watch(recipeId, () => {
  selectedDate.value = ''
  loadPanel({ useLatest: true })
})

onMounted(() => {
  loadPanel({ useLatest: true })
  autoRefreshTimer = window.setInterval(autoRefresh, AUTO_REFRESH_MS)
})

onUnmounted(() => {
  if (autoRefreshTimer != null) {
    window.clearInterval(autoRefreshTimer)
  }
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

.dg-performance {
  margin-bottom: 1.25rem;
  padding: 0.9rem;
  background: #fff;
  border: 1px solid #999;
  border-left: 4px solid #555;
}

.dg-performance__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.dg-performance__eyebrow {
  display: block;
  margin-bottom: 0.2rem;
  color: #666;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.dg-performance__title {
  margin: 0;
  font-size: 1.08rem;
  font-weight: 700;
}

.dg-performance__asof {
  color: #666;
  font-size: 0.78rem;
  white-space: nowrap;
}

.dg-performance__description {
  margin: 0.55rem 0 0;
  color: #333;
  font-size: 0.86rem;
  line-height: 1.55;
}

.dg-performance__metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(7rem, 1fr));
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.dg-metric {
  padding: 0.55rem 0.65rem;
  border: 1px solid #ccc;
  background: #fafafa;
}

.dg-metric span {
  display: block;
  color: #666;
  font-size: 0.74rem;
}

.dg-metric strong {
  display: block;
  margin-top: 0.15rem;
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
}

.dg-metric em {
  font-style: normal;
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

.dg-reason {
  min-width: 11rem;
  line-height: 1.35;
}

.dg-cell-note {
  display: block;
  color: #666;
  font-size: 0.72rem;
  font-weight: 400;
  white-space: nowrap;
}

.dg-link {
  color: #0d47a1;
  text-decoration: none;
}

.dg-link:hover {
  text-decoration: underline;
}

.dg-pos {
  color: #c62828;
}

.dg-neg {
  color: #2e7d32;
}

.dg-footnote {
  font-size: 0.8rem;
  color: #555;
  margin: 0.5rem 0 0;
}

@media (max-width: 900px) {
  .dg-performance__metrics {
    grid-template-columns: repeat(2, minmax(7rem, 1fr));
  }
}
</style>
