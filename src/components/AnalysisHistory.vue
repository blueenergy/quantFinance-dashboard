<template>
  <div class="analysis-history">
    <div class="history-header">
      <h3>分析历史记录</h3>
      <button @click="loadHistory" :disabled="loading" class="refresh-btn">
        {{ loading ? '加载中...' : '刷新' }}
      </button>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>正在加载历史记录...</p>
    </div>

    <div v-if="error" class="error">
      <p>{{ error }}</p>
      <button @click="clearError">清除错误</button>
    </div>

    <div v-if="!loading && historyList.length === 0" class="empty">
      <p>暂无分析历史记录</p>
      <p>去进行一次股票分析吧！</p>
    </div>

    <div v-if="historyList.length > 0" class="history-list">
      <div 
        v-for="item in historyList" 
        :key="item.id"
        class="history-item"
        @click="viewDetails(item)"
      >
        <div class="item-header">
          <div class="stock-info">
            <span class="stock-code">{{ item.stock_code }}</span>
            <span class="provider">{{ getProviderName(item.provider) }}</span>
          </div>
          <div class="analysis-time">
            {{ formatTime(item.created_at) }}
          </div>
        </div>
        
        <div class="item-summary">
          <div class="advice-info">
            <span class="advice-label">投资建议:</span>
            <span :class="['advice-value', item.analysis?.investment_advice]">
              {{ getAdviceLabel(item.analysis?.investment_advice) }}
            </span>
          </div>
          <div class="risk-info">
            <span class="risk-label">风险等级:</span>
            <span :class="['risk-value', item.analysis?.risk_level]">
              {{ getRiskLabel(item.analysis?.risk_level) }}
            </span>
          </div>
        </div>
        
        <div v-if="item.analysis?.technical_analysis" class="item-preview">
          {{ item.analysis.technical_analysis.substring(0, 100) }}...
        </div>
      </div>
    </div>

    <!-- 详情对话框 -->
    <div v-if="selectedItem" class="detail-modal" @click="closeDetails">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h4>{{ selectedItem.stock_code }} 分析详情</h4>
          <button @click="closeDetails" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="detail-item">
              <strong>技术分析:</strong>
              <p>{{ selectedItem.analysis?.technical_analysis || '暂无' }}</p>
            </div>
            <div class="detail-item">
              <strong>长期预测:</strong>
              <p>{{ selectedItem.analysis?.long_term_forecast || '暂无' }}</p>
            </div>
            <div class="detail-item">
              <strong>中期预测:</strong>
              <p>{{ selectedItem.analysis?.mid_term_forecast || '暂无' }}</p>
            </div>
            <div class="detail-item">
              <strong>短期预测:</strong>
              <p>{{ selectedItem.analysis?.short_term_forecast || '暂无' }}</p>
            </div>
            <div class="detail-item">
              <strong>关键价位:</strong>
              <p>支撑位: {{ selectedItem.analysis?.support_level || '暂无' }}</p>
              <p>阻力位: {{ selectedItem.analysis?.resistance_level || '暂无' }}</p>
            </div>
            <div class="detail-item">
              <strong>置信度:</strong>
              <p>{{ selectedItem.analysis?.confidence_score || 0 }}%</p>
            </div>
          </div>
          
          <div v-if="selectedItem.analysis?.key_points?.length" class="key-points">
            <strong>关键要点:</strong>
            <ul>
              <li v-for="(point, index) in selectedItem.analysis.key_points" :key="index">
                {{ point }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useAuth } from '../services/auth.js'

export default {
  name: 'AnalysisHistory',
  setup() {
    const { authenticatedRequest } = useAuth()
    
    const loading = ref(false)
    const error = ref('')
    const historyList = ref([])
    const selectedItem = ref(null)

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

    const loadHistory = async () => {
      loading.value = true
      error.value = ''
      
      try {
        // 这里应该调用真实的历史记录API
        // 目前模拟一些数据
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // 模拟历史数据
        historyList.value = [
          {
            id: '1',
            stock_code: '000001',
            provider: 'openai',
            model: 'gpt-3.5-turbo',
            created_at: new Date(Date.now() - 86400000).toISOString(), // 1天前
            analysis: {
              technical_analysis: '从技术面看，该股票呈现上升趋势，MACD指标显示买入信号...',
              short_term_forecast: '短期内预计股价将继续上涨，建议关注成交量变化...',
              investment_advice: 'buy',
              risk_level: 'medium',
              support_level: 12.50,
              resistance_level: 15.80,
              confidence_score: 75,
              key_points: ['技术指标良好', '成交量放大', '行业前景看好']
            }
          },
          {
            id: '2',
            stock_code: '000002',
            provider: 'deepseek',
            model: 'deepseek-chat',
            created_at: new Date(Date.now() - 172800000).toISOString(), // 2天前
            analysis: {
              technical_analysis: '该股票近期横盘整理，缺乏明确方向...',
              short_term_forecast: '预计将继续震荡，等待方向选择...',
              investment_advice: 'hold',
              risk_level: 'low',
              support_level: 8.20,
              resistance_level: 9.50,
              confidence_score: 60,
              key_points: ['横盘整理', '成交量萎缩', '等待突破']
            }
          }
        ]
      } catch (err) {
        error.value = err.message || '加载历史记录失败'
        console.error('加载历史记录失败:', err)
      } finally {
        loading.value = false
      }
    }

    const getProviderName = (provider) => {
      return providerNames[provider] || provider
    }

    const getAdviceLabel = (advice) => {
      return adviceLabels[advice] || advice
    }

    const getRiskLabel = (risk) => {
      return riskLabels[risk] || risk
    }

    const formatTime = (timeStr) => {
      if (!timeStr) return ''
      const date = new Date(timeStr)
      return date.toLocaleString('zh-CN')
    }

    const viewDetails = (item) => {
      selectedItem.value = item
    }

    const closeDetails = () => {
      selectedItem.value = null
    }

    const clearError = () => {
      error.value = ''
    }

    onMounted(() => {
      loadHistory()
    })

    return {
      loading,
      error,
      historyList,
      selectedItem,
      loadHistory,
      getProviderName,
      getAdviceLabel,
      getRiskLabel,
      formatTime,
      viewDetails,
      closeDetails,
      clearError
    }
  }
}
</script>

<style scoped>
.analysis-history {
  background: #fff;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  margin: 20px 0;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #e9ecef;
}

.history-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 24px;
  font-weight: 600;
}

.refresh-btn {
  padding: 8px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: opacity 0.3s;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #667eea;
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
  text-align: center;
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

.empty {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}

.empty p {
  margin: 8px 0;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.history-item {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s;
  background: #fff;
}

.history-item:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
  transform: translateY(-2px);
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.stock-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stock-code {
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
}

.provider {
  padding: 4px 8px;
  background: #e9ecef;
  border-radius: 4px;
  font-size: 12px;
  color: #495057;
}

.analysis-time {
  font-size: 14px;
  color: #6c757d;
}

.item-summary {
  display: flex;
  gap: 24px;
  margin-bottom: 12px;
}

.advice-info, .risk-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.advice-label, .risk-label {
  font-size: 14px;
  color: #495057;
}

.advice-value, .risk-value {
  font-size: 14px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}

.advice-value.buy {
  background: #d4edda;
  color: #155724;
}

.advice-value.hold {
  background: #fff3cd;
  color: #856404;
}

.advice-value.sell {
  background: #f8d7da;
  color: #721c24;
}

.risk-value.low {
  background: #d4edda;
  color: #155724;
}

.risk-value.medium {
  background: #fff3cd;
  color: #856404;
}

.risk-value.high {
  background: #f8d7da;
  color: #721c24;
}

.item-preview {
  font-size: 14px;
  color: #6c757d;
  line-height: 1.5;
}

/* 模态框样式 */
.detail-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 800px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #dee2e6;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px 12px 0 0;
}

.modal-header h4 {
  margin: 0;
  font-size: 20px;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.3s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.modal-body {
  padding: 24px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.detail-item {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  border-left: 4px solid #667eea;
}

.detail-item strong {
  display: block;
  margin-bottom: 8px;
  color: #2c3e50;
  font-size: 16px;
}

.detail-item p {
  margin: 4px 0;
  line-height: 1.6;
  color: #495057;
}

.key-points {
  background: #e9ecef;
  padding: 20px;
  border-radius: 8px;
}

.key-points strong {
  display: block;
  margin-bottom: 12px;
  color: #2c3e50;
  font-size: 16px;
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
</style>
