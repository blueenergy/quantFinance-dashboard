<template>
  <div class="stock-analysis">
    <div class="analysis-header">
      <h3>智能股票分析</h3>
      <div class="provider-selector">
        <label>选择AI服务商:</label>
        <select v-model="selectedProvider" @change="onProviderChange">
          <option v-for="provider in availableProviders" :key="provider" :value="provider">
            {{ providerNames[provider] || provider }}
          </option>
        </select>
        <!-- 调试信息 -->
        <div v-if="availableProviders.length === 0" style="color: red; font-size: 12px;">
          调试: 服务商列表为空 ({{ availableProviders.length }})
        </div>
        <div v-else style="color: green; font-size: 12px;">
          调试: 找到 {{ availableProviders.length }} 个服务商
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

    <div v-if="analysisResult && !loading" class="analysis-result">
      <div class="result-header">
        <h4>{{ analysisResult.stock_code }} 分析结果</h4>
        <div class="analysis-meta">
          <span class="provider-badge">{{ providerNames[analysisResult.provider] || analysisResult.provider }}</span>
          <span class="model-badge">{{ analysisResult.model }}</span>
        </div>
      </div>

      <div v-if="analysisResult.success" class="analysis-content">
        <div class="analysis-grid">
          <div class="analysis-card">
            <h5>技术面分析</h5>
            <p>{{ analysis.technical_analysis }}</p>
          </div>

          <div class="analysis-card">
            <h5>短期走势</h5>
            <p>{{ analysis.short_term_forecast }}</p>
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

        <div v-if="analysis.key_points && analysis.key_points.length" class="key-points">
          <h5>关键要点</h5>
          <ul>
            <li v-for="(point, index) in analysis.key_points" :key="index">{{ point }}</li>
          </ul>
        </div>
      </div>

      <div v-else class="analysis-error">
        <h5>分析失败</h5>
        <p>{{ analysisResult.error }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'

export default {
  name: 'StockAnalysis',
  setup() {
    const stockSymbol = ref('')
    const loading = ref(false)
    const error = ref('')
    const analysisResult = ref(null)
    const selectedProvider = ref('openai')
    const availableProviders = ref([])

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

    const fetchAvailableProviders = async () => {
      try {
        console.log('正在获取LLM服务商列表...')
        const response = await fetch('/api/llm-providers')
        console.log('响应状态:', response.status)
        const data = await response.json()
        console.log('响应数据:', data)
        availableProviders.value = data.providers || []
        console.log('可用服务商:', availableProviders.value)
        if (data.default) {
          selectedProvider.value = data.default
          console.log('默认服务商:', data.default)
        }
      } catch (err) {
        console.error('获取服务商列表失败:', err)
        availableProviders.value = ['openai']
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
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            symbol: stockSymbol.value.trim(),
            provider: selectedProvider.value,
            model: null // 使用默认模型
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.detail || '分析请求失败')
        }

        const result = await response.json()
        analysisResult.value = result

        if (result.success && result.analysis) {
          Object.assign(analysis, result.analysis)
        }

      } catch (err) {
        error.value = err.message || '分析失败，请重试'
      } finally {
        loading.value = false
      }
    }

    const onProviderChange = () => {
      // 清除之前的结果
      analysisResult.value = null
      error.value = ''
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
      providerNames,
      adviceLabels,
      riskLabels,
      analysis,
      analyzeStock,
      onProviderChange,
      clearError
    }
  }
}
</script>

<style scoped>
.stock-analysis {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.analysis-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #e0e0e0;
}

.analysis-header h3 {
  margin: 0;
  color: #333;
}

.provider-selector {
  display: flex;
  align-items: center;
  gap: 10px;
}

.provider-selector label {
  font-weight: 500;
  color: #666;
}

.provider-selector select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
}

.analysis-input {
  margin-bottom: 30px;
}

.stock-input {
  display: flex;
  gap: 10px;
  max-width: 400px;
}

.stock-input input {
  flex: 1;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.stock-input button {
  padding: 12px 24px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.2s;
}

.stock-input button:hover:not(:disabled) {
  background-color: #0056b3;
}

.stock-input button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.loading {
  text-align: center;
  padding: 40px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error {
  background-color: #f8d7da;
  color: #721c24;
  padding: 20px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.error h4 {
  margin: 0 0 10px 0;
}

.error button {
  background-color: #dc3545;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
}

.analysis-result {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.result-header h4 {
  margin: 0;
  color: #333;
}

.analysis-meta {
  display: flex;
  gap: 10px;
}

.provider-badge, .model-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.provider-badge {
  background-color: #e3f2fd;
  color: #1976d2;
}

.model-badge {
  background-color: #f3e5f5;
  color: #7b1fa2;
}

.analysis-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.analysis-card {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.analysis-card h5 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 16px;
  font-weight: 600;
}

.investment-advice {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.advice-badge {
  padding: 6px 12px;
  border-radius: 16px;
  font-weight: 600;
  text-align: center;
  max-width: 80px;
}

.advice-badge.buy {
  background-color: #d4edda;
  color: #155724;
}

.advice-badge.hold {
  background-color: #fff3cd;
  color: #856404;
}

.advice-badge.sell {
  background-color: #f8d7da;
  color: #721c24;
}

.risk-badge {
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 12px;
}

.risk-badge.low {
  background-color: #d4edda;
  color: #155724;
}

.risk-badge.medium {
  background-color: #fff3cd;
  color: #856404;
}

.risk-badge.high {
  background-color: #f8d7da;
  color: #721c24;
}

.price-levels p {
  margin: 8px 0;
  font-size: 14px;
}

.key-points {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.key-points h5 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 16px;
  font-weight: 600;
}

.key-points ul {
  margin: 0;
  padding-left: 20px;
}

.key-points li {
  margin: 8px 0;
  line-height: 1.5;
}

.analysis-error {
  background-color: #f8d7da;
  color: #721c24;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}
</style>

<script setup>
import { ref, watch } from 'vue';
import axios from 'axios';

const props = defineProps({
  symbol: String,
  records: Array
});

const currentSymbol = ref(props.symbol);
const analyzing = ref(false);
const analysis = ref('');
const error = ref('');
const analysisTime = ref('');

watch(() => props.symbol, (newSymbol) => {
  currentSymbol.value = newSymbol;
  analysis.value = '';
  error.value = '';
});

function formatAnalysis(text) {
  // 简单的文本格式化，将换行转为HTML
  return text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

function generateStockSummary() {
  if (!props.records || props.records.length === 0) {
    return '暂无股票数据';
  }
  
  const latest = props.records[0];
  const oldest = props.records[props.records.length - 1];
  const priceChange = ((latest.close - oldest.close) / oldest.close * 100).toFixed(2);
  
  return `股票代码: ${currentSymbol.value}
最新收盘价: ${latest.close}元
最高价: ${Math.max(...props.records.map(r => r.high))}元
最低价: ${Math.min(...props.records.map(r => r.low))}元
期间涨跌幅: ${priceChange}%
数据期间: ${oldest.trade_date?.substring(0, 10)} 至 ${latest.trade_date?.substring(0, 10)}`;
}

async function analyzeStock() {
  if (!currentSymbol.value) return;
  
  analyzing.value = true;
  error.value = '';
  analysis.value = '';
  
  try {
    const stockSummary = generateStockSummary();
    
    const response = await axios.post('/api/analyze-stock', {
      symbol: currentSymbol.value,
      data: stockSummary,
      records: props.records?.slice(0, 50) // 只发送最近50条记录
    });
    
    analysis.value = response.data.analysis;
    analysisTime.value = new Date().toLocaleString();
    
  } catch (err) {
    console.error('分析失败:', err);
    error.value = err.response?.data?.error || '网络错误，请重试';
  } finally {
    analyzing.value = false;
  }
}
</script>

<style scoped>
.stock-analysis {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-top: 20px;
}

.analysis-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.analysis-header button {
  padding: 8px 16px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.analysis-header button:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.loading {
  text-align: center;
  padding: 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.analysis-result {
  background: white;
  padding: 15px;
  border-radius: 5px;
  border-left: 4px solid #007bff;
}

.analysis-content {
  line-height: 1.6;
  margin-bottom: 10px;
}

.analysis-meta {
  color: #666;
  font-size: 12px;
}

.error {
  background: #f8d7da;
  color: #721c24;
  padding: 10px;
  border-radius: 4px;
}

.no-stock {
  text-align: center;
  color: #666;
  padding: 20px;
}
</style>
