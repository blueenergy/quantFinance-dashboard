import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AvailableDatesModal from '../src/components/AvailableDatesModal.vue'

const dates = ['20260720', '20260718']

function mountModal(overrides = {}) {
  return mount(AvailableDatesModal, {
    props: {
      show: true,
      symbol: '600519',
      availableDates: dates,
      selected: [dates[0]],
      formatDateDisplay: value => `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`,
      ...overrides
    }
  })
}

function buttonByText(wrapper, text) {
  return wrapper.findAll('button').find(button => button.text().includes(text))
}

describe('AvailableDatesModal', () => {
  it('renders available dates and the current selection', () => {
    const wrapper = mountModal()
    const checkboxes = wrapper.findAll('input[type="checkbox"]')

    expect(wrapper.text()).toContain('选择 600519 的可用评分日期')
    expect(wrapper.text()).toContain('2026-07-20')
    expect(wrapper.text()).toContain('2026-07-18')
    expect(checkboxes[0].element.checked).toBe(true)
    expect(checkboxes[1].element.checked).toBe(false)
  })

  it('emits selection and apply actions', async () => {
    const wrapper = mountModal()

    await buttonByText(wrapper, '全选').trigger('click')
    await buttonByText(wrapper, '全不选').trigger('click')
    await wrapper.findAll('input[type="checkbox"]')[1].setValue(true)
    await buttonByText(wrapper, '应用').trigger('click')

    expect(wrapper.emitted('select-all')).toHaveLength(1)
    expect(wrapper.emitted('deselect-all')).toHaveLength(1)
    expect(wrapper.emitted('toggle')).toEqual([[dates[1], true]])
    expect(wrapper.emitted('apply')).toEqual([[[dates[0]]]])
  })

  it('closes from cancel or the backdrop, but not modal content', async () => {
    const wrapper = mountModal()

    await wrapper.find('.available-dates-modal').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()

    await buttonByText(wrapper, '取消').trigger('click')
    await wrapper.find('.modal-overlay').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(2)
  })
})
