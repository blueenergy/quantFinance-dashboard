<template>
  <section class="card loop-panel">
    <div class="section-title-row">
      <div>
        <p class="section-kicker">自动化流程 · Loop 维度</p>
        <h3>自动迭代 Loop</h3>
      </div>
      <div class="title-actions">
        <span class="type-badge loop-badge">Loop 流程</span>
        <button type="button" class="mini-btn" @click="emit('update:expanded', !expanded)">
          {{ expanded ? '收起 Loop' : '展开 Loop' }}
        </button>
      </div>
    </div>
    <div v-if="!expanded" class="panel-summary">
      <span>{{ loopHealthStatusText }}</span>
      <span>Loop：{{ loops.length }} 条</span>
      <span v-if="selectedLoop">当前：{{ selectedLoop.status }} · {{ loopStepLabel(selectedLoop.current_step) }}</span>
      <span v-else>未选中 Loop</span>
    </div>
    <div v-show="expanded" class="panel-body">
      <p class="subtitle">一条 Loop 会串联多次批量实验：批量完成 → AI 复盘 → 应用建议参数 → 再测，直到达到停止规则或最大轮数。</p>
      <div class="loop-health-panel" :class="{ unhealthy: loopHealth && !loopHealth.auto_advance_available }">
        <div>
          <strong>自动推进状态</strong>
          <span>{{ loopHealthStatusText }}</span>
        </div>
        <div class="loop-health-meta">
          <span>scheduler：{{ loopHealth?.scheduler_online ? '在线' : '离线/未知' }}</span>
          <span>tick：{{ loopHealth?.tick_enabled ? '启用' : '禁用' }} / {{ loopHealth?.tick_loaded ? '已加载' : '未加载' }}</span>
          <span>运行中 Loop：{{ loopHealth?.active_loop_count ?? '-' }}</span>
          <span v-if="loopHealth?.heartbeat_age_seconds !== null && loopHealth?.heartbeat_age_seconds !== undefined">
            心跳 {{ Math.round(loopHealth.heartbeat_age_seconds) }}s 前
          </span>
        </div>
      </div>
      <div class="form-grid">
        <label>
          最大轮数
          <input v-model.number="loopForm.max_iterations" type="number" min="1" max="20" />
        </label>
        <label>
          复盘目标
          <input v-model="loopForm.objective" placeholder="提高收益并控制回撤" />
        </label>
        <label>
          最低完成率
          <input v-model.number="loopForm.min_completion_rate" type="number" min="0" max="1" step="0.05" />
        </label>
      </div>
      <div class="actions">
        <button class="primary" :disabled="loopSubmitting" @click="() => startAutoLoop()">从上方配置启动</button>
        <button
          :disabled="!canStartLoopFromBatch || loopSubmitting"
          :title="startLoopFromBatchHint"
          @click="() => startAutoLoopFromBatch()"
        >
          从当前实验启动
        </button>
        <button :disabled="!selectedLoopId" @click="refreshSelectedLoop">刷新 Loop</button>
        <span v-if="loopMessage" class="message">{{ loopMessage }}</span>
      </div>
      <div class="loop-layout" v-if="loops.length">
        <aside class="loop-list">
          <div class="list-caption">
            <strong>Loop 列表</strong>
            <span>每条代表一组自动迭代流程</span>
          </div>
          <button
            v-for="loop in loops"
            :key="loop.loop_id"
            class="batch-row loop-row"
            :class="{ active: selectedLoopId === loop.loop_id }"
            @click="selectLoop(loop.loop_id)"
          >
            <span class="row-type">Loop</span>
            <strong>{{ loop.name || loop.loop_id }}</strong>
            <small>流程状态：{{ loop.status }} · 第 {{ loop.current_iteration }}/{{ loop.max_iterations }} 轮 · {{ loopStepLabel(loop.current_step) }}</small>
          </button>
        </aside>
        <div class="loop-detail" v-if="selectedLoop">
          <div class="detail-actions">
            <button
              v-if="selectedLoop.status === 'running'"
              :disabled="loopSubmitting"
              @click="() => pauseSelectedLoop()"
            >
              暂停
            </button>
            <button
              v-if="selectedLoop.status === 'paused'"
              :disabled="loopSubmitting"
              @click="() => resumeSelectedLoop()"
            >
              继续
            </button>
            <button
              v-if="canManageActiveLoop"
              :disabled="loopSubmitting"
              @click="() => cancelSelectedLoop()"
            >
              取消 Loop
            </button>
            <button
              v-if="canAdvanceLoop"
              :disabled="loopSubmitting"
              title="推进一轮：批量完成 → 复盘 → 再测"
              @click="() => advanceSelectedLoop()"
            >
              手动推进
            </button>
            <button
              class="danger"
              :disabled="!canDeleteSelectedLoop || loopSubmitting"
              :title="canDeleteSelectedLoop ? '只删除 Loop 历史记录，不删除关联的批量实验' : '运行中/暂停中的 Loop 需要先取消或完成后才能删除'"
              @click="() => deleteSelectedLoop()"
            >
              删除历史 Loop
            </button>
          </div>
          <div v-if="pendingDeleteLoop" class="inline-confirm danger-confirm">
            <strong>确认删除历史 Loop「{{ pendingDeleteLoop.name }}」？</strong>
            <p>只删除 Loop 流程记录，不删除关联的批量实验和回测结果。</p>
            <div class="confirm-actions">
              <button class="danger" :disabled="loopSubmitting" @click="() => confirmDeleteSelectedLoop()">
                确认删除
              </button>
              <button :disabled="loopSubmitting" @click="emit('update:pendingDeleteLoop', null)">取消</button>
            </div>
          </div>
          <p v-if="selectedLoop.stop_reason" class="message">停止原因：{{ selectedLoop.stop_reason }}</p>
          <section class="loop-wait-panel" v-if="loopSummary?.waiting_reason">
            <strong>当前等待：{{ loopSummary.waiting_reason }}</strong>
            <p>{{ loopSummary.waiting_detail }}</p>
            <div class="loop-health-meta" v-if="loopSummary.waiting_status_counts">
              <span>pending：{{ loopSummary.waiting_status_counts.pending || 0 }}</span>
              <span>claimed：{{ loopSummary.waiting_status_counts.claimed || 0 }}</span>
              <span>running：{{ loopSummary.waiting_status_counts.running || 0 }}</span>
              <span>completed：{{ loopSummary.waiting_status_counts.completed || 0 }}</span>
              <span>failed：{{ loopSummary.waiting_status_counts.failed || 0 }}</span>
            </div>
            <div class="loop-review-task-box" v-if="loopSummary.waiting_review_task">
              <strong>AI 复盘任务</strong>
              <div class="loop-health-meta">
                <span>状态：{{ loopSummary.waiting_review_task.status }}</span>
                <span>任务：{{ loopSummary.waiting_review_task.task_id || '-' }}</span>
                <span>Worker：{{ loopSummary.waiting_review_task.worker_id || '-' }}</span>
                <span>创建：{{ formatDateTime(loopSummary.waiting_review_task.created_at) }}</span>
                <span>更新：{{ formatDateTime(loopSummary.waiting_review_task.updated_at) }}</span>
                <span>结果文档：{{ loopSummary.waiting_review_doc_exists ? '已写入' : '未写入' }}</span>
              </div>
              <p v-if="loopSummary.waiting_review_task.error" class="error">
                {{ loopSummary.waiting_review_task.error }}
              </p>
            </div>
            <p v-else-if="loopSummary.current_step === 'wait_review'" class="muted">
              尚未找到 AI 复盘任务记录；可能还没入队，或任务记录写入异常。
            </p>
            <button
              v-if="loopSummary.current_batch_id"
              type="button"
              class="mini-btn"
              @click="() => selectBatch(loopSummary.current_batch_id)"
            >
              查看当前轮实验
            </button>
          </section>
          <section class="loop-final-report-panel" v-if="loopSummary">
            <h4>AI 综合结论</h4>
            <p v-if="loopSummary.final_report_status === 'pending'" class="muted">
              正在由 quantAnalyzer 生成跨轮综合报告，通常需 1-3 分钟。请稍后点击「刷新 Loop」查看。
            </p>
            <p v-else-if="loopSummary.final_report_status === 'failed'" class="message">
              综合报告生成失败：{{ loopSummary.final_report_error || '未知错误' }}
              <button type="button" class="mini-btn" @click="() => requestLoopFinalReport(true)">重试</button>
            </p>
            <template v-else-if="loopSummary.has_final_report_content">
              <p class="report-lead">{{ loopSummary.final_report.summary }}</p>
              <p v-if="loopSummary.final_report.best_iteration" class="muted">
                相对最优：第 {{ loopSummary.final_report.best_iteration }} 轮
                <span v-if="loopSummary.final_report.best_iteration_reason">
                  - {{ loopSummary.final_report.best_iteration_reason }}
                </span>
              </p>
              <div v-if="loopSummary.final_report.iteration_comparison?.length" class="report-block">
                <strong>各轮对比</strong>
                <ul>
                  <li
                    v-for="(item, idx) in loopSummary.final_report.iteration_comparison"
                    :key="item.batch_id || item.iteration || idx"
                  >
                    第 {{ item.iteration }} 轮（{{ item.batch_id || '-' }}）：{{ item.verdict }}
                    <span v-if="item.metric_note" class="param-desc"> - {{ item.metric_note }}</span>
                  </li>
                </ul>
              </div>
              <div v-if="loopSummary.final_report.main_findings?.length" class="report-block">
                <strong>主要发现</strong>
                <ul>
                  <li v-for="(item, idx) in loopSummary.final_report.main_findings" :key="idx">{{ item }}</li>
                </ul>
              </div>
              <div v-if="loopSummary.final_report.lessons_learned?.length" class="report-block">
                <strong>经验总结</strong>
                <ul>
                  <li v-for="(item, idx) in loopSummary.final_report.lessons_learned" :key="idx">{{ item }}</li>
                </ul>
              </div>
              <div
                v-if="loopSummary.final_report.recommended_params && Object.keys(loopSummary.final_report.recommended_params).length"
                class="report-block"
              >
                <strong>推荐参数</strong>
                <ul>
                  <li
                    v-for="(val, key) in loopSummary.final_report.recommended_params"
                    :key="key"
                  >
                    {{ key }} = {{ formatParamDisplay(val) }}
                  </li>
                </ul>
              </div>
              <div v-if="loopSummary.final_report.next_steps?.length" class="report-block">
                <strong>后续建议</strong>
                <ul>
                  <li v-for="(item, idx) in loopSummary.final_report.next_steps" :key="idx">{{ item }}</li>
                </ul>
              </div>
            </template>
            <p v-else-if="loopSummary.can_request_final_report" class="muted">
              Loop 已完成，可生成跨 {{ loopSummary.iterations?.length || 0 }} 轮的综合 AI 结论。
              <button type="button" class="mini-btn primary-mini" @click="() => requestLoopFinalReport(true)">
                生成综合结论
              </button>
            </p>
            <p v-else class="muted">
              暂无综合结论。
              <button
                v-if="loopSummary.can_request_final_report"
                type="button"
                class="mini-btn primary-mini"
                @click="() => requestLoopFinalReport(true)"
              >
                生成综合结论
              </button>
            </p>
          </section>
          <p v-else-if="loopSummaryLoading" class="muted">加载迭代总结...</p>
          <p v-else-if="selectedLoopId && !loopSummary" class="muted">
            迭代总结未加载，请点「刷新 Loop」重试。
          </p>
          <section class="loop-summary-panel" v-if="loopSummary">
            <h4>迭代总结（{{ loopSummary.iterations?.length || 0 }} 轮回测）</h4>
            <p v-if="loopSummary.is_terminal" class="muted">
              各轮完整 AI 复盘可在下方实验列表中点开对应 batch 查看；此处汇总各轮批量指标与复盘摘要。
            </p>
            <table class="params-table loop-summary-table" v-if="loopSummary.iterations?.length">
              <thead>
                <tr>
                  <th>轮次</th>
                  <th>实验</th>
                  <th>状态</th>
                  <th>完成率</th>
                  <th>中位收益</th>
                  <th>均回撤</th>
                  <th>决策</th>
                  <th>复盘摘要</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in loopSummary.iterations" :key="`${row.iteration}-${row.batch_id}`">
                  <td>第 {{ row.iteration }} 轮</td>
                  <td>
                    <button type="button" class="link-btn" @click="selectBatch(row.batch_id)">
                      {{ row.batch_name || row.batch_id }}
                    </button>
                    <small class="param-desc">{{ row.batch_id }}</small>
                    <small v-if="row.param_changes?.length" class="param-desc">
                      调参：{{ row.param_changes.join(', ') }}
                    </small>
                  </td>
                  <td>{{ row.batch_status || '-' }}</td>
                  <td>{{ pct(row.completion_rate) }}</td>
                  <td>{{ pct(row.median_total_return) }}</td>
                  <td>{{ pct(row.avg_max_drawdown) }}</td>
                  <td>
                    <span v-if="row.decision">{{ row.decision }}</span>
                    <span v-else class="muted">-</span>
                    <small v-if="row.decision_reason" class="param-desc">{{ row.decision_reason }}</small>
                  </td>
                  <td class="review-snippet">
                    <span v-if="row.review_summary">{{ row.review_summary }}</span>
                    <span v-else-if="row.has_review" class="muted">复盘已生成（无摘要字段）</span>
                    <span v-else class="muted">暂无复盘</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-else class="muted">尚无已记录的回测轮次。</p>
            <div v-if="loopSummary.is_terminal && loopSummary.final_summary" class="loop-final-box">
              <strong>末轮指标</strong>
              <span>中位收益 {{ pct(loopSummary.final_summary.median_total_return) }}</span>
              <span>完成率 {{ pct(loopSummary.final_summary.completion_rate) }}</span>
            </div>
          </section>
          <ul class="loop-timeline">
            <li v-for="entry in selectedLoop.iterations || []" :key="`${entry.iteration}-${entry.batch_id}`">
              第 {{ entry.iteration }} 轮 · {{ entry.batch_id }}
              <span v-if="entry.decision"> · {{ entry.decision }}</span>
              <span v-if="entry.decision_reason">（{{ entry.decision_reason }}）</span>
              <span v-if="entry.child_batch_id"> → {{ entry.child_batch_id }}</span>
            </li>
          </ul>
        </div>
      </div>
      <p v-else class="muted">暂无自动迭代任务</p>
    </div>
  </section>
</template>

<script setup>
defineProps({
  expanded: { type: Boolean, required: true },
  loopHealthStatusText: { type: String, required: true },
  loopHealth: { type: Object, default: null },
  loopForm: { type: Object, required: true },
  loopSubmitting: { type: Boolean, default: false },
  loopMessage: { type: String, default: '' },
  canStartLoopFromBatch: { type: Boolean, default: false },
  startLoopFromBatchHint: { type: String, default: '' },
  loops: { type: Array, required: true },
  selectedLoopId: { type: String, default: '' },
  selectedLoop: { type: Object, default: null },
  canManageActiveLoop: { type: Boolean, default: false },
  canAdvanceLoop: { type: Boolean, default: false },
  canDeleteSelectedLoop: { type: Boolean, default: false },
  pendingDeleteLoop: { type: Object, default: null },
  loopSummary: { type: Object, default: null },
  loopSummaryLoading: { type: Boolean, default: false },
  startAutoLoop: { type: Function, required: true },
  startAutoLoopFromBatch: { type: Function, required: true },
  refreshSelectedLoop: { type: Function, required: true },
  selectLoop: { type: Function, required: true },
  pauseSelectedLoop: { type: Function, required: true },
  resumeSelectedLoop: { type: Function, required: true },
  cancelSelectedLoop: { type: Function, required: true },
  advanceSelectedLoop: { type: Function, required: true },
  deleteSelectedLoop: { type: Function, required: true },
  confirmDeleteSelectedLoop: { type: Function, required: true },
  requestLoopFinalReport: { type: Function, required: true },
  selectBatch: { type: Function, required: true },
  loopStepLabel: { type: Function, required: true },
  formatDateTime: { type: Function, required: true },
  pct: { type: Function, required: true },
  formatParamDisplay: { type: Function, required: true },
})

const emit = defineEmits(['update:expanded', 'update:pendingDeleteLoop'])
</script>

<style scoped>
.card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
  padding: 16px;
}

.section-title-row,
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-kicker,
.muted,
.param-desc,
.batch-row span,
.batch-row small,
.loop-health-panel span,
.list-caption span {
  color: #64748b;
}

.section-kicker {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  margin: 0 0 4px;
}

h3,
h4,
p {
  margin: 0;
}

.subtitle {
  color: #64748b;
  margin-top: 6px;
}

.title-actions,
.loop-health-meta,
.loop-final-box,
.detail-actions,
.confirm-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.type-badge,
.row-type {
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  padding: 5px 8px;
  white-space: nowrap;
}

.loop-badge,
.loop-row .row-type {
  background: #e0e7ff;
  color: #3730a3;
}

.panel-summary {
  align-items: center;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 12px;
  padding: 10px 12px;
}

.panel-summary span,
.loop-health-panel span,
.muted,
.loop-timeline,
.report-block,
.loop-final-box {
  font-size: 13px;
}

.panel-body,
.form-grid,
.loop-health-panel,
.loop-panel .loop-layout {
  margin-top: 12px;
}

.loop-health-panel {
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
}

.loop-health-panel.unhealthy {
  background: #fff7ed;
  border-color: #fed7aa;
}

.loop-health-panel strong {
  color: #0f172a;
  display: block;
  margin-bottom: 4px;
}

.form-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

label {
  color: #334155;
  display: flex;
  flex-direction: column;
  font-size: 13px;
  gap: 6px;
}

input {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
}

button {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  padding: 8px 12px;
}

.primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

.danger {
  color: #b91c1c;
}

.mini-btn {
  font-size: 12px;
  padding: 4px 8px;
}

.loop-panel .loop-layout {
  display: grid;
  gap: 12px;
  grid-template-columns: 240px 1fr;
}

.loop-list,
.batch-row {
  display: flex;
  flex-direction: column;
}

.loop-list {
  gap: 8px;
}

.batch-row {
  align-items: flex-start;
  gap: 4px;
  text-align: left;
}

.loop-row {
  border-color: #c7d2fe;
  background: #f8faff;
}

.batch-row.active {
  border-color: #2563eb;
  background: #eff6ff;
}

.list-caption {
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-bottom: 8px;
}

.detail-actions {
  justify-content: flex-end;
  margin-bottom: 12px;
}

.inline-confirm {
  border-radius: 12px;
  margin: 12px 0;
  padding: 12px;
}

.danger-confirm {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.danger-confirm strong {
  color: #991b1b;
}

.danger-confirm p {
  color: #7f1d1d;
  font-size: 13px;
  margin-top: 6px;
}

.loop-wait-panel {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 12px;
  margin: 12px 0;
  padding: 12px;
}

.loop-wait-panel strong {
  color: #9a3412;
}

.loop-wait-panel p {
  color: #475569;
  font-size: 13px;
  margin-top: 6px;
}

.loop-review-task-box {
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid #fed7aa;
  border-radius: 10px;
  margin-top: 10px;
  padding: 10px;
}

.loop-final-report-panel {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  margin: 12px 0;
  padding: 14px;
}

.loop-final-report-panel h4 {
  margin: 0 0 10px;
  color: #1e3a8a;
}

.report-lead {
  font-size: 15px;
  line-height: 1.55;
  margin: 0 0 12px;
}

.report-block {
  margin-top: 10px;
}

.report-block ul,
.loop-timeline {
  margin: 6px 0 0;
  padding-left: 1.2rem;
}

.loop-summary-panel {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin: 12px 0;
  padding: 12px;
}

.loop-summary-panel h4 {
  margin: 0 0 8px;
}

.params-table {
  border-collapse: collapse;
  font-size: 13px;
  width: 100%;
}

.params-table th,
.params-table td {
  border-bottom: 1px solid #e2e8f0;
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
}

.params-table th {
  background: #f1f5f9;
  color: #475569;
  font-weight: 600;
}

.review-snippet {
  max-width: 280px;
  font-size: 13px;
  line-height: 1.4;
}

.param-desc {
  display: block;
  margin-top: 2px;
}

.error {
  color: #b91c1c;
}

.message {
  color: #2563eb;
}

.link-btn {
  background: none;
  border: none;
  color: #2563eb;
  cursor: pointer;
  font-size: inherit;
  padding: 0;
  text-decoration: underline;
}

.link-btn:hover {
  color: #1d4ed8;
}

@media (max-width: 900px) {
  .loop-panel .loop-layout {
    grid-template-columns: 1fr;
  }
}
</style>
