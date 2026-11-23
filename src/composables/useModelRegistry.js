import { onBeforeUnmount, ref, watch } from 'vue'
import {
  getModelRegistrySummary,
  getRegistryModel,
  listRegistryModels,
  transitionRegistryModel,
} from '../api/modelRegistry'
import { formatResearchApiError } from '../utils/portfolioResearchPayload'

export function useModelRegistry() {
  const summary = ref(null)
  const models = ref([])
  const loading = ref(false)
  const errorMessage = ref('')
  const detailLoading = ref(false)
  const detailError = ref('')
  const transitioning = ref(false)
  const transitionError = ref('')
  function takeInitialFactor() {
    try {
      const value = window.sessionStorage.getItem('modelFactoryFactor') || ''
      if (value) window.sessionStorage.removeItem('modelFactoryFactor')
      return value
    } catch {
      return ''
    }
  }

  const filters = ref({
    state: '',
    index_code: '',
    accepted: '',
    q: '',
    factor: takeInitialFactor(),
  })
  const selectedModelId = ref('')
  const selectedModel = ref(null)

  let filterTimer = null
  let listSeq = 0
  let detailSeq = 0

  async function loadSummary() {
    try {
      const response = await getModelRegistrySummary()
      summary.value = response?.data || null
    } catch (err) {
      errorMessage.value = formatResearchApiError(err, '加载模型状态失败')
    }
  }

  async function loadModels() {
    const seq = ++listSeq
    loading.value = true
    errorMessage.value = ''
    try {
      const params = {}
      if (filters.value.state) params.state = filters.value.state
      if (filters.value.index_code) params.index_code = filters.value.index_code
      if (filters.value.accepted !== '') params.accepted = filters.value.accepted === 'true'
      if (String(filters.value.factor || '').trim()) params.factor = String(filters.value.factor).trim()
      if (String(filters.value.q || '').trim()) params.q = String(filters.value.q).trim()
      const response = await listRegistryModels(params)
      if (seq !== listSeq) return
      models.value = response?.data || []
      if (selectedModelId.value
        && !models.value.some((model) => model.model_id === selectedModelId.value)) {
        selectedModelId.value = ''
        selectedModel.value = null
      }
    } catch (err) {
      if (seq !== listSeq) return
      errorMessage.value = formatResearchApiError(err, '加载模型目录失败')
      models.value = []
    } finally {
      if (seq === listSeq) loading.value = false
    }
  }

  async function selectModel(modelId) {
    if (!modelId) {
      selectedModelId.value = ''
      selectedModel.value = null
      detailError.value = ''
      return
    }
    selectedModelId.value = modelId
    detailLoading.value = true
    detailError.value = ''
    const seq = ++detailSeq
    try {
      const response = await getRegistryModel(modelId)
      if (seq !== detailSeq) return
      selectedModel.value = response?.data || null
    } catch (err) {
      if (seq !== detailSeq) return
      detailError.value = formatResearchApiError(err, '加载模型详情失败')
      selectedModel.value = null
    } finally {
      if (seq === detailSeq) detailLoading.value = false
    }
  }

  async function transitionModel(modelId, payload) {
    transitioning.value = true
    transitionError.value = ''
    try {
      await transitionRegistryModel(modelId, payload)
      await refresh()
    } catch (err) {
      transitionError.value = formatResearchApiError(err, '状态迁移失败')
    } finally {
      transitioning.value = false
    }
  }

  async function refresh() {
    await Promise.all([loadSummary(), loadModels()])
    if (selectedModelId.value) await selectModel(selectedModelId.value)
  }

  watch(
    filters,
    () => {
      if (filterTimer !== null) clearTimeout(filterTimer)
      filterTimer = setTimeout(() => {
        filterTimer = null
        loadModels()
      }, 250)
    },
    { deep: true },
  )

  onBeforeUnmount(() => {
    if (filterTimer !== null) clearTimeout(filterTimer)
  })

  return {
    summary,
    models,
    loading,
    errorMessage,
    detailLoading,
    detailError,
    transitioning,
    transitionError,
    filters,
    selectedModelId,
    selectedModel,
    loadSummary,
    loadModels,
    selectModel,
    transitionModel,
    refresh,
  }
}
