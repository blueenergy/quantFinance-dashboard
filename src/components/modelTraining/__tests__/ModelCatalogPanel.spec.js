import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ModelCatalogPanel from '../ModelCatalogPanel.vue'

const summary = {
  total: 5,
  accepted: 2,
  active_stale: 0,
  states: { live: 1, shadow: 1, validated: 1, research: 1, retired: 1, rejected: 0 },
}

const models = [
  {
    model_id: 'research-csi1000-clean-raw5',
    family_id: 'csi1000-clean-raw5',
    index_code: 'csi1000',
    state: 'live',
    accepted: true,
    validation: { protocol: 'portfolio_oos', verdict: 'weak' },
    operational_gate: { passed: false, reason: 'insufficient_universes' },
    health: {
      last_prediction_date: '20261116',
      date_count: 134,
      prediction_count: 124565,
      stale_days: 0,
    },
  },
  {
    model_id: 'research-csi1000-clean-raw5-oos2025',
    family_id: 'csi1000-clean-raw5',
    index_code: 'csi1000',
    state: 'validated',
    accepted: false,
    validation: { protocol: 'portfolio_oos', verdict: 'weak' },
    operational_gate: { passed: false, reason: 'insufficient_universes' },
    health: {
      last_prediction_date: '20261113',
      date_count: 451,
      prediction_count: 449413,
      stale_days: 3,
    },
  },
]

function mountPanel(overrides = {}) {
  return mount(ModelCatalogPanel, {
    props: {
      summary,
      models,
      loading: false,
      filters: { state: '', index_code: '', accepted: '', q: '' },
      selectedModelId: '',
      ...overrides,
    },
  })
}

describe('ModelCatalogPanel', () => {
  it('renders the state board and catalog rows', () => {
    const wrapper = mountPanel()
    const text = wrapper.text()
    expect(text).toContain('模型目录')
    expect(text).toContain('实盘')
    expect(text).toContain('已验收')
    expect(text).toContain('research-csi1000-clean-raw5')
    expect(text).toContain('portfolio_oos / weak')
    expect(text).toContain('fail · insufficient_universes')
    expect(text).toContain('449413')
  })

  it('toggles the state filter from a state card', async () => {
    const wrapper = mountPanel()
    const liveCard = wrapper.findAll('.state-card').find((card) => card.text().includes('实盘'))
    await liveCard.trigger('click')
    expect(wrapper.emitted('update:filters')).toEqual([[{ state: 'live' }]])
  })

  it('emits the selected model when a row is clicked', async () => {
    const wrapper = mountPanel()
    await wrapper.find('tbody tr').trigger('click')
    expect(wrapper.emitted('select-model')).toEqual([['research-csi1000-clean-raw5']])
  })

  it('emits a q filter from the search input', async () => {
    const wrapper = mountPanel()
    await wrapper.find('input[type="search"]').setValue('clean')
    expect(wrapper.emitted('update:filters')).toEqual([[{ q: 'clean' }]])
  })
})
