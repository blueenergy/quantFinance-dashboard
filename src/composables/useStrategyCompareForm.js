import { computed, ref } from 'vue'
import {
  buildAllCombos,
  buildCompareSubmitPayload,
  estimateDurationSeconds,
  extractPresetParams,
  MAX_COMPARE_TASKS,
} from '../utils/backtestComboPayload'
import { defaultBacktestDateRange } from '../utils/backtestSymbolUtils'

export function useStrategyCompareForm({ strategies = ref([]), templates = ref({}) } = {}) {
  const searchMode = ref('grid')
  const name = ref('')
  const symbol = ref('')
  const assetType = ref('stock')
  const startDate = ref('')
  const endDate = ref('')
  const initialCash = ref(1000000)
  const selectedStrategyKeys = ref([])
  const strategyStates = ref({})
  const excludedPreviewKeys = ref([])
  const message = ref('')

  const dates = defaultBacktestDateRange()
  startDate.value = dates.start
  endDate.value = dates.end

  function ensureStrategyState(strategyKey) {
    if (!strategyStates.value[strategyKey]) {
      const presets = templates.value[strategyKey] || []
      const defaultPreset = presets.find((p) => p.is_default) || presets[0]
      strategyStates.value[strategyKey] = {
        strategyKey,
        expanded: false,
        selectedPresetKeys: defaultPreset ? [defaultPreset.preset] : [],
        experimentValuesByPreset: {},
      }
    }
    return strategyStates.value[strategyKey]
  }

  function toggleStrategy(strategyKey) {
    const idx = selectedStrategyKeys.value.indexOf(strategyKey)
    if (idx >= 0) {
      selectedStrategyKeys.value.splice(idx, 1)
      delete strategyStates.value[strategyKey]
    } else {
      if (searchMode.value === 'single') {
        selectedStrategyKeys.value = [strategyKey]
        strategyStates.value = {}
      } else {
        selectedStrategyKeys.value.push(strategyKey)
      }
      ensureStrategyState(strategyKey)
    }
  }

  const activeStrategyStates = computed(() =>
    selectedStrategyKeys.value.map((key) => {
      const state = ensureStrategyState(key)
      return {
        strategyKey: key,
        strategyName: strategies.value.find((s) => s.key === key)?.name || key,
        presets: templates.value[key] || [],
        ...state,
      }
    }),
  )

  const allCombos = computed(() =>
    buildAllCombos(
      activeStrategyStates.value.map((s) => ({
        strategyKey: s.strategyKey,
        presets: s.presets,
        selectedPresetKeys: s.selectedPresetKeys,
        experimentValuesByPreset: s.experimentValuesByPreset,
      })),
    ),
  )

  const activeCombos = computed(() =>
    allCombos.value.filter((c) => !excludedPreviewKeys.value.includes(c.preview_key)),
  )

  const totalTasks = computed(() => {
    const sym = String(symbol.value || '').trim()
    if (!sym) return 0
    return activeCombos.value.length
  })

  const estimatedSeconds = computed(() => estimateDurationSeconds(totalTasks.value))

  const canSubmit = computed(
    () => totalTasks.value > 0 && totalTasks.value <= MAX_COMPARE_TASKS && String(symbol.value || '').trim(),
  )

  function buildPayload() {
    message.value = ''
    try {
      return buildCompareSubmitPayload({
        name: name.value,
        symbol: symbol.value,
        assetType: assetType.value,
        startDate: startDate.value,
        endDate: endDate.value,
        initialCash: initialCash.value,
        combos: allCombos.value,
        excludedPreviewKeys: excludedPreviewKeys.value,
      })
    } catch (err) {
      message.value = err?.message || '提交参数无效'
      return null
    }
  }

  function syncDefaultName() {
    if (!name.value.trim() && symbol.value && activeStrategyStates.value.length) {
      const keys = activeStrategyStates.value.map((s) => s.strategyKey).join('+')
      name.value = `${symbol.value} · ${keys}`
    }
  }

  function presetBaseline(preset) {
    return extractPresetParams(preset?.params_with_desc)
  }

  return {
    searchMode,
    name,
    symbol,
    assetType,
    startDate,
    endDate,
    initialCash,
    selectedStrategyKeys,
    strategyStates,
    excludedPreviewKeys,
    message,
    activeStrategyStates,
    allCombos,
    activeCombos,
    totalTasks,
    estimatedSeconds,
    canSubmit,
    toggleStrategy,
    ensureStrategyState,
    buildPayload,
    syncDefaultName,
    presetBaseline,
    MAX_COMPARE_TASKS,
  }
}
