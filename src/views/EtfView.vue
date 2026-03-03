<template>
  <div class="etf-view">
    <div class="header-section">
      <h2>💰 ETF淘金</h2>
      <div class="search-box">
        <input 
          v-model="searchQuery" 
          @keyup.enter="handleSearch"
          placeholder="搜索 ETF 代码或名称..." 
          class="search-input"
        />
        <button @click="handleSearch" class="search-button">搜索</button>
      </div>
    </div>
    
    <div v-if="loading" class="loading-state">
      正在加载数据...
    </div>

    <div v-else-if="error" class="error-state">
      {{ error }}
    </div>

    <div v-else class="content-section">
      <!-- 列表区域 -->
      <div class="list-section" v-if="!selectedEtf">
        <div class="etf-grid">
          <div 
            v-for="etf in etfList" 
            :key="etf.ts_code"
            class="etf-card"
            @click="selectEtf(etf)"
          >
            <h3>{{ etf.name }} <span class="symbol">{{ etf.ts_code }}</span></h3>
            <p><strong>管理人:</strong> {{ etf.management }}</p>
            <p><strong>基准:</strong> {{ etf.benchmark || '无' }}</p>
          </div>
        </div>
      </div>
      
      <!-- 详情区域 -->
      <div class="detail-section" v-else>
        <button class="back-button" @click="selectedEtf = null">← 返回列表</button>
        <div class="detail-header">
          <h3>{{ selectedEtf.name }} ({{ selectedEtf.ts_code }})</h3>
          <button 
            class="analysis-btn" 
            @click="triggerAnalysis" 
            :disabled="analyzing"
          >
            {{ analyzing ? 'AI分析中...' : '生成最新 AI 诊断' }}
          </button>
        </div>
        
        <div class="analysis-panel" v-if="analysisResult">
          <div class="score-ring">
            <span class="score">{{ analysisResult.actionable_score }}</span>
            <span class="label">综合分</span>
          </div>
          <div class="analysis-content">
            <p class="core-logic"><strong>核心逻辑：</strong>{{ analysisResult.core_logic }}</p>
            <div class="views">
              <div class="view-card short-term">
                <h4>近两周短线博弈</h4>
                <p>{{ analysisResult.short_term_view }}</p>
              </div>
              <div class="view-card mid-long-term">
                <h4>中长线投资价值</h4>
                <p>{{ analysisResult.mid_long_term_view }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="chart-container">
          <EtfChart 
            v-if="chartRecords.length > 0" 
            :symbol="selectedEtf.ts_code" 
            :name="selectedEtf.name" 
            :records="chartRecords" 
          />
          <div v-else class="skeleton-chart">K线及资金流图表加载中...</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import EtfChart from '../components/EtfChart.vue'

const etfList = ref([])
const loading = ref(true)
const error = ref('')
const searchQuery = ref('')
const selectedEtf = ref(null)

const analysisResult = ref(null)
const analyzing = ref(false)
const pollingTimer = ref(null)
const chartRecords = ref([])

// Load initial list
const fetchList = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await axios.get('/api/etf/list', {
      params: { q: searchQuery.value, limit: 50 }
    })
    etfList.value = res.data.data
  } catch (e) {
    error.value = "获取ETF列表失败: " + e.message
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchList()
})

const handleSearch = () => {
  fetchList()
}

const selectEtf = async (etf) => {
  selectedEtf.value = etf
  analysisResult.value = null
  chartRecords.value = []
  
  // 并行获取分析缓存和K线数据
  fetchLatestAnalysis(etf.ts_code)
  
  try {
    const res = await axios.get(`/api/etf/${etf.ts_code}/kline?limit=250`)
    if (res.data.success) {
      chartRecords.value = res.data.data
    }
  } catch (e) {
    console.error("Failed to fetch ETF K-line data", e)
  }
}

const fetchLatestAnalysis = async (symbol) => {
  try {
    const res = await axios.get(`/api/etf/${symbol}/analysis`)
    if (res.data.success && res.data.analysis) {
      analysisResult.value = res.data.analysis
    }
  } catch (e) {
    console.error("No cached analysis found", e)
  }
}

const triggerAnalysis = async () => {
  if (!selectedEtf.value) return
  
  analyzing.value = true
  try {
    const res = await axios.post('/api/etf/analyze', {
      symbol: selectedEtf.value.ts_code,
      force: true
    })
    
    if (res.data.success && res.data.task_id) {
      pollTaskStatus(res.data.task_id)
    }
  } catch (e) {
    alert("触发分析失败: " + e.message)
    analyzing.value = false
  }
}

const pollTaskStatus = (taskId) => {
  if (pollingTimer.value) clearInterval(pollingTimer.value)
  
  pollingTimer.value = setInterval(async () => {
    try {
      const res = await axios.get(`/api/etf/task/${taskId}`)
      if (res.data.status === 'completed') {
        clearInterval(pollingTimer.value)
        analysisResult.value = res.data.analysis
        analyzing.value = false
      } else if (res.data.status === 'failed') {
        clearInterval(pollingTimer.value)
        alert("分析任务失败: " + res.data.error)
        analyzing.value = false
      }
    } catch (e) {
      clearInterval(pollingTimer.value)
      analyzing.value = false
    }
  }, 2000)
}

</script>

<style scoped>
.etf-view {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.search-box {
  display: flex;
  gap: 10px;
}

.search-input {
  padding: 8px 12px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 6px;
  width: 300px;
  background-color: var(--bg-color, #fff);
  color: var(--text-color, #333);
}

.search-button {
  padding: 8px 16px;
  background: var(--primary-color, #1890ff);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.etf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.etf-card {
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, #eee);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.etf-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0,0,0,0.1);
  border-color: var(--primary-color, #1890ff);
}

.etf-card h3 {
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.symbol {
  font-size: 0.8em;
  color: #888;
  background: var(--hover-bg, #f5f5f5);
  padding: 2px 6px;
  border-radius: 4px;
}

.detail-section {
  background: var(--card-bg, #fff);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.back-button {
  background: none;
  border: none;
  color: var(--primary-color, #1890ff);
  font-size: 1em;
  cursor: pointer;
  padding: 0;
  margin-bottom: 16px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color, #eee);
}

.analysis-btn {
  background: linear-gradient(135deg, #1890ff, #722ed1);
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 20px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.3s;
}

.analysis-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.analysis-panel {
  display: flex;
  gap: 24px;
  background: var(--hover-bg, #fafafa);
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 24px;
}

.score-ring {
  flex-shrink: 0;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border: 4px solid var(--primary-color, #1890ff);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: white;
}

.score-ring .score {
  font-size: 32px;
  font-weight: 700;
  color: var(--primary-color, #1890ff);
  line-height: 1;
}

.score-ring .label {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.analysis-content {
  flex-grow: 1;
}

.core-logic {
  font-size: 16px;
  margin-bottom: 16px;
  background: rgba(24, 144, 255, 0.1);
  padding: 12px;
  border-left: 4px solid var(--primary-color, #1890ff);
  border-radius: 0 4px 4px 0;
}

.views {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.view-card {
  background: white;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--border-color, #eee);
}

.view-card h4 {
  margin: 0 0 8px 0;
  color: var(--text-color, #333);
}

.view-card p {
  margin: 0;
  color: #555;
  font-size: 14px;
  line-height: 1.5;
}

.chart-container {
  height: 600px;
  border: 1px dashed var(--border-color, #ccc);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
}

.loading-state, .error-state {
  text-align: center;
  padding: 40px;
  color: #666;
  background: var(--card-bg, #fff);
  border-radius: 8px;
}

.error-state {
  color: #cf1322;
  background: #fff1f0;
}
</style>
