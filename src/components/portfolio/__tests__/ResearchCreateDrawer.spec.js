import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ResearchCreateDrawer from '../ResearchCreateDrawer.vue'

const baseForm = {
  name: 'model research',
  universe_index: 'hs300',
  start_date: '2024-01-01',
  end_date: '2024-12-31',
  score_mode: 'model',
  model_id: 'research-rolling500-hs300',
  score_column: 'model_score',
  score_columns: ['model_score'],
  growth_cycle_weights: '30:70',
  score_specs: '',
  selection_mode: 'fixed_top_n',
  threshold_lookback_days: 10,
  max_positions: 20,
  top_n_values: '20',
  horizon: '20',
  active_caps: '0.3',
  regime_always_invest: true,
  regime_cash: false,
  regime_rules: ['k_slow_anchor'],
}

const model = {
  model_id: 'research-rolling500-hs300',
  index_code: 'hs300',
  first_trade_date: '20170424',
  last_trade_date: '20260909',
  date_count: 115,
  prediction_count: 34500,
  research: true,
  shadow: false,
}

function mountDrawer(overrides = {}, modelOverrides = {}) {
  return mount(ResearchCreateDrawer, {
    props: {
      open: true,
      form: { ...baseForm, ...overrides },
      universeOptions: [],
      industryOptions: [],
      modelOptions: [{ ...model, ...modelOverrides }],
      submitting: false,
      title: 'new research',
      subtitle: '',
      submitLabel: '提交',
    },
  })
}

function submitButton(wrapper) {
  return wrapper.findAll('button').at(-1)
}

describe('ResearchCreateDrawer model mode', () => {
  it('shows the model picker and coverage for a covered window', () => {
    const wrapper = mountDrawer()
    expect(wrapper.text()).toContain('模型评分')
    expect(wrapper.text()).toContain('research-rolling500-hs300')
    expect(wrapper.text()).toContain('115 个预测日')
    expect(submitButton(wrapper).element.disabled).toBe(false)
  })

  it('disables submit until a model is selected', () => {
    const wrapper = mountDrawer({ model_id: '' })
    expect(wrapper.text()).toContain('请选择模型')
    expect(submitButton(wrapper).element.disabled).toBe(true)
  })

  it('warns and disables submit when the model misses the window', () => {
    const wrapper = mountDrawer({}, { last_trade_date: '20191231' })
    expect(wrapper.text()).toContain('该模型覆盖区间与当前研究窗口无交集')
    expect(submitButton(wrapper).element.disabled).toBe(true)
  })
})
