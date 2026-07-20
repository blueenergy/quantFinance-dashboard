import { computed, nextTick, ref } from 'vue'
import {
  createPortfolioResearchJob,
  rerunPortfolioResearchJob,
} from '../api/portfolioResearch'
import {
  buildPortfolioResearchPayload,
  formatResearchApiError,
} from '../utils/portfolioResearchPayload'
import { universeName } from '../utils/portfolioResearchView'

export function usePortfolioResearchForm({
  selectedJob = ref(null),
  selectedJobId = ref(''),
  message = ref(''),
  errorMessage = ref(''),
  loadJobs = async () => {},
  selectJob = async () => {},
} = {}) {
  const submitting = ref(false)
  const nameTouched = ref(false)
  const drawerOpen = ref(false)
  const drawerMode = ref('create')
  const formSourceJobId = ref('')
  let drawerFocusEl = null

  function todayInputDate() {
    return new Date().toISOString().slice(0, 10)
  }

  function defaultResearchName(universeValue) {
    return `${universeName(universeValue)} growth-cycle research`
  }

  function defaultFormState() {
    return {
      name: defaultResearchName('csi1000'),
      universe_index: 'csi1000',
      start_date: '2023-01-01',
      end_date: todayInputDate(),
      score_column: 'composite_growth_cycle_score',
      growth_cycle_weights: '30:70',
      top_n_values: '10,20,50',
      horizon: 20,
      active_caps: '0.2,0.25,0.3,0.4',
      transaction_cost: 0.001,
      buy_commission_rate: 0.0001,
      sell_commission_rate: 0.0001,
      min_commission: 5,
      stamp_tax_rate: 0.0005,
      transfer_fee_rate: 0,
      initial_capital: 1_000_000,
      trailing_stop_pcts: '0,0.15',
    }
  }

  const form = ref(defaultFormState())

  const drawerTitle = computed(() => (
    drawerMode.value === 'rerun' ? '基于原参数调整后重跑' : '新建研究任务'
  ))
  const drawerSubtitle = computed(() => {
    if (drawerMode.value === 'rerun' && formSourceJobId.value) {
      return `来源任务 ${formSourceJobId.value} · 提交后新建任务并保留 rerun 链路`
    }
    return '任务由 stock-scoring-system 后台 worker 执行'
  })
  const submitButtonLabel = computed(() => (
    drawerMode.value === 'rerun' ? '提交重跑' : '提交研究任务'
  ))

  function syncDefaultName(universeIndex = form.value.universe_index) {
    if (nameTouched.value) return
    form.value.name = defaultResearchName(universeIndex)
  }

  function onDrawerFormUpdate(next) {
    form.value = next
  }

  function buildFormPayload() {
    return buildPortfolioResearchPayload(form.value, {
      defaultName: defaultResearchName(form.value.universe_index),
    })
  }

  function openDrawer(mode) {
    drawerFocusEl = typeof document === 'undefined' ? null : document.activeElement
    drawerMode.value = mode
    drawerOpen.value = true
    nextTick(() => {
      if (typeof document === 'undefined') return
      const panel = document.querySelector('.drawer-panel input, .drawer-panel select')
      panel?.focus?.()
    })
  }

  function closeDrawer() {
    drawerOpen.value = false
    formSourceJobId.value = ''
    const restore = drawerFocusEl
    drawerFocusEl = null
    nextTick(() => restore?.focus?.())
  }

  function onDrawerEscape(event) {
    if (event.key !== 'Escape' || !drawerOpen.value) return
    event.preventDefault()
    event.stopImmediatePropagation?.()
    closeDrawer()
  }

  function openCreateDrawer() {
    form.value = defaultFormState()
    nameTouched.value = false
    formSourceJobId.value = ''
    errorMessage.value = ''
    openDrawer('create')
  }

  function toDateInputValue(value) {
    if (!value) return ''
    const text = String(value).trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
    const compact = text.replace(/-/g, '')
    if (compact.length >= 8 && /^\d{8}/.test(compact)) {
      return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
    }
    return ''
  }

  function formatListForInput(value) {
    if (Array.isArray(value)) return value.map(String).join(',')
    if (value == null || value === '') return ''
    return String(value)
  }

  function formatTrailingStopPctsForInput(params) {
    if (Array.isArray(params?.trailing_stop_pcts) && params.trailing_stop_pcts.length) {
      return params.trailing_stop_pcts
        .map((value) => (value === 0 || value === 0.0 ? '0' : String(value)))
        .join(',')
    }
    if (params?.trailing_stop_pcts != null && params.trailing_stop_pcts !== '') {
      return formatListForInput(params.trailing_stop_pcts)
    }
    if (params?.trailing_stop_pct == null) return '0'
    return String(params.trailing_stop_pct)
  }

  function withRerunNameSuffix(baseName) {
    const name = String(baseName || '').trim() || '组合研究'
    if (name.endsWith('(rerun)')) return name
    return `${name} (rerun)`
  }

  function loadParamsFromSelectedJob() {
    const job = selectedJob.value
    if (!job) return
    const params = job.params || {}
    const universe = params.universe_index || job.universe_index || form.value.universe_index
    const intervals = params.rebalance_interval_days
    const horizon = Number(
      params.horizon
        ?? (Array.isArray(intervals) && intervals.length ? intervals[0] : null)
        ?? form.value.horizon,
    )
    const baseName = job.name || params.name || defaultResearchName(universe)
    const defaults = defaultFormState()

    form.value = {
      ...defaults,
      name: withRerunNameSuffix(baseName),
      universe_index: universe,
      start_date: toDateInputValue(params.start_date || job.start_date) || defaults.start_date,
      end_date: toDateInputValue(params.end_date || job.end_date) || defaults.end_date,
      score_column: params.score_column || defaults.score_column,
      growth_cycle_weights: formatListForInput(params.growth_cycle_weights) || defaults.growth_cycle_weights,
      top_n_values: formatListForInput(params.top_n_values) || defaults.top_n_values,
      horizon: Number.isFinite(horizon) && horizon > 0 ? horizon : defaults.horizon,
      active_caps: formatListForInput(params.active_caps) || defaults.active_caps,
      transaction_cost: params.transaction_cost ?? defaults.transaction_cost,
      buy_commission_rate: params.buy_commission_rate ?? defaults.buy_commission_rate,
      sell_commission_rate: params.sell_commission_rate ?? defaults.sell_commission_rate,
      min_commission: params.min_commission ?? defaults.min_commission,
      stamp_tax_rate: params.stamp_tax_rate ?? defaults.stamp_tax_rate,
      transfer_fee_rate: params.transfer_fee_rate ?? defaults.transfer_fee_rate,
      initial_capital: params.initial_capital ?? defaults.initial_capital,
      trailing_stop_pcts: formatTrailingStopPctsForInput(params),
      index_benchmark_symbol: params.index_benchmark_symbol,
      cash_buffer: params.cash_buffer,
    }
    nameTouched.value = true
    formSourceJobId.value = job.job_id
    errorMessage.value = ''
    message.value = `已加载任务 ${job.job_id} 的参数，可调整后提交重跑`
    openDrawer('rerun')
  }

  async function submitJobForm() {
    submitting.value = true
    message.value = ''
    errorMessage.value = ''
    try {
      const sourceJobId = formSourceJobId.value
      const payload = buildFormPayload()
      let res
      if (sourceJobId) {
        res = await rerunPortfolioResearchJob(sourceJobId, payload)
        message.value = `已基于原参数创建重跑任务 ${res.data?.job_id}`
      } else {
        res = await createPortfolioResearchJob(payload)
        message.value = `已创建研究任务 ${res.data?.job_id}`
      }
      const newJobId = res.data?.job_id || ''
      closeDrawer()
      await loadJobs()
      if (newJobId) {
        selectedJobId.value = newJobId
        await selectJob(newJobId, { scrollDetail: true })
      }
    } catch (err) {
      errorMessage.value = formatResearchApiError(err, '提交研究任务失败')
    } finally {
      submitting.value = false
    }
  }

  return {
    form,
    nameTouched,
    drawerOpen,
    drawerMode,
    formSourceJobId,
    submitting,
    drawerTitle,
    drawerSubtitle,
    submitButtonLabel,
    todayInputDate,
    toDateInputValue,
    formatListForInput,
    formatTrailingStopPctsForInput,
    withRerunNameSuffix,
    defaultResearchName,
    defaultFormState,
    buildFormPayload,
    syncDefaultName,
    onDrawerFormUpdate,
    openCreateDrawer,
    openDrawer,
    closeDrawer,
    onDrawerEscape,
    loadParamsFromSelectedJob,
    submitJobForm,
  }
}
