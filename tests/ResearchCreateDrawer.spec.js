import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ResearchCreateDrawer from '../src/components/portfolio/ResearchCreateDrawer.vue'

const baseForm = {
  name: 'csi1000 growth-cycle research',
  universe_index: 'csi1000',
  start_date: '2023-01-01',
  end_date: '2024-01-01',
  score_column: 'composite_growth_cycle_score',
  growth_cycle_weights: '30:70',
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

  it('preserves v-model.number empty and numeric values without NaN', async () => {
    const wrapper = mountDrawer()
    const horizonInput = wrapper
      .findAll('label')
      .find((label) => label.text().includes('rebalance_days'))
      .find('input')

    await horizonInput.setValue('')
    const emptyValue = wrapper.emitted('update:form').at(-1)[0].horizon
    expect(emptyValue).toBe('')
    expect(Number.isNaN(emptyValue)).toBe(false)

    await wrapper.setProps({ form: { ...baseForm, horizon: '' } })
    await horizonInput.setValue('12.5')
    expect(wrapper.emitted('update:form').at(-1)[0].horizon).toBe(12.5)
  })
})
