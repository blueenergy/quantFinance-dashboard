<template>
  <div class="ai-analysis-history">
    <div class="history-header flex-row-center flex-center-between gap-sm">
      <h3 class="history-title">AI分析回溯记录</h3>
      <div class="filters">
        <input v-model="symbolFilter" placeholder="股票代码过滤 (如 000001)" class="filter-input" />
        <input v-model="modelFilter" placeholder="模型过滤 (如 qwen3-30b)" class="filter-input" />
        <select v-model="adviceFilter" class="filter-select">
          <option value="">所有建议</option>
          <option value="buy">买入</option>
          <option value="hold">持有</option>
          <option value="sell">卖出</option>
        </select>
        <button @click="applyFilters" :disabled="loading" class="btn-base btn-sm btn-gradient-purple">
          应用
        </button>
        <button @click="clearFilters" :disabled="loading" class="btn-base btn-sm btn-gradient-gray">
          清除
        </button>
        <button @click="loadHistory(filtersForRequest.value)" :disabled="loading" class="btn-base btn-sm btn-gradient-purple">
          {{ loading ? '加载中...' : '刷新' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>正在加载AI分析回溯记录...</p>
    </div>

    <div v-if="error" class="error-box">
      <p>{{ error }}</p>
      <button @click="clearError" class="btn-base btn-sm btn-gradient-red">清除错误</button>
    </div>

    <div v-if="!loading && historyList.length === 0" class="empty">
      <p>暂无AI分析回溯记录</p>
      <p>去进行一次AI股票分析吧！</p>
    </div>

    <div v-if="historyList.length > 0" class="history-list">
      <div
        v-for="item in historyList"
        :key="item.id"
        class="history-item"
        @click="viewDetails(item)"
      >
        <div class="item-header flex-row-center flex-center-between gap-sm">
          <div class="stock-info flex-row-center gap-sm">
            <span class="stock-code">{{ item.symbol }}</span>
            <span v-if="item.stock_name" class="stock-name">{{ item.stock_name }}</span>
            <span class="provider-chip">{{ providerNames[item.provider] || item.provider }}</span>
          </div>
          <time class="analysis-time" :datetime="item.created_at">{{ formatTime(item.created_at) }}</time>
        </div>
        <div class="item-summary flex-row-center gap-md">
          <div class="flex-row-center gap-xs">
            <span class="label-muted">投资建议:</span>
            <span class="tag" :class="'tag-' + (item.analysis?.investment_advice || 'na')">
              {{ adviceLabels[item.analysis?.investment_advice] || (item.analysis?.investment_advice || '—') }}
            </span>
          </div>
          <div class="flex-row-center gap-xs">
            <span class="label-muted">风险等级:</span>
            <span class="tag" :class="'tag-risk-' + (item.analysis?.risk_level || 'na')">
              {{ riskLabels[item.analysis?.risk_level] || (item.analysis?.risk_level || '—') }}
            </span>
          </div>
        </div>
        <div v-if="item.analysis?.technical_analysis" class="item-preview text-subtle">
          {{ item.analysis.technical_analysis.substring(0, 100) }}...
        </div>
      </div>
    </div>

    <!-- 详情对话框 -->
    <div v-if="selectedItem" class="modal-overlay" @click="closeDetails">
      <div class="modal-content analysis-detail-modal" @click.stop>
        <div class="modal-header gradient-purple flex-row-center flex-center-between">
          <h4 class="modal-title">{{ selectedItem.symbol }} AI分析详情</h4>
          <button @click="closeDetails" class="btn-base btn-sm btn-gradient-gray">关闭</button>
        </div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="detail-item" v-for="block in detailBlocks" :key="block.key">
              <strong>{{ block.title }}:</strong>
              <template v-if="block.type === 'levels'">
                <p>支撑位: {{ selectedItem.analysis?.support_level || '暂无' }}</p>
                <p>阻力位: {{ selectedItem.analysis?.resistance_level || '暂无' }}</p>
              </template>
              <template v-else>
                <p>{{ block.get(selectedItem) }}</p>
              </template>
            </div>
          </div>
          <div v-if="selectedItem.analysis?.key_points?.length" class="key-points">
            <strong>关键要点:</strong>
            <ul>
              <li v-for="(point, index) in selectedItem.analysis.key_points" :key="index">{{ point }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'

// Static label maps
const providerNames = { openai: 'OpenAI', deepseek: 'DeepSeek', custom: '自定义API' }
const adviceLabels = { buy: '买入', hold: '持有', sell: '卖出' }
const riskLabels = { low: '低风险', medium: '中风险', high: '高风险' }

const loading = ref(false)
const error = ref('')
const historyList = ref([])
const selectedItem = ref(null)

// Filters
const symbolFilter = ref('')
const modelFilter = ref('')
const adviceFilter = ref('')

const filtersForRequest = computed(() => {
  const p = {}
  if (symbolFilter.value) p.symbol = symbolFilter.value
  if (modelFilter.value) p.model = modelFilter.value
  if (adviceFilter.value) p.investment_advice = adviceFilter.value
  return p
})

// Detail block spec (reduces template repetition)
const detailBlocks = [
  { key: 'technical', title: '技术分析', get: (it) => it.analysis?.technical_analysis || '暂无' },
  { key: 'long', title: '长期预测', get: (it) => it.analysis?.long_term_forecast || '暂无' },
  { key: 'mid', title: '中期预测', get: (it) => it.analysis?.mid_term_forecast || '暂无' },
  { key: 'short', title: '短期预测', get: (it) => it.analysis?.short_term_forecast || '暂无' },
  { key: 'levels', title: '关键价位', type: 'levels' },
  { key: 'conf', title: '置信度', get: (it) => (it.analysis?.confidence_score || 0) + '%' }
]

function formatTime(timeStr) {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  return date.toLocaleString('zh-CN')
}

function viewDetails(item) { selectedItem.value = item }
function closeDetails() { selectedItem.value = null }
function clearError() { error.value = '' }

import axios from 'axios'

/**
 * Load AI analysis history from backend API.
 * If `symbol` is provided, the API will be queried with that symbol filter.
 */
/**
 * Load AI analysis history from backend API.
 * Accepts an optional filters object (e.g. { symbol, model, investment_advice }).
 */
async function loadHistory(filters = {}) {
  loading.value = true
  error.value = ''
  try {
    // Provide sensible defaults for pagination
    const params = Object.assign({ page: 1, limit: 50 }, filters || {})
    const res = await axios.get('/api/analysis-history', { params, timeout: 15000 })
    if (res.data && (Array.isArray(res.data.data) || Array.isArray(res.data))) {
      const raw = Array.isArray(res.data.data) ? res.data.data : res.data
      const norm = raw.map(h => {
        const ar = h.analysis_result || {}
        const analysis = ar.analysis || h.analysis || null
        const symbol = h.symbol || analysis?.symbol || h.stock_code || ''
        return {
          id: String(h.id || h._id || ''),
          symbol,
          stock_name: h.stock_name || analysis?.stock_name || '',
          analysis,
          provider: h.provider || ar.provider,
          model: h.model || ar.model,
          created_at: h.created_at || h.timestamp || ''
        }
      })
      historyList.value = norm
    } else {
      historyList.value = []
    }
  } catch (e) {
    console.error('加载AI分析回溯失败:', e)
    if (e.response?.status === 422) {
      error.value = '请求参数格式不正确(422)。请检查筛选条件或联系后端支持。'
    } else {
      error.value = e.response?.data?.message || e.message || '加载AI分析回溯记录失败'
    }
    historyList.value = []
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  loadHistory(filtersForRequest.value)
}

function clearFilters() {
  symbolFilter.value = ''
  modelFilter.value = ''
  adviceFilter.value = ''
  loadHistory()
}

// Listen for external updates (e.g., after a new analysis is stored)
function onExternalUpdate(e) {
  const symbol = e?.detail?.symbol
  if (symbol) {
    // If symbol provided, refresh with that filter so user sees the new entry
    loadHistory({ symbol })
  } else {
    loadHistory()
  }
}

onMounted(() => {
  window.addEventListener('ai-analysis:updated', onExternalUpdate)
  // Auto-load page 1 of user's history (global) when component mounts
  loadHistory({ page: 1, limit: 50 })
})

onUnmounted(() => {
  window.removeEventListener('ai-analysis:updated', onExternalUpdate)
})
</script>

<style scoped>
.ai-analysis-history { background:#fff; padding:24px; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.08); margin:20px 0; }
.history-title { margin:0; font-size:22px; font-weight:700; color:#2c3e50; }
.loading, .empty { text-align:center; padding:40px; }
.spinner { width:32px; height:32px; border:3px solid #f3f3f3; border-top:3px solid #764ba2; border-radius:50%; animation:spin 1s linear infinite; margin:0 auto 16px; }
@keyframes spin { 0%{ transform:rotate(0deg);} 100%{ transform:rotate(360deg);} }
.error-box { background:#f8d7da; color:#721c24; padding:16px; border-radius:8px; margin-bottom:20px; border:1px solid #f5c6cb; text-align:center; }
.history-list { display:flex; flex-direction:column; gap:16px; }
.history-item { border:1px solid #dee2e6; border-radius:8px; padding:16px 18px; cursor:pointer; transition:.25s; background:#fff; }
.history-item:hover { border-color:#764ba2; box-shadow:0 4px 14px rgba(118,75,162,.18); transform:translateY(-2px); }
.stock-code { font-size:16px; font-weight:700; color:#2c3e50; }
.provider-chip { background:#e9ecef; padding:4px 8px; border-radius:4px; font-size:12px; color:#495057; }
.analysis-time { font-size:12px; color:#6c757d; }
.label-muted { font-size:13px; color:#495057; }
.item-preview { font-size:13px; line-height:1.5; }
/* Modal */
.analysis-detail-modal { max-width:800px; max-height:80vh; overflow-y:auto; border-radius:12px; }
.modal-header.gradient-purple { background:linear-gradient(135deg,#667eea 0%, #764ba2 100%); color:#fff; padding:16px 20px; border-radius:12px 12px 0 0; }
.modal-title { margin:0; font-size:18px; font-weight:600; }
.modal-body { padding:20px 22px; }
.detail-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:16px; margin-bottom:20px; }
.detail-item { background:#f8f9fa; padding:14px; border-radius:8px; border-left:4px solid #667eea; }
.detail-item strong { display:block; margin-bottom:6px; font-size:14px; color:#2c3e50; }
.detail-item p { margin:4px 0; font-size:13px; line-height:1.5; color:#495057; }
.key-points { background:#e9ecef; padding:16px; border-radius:8px; }
.key-points strong { display:block; margin-bottom:10px; font-size:14px; }
.key-points ul { margin:0; padding-left:18px; }
.key-points li { margin-bottom:6px; font-size:13px; line-height:1.5; }
</style>