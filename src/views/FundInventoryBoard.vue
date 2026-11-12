<template>
  <section class="fund-inventory-board">
    <header class="page-header">
      <div>
        <p class="eyebrow">Active Fund Inventory</p>
        <div class="title-row">
          <h2>🗃️ 公募库存四态</h2>
          <button
            type="button"
            class="metric-help-button"
            aria-label="查看指标口径说明"
            title="指标口径说明"
            @click="showMetricHelp = true"
          >
            ?
          </button>
        </div>
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
        <select v-model="selectedPeriod" @change="onPeriodChange">
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
        组合分类
        <select v-model="category">
          <option value="">全部</option>
          <option v-for="item in categoryOptions" :key="item.value" :value="item.value">
            {{ item.label }}
          </option>
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

    <section
      v-if="quality.status"
      class="quality-card card"
      :class="{ provisional: isProvisional, top10: isTop10Scope && !isProvisional }"
    >
      <div class="quality-heading">
        <strong>{{ scopeHeading }}</strong>
        <span class="quality-badge">{{ scopeBadge }}</span>
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

    <section v-if="pairs.length" class="comparison-card card">
      <header class="comparison-header">
        <div>
          <p class="eyebrow">Quarter Comparison</p>
          <h3>季度对比</h3>
          <p class="muted">同一 pair 的总量、行业与 Top 个股；金额单位亿元。</p>
        </div>
        <label class="pair-select">
          对比口径
          <select v-model="selectedPairKey" @change="onPairChange">
            <option v-for="pair in pairs" :key="pairKey(pair)" :value="pairKey(pair)">
              {{ pair.period_curr }} vs {{ pair.period_prev }} · {{ pairScopeLabel(pair) }}
            </option>
          </select>
        </label>
      </header>

      <p v-if="comparisonLoading" class="muted" role="status">对比数据加载中...</p>
      <p v-if="comparisonError" class="error" role="alert">{{ comparisonError }}</p>

      <template v-if="comparison">
        <div class="comparison-metrics">
          <div>
            <span>净增减</span>
            <strong :class="chgClass(comparison.totals.net_ex_price_yi)">
              {{ fmtYi(comparison.totals.net_ex_price_yi) }}
            </strong>
          </div>
          <div>
            <span>新进</span>
            <strong>{{ fmtYi(comparison.totals.new_inflow_yi) }}</strong>
          </div>
          <div>
            <span>存量变化</span>
            <strong :class="chgClass(comparison.totals.incumbent_delta_yi)">
              {{ fmtYi(comparison.totals.incumbent_delta_yi) }}
            </strong>
          </div>
          <div>
            <span>股价贡献</span>
            <strong>{{ fmtYi(comparison.totals.mv_price_effect_yi) }}</strong>
          </div>
          <div>
            <span>股票数</span>
            <strong>{{ comparison.totals.stocks ?? '-' }}</strong>
          </div>
        </div>
        <p class="muted">{{ comparisonCountsLine }}</p>

        <div class="comparison-grid">
          <section class="comparison-block">
            <h4>行业净增减</h4>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>行业</th>
                    <th>净增减</th>
                    <th>新进</th>
                    <th>存量变化</th>
                    <th>股票数</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in industryRows" :key="row.industry">
                    <td>{{ row.industry }}</td>
                    <td :class="chgClass(row.net_ex_price_yi)">{{ fmtYi(row.net_ex_price_yi) }}</td>
                    <td>{{ fmtYi(row.new_inflow_yi) }}</td>
                    <td :class="chgClass(row.incumbent_delta_yi)">{{ fmtYi(row.incumbent_delta_yi) }}</td>
                    <td>{{ row.stocks }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="comparison-block">
            <h4>Top 个股</h4>
            <div class="top-tabs">
              <button
                v-for="tab in topTabs"
                :key="tab.key"
                type="button"
                :class="{ active: topTab === tab.key }"
                @click="topTab = tab.key"
              >
                {{ tab.label }}
              </button>
            </div>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>代码</th>
                    <th>名称</th>
                    <th>净增减</th>
                    <th>新进</th>
                    <th>存量变化</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in topRows" :key="`${row.ts_code}-${row.state}`">
                    <td class="mono">{{ row.ts_code || row.symbol }}</td>
                    <td>{{ row.name || '-' }}</td>
                    <td :class="chgClass(row.net_ex_price_yi)">{{ fmtYi(row.net_ex_price_yi) }}</td>
                    <td>{{ fmtYi(row.new_inflow_yi) }}</td>
                    <td :class="chgClass(row.incumbent_delta_yi)">{{ fmtYi(row.incumbent_delta_yi) }}</td>
                  </tr>
                  <tr v-if="!topRows.length">
                    <td colspan="5" class="empty">暂无数据</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <p v-for="caveat in comparison.caveats" :key="caveat" class="quality-warning">{{ caveat }}</p>

        <section class="review-block">
          <div>
            <button type="button" :disabled="reviewLoading" @click="runReview">
              {{ reviewLoading ? 'AI 解读中...' : 'AI 解读' }}
            </button>
            <span v-if="reviewStatus" class="muted review-status">{{ reviewStatus }}</span>
          </div>
          <p v-if="reviewError" class="error" role="alert">{{ reviewError }}</p>
          <div v-if="reviewResult" class="review-result">
            <p><strong>{{ reviewResult.headline }}</strong></p>
            <ul>
              <li v-for="item in reviewResult.bullets" :key="item">{{ item }}</li>
            </ul>
          </div>
        </section>
      </template>
    </section>

    <section class="card table-card">
      <table>
        <thead>
          <tr>
            <th>代码</th>
            <th>名称</th>
            <th>市场</th>
            <th>行业</th>
            <th>状态</th>
            <th>组合分类</th>
            <th>净增减</th>
            <th>新进</th>
            <th>存量变化</th>
            <th>股价贡献</th>
            <th>表面市值变化</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visibleRows" :key="row.symbol">
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
            <td class="candidate-cell">
              <span
                class="candidate-badge"
                :class="candidateCategoryClass(row)"
                :title="row.candidate_classification?.hint || ''"
              >
                {{ row.candidate_classification?.label || '数据不足' }}
              </span>
              <small v-if="row.candidate_classification?.evidence?.length">
                {{ row.candidate_classification.evidence.join(' · ') }}
              </small>
              <small v-if="row.candidate_classification?.caveat" class="candidate-caveat">
                {{ row.candidate_classification.caveat }}
              </small>
            </td>
            <td :class="chgClass(row.net_ex_price_yi)">{{ fmtYi(row.net_ex_price_yi) }}</td>
            <td>{{ fmtYi(row.new_inflow_yi) }}</td>
            <td :class="chgClass(row.incumbent_delta_yi)">{{ fmtYi(row.incumbent_delta_yi) }}</td>
            <td>{{ fmtYi(row.mv_price_effect_yi) }}</td>
            <td>{{ fmtYi(row.surface_mv_chg_yi) }}</td>
          </tr>
          <tr v-if="!loading && !errorMessage && !visibleRows.length">
            <td colspan="11" class="empty">{{ emptyMessage }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <div
      v-if="showMetricHelp"
      class="metric-help-overlay"
      @click.self="showMetricHelp = false"
      @keydown.esc.stop="showMetricHelp = false"
    >
      <section
        class="metric-help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fund-inventory-metric-help-title"
      >
        <header>
          <div>
            <p class="eyebrow">Metric Guide</p>
            <h3 id="fund-inventory-metric-help-title">公募库存指标口径</h3>
          </div>
          <button
            type="button"
            class="metric-help-close"
            aria-label="关闭指标口径说明"
            autofocus
            @click="showMetricHelp = false"
          >
            ×
          </button>
        </header>

        <div class="formula-box">
          <strong>两组核心关系</strong>
          <code>净增减 = 表面市值变化 − 股价贡献</code>
          <code>净增减 = 新进 + 存量变化</code>
        </div>

        <dl class="metric-definitions">
          <div>
            <dt>净增减</dt>
            <dd>本期持仓市值 − 上期持仓市值 ×（1 + 区间复权涨跌幅），表示剔除价格变化后的估算持仓增减。</dd>
          </div>
          <div>
            <dt>新进</dt>
            <dd>本期出现、上期未出现的基金持仓市值之和。</dd>
          </div>
          <div>
            <dt>存量变化</dt>
            <dd>净增减 − 新进，包含原有基金加减仓，以及上期持有、本期退出基金的影响。</dd>
          </div>
          <div>
            <dt>股价贡献</dt>
            <dd>上期持仓市值 × 区间复权涨跌幅。港股口径还包含汇率影响，暂未校正拆股等公司行动。</dd>
          </div>
          <div>
            <dt>表面市值变化</dt>
            <dd>本期持仓市值 − 上期持仓市值，尚未剔除股价影响，不能直接当成基金买卖。</dd>
          </div>
        </dl>

        <p class="metric-help-note">
          以上均由报告期披露持仓推导，不是实际成交金额。provisional 模式中的“新进/退出”
          仅表示进入或退出已披露基金的前十大持仓。
        </p>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppLink from '../components/common/AppLink.vue'
import {
  getAnalysisTask,
  getFundInventoryComparison,
  getFundInventoryPairs,
  getFundInventoryPeriods,
  getFundInventorySnapshots,
  triggerFundInventoryReview,
} from '../api/fundInventory'

const loadingCount = ref(0)
const loading = computed(() => loadingCount.value > 0)
const errorMessage = ref('')
const periods = ref([])
const selectedPeriod = ref('')
const state = ref('')
const market = ref('')
const category = ref('')
const sort = ref('net_ex_price')
const rows = ref([])
const counts = ref({})
const quality = ref({})
const showMetricHelp = ref(false)
const pairs = ref([])
const selectedPairKey = ref('')
const comparison = ref(null)
const comparisonLoading = ref(false)
const comparisonError = ref('')
const topTab = ref('new_inventory')
const topTabs = [
  { key: 'new_inventory', label: '新建库存' },
  { key: 'inventory_exit', label: '库存退出' },
  { key: 'incumbent_strengthen', label: '存量强化' },
  { key: 'inventory_turnover', label: '库存换手' },
]
const reviewLoading = ref(false)
const reviewStatus = ref('')
const reviewError = ref('')
const reviewResult = ref(null)
let reviewTimer = null
const categoryOptions = [
  { value: 'underpriced', label: '尚未充分定价' },
  { value: 'crowded_trend', label: '强势但可能拥挤' },
  { value: 'earnings_inflection', label: '盈利拐点新库存' },
  { value: 'high_level_turnover', label: '高位库存换手' },
  { value: 'negative_combo', label: '明显负面组合' },
  { value: 'other', label: '其他 / 待观察' },
  { value: 'insufficient_data', label: '数据不足' },
]

const isProvisional = computed(() => quality.value?.status === 'provisional')
const isTop10Scope = computed(() => quality.value?.comparison_scope === 'top10')
const previewLabels = computed(() => isProvisional.value || isTop10Scope.value)
const scopeHeading = computed(() => {
  if (isProvisional.value) return '前十大预览 · 披露进行中'
  if (isTop10Scope.value) return '季报前十大口径'
  return '正式全持仓快照'
})
const scopeBadge = computed(() => {
  if (isProvisional.value) return 'PROVISIONAL'
  if (isTop10Scope.value) return 'TOP10'
  return 'OFFICIAL'
})
const visibleRows = computed(() => {
  if (!category.value) return rows.value
  return rows.value.filter(
    (row) => row.candidate_classification?.category === category.value,
  )
})
const stateLabels = computed(() => previewLabels.value
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
  if (category.value) return '当前加载结果中没有匹配的组合分类。'
  if (state.value) return '当前状态筛选没有匹配项。'
  return '当前报告期没有可展示的 A 股库存快照。'
})

function pairKey(pair) {
  return `${pair.period_curr}|${pair.period_prev}`
}

function pairScopeLabel(pair) {
  const scope = pair.comparison_scope === 'top10' ? '前十大' : '全持仓'
  return pair.quality_status === 'provisional' ? `${scope}·预览` : scope
}

const topRows = computed(() => comparison.value?.top?.[topTab.value] || [])
const comparisonCountsLine = computed(() => {
  const c = comparison.value?.state_counts || {}
  const labels = stateLabels.value
  return `${labels.incumbent_strengthen} ${c.incumbent_strengthen || 0} · ${labels.new_inventory} ${c.new_inventory || 0} · ${labels.inventory_turnover} ${c.inventory_turnover || 0} · ${labels.inventory_exit} ${c.inventory_exit || 0}`
})
const industryRows = computed(() => {
  const rows = comparison.value?.industries || []
  if (rows.length <= 12) return rows
  const top = rows.slice(0, 8)
  const bottom = rows.slice(-5).filter((row) => !top.includes(row))
  return [...top, ...bottom]
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

function candidateCategoryClass(row) {
  const value = row?.candidate_classification?.category || 'insufficient_data'
  return `category-${value}`
}

function pairForPeriod(period) {
  return pairs.value.find((pair) => pair.period_curr === period)
}

async function loadComparison() {
  if (!selectedPairKey.value) {
    comparison.value = null
    return
  }
  const [periodCurr, periodPrev] = selectedPairKey.value.split('|')
  comparisonLoading.value = true
  comparisonError.value = ''
  try {
    const body = await getFundInventoryComparison({
      period_curr: periodCurr || undefined,
      period_prev: periodPrev || undefined,
      top_n: 10,
    })
    comparison.value = body?.data || body || null
  } catch (err) {
    comparisonError.value = err?.message || '对比数据加载失败'
    comparison.value = null
  } finally {
    comparisonLoading.value = false
  }
}

function onPeriodChange() {
  const pair = pairForPeriod(selectedPeriod.value)
  if (pair) selectedPairKey.value = pairKey(pair)
  loadRows()
  loadComparison()
}

function onPairChange() {
  const pair = pairs.value.find((item) => pairKey(item) === selectedPairKey.value)
  if (pair) {
    selectedPeriod.value = pair.period_curr
    loadRows()
  }
  loadComparison()
}

async function refresh() {
  errorMessage.value = ''
  comparisonError.value = ''
  startLoading()
  try {
    const [periodResult, pairResult] = await Promise.allSettled([
      getFundInventoryPeriods(),
      getFundInventoryPairs(),
    ])
    if (periodResult.status === 'fulfilled') {
      const periodBody = periodResult.value
      const list = periodBody?.data?.periods || periodBody?.periods || []
      periods.value = Array.isArray(list) ? list : []
    } else {
      errorMessage.value = periodResult.reason?.message || '报告期加载失败'
    }
    if (pairResult.status === 'fulfilled') {
      const pairBody = pairResult.value
      const list = pairBody?.data?.pairs || pairBody?.pairs || []
      pairs.value = Array.isArray(list) ? list : []
    } else {
      comparisonError.value = pairResult.reason?.message || '对比口径加载失败'
      pairs.value = []
    }
    if (!selectedPeriod.value && periods.value.length) {
      selectedPeriod.value = periods.value[0]
    }
    if (!selectedPairKey.value && pairs.value.length) {
      const pair = pairForPeriod(selectedPeriod.value) || pairs.value[0]
      selectedPairKey.value = pairKey(pair)
    }
    if (
      selectedPairKey.value
      && !pairs.value.some((pair) => pairKey(pair) === selectedPairKey.value)
    ) {
      selectedPairKey.value = pairs.value.length ? pairKey(pairs.value[0]) : ''
    }
    const pair = pairs.value.find((item) => pairKey(item) === selectedPairKey.value)
    if (pair) selectedPeriod.value = pair.period_curr
    await Promise.all([loadRows(), loadComparison()])
  } finally {
    finishLoading()
  }
}

async function loadRows() {
  errorMessage.value = ''
  const requestId = ++rowsRequestId
  startLoading()
  try {
    const pair = pairs.value.find((item) => pairKey(item) === selectedPairKey.value)
    const body = await getFundInventorySnapshots({
      period: selectedPeriod.value || undefined,
      period_prev: pair && pair.period_curr === selectedPeriod.value ? pair.period_prev : undefined,
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

async function runReview() {
  if (!comparison.value) return
  reviewLoading.value = true
  reviewError.value = ''
  reviewResult.value = null
  reviewStatus.value = '提交分析任务...'
  try {
    const body = await triggerFundInventoryReview({
      period_curr: comparison.value.period_curr,
      period_prev: comparison.value.period_prev,
      top_n: 10,
    })
    const data = body?.data || body || {}
    const taskId = data.task_id
    if (!taskId) throw new Error('分析任务未返回 task_id')
    reviewStatus.value = data.reused ? '已有分析任务，读取结果...' : '分析中...'
    pollReview(taskId)
  } catch (err) {
    reviewLoading.value = false
    reviewStatus.value = ''
    reviewError.value = err?.message || 'AI 解读提交失败'
  }
}

function pollReview(taskId, attempts = 0) {
  if (reviewTimer) clearTimeout(reviewTimer)
  reviewTimer = setTimeout(async () => {
    try {
      const body = await getAnalysisTask(taskId)
      const taskMeta = body?.task_meta || body?.data?.task_meta || {}
      const status = taskMeta.status || body?.status || body?.data?.status
      const result = body?.base_result || body?.data?.base_result || body?.result || body?.data?.result
      if (status === 'completed' && result) {
        reviewResult.value = result.period_review || result
        reviewStatus.value = ''
        reviewLoading.value = false
        return
      }
      if (status === 'failed' || status === 'completed_with_parse_error') {
        reviewError.value = taskMeta.error || 'AI 解读失败'
        reviewStatus.value = ''
        reviewLoading.value = false
        return
      }
      if (attempts >= 60) {
        reviewError.value = 'AI 解读超时，请稍后到分析任务中心查看'
        reviewStatus.value = ''
        reviewLoading.value = false
        return
      }
      reviewStatus.value = status === 'processing' ? '分析中...' : '排队中...'
      pollReview(taskId, attempts + 1)
    } catch (err) {
      reviewError.value = err?.message || '查询分析任务失败'
      reviewStatus.value = ''
      reviewLoading.value = false
    }
  }, 2000)
}

onMounted(refresh)
onBeforeUnmount(() => {
  if (reviewTimer) clearTimeout(reviewTimer)
})
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
.title-row {
  align-items: center;
  display: flex;
  gap: 8px;
}
.title-row h2 {
  margin: 0;
}
.metric-help-button {
  align-items: center;
  background: rgba(59, 130, 246, .14);
  border: 1px solid rgba(96, 165, 250, .5);
  border-radius: 999px;
  color: #93c5fd;
  display: inline-flex;
  font-size: 13px;
  font-weight: 700;
  height: 24px;
  justify-content: center;
  padding: 0;
  width: 24px;
}
.metric-help-button:hover {
  background: rgba(59, 130, 246, .25);
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
.filters select,
.pair-select select {
  background-color: #0f172a;
  border: 1px solid rgba(148, 163, 184, .4);
  border-radius: 8px;
  color: #e2e8f0;
  color-scheme: dark;
  cursor: pointer;
  font: inherit;
  padding: 6px 10px;
}
.filters select option,
.pair-select select option {
  background-color: #0f172a;
  color: #e2e8f0;
}
.filters select:focus,
.pair-select select:focus {
  border-color: #60a5fa;
  outline: 2px solid rgba(96, 165, 250, .35);
  outline-offset: 1px;
}
.quality-card {
  border-color: rgba(52, 211, 153, .35);
  margin-bottom: 12px;
}
.quality-card.provisional {
  background: rgba(120, 53, 15, .28);
  border-color: rgba(251, 191, 36, .55);
}
.quality-card.top10 {
  background: rgba(30, 58, 138, .28);
  border-color: rgba(96, 165, 250, .55);
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
.top10 .quality-badge {
  background: rgba(96, 165, 250, .16);
  color: #93c5fd;
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
.comparison-card {
  margin-bottom: 12px;
}
.comparison-header {
  align-items: flex-start;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  margin-bottom: 12px;
}
.comparison-header h3 {
  margin: 0;
}
.pair-select {
  display: flex;
  flex-direction: column;
  font-size: 12px;
  gap: 6px;
}
.comparison-metrics {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  margin: 12px 0;
}
.comparison-metrics div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.comparison-metrics span {
  color: #94a3b8;
  font-size: 12px;
}
.comparison-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}
.comparison-block h4 {
  margin: 0 0 8px;
}
.table-scroll {
  overflow-x: auto;
}
.top-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.top-tabs button {
  background: rgba(100, 116, 139, .2);
  border: 1px solid rgba(148, 163, 184, .28);
  border-radius: 999px;
  color: #cbd5e1;
  cursor: pointer;
  font-size: 12px;
  padding: 4px 10px;
}
.top-tabs button.active {
  background: rgba(59, 130, 246, .25);
  border-color: rgba(96, 165, 250, .6);
  color: #bfdbfe;
}
.review-block {
  border-top: 1px solid rgba(148, 163, 184, .16);
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
}
.review-status {
  margin-left: 8px;
}
.review-result {
  background: rgba(15, 23, 42, .6);
  border: 1px solid rgba(148, 163, 184, .22);
  border-radius: 12px;
  padding: 12px;
}
.review-result ul {
  margin: 8px 0 0;
  padding-left: 20px;
}
.muted { color: #94a3b8; }
.error { color: #f87171; }
.table-card { overflow-x: auto; min-height: 360px; }
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
.candidate-cell {
  min-width: 220px;
}
.candidate-cell small {
  color: #94a3b8;
  display: block;
  font-size: 11px;
  line-height: 1.45;
  margin-top: 5px;
}
.candidate-cell .candidate-caveat {
  color: #fbbf24;
}
.candidate-badge {
  background: rgba(100, 116, 139, .2);
  border: 1px solid rgba(148, 163, 184, .28);
  border-radius: 999px;
  display: inline-block;
  font-size: 12px;
  padding: 3px 8px;
  white-space: nowrap;
}
.category-underpriced,
.category-earnings_inflection {
  background: rgba(16, 185, 129, .14);
  border-color: rgba(52, 211, 153, .4);
  color: #6ee7b7;
}
.category-crowded_trend,
.category-high_level_turnover {
  background: rgba(245, 158, 11, .14);
  border-color: rgba(251, 191, 36, .4);
  color: #fbbf24;
}
.category-negative_combo {
  background: rgba(239, 68, 68, .14);
  border-color: rgba(248, 113, 113, .42);
  color: #fca5a5;
}
.metric-help-overlay {
  align-items: center;
  background: rgba(2, 6, 23, .78);
  display: flex;
  inset: 0;
  justify-content: center;
  padding: 20px;
  position: fixed;
  z-index: 3000;
}
.metric-help-dialog {
  background: #0f172a;
  border: 1px solid rgba(148, 163, 184, .32);
  border-radius: 16px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, .45);
  max-height: min(760px, calc(100vh - 40px));
  max-width: 720px;
  overflow-y: auto;
  padding: 22px;
  width: 100%;
}
.metric-help-dialog header {
  align-items: flex-start;
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}
.metric-help-dialog h3 {
  margin: 0;
}
.metric-help-close {
  background: transparent;
  color: #cbd5e1;
  font-size: 24px;
  line-height: 1;
  padding: 2px 6px;
}
.formula-box {
  background: rgba(30, 64, 175, .18);
  border: 1px solid rgba(96, 165, 250, .3);
  border-radius: 12px;
  display: grid;
  gap: 8px;
  margin-bottom: 18px;
  padding: 14px;
}
.formula-box code {
  color: #bfdbfe;
  font-size: 14px;
  white-space: normal;
}
.metric-definitions {
  display: grid;
  gap: 12px;
  margin: 0;
}
.metric-definitions div {
  border-bottom: 1px solid rgba(148, 163, 184, .16);
  padding-bottom: 12px;
}
.metric-definitions dt {
  color: #f8fafc;
  font-weight: 700;
  margin-bottom: 4px;
}
.metric-definitions dd {
  color: #cbd5e1;
  line-height: 1.6;
  margin: 0;
}
.metric-help-note {
  color: #fcd34d;
  line-height: 1.6;
  margin: 16px 0 0;
}
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
