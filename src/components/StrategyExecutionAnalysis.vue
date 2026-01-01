<template>
  <div class="strategy-execution-analysis">
    <!-- 筛选器面板 -->
    <div class="filter-panel">
      <div class="filter-row">
        <div class="filter-item">
          <label>策略类型</label>
          <select v-model="filters.strategy" @change="loadAnalysisHistory">
            <option value="">全部</option>
            <option 
              v-for="strategy in availableStrategies" 
              :key="strategy.key" 
              :value="strategy.key"
            >
              {{ strategy.name }}
            </option>
          </select>
        </div>
        
        <div class="filter-item">
          <label>股票代码</label>
          <input v-model="filters.symbol" placeholder="输入股票代码" @keyup.enter="loadAnalysisHistory">
        </div>
        
        <div class="filter-item">
          <label>日期范围</label>
          <input type="date" v-model="filters.startDate" @change="loadAnalysisHistory">
          <input type="date" v-model="filters.endDate" @change="loadAnalysisHistory">
        </div>
        
        <div class="filter-item">
          <button @click="loadAnalysisHistory" :disabled="loading" class="btn-base btn-sm btn-gradient-purple">
            {{ loading ? '加载中...' : '查询' }}
          </button>
          <button @click="resetFilters" class="btn-base btn-sm btn-gradient-gray">重置</button>
        </div>
      </div>
    </div>

    <!-- 统计概览 -->
    <div class="stats-overview">
      <div class="stat-card">
        <h4>总分析次数</h4>
        <p class="stat-number">{{ summary.total_analyses }}</p>
      </div>
      <div class="stat-card">
        <h4>有效分析</h4>
        <p class="stat-number">{{ summary.valid_analyses }}</p>
      </div>
      <div class="stat-card">
        <h4>分析成功率</h4>
        <p class="stat-number">{{ summary.success_rate }}%</p>
      </div>
      <div class="stat-card">
        <h4>平均间隔</h4>
        <p class="stat-number">{{ summary.avg_interval }}天</p>
      </div>
    </div>

    <!-- 分析记录表格 -->
    <div class="analysis-table-container">
      <table class="analysis-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>策略</th>
            <th>股票</th>
            <th>分析类型</th>
            <th>分析结果</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in analysisList" :key="record._id">
            <td>{{ formatDateTime(record.timestamp) }}</td>
            <td>{{ record.strategy }}</td>
            <td>{{ record.symbol }}</td>
            <td>{{ getAnalysisTypeLabel(record.result.analysis_type) }}</td>
            <td>
              <span :class="getAnalysisResultClass(record)">
                {{ getAnalysisResultLabel(record) }}
              </span>
            </td>
            <td>
              <button @click="viewDetails(record)" class="btn-sm btn-gradient-blue">详情</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div class="pagination" v-if="totalPages > 1">
      <button @click="goToPage(currentPage - 1)" :disabled="currentPage <= 1">上一页</button>
      <span>第 {{ currentPage }} 页，共 {{ totalPages }} 页</span>
      <button @click="goToPage(currentPage + 1)" :disabled="currentPage >= totalPages">下一页</button>
    </div>

    <!-- 详情模态框 -->
    <div v-if="selectedRecord" class="modal-overlay" @click="closeDetails">
      <div class="modal-content analysis-detail-modal" @click.stop>
        <div class="modal-header gradient-purple flex-row-center flex-center-between">
          <h4 class="modal-title">{{ selectedRecord.symbol }} - {{ selectedRecord.strategy }} 分析详情</h4>
          <button @click="closeDetails" class="btn-base btn-sm btn-gradient-gray">关闭</button>
        </div>
        <div class="modal-body">
          <div class="detail-section">
            <h5>分析时间</h5>
            <p>{{ formatDateTime(selectedRecord.timestamp) }}</p>
          </div>
          
          <div class="detail-section">
            <h5>分析类型</h5>
            <p>{{ getAnalysisTypeLabel(selectedRecord.result.analysis_type) }}</p>
          </div>
          
          <div class="detail-section">
            <h5>分析推理过程</h5>
            <div class="reasoning-steps">
              <div v-for="(step, key) in selectedRecord.result.detailed_reasoning" :key="key" class="reasoning-step">
                <strong>{{ key }}:</strong> {{ step }}
              </div>
            </div>
          </div>
          
          <div class="detail-section">
            <h5>分析结果</h5>
            <div class="result-details">
              <div v-for="(value, key) in selectedRecord.result" :key="key" v-if="key !== 'detailed_reasoning'">
                <strong>{{ key }}:</strong> {{ formatValue(value) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getDeepAnalysisHistory } from '../api/analysis'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

// 响应式数据
const loading = ref(false)
const error = ref('')
const analysisList = ref([])
const selectedRecord = ref(null)
const currentPage = ref(1)
const totalPages = ref(1)
const totalRecords = ref(0)

// 策略列表
const availableStrategies = ref([])

// 筛选器
const filters = ref({
  strategy: '',
  symbol: '',
  startDate: '',
  endDate: ''
})

// 统计概览
const summary = ref({
  total_analyses: 0,
  valid_analyses: 0,
  success_rate: 0,
  avg_interval: 0
})

// 加载策略列表
async function loadStrategyList() {
  try {
    const token = localStorage.getItem('access_token')
    const response = await fetch(`${API_BASE}/strategy/strategies`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (!response.ok) throw new Error('Failed to load strategies')
    const strategiesData = await response.json()
    availableStrategies.value = strategiesData.strategies || []
    
    console.log('策略列表加载成功:', availableStrategies.value.length, '个策略')
  } catch (error) {
    console.error('Error loading strategy list:', error)
  }
}

// 加载分析历史
async function loadAnalysisHistory() {
  loading.value = true
  error.value = ''
  
  try {
    const params = {
      page: currentPage.value,
      limit: 20,
      ...filters.value
    }
    
    // 移除空值参数
    Object.keys(params).forEach(key => {
      if (params[key] === '') {
        delete params[key]
      }
    })
    
    const response = await getDeepAnalysisHistory(params)
    analysisList.value = response.data.analysis_details || []
    totalPages.value = Math.ceil((response.data.total_records || 0) / 20)
    totalRecords.value = response.data.total_records || 0
    
    // 更新统计概览
    updateSummary(response.data.analysis_details || [])
    
  } catch (e) {
    error.value = e.message || '加载分析历史失败'
    analysisList.value = []
  } finally {
    loading.value = false
  }
}

// 更新统计概览
function updateSummary(records) {
  if (!records || records.length === 0) {
    summary.value = {
      total_analyses: 0,
      valid_analyses: 0,
      success_rate: 0,
      avg_interval: 0
    }
    return
  }
  
  // 计算总分析次数
  const totalAnalyses = records.length
  
  // 计算有效分析次数（假设有效分析是has_signal为true的记录）
  const validAnalyses = records.filter(record => 
    record.result && record.result.has_signal
  ).length
  
  // 计算成功率
  const successRate = totalAnalyses > 0 ? Math.round((validAnalyses / totalAnalyses) * 100) : 0
  
  // 计算平均间隔（假设是日线分析）
  const avgInterval = 1 // 默认1天，实际计算需要根据时间戳
  
  summary.value = {
    total_analyses: totalAnalyses,
    valid_analyses: validAnalyses,
    success_rate: successRate,
    avg_interval: avgInterval
  }
}

// 格式化时间
function formatDateTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp * 1000) // 时间戳是秒级的
  return date.toLocaleString('zh-CN')
}

// 获取分析类型标签
function getAnalysisTypeLabel(type) {
  const labels = {
    'daily_pattern_recognition': '日线模式识别',
    'asymmetric_hidden_dragon_analysis': '潜龙低吸分析',
    'asymmetric_single_yang_analysis': '单阳不破分析',
    'dynamic_base_adjustment': '动态基准调整',
    'hidden_dragon_analysis': '潜龙分析',
    'single_yang_analysis': '单阳分析'
  }
  return labels[type] || type
}

// 获取分析结果标签
function getAnalysisResultLabel(record) {
  if (record.result && record.result.has_signal) {
    return '产生信号'
  } else if (record.result && record.result.pattern) {
    return '模式识别'
  } else {
    return '常规分析'
  }
}

// 获取分析结果样式类
function getAnalysisResultClass(record) {
  if (record.result && record.result.has_signal) {
    return 'result-success'
  } else {
    return 'result-info'
  }
}

// 格式化值
function formatValue(value) {
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }
  return value
}

// 查看详情
function viewDetails(record) {
  selectedRecord.value = record
}

// 关闭详情
function closeDetails() {
  selectedRecord.value = null
}

// 重置筛选器
function resetFilters() {
  filters.value = {
    strategy: '',
    symbol: '',
    startDate: '',
    endDate: ''
  }
  loadAnalysisHistory()
}

// 分页
function goToPage(page) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    loadAnalysisHistory()
  }
}

onMounted(async () => {
  await Promise.all([
    loadStrategyList(),
    loadAnalysisHistory()
  ])
})
</script>

<style scoped>
.strategy-execution-analysis {
  background: #fff;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  margin: 20px 0;
}

.filter-panel {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: end;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-item label {
  font-size: 13px;
  color: #495057;
  font-weight: 500;
}

.filter-item select,
.filter-item input {
  padding: 8px 12px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  font-size: 14px;
}

.filter-item input[type="date"] {
  width: 140px;
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px;
  border-radius: 8px;
  text-align: center;
}

.stat-card h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 500;
}

.stat-number {
  margin: 0;
  font-size: 24px;
  font-weight: bold;
}

.analysis-table-container {
  overflow-x: auto;
}

.analysis-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.analysis-table th,
.analysis-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #dee2e6;
}

.analysis-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
}

.result-success {
  background: #d4edda;
  color: #155724;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.result-info {
  background: #d1ecf1;
  color: #0c5460;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
}

.pagination button {
  padding: 8px 16px;
  border: 1px solid #dee2e6;
  background: white;
  border-radius: 6px;
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.analysis-detail-modal {
  max-width: 800px;
  max-height: 80vh;
  overflow-y: auto;
  border-radius: 12px;
  background: white;
}

.modal-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 20px;
  border-radius: 12px 12px 0 0;
}

.modal-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.modal-body {
  padding: 20px;
}

.detail-section {
  margin-bottom: 20px;
}

.detail-section h5 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
}

.reasoning-steps {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 6px;
  border-left: 4px solid #667eea;
}

.reasoning-step {
  margin-bottom: 8px;
  font-size: 13px;
  line-height: 1.5;
}

.reasoning-step:last-child {
  margin-bottom: 0;
}

.result-details {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.6;
}

.result-details div {
  margin-bottom: 6px;
}

.result-details div:last-child {
  margin-bottom: 0;
}
</style>