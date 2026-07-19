import request from '../utils/request'

/**
 * 检查用户是否已配置LLM
 * @returns {Promise<Object>} 返回对象包含 hasConfig 和 isActive 两个布尔值
 */
export const checkUserLlmConfig = async () => {
  try {
    const profileBody = await request({
      url: '/user/profile',
      method: 'get',
      params: { t: Date.now() },
    })

    console.log('[检查LLM配置] 用户信息响应:', profileBody)

    if (profileBody && profileBody.user) {
      const user = profileBody.user
      const isActive = !!(user.active_llm_config_id)

      console.log('[检查LLM配置] active_llm_config_id:', user.active_llm_config_id)

      if (isActive) {
        console.log('[检查LLM配置] 已有激活的LLM配置')
        return { hasConfig: true, isActive: true, message: '已有激活的LLM配置' }
      }

      try {
        const configsBody = await request({
          url: '/user/llm-configs',
          method: 'get',
          params: { t: Date.now() },
        })

        console.log('[检查LLM配置] LLM配置列表:', configsBody)

        const configs = Array.isArray(configsBody) ? configsBody : []

        if (configs.length > 0) {
          console.log('[检查LLM配置] 有' + configs.length + '个配置但未激活')
          return {
            hasConfig: true,
            isActive: false,
            message: '您已配置LLM，但还未激活任何配置',
            configs,
          }
        }

        console.log('[检查LLM配置] 完全没有LLM配置')
        return { hasConfig: false, isActive: false, message: '请先配置LLM提供商' }
      } catch (configErr) {
        console.error('[检查LLM配置] 获取LLM配置列表失败:', configErr)
        return { hasConfig: true, isActive, message: '无法验证LLM配置状态' }
      }
    }
    console.log('[检查LLM配置] 用户信息含有效数据')
    return { hasConfig: false, isActive: false, message: '无法获取用户信息' }
  } catch (err) {
    console.error('[检查LLM配置] 错误:', err)
    return { hasConfig: true, isActive: false, message: '无法验证LLM配置状态' }
  }
}

/**
 * 获取用户配置信息
 * @returns {Promise<Object|null>} 用户配置信息
 */
export const getUserProfile = async () => {
  try {
    const body = await request({
      url: '/user/profile',
      method: 'get',
    })
    if (body && body.user) {
      return body.user
    }
    return null
  } catch (err) {
    console.error('获取用户配置失败:', err)
    return null
  }
}

/**
 * 更新用户LLM配置
 * @param {Object} config - LLM配置对象
 * @returns {Promise<Object>} 更新结果（HTTP body）
 */
export const updateLlmConfig = async (config) => {
  try {
    return await request({
      url: '/user/llm-config',
      method: 'put',
      data: config,
    })
  } catch (err) {
    console.error('更新LLM配置失败:', err)
    throw err
  }
}

/**
 * 测试LLM配置
 * @param {Object} testConfig - 测试配置
 * @returns {Promise<Object>} 测试结果（HTTP body）
 */
export const testLlmConfig = async (testConfig) => {
  try {
    return await request({
      url: '/user/llm/test',
      method: 'post',
      data: testConfig,
    })
  } catch (err) {
    console.error('测试LLM配置失败:', err)
    throw err
  }
}
