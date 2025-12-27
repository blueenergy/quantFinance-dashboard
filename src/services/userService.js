import axios from 'axios';

/**
 * 检查用户是否已配置LLM
 * @returns {Promise<Object>} 返回对象包含 hasConfig 和 isActive 两个布尔值
 */
export const checkUserLlmConfig = async () => {
  try {
    // 首先获取用户信息，检查是否有激活的配置
    const profileResponse = await axios.get('/api/user/profile', {
      params: { t: Date.now() }  // 添加时间戳以不使用缓存
    });
    
    console.log('[检查LLM配置] 用户信息响应:', profileResponse.data);
    
    if (profileResponse.data && profileResponse.data.user) {
      const user = profileResponse.data.user;
      const isActive = !!(user.active_llm_config_id);
      
      console.log('[检查LLM配置] active_llm_config_id:', user.active_llm_config_id);
      
      // 如果已激活配置，直接返回成功
      if (isActive) {
        console.log('[检查LLM配置] 已有激活的LLM配置');
        return { hasConfig: true, isActive: true, message: '已有激活的LLM配置' };
      }
      
      // 如果没有激活配置，检查是否至少有一个已保存的配置
      try {
        const configsResponse = await axios.get('/api/user/llm-configs', {
          params: { t: Date.now() }  // 添加时间戳以不使用缓存
        });
        
        console.log('[检查LLM配置] LLM配置列表:', configsResponse.data);
        
        const configs = Array.isArray(configsResponse.data) ? configsResponse.data : [];
        
        if (configs.length > 0) {
          // 有配置但未激活
          console.log('[检查LLM配置] 有' + configs.length + '个配置但未激活');
          return { 
            hasConfig: true, 
            isActive: false, 
            message: '您已配置LLM，但还未激活任何配置',
            configs: configs 
          };
        } else {
          // 完全没有配置
          console.log('[检查LLM配置] 完全没有LLM配置');
          return { hasConfig: false, isActive: false, message: '请先配置LLM提供商' };
        }
      } catch (configErr) {
        console.error('[检查LLM配置] 获取LLM配置列表失败:', configErr);
        // 如果获取配置列表失败，假设用户已配置（避免阻止功能）
        return { hasConfig: true, isActive: isActive, message: '无法验证LLM配置状态' };
      }
    }
    console.log('[检查LLM配置] 用户信息含有效数据');
    return { hasConfig: false, isActive: false, message: '无法获取用户信息' };
  } catch (err) {
    console.error('[检查LLM配置] 错误:', err);
    // 如果无法获取用户配置，假设用户已配置（避免阻止功能）
    return { hasConfig: true, isActive: false, message: '无法验证LLM配置状态' };
  }
};

/**
 * 获取用户配置信息
 * @returns {Promise<Object|null>} 用户配置信息
 */
export const getUserProfile = async () => {
  try {
    const response = await axios.get('/api/user/profile');
    if (response.data && response.data.user) {
      return response.data.user;
    }
    return null;
  } catch (err) {
    console.error('获取用户配置失败:', err);
    return null;
  }
};

/**
 * 更新用户LLM配置
 * @param {Object} config - LLM配置对象
 * @param {string} config.llm_provider - LLM提供商
 * @param {string} config.llm_api_key - API密钥
 * @param {string} config.llm_base_url - API基础URL
 * @param {string} config.llm_model - 模型名称
 * @returns {Promise<Object>} 更新结果
 */
export const updateLlmConfig = async (config) => {
  try {
    const response = await axios.put('/api/user/llm-config', config);
    return response.data;
  } catch (err) {
    console.error('更新LLM配置失败:', err);
    throw err;
  }
};

/**
 * 测试LLM配置
 * @param {Object} testConfig - 测试配置
 * @returns {Promise<Object>} 测试结果
 */
export const testLlmConfig = async (testConfig) => {
  try {
    const response = await axios.post('/api/user/llm/test', testConfig);
    return response.data;
  } catch (err) {
    console.error('测试LLM配置失败:', err);
    throw err;
  }
};