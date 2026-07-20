<template>
  <section class="portfolio-research">
    <header class="page-header">
      <div>
        <p class="eyebrow">Portfolio Research</p>
        <h2>组合研究</h2>
        <p class="subtitle">用生产数据复跑组合策略研究，筛选可行参数并保存为组合交易计划可消费的参数预设。</p>
      </div>
      <div class="header-actions">
        <button ref="newJobBtnRef" type="button" @click="openCreateDrawer">新建研究</button>
        <button type="button" :disabled="loading" @click="refreshAll">刷新</button>
      </div>
    </header>

    <p v-if="message" class="message">{{ message }}</p>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <section class="workspace">
      <ResearchJobList
        :jobs="jobs"
        :loading="loading"
        :selected-job-id="selectedJobId"
        :universe-options="universeOptions"
        :now-ms="nowMs"
        :mobile-hidden="isNarrow && mobileShowDetail"
        v-model:status-filter="statusFilter"
        v-model:universe-filter="universeFilter"
        v-model:growth-cycle-weight-filter="growthCycleWeightFilter"
        @load="loadJobs"
        @select-job="(jobId) => selectJob(jobId, { scrollDetail: true })"
      />

      <main v-if="!selectedJob" class="card detail-card" :class="{ 'mobile-hidden': isNarrow && !mobileShowDetail }">
        <p class="muted detail-empty">请选择一个研究任务。</p>
      </main>
      <Teleport v-else to="body" :disabled="!detailMaximized">
        <div :class="detailMaximized ? 'detail-fullscreen-shell' : 'detail-inline-shell'">
          <div
            v-if="detailMaximized"
            class="detail-fullscreen-backdrop"
            aria-hidden="true"
            @click="exitDetailFullscreen"
          />
          <main
            class="card detail-card"
            :class="{
              'detail-card--maximized': detailMaximized,
              'mobile-hidden': isNarrow && !mobileShowDetail,
            }"
            :role="detailMaximized ? 'dialog' : undefined"
            :aria-modal="detailMaximized ? 'true' : undefined"
            aria-label="研究任务详情"
            @click.stop
          >
          <div class="detail-toolbar">
            <button v-if="isNarrow" type="button" class="back-btn" @click="backToList">← 任务列表</button>
            <div class="detail-title">
              <h3>{{ selectedJob.name || selectedJob.job_id }}</h3>
              <p class="muted">
                {{ selectedJob.status }} · {{ selectedJob.job_id }}
                <span v-if="selectedJob.rerun_of_job_id"> · rerun of {{ selectedJob.rerun_of_job_id }}</span>
                <span v-if="jobElapsedLabel(selectedJob)"> · {{ jobElapsedLabel(selectedJob) }}</span>
                <span v-if="jobProgressStageLabel(selectedJob)"> · {{ jobProgressStageLabel(selectedJob) }}</span>
                <span v-if="selectedJob.error_message"> · {{ selectedJob.error_message }}</span>
              </p>
            </div>
            <div class="actions">
              <button
                type="button"
                @click="toggleDetailFullscreen"
              >
                {{ detailMaximized ? '退出全屏' : '全屏' }}
              </button>
              <button
                ref="loadParamsBtnRef"
                type="button"
                :title="loadParamsHint"
                @click="loadParamsFromSelectedJob"
              >
                加载原参数
              </button>
              <button
                v-if="selectedJob.result_id"
                type="button"
                :disabled="artifactLoading"
                @click="openArtifact(selectedJob.job_id)"
              >
                {{ artifactLoading ? '打开中...' : '打开 HTML 报告' }}
              </button>
              <button
                type="button"
                class="danger"
                :disabled="deleteLoading || selectedJob.status === 'pending' || selectedJob.status === 'running'"
                :title="deleteDisabledReason"
                @click="deleteJob"
              >
                {{ deleteLoading ? '删除中...' : '删除报告' }}
              </button>
            </div>
          </div>

          <div ref="detailBodyRef" class="detail-body">
            <div class="info-grid">
              <div>
                <span>任务耗时</span>
                <strong>{{ jobElapsedLabel(selectedJob) || '-' }}</strong>
              </div>
              <div v-if="selectedJob.status === 'running'">
                <span>当前阶段</span>
                <strong>{{ jobProgressStageLabel(selectedJob) || '-' }}</strong>
              </div>
              <div>
                <span>评分数据水位</span>
                <strong>{{ selectedJob.data_watermark?.stock_scores_max_date || '-' }}</strong>
              </div>
              <div>
                <span>可回测收益水位</span>
                <strong>{{ selectedJob.data_watermark?.backtest_score_max_date || selectedJob.data_watermark?.stock_scores_max_date || '-' }}</strong>
              </div>
              <div>
                <span>dataset rows</span>
                <strong>{{ selectedJob.data_watermark?.dataset_rows ?? '-' }}</strong>
              </div>
              <div>
                <span>成分口径</span>
                <strong>{{ universePitQualityLabel }}</strong>
              </div>
              <div>
                <span>已保存预设</span>
                <strong>{{ publishedPresetLabel }}</strong>
              </div>
              <div>
                <span>发布动作</span>
                <strong>{{ publishActionLabel }}</strong>
              </div>
            </div>

            <section class="research-params">
              <div class="section-header">
                <div>
                  <h4>研究参数</h4>
                  <p class="muted">创建研究任务时使用的参数。</p>
                </div>
              </div>
              <div class="config-grid">
                <span v-for="row in researchParamRows" :key="row.key">
                  <strong>{{ row.label }}</strong>{{ row.value }}
                </span>
              </div>
            </section>

            <section v-if="candidateConfig" class="candidate">
              <div class="section-header">
                <div>
                  <h4>候选策略配置</h4>
                  <p class="muted">{{ candidateConfig.name || candidateConfig.preset_id }}</p>
                </div>
                <div class="actions">
                  <button type="button" :disabled="publishLoading || hasPublishedPreset" @click="publish('draft')">
                    保存为 draft 预设
                  </button>
                  <button type="button" :disabled="publishLoading || hasPublishedPreset" @click="publish('enabled')">
                    保存并启用预设
                  </button>
                </div>
              </div>
              <p v-if="hasPublishedPreset" class="muted">
                该研究结果已经保存为参数预设，不能重复启用。
              </p>
              <div class="config-grid">
                <span><strong>top_n</strong>{{ candidateConfig.top_n ?? '-' }}</span>
                <span><strong>rebalance</strong>{{ candidateConfig.rebalance_days ? `${candidateConfig.rebalance_days}d` : '-' }}</span>
                <span><strong>mode</strong>{{ candidateConfig.construction_mode || '-' }}</span>
                <span><strong>industry cap</strong>{{ pct(candidateConfig.max_industry_weight) }}</span>
                <span><strong>growth</strong>{{ pct(candidateConfig.growth_weight) }}</span>
                <span><strong>cycle</strong>{{ pct(candidateConfig.cycle_weight) }}</span>
                <span><strong>benchmark</strong>{{ candidateConfig.index_benchmark_symbol || '-' }}</span>
                <span><strong>initial capital</strong>{{ money(candidateConfig.initial_capital) }}</span>
                <span><strong>cash buffer</strong>{{ pct(candidateConfig.cash_buffer) }}</span>
                <span><strong>trailing stop</strong>{{ pct(candidateConfig.trailing_stop_pct) }}</span>
                <span><strong>execution price</strong>{{ candidateConfig.execution_price || '-' }}</span>
              </div>
            </section>

            <SweepResultPanel
              v-if="resultRows.length"
              :result-detail="resultDetail"
              :job="selectedJob"
              :selected-row="selectedResultRow"
              :pct="pct"
              :num="num"
              @select-row="onSelectResultRow"
              @open-combo="openComboDetail"
            />
            <p v-else class="muted">暂无结果。任务完成后会显示。</p>
          </div>
          </main>
        </div>
      </Teleport>
    </section>

    <ResearchCreateDrawer
      :open="drawerOpen"
      :form="form"
      :universe-options="universeOptions"
      :submitting="submitting"
      :title="drawerTitle"
      :subtitle="drawerSubtitle"
      :submit-label="submitButtonLabel"
      @close="closeDrawer"
      @submit="submitJobForm"
      @update:form="onDrawerFormUpdate"
      @name-touched="nameTouched = true"
      @universe-change="syncDefaultName"
    />

    <ResearchComboModal
      :open="comboModalOpen"
      :loading="comboLoading"
      :error="comboError"
      :detail="comboDetail"
      :context-row="comboContextRow"
      @close="closeComboDetail"
    />
  </section>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { getPortfolioResearchComboDetail } from '../api/portfolioResearch'
import { usePortfolioResearchDetail } from '../composables/usePortfolioResearchDetail'
import { usePortfolioResearchForm } from '../composables/usePortfolioResearchForm'
import { usePortfolioResearchJobs } from '../composables/usePortfolioResearchJobs'
import { formatResearchApiError } from '../utils/portfolioResearchPayload'
import {
  UNIVERSE_OPTIONS,
  jobElapsedLabel as formatJobElapsedLabel,
  jobProgressStageLabel,
  money,
  num,
  pct,
} from '../utils/portfolioResearchView'
import ResearchComboModal from '../components/portfolio/ResearchComboModal.vue'
import ResearchCreateDrawer from '../components/portfolio/ResearchCreateDrawer.vue'
import ResearchJobList from '../components/portfolio/ResearchJobList.vue'
import SweepResultPanel from '../components/portfolio/SweepResultPanel.vue'

const NARROW_MQ = '(max-width: 900px)'

let jobsApi
const {
  selectedJobId,
  selectedJob,
  resultDetail,
  selectedResultRow,
  deleteLoading,
  publishLoading,
  artifactLoading,
  detailMaximized,
  detailBodyRef,
  mobileShowDetail,
  resultRows,
  candidateConfig,
  researchParamRows,
  hasPublishedPreset,
  publishedPresetLabel,
  publishActionLabel,
  deleteDisabledReason,
  universePitQualityLabel,
  loadParamsHint,
  onSelectResultRow,
  toggleDetailFullscreen,
  exitDetailFullscreen,
  backToList,
  selectJob,
  deleteJob,
  publish,
  openArtifact,
} = usePortfolioResearchDetail({
  loadJobs: (...args) => jobsApi.loadJobs(...args),
  setMessage: (value) => {
    jobsApi.message.value = value
  },
  setErrorMessage: (value) => {
    jobsApi.errorMessage.value = value
  },
})
const {
  jobs,
  statusFilter,
  universeFilter,
  growthCycleWeightFilter,
  loading,
  message,
  errorMessage,
  nowMs,
  loadJobs,
  refreshAll,
} = (jobsApi = usePortfolioResearchJobs({
  selectedJobId,
  selectedJob,
  resultDetail,
  selectedResultRow,
  refreshSelected: (jobId) => selectJob(jobId, { scrollDetail: false }),
}))
const {
  form,
  nameTouched,
  drawerOpen,
  submitting,
  drawerTitle,
  drawerSubtitle,
  submitButtonLabel,
  openCreateDrawer,
  closeDrawer,
  onDrawerEscape,
  loadParamsFromSelectedJob,
  submitJobForm,
  syncDefaultName,
  onDrawerFormUpdate,
} = usePortfolioResearchForm({
  selectedJob,
  selectedJobId,
  message,
  errorMessage,
  loadJobs,
  selectJob,
})
const isNarrow = ref(typeof window !== 'undefined' ? window.matchMedia(NARROW_MQ).matches : false)
const newJobBtnRef = ref(null)
const loadParamsBtnRef = ref(null)
let comboSeq = 0
let narrowMql = null

const comboModalOpen = ref(false)
const comboLoading = ref(false)
const comboError = ref('')
const comboDetail = ref(null)
const comboContextRow = ref(null)

const universeOptions = UNIVERSE_OPTIONS

function jobElapsedLabel(job) {
  return formatJobElapsedLabel(job, nowMs.value)
}

function onNarrowChange(event) {
  isNarrow.value = event.matches
}

async function openComboDetail(row) {
  if (!selectedJobId.value || !row?.combo_key) return
  detailMaximized.value = false
  comboModalOpen.value = true
  comboLoading.value = true
  comboError.value = ''
  comboDetail.value = null
  comboContextRow.value = row
  const seq = ++comboSeq
  try {
    const detail = await getPortfolioResearchComboDetail(selectedJobId.value, row.combo_key)
    if (seq !== comboSeq) return
    comboDetail.value = detail
  } catch (err) {
    if (seq !== comboSeq) return
    comboError.value = formatResearchApiError(err, '加载成交明细失败')
  } finally {
    if (seq === comboSeq) comboLoading.value = false
  }
}

function closeComboDetail() {
  comboSeq += 1
  comboModalOpen.value = false
  comboLoading.value = false
  comboError.value = ''
  comboDetail.value = null
  comboContextRow.value = null
}

onMounted(async () => {
  narrowMql = window.matchMedia(NARROW_MQ)
  isNarrow.value = narrowMql.matches
  narrowMql.addEventListener('change', onNarrowChange)
  window.addEventListener('keydown', onDrawerEscape, true)
  await refreshAll()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onDrawerEscape, true)
  narrowMql?.removeEventListener('change', onNarrowChange)
})
</script>

<style scoped>
.portfolio-research {
  box-sizing: border-box;
  color: #172033;
  margin: 0 auto;
  max-width: 1680px;
  padding: 28px 32px 40px;
  width: 100%;
}

.page-header,
.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: none;
}

.page-header > div,
.section-header > div {
  min-width: 0;
}

.section-header h3,
.section-header h4,
.section-header .muted {
  overflow-wrap: anywhere;
  word-break: break-word;
}

.eyebrow {
  margin: 0 0 4px;
  color: #64748b;
  font-size: 12px;
  letter-spacing: .08em;
  text-transform: uppercase;
}

h2,
h3,
h4 {
  margin: 0 0 8px;
}

.subtitle,
.muted,
small {
  color: #64748b;
}

.card {
  background: #fff;
  border: 1px solid #e6eaf0;
  border-radius: 14px;
  padding: 22px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
}

.field-hint {
  font-weight: 400;
  color: #94a3b8;
  font-size: 12px;
}

.form-grid,
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin: 14px 0;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}

input,
select {
  border: 1px solid #d9e1ec;
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
}

button {
  border: 1px solid #0f6bdc;
  border-radius: 8px;
  padding: 8px 12px;
  background: #0f6bdc;
  color: #fff;
  cursor: pointer;
  text-decoration: none;
}

button:disabled {
  cursor: not-allowed;
  opacity: .55;
}

button.danger {
  border-color: #b42318;
  background: #b42318;
}

button.danger:disabled {
  opacity: .45;
}

button.secondary-btn {
  border-color: #d9e1ec;
  background: #fff;
  color: #334155;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  gap: 16px;
  height: min(75dvh, calc(100dvh - 12rem));
  min-height: 480px;
  overflow: hidden;
}

.detail-inline-shell {
  display: contents;
  min-width: 0;
}

.detail-fullscreen-shell {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.detail-fullscreen-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.48);
}

.detail-card--maximized {
  position: relative;
  z-index: 1;
  width: min(96vw, 1680px);
  height: min(92vh, 100%);
  max-height: 92vh;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.28);
  overflow: hidden;
}

.detail-card--maximized .detail-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

.detail-card {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px;
}

.detail-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.detail-empty {
  margin: 0;
}

.detail-toolbar {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eef2f7;
}

.detail-title {
  flex: 1;
  min-width: 180px;
}

.detail-title h3 {
  margin: 0 0 4px;
}

.back-btn {
  flex: none;
  border-color: #d9e1ec;
  background: #fff;
  color: #334155;
}

.info-grid > div {
  border: 1px solid #edf0f5;
  border-radius: 10px;
  padding: 12px;
  background: #fbfcfe;
  min-width: 0;
}

.info-grid span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.info-grid strong {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.candidate,
.research-params {
  margin: 20px 0;
  padding: 18px;
  border: 1px solid #e6eaf0;
  border-radius: 12px;
  background: #fbfcfe;
  min-width: 0;
}

.candidate .section-header,
.research-params .section-header {
  align-items: flex-start;
  flex-wrap: wrap;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}

.config-grid span {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid #edf0f5;
  border-radius: 10px;
  background: #fff;
  color: #172033;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.config-grid strong {
  display: block;
  margin-bottom: 4px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid #e6eaf0;
  border-radius: 10px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th,
td {
  padding: 9px 10px;
  border-bottom: 1px solid #edf0f5;
  text-align: right;
  white-space: nowrap;
}

th:nth-child(2),
td:nth-child(2),
th:nth-child(3),
td:nth-child(3) {
  text-align: left;
}

th {
  background: #f8fafc;
  color: #475569;
}

.selected-result-row td {
  background: #fff7ed;
  border-bottom-color: #fed7aa;
}

.selected-result-row td:first-child {
  color: #c2410c;
  font-weight: 800;
}

.selected-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 2px 6px;
  border-radius: 999px;
  background: #f97316;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.message {
  color: #047857;
}

.error {
  color: #b91c1c;
}

.detail-cell {
  text-align: left;
}

@media (max-width: 900px) {
  .portfolio-research {
    padding: 18px;
  }

  .workspace {
    grid-template-columns: 1fr;
    height: min(78dvh, calc(100dvh - 10rem));
    min-height: 420px;
  }

  .mobile-hidden {
    display: none !important;
  }
}
</style>
