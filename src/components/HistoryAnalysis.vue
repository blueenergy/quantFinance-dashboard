<template>
  <div v-if="history && history.length > 0" class="history-section">
    <h4 style="margin-top:24px;">
      🕑 历史AI分析 
      <span v-if="unreadCount > 0" class="unread-badge">({{ unreadCount }} NEW)</span>
    </h4>
    <div v-for="(item, idx) in history" :key="item.timestamp || item.id || idx" 
         class="history-card" :class="{ 'unread': item.is_read === false }">
      <div class="history-header">
        <span class="stock-code">
          {{ item.symbol }}<span v-if="item.stock_name"> - {{ item.stock_name }}</span>
          <span v-if="item.is_read === false" class="new-tag">NEW</span>
        </span>
        <span class="history-date">{{ formatDateTime(item.created_at || item.timestamp) }}</span>
        <span :class="['mode-badge', modeClass(item.analysis_mode)]">{{ modeLabel(item.analysis_mode) }}</span>
        <span class="history-model">🧠 模型: <b>{{ item.model || 'unknown' }}</b></span>
      </div>
      <div class="history-body">
        <AnalysisDetailContent
          :analysis="item.analysis"
          :analysis-mode="item.analysis_mode"
          layout="stacked"
        />

        <!-- 评审流水线：默认折叠；正文在上，此处仅按需展开查看评审意见 / 初稿对照 -->
        <div v-if="item.analysis?.deep_review_pipeline" class="review-pipeline-outer">
          <div
            v-if="item.analysis.deep_review_pipeline.revision_failed"
            class="review-banner warn"
          >
            ⚠️ 修订稿生成失败，当前正文为<strong>初稿</strong>；以下为评审侧反馈（不可当作修订终稿）。
            <span v-if="item.analysis.deep_review_pipeline.revision_error" class="muted">
              （{{ item.analysis.deep_review_pipeline.revision_error }}）
            </span>
          </div>
          <div v-else class="review-final-hint">
            <span>
              上方字段为已采纳评审意见后的<strong>最终修订稿</strong>。
            </span>
            <button
              type="button"
              class="btn-toggle-thinking btn-review-detail"
              @click="toggleReviewDetail(item, idx)"
            >
              {{ reviewDetailOpen[itemKey(item, idx)] ? '收起' : '查看' }} 评审意见与初稿对照
            </button>
          </div>

          <div
            v-show="
              item.analysis.deep_review_pipeline.revision_failed ||
              reviewDetailOpen[itemKey(item, idx)]
            "
            class="review-pipeline"
          >
            <div
              v-if="!item.analysis.deep_review_pipeline.revision_failed"
              class="review-banner ok"
            >
              ✅ 评审摘要与问题清单、初稿对照（可选阅读）
            </div>

            <div v-if="item.analysis.deep_review_pipeline.review?.summary" class="review-summary">
              <span class="label">评审摘要：</span>
              {{ item.analysis.deep_review_pipeline.review.summary }}
              <span
                v-if="item.analysis.deep_review_pipeline.review.confidence_in_draft != null"
                class="muted"
              >
                （评审对初稿置信度 {{ item.analysis.deep_review_pipeline.review.confidence_in_draft }}/100）
              </span>
            </div>

            <div
              v-if="(item.analysis.deep_review_pipeline.review?.issues || []).length"
              class="review-issues"
            >
              <div class="label">评审问题清单（建设性意见）</div>
              <ul>
                <li
                  v-for="(iss, j) in item.analysis.deep_review_pipeline.review.issues"
                  :key="j"
                >
                  <span class="issue-id">#{{ iss.id || j + 1 }}</span>
                  <span :class="['sev', iss.severity]">{{ iss.severity }}</span>
                  <span class="cat">[{{ iss.category }}]</span>
                  {{ iss.problem }}
                  <span v-if="iss.suggestion" class="sug">→ {{ iss.suggestion }}</span>
                </li>
              </ul>
            </div>

            <div v-if="hasRevisionLog(item)" class="revision-log-block">
              <div class="label">修订响应 revision_log</div>
              <ul>
                <li v-for="(row, k) in item.analysis.revision_log" :key="k">
                  <code>{{ row.issue_id }}</code>
                  <span class="action">{{ row.action }}</span>
                  {{ row.note }}
                </li>
              </ul>
            </div>

            <div
              v-if="!item.analysis.deep_review_pipeline.revision_failed && pipelineDraft(item)"
              class="compare-toolbar"
            >
              <button
                type="button"
                class="btn-toggle-thinking"
                @click="toggleCompare(item, idx)"
              >
                {{ compareOpen[itemKey(item, idx)] ? '收起' : '展开' }} 初稿 / 修订稿 关键字段对照表
              </button>
            </div>

            <div
              v-if="compareOpen[itemKey(item, idx)] && !item.analysis.deep_review_pipeline.revision_failed"
              class="compare-table-wrap"
            >
              <table class="compare-table">
                <thead>
                  <tr>
                    <th>字段</th>
                    <th>初稿</th>
                    <th>修订稿</th>
                    <th>是否变化</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in compareRows(item)" :key="row.key">
                    <td>{{ row.label }}</td>
                    <td class="cell-draft">{{ row.draft }}</td>
                    <td class="cell-revised">{{ row.revised }}</td>
                    <td>{{ row.changed ? '是' : '否' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        <!-- Thinking Process Toggle -->
        <div v-if="item.analysis?.thought_process_raw" style="margin-top: 12px;">
           <div style="display: flex; gap: 8px; align-items: center;">
             <button @click="toggleThinking(item)" class="btn-toggle-thinking">
               🧠 {{ thinkingStates[item.id || idx] ? '隐藏' : '显示' }}思考过程 (CoT)
             </button>
             <button v-if="thinkingStates[item.id || idx]" @click="toggleMaximize(item)" class="btn-toggle-thinking">
               ⛶ {{ maximizingStates[item.id || idx] ? '缩小' : '全屏' }}
             </button>
           </div>
           
           <div v-if="thinkingStates[item.id || idx]" 
                class="thinking-box" 
                :class="{ 'maximized': maximizingStates[item.id || idx] }">
             <div v-if="maximizingStates[item.id || idx]" class="modal-close-bar">
                <button @click="toggleMaximize(item)" class="btn-close">❌ 关闭全屏</button>
             </div>
             <pre>{{ item.analysis.thought_process_raw }}</pre>
           </div>
           <!-- Modal Overlay Background if needed, but CSS fixed handles it -->
           <div v-if="maximizingStates[item.id || idx]" class="thinking-overlay" @click="toggleMaximize(item)"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch, ref } from 'vue'
import request from '../utils/request'
import AnalysisDetailContent from './AnalysisDetailContent.vue'

const props = defineProps({
  history: Array
})

const unreadCount = ref(0)
// Removed unused store import

// Watch history to mark read
watch(() => props.history, async (newVal) => {
  if (newVal && newVal.length > 0) {
    // 1. Count unread
    const unread = newVal.filter(h => h.is_read === false)
    unreadCount.value = unread.length
    
    // 2. Mark as read immediately (WeChat style: once viewed/loaded, mark read)
    // Or maybe debounce?
    if (unread.length > 0) {
       const ids = unread.map(h => h._id || h.id)
       try {
           // We need to call the mark-read API.
           // Authentication header is handled by request interceptor
           // NOTE: We should wait a bit or do it silently.
           await markRead(ids)
           // Update local state to remove badge after successful mark
           // setTimeout(() => {
           //    unreadCount.value = 0
           //    newVal.forEach(h => h.is_read = true) 
           // }, 2000)
       } catch (e) {
           console.error("Failed to mark read", e)
       }
    }
  }
}, { immediate: true })

async function markRead(ids) {
    // Call backend
    await request({ method: 'post', url: '/analyze/mark-read', data: ids })
}

function formatDateTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function modeLabel(mode) {
  return mode === 'multi_expert_v1' ? '多专家' : '经典'
}

function modeClass(mode) {
  return mode === 'multi_expert_v1' ? 'multi-expert' : 'classic'
}

const thinkingStates = reactive({})
const maximizingStates = reactive({})
/** 初稿/修订稿对照折叠：key = itemKey */
const compareOpen = reactive({})
/** 评审意见区块默认收起，只看最终稿的用户无需展开 */
const reviewDetailOpen = reactive({})

function itemKey(item, idx) {
  return String(item.id || item._id || item.timestamp || idx)
}

function pipelineDraft(item) {
  const p = item.analysis?.deep_review_pipeline
  if (!p || p.revision_failed) return null
  return p.draft || null
}

function revisedClean(item) {
  const a = item.analysis || {}
  const { deep_review_pipeline: _p, ...rest } = a
  return rest
}

function hasRevisionLog(item) {
  return Array.isArray(item.analysis?.revision_log) && item.analysis.revision_log.length > 0
}

function toggleCompare(item, idx) {
  const k = itemKey(item, idx)
  compareOpen[k] = !compareOpen[k]
}

function toggleReviewDetail(item, idx) {
  const k = itemKey(item, idx)
  if (k) {
    reviewDetailOpen[k] = !reviewDetailOpen[k]
  }
}

function truncate(s, n = 160) {
  if (s == null || s === '') return '—'
  const t = String(s)
  return t.length <= n ? t : `${t.slice(0, n)}…`
}

function fmtPoints(v) {
  if (Array.isArray(v)) return v.join('；') || '—'
  return v || '—'
}

function compareRows(item) {
  const d = pipelineDraft(item)
  const r = revisedClean(item)
  if (!d || !r) return []
  const keys = [
    { key: 'investment_advice', label: '投资建议' },
    { key: 'risk_level', label: '风险等级' },
    { key: 'confidence_score', label: '信心分数' },
    { key: 'technical_analysis', label: '技术面（节选）' },
    { key: 'quant_score_cross_check', label: '量化对照' },
    { key: 'key_points', label: '要点摘要' },
  ]
  return keys.map(({ key, label }) => {
    let dv = d[key]
    let rv = r[key]
    if (key === 'technical_analysis' || key === 'quant_score_cross_check') {
      dv = truncate(dv, 200)
      rv = truncate(rv, 200)
    }
    if (key === 'key_points') {
      dv = truncate(fmtPoints(dv), 200)
      rv = truncate(fmtPoints(rv), 200)
    }
    const changed = String(dv) !== String(rv)
    return { key, label, draft: dv ?? '—', revised: rv ?? '—', changed }
  })
}

function toggleThinking(item) {
  const key = item.id || item._id || item.timestamp
  if (key) {
      thinkingStates[key] = !thinkingStates[key]
      // Reset maximize when hiding
      if (!thinkingStates[key]) maximizingStates[key] = false
  }
}

function toggleMaximize(item) {
    const key = item.id || item._id || item.timestamp
    if (key) {
        maximizingStates[key] = !maximizingStates[key]
    }
}
</script>

<style scoped>
.history-section {
  margin-top: 24px;
  background: rgba(30,30,63,0.08);
  border-radius: 8px;
  padding: 12px 16px;
}
.history-section h4 {
  color: #8a2be2;
  font-size: 15px;
  margin-bottom: 10px;
}
.unread-badge {
    color: #f87171;
    font-size: 12px;
    margin-left: 8px;
    animation: flash 2s infinite;
}
@keyframes flash {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
}

.history-card {
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  position: relative;
  transition: border-color 0.3s;
}
.history-card.unread {
    border-left: 3px solid #f87171;
    background: linear-gradient(90deg, rgba(248, 113, 113, 0.05), transparent);
}
.new-tag {
    background: #f87171;
    color: white;
    font-size: 10px;
    padding: 2px 4px;
    border-radius: 4px;
    margin-left: 6px;
    vertical-align: middle;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  border-bottom: 1px solid #333;
  padding-bottom: 8px;
}
.stock-code {
  font-weight: bold;
  color: #eee;
  font-size: 14px;
}
.history-date {
  color: #888;
  font-size: 12px;
}
.history-model {
  font-size: 12px;
  color: #4ade80;
}
.mode-badge {
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  white-space: nowrap;
}
.mode-badge.classic {
  color: #e0e7ff;
  background: rgba(99, 102, 241, 0.14);
  border-color: rgba(129, 140, 248, 0.35);
}
.mode-badge.multi-expert {
  color: #ecfeff;
  background: rgba(6, 182, 212, 0.16);
  border-color: rgba(34, 211, 238, 0.38);
}
.history-body {
  font-size: 13px;
  color: #ddd;
}
.label {
  color: #888;
  margin-right: 6px;
}
.advice.buy { color: #f87171; }
.advice.sell { color: #4ade80; }
.advice.hold { color: #fbbf24; }

.risk.high { color: #f87171; }
.risk.medium { color: #fbbf24; }
.risk.low { color: #4ade80; }

.risk-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 8px;
}
.history-section ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.history-section li {
  margin-bottom: 8px;
  color: #b19cd9;
  font-size: 13px;
}
:deep(.analysis-field-card) {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(148, 163, 184, 0.2);
}

:deep(.expert-review-card) {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(148, 163, 184, 0.2);
}

:deep(.analysis-summary-item) {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(148, 163, 184, 0.2);
}

:deep(.expert-review-header h4),
:deep(.expert-review-card h5),
:deep(.analysis-field-card h5),
:deep(.analysis-field-card p),
:deep(.expert-review-header p),
:deep(.expert-review-card pre),
:deep(.analysis-summary-value),
:deep(.analysis-points-list li) {
  color: #ddd;
}

:deep(.expert-review-count),
:deep(.expert-review-chip) {
  color: #67e8f9;
}

:deep(.analysis-summary-label) {
  color: #9ca3af;
}

:deep(.analysis-points-list) {
  list-style: disc;
  margin: 0;
  padding-left: 18px;
}

.btn-toggle-thinking {
  background: none;
  border: 1px solid #4ade80;
  color: #4ade80;
  border-radius: 4px;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 12px;
  transition: all 0.2s;
}
.btn-toggle-thinking:hover {
  background: rgba(74, 222, 128, 0.1);
}
.thinking-box {
  margin-top: 8px;
  background: #1e1e1e;
  border-radius: 6px;
  padding: 12px;
  border: 1px solid #333;
  max-height: 300px;
  overflow-y: auto;
}
.thinking-box.maximized {
    position: fixed;
    top: 5vh;
    left: 5vw;
    width: 90vw;
    height: 90vh;
    max-height: none;
    z-index: 1000;
    box-shadow: 0 0 20px rgba(0,0,0,0.8);
    border: 1px solid #4ade80;
}
.thinking-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0,0,0,0.7);
    z-index: 999;
}
.modal-close-bar {
    position: sticky;
    top: 0;
    text-align: right;
    background: #1e1e1e;
    padding-bottom: 8px;
    margin-bottom: 8px;
    border-bottom: 1px solid #333;
}
.thinking-box pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: 'Fira Code', monospace;
  font-size: 13px;
  color: #d4d4d4;
  line-height: 1.5;
}
.btn-close {
    background: #f87171;
    color: white;
    border: none;
    padding: 4px 12px;
    border-radius: 4px;
    cursor: pointer;
}

.review-pipeline-outer {
  margin-top: 14px;
}
.review-final-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(30, 30, 50, 0.45);
  font-size: 13px;
  color: #c4b5fd;
}
.review-final-hint strong {
  color: #e9d5ff;
}
.btn-review-detail {
  flex-shrink: 0;
}

.review-pipeline {
  margin-bottom: 14px;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid #3d3d5c;
  background: rgba(138, 43, 226, 0.06);
}
.review-banner {
  font-size: 13px;
  margin-bottom: 8px;
  line-height: 1.4;
}
.review-banner.ok {
  color: #86efac;
}
.review-banner.warn {
  color: #fca5a5;
}
.review-banner .muted {
  color: #888;
  font-size: 12px;
}
.review-summary {
  margin-bottom: 8px;
  font-size: 13px;
  color: #e9e9f0;
}
.review-issues ul {
  margin: 6px 0 0 0;
  padding-left: 0;
}
.review-issues li {
  list-style: none;
  margin-bottom: 8px;
  padding-left: 8px;
  border-left: 2px solid #6366f1;
  color: #d4d4d8;
}
.issue-id {
  color: #a78bfa;
  margin-right: 6px;
  font-size: 12px;
}
.sev.high { color: #f87171; margin: 0 6px; font-size: 11px; text-transform: uppercase; }
.sev.medium { color: #fbbf24; margin: 0 6px; font-size: 11px; }
.sev.low { color: #94a3b8; margin: 0 6px; font-size: 11px; }
.cat { color: #64748b; margin-right: 6px; font-size: 12px; }
.sug { color: #93c5fd; display: block; margin-top: 4px; font-size: 12px; }
.revision-log-block {
  margin-top: 10px;
  font-size: 12px;
}
.revision-log-block code {
  background: #333;
  padding: 1px 6px;
  border-radius: 4px;
  margin-right: 8px;
}
.revision-log-block .action {
  color: #fbbf24;
  margin: 0 8px;
}
.compare-toolbar {
  margin-top: 10px;
}
.compare-table-wrap {
  margin-top: 10px;
  overflow-x: auto;
}
.compare-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.compare-table th,
.compare-table td {
  border: 1px solid #444;
  padding: 6px 8px;
  vertical-align: top;
}
.compare-table th {
  background: #2a2a2a;
  color: #aaa;
}
.cell-draft {
  color: #cbd5e1;
  max-width: 280px;
}
.cell-revised {
  color: #bbf7d0;
  max-width: 280px;
}
</style>
