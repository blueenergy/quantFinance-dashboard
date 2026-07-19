import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'

const requestMock = vi.fn()

vi.mock('../src/utils/request', () => ({
  default: (...args) => requestMock(...args),
}))

import UserProfile from '../src/components/UserProfile.vue'

const UpgradeRequestStub = defineComponent({
  name: 'UpgradeRequest',
  props: {
    currentUser: { type: Object, default: null },
  },
  template: '<div class="upgrade-request-stub" />',
})

describe('UserProfile - service level', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    requestMock.mockReset()
  })

  it('loads service_level from /user/profile and passes it to UpgradeRequest', async () => {
    requestMock.mockImplementation(async (config) => {
      const url = config?.url || ''
      if (url === '/user/profile') {
        return {
          success: true,
          user: {
            id: 'u1',
            username: 'test',
            email: 't@example.com',
            full_name: 'T',
            email_verified: true,
            is_admin: false,
            service_level: 'vip',
            active_llm_config_id: null,
          },
        }
      }
      if (url === '/user/security-settings') {
        return { success: true, two_factor_enabled: false }
      }
      if (url === '/user/llm-configs') {
        return []
      }
      return { success: true }
    })

    const wrapper = mount(UserProfile, {
      global: {
        stubs: {
          UpgradeRequest: UpgradeRequestStub,
        },
      },
    })

    await flushPromises()

    wrapper.vm.switchTab('permissions')
    await flushPromises()

    expect(wrapper.vm.profile.service_level).toBe('vip')

    const upgrade = wrapper.findComponent({ name: 'UpgradeRequest' })
    expect(upgrade.exists()).toBe(true)
    expect(upgrade.props('currentUser')?.service_level).toBe('vip')

    wrapper.unmount()
  })
})
