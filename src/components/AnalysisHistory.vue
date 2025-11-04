<template>
  <div class="analysis-history">
    <div class="history-header flex-row-center flex-center-between gap-sm">
      <h3 class="history-title">分析历史记录</h3>
      <button @click="loadHistory" :disabled="loading" class="btn-base btn-sm btn-gradient-purple">
        {{ loading ? '加载中...' : '刷新' }}
      </button>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>正在加载历史记录...</p>
    </div>

    <div v-if="error" class="error-box">
      <p>{{ error }}</p>
      <button @click="clearError" class="btn-base btn-sm btn-gradient-red">清除错误</button>
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
        <div class="item-header flex-row-center flex-center-between gap-sm">
          <div class="stock-info flex-row-center gap-sm">
            <span class="stock-code">{{ item.stock_code }}</span>
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
          <h4 class="modal-title">{{ selectedItem.stock_code }} 分析详情</h4>
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
import { ref, onMounted } from 'vue'

// Static label maps
const providerNames = { openai: 'OpenAI', deepseek: 'DeepSeek', custom: '自定义API' }
const adviceLabels = { buy: '买入', hold: '持有', sell: '卖出' }
const riskLabels = { low: '低风险', medium: '中风险', high: '高风险' }

const loading = ref(false)
const error = ref('')
const historyList = ref([])
const selectedItem = ref(null)

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

async function loadHistory() {
  loading.value = true
  error.value = ''
  try {
    await new Promise(r => setTimeout(r, 600))
    historyList.value = [
      {
        id: '1', stock_code: '000001', provider: 'openai', model: 'gpt-3.5-turbo',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        analysis: {
          technical_analysis: '从技术面看，该股票呈现上升趋势，MACD指标显示买入信号...',
          short_term_forecast: '短期内预计股价将继续上涨，建议关注成交量变化...',
          investment_advice: 'buy', risk_level: 'medium', support_level: 12.50, resistance_level: 15.80,
          confidence_score: 75, key_points: ['技术指标良好', '成交量放大', '行业前景看好']
        }
      },
      {
        id: '2', stock_code: '000002', provider: 'deepseek', model: 'deepseek-chat',
        created_at: new Date(Date.now() - 172800000).toISOString(),
        analysis: {
          technical_analysis: '该股票近期横盘整理，缺乏明确方向...',
          short_term_forecast: '预计将继续震荡，等待方向选择...',
          investment_advice: 'hold', risk_level: 'low', support_level: 8.20, resistance_level: 9.50,
          confidence_score: 60, key_points: ['横盘整理', '成交量萎缩', '等待突破']
        }
      }
    ]
  } catch (e) {
    error.value = e.message || '加载历史记录失败'
    historyList.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadHistory)
</script>

<style scoped>
.analysis-history { background:#fff; padding:24px; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.08); margin:20px 0; }
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
