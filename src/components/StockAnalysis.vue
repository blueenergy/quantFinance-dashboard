<template>
  <div class="stock-analysis">
    <div class="analysis-header">
      <h3>智能股票分析</h3>
      <div class="provider-selector">
        <label>选择AI服务商:</label>
        <select v-model="selectedProvider" @change="onProviderChange">
          <option v-for="provider in safeAvailableProviders" :key="provider" :value="provider">
            {{ providerNames[provider] || provider }}
          </option>
        </select>
        <!-- 刷新按钮 -->
        <button @click="fetchAvailableProviders" class="refresh-btn" title="刷新服务商列表">
          🔄
        </button>
        <!-- 调试信息 -->
        <div style="font-size: 12px; margin-top: 5px;">
          <div>可用服务商数量: {{ safeAvailableProviders.length }}</div>
          <div>当前选择: {{ selectedProvider }}</div>
        </div>
      </div>
    </div>

    <div class="analysis-input">
      <div class="stock-input">
        <input 
          v-model="stockSymbol" 
          type="text" 
          placeholder="输入股票代码 (如: 000001)" 
          @keyup.enter="analyzeStock"
        />
        <button @click="analyzeStock" :disabled="loading || !stockSymbol">
          {{ loading ? '分析中...' : '分析' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>正在分析股票数据，请稍候...</p>
    </div>

    <div v-if="error" class="error">
      <h4>分析失败</h4>
      <p>{{ error }}</p>
      <button @click="clearError">清除错误</button>
    </div>

    <div v-if="analysisResult && !loading && analysisResult.stock_code" class="analysis-result">
      <div class="result-header">
        <h4>{{ analysisResult.stock_code }} 分析结果</h4>
        <div class="analysis-meta">
          <span v-if="analysisResult.provider" class="provider-badge">{{ providerNames[analysisResult.provider] || analysisResult.provider }}</span>
          <span v-if="analysisResult.model" class="model-badge">{{ analysisResult.model }}</span>
        </div>
      </div>

      <div v-if="analysisResult.success" class="analysis-content">
        <div class="analysis-grid">
          <div class="analysis-card">
            <h5>技术面分析</h5>
            <p>{{ analysis.technical_analysis || '暂无分析数据' }}</p>
          </div>

          <div class="analysis-card">
            <h5>短期走势</h5>
            <p>{{ analysis.short_term_forecast || '暂无预测数据' }}</p>
          </div>

          <div class="analysis-card">
            <h5>投资建议</h5>
            <div class="investment-advice">
              <span :class="['advice-badge', analysis.investment_advice]">
                {{ adviceLabels[analysis.investment_advice] || analysis.investment_advice }}
              </span>
              <p>风险等级: <span :class="['risk-badge', analysis.risk_level]">{{ riskLabels[analysis.risk_level] || analysis.risk_level }}</span></p>
            </div>
          </div>

          <div class="analysis-card">
            <h5>关键价位</h5>
            <div class="price-levels">
              <p>支撑位: <strong>{{ analysis.support_level || '暂无' }}</strong></p>
              <p>阻力位: <strong>{{ analysis.resistance_level || '暂无' }}</strong></p>
              <p>置信度: <strong>{{ analysis.confidence_score }}%</strong></p>
            </div>
          </div>
        </div>

        <div v-if="analysis.key_points && Array.isArray(analysis.key_points) && analysis.key_points.length > 0" class="key-points">
          <h5>关键要点</h5>
          <ul>
            <li v-for="(point, index) in analysis.key_points" :key="`point-${index}`">{{ point }}</li>
          </ul>
        </div>
      </div>

      <div v-else-if="analysisResult && !analysisResult.success" class="analysis-error">
        <h5>分析失败</h5>
        <p>{{ analysisResult.error || '未知错误' }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, computed } from 'vue'
import { useAuth } from '../services/auth.js'

export default {
  name: 'StockAnalysis',
  setup() {
    const { authenticatedRequest } = useAuth()
    
    const stockSymbol = ref('')
    const loading = ref(false)
    const error = ref('')
    const analysisResult = ref(null)
    const selectedProvider = ref('openai')
    const availableProviders = ref(['openai']) // 设置默认值

    const providerNames = {
      'openai': 'OpenAI',
      'deepseek': 'DeepSeek',
      'custom': '自定义API'
    }

    const adviceLabels = {
      'buy': '买入',
      'hold': '持有',
      'sell': '卖出'
    }

    const riskLabels = {
      'low': '低风险',
      'medium': '中风险',
      'high': '高风险'
    }

    const analysis = reactive({
      technical_analysis: '',
      short_term_forecast: '',
      risk_level: 'medium',
      investment_advice: 'hold',
      support_level: 0,
      resistance_level: 0,
      confidence_score: 0,
      key_points: []
    })

    // 安全的服务商列表计算属性
    const safeAvailableProviders = computed(() => {
      return Array.isArray(availableProviders.value) && availableProviders.value.length > 0 
        ? availableProviders.value 
        : ['openai']
    })

    const fetchAvailableProviders = async () => {
      try {
        console.log('正在获取LLM服务商列表...')
        const response = await fetch('/api/llm-providers')
        console.log('响应状态:', response.status)
        
        if (!response.ok) {
          throw new Error(`HTTP错误! 状态: ${response.status}`)
        }
        
        const contentType = response.headers.get('content-type')
        let data = null
        
        if (contentType && contentType.includes('application/json')) {
          const text = await response.text()
          if (text.trim()) {
            try {
              data = JSON.parse(text)
              console.log('响应数据:', data)
            } catch (e) {
              console.error('JSON解析错误:', e)
              throw new Error('服务器响应格式错误')
            }
          } else {
            throw new Error('服务器返回空响应')
          }
        } else {
          throw new Error('服务器返回非JSON格式响应')
        }
        
        // 确保providers是数组
        availableProviders.value = Array.isArray(data.providers) ? data.providers : []
        console.log('可用服务商:', availableProviders.value)
        
        if (data.default && availableProviders.value.includes(data.default)) {
          selectedProvider.value = data.default
          console.log('默认服务商:', data.default)
        }
      } catch (err) {
        console.error('获取服务商列表失败:', err)
        // 设置默认的服务商列表
        availableProviders.value = ['openai']
        selectedProvider.value = 'openai'
      }
    }

    const analyzeStock = async () => {
      if (!stockSymbol.value.trim()) {
        error.value = '请输入股票代码'
        return
      }

      loading.value = true
      error.value = ''
      analysisResult.value = null

      try {
        const response = await authenticatedRequest('/api/analyze-stock', {
          method: 'POST',
          body: JSON.stringify({
            symbol: stockSymbol.value.trim(),
            provider: selectedProvider.value,
            model: null // 使用默认模型
          })
        })

        let result = null
        const contentType = response.headers.get('content-type')
        
        if (contentType && contentType.includes('application/json')) {
          const text = await response.text()
          if (text.trim()) {
            try {
              result = JSON.parse(text)
            } catch (e) {
              console.error('JSON解析错误:', e)
              throw new Error('服务器响应格式错误')
            }
          }
        }

        if (!response.ok) {
          const errorMessage = result?.detail || `分析请求失败 (${response.status})`
          throw new Error(errorMessage)
        }
        
        // 确保结果对象的完整性
        if (result && typeof result === 'object') {
          analysisResult.value = {
            success: result.success || false,
            stock_code: result.stock_code || stockSymbol.value,
            provider: result.provider || selectedProvider.value,
            model: result.model || 'unknown',
            analysis: result.analysis || {},
            error: result.error || null
          }

          if (result.success && result.analysis && typeof result.analysis === 'object') {
            // 安全地更新分析数据
            Object.assign(analysis, {
              technical_analysis: result.analysis.technical_analysis || '',
              short_term_forecast: result.analysis.short_term_forecast || '',
              risk_level: result.analysis.risk_level || 'medium',
              investment_advice: result.analysis.investment_advice || 'hold',
              support_level: result.analysis.support_level || 0,
              resistance_level: result.analysis.resistance_level || 0,
              confidence_score: result.analysis.confidence_score || 0,
              key_points: Array.isArray(result.analysis.key_points) ? result.analysis.key_points : []
            })
          }
        } else {
          throw new Error('服务器返回了无效的响应格式')
        }

      } catch (err) {
        error.value = err.message || '分析失败，请重试'
        console.error('分析错误:', err)
      } finally {
        loading.value = false
      }
    }

    const onProviderChange = () => {
      // 清除之前的结果，但保持安全的状态
      if (analysisResult.value) {
        analysisResult.value = null
      }
      if (error.value) {
        error.value = ''
      }
    }

    const clearError = () => {
      error.value = ''
    }

    onMounted(() => {
      fetchAvailableProviders()
    })

    return {
      stockSymbol,
      loading,
      error,
      analysisResult,
      selectedProvider,
      availableProviders,
      safeAvailableProviders,
      providerNames,
      adviceLabels,
      riskLabels,
      analysis,
      analyzeStock,
      onProviderChange,
      clearError,
      fetchAvailableProviders
    }
  }
}
</script>

<style scoped>
.stock-analysis {
  background: #fff;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  margin: 20px 0;
}

.analysis-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #e9ecef;
}

.analysis-header h3 {
  margin: 0 0 16px 0;
  color: #2c3e50;
  font-size: 24px;
  font-weight: 600;
}

.provider-selector {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.provider-selector label {
  font-weight: 500;
  color: #495057;
}

.provider-selector select {
  padding: 8px 12px;
  border: 2px solid #dee2e6;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  min-width: 150px;
}

.provider-selector select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.refresh-btn {
  padding: 8px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

.refresh-btn:hover {
  background: #5a6268;
}

.analysis-input {
  margin-bottom: 24px;
}

.stock-input {
  display: flex;
  gap: 12px;
  max-width: 400px;
}

.stock-input input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.3s;
}

.stock-input input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.stock-input button {
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.3s;
  min-width: 80px;
}

.stock-input button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.stock-input button:hover:not(:disabled) {
  opacity: 0.9;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error {
  background: #f8d7da;
  color: #721c24;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  border: 1px solid #f5c6cb;
}

.error h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
}

.error button {
  margin-top: 8px;
  padding: 6px 12px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.analysis-result {
  border: 1px solid #dee2e6;
  border-radius: 12px;
  overflow: hidden;
}

.result-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-header h4 {
  margin: 0;
  font-size: 20px;
}

.analysis-meta {
  display: flex;
  gap: 8px;
}

.provider-badge, .model-badge {
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.analysis-content {
  padding: 24px;
}

.analysis-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.analysis-card {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #667eea;
}

.analysis-card h5 {
  margin: 0 0 12px 0;
  color: #2c3e50;
  font-size: 16px;
  font-weight: 600;
}

.analysis-card p {
  margin: 0;
  line-height: 1.6;
  color: #495057;
}

.investment-advice {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.advice-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  max-width: fit-content;
}

.advice-badge.buy {
  background: #d4edda;
  color: #155724;
}

.advice-badge.hold {
  background: #fff3cd;
  color: #856404;
}

.advice-badge.sell {
  background: #f8d7da;
  color: #721c24;
}

.risk-badge {
  font-weight: 600;
}

.risk-badge.low {
  color: #28a745;
}

.risk-badge.medium {
  color: #ffc107;
}

.risk-badge.high {
  color: #dc3545;
}

.price-levels p {
  margin: 8px 0;
  display: flex;
  justify-content: space-between;
}

.key-points {
  background: #e9ecef;
  padding: 20px;
  border-radius: 8px;
}

.key-points h5 {
  margin: 0 0 16px 0;
  color: #2c3e50;
  font-size: 16px;
  font-weight: 600;
}

.key-points ul {
  margin: 0;
  padding-left: 20px;
}

.key-points li {
  margin-bottom: 8px;
  line-height: 1.6;
  color: #495057;
}

.analysis-error {
  padding: 24px;
  text-align: center;
  color: #721c24;
}

.analysis-error h5 {
  margin: 0 0 12px 0;
  font-size: 18px;
}
</style>
