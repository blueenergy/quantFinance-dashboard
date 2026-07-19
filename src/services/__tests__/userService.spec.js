import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const requestMock = vi.fn()

vi.mock('../../utils/request', () => ({
  default: (...args) => requestMock(...args),
}))

import {
  checkUserLlmConfig,
  getUserProfile,
  updateLlmConfig,
  testLlmConfig,
} from '../userService.js'

describe('userService return contracts', () => {
  beforeEach(() => {
    requestMock.mockReset()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('getUserProfile returns user object (not envelope)', async () => {
    requestMock.mockResolvedValue({
      success: true,
      user: { id: 'u1', username: 'alice', service_level: 'vip' },
    })

    const user = await getUserProfile()

    expect(requestMock).toHaveBeenCalledWith({
      url: '/user/profile',
      method: 'get',
    })
    expect(user).toEqual({ id: 'u1', username: 'alice', service_level: 'vip' })
  })

  it('getUserProfile returns null when user missing', async () => {
    requestMock.mockResolvedValue({ success: true })
    await expect(getUserProfile()).resolves.toBeNull()
  })

  it('getUserProfile returns null on request error', async () => {
    requestMock.mockRejectedValue(new Error('network'))
    await expect(getUserProfile()).resolves.toBeNull()
  })

  it('checkUserLlmConfig detects active config', async () => {
    requestMock.mockResolvedValue({
      user: { active_llm_config_id: 'cfg-1' },
    })

    const result = await checkUserLlmConfig()

    expect(result).toEqual({
      hasConfig: true,
      isActive: true,
      message: '已有激活的LLM配置',
    })
  })

  it('checkUserLlmConfig detects saved but inactive configs', async () => {
    requestMock
      .mockResolvedValueOnce({ user: { active_llm_config_id: null } })
      .mockResolvedValueOnce([{ id: 'cfg-a' }, { id: 'cfg-b' }])

    const result = await checkUserLlmConfig()

    expect(result.hasConfig).toBe(true)
    expect(result.isActive).toBe(false)
    expect(result.configs).toHaveLength(2)
  })

  it('checkUserLlmConfig reports no config when list empty', async () => {
    requestMock
      .mockResolvedValueOnce({ user: { active_llm_config_id: null } })
      .mockResolvedValueOnce([])

    const result = await checkUserLlmConfig()

    expect(result).toEqual({
      hasConfig: false,
      isActive: false,
      message: '请先配置LLM提供商',
    })
  })

  it('updateLlmConfig returns HTTP body', async () => {
    requestMock.mockResolvedValue({ success: true, updated: true })

    const body = await updateLlmConfig({ llm_provider: 'openai' })

    expect(requestMock).toHaveBeenCalledWith({
      url: '/user/llm-config',
      method: 'put',
      data: { llm_provider: 'openai' },
    })
    expect(body).toEqual({ success: true, updated: true })
  })

  it('testLlmConfig returns HTTP body', async () => {
    requestMock.mockResolvedValue({ success: true, reply: 'pong' })

    const body = await testLlmConfig({ llm_provider: 'openai' })

    expect(requestMock).toHaveBeenCalledWith({
      url: '/user/llm/test',
      method: 'post',
      data: { llm_provider: 'openai' },
    })
    expect(body).toEqual({ success: true, reply: 'pong' })
  })
})
