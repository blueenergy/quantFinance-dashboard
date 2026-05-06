<template>
  <div class="ai-analysis-history">
    <div class="history-header flex-row-center flex-center-between gap-sm">
      <h3 class="history-title">AI分析回溯记录</h3>
      <button @click="loadHistory" :disabled="loading" class="btn-base btn-sm btn-gradient-purple">
        {{ loading ? '加载中...' : '刷新' }}
      </button>
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
            <span class="stock-code">{{ item.stock_code }}</span>
            <span v-if="item.stock_name" class="stock-name">{{ item.stock_name }}</span>
            <span class="provider-chip">{{ item.provider }}</span>
            <span :class="['mode-badge', modeClass(item.analysis_mode)]">{{ modeLabel(item.analysis_mode) }}</span>
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
      <div class="modal-content analysis-detail-modal" :class="{ 'analysis-detail-modal--maximized': detailMaximized }" @click.stop>
        <div class="modal-header gradient-purple flex-row-center flex-center-between">
          <h4 class="modal-title">
            {{ selectedItem.stock_code }}
            <span v-if="selectedItem.stock_name" class="modal-stock-name">{{ selectedItem.stock_name }}</span>
            AI分析详情
          </h4>
          <span :class="['mode-badge', 'in-modal', modeClass(selectedItem.analysis_mode)]">{{ modeLabel(selectedItem.analysis_mode) }}</span>
          <button @click="toggleDetailMaximized" class="btn-base btn-sm btn-gradient-teal detail-fullscreen-btn">
            {{ detailMaximized ? '退出全屏' : '全屏' }}
          </button>
          <button @click="closeDetails" class="btn-base btn-sm btn-gradient-gray">关闭</button>
        </div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="detail-item">
              <strong>分析模式:</strong>
              <p>{{ modeLabel(selectedItem.analysis_mode) }}</p>
            </div>
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
import { ref, onMounted } from 'vue'
import axios from 'axios'

// Static label maps - 只保留真正需要翻译的标签
const adviceLabels = { buy: '买入', hold: '持有', sell: '卖出' }
const riskLabels = { low: '低风险', medium: '中风险', high: '高风险' }

const loading = ref(false)
const error = ref('')
const historyList = ref([])
const selectedItem = ref(null)
const detailMaximized = ref(false)

// Detail block spec (reduces template repetition)
const detailBlocks = [
  { key: 'qtag', title: '量化快照标记', get: (it) => it.analysis?.quant_score_snapshot_tag || '暂无' },
  { key: 'qcross', title: '分数与叙述对照 (stock_scores)', get: (it) => it.analysis?.quant_score_cross_check || '暂无' },
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

function modeLabel(mode) {
  return mode === 'multi_expert_v1' ? '多专家' : '经典'
}

function modeClass(mode) {
  return mode === 'multi_expert_v1' ? 'multi-expert' : 'classic'
}

function viewDetails(item) {
  selectedItem.value = item
  detailMaximized.value = false
}

function closeDetails() {
  selectedItem.value = null
  detailMaximized.value = false
}

function toggleDetailMaximized() {
  detailMaximized.value = !detailMaximized.value
}

function clearError() { error.value = '' }

async function loadHistory() {
  loading.value = true
  error.value = ''
  try {
    const token = localStorage.getItem('access_token')
    if (!token) {
      throw new Error('未登录，无法加载历史记录')
    }
    
    // 从后端加载所有分析历史，添加分页参数绕过客户端验证
    const response = await axios.get('/api/analysis-history', {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        page: 1,
        limit: 1000  // 获取最近1000条记录
      }
    })
    
    const rawData = response.data?.data || []
    console.log('加载的历史记录:', rawData)
    
    // 解析数据结构
    historyList.value = rawData.map((item) => {
      const analysisResult = item.analysis_result || {}
      const analysis = analysisResult.analysis || item.analysis || {}
      const analysisMode = item.analysis_mode || analysisResult.analysis_mode || analysis.analysis_mode || 'classic'
      
      return {
        id: item.id || item._id,
        stock_code: item.symbol || '未知',
        stock_name: item.stock_name || analysis.stock_name || item.symbol,
        provider: item.provider || analysisResult.provider || 'unknown',
        model: item.model || analysisResult.model || 'unknown',
        created_at: item.created_at || item.timestamp || new Date().toISOString(),
        analysis_mode: analysisMode,
        analysis: {
          analysis_mode: analysisMode,
          quant_score_snapshot_tag: analysis.quant_score_snapshot_tag,
          quant_score_cross_check: analysis.quant_score_cross_check,
          technical_analysis: analysis.technical_analysis,
          long_term_forecast: analysis.long_term_forecast,
          mid_term_forecast: analysis.mid_term_forecast,
          short_term_forecast: analysis.short_term_forecast,
          investment_advice: analysis.investment_advice,
          risk_level: analysis.risk_level,
          support_level: analysis.support_level,
          resistance_level: analysis.resistance_level,
          confidence_score: analysis.confidence_score,
          key_points: analysis.key_points || []
        }
      }
    })
    
    // 按时间降序排列
    historyList.value.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    
  } catch (e) {
    console.error('加载历史记录失败:', e)
    error.value = e.message || '加载AI分析回溯记录失败'
    historyList.value = []
  } finally {
    loading.value = false
  }
}

// 监听全局事件，当有新的分析时刷新
if (typeof window !== 'undefined') {
  window.addEventListener('ai-analysis:updated', () => {
    console.log('检测到新的 AI 分析，刷新历史记录')
    loadHistory()
  })
}

onMounted(loadHistory)
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
.stock-name { font-size:14px; color:#6c757d; font-weight:400; }
.provider-chip { background:#e9ecef; padding:4px 8px; border-radius:4px; font-size:12px; color:#495057; }
.mode-badge { padding:4px 10px; border-radius:999px; font-size:12px; font-weight:600; border:1px solid transparent; }
.mode-badge.classic { background:rgba(99,102,241,.12); color:#4338ca; border-color:rgba(129,140,248,.28); }
.mode-badge.multi-expert { background:rgba(6,182,212,.14); color:#0f766e; border-color:rgba(45,212,191,.32); }
.mode-badge.in-modal { margin-left:auto; margin-right:12px; }
.analysis-time { font-size:12px; color:#6c757d; }
.label-muted { font-size:13px; color:#495057; }
.item-preview { font-size:13px; line-height:1.5; }
/* Modal */
.analysis-detail-modal { width:min(1100px, 92vw); max-height:80vh; overflow-y:auto; border-radius:12px; }
.analysis-detail-modal--maximized { width:96vw; max-width:none; height:92vh; max-height:none; }
.modal-header.gradient-purple { background:linear-gradient(135deg,#667eea 0%, #764ba2 100%); color:#fff; padding:16px 20px; border-radius:12px 12px 0 0; }
.modal-title { margin:0; font-size:18px; font-weight:600; }
.modal-stock-name { font-size:16px; font-weight:400; margin-left:8px; opacity:0.9; }
.modal-body { padding:20px 22px; }
.detail-fullscreen-btn { margin-left:auto; }
.detail-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:16px; margin-bottom:20px; }
.detail-item { background:#f8f9fa; padding:14px; border-radius:8px; border-left:4px solid #667eea; }
.detail-item strong { display:block; margin-bottom:6px; font-size:14px; color:#2c3e50; }
.detail-item p { margin:4px 0; font-size:13px; line-height:1.5; color:#495057; }
.key-points { background:#e9ecef; padding:16px; border-radius:8px; }
.key-points strong { display:block; margin-bottom:10px; font-size:14px; }
.key-points ul { margin:0; padding-left:18px; }
.key-points li { margin-bottom:6px; font-size:13px; line-height:1.5; }

@media (max-width: 768px) {
  .analysis-detail-modal {
    width: 96vw;
  }

  .analysis-detail-modal--maximized {
    width: 100vw;
    height: 100vh;
    border-radius: 0;
  }

  .modal-header.gradient-purple {
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>