import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ResearchJobList from '../src/components/portfolio/ResearchJobList.vue'

const universeOptions = [
  { value: 'csi1000', label: 'csi1000 - 中证1000' },
]

function mountList(overrides = {}) {
  return mount(ResearchJobList, {
    props: {
      jobs: [
        {
          job_id: 'job-1',
          name: 'csi1000 research',
          status: 'completed',
          universe_index: 'csi1000',
          start_date: '20230101',
          end_date: '20240601',
          params: { growth_cycle_weights: ['30:70'] },
          best_row: { index_excess_cumulative_return: 0.1234 },
        },
      ],
      loading: false,
      selectedJobId: 'job-1',
      universeOptions,
      statusFilter: '',
      universeFilter: '',
      growthCycleWeightFilter: '',
      nowMs: Date.parse('2024-01-01T00:00:00Z'),
      ...overrides,
    },
  })
}

describe('ResearchJobList', () => {
  it('renders selected job row as active and shows excess label', () => {
    const wrapper = mountList()
    const active = wrapper.find('.job-row.active')
    expect(active.exists()).toBe(true)
    expect(active.text()).toContain('csi1000 research')
    expect(active.text()).toContain('30:70')
    expect(active.text()).toContain('best 12.34% excess')
  })

  it('emits each filter update before requesting a load', async () => {
    const events = []
    const wrapper = mountList({
      'onUpdate:statusFilter': (value) => events.push(['status', value]),
      'onUpdate:universeFilter': (value) => events.push(['universe', value]),
      'onUpdate:growthCycleWeightFilter': (value) => events.push(['weight', value]),
      onLoad: () => events.push(['load']),
    })

    const statusSelect = wrapper.find('select[title="状态"]')
    await statusSelect.setValue('running')
    expect(events).toEqual([['status', 'running'], ['load']])

    events.length = 0
    const universeSelect = wrapper.find('select[title="universe"]')
    await universeSelect.setValue('csi1000')
    expect(events).toEqual([['universe', 'csi1000'], ['load']])

    events.length = 0
    const weightInput = wrapper.find('.weight-filter')
    weightInput.element.value = '30:70'
    await weightInput.trigger('change')
    expect(events).toEqual([['weight', '30:70'], ['load']])

    events.length = 0
    weightInput.element.value = '40:60'
    await weightInput.trigger('keyup', { key: 'Enter' })
    expect(events).toEqual([['weight', '40:60'], ['load']])
  })

  it('emits select-job when a row is clicked', async () => {
    const wrapper = mountList({ selectedJobId: '' })
    await wrapper.find('.job-row').trigger('click')
    expect(wrapper.emitted('select-job')?.[0]).toEqual(['job-1'])
  })

  it('hides the panel when mobile-hidden is set', () => {
    const wrapper = mountList({ mobileHidden: true })
    expect(wrapper.classes()).toContain('mobile-hidden')
  })
})
