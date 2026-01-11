import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import axios from 'axios'
import UserProfile from '../src/components/UserProfile.vue'

const UpgradeRequestStub = defineComponent({
  name: 'UpgradeRequest',
  props: {
    currentUser: { type: Object, default: null }
  },
  template: '<div class="upgrade-request-stub" />'
})

describe('UserProfile - service level', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('loads service_level from /api/user/profile and passes it to UpgradeRequest', async () => {
    vi.spyOn(axios, 'get').mockImplementation(async (url) => {
      if (url === '/api/user/profile') {
        return {
          data: {
            success: true,
            user: {
              id: 'u1',
              username: 'test',
              email: 't@example.com',
              full_name: 'T',
              email_verified: true,
              is_admin: false,
              service_level: 'vip',
              active_llm_config_id: null
            }
          }
        }
      }
      if (url === '/api/user/security-settings') {
        return { data: { success: true, two_factor_enabled: false } }
      }
      if (url === '/api/user/llm-configs') {
        return { data: [] }
      }
      // default safe response
      return { data: { success: true } }
    })

    const wrapper = mount(UserProfile, {
      global: {
        stubs: {
          UpgradeRequest: UpgradeRequestStub
        }
      }
    })

    await flushPromises()

    // Switch to permissions tab which ensures loadProfile() runs again.
    wrapper.vm.switchTab('permissions')
    await flushPromises()

    expect(wrapper.vm.profile.service_level).toBe('vip')

    const upgrade = wrapper.findComponent({ name: 'UpgradeRequest' })
    expect(upgrade.exists()).toBe(true)
    expect(upgrade.props('currentUser')?.service_level).toBe('vip')

    wrapper.unmount()
  })
})
