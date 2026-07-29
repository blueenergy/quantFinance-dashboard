import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FactorCreateDrawer from '../src/components/factor/FactorCreateDrawer.vue'
import { defaultFactorFormState } from '../src/composables/useFactorBacktestForm'
import { FACTOR_SET_OPTIONS, INDEX_OPTIONS, groupFactorsByFamily } from '../src/utils/factorBacktestView'

const CATALOG = [
  { name: 'alpha1', family: 'K线形态', description: '实体涨跌幅占当日振幅的比例', expression: '($close-$open)/($high-$low)' },
  { name: 'alpha4', family: 'K线形态', description: '上下影线', expression: '($close-$low)-($high-$close)' },
  { name: 'alpha6', family: '量价关系', description: '量价背离' },
]

function mountDrawer(props = {}) {
  return mount(FactorCreateDrawer, {
    props: {
      open: true,
      form: defaultFactorFormState(),
      indexOptions: INDEX_OPTIONS,
      factorSetOptions: FACTOR_SET_OPTIONS,
      catalogAvailable: true,
      factorGroups: groupFactorsByFamily(CATALOG),
      factorScopeHint: '未选择时使用 alpha8 全集（3 个）',
      ...props,
    },
  })
}

describe('FactorCreateDrawer', () => {
  it('renders nothing while closed', () => {
    expect(mountDrawer({ open: false }).find('.drawer-panel').exists()).toBe(false)
  })

  it('groups the picker by family and labels factors with their description', () => {
    const wrapper = mountDrawer()
    const text = wrapper.text()
    expect(text).toContain('K线形态')
    expect(text).toContain('量价关系')
    expect(text).toContain('实体涨跌幅占当日振幅的比例')
    expect(wrapper.findAll('.factor-option')).toHaveLength(3)
  })

  it('explains an unpublished catalog instead of showing an empty picker', () => {
    const wrapper = mountDrawer({
      catalogAvailable: false,
      catalogError: '因子目录尚未发布（回测 worker 启动时写入），暂时只能提交整套因子',
      factorGroups: [],
    })
    expect(wrapper.text()).toContain('因子目录尚未发布')
    expect(wrapper.find('.factor-search').exists()).toBe(false)
  })

  it('marks the factors already picked', () => {
    const form = { ...defaultFactorFormState(), factors: ['alpha4'] }
    const picked = mountDrawer({ form }).findAll('.factor-option').filter((option) => option.classes().includes('picked'))
    expect(picked).toHaveLength(1)
    expect(picked[0].text()).toContain('alpha4')
  })

  it('emits a factor toggle rather than editing the form itself', async () => {
    const wrapper = mountDrawer()
    await wrapper.findAll('.factor-option input')[0].trigger('change')
    expect(wrapper.emitted('toggle-factor')).toEqual([['alpha1']])
    expect(wrapper.emitted('update:form')).toBeUndefined()
  })

  it('emits the whole patched form when a field changes', async () => {
    const wrapper = mountDrawer()
    await wrapper.findAll('input[type="date"]')[0].setValue('2024-02-01')
    const [next] = wrapper.emitted('update:form')[0]
    expect(next.start_date).toBe('2024-02-01')
    expect(next.factor_set).toBe('alpha8')
  })

  it('offers the family and search bulk actions', async () => {
    const wrapper = mountDrawer({ form: { ...defaultFactorFormState(), factors: ['alpha1'] } })

    await wrapper.findAll('.family-head .link-btn')[0].trigger('click')
    expect(wrapper.emitted('select-family')).toEqual([['K线形态']])

    await wrapper.findAll('.picker-actions button')[0].trigger('click')
    expect(wrapper.emitted('select-visible')).toHaveLength(1)

    await wrapper.findAll('.picker-actions button')[1].trigger('click')
    expect(wrapper.emitted('clear-factors')).toHaveLength(1)
  })

  it('cannot clear factors when none are picked', () => {
    const wrapper = mountDrawer()
    expect(wrapper.findAll('.picker-actions button')[1].attributes('disabled')).toBeDefined()
  })

  it('blocks submit without a date window and shows a rejection', async () => {
    const wrapper = mountDrawer({
      form: { ...defaultFactorFormState(), end_date: '' },
      formError: 'horizons 需要至少一个 >= 1 的整数，例如 1,5,10,20',
    })
    const submit = wrapper.findAll('.drawer-footer button')[1]
    expect(submit.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('horizons 需要至少一个')
  })

  it('submits when the window is set', async () => {
    const wrapper = mountDrawer()
    await wrapper.findAll('.drawer-footer button')[1].trigger('click')
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })
})
