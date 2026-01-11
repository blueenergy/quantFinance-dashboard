import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import StrategyParamsEditor from '../src/components/StrategyParamsEditor.vue'

const mountWith = (props) => {
  return mount(StrategyParamsEditor, {
    props,
    global: {
      config: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith('v-')
        }
      }
    }
  })
}

describe('StrategyParamsEditor', () => {
  it('auto-loads preferred preset when provided', async () => {
    const presets = [
      {
        preset: 'dragon_default',
        is_default: true,
        params_with_desc: { a: { value: 1 }, b: { value: 2 } }
      },
      {
        preset: 'dragon_aggressive',
        is_default: false,
        params_with_desc: { a: { value: 9 } }
      }
    ]

    const wrapper = mountWith({
      strategyKey: 'hidden_dragon',
      strategyInfo: { param_definitions: {} },
      presets,
      initialParams: { a: 0 },
      preferredPreset: 'dragon_aggressive',
      showJsonPreview: false
    })

    await flushPromises()

    const emits = wrapper.emitted('update:params') || []
    expect(emits.length).toBeGreaterThan(0)

    const last = emits[emits.length - 1][0]
    expect(last).toEqual({ a: 9 })
  })

  it('keeps initialParams and does not auto-load default when initialParams is non-empty and preferredPreset does not match', async () => {
    const presets = [
      {
        preset: 'dragon_default',
        is_default: true,
        params_with_desc: { a: { value: 1 }, b: { value: 2 } }
      }
    ]

    const wrapper = mountWith({
      strategyKey: 'hidden_dragon',
      strategyInfo: { param_definitions: {} },
      presets,
      initialParams: { a: 7 },
      preferredPreset: 'not_exists',
      showJsonPreview: false
    })

    await flushPromises()

    // The latest emitted params should stay as initialParams, not default preset.
    const emits = wrapper.emitted('update:params') || []
    const last = emits.length ? emits[emits.length - 1][0] : null
    expect(last).toEqual({ a: 7 })
  })

  it('auto-loads default preset when no preferredPreset and initialParams is empty', async () => {
    const presets = [
      {
        preset: 'dragon_default',
        is_default: true,
        params_with_desc: { a: { value: 1 }, b: { value: 2 } }
      }
    ]

    const wrapper = mountWith({
      strategyKey: 'hidden_dragon',
      strategyInfo: { param_definitions: {} },
      presets,
      initialParams: {},
      preferredPreset: '',
      showJsonPreview: false
    })

    await flushPromises()

    const emits = wrapper.emitted('update:params') || []
    expect(emits.length).toBeGreaterThan(0)

    const last = emits[emits.length - 1][0]
    expect(last).toEqual({ a: 1, b: 2 })
  })
})
