import { computed, ref } from 'vue'
import {
  buildAllCombos,
  buildCompareSubmitPayload,
  estimateDurationSeconds,
  extractPresetParams,
  MAX_COMPARE_TASKS,
  normalizeCompareSymbols,
  parseCompareSymbols,
} from '../utils/backtestComboPayload'
import { defaultBacktestDateRange } from '../utils/backtestSymbolUtils'

export function useStrategyCompareForm({ strategies = ref([]), templates = ref({}) } = {}) {
  const searchMode = ref('grid')
  const name = ref('')
  const symbolsText = ref('')
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

  const parsedSymbols = computed(() =>
    normalizeCompareSymbols(symbolsText.value, assetType.value),
  )

  const usableStrategyKeys = computed(() =>
    (strategies.value || [])
      .filter((s) => s && s.key && s.can_use !== false)
      .map((s) => s.key),
  )

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

  function selectAllStrategies() {
    if (searchMode.value === 'single') {
      message.value = '单次模式下只能选 1 个策略，请先切换到网格'
      return
    }
    const keys = usableStrategyKeys.value
    selectedStrategyKeys.value = [...keys]
    const nextStates = {}
    for (const key of keys) {
      nextStates[key] = ensureStrategyState(key)
    }
    strategyStates.value = nextStates
    message.value = keys.length ? `已选中 ${keys.length} 个可用策略` : '没有可用策略'
    syncDefaultName()
  }

  function clearStrategies() {
    selectedStrategyKeys.value = []
    strategyStates.value = {}
    excludedPreviewKeys.value = []
  }

  function selectAllPresetsForStrategy(strategyKey) {
    if (searchMode.value === 'single') {
      message.value = '单次模式下只能选 1 个预设'
      return
    }
    const state = ensureStrategyState(strategyKey)
    const presets = templates.value[strategyKey] || []
    state.selectedPresetKeys = presets.map((p) => p.preset).filter(Boolean)
  }

  function selectAllPresets() {
    if (searchMode.value === 'single') {
      message.value = '单次模式下只能选 1 个预设，请先切换到网格'
      return
    }
    if (!selectedStrategyKeys.value.length) {
      message.value = '请先选择策略'
      return
    }
    for (const key of selectedStrategyKeys.value) {
      selectAllPresetsForStrategy(key)
    }
    message.value = '已选中各策略的全部预设'
  }

  function selectDefaultPresetsOnly() {
    for (const key of selectedStrategyKeys.value) {
      const presets = templates.value[key] || []
      const defaultPreset = presets.find((p) => p.is_default) || presets[0]
      const state = ensureStrategyState(key)
      state.selectedPresetKeys = defaultPreset ? [defaultPreset.preset] : []
    }
    if (selectedStrategyKeys.value.length) {
      message.value = '已恢复为各策略默认预设'
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
    if (!parsedSymbols.value.length) return 0
    return parsedSymbols.value.length * activeCombos.value.length
  })

  const estimatedSeconds = computed(() => estimateDurationSeconds(totalTasks.value))

  const canSubmit = computed(
    () =>
      totalTasks.value > 0 &&
      totalTasks.value <= MAX_COMPARE_TASKS &&
      parsedSymbols.value.length > 0,
  )

  function buildPayload() {
    message.value = ''
    try {
      return buildCompareSubmitPayload({
        name: name.value,
        symbols: parsedSymbols.value,
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
    if (name.value.trim() || !parsedSymbols.value.length || !activeStrategyStates.value.length) {
      return
    }
    const keys = activeStrategyStates.value.map((s) => s.strategyKey).join('+')
    const syms = parsedSymbols.value
    const label =
      syms.length <= 2 ? syms.join('+') : `${syms[0]}等${syms.length}只`
    name.value = `${label} · ${keys}`
  }

  function setSymbolsText(text) {
    symbolsText.value = text
  }

  function addSymbol(code, preferredType) {
    addSymbols([code], preferredType)
  }

  function addSymbols(codes, preferredType) {
    const type = preferredType || assetType.value
    const next = normalizeCompareSymbols(
      [...parseCompareSymbols(symbolsText.value), ...(codes || [])],
      type,
    )
    symbolsText.value = next.join(', ')
    if (preferredType) assetType.value = preferredType
    syncDefaultName()
    return next
  }

  function replaceSymbols(codes, preferredType) {
    const type = preferredType || assetType.value
    const next = normalizeCompareSymbols(codes || [], type)
    symbolsText.value = next.join(', ')
    if (preferredType) assetType.value = preferredType
    syncDefaultName()
    return next
  }

  function clearSymbols() {
    symbolsText.value = ''
  }

  function removeSymbol(code) {
    const target = String(code || '').trim().toUpperCase()
    const next = parsedSymbols.value.filter((s) => s !== target)
    symbolsText.value = next.join(', ')
    syncDefaultName()
  }

  function toggleSymbol(code, preferredType) {
    const normalized = normalizeCompareSymbols([code], preferredType || assetType.value)[0]
    if (!normalized) return
    if (parsedSymbols.value.includes(normalized)) {
      removeSymbol(normalized)
    } else {
      addSymbol(normalized, preferredType)
    }
  }

  function presetBaseline(preset) {
    return extractPresetParams(preset?.params_with_desc)
  }

  return {
    searchMode,
    name,
    symbolsText,
    parsedSymbols,
    assetType,
    startDate,
    endDate,
    initialCash,
    selectedStrategyKeys,
    strategyStates,
    excludedPreviewKeys,
    message,
    usableStrategyKeys,
    activeStrategyStates,
    allCombos,
    activeCombos,
    totalTasks,
    estimatedSeconds,
    canSubmit,
    toggleStrategy,
    selectAllStrategies,
    clearStrategies,
    selectAllPresets,
    selectAllPresetsForStrategy,
    selectDefaultPresetsOnly,
    ensureStrategyState,
    buildPayload,
    syncDefaultName,
    setSymbolsText,
    addSymbol,
    addSymbols,
    replaceSymbols,
    clearSymbols,
    removeSymbol,
    toggleSymbol,
    presetBaseline,
    MAX_COMPARE_TASKS,
  }
}
