import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PlanWorkerStatusPanel from '../PlanWorkerStatusPanel.vue'

describe('PlanWorkerStatusPanel', () => {
  it('renders worker state and emits refresh', async () => {
    const wrapper = mount(PlanWorkerStatusPanel, {
      props: {
        workers: [{
          worker_id: 'worker-1',
          status: 'idle',
          last_seen_at: '2026-07-20T00:00:00Z',
        }],
      },
    })

    expect(wrapper.text()).toContain('worker-1')
    expect(wrapper.text()).toContain('idle')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })
})
