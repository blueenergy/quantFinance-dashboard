import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { usePortfolioPlanGeneration } from '../usePortfolioPlanGeneration'
import { REGIME_CASH_REMINDER } from '../../utils/regimeCash'

describe('usePortfolioPlanGeneration', () => {
  it('keeps regime_cash when switching universe', () => {
    const generateForm = ref({
      strategy_template_id: '',
      preset_id: '',
      params: { universe_index: 'csi1000', regime_cash: true },
    })
    const api = usePortfolioPlanGeneration({
      strategies: ref([]),
      generateForm,
      parameterPresets: ref([]),
      loadParameterPresets: async () => {},
      loadPlanGenerationWatermark: async () => {},
    })

    api.setGenerateParam('universe_index', 'csi500')

    expect(generateForm.value.params.universe_index).toBe('csi500')
    expect(generateForm.value.params.regime_cash).toBe(true)
    expect(REGIME_CASH_REMINDER).toContain('是否启用由你决定')
  })
})
