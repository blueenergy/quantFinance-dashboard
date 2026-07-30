<template>
  <section class="factor-backtest">
    <header class="page-header">
      <div>
        <p class="eyebrow">Factor Backtest</p>
        <h2>因子回测</h2>
        <p class="subtitle">
          在生产行情上评估 alpha 因子的选股能力：截面 IC、分位组收益与成本调整后的 TopK 收益。
        </p>
      </div>
      <div class="header-actions">
        <button type="button" @click="openCreateDrawer">新建回测</button>
        <button type="button" class="secondary-btn" :disabled="loading" @click="refreshAll">刷新</button>
      </div>
    </header>

    <p v-if="message" class="message">{{ message }}</p>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <section class="workspace">
      <FactorJobList
        :jobs="jobs"
        :loading="loading"
        :selected-job-id="selectedJobId"
        :index-options="indexOptions"
        :factor-set-options="factorSetOptions"
        :now-ms="nowMs"
        :mobile-hidden="isNarrow && mobileShowDetail"
        v-model:status-filter="statusFilter"
        v-model:factor-set-filter="factorSetFilter"
        v-model:index-filter="indexFilter"
        @load="loadJobs"
        @select-job="(jobId) => selectJob(jobId, { resetResult: true })"
      />

      <main v-if="!selectedJob" class="detail-card" :class="{ 'mobile-hidden': isNarrow && !mobileShowDetail }">
        <p class="muted detail-empty">请选择一个因子回测任务。</p>
      </main>
      <main v-else class="detail-card" :class="{ 'mobile-hidden': isNarrow && !mobileShowDetail }">
        <div class="detail-toolbar">
          <div class="detail-title">
            <button v-if="isNarrow" type="button" class="back-btn" @click="backToList">← 任务列表</button>
            <h3>{{ selectedJob.name || selectedJob.job_id }}</h3>
            <p class="muted">
              {{ selectedJob.status }} · {{ selectedJob.job_id }}
              <template v-if="elapsedLabel"> · {{ elapsedLabel }}</template>
            </p>
            <p class="muted">
              创建 {{ formatJobDateTime(selectedJob.created_at) }}
              <template v-if="selectedJob.worker_id"> · worker {{ selectedJob.worker_id }}</template>
              <template v-if="selectedJob.attempts"> · 第 {{ selectedJob.attempts }} 次尝试</template>
            </p>
          </div>
          <div class="detail-actions">
            <button type="button" class="secondary-btn" @click="openRerunDrawer(selectedJob)">以此参数重跑</button>
            <button
              type="button"
              class="danger-btn"
              :disabled="deleteLoading || isJobBusy"
              :title="deleteDisabledReason"
              @click="deleteJob"
            >
              {{ deleteLoading ? '删除中...' : '删除' }}
            </button>
          </div>
        </div>

        <div class="detail-body">
          <div v-if="stageProgress" class="stage-bar">
            <span class="stage-label">{{ stageProgress.label }}</span>
            <span class="stage-track">
              <span class="stage-fill" :style="{ width: `${stageProgress.percent}%` }" />
            </span>
            <p v-if="selectedJob.progress_message" class="stage-message">{{ selectedJob.progress_message }}</p>
            <p class="stage-message">分位诊断阶段最耗时，整体用时以它为主。</p>
          </div>
          <p v-else-if="selectedJob.status === 'pending'" class="muted">排队中，等待 worker 领取。</p>

          <p v-if="selectedJob.status === 'failed'" class="failure-note">
            {{ selectedJob.error_message || '任务失败' }}
            <template v-if="selectedJob.error_kind === 'invalid_request'">
              （参数被 worker 拒绝，请调整后重跑）
            </template>
          </p>

          <section>
            <h4 class="section-title">回测参数</h4>
            <div class="param-grid">
              <div v-for="row in paramRows" :key="row.key" class="param-item">
                <span class="param-key">{{ row.label }}</span>
                <span class="param-value">{{ row.value }}</span>
              </div>
            </div>
          </section>

          <p v-if="resultLoading" class="muted">结果加载中...</p>
          <FactorResultPanel
            v-else-if="report"
            :report="report"
            :coverage-cards="coverageCards"
            :skipped-factor-rows="skippedFactorRows"
            :pit-label="pitLabel"
            :horizons="horizons"
            :selected-horizon="selectedHorizon"
            :selected-factor="selectedFactor"
            :ic-rows="icRows"
            :diagnostics="diagnostics"
            :quantile-bars="quantileBars"
            :yearly-ic-rows="yearlyIcRows"
            :net-return-rows="netReturnRows"
            :screen-rows="screenRows"
            @select-factor="selectFactor"
            @select-horizon="selectHorizon"
          />
        </div>
      </main>
    </section>

    <FactorCreateDrawer
      v-model:factor-search="factorSearch"
      :form="form"
      :open="drawerOpen"
      :submitting="submitting"
      :form-error="formError"
      :index-options="indexOptions"
      :factor-set-options="factorSetOptions"
      :catalog-loading="catalogLoading"
      :catalog-error="catalogError"
      :catalog-available="catalogAvailable"
      :factor-groups="factorGroups"
      :factor-scope-hint="factorScopeHint"
      @update:form="onFormUpdate"
      @toggle-factor="toggleFactor"
      @select-family="selectFamily"
      @select-visible="selectVisibleFactors"
      @clear-factors="clearFactors"
      @close="closeDrawer"
      @submit="submit"
    />
  </section>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'
import '../assets/styles/factor-backtest.css'
import { useFactorBacktestDetail } from '../composables/useFactorBacktestDetail'
import { useFactorBacktestForm } from '../composables/useFactorBacktestForm'
import { useFactorBacktestJobs } from '../composables/useFactorBacktestJobs'
import {
  FACTOR_SET_OPTIONS,
  INDEX_OPTIONS,
  formatJobDateTime,
  jobElapsedLabel,
  jobStageProgress,
} from '../utils/factorBacktestView'
import FactorJobList from '../components/factor/FactorJobList.vue'
import FactorResultPanel from '../components/factor/FactorResultPanel.vue'

const FactorCreateDrawer = defineAsyncComponent(
  () => import('../components/factor/FactorCreateDrawer.vue'),
)

const NARROW_MQ = '(max-width: 900px)'

const indexOptions = INDEX_OPTIONS
const factorSetOptions = FACTOR_SET_OPTIONS

// The two composables need each other: the list owns the poll timer and the
// banners, the detail owns the selection it refreshes.
let jobsApi = null

const {
  selectedJobId,
  selectedJob,
  report,
  resultLoading,
  deleteLoading,
  selectedFactor,
  selectedHorizon,
  mobileShowDetail,
  paramRows,
  coverageCards,
  skippedFactorRows,
  pitLabel,
  screenRows,
  horizons,
  icRows,
  diagnostics,
  quantileBars,
  yearlyIcRows,
  netReturnRows,
  deleteDisabledReason,
  selectFactor,
  selectHorizon,
  backToList,
  selectJob,
  deleteJob,
} = useFactorBacktestDetail({
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
  factorSetFilter,
  indexFilter,
  loading,
  message,
  errorMessage,
  nowMs,
  loadJobs,
  refreshAll,
} = (jobsApi = useFactorBacktestJobs({
  selectedJobId,
  selectedJob,
  report,
  refreshSelected: (jobId) => selectJob(jobId),
}))

const {
  drawerOpen,
  submitting,
  formError,
  form,
  catalogLoading,
  catalogError,
  catalogAvailable,
  factorSearch,
  factorGroups,
  factorScopeHint,
  toggleFactor,
  selectFamily,
  clearFactors,
  selectVisibleFactors,
  openCreateDrawer,
  openRerunDrawer,
  closeDrawer,
  onFormUpdate,
  submit,
} = useFactorBacktestForm({
  setMessage: (value) => {
    message.value = value
  },
  setErrorMessage: (value) => {
    errorMessage.value = value
  },
  loadJobs,
  selectJob,
})

const isNarrow = ref(typeof window !== 'undefined' ? window.matchMedia(NARROW_MQ).matches : false)
let narrowQuery = null

function onNarrowChange(event) {
  isNarrow.value = event.matches
}

const stageProgress = computed(() => jobStageProgress(selectedJob.value))
const elapsedLabel = computed(() => jobElapsedLabel(selectedJob.value, nowMs.value))
const isJobBusy = computed(() => ['pending', 'running'].includes(selectedJob.value?.status))

onMounted(() => {
  if (typeof window !== 'undefined') {
    narrowQuery = window.matchMedia(NARROW_MQ)
    narrowQuery.addEventListener('change', onNarrowChange)
  }
  loadJobs()
})

onUnmounted(() => {
  narrowQuery?.removeEventListener('change', onNarrowChange)
})
</script>
