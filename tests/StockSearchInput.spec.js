import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import StockSearchInput from '../src/components/StockSearchInput.vue'

vi.mock('../src/api/stock', () => ({
  searchStocks: vi.fn().mockResolvedValue([]),
}))

function mountInput(props = {}) {
  return mount(StockSearchInput, {
    props: {
      modelValue: '',
      ...props,
    },
    global: {
      stubs: {
        'v-text-field': {
          name: 'VTextField',
          props: [
            'modelValue',
            'theme',
            'bgColor',
            'color',
            'baseColor',
            'class',
          ],
          template: '<input class="v-text-field-stub" />',
        },
        'v-menu': true,
        'v-list': true,
        'v-list-item': true,
        'v-chip': true,
      },
    },
  })
}

describe('StockSearchInput tone', () => {
  it('defaults to on-light without on-dark field class', () => {
    const wrapper = mountInput()
    const field = wrapper.findComponent({ name: 'VTextField' })
    expect(field.props('theme')).toBeUndefined()
    expect(field.props('bgColor')).toBeUndefined()
    expect(field.props('class')).not.toContain('stock-search-input-on-dark')
    wrapper.unmount()
  })

  it('applies on-dark class and thin field bg', () => {
    const wrapper = mountInput({ tone: 'on-dark' })
    const field = wrapper.findComponent({ name: 'VTextField' })
    expect(field.props('class')).toContain('stock-search-input-on-dark')
    expect(field.props('bgColor')).toBe('rgba(255,255,255,.06)')
    expect(field.props('theme')).toBeUndefined()
    wrapper.unmount()
  })

  it('merges layout inputClass with on-dark tone class', () => {
    const wrapper = mountInput({ tone: 'on-dark', inputClass: 'mb-3' })
    const field = wrapper.findComponent({ name: 'VTextField' })
    const fieldClass = field.props('class')
    expect(String(fieldClass)).toContain('stock-search-input-on-dark')
    expect(String(fieldClass)).toContain('mb-3')
    wrapper.unmount()
  })

  it('does not pass deprecated theme to v-text-field', () => {
    const wrapper = mountInput({ theme: 'dark', tone: 'on-light' })
    const field = wrapper.findComponent({ name: 'VTextField' })
    expect(field.props('theme')).toBeUndefined()
    wrapper.unmount()
  })
})
