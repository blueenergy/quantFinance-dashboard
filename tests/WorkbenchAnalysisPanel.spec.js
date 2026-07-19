import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { shallowMount } from '@vue/test-utils'

import WorkbenchAnalysisPanel from '../src/components/stock/WorkbenchAnalysisPanel.vue'

const VBtnStub = defineComponent({
  name: 'VBtn',
  props: {
    disabled: { type: Boolean, default: false },
  },
  emits: ['click'],
  template: '<button type="button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
})

const VSelectStub = defineComponent({
  name: 'VSelect',
  props: {
    modelValue: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  template: '<select :value="modelValue" />',
})

function mountPanel(props = {}) {
  return shallowMount(WorkbenchAnalysisPanel, {
    props: {
      stockSymbol: '000001.SZ',
      analysisModeOptions: [
        { title: '多专家', value: 'multi_expert_v1' },
        { title: '经典', value: 'classic' },
      ],
      ...props,
    },
    global: {
      stubs: {
        VBtn: VBtnStub,
        VSelect: VSelectStub,
        VAlert: true,
        AnalysisDetailContent: true,
      },
    },
  })
}

describe('WorkbenchAnalysisPanel', () => {
  it('emits submit from the deep-analysis action', async () => {
    const wrapper = mountPanel()

    await wrapper.findAll('button').find((button) => button.text() === '开始深度分析').trigger('click')

    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('emits the selected analysis history item', async () => {
    const item = {
      id: 'history-1',
      created_at: '2026-07-19 12:00:00',
      analysis_mode: 'classic',
      analysis: { final_conclusion: '继续观察' },
    }
    const wrapper = mountPanel({ analysisHistory: [item] })

    await wrapper.get('.analysis-history-item').trigger('click')

    expect(wrapper.emitted('select-history')).toEqual([[item]])
  })

  it('renders the empty deep-analysis state', () => {
    const wrapper = mountPanel({ deepAnalysis: null })

    expect(wrapper.text()).toContain('暂无深度分析，可点击上方按钮直接发起分析任务。')
  })
})
