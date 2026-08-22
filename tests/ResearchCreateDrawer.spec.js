import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ResearchCreateDrawer from '../src/components/portfolio/ResearchCreateDrawer.vue'

const baseForm = {
  name: 'csi1000 growth-cycle research',
  universe_index: 'csi1000',
  start_date: '2023-01-01',
  end_date: '2024-01-01',
  score_mode: 'weighted',
  score_column: 'composite_growth_cycle_score',
  growth_cycle_weights: '30:70',
  score_specs: 'growth:30,cycle:70',
  selection_mode: 'fixed_top_n',
  threshold_lookback_days: 10,
  max_positions: 20,
  top_n_values: '10,20',
  horizon: 20,
  active_caps: '0.2',
  transaction_cost: 0.001,
  buy_commission_rate: 0.0001,
  sell_commission_rate: 0.0001,
  min_commission: 5,
  stamp_tax_rate: 0.0005,
  transfer_fee_rate: 0,
  initial_capital: 1_000_000,
  trailing_stop_pcts: '0,0.15',
  regime_cash: false,
}

function mountDrawer(overrides = {}) {
  return mount(ResearchCreateDrawer, {
    props: {
      open: true,
      form: { ...baseForm },
      universeOptions: [{ value: 'csi1000', label: 'csi1000 - 中证1000' }],
      submitting: false,
      title: '新建研究任务',
      subtitle: 'worker executes jobs',
      submitLabel: '提交研究任务',
      ...overrides,
    },
  })
}

describe('ResearchCreateDrawer', () => {
  it('shows create vs rerun titles and submit labels', async () => {
    const create = mountDrawer()
    expect(create.text()).toContain('新建研究任务')
    expect(create.text()).toContain('提交研究任务')
    create.unmount()

    const rerun = mountDrawer({
      title: '基于原参数调整后重跑',
      submitLabel: '提交重跑',
      subtitle: '来源任务 job-1 · 提交后新建任务并保留 rerun 链路',
    })
    expect(rerun.text()).toContain('基于原参数调整后重跑')
    expect(rerun.text()).toContain('提交重跑')
    expect(rerun.text()).toContain('来源任务 job-1')
  })

  it('disables submit when dates are missing', async () => {
    const wrapper = mountDrawer({
      form: { ...baseForm, start_date: '', end_date: '' },
    })
    const submit = wrapper.findAll('button').find((btn) => btn.text().includes('提交'))
    expect(submit.attributes('disabled')).toBeDefined()
  })

  it('emits close on Escape and submit on primary click', async () => {
    const wrapper = mountDrawer()
    expect(wrapper.element.querySelector('.drawer-panel input, .drawer-panel select')).not.toBeNull()
    await wrapper.find('.drawer-panel').trigger('keydown.esc')
    expect(wrapper.emitted('close')?.length).toBe(1)

    const submit = wrapper.findAll('button').find((btn) => btn.text().includes('提交研究任务'))
    await submit.trigger('click')
    expect(wrapper.emitted('submit')?.length).toBe(1)
  })

  it('emits name-touched and form updates when name changes', async () => {
    const wrapper = mountDrawer()
    const nameInput = wrapper.find('input')
    await nameInput.setValue('custom name')
    expect(wrapper.emitted('name-touched')?.length).toBe(1)
    expect(wrapper.emitted('update:form')?.[0]?.[0]?.name).toBe('custom name')
  })

  it('updates the form before emitting a universe change', async () => {
    let currentForm = { ...baseForm }
    const observations = []
    const wrapper = mountDrawer({
      universeOptions: [
        { value: 'csi1000', label: 'csi1000 - 中证1000' },
        { value: 'csi300', label: 'csi300 - 沪深300' },
      ],
      'onUpdate:form': (next) => {
        currentForm = next
        observations.push(`update:${next.universe_index}`)
      },
      onUniverseChange: (universeIndex) => {
        observations.push(`change:${universeIndex}:${currentForm.universe_index}`)
      },
    })

    await wrapper.find('select').setValue('csi300')

    expect(observations).toEqual(['update:csi300', 'change:csi300:csi300'])
  })

  it('switches between weighted recipes and multi-select score columns', async () => {
    const wrapper = mountDrawer()
    expect(wrapper.text()).toContain('多维加权配方')
    expect(wrapper.find('textarea').exists()).toBe(true)

    const modeSelect = wrapper.findAll('select').find((select) => (
      select.find('option[value="column"]').exists()
    ))
    await modeSelect.setValue('column')
    const next = wrapper.emitted('update:form').at(-1)[0]
    expect(next.score_mode).toBe('column')
    expect(next.score_columns).toEqual(['fundamental_score'])

    await wrapper.setProps({
      form: {
        ...baseForm,
        score_mode: 'column',
        score_column: 'fundamental_score',
        score_columns: ['fundamental_score'],
      },
    })
    expect(wrapper.text()).toContain('评分维度（可多选）')
    expect(wrapper.find('textarea').exists()).toBe(false)

    const valueCheckbox = wrapper.find('input[value="value_score"]')
    await valueCheckbox.setValue(true)
    expect(wrapper.emitted('update:form').at(-1)[0].score_columns).toEqual([
      'fundamental_score',
      'value_score',
    ])
  })

  it('shows actual preset weights for predefined multi-dimension scores', async () => {
    const wrapper = mountDrawer({
      form: {
        ...baseForm,
        score_mode: 'preset',
        score_column: 'composite_conservative_score',
        score_columns: ['composite_conservative_score', 'composite_defensive_score'],
      },
    })
    expect(wrapper.text()).toContain('保守')
    expect(wrapper.text()).toContain('防御')
    expect(wrapper.text()).toContain('基本面 30%')
    expect(wrapper.text()).toContain('价值 25%')
    expect(wrapper.text()).toContain('成长 20%')
    expect(wrapper.text()).toContain('基本面 35%')
  })

  it('disables submit when no score columns are selected', async () => {
    const wrapper = mountDrawer({
      form: {
        ...baseForm,
        score_mode: 'column',
        score_column: '',
        score_columns: [],
      },
    })
    const submit = wrapper.findAll('button').find((btn) => btn.text().includes('提交'))
    expect(submit.attributes('disabled')).toBeDefined()
  })

  it('preserves v-model.number empty and numeric values without NaN', async () => {
    const wrapper = mountDrawer()
    const capitalInput = wrapper
      .findAll('label')
      .find((label) => label.text().includes('initial capital'))
      .find('input')

    await capitalInput.setValue('')
    const emptyValue = wrapper.emitted('update:form').at(-1)[0].initial_capital
    expect(emptyValue).toBe('')
    expect(Number.isNaN(emptyValue)).toBe(false)

    await wrapper.setProps({ form: { ...baseForm, initial_capital: '' } })
    await capitalInput.setValue('12.5')
    expect(wrapper.emitted('update:form').at(-1)[0].initial_capital).toBe(12.5)
  })

  it('accepts comma-separated rebalance days as text input', async () => {
    const wrapper = mountDrawer()
    const rebalanceInput = wrapper
      .findAll('label')
      .find((label) => label.text().includes('rebalance_days'))
      .find('input')

    await rebalanceInput.setValue('10,20,30,40')
    expect(wrapper.emitted('update:form').at(-1)[0].horizon).toBe('10,20,30,40')
  })

  it('conditionally renders and validates dynamic-threshold fields', async () => {
    const wrapper = mountDrawer()
    expect(wrapper.text()).toContain('固定 Top N')
    expect(wrapper.text()).not.toContain('threshold_lookback_days')

    await wrapper.setProps({
      form: {
        ...baseForm,
        selection_mode: 'dynamic_score_threshold',
        top_n_values: '10,20',
      },
    })
    expect(wrapper.text()).toContain('阈值基准排名（Top N）')
    expect(wrapper.text()).toContain('threshold_lookback_days')
    expect(wrapper.text()).toContain('max_positions')
    let submit = wrapper.findAll('button').find((btn) => btn.text().includes('提交'))
    expect(submit.attributes('disabled')).toBeDefined()

    await wrapper.setProps({
      form: {
        ...baseForm,
        selection_mode: 'dynamic_score_threshold',
        top_n_values: '10',
      },
    })
    submit = wrapper.findAll('button').find((btn) => btn.text().includes('提交'))
    expect(submit.attributes('disabled')).toBeUndefined()
  })

  it('lets non-bull cash run without always-invest', async () => {
    const wrapper = mountDrawer({
      form: { ...baseForm, universe_index: 'csi500', regime_always_invest: false, regime_cash: true },
    })
    expect(wrapper.text()).toContain('始终满仓')
    expect(wrapper.text()).toContain('非牛空仓')
    expect(wrapper.text()).not.toContain('非牛空仓对照')
    expect(wrapper.text()).toContain('不必和始终满仓一起跑')
    const modeLabels = wrapper.findAll('label.inline-check')
    expect(modeLabels[0].text()).toContain('始终满仓')
    expect(modeLabels[1].text()).toContain('非牛空仓')
    expect(modeLabels[0].find('input').element.checked).toBe(false)
    expect(modeLabels[1].find('input').element.checked).toBe(true)
    expect(modeLabels[1].find('input').attributes('disabled')).toBeUndefined()
  })
})
