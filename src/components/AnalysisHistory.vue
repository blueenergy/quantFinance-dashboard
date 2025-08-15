<template>
  <div class="analysis-history">
    <div class="controls">
      <input 
        v-model="searchSymbol" 
        placeholder="输入股票代码查询历史分析"
        class="symbol-input"
        @keyup.enter="fetchHistory"
      >
      <button @click="fetchHistory" class="search-btn">查询历史</button>
    </div>

    <div v-if="loading" class="loading">
      正在加载历史分析记录...
    </div>

    <div v-if="error" class="error">
      {{ error }}
    </div>

    <div v-if="history.length > 0" class="history-list">
      <h3>{{ searchSymbol }} 的历史分析记录</h3>
      
      <div class="comparison-controls">
        <div>
          <label>选择分析1：</label>
          <select v-model="selectedAnalysis1">
            <option value="">请选择...</option>
            <option v-for="item in history" :key="item._id" :value="item._id">
              {{ formatDate(item.timestamp) }} - {{ item.provider }}:{{ item.model }}
            </option>
          </select>
        </div>
        
        <div>
          <label>选择分析2：</label>
          <select v-model="selectedAnalysis2">
            <option value="">请选择...</option>
            <option v-for="item in history" :key="item._id" :value="item._id">
              {{ formatDate(item.timestamp) }} - {{ item.provider }}:{{ item.model }}
            </option>
          </select>
        </div>
        
        <button 
          @click="compareAnalyses" 
          :disabled="!selectedAnalysis1 || !selectedAnalysis2"
          class="compare-btn"
        >
          比较分析
        </button>
      </div>

      <div class="history-items">
        <div 
          v-for="item in history" 
          :key="item._id"
          class="history-item"
          :class="{ 'success': item.success, 'error': !item.success }"
        >
          <div class="item-header">
            <span class="timestamp">{{ formatDate(item.timestamp) }}</span>
            <span class="provider-model">{{ item.provider }}:{{ item.model }}</span>
            <span class="status" :class="item.success ? 'success' : 'error'">
              {{ item.success ? '成功' : '失败' }}
            </span>
          </div>
          
          <div v-if="item.success && item.analysis_result" class="analysis-content">
            <!-- 显示分析结果的关键信息 -->
            <div v-if="item.analysis_result.analysis" class="analysis-summary">
              <h4>分析摘要:</h4>
              <p>{{ truncateText(item.analysis_result.analysis, 200) }}</p>
            </div>
            
            <div v-if="item.analysis_result.recommendation" class="recommendation">
              <strong>投资建议: {{ item.analysis_result.recommendation }}</strong>
            </div>
            
            <div v-if="item.analysis_result.risk_level" class="risk-level">
              <span class="risk-badge" :class="getRiskClass(item.analysis_result.risk_level)">
                风险等级: {{ item.analysis_result.risk_level }}
              </span>
            </div>
          </div>
          
          <div v-if="!item.success" class="error-info">
            <p>分析失败: {{ item.error_message || '未知错误' }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 比较结果模态框 -->
    <div v-if="comparisonResult" class="comparison-modal" @click="closeComparison">
      <div class="comparison-content" @click.stop>
        <div class="modal-header">
          <h3>分析比较结果</h3>
          <button @click="closeComparison" class="close-btn">&times;</button>
        </div>
        
        <div class="comparison-body">
          <div class="comparison-side">
            <h4>分析1 ({{ formatDate(comparisonResult.analysis1.timestamp) }})</h4>
            <div class="analysis-details">
              <p><strong>提供商:</strong> {{ comparisonResult.analysis1.provider }}</p>
              <p><strong>模型:</strong> {{ comparisonResult.analysis1.model }}</p>
              <p><strong>建议:</strong> {{ comparisonResult.analysis1.analysis_result?.recommendation || 'N/A' }}</p>
              <p><strong>风险等级:</strong> {{ comparisonResult.analysis1.analysis_result?.risk_level || 'N/A' }}</p>
            </div>
          </div>
          
          <div class="comparison-side">
            <h4>分析2 ({{ formatDate(comparisonResult.analysis2.timestamp) }})</h4>
            <div class="analysis-details">
              <p><strong>提供商:</strong> {{ comparisonResult.analysis2.provider }}</p>
              <p><strong>模型:</strong> {{ comparisonResult.analysis2.model }}</p>
              <p><strong>建议:</strong> {{ comparisonResult.analysis2.analysis_result?.recommendation || 'N/A' }}</p>
              <p><strong>风险等级:</strong> {{ comparisonResult.analysis2.analysis_result?.risk_level || 'N/A' }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

const searchSymbol = ref('')
const history = ref([])
const loading = ref(false)
const error = ref('')
const selectedAnalysis1 = ref('')
const selectedAnalysis2 = ref('')
const comparisonResult = ref(null)

// 获取历史分析记录
const fetchHistory = async () => {
  if (!searchSymbol.value.trim()) {
    error.value = '请输入股票代码'
    return
  }

  loading.value = true
  error.value = ''
  
  try {
    const response = await fetch(`http://localhost:3001/api/analysis/history?symbol=${searchSymbol.value}&limit=20`)
    const data = await response.json()
    
    if (data.error) {
      error.value = data.error
      history.value = []
    } else {
      history.value = data.history || []
    }
  } catch (err) {
    error.value = `获取历史记录失败: ${err.message}`
    history.value = []
  } finally {
    loading.value = false
  }
}

// 比较两个分析结果
const compareAnalyses = async () => {
  if (!selectedAnalysis1.value || !selectedAnalysis2.value) {
    return
  }

  try {
    const response = await fetch(
      `http://localhost:3001/api/analysis/compare?symbol=${searchSymbol.value}&analysis_id1=${selectedAnalysis1.value}&analysis_id2=${selectedAnalysis2.value}`
    )
    const data = await response.json()
    
    if (data.error) {
      error.value = data.error
    } else {
      comparisonResult.value = data
    }
  } catch (err) {
    error.value = `比较分析失败: ${err.message}`
  }
}

// 关闭比较模态框
const closeComparison = () => {
  comparisonResult.value = null
}

// 格式化日期
const formatDate = (timestamp) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

// 截断文本
const truncateText = (text, maxLength) => {
  if (!text) return ''
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

// 获取风险等级CSS类
const getRiskClass = (riskLevel) => {
  if (!riskLevel) return 'risk-unknown'
  const level = riskLevel.toLowerCase()
  if (level.includes('低') || level.includes('low')) return 'risk-low'
  if (level.includes('中') || level.includes('medium')) return 'risk-medium'
  if (level.includes('高') || level.includes('high')) return 'risk-high'
  return 'risk-unknown'
}
</script>

<style scoped>
.analysis-history {
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  align-items: center;
}

.symbol-input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  min-width: 200px;
}

.search-btn, .compare-btn {
  padding: 8px 16px;
  background: #409EFF;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.search-btn:hover, .compare-btn:hover {
  background: #337ecc;
}

.compare-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.loading {
  text-align: center;
  padding: 20px;
  color: #666;
}

.error {
  color: #f56c6c;
  padding: 10px;
  background: #fef0f0;
  border: 1px solid #fbc4c4;
  border-radius: 4px;
  margin-bottom: 20px;
}

.comparison-controls {
  display: flex;
  gap: 20px;
  align-items: center;
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 4px;
}

.comparison-controls label {
  font-weight: bold;
  margin-right: 8px;
}

.comparison-controls select {
  padding: 5px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  min-width: 200px;
}

.history-items {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.history-item {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 15px;
  background: #fafafa;
}

.history-item.success {
  border-left: 4px solid #67c23a;
}

.history-item.error {
  border-left: 4px solid #f56c6c;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-weight: bold;
}

.timestamp {
  color: #333;
}

.provider-model {
  color: #666;
  font-size: 14px;
}

.status.success {
  color: #67c23a;
}

.status.error {
  color: #f56c6c;
}

.analysis-content {
  border-top: 1px solid #e4e7ed;
  padding-top: 10px;
}

.analysis-summary h4 {
  margin: 0 0 8px 0;
  color: #333;
}

.recommendation {
  margin: 10px 0;
  padding: 8px;
  background: #e8f4fd;
  border-radius: 4px;
}

.risk-level {
  margin-top: 10px;
}

.risk-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.risk-low {
  background: #f0f9ff;
  color: #67c23a;
}

.risk-medium {
  background: #fdf6ec;
  color: #e6a23c;
}

.risk-high {
  background: #fef0f0;
  color: #f56c6c;
}

.risk-unknown {
  background: #f4f4f5;
  color: #909399;
}

.error-info {
  color: #f56c6c;
  font-style: italic;
}

/* 比较模态框样式 */
.comparison-modal {
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

.comparison-content {
  background: white;
  border-radius: 8px;
  max-width: 800px;
  width: 90%;
  max-height: 80%;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e4e7ed;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #909399;
}

.comparison-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  padding: 20px;
}

.comparison-side {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 15px;
}

.comparison-side h4 {
  margin: 0 0 15px 0;
  color: #333;
  border-bottom: 1px solid #e4e7ed;
  padding-bottom: 8px;
}

.analysis-details p {
  margin: 8px 0;
  line-height: 1.5;
}
</style>
