import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ModelCatalogDetail from '../ModelCatalogDetail.vue'

const model = {
  model_id: 'research-csi1000-clean-raw5',
  display_name: 'clean-csi1000-raw5-live-20261108',
  family_id: 'csi1000-clean-raw5',
  index_code: 'csi1000',
  state: 'live',
  accepted: true,
  accepted_reasons: ['live', 'shadow'],
  operational_gate: { passed: false, reason: 'insufficient_universes' },
  latest_validation: { protocol: 'portfolio_oos', verdict: 'weak' },
  health: { last_prediction_date: '20261116', stale_days: 0 },
  state_history: [
    { from: null, to: 'research', at: '2016-04-13 00:00:00', reason: 'model entity inferred' },
    { from: 'research', to: 'shadow', at: '2026-11-08 14:25:49', reason: 'enabled shadow profile' },
    { from: 'shadow', to: 'live', at: '2026-11-09 00:00:00', reason: 'active strategy activation' },
  ],
  validation_runs: [
    {
      validation_id: 'v1',
      protocol: 'portfolio_oos',
      scope: 'primary',
      verdict: 'weak',
      created_at: '2026-11-16 14:29:29',
      window: { start: '20250101', end: '20261113' },
      metrics: {
        periods: 21,
        cumulative_return: 0.2514,
        annualized_return: 0.1479,
        sharpe: 0.9589,
        max_drawdown: -0.129,
        excess_t: 0.2965,
        mde80_excess: 0.0327,
      },
      caveats: ['21 same-grid periods; small sample'],
    },
  ],
  recipe: {
    model_kind: 'lightgbm',
    feature_names: ['momentum_20d', 'momentum_60d', 'volatility_20d', 'turnover_20d', 'log_market_cap'],
    train_days: 500,
    test_days: 20,
    purge_days: 60,
  },
  artifacts: [
    {
      result_id: 'r1',
      job_id: 'j1',
      role: 'live_artifact',
      model_kind: 'lightgbm',
      training_end: '20261106',
      artifact_uri: '/data/quant_ml/parquet/artifacts/r1.joblib',
    },
  ],
  training_jobs: [
    { job_id: 'j1', name: 'clean-csi1000-raw5-live-20261108', role: 'live_artifact', link_quality: 'exact', status: 'completed' },
  ],
  prediction_sets: [
    {
      kind: 'research',
      source: 'factor_incremental_experiment',
      window: 'expanding',
      first_trade_date: '20160413',
      last_trade_date: '20260923',
      date_count: 128,
      prediction_count: 118565,
    },
  ],
  shadow_profiles: [{ profile_id: 'csi1000-live-raw5', enabled: true }],
  activations: [{ activation_id: 'a1', status: 'active', execution_venue: 'live', admin_override: true, parity_status: 'unavailable' }],
}

function mountDetail(overrides = {}) {
  return mount(ModelCatalogDetail, {
    props: { model, loading: false, error: '', ...overrides },
  })
}

describe('ModelCatalogDetail', () => {
  it('renders the model state, gate conflict and validation evidence', () => {
    const wrapper = mountDetail()
    const text = wrapper.text()
    expect(text).toContain('research-csi1000-clean-raw5')
    expect(text).toContain('实盘')
    expect(text).toContain('training_gate=fail')
    expect(text).toContain('portfolio_oos')
    expect(text).toContain('21')
    expect(text).toContain('25.14%')
    expect(text).toContain('21 same-grid periods; small sample')
    expect(text).toContain('state 与 training gate 不一致')
    expect(text).toContain('live_artifact')
    expect(text).toContain('factor_incremental_experiment')
  })

  it('renders the empty detail state', () => {
    const wrapper = mountDetail({ model: null })
    expect(wrapper.text()).toContain('选择左侧模型查看详情')
  })

  it('emits a transition payload with reason and evidence', async () => {
    const researchModel = {
      ...model,
      state: 'research',
      accepted: false,
      accepted_reasons: [],
      operational_gate: null,
      latest_validation: null,
      state_flags: {},
      validation_runs: [],
      artifacts: [],
      training_jobs: [],
      prediction_sets: [],
      shadow_profiles: [],
      activations: [],
      state_history: [],
    }
    const wrapper = mountDetail({ model: researchModel })
    await wrapper.find('.transition-field input[type="text"]').setValue('OOS validation recorded')
    await wrapper.find('.transition-field textarea').setValue('{"result_id":"65fef1dc"}')
    const validateButton = wrapper
      .findAll('.transition-actions button')
      .find((button) => button.text().includes('标记已验收'))
    await validateButton.trigger('click')
    expect(wrapper.emitted('transition')).toEqual([
      [
        {
          target_state: 'validated',
          reason: 'OOS validation recorded',
          evidence: { result_id: '65fef1dc' },
          admin_override: false,
        },
      ],
    ])
  })

  it('includes retirement cleanup options in the transition payload', async () => {
    const wrapper = mountDetail()
    await wrapper.find('.transition-field input[type="text"]').setValue('retire live model')
    const retireButton = wrapper
      .findAll('.transition-actions button')
      .find((button) => button.text().includes('退役'))
    await retireButton.trigger('click')
    expect(wrapper.emitted('transition')).toEqual([
      [
        {
          target_state: 'retired',
          reason: 'retire live model',
          evidence: {},
          admin_override: false,
          disable_shadow_profiles: true,
          cancel_activations: false,
        },
      ],
    ])
  })

  it('renders a loading state and an error state', () => {
    expect(mountDetail({ model: null, loading: true }).text()).toContain('加载模型详情')
    expect(mountDetail({ model: null, error: 'boom' }).text()).toContain('boom')
  })
})
