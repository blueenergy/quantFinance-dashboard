<template>
  <section class="portfolio-research model-training">
    <header class="page-header">
      <div>
        <p class="eyebrow">Model Training</p>
        <h2>模型训练</h2>
        <p class="subtitle">
          Walk-forward IC 评估与晋升门禁；旁路 quant_ml，非正式 stock_scores。当前流水线可能仍使用合成数据验证。
        </p>
      </div>
      <div class="header-actions">
        <button type="button" @click="openCreateDrawer">新建训练</button>
        <button type="button" :disabled="loading" @click="refreshAll">刷新</button>
      </div>
    </header>

    <p v-if="message" class="message">{{ message }}</p>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <section class="workspace">
      <ModelTrainingJobList
        :jobs="jobs"
        :loading="loading"
        :selected-job-id="selectedJobId"
        :universe-options="universeOptions"
        :now-ms="nowMs"
        :mobile-hidden="isNarrow && mobileShowDetail"
        v-model:status-filter="statusFilter"
        v-model:index-filter="indexFilter"
        @load="loadJobs"
        @select-job="(jobId) => selectJob(jobId, { scrollDetail: true })"
      />

      <main v-if="!selectedJob" class="card detail-card" :class="{ 'mobile-hidden': isNarrow && !mobileShowDetail }">
        <p class="muted detail-empty">请选择一个训练任务。</p>
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
            aria-label="训练任务详情"
            @click.stop
          >
            <div class="detail-toolbar">
              <button v-if="isNarrow" type="button" class="back-btn" @click="backToList">← 任务列表</button>
              <div class="detail-title">
                <h3>{{ selectedJob.name || selectedJob.job_id }}</h3>
                <p class="muted">
                  {{ selectedJob.status }} · {{ selectedJob.job_id }}
                  <span v-if="formatJobElapsedLabel(selectedJob)"> · {{ formatJobElapsedLabel(selectedJob) }}</span>
                  <span v-if="mlJobProgressStageLabel(selectedJob)"> · {{ mlJobProgressStageLabel(selectedJob) }}</span>
                  <span v-if="selectedJob.error_message"> · {{ selectedJob.error_message }}</span>
                </p>
              </div>
              <div class="actions">
                <button type="button" @click="toggleDetailFullscreen">
                  {{ detailMaximized ? '退出全屏' : '全屏' }}
                </button>
                <button
                  type="button"
                  :title="loadParamsHint"
                  @click="loadParamsFromSelectedJob"
                >
                  加载原参数
                </button>
              </div>
            </div>

            <div ref="detailBodyRef" class="detail-body">
              <div
                v-if="resultDetail"
                class="promotion-banner"
                :class="promotionPassed(resultDetail.promotion) ? 'pass' : 'fail'"
              >
                <strong>{{ promotionPassed(resultDetail.promotion) ? '晋升门禁：通过' : '晋升门禁：未通过' }}</strong>
                <span v-if="!promotionPassed(resultDetail.promotion) && resultDetail.promotion?.reason">
                  — {{ promotionReasonLabel(resultDetail.promotion.reason) }}
                </span>
              </div>

              <div v-if="resultDetail" class="kpi-grid">
                <div class="kpi">
                  <span>模型 mean IC</span>
                  <strong>{{ formatIc(resultDetail.promotion?.model_mean_ic ?? baselineModelIc) }}</strong>
                </div>
                <div class="kpi">
                  <span>基线 mean IC</span>
                  <strong>{{ formatIc(resultDetail.promotion?.baseline_mean_ic ?? resultDetail.baseline_ic?.mean_ic) }}</strong>
                </div>
                <div class="kpi">
                  <span>置换检验 p</span>
                  <strong>{{ formatPValue(resultDetail.permutation_p) }}</strong>
                </div>
                <div class="kpi">
                  <span>模型类型</span>
                  <strong>{{ resultDetail.model_kind || selectedJob.params?.model_kind || '-' }}</strong>
                </div>
              </div>

              <div class="info-grid">
                <div>
                  <span>创建时间</span>
                  <strong>{{ formatJobDateTime(selectedJob.created_at) }}</strong>
                </div>
                <div>
                  <span>完成时间</span>
                  <strong>{{ formatJobDateTime(selectedJob.completed_at) }}</strong>
                </div>
                <div>
                  <span>snapshot_id</span>
                  <strong>{{ resultDetail?.snapshot_id || '-' }}</strong>
                </div>
                <div>
                  <span>artifact_hash</span>
                  <strong class="mono">{{ resultDetail?.artifact_hash || '-' }}</strong>
                </div>
              </div>

              <section class="research-params">
                <div class="section-header">
                  <div>
                    <h4>训练参数</h4>
                    <p class="muted">创建任务时提交的 params。</p>
                  </div>
                </div>
                <div class="config-grid">
                  <span v-for="row in paramRows" :key="row.key">
                    <strong>{{ row.label }}</strong>{{ row.value }}
                  </span>
                </div>
              </section>

              <section v-if="resultDetail?.parquet_path" class="research-params">
                <div class="section-header">
                  <div>
                    <h4>数据快照</h4>
                  </div>
                </div>
                <p class="mono muted path-line">{{ resultDetail.parquet_path }}</p>
              </section>

              <ModelTrainingFoldPanel
                v-if="resultDetail"
                :fold-rows="foldRows"
                :chart-max-ic="chartMaxIc"
              />

              <p v-else-if="selectedJob.status === 'completed'" class="muted">结果加载中或不可用。</p>
              <p v-else class="muted">任务完成后会显示 walk-forward 结果。</p>
            </div>
          </main>
        </div>
      </Teleport>
    </section>

    <ModelTrainingCreateDrawer
      v-if="drawerOpen"
      :open="drawerOpen"
      :form="form"
      :snapshots="snapshots"
      :snapshots-loading="snapshotsLoading"
      :submitting="submitting"
      :title="drawerTitle"
      :subtitle="drawerSubtitle"
      :submit-label="submitButtonLabel"
      @close="closeDrawer"
      @submit="submitJobForm"
      @update:form="onDrawerFormUpdate"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import '../assets/styles/portfolio-research.css'
import '../assets/styles/model-training.css'
import ModelTrainingCreateDrawer from '../components/modelTraining/ModelTrainingCreateDrawer.vue'
import ModelTrainingFoldPanel from '../components/modelTraining/ModelTrainingFoldPanel.vue'
import ModelTrainingJobList from '../components/modelTraining/ModelTrainingJobList.vue'
import { useModelTrainingDetail } from '../composables/useModelTrainingDetail'
import { useModelTrainingForm } from '../composables/useModelTrainingForm'
import { useModelTrainingJobs } from '../composables/useModelTrainingJobs'
import {
  ML_UNIVERSE_OPTIONS,
  formatIc,
  formatJobDateTime,
  formatPValue,
  jobElapsedLabel as formatJobElapsedFromView,
  mlJobProgressStageLabel,
  promotionPassed,
  promotionReasonLabel,
} from '../utils/modelTrainingView'

const NARROW_MQ = '(max-width: 900px)'

let jobsApi
const {
  selectedJobId,
  selectedJob,
  resultDetail,
  detailMaximized,
  detailBodyRef,
  mobileShowDetail,
  paramRows,
  foldRows,
  chartMaxIc,
  toggleDetailFullscreen,
  exitDetailFullscreen,
  backToList,
  selectJob,
} = useModelTrainingDetail({
  setErrorMessage: (value) => {
    jobsApi.errorMessage.value = value
  },
})

const {
  jobs,
  statusFilter,
  indexFilter,
  loading,
  message,
  errorMessage,
  nowMs,
  loadJobs,
  refreshAll,
} = (jobsApi = useModelTrainingJobs({
  selectedJobId,
  selectedJob,
  resultDetail,
  refreshSelected: (jobId) => selectJob(jobId, { scrollDetail: false }),
}))

const {
  form,
  drawerOpen,
  submitting,
  drawerTitle,
  drawerSubtitle,
  submitButtonLabel,
  openCreateDrawer,
  closeDrawer,
  onDrawerFormUpdate,
  submitJobForm,
  loadParamsFromSelectedJob,
  loadParamsHint,
  snapshots,
  snapshotsLoading,
} = useModelTrainingForm({
  selectedJob,
  message,
  errorMessage,
  loadJobs,
  selectJob,
})

const universeOptions = ML_UNIVERSE_OPTIONS
const isNarrow = ref(typeof window !== 'undefined' ? window.matchMedia(NARROW_MQ).matches : false)
let narrowMql = null

const baselineModelIc = computed(() => {
  const folds = resultDetail.value?.fold_reports || []
  if (!folds.length) return null
  const vals = folds.map((f) => f.model?.mean_ic).filter((v) => Number.isFinite(Number(v)))
  if (!vals.length) return null
  return vals.reduce((a, b) => a + Number(b), 0) / vals.length
})

function formatJobElapsedLabel(job) {
  return formatJobElapsedFromView(job, nowMs.value)
}

onMounted(async () => {
  if (typeof window !== 'undefined') {
    narrowMql = window.matchMedia(NARROW_MQ)
    isNarrow.value = narrowMql.matches
    narrowMql.addEventListener('change', (e) => {
      isNarrow.value = e.matches
    })
  }
  await loadJobs()
})

onUnmounted(() => {
  if (narrowMql) narrowMql.removeEventListener('change', () => {})
})
</script>
