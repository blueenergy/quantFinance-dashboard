<template>
  <div class="ai-analysis-history">

    <!-- ① 主功能：直接输入分析 -->
    <div class="deep-input-panel">
      <h3 class="history-title">🔍 个股深度分析</h3>
      <div class="input-row">
        <input
          v-model="inputSymbol"
          class="symbol-input"
          placeholder="输入股票代码，如 600519 或 600519.SH"
          @keyup.enter="submitAnalysis"
        />
        <div class="mode-toggle">
          <button
            :class="['mode-btn', { active: inputMode === 'classic' }]"
            @click="inputMode = 'classic'"
          >经典</button>
          <button
            :class="['mode-btn', { active: inputMode === 'multi_expert_v1' }]"
            @click="inputMode = 'multi_expert_v1'"
          >多专家</button>
        </div>
        <button
          class="btn-base btn-sm btn-gradient-purple"
          :disabled="!inputSymbol.trim() || submitLoading"
          @click="submitAnalysis"
        >
          {{ submitLoading ? '提交中...' : '开始分析' }}
        </button>
      </div>
      <div v-if="submitError" class="error-box submit-error">{{ submitError }}</div>
      <div v-if="submitStatusMsg" class="submit-status">{{ submitStatusMsg }}</div>
    </div>

    <!-- ② 内联分析结果 -->
    <div v-if="liveResult" class="live-result-panel">
      <div class="live-result-header flex-row-center flex-center-between">
        <div class="flex-row-center gap-sm">
          <span class="stock-code">{{ liveResult.stock_code }}</span>
          <span v-if="liveResult.stock_name" class="stock-name">{{ liveResult.stock_name }}</span>
          <span :class="['mode-badge', modeClass(liveResult.analysis_mode)]">{{ modeLabel(liveResult.analysis_mode) }}</span>
        </div>
        <div class="flex-row-center gap-xs">
          <button class="btn-base btn-sm btn-export-pdf" @click="exportToPdf(liveResult)">导出 PDF</button>
          <button class="btn-base btn-sm btn-gradient-gray" @click="liveResult = null">清除</button>
        </div>
      </div>
      <AnalysisDetailContent
        :analysis="liveResult.analysis"
        :analysis-mode="liveResult.analysis_mode"
        layout="grid"
        :show-mode="true"
      />
    </div>

    <!-- ③ 历史记录（折叠） -->
    <div class="history-section">
      <div class="history-toggle-row flex-row-center flex-center-between">
        <button class="history-toggle-btn" @click="historyExpanded = !historyExpanded">
          📋 历史记录 <span class="toggle-arrow" :class="{ open: historyExpanded }">▾</span>
        </button>
        <button @click="loadHistory" :disabled="loading" class="btn-base btn-sm btn-gradient-purple">
          {{ loading ? '加载中...' : '刷新' }}
        </button>
      </div>

      <div v-show="historyExpanded">

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>正在加载分析历史...</p>
    </div>

    <div v-if="error" class="error-box">
      <p>{{ error }}</p>
      <button @click="clearError" class="btn-base btn-sm btn-gradient-red">清除错误</button>
    </div>

    <div v-if="!loading && historyList.length === 0" class="empty">
      <p>暂无历史记录</p>
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

      </div><!-- end v-show historyExpanded -->
    </div><!-- end history-section -->

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
          <button
            @click="exportToPdf(selectedItem)"
            class="btn-base btn-sm btn-export-pdf"
          >导出 PDF</button>
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

// 主输入区状态
const inputSymbol = ref('')
const inputMode = ref('multi_expert_v1')
const submitLoading = ref(false)
const submitError = ref('')
const submitStatusMsg = ref('')
const liveResult = ref(null)
const historyExpanded = ref(false)
let livePollTimer = null

async function submitAnalysis() {
  const sym = inputSymbol.value.trim()
  if (!sym) return
  clearInterval(livePollTimer)
  submitLoading.value = true
  submitError.value = ''
  submitStatusMsg.value = ''
  liveResult.value = null
  const token = localStorage.getItem('access_token')
  try {
    const res = await axios.post(
      '/api/analyze/deep-analysis',
      { symbol: sym, priority: 30, analysis_mode: inputMode.value },
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!res.data?.success) {
      submitError.value = res.data?.message || '提交失败'
      submitLoading.value = false
      return
    }
    const taskId = res.data.task_id
    const pos = res.data.position_in_queue
    submitStatusMsg.value = `已提交，排队第 ${pos ?? '?'} 位，分析中…`
    let tries = 0
    livePollTimer = setInterval(async () => {
      tries++
      if (tries > 120) {
        clearInterval(livePollTimer)
        submitStatusMsg.value = '等待超时，请稍后在历史记录中查看'
        submitLoading.value = false
        return
      }
      try {
        const poll = await axios.get(`/api/analyze/task/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const st = poll.data?.status
        if (st === 'completed') {
          clearInterval(livePollTimer)
          submitStatusMsg.value = ''
          submitLoading.value = false
          const analysis = poll.data?.analysis || {}
          const analysisMode = poll.data?.analysis_mode || analysis.analysis_mode || 'classic'
          liveResult.value = {
            stock_code: sym,
            stock_name: analysis.stock_name || '',
            analysis_mode: analysisMode,
            analysis: { ...analysis, analysis_mode: analysisMode },
            // 供 exportToPdf 使用
            analysis_result: {},
          }
          loadHistory()
        } else if (st === 'failed' || st === 'completed_with_parse_error') {
          clearInterval(livePollTimer)
          submitError.value = poll.data?.error || '分析失败'
          submitStatusMsg.value = ''
          submitLoading.value = false
        }
      } catch (_) { /* 继续轮询 */ }
    }, 3000)
  } catch (e) {
    submitError.value = e.response?.data?.detail || e.message || '提交失败'
    submitLoading.value = false
  }
}

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

function exportToPdf(item) {
  if (!item) return
  const a = item.analysis || {}
  const ar = item.analysis_result || {}

  // ── 基础信息 ──────────────────────────────────────────────────────────
  const stockCode = item.stock_code || '—'
  const stockName = item.stock_name || ''
  const createdAt = item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : '—'
  const modeText = item.analysis_mode === 'multi_expert_v1' ? '多专家协作' : '经典'
  const industry = a.industry || ar.industry || '—'

  const ADVICE_MAP = { strong_buy:'强烈买入', buy:'买入', hold:'持有', sell:'卖出', strong_sell:'强烈卖出' }
  const investAdvice = ADVICE_MAP[a.investment_advice] || a.investment_advice || '—'
  const riskLevel = a.risk_level || '—'
  const confidenceScore = a.confidence_score != null ? `${a.confidence_score}%` : '—'
  const currentPrice = a.price ? `${a.price} 元` : '—'

  // 止损 / 目标价（risk_price_levels 结构化 > support/resistance 文本）
  const rpl = (typeof a.risk_price_levels === 'object' && a.risk_price_levels) ? a.risk_price_levels : {}
  const stopLoss       = rpl.stop_loss       ? `${rpl.stop_loss} 元`        : (a.support_level   || '—')
  const stopLossStrong = rpl.stop_loss_strong ? `${rpl.stop_loss_strong} 元` : '—'
  const target1        = rpl.target_1        ? `${rpl.target_1} 元`         : (a.resistance_level || '—')
  const target2        = rpl.target_2        ? `${rpl.target_2} 元`         : '—'

  // ── 专家报告 ───────────────────────────────────────────────────────────
  const EXPERT_ORDER = ['cycle', 'fundamental', 'growth', 'technical', 'risk']
  const EXPERT_LABEL = {
    cycle:'行业周期专家', fundamental:'基本面专家',
    growth:'成长性专家', technical:'技术面专家', risk:'风险专家',
  }
  const reports = a.module_reports || {}
  const expertKeys = [
    ...EXPERT_ORDER.filter(k => reports[k]),
    ...Object.keys(reports).filter(k => !EXPERT_ORDER.includes(k)),
  ]

  // ── HTML 辅助函数 ──────────────────────────────────────────────────────
  function esc(s) {
    if (s == null) return ''
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  }
  function h2(num, text) {
    return `<h2 class="ch"><span class="ch-num">${esc(num)}</span>${esc(text)}</h2>`
  }
  function infoRow(label, value) {
    const empty = value == null || value === '' || value === '—'
    return `<tr><th>${esc(label)}</th><td${empty ? ' class="na"' : ''}>${empty ? '—' : esc(String(value))}</td></tr>`
  }
  function infoTable(rowsHtml) {
    return `<table class="info-table"><tbody>${rowsHtml}</tbody></table>`
  }
  function textBlock(content) {
    if (!content) return '<p class="na">（暂无）</p>'
    return `<div class="text-block">${esc(content)}</div>`
  }
  function listBlock(items) {
    if (!Array.isArray(items) || !items.length) return '<p class="na">（暂无）</p>'
    const li = items.map(x => {
      const t = typeof x === 'string' ? x : (x.point || x.text || JSON.stringify(x))
      return `<li>${esc(t)}</li>`
    }).join('')
    return `<ul>${li}</ul>`
  }
  function sectionNote(text) {
    return `<p class="note">${esc(text)}</p>`
  }

  // ── 财务历史表 ─────────────────────────────────────────────────────────
  const chartData = Array.isArray(a.financial_chart_data) ? a.financial_chart_data : []
  let finHtml = ''
  let cagrNote = ''
  if (chartData.length) {
    const rows = chartData.map(d => {
      const rev = d.revenue   != null ? (d.revenue   / 1e8).toFixed(2) : '—'
      const np  = d.net_profit != null ? (d.net_profit / 1e8).toFixed(2) : '—'
      const ry  = d.tr_yoy         != null ? d.tr_yoy         : '—'
      const ny  = d.netprofit_yoy  != null ? d.netprofit_yoy  : '—'
      const gm  = d.grossprofit_margin != null ? d.grossprofit_margin : '—'
      const roe = d.roe        != null ? d.roe        : '—'
      return `<tr>
        <td>${esc(d.period)}</td><td>${esc(rev)}</td><td>${esc(np)}</td>
        <td>${esc(String(ry))}</td><td>${esc(String(ny))}</td>
        <td>${esc(String(gm))}</td><td>${esc(String(roe))}</td>
      </tr>`
    }).join('')
    finHtml = `<table class="fin-table">
      <thead><tr>
        <th>期间</th><th>营收（亿）</th><th>归母净利润（亿）</th>
        <th>营收YoY%</th><th>净利YoY%</th><th>毛利率%</th><th>ROE%</th>
      </tr></thead><tbody>${rows}</tbody>
    </table>`
    // 粗略 CAGR
    const first = chartData[0], last = chartData[chartData.length - 1]
    if (first?.revenue && last?.revenue && first.revenue > 0 && chartData.length >= 4) {
      const yrs = (chartData.length / 4).toFixed(1)
      const c = ((Math.pow(last.revenue / first.revenue, 1 / parseFloat(yrs)) - 1) * 100).toFixed(1)
      cagrNote = `近 ${chartData.length} 期营收年化复合增速约 ${c}%（粗估，供参考）`
    }
  } else {
    finHtml = '<p class="na">（无结构化财务数据，详见专家分析）</p>'
  }

  // ── SWOT（共识 → S/O，分歧 → W/T）────────────────────────────────────
  const consensus  = Array.isArray(a.consensus_points)  ? a.consensus_points  : []
  const divergence = Array.isArray(a.divergence_points) ? a.divergence_points : []
  const mid = arr => Math.ceil(arr.length / 2)
  const swotS = consensus.slice(0, mid(consensus))
  const swotO = consensus.slice(mid(consensus))
  const swotW = divergence.slice(0, mid(divergence))
  const swotT = divergence.slice(mid(divergence))
  function swotCell(letter, color, title, items) {
    const li = items.length
      ? items.map(x => `<li>${esc(typeof x==='string'?x:(x.point||x.text||''))}</li>`).join('')
      : '<li class="na">（暂无）</li>'
    return `<div class="swot-cell" style="border-top:3px solid ${color}">
      <span class="swot-letter" style="color:${color}">${letter}</span>
      <span class="swot-title">${title}</span>
      <ul>${li}</ul>
    </div>`
  }

  // ── 专家报告块 ─────────────────────────────────────────────────────────
  const expertHtml = expertKeys.map(k => {
    const r = reports[k]
    const content = typeof r === 'string' ? r : (r?.content || r?.report || JSON.stringify(r, null, 2))
    return `<div class="expert-block">
      <div class="expert-title">${esc(EXPERT_LABEL[k] || k)}</div>
      <pre>${esc(content)}</pre>
    </div>`
  }).join('')

  // 风险专家单独用于第十三章
  const riskReport = (() => {
    const r = reports['risk']
    if (!r) return null
    return typeof r === 'string' ? r : (r?.content || r?.report || null)
  })()

  // ── 量化评分快照 ────────────────────────────────────────────────────────
  const qsTag = a.quant_score_snapshot_tag || ''
  const qsCross = a.quant_score_cross_check || ''

  // ── 完整 HTML 报告 ─────────────────────────────────────────────────────
  const pageTitle = `${stockCode}${stockName ? ' ' + stockName : ''} 投研报告`

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${esc(pageTitle)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;
     font-size:12.5px;color:#0f172a;line-height:1.8;padding:14mm 18mm 20mm}
/* ── 封面 ── */
.cover{text-align:center;padding:20mm 0 14mm;border-bottom:2px solid #1e3a8a;margin-bottom:10mm}
.cover-badge{font-size:12px;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px}
.cover-name{font-size:28px;font-weight:900;color:#1e3a8a;margin:4px 0 12px}
.cover-rating{display:inline-block;background:#1e3a8a;color:#fff;
              padding:5px 22px;border-radius:999px;font-size:14px;font-weight:700}
.cover-meta{margin-top:14px;font-size:11.5px;color:#64748b;line-height:2}
/* ── 章节标题 ── */
h2.ch{font-size:13.5px;font-weight:800;color:#1e293b;
       margin:14px 0 8px;border-bottom:1.5px solid #e2e8f0;padding-bottom:4px}
.ch-num{display:inline-block;background:#1e3a8a;color:#fff;border-radius:3px;
        padding:1px 8px;font-size:11px;font-weight:700;margin-right:8px}
/* ── 信息表 ── */
.info-table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:12px}
.info-table th{width:30%;background:#f8fafc;color:#475569;font-weight:600;
               padding:5px 8px;border:1px solid #e2e8f0;white-space:nowrap;text-align:left}
.info-table td{padding:5px 8px;border:1px solid #e2e8f0;color:#0f172a}
.info-table td.na{color:#94a3b8}
/* ── 财务历史表 ── */
.fin-table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:6px}
.fin-table thead th{background:#1e3a8a;color:#fff;padding:4px 6px;text-align:center}
.fin-table tbody td{padding:4px 6px;border:1px solid #e2e8f0;text-align:center}
.fin-table tbody tr:nth-child(even) td{background:#f8fafc}
/* ── 文本块 ── */
.text-block{white-space:pre-wrap;font-size:12px;color:#1e293b;
            background:#f8fafc;padding:8px 10px;border-radius:4px;
            border-left:3px solid #6366f1;margin-bottom:8px}
ul{padding-left:18px;margin-bottom:8px}
ul li{margin-bottom:2px;font-size:12px}
p.na{color:#94a3b8;font-size:12px;font-style:italic;margin-bottom:8px}
p.note{font-size:11px;color:#94a3b8;font-style:italic;margin-bottom:6px}
/* ── SWOT ── */
.swot-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
.swot-cell{padding:8px 10px;background:#f8fafc;border-radius:4px}
.swot-letter{font-size:18px;font-weight:900;margin-right:6px}
.swot-title{font-size:12px;font-weight:700;color:#334155;display:block;margin-bottom:4px}
.swot-cell ul{margin:0}
/* ── 专家报告 ── */
.expert-block{margin-bottom:12px;page-break-inside:avoid}
.expert-title{font-weight:700;font-size:12.5px;background:#1e3a8a;color:#fff;
              padding:4px 10px;border-radius:3px;margin-bottom:5px}
pre{white-space:pre-wrap;word-break:break-word;font-family:inherit;
    font-size:11.5px;color:#1e293b}
/* ── 免责声明 ── */
.disclaimer{font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;
            margin-top:18px;padding-top:8px;line-height:1.6}
@media print{
  body{padding:8mm 12mm 12mm}
  .cover{padding:10mm 0 8mm;margin-bottom:5mm}
  .cover-name{font-size:22px}
  .expert-block{page-break-inside:avoid}
}
</style>
</head>
<body>

<!-- ══ 封面 ══════════════════════════════════════════════════════════ -->
<div class="cover">
  <div class="cover-badge">AI 投研报告 · ${esc(modeText)}模式</div>
  <div class="cover-name">${esc(stockName || stockCode)}（${esc(stockCode)}）</div>
  <div class="cover-rating">${esc(investAdvice)}</div>
  <div class="cover-meta">
    研究日期：${esc(createdAt)}<br>
    行业板块：${esc(industry)} &nbsp;|&nbsp; 风险等级：${esc(riskLevel)}
  </div>
</div>

<!-- ══ 一、报告核心信息 ════════════════════════════════════════════════ -->
${h2('一', '报告核心信息')}
${infoTable(
  infoRow('股票名称 / 代码', `${stockName}（${stockCode}）`) +
  infoRow('研究日期', createdAt) +
  infoRow('行业板块', industry) +
  infoRow('最新股价', currentPrice) +
  infoRow('投资评级', investAdvice) +
  infoRow('止损参考', stopLoss) +
  infoRow('强止损参考', stopLossStrong) +
  infoRow('目标价 T1', target1) +
  infoRow('目标价 T2', target2) +
  infoRow('风险等级', riskLevel) +
  infoRow('分析置信度', confidenceScore) +
  infoRow('分析模式', modeText)
)}

<!-- ══ 二、核心结论 ═══════════════════════════════════════════════════ -->
${h2('二', '核心结论')}
${textBlock(a.final_conclusion)}

<!-- ══ 三、市场行情 ═══════════════════════════════════════════════════ -->
${h2('三', '市场行情与价格区间')}
${infoTable(
  infoRow('最新收盘价', currentPrice) +
  infoRow('支撑位（技术）', a.support_level) +
  infoRow('压力位（技术）', a.resistance_level) +
  infoRow('系统止损位', stopLoss) +
  infoRow('系统强止损位', stopLossStrong) +
  infoRow('目标价 T1', target1) +
  infoRow('目标价 T2', target2)
)}

<!-- ══ 四、估值分析 ═══════════════════════════════════════════════════ -->
${h2('四', '估值分析')}
${textBlock(a.valuation_analysis || null)}
${sectionNote('估值详情请参阅第十一章·基本面专家报告')}

<!-- ══ 五、财务分析（历史数据） ════════════════════════════════════════ -->
${h2('五', '财务分析（历史数据）')}
${finHtml}
${cagrNote ? `<p class="note">${esc(cagrNote)}</p>` : ''}

<!-- ══ 六、成长性分析 ════════════════════════════════════════════════ -->
${h2('六', '成长性分析')}
${textBlock(a.growth_assessment)}
${a.key_points && a.key_points.length ? '<p style="font-weight:600;font-size:12px;margin-bottom:4px">关键点：</p>' + listBlock(a.key_points) : ''}

<!-- ══ 七、技术面分析 ════════════════════════════════════════════════ -->
${h2('七', '技术面分析')}
${textBlock(a.technical_analysis)}
${infoTable(
  infoRow('短期展望', a.short_term_forecast) +
  infoRow('中期展望', a.mid_term_forecast) +
  infoRow('长期展望', a.long_term_forecast)
)}

<!-- ══ 八、资金流向与股东结构 ════════════════════════════════════════ -->
${h2('八', '资金流向与股东结构')}
${textBlock(a.equity_risk_user_visible || a.institutional_deep_user_visible)}

<!-- ══ 九、行业周期 ══════════════════════════════════════════════════ -->
${h2('九', '行业周期分析')}
${textBlock(a.industry_cycle_assessment)}
${sectionNote('申万行业月线详见第十一章·行业周期专家报告')}

<!-- ══ 十、SWOT 分析 ══════════════════════════════════════════════════ -->
${h2('十', 'SWOT 分析')}
<div class="swot-grid">
  ${swotCell('S','#16a34a','优势 Strengths（来自共识观点）', swotS)}
  ${swotCell('W','#dc2626','劣势 Weaknesses（来自分歧观点）', swotW)}
  ${swotCell('O','#2563eb','机会 Opportunities（来自共识观点）', swotO)}
  ${swotCell('T','#d97706','威胁 Threats（来自分歧观点）', swotT)}
</div>
${sectionNote('S/O 源自共识观点前半/后半，W/T 源自分歧观点前半/后半，仅作参考。')}

<!-- ══ 十一、专家报告 ════════════════════════════════════════════════ -->
${expertKeys.length ? h2('十一', '专家报告（多专家协作）') + expertHtml : ''}

<!-- ══ 十二、综合评分与投资建议 ════════════════════════════════════════ -->
${h2('十二', '综合评分与投资建议')}
${infoTable(
  infoRow('投资评级', investAdvice) +
  infoRow('风险等级', riskLevel) +
  infoRow('分析置信度', confidenceScore) +
  infoRow('止损位', stopLoss) +
  infoRow('强止损位', stopLossStrong) +
  infoRow('目标价 T1', target1) +
  infoRow('目标价 T2', target2) +
  infoRow('量化评分快照', qsTag || '—') +
  infoRow('量化交叉验证', qsCross || '—')
)}

<!-- ══ 十三、核心风险提示 ════════════════════════════════════════════ -->
${h2('十三', '核心风险提示')}
${riskReport ? textBlock(riskReport) : listBlock(divergence)}

<!-- ══ 免责声明 ═══════════════════════════════════════════════════════ -->
<div class="disclaimer">
  <strong>免责声明：</strong>本报告由 AI 系统（${esc(modeText)}模式）自动生成，仅供研究参考，
  不构成任何投资建议或投资邀约。报告中的数据、分析及观点均基于历史数据和模型推断，
  存在较大不确定性，且可能存在误差。市场有风险，投资需谨慎。
  投资者应结合自身风险承受能力，独立作出投资决策并自行承担相应后果。
</div>

</body></html>`

  const win = window.open('', '_blank')
  if (!win) { alert('请允许弹出窗口以导出PDF'); return }
  win.document.write(html)
  win.document.close()
  win.onload = () => { win.focus(); win.print() }
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
        priority: 30,
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
.history-title { margin:0 0 16px; font-size:22px; font-weight:700; color:#2c3e50; }

/* 主输入区 */
.deep-input-panel { margin-bottom:20px; }
.input-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.symbol-input {
  flex:1; min-width:200px; max-width:340px;
  padding:8px 14px; border-radius:8px;
  border:1px solid #ced4da; font-size:15px;
  outline:none; transition:.2s;
}
.symbol-input:focus { border-color:#764ba2; box-shadow:0 0 0 3px rgba(118,75,162,.12); }
.mode-toggle { display:flex; gap:0; border:1px solid #ced4da; border-radius:8px; overflow:hidden; }
.mode-btn {
  padding:6px 14px; font-size:13px; font-weight:600;
  border:none; background:#f8f9fa; color:#6c757d; cursor:pointer; transition:.15s;
}
.mode-btn.active { background:#764ba2; color:#fff; }
.mode-btn:hover:not(.active) { background:#e9ecef; }
.submit-error { margin-top:10px; }
.submit-status {
  margin-top:10px; padding:8px 14px; border-radius:8px;
  background:rgba(99,102,241,.08); color:#4338ca;
  font-size:13px; border:1px solid rgba(129,140,248,.25);
}

/* 内联结果区 */
.live-result-panel {
  margin-bottom:20px; border:1px solid rgba(118,75,162,.2);
  border-radius:10px; overflow:hidden;
}
.live-result-header {
  padding:12px 16px;
  background:linear-gradient(135deg,rgba(102,126,234,.1) 0%,rgba(118,75,162,.1) 100%);
  border-bottom:1px solid rgba(118,75,162,.15);
}

/* 历史折叠 */
.history-section { margin-top:8px; }
.history-toggle-row { margin-bottom:10px; }
.history-toggle-btn {
  background:none; border:none; cursor:pointer;
  font-size:15px; font-weight:600; color:#495057;
  padding:4px 0; display:flex; align-items:center; gap:6px;
}
.history-toggle-btn:hover { color:#764ba2; }
.toggle-arrow { display:inline-block; transition:transform .2s; font-size:14px; }
.toggle-arrow.open { transform:rotate(180deg); }
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
.btn-export-pdf {
  margin-left: 8px;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(52, 211, 153, 0.35);
  color: #6ee7b7;
}
.btn-export-pdf:hover {
  background: rgba(16, 185, 129, 0.24);
}
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