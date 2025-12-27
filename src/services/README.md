# 用户服务模块

## 概述

用户服务模块提供与用户相关的通用功能，包括LLM配置检查、用户信息获取等功能。

## 导出函数

### `checkUserLlmConfig()`
检查用户是否已配置LLM提供商。

**返回值**: `Promise<boolean>` - 如果用户已配置LLM提供商则返回true，否则返回false

**示例**:
```javascript
import { checkUserLlmConfig } from './userService.js'

const hasConfig = await checkUserLlmConfig()
if (hasConfig) {
  // 用户已配置LLM，可以使用AI分析功能
  analyzeStock()
} else {
  // 提示用户配置LLM
  alert('请先配置LLM提供商')
}
```

### `getUserProfile()`
获取用户配置信息。

**返回值**: `Promise<Object|null>` - 用户配置信息对象或null（如果获取失败）

**示例**:
```javascript
import { getUserProfile } from './userService.js'

const userProfile = await getUserProfile()
if (userProfile) {
  console.log('LLM提供商:', userProfile.llm_provider)
}
```

### `updateLlmConfig(config)`
更新用户LLM配置。

**参数**:
- `config` (Object): 配置对象
  - `llm_provider` (string): LLM提供商
  - `llm_api_key` (string): API密钥
  - `llm_base_url` (string): API基础URL
  - `llm_model` (string): 模型名称

**返回值**: `Promise<Object>` - 更新结果

**示例**:
```javascript
import { updateLlmConfig } from './userService.js'

try {
  const result = await updateLlmConfig({
    llm_provider: 'openai',
    llm_api_key: 'your-api-key',
    llm_base_url: 'https://api.openai.com/v1',
    llm_model: 'gpt-3.5-turbo'
  })
  console.log('配置更新成功:', result.message)
} catch (error) {
  console.error('配置更新失败:', error)
}
```

### `testLlmConfig(testConfig)`
测试LLM配置。

**参数**:
- `testConfig` (Object): 测试配置对象
  - `provider` (string): 提供商
  - `api_key` (string): API密钥
  - `base_url` (string): API基础URL
  - `model` (string): 模型名称

**返回值**: `Promise<Object>` - 测试结果

**示例**:
```javascript
import { testLlmConfig } from './userService.js'

const testResult = await testLlmConfig({
  provider: 'openai',
  api_key: 'your-api-key',
  base_url: 'https://api.openai.com/v1',
  model: 'gpt-3.5-turbo'
})
if (testResult.success) {
  console.log('配置测试成功')
} else {
  console.log('配置测试失败:', testResult.message)
}
```

## 使用场景

此模块主要用于解决代码重复问题，将用户相关的功能集中管理。在以下组件中使用：

- `WatchListData.vue` - 股票列表页面的AI分析功能检查
- `StockAnalysis.vue` - 股票分析页面的AI分析功能检查
- `MarketAnalysisBulletin.vue` - 市场分析公告栏的AI分析功能检查

通过使用此共享服务，避免了在多个组件中重复实现相同的LLM配置检查逻辑。