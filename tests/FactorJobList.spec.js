import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FactorJobList from '../src/components/factor/FactorJobList.vue'
import { FACTOR_SET_OPTIONS, INDEX_OPTIONS } from '../src/utils/factorBacktestView'

function mountList(props = {}) {
  return mount(FactorJobList, {
    props: {
      indexOptions: INDEX_OPTIONS,
      factorSetOptions: FACTOR_SET_OPTIONS,
      nowMs: Date.parse('2026-01-02T00:10:00Z'),
      ...props,
    },
  })
}

const runningJob = {
  job_id: 'job-1',
  name: '中证1000 alpha8',
  status: 'running',
  factor_set: 'alpha8',
  index_code: 'csi1000',
  start_date: '20230101',
  end_date: '20231231',
  progress_stage: 'running_diagnostics',
  started_at: '2026-01-02T00:00:00',
  params: { factor_set: 'alpha8' },
}

describe('FactorJobList', () => {
  it('shows an empty state until jobs arrive', () => {
    expect(mountList({ jobs: [] }).text()).toContain('暂无因子回测任务')
  })

  it('renders the stage, the scope and the elapsed time of a running job', () => {
    const text = mountList({ jobs: [runningJob] }).text()
    expect(text).toContain('中证1000 alpha8')
    expect(text).toContain('running · alpha8 · csi1000')
    expect(text).toContain('阶段 5/6 · 分位/TopK 诊断')
    expect(text).toContain('alpha8 全集')
    expect(text).toContain('已运行 10 分')
  })

  it('shows the artifact summary instead of a stage once the job completes', () => {
    const text = mountList({
      jobs: [{
        ...runningJob,
        status: 'completed',
        progress_stage: 'cost_adjustment',
        artifact: { top_factor: 'alpha4', reported_factors: 8 },
      }],
    }).text()
    expect(text).toContain('最优 alpha4 · 诊断 8 个因子')
    expect(text).not.toContain('阶段')
  })

  it('shows why a job failed', () => {
    const text = mountList({
      jobs: [{ ...runningJob, status: 'failed', error_message: 'universe csi1000 has no prices' }],
    }).text()
    expect(text).toContain('universe csi1000 has no prices')
  })

  it('marks the open job as active', () => {
    const wrapper = mountList({ jobs: [runningJob, { ...runningJob, job_id: 'job-2' }], selectedJobId: 'job-2' })
    const rows = wrapper.findAll('.job-row')
    expect(rows[0].classes()).not.toContain('active')
    expect(rows[1].classes()).toContain('active')
  })

  it('emits the job id when a row is clicked', async () => {
    const wrapper = mountList({ jobs: [runningJob] })
    await wrapper.find('.job-row').trigger('click')
    expect(wrapper.emitted('select-job')).toEqual([['job-1']])
  })

  it('reloads as soon as a filter changes', async () => {
    const wrapper = mountList({ jobs: [runningJob] })
    const [statusSelect, factorSetSelect, indexSelect] = wrapper.findAll('select')

    await statusSelect.setValue('failed')
    await factorSetSelect.setValue('alpha158')
    await indexSelect.setValue('hs300')

    expect(wrapper.emitted('update:statusFilter')).toEqual([['failed']])
    expect(wrapper.emitted('update:factorSetFilter')).toEqual([['alpha158']])
    expect(wrapper.emitted('update:indexFilter')).toEqual([['hs300']])
    expect(wrapper.emitted('load')).toHaveLength(3)
  })
})
