import { computed } from 'vue'

const UNIVERSE_OPTIONS = [
  { value: 'hs300', label: 'hs300 - 沪深300' },
  { value: 'a500', label: 'a500 - 中证A500' },
  { value: 'csi500', label: 'csi500 - 中证500' },
  { value: 'csi1000', label: 'csi1000 - 中证1000' },
  { value: 'csi2000', label: 'csi2000 - 中证2000' },
  { value: 'star50', label: 'star50 - 科创50' },
]

function clampWeight(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.min(1, Math.max(0, numeric))
}

function roundWeight(value) {
  return Number(clampWeight(value).toFixed(4))
}

export function usePortfolioPlanGeneration({
  strategies,
  generateForm,
  parameterPresets,
  loadParameterPresets,
  loadPlanGenerationWatermark,
}) {
  const availableStrategies = computed(() => strategies.value.filter((strategy) => strategy.status !== 'disabled'))
  const selectedGenerateStrategy = computed(() => (
    strategies.value.find((strategy) => strategy.strategy_template_id === generateForm.value.strategy_template_id) || null
  ))
  const selectedPreset = computed(() => (
    parameterPresets.value.find((preset) => preset.preset_id === generateForm.value.preset_id) || null
  ))
  const presetEvidenceRows = computed(() => {
    const rows = selectedPreset.value?.evidence || []
    return Array.isArray(rows) ? rows.slice(-5).reverse() : []
  })

  function strategyDisplayName(row) {
    if (!row) return '-'
    const id = String(row.strategy_template_id || '')
    const scoreType = String(row.score_type || row.params_snapshot?.score_type || '')
    if (id.startsWith('growth_cycle') || scoreType.startsWith('growth_cycle')) return '成长周期指数增强'
    return row.strategy_name || row.name || row.strategy_template_id || '-'
  }

  function normalizePlanParams(params) {
    const next = { ...params }
    if (!UNIVERSE_OPTIONS.some((option) => option.value === next.universe_index)) next.universe_index = UNIVERSE_OPTIONS[0].value
    const growth = Number.isFinite(Number(next.growth_weight)) ? clampWeight(next.growth_weight) : 0.3
    next.growth_weight = roundWeight(growth)
    next.cycle_weight = roundWeight(1 - growth)
    const capital = Number(next.initial_capital)
    next.initial_capital = Number.isFinite(capital) && capital > 0 ? capital : 1_000_000
    const trailing = Number(next.trailing_stop_pct)
    if (!Number.isFinite(trailing) || trailing <= 0) delete next.trailing_stop_pct
    else next.trailing_stop_pct = clampWeight(trailing)
    for (const [key, fallback] of Object.entries({
      buy_commission_rate: 0.0001,
      sell_commission_rate: 0.0001,
      min_commission: 5,
      stamp_tax_rate: 0.0005,
      transfer_fee_rate: 0,
    })) {
      const value = Number(next[key])
      next[key] = Number.isFinite(value) && value >= 0 ? value : fallback
    }
    return next
  }

  function syncGenerateParamsFromStrategy() {
    generateForm.value.params = {}
  }

  function applySelectedPreset() {
    generateForm.value.params = normalizePlanParams({ ...(selectedPreset.value?.params || {}) })
  }

  function applyDefaultPreset() {
    if (generateForm.value.preset_id || !parameterPresets.value.length) return
    const preset = parameterPresets.value.find((row) => row.is_default)
      || parameterPresets.value.find((row) => row.status === 'recommended')
      || parameterPresets.value[0]
    generateForm.value.preset_id = preset.preset_id
    applySelectedPreset()
  }

  async function setGenerateStrategy(value) {
    generateForm.value.strategy_template_id = value
    generateForm.value.preset_id = ''
    syncGenerateParamsFromStrategy()
    await loadParameterPresets()
    applyDefaultPreset()
    await loadPlanGenerationWatermark()
  }

  function setGenerateField(key, value) {
    generateForm.value[key] = value
  }

  function setGenerateParam(key, value) {
    generateForm.value.params = { ...generateForm.value.params, [key]: value }
  }

  function setGeneratePreset(value) {
    generateForm.value.preset_id = value
    applySelectedPreset()
  }

  function setGrowthWeight(value) {
    const growth = roundWeight(value)
    generateForm.value.params = { ...generateForm.value.params, growth_weight: growth, cycle_weight: roundWeight(1 - growth) }
  }

  function setCycleWeight(value) {
    const cycle = roundWeight(value)
    generateForm.value.params = { ...generateForm.value.params, cycle_weight: cycle, growth_weight: roundWeight(1 - cycle) }
  }

  return {
    availableStrategies,
    selectedGenerateStrategy,
    selectedPreset,
    presetEvidenceRows,
    universeOptions: UNIVERSE_OPTIONS,
    strategyOptionLabel: strategyDisplayName,
    planDisplayTitle: strategyDisplayName,
    normalizePlanParams,
    syncGenerateParamsFromStrategy,
    applyDefaultPreset,
    setGenerateStrategy,
    setGenerateField,
    setGenerateParam,
    setGeneratePreset,
    setGrowthWeight,
    setCycleWeight,
  }
}
