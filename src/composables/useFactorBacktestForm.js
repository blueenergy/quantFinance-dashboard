import { computed, ref } from 'vue'
import { createFactorBacktestJob, listFactorCatalog } from '../api/factorBacktest'
import {
  buildFactorBacktestPayload,
  dateInputValue,
  formStateFromJob,
} from '../utils/factorBacktestPayload'
import { filterCatalogFactors, groupFactorsByFamily } from '../utils/factorBacktestView'
import { formatResearchApiError as formatApiError } from '../utils/portfolioResearchPayload'
import { isRequestCanceled } from '../utils/request'

function todayInputDate() {
  return new Date().toISOString().slice(0, 10)
}

export function defaultFactorFormState() {
  return {
    name: '',
    index_code: 'csi1000',
    start_date: '2023-01-01',
    end_date: todayInputDate(),
    factor_set: 'alpha8',
    factors: [],
    warmup_days: 60,
    horizons: '1,5,10,20',
    quantiles: 5,
    min_names: 30,
    top_k: '20,50',
    screen_top: 20,
    screen_horizon: '',
    slippage_bps: 10,
    turnover: 1,
  }
}

export function useFactorBacktestForm({
  setMessage = () => {},
  setErrorMessage = () => {},
  loadJobs = async () => {},
  selectJob = async () => {},
} = {}) {
  const drawerOpen = ref(false)
  const submitting = ref(false)
  const formError = ref('')
  const form = ref(defaultFactorFormState())

  // One catalog document per factor set; fetched once and reused, since the
  // worker only republishes it on restart.
  const catalogBySet = ref({})
  const catalogLoading = ref(false)
  const catalogError = ref('')
  const factorSearch = ref('')

  const catalogFactors = computed(() => catalogBySet.value[form.value.factor_set] || [])
  const catalogAvailable = computed(() => catalogFactors.value.length > 0)
  const visibleFactors = computed(() => filterCatalogFactors(catalogFactors.value, factorSearch.value))
  const factorGroups = computed(() => groupFactorsByFamily(visibleFactors.value))
  const selectedFactorCount = computed(() => form.value.factors.length)
  const factorScopeHint = computed(() => (
    selectedFactorCount.value
      ? `已选 ${selectedFactorCount.value} 个因子`
      : `未选择时使用 ${form.value.factor_set} 全集${catalogAvailable.value ? `（${catalogFactors.value.length} 个）` : ''}`
  ))

  async function loadCatalog(factorSet) {
    if (!factorSet || catalogBySet.value[factorSet]) return
    catalogLoading.value = true
    catalogError.value = ''
    try {
      const res = await listFactorCatalog({ factor_set: factorSet })
      const doc = (res.data || []).find((item) => item.factor_set === factorSet)
      catalogBySet.value = { ...catalogBySet.value, [factorSet]: doc?.factors || [] }
    } catch (err) {
      if (isRequestCanceled(err)) return
      // 503 means the worker has not published yet. Job creation still works
      // against the whole set, so this only disables the picker.
      catalogError.value = err?.response?.status === 503
        ? '因子目录尚未发布（回测 worker 启动时写入），暂时只能提交整套因子'
        : formatApiError(err, '加载因子目录失败')
    } finally {
      catalogLoading.value = false
    }
  }

  function toggleFactor(name) {
    const selected = new Set(form.value.factors)
    if (selected.has(name)) selected.delete(name)
    else selected.add(name)
    form.value.factors = Array.from(selected)
  }

  function isFactorSelected(name) {
    return form.value.factors.includes(name)
  }

  function selectFamily(family) {
    const names = factorGroups.value.find((group) => group.family === family)?.factors || []
    const selected = new Set(form.value.factors)
    for (const factor of names) selected.add(factor.name)
    form.value.factors = Array.from(selected)
  }

  function clearFactors() {
    form.value.factors = []
  }

  function selectVisibleFactors() {
    const selected = new Set(form.value.factors)
    for (const factor of visibleFactors.value) selected.add(factor.name)
    form.value.factors = Array.from(selected)
  }

  /**
   * A factor name only exists within its set, so switching sets drops the
   * picks. This runs on the drawer's edits rather than on a watcher, so that
   * prefilling the form for a rerun keeps the factors it came with.
   */
  function onFormUpdate(next) {
    const previousSet = form.value.factor_set
    form.value = next
    if (next.factor_set !== previousSet) {
      form.value.factors = []
      factorSearch.value = ''
      loadCatalog(next.factor_set)
    }
  }

  function openCreateDrawer() {
    form.value = defaultFactorFormState()
    formError.value = ''
    factorSearch.value = ''
    drawerOpen.value = true
    loadCatalog(form.value.factor_set)
  }

  function openRerunDrawer(job) {
    form.value = formStateFromJob(job, defaultFactorFormState())
    formError.value = ''
    factorSearch.value = ''
    drawerOpen.value = true
    loadCatalog(form.value.factor_set)
  }

  function closeDrawer() {
    drawerOpen.value = false
    formError.value = ''
  }

  async function submit() {
    formError.value = ''
    let payload
    try {
      payload = buildFactorBacktestPayload(form.value)
    } catch (err) {
      formError.value = err.message
      return
    }

    submitting.value = true
    setErrorMessage('')
    setMessage('')
    try {
      const res = await createFactorBacktestJob(payload)
      const jobId = res.data?.job_id
      setMessage(jobId ? `已提交因子回测 ${jobId}` : '已提交因子回测')
      drawerOpen.value = false
      await loadJobs()
      if (jobId) await selectJob(jobId, { resetResult: true })
    } catch (err) {
      if (!isRequestCanceled(err)) {
        formError.value = formatApiError(err, '提交因子回测失败')
      }
    } finally {
      submitting.value = false
    }
  }

  return {
    drawerOpen,
    submitting,
    formError,
    form,
    catalogLoading,
    catalogError,
    catalogAvailable,
    catalogFactors,
    factorSearch,
    visibleFactors,
    factorGroups,
    selectedFactorCount,
    factorScopeHint,
    dateInputValue,
    loadCatalog,
    toggleFactor,
    isFactorSelected,
    selectFamily,
    clearFactors,
    selectVisibleFactors,
    openCreateDrawer,
    openRerunDrawer,
    closeDrawer,
    onFormUpdate,
    submit,
  }
}
