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
            <span
              v-if="evalBadges[item.id]"
              :class="['eval-list-badge', evalBadges[item.id].outcome_accuracy]"
              :title="'推理质量: ' + reasoningLabel(evalBadges[item.id].reasoning_quality)"
            >
              {{ accuracyLabel(evalBadges[item.id].outcome_accuracy) }}
            </span>
          </div>
          <div class="item-header-right flex-row-center gap-xs">
            <time class="analysis-time" :datetime="item.created_at">{{ formatTime(item.created_at) }}</time>
            <button
              class="btn-base btn-xs btn-delete-history"
              :disabled="deletingId === item.id"
              @click.stop="deleteHistory(item)"
              title="删除此条分析记录"
            >删除</button>
          </div>
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
          <button
            @click="triggerEvaluation(selectedItem)"
            :disabled="evaluationLoading"
            class="btn-base btn-sm btn-gradient-orange eval-btn"
          >
            <span v-if="evaluationLoading" class="eval-spinner"></span>
            {{ evaluationLoading ? '评估中...' : evaluationResult ? '重新评估' : '评估质量' }}
          </button>
          <button
            @click="triggerReanalysis(selectedItem)"
            :disabled="reanalysisLoading"
            class="btn-base btn-sm btn-reanalysis"
          >
            <span v-if="reanalysisLoading" class="eval-spinner"></span>
            {{ reanalysisLoading ? '提交中...' : '重新分析' }}
          </button>
          <button @click="toggleDetailMaximized" class="btn-base btn-sm btn-gradient-teal detail-fullscreen-btn">
            {{ detailMaximized ? '退出全屏' : '全屏' }}
          </button>
          <button @click="closeDetails" class="btn-base btn-sm btn-gradient-gray">关闭</button>
        </div>
        <div class="modal-body">
          <AnalysisDetailContent
            :analysis="selectedItem.analysis"
            :analysis-mode="selectedItem.analysis_mode"
            layout="grid"
            :show-mode="true"
          />

          <!-- Evaluation error -->
          <div v-if="evaluationError" class="eval-error">
            <span>⚠️ {{ evaluationError }}</span>
          </div>

          <!-- Evaluation result -->
          <div v-if="evaluationResult" class="eval-result-block">
            <h5 class="eval-result-title">
              分析质量评估
              <span
                v-if="evaluationResult.evaluation_status"
                :class="['eval-stage-chip', evaluationResult.evaluation_status]"
              >{{ stageLabel(evaluationResult.evaluation_status) }}</span>
            </h5>

            <!-- LLM verdict badges -->
            <div class="eval-badges">
              <span :class="['eval-badge', 'badge-accuracy', evaluationResult.llm_review?.outcome_accuracy]">
                预测准确性：{{ accuracyLabel(evaluationResult.llm_review?.outcome_accuracy) }}
              </span>
              <span :class="['eval-badge', 'badge-reasoning', evaluationResult.llm_review?.reasoning_quality]">
                推理质量：{{ reasoningLabel(evaluationResult.llm_review?.reasoning_quality) }}
              </span>
              <span :class="['eval-badge', 'badge-risk', evaluationResult.llm_review?.risk_calibration]">
                风险校准：{{ riskCalibLabel(evaluationResult.llm_review?.risk_calibration) }}
              </span>
            </div>

            <!-- Price window metrics table -->
            <div v-if="evaluationResult.price_windows" class="eval-metrics">
              <table class="eval-table">
                <thead>
                  <tr>
                    <th>窗口</th>
                    <th>T0收盘</th>
                    <th>期末收盘</th>
                    <th>收益率</th>
                    <th>最大涨幅</th>
                    <th>最大回撤</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(wlabel, wkey) in { short: '5交易日', mid: '20交易日', long: '60交易日' }" :key="wkey">
                    <td class="w-label">
                      {{ wlabel }}
                      <span v-if="evaluationResult.price_windows[wkey] && !evaluationResult.price_windows[wkey].complete" class="partial-flag">
                        (仅{{ evaluationResult.price_windows[wkey].days_available }}天)
                      </span>
                    </td>
                    <td>{{ evaluationResult.t0_close ?? '—' }}</td>
                    <td>{{ evaluationResult.price_windows[wkey]?.end_price ?? '—' }}</td>
                    <td :class="returnClass(evaluationResult.price_windows[wkey]?.return_pct)">
                      {{ formatPct(evaluationResult.price_windows[wkey]?.return_pct) }}
                    </td>
                    <td class="upside">{{ formatPct(evaluationResult.price_windows[wkey]?.max_upside_pct) }}</td>
                    <td class="drawdown">{{ formatPct(evaluationResult.price_windows[wkey]?.max_drawdown_pct) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Validated / falsified points -->
            <div class="eval-points-row">
              <div v-if="evaluationResult.llm_review?.validated_points?.length" class="eval-points validated">
                <p class="points-label">✅ 已证实要点</p>
                <ul>
                  <li v-for="(pt, i) in evaluationResult.llm_review.validated_points" :key="i">{{ pt }}</li>
                </ul>
              </div>
              <div v-if="evaluationResult.llm_review?.falsified_points?.length" class="eval-points falsified">
                <p class="points-label">❌ 已证伪要点</p>
                <ul>
                  <li v-for="(pt, i) in evaluationResult.llm_review.falsified_points" :key="i">{{ pt }}</li>
                </ul>
              </div>
            </div>

            <!-- Error diagnosis + improvement suggestions -->
            <div
              v-if="evaluationResult.llm_review?.error_diagnosis?.length || evaluationResult.llm_review?.improvement_suggestions?.length"
              class="eval-diagnosis-row"
            >
              <div v-if="evaluationResult.llm_review?.error_diagnosis?.length" class="eval-points diagnosis">
                <p class="points-label">🔍 失误根因诊断</p>
                <ul>
                  <li v-for="(pt, i) in evaluationResult.llm_review.error_diagnosis" :key="i">{{ pt }}</li>
                </ul>
              </div>
              <div v-if="evaluationResult.llm_review?.improvement_suggestions?.length" class="eval-points suggestions">
                <p class="points-label">💡 改进建议</p>
                <ul>
                  <li v-for="(pt, i) in evaluationResult.llm_review.improvement_suggestions" :key="i">{{ pt }}</li>
                </ul>
              </div>
            </div>

            <!-- Per-window narrative -->
            <div v-if="evaluationResult.llm_review" class="eval-narratives">
              <div v-if="evaluationResult.llm_review.short_review" class="eval-narrative">
                <span class="narrative-tag short">5日评价</span>
                <span>{{ evaluationResult.llm_review.short_review }}</span>
              </div>
              <div v-if="evaluationResult.llm_review.mid_review" class="eval-narrative">
                <span class="narrative-tag mid">20日评价</span>
                <span>{{ evaluationResult.llm_review.mid_review }}</span>
              </div>
              <div v-if="evaluationResult.llm_review.long_review" class="eval-narrative">
                <span class="narrative-tag long">60日评价</span>
                <span>{{ evaluationResult.llm_review.long_review }}</span>
              </div>
            </div>

            <!-- Summary -->
            <p v-if="evaluationResult.llm_review?.summary" class="eval-summary">
              {{ evaluationResult.llm_review.summary }}
            </p>

            <p class="eval-meta">评估时间: {{ formatTime(evaluationResult.evaluated_at) }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import AnalysisDetailContent from './AnalysisDetailContent.vue'

// Static label maps - 只保留真正需要翻译的标签
const adviceLabels = { buy: '买入', hold: '持有', sell: '卖出' }
const riskLabels = { low: '低风险', medium: '中风险', high: '高风险' }

const loading = ref(false)
const error = ref('')
const historyList = ref([])
const selectedItem = ref(null)
const detailMaximized = ref(false)
const evalBadges = ref({}) // { [history_id]: { outcome_accuracy, reasoning_quality } }

// Evaluation state
const evaluationLoading = ref(false)
const evaluationResult = ref(null)
const evaluationError = ref('')
let evalPollTimer = null
const deletingId = ref(null)
const reanalysisLoading = ref(false)

const accuracyLabels = { accurate: '准确', mixed: '部分准确', inaccurate: '不准确' }
const reasoningLabels = { strong: '严谨', partial: '一般', weak: '较弱' }
const riskCalibLabels = {
  well_calibrated: '校准良好',
  under_estimated: '低估风险',
  over_estimated: '高估风险',
}
function accuracyLabel(v) { return accuracyLabels[v] || v || '—' }
function reasoningLabel(v) { return reasoningLabels[v] || v || '—' }
function riskCalibLabel(v) { return riskCalibLabels[v] || v || '—' }
function stageLabel(status) {
  return { preliminary: '初步评估', stage2_complete: '中期更新', completed: '最终评估' }[status] || status
}
function formatPct(v) {
  if (v == null) return '—'
  return (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%'
}
function returnClass(v) {
  if (v == null) return ''
  return v > 0 ? 'upside' : v < 0 ? 'drawdown' : ''
}

async function triggerReanalysis(item) {
  if (!item) return
  reanalysisLoading.value = true
  const token = localStorage.getItem('access_token')
  try {
    const res = await axios.post(
      '/api/analyze/deep-analysis',
      {
        symbol: item.stock_code,
        priority: 1,
        analysis_mode: item.analysis_mode || 'classic',
      },
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (res.data?.success) {
      const remaining = res.data.quota_remaining
      const pos = res.data.position_in_queue
      const modeText = (item.analysis_mode === 'multi_expert_v1') ? '多专家' : '经典'
      alert(`已重新提交「${item.stock_code}」${modeText}分析。排队约 ${pos} 位，剩余配额 ${remaining}。完成后可在列表中刷新查看。`)
    } else {
      alert(`提交失败：${res.data?.message || '未知错误'}`)
    }
  } catch (e) {
    alert(`提交失败：${e.response?.data?.detail || e.message}`)
  } finally {
    reanalysisLoading.value = false
  }
}

function stopPolling() {
  if (evalPollTimer) {
    clearInterval(evalPollTimer)
    evalPollTimer = null
  }
}

async function loadExistingEvaluation(historyId) {
  const token = localStorage.getItem('access_token')
  if (!token) return
  try {
    const res = await axios.get(`/api/analysis/evaluations/${historyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.data) {
      evaluationResult.value = res.data
    }
  } catch (_) {
    // 404 is normal when not yet evaluated
  }
}

async function triggerEvaluation(item) {
  if (evaluationLoading.value) return
  stopPolling()
  evaluationLoading.value = true
  evaluationError.value = ''
  evaluationResult.value = null

  const token = localStorage.getItem('access_token')
  try {
    await axios.post(
      '/api/analysis/evaluate',
      { history_id: item.id, force: true },
      { headers: { Authorization: `Bearer ${token}` } }
    )
  } catch (e) {
    evaluationLoading.value = false
    evaluationError.value = e.response?.data?.detail || '提交评估失败'
    return
  }

  // Poll for completion
  let tries = 0
  evalPollTimer = setInterval(async () => {
    tries++
    if (tries > 40) {
      stopPolling()
      evaluationLoading.value = false
      evaluationError.value = '评估超时，请稍后刷新'
      return
    }
    try {
      const res = await axios.get(`/api/analysis/evaluations/${item.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const status = res.data?.evaluation_status
      if (status === 'completed') {
        stopPolling()
        evaluationResult.value = res.data
        evaluationLoading.value = false
        // Update list badge immediately without full reload
        const review = res.data?.llm_review || {}
        if (review.outcome_accuracy) {
          evalBadges.value = {
            ...evalBadges.value,
            [item.id]: {
              outcome_accuracy: review.outcome_accuracy,
              reasoning_quality: review.reasoning_quality,
            },
          }
        }
      } else if (status === 'insufficient_data' || status === 'window_not_mature') {
        stopPolling()
        evaluationLoading.value = false
        evaluationError.value =
          status === 'window_not_mature'
            ? '价格数据窗口尚未成熟（需至少5个交易日）'
            : '数据不足，无法评估'
      }
    } catch (_) {
      // Still pending, keep polling
    }
  }, 3000)
}

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
  stopPolling()
  evaluationLoading.value = false
  evaluationResult.value = null
  evaluationError.value = ''
  loadExistingEvaluation(item.id)
}

function closeDetails() {
  selectedItem.value = null
  detailMaximized.value = false
  stopPolling()
  evaluationLoading.value = false
  evaluationResult.value = null
  evaluationError.value = ''
}

async function deleteHistory(item) {
  if (!confirm(`确认删除「${item.stock_code}」的这条分析记录？此操作不可恢复。`)) return
  deletingId.value = item.id
  const token = localStorage.getItem('access_token')
  try {
    await axios.delete(`/api/analysis/history/${item.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    historyList.value = historyList.value.filter(h => h.id !== item.id)
    delete evalBadges.value[item.id]
    if (selectedItem.value?.id === item.id) closeDetails()
  } catch (e) {
    alert(e.response?.data?.detail || '删除失败，请稍后重试')
  } finally {
    deletingId.value = null
  }
}

function toggleDetailMaximized() {
  detailMaximized.value = !detailMaximized.value
}

function clearError() { error.value = '' }

async function loadEvalBadges(ids) {
  if (!ids.length) return
  const token = localStorage.getItem('access_token')
  if (!token) return
  try {
    const res = await axios.post(
      '/api/analysis/evaluations/batch',
      ids,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    evalBadges.value = res.data || {}
  } catch (_) {
    // non-critical; badges just won't show
  }
}

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
          ...analysis,
          analysis_mode: analysisMode,
          key_points: analysis.key_points || []
        }
      }
    })
    
    // 按时间降序排列
    historyList.value.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    // 批量加载评估徽章
    await loadEvalBadges(historyList.value.map(i => i.id).filter(Boolean))

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
.item-header-right { flex-shrink: 0; }
.btn-delete-history {
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid rgba(239,68,68,.4);
  background: rgba(239,68,68,.07);
  color: #b91c1c;
  cursor: pointer;
  opacity: 0;
  transition: opacity .15s;
}
.history-item:hover .btn-delete-history { opacity: 1; }
.btn-delete-history:hover { background: rgba(239,68,68,.18); }
.btn-delete-history:disabled { opacity: .4; cursor: not-allowed; }
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
:deep(.analysis-field-card) { background:#f8f9fa; border-color:rgba(102, 126, 234, 0.16); }
:deep(.expert-review-card) { background:#f8f9fa; border-color:rgba(102, 126, 234, 0.16); }
:deep(.expert-review-header h4),
:deep(.expert-review-card h5),
:deep(.analysis-field-card h5),
:deep(.analysis-field-card p),
:deep(.expert-review-header p),
:deep(.expert-review-card pre),
:deep(.analysis-summary-value),
:deep(.analysis-points-list li) { color:#495057; }
:deep(.expert-review-count),
:deep(.expert-review-chip) { color:#0f766e; }
:deep(.analysis-summary-label) { color:#6b7280; }

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

/* Evaluation list badge */
.eval-list-badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid transparent;
}
.eval-list-badge.accurate   { background: rgba(34,197,94,.15); color: #15803d; border-color: rgba(34,197,94,.3); }
.eval-list-badge.mixed      { background: rgba(234,179,8,.15);  color: #92400e; border-color: rgba(234,179,8,.3); }
.eval-list-badge.inaccurate { background: rgba(239,68,68,.15);  color: #b91c1c; border-color: rgba(239,68,68,.3); }

/* Evaluation / reanalysis buttons */
.eval-btn { margin-left: 8px; }
.btn-reanalysis {
  margin-left: 8px;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(129, 140, 248, 0.35);
  color: #c7d2fe;
}
.btn-reanalysis:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.28);
}
.btn-reanalysis:disabled { opacity: .5; cursor: not-allowed; }
.eval-spinner {
  display: inline-block;
  width: 12px; height: 12px;
  border: 2px solid rgba(255,255,255,.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin .8s linear infinite;
  margin-right: 6px;
  vertical-align: middle;
}

/* Evaluation result block */
.eval-error {
  margin: 16px 0 0;
  padding: 10px 14px;
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffc107;
  border-radius: 8px;
  font-size: 13px;
}
.eval-result-block {
  margin-top: 24px;
  padding: 20px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 10px;
}
.eval-result-title {
  margin: 0 0 14px;
  font-size: 15px;
  font-weight: 700;
  color: #2c3e50;
  display: flex;
  align-items: center;
  gap: 8px;
}
.eval-stage-chip {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}
.eval-stage-chip.preliminary     { background: rgba(234,179,8,.15);  color: #92400e; }
.eval-stage-chip.stage2_complete  { background: rgba(99,102,241,.15); color: #4338ca; }
.eval-stage-chip.completed        { background: rgba(34,197,94,.15);  color: #15803d; }
.eval-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.eval-badge {
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
}
/* outcome_accuracy */
.eval-badge.badge-accuracy.accurate   { background: rgba(34,197,94,.15); color: #15803d; border-color: rgba(34,197,94,.3); }
.eval-badge.badge-accuracy.mixed      { background: rgba(234,179,8,.15);  color: #92400e; border-color: rgba(234,179,8,.3); }
.eval-badge.badge-accuracy.inaccurate { background: rgba(239,68,68,.15);  color: #b91c1c; border-color: rgba(239,68,68,.3); }
/* reasoning_quality */
.eval-badge.badge-reasoning.strong    { background: rgba(99,102,241,.15); color: #4338ca; border-color: rgba(99,102,241,.3); }
.eval-badge.badge-reasoning.partial   { background: rgba(234,179,8,.15);  color: #92400e; border-color: rgba(234,179,8,.3); }
.eval-badge.badge-reasoning.weak      { background: rgba(239,68,68,.15);  color: #b91c1c; border-color: rgba(239,68,68,.3); }
/* risk_calibration */
.eval-badge.badge-risk.well_calibrated  { background: rgba(6,182,212,.15); color: #0e7490; border-color: rgba(6,182,212,.3); }
.eval-badge.badge-risk.under_estimated  { background: rgba(239,68,68,.15); color: #b91c1c; border-color: rgba(239,68,68,.3); }
.eval-badge.badge-risk.over_estimated   { background: rgba(234,179,8,.15); color: #92400e; border-color: rgba(234,179,8,.3); }
/* default when value not matched */
.eval-badge { background: #e9ecef; color: #495057; border-color: #dee2e6; }

/* Metrics table */
.eval-metrics { overflow-x: auto; margin-bottom: 16px; }
.eval-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.eval-table th, .eval-table td {
  padding: 7px 12px;
  border: 1px solid #dee2e6;
  text-align: right;
  white-space: nowrap;
}
.eval-table th {
  background: #e9ecef;
  font-weight: 600;
  text-align: center;
  color: #495057;
}
.eval-table td.w-label { text-align: left; font-weight: 600; color: #2c3e50; }
.eval-table .upside   { color: #15803d; font-weight: 600; }
.eval-table .drawdown { color: #b91c1c; font-weight: 600; }
.partial-flag { font-size: 11px; color: #6c757d; font-weight: 400; margin-left: 4px; }

/* Validated / falsified points */
.eval-points-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}
.eval-points { padding: 10px 14px; border-radius: 8px; }
.eval-points.validated { background: rgba(34,197,94,.06); border: 1px solid rgba(34,197,94,.2); }
.eval-points.falsified { background: rgba(239,68,68,.06); border: 1px solid rgba(239,68,68,.2); }
.points-label { margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #374151; }
.eval-points ul { margin: 0; padding-left: 18px; }
.eval-points li { font-size: 13px; line-height: 1.6; color: #495057; }

/* Error diagnosis + improvement suggestions */
.eval-diagnosis-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}
.eval-points.diagnosis    { background: rgba(245,158,11,.06); border: 1px solid rgba(245,158,11,.25); }
.eval-points.suggestions  { background: rgba(59,130,246,.06); border: 1px solid rgba(59,130,246,.2); }

/* Narratives */
.eval-narratives { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
.eval-narrative { display: flex; gap: 10px; align-items: flex-start; font-size: 13px; line-height: 1.6; color: #495057; }
.narrative-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
  margin-top: 2px;
}
.narrative-tag.short { background: rgba(99,102,241,.15); color: #4338ca; }
.narrative-tag.mid   { background: rgba(6,182,212,.15);  color: #0e7490; }
.narrative-tag.long  { background: rgba(139,92,246,.15); color: #6d28d9; }

/* Summary + meta */
.eval-summary {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.6;
  color: #374151;
  font-weight: 500;
  padding: 10px 14px;
  background: rgba(102,126,234,.06);
  border-left: 3px solid #764ba2;
  border-radius: 0 6px 6px 0;
}
.eval-meta { margin: 8px 0 0; font-size: 11px; color: #9ca3af; }

@media (max-width: 600px) {
  .eval-points-row { grid-template-columns: 1fr; }
  .eval-diagnosis-row { grid-template-columns: 1fr; }
}
</style>