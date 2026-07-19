import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const requestMock = vi.fn()

vi.mock('../src/utils/request', () => ({
  default: (...args) => requestMock(...args),
}))

import NotificationCenter from '../src/components/NotificationCenter.vue'

describe('NotificationCenter request contracts', () => {
  beforeEach(() => {
    requestMock.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads notifications and settings from request body envelope', async () => {
    requestMock.mockImplementation(async (config) => {
      if (config.url === '/notifications/settings') {
        return {
          success: true,
          data: { email_enabled: true, push_enabled: false },
        }
      }
      if (config.url === '/notifications') {
        return {
          success: true,
          data: {
            notifications: [
              { _id: 'n1', title: 'hello', is_read: false },
            ],
            unread_count: 1,
          },
        }
      }
      return { success: true }
    })

    const wrapper = mount(NotificationCenter)
    await flushPromises()

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'get', url: '/notifications/settings' }),
    )
    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'get',
        url: '/notifications',
        params: { unread_only: false, limit: 50 },
      }),
    )

    expect(wrapper.vm.notifications).toHaveLength(1)
    expect(wrapper.vm.notifications[0].title).toBe('hello')
    expect(wrapper.vm.unreadCount).toBe(1)
    expect(wrapper.vm.settings.email_enabled).toBe(true)
    expect(wrapper.vm.settings.push_enabled).toBe(false)

    wrapper.unmount()
  })

  it('does not treat AxiosResponse-style nesting as body', async () => {
    // If someone mistakenly left an extra .data layer, this shape would break UI.
    // Contract: request already returns body, so success is at top level.
    requestMock.mockImplementation(async (config) => {
      if (config.url === '/notifications/settings') {
        return { success: true, data: {} }
      }
      if (config.url === '/notifications') {
        return {
          success: true,
          data: { notifications: [], unread_count: 0 },
        }
      }
      return { success: true }
    })

    const wrapper = mount(NotificationCenter)
    await flushPromises()

    expect(wrapper.vm.notifications).toEqual([])
    expect(wrapper.vm.unreadCount).toBe(0)
    wrapper.unmount()
  })
})
