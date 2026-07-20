<template>
  <aside class="card jobs-card" :class="{ 'mobile-hidden': mobileHidden }">
    <div class="jobs-toolbar">
      <h3>研究任务</h3>
      <div class="job-filters">
        <select :value="statusFilter" title="状态" @change="onStatusChange">
          <option value="">全部状态</option>
          <option value="pending">pending</option>
          <option value="running">running</option>
          <option value="completed">completed</option>
          <option value="failed">failed</option>
        </select>
        <select :value="universeFilter" title="universe" @change="onUniverseChange">
          <option value="">全部 universe</option>
          <option v-for="universe in universeOptions" :key="universe.value" :value="universe.value">
            {{ universe.value }}
          </option>
        </select>
        <input
          :value="growthCycleWeightFilter"
          class="weight-filter"
          placeholder="growth:cycle 如 30:70"
          @change="onWeightChange"
          @keyup.enter="onWeightEnter"
        />
      </div>
    </div>
    <div class="jobs-list">
      <p v-if="loading" class="muted">加载中...</p>
      <p v-else-if="!jobs.length" class="muted">暂无研究任务。</p>
      <button
        v-for="job in jobs"
        :key="job.job_id"
        class="job-row"
        :class="{ active: selectedJobId === job.job_id }"
        @click="$emit('select-job', job.job_id)"
      >
        <strong>{{ job.name || job.job_id }}</strong>
        <span>{{ job.status }} · {{ job.universe_index || job.params?.universe_index || '-' }}</span>
        <small v-if="jobWeightLabel(job)">{{ jobWeightLabel(job) }}</small>
        <small v-if="formatJobElapsedLabel(job)">{{ formatJobElapsedLabel(job) }}</small>
        <small v-if="jobProgressStageLabel(job)" class="progress-stage">{{ jobProgressStageLabel(job) }}</small>
        <small>{{ compactDate(job.start_date) }} → {{ compactDate(job.end_date) }}</small>
        <small v-if="job.best_row">best {{ pct(job.best_row.index_excess_cumulative_return) }} excess</small>
      </button>
    </div>
  </aside>
</template>

<script setup>
import {
  compactDate,
  jobElapsedLabel,
  jobProgressStageLabel,
  jobWeightLabel,
  pct,
} from '../../utils/portfolioResearchView'

const props = defineProps({
  jobs: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  selectedJobId: { type: String, default: '' },
  universeOptions: { type: Array, default: () => [] },
  statusFilter: { type: String, default: '' },
  universeFilter: { type: String, default: '' },
  growthCycleWeightFilter: { type: String, default: '' },
  nowMs: { type: Number, default: () => Date.now() },
  mobileHidden: { type: Boolean, default: false },
})

const emit = defineEmits([
  'update:statusFilter',
  'update:universeFilter',
  'update:growthCycleWeightFilter',
  'load',
  'select-job',
])

function formatJobElapsedLabel(job) {
  return jobElapsedLabel(job, props.nowMs)
}

function onStatusChange(event) {
  emit('update:statusFilter', event.target.value)
  emit('load')
}

function onUniverseChange(event) {
  emit('update:universeFilter', event.target.value)
  emit('load')
}

function onWeightChange(event) {
  emit('update:growthCycleWeightFilter', event.target.value)
  emit('load')
}

function onWeightEnter(event) {
  emit('update:growthCycleWeightFilter', event.target.value)
  emit('load')
}
</script>

<style scoped>
.jobs-card {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px;
}

.jobs-toolbar {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 10px;
}

.jobs-toolbar h3 {
  margin: 0;
}

.job-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.job-filters select,
.job-filters .weight-filter {
  min-width: 0;
  flex: 1 1 110px;
  padding: 6px 8px;
  border: 1px solid #d7dde7;
  border-radius: 8px;
  background: #fff;
  color: #172033;
  font-size: 12px;
}

.job-filters .weight-filter {
  flex: 1 1 140px;
}

.jobs-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.job-row {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
  border: 1px solid #e6eaf0;
  border-radius: 8px;
  padding: 8px 12px;
  background: #fbfcfe;
  color: #172033;
  cursor: pointer;
  text-align: left;
  text-decoration: none;
}

.job-row.active {
  border-color: #0f6bdc;
  background: #eef6ff;
}

.job-row strong,
.job-row span,
.job-row small {
  overflow-wrap: anywhere;
  word-break: break-word;
}

.job-row small {
  color: #64748b;
}

.progress-stage {
  color: #0f6bdc;
  font-weight: 600;
}

.muted {
  color: #64748b;
}

.card {
  background: #fff;
  border: 1px solid #e6eaf0;
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
}

@media (max-width: 900px) {
  .mobile-hidden {
    display: none !important;
  }
}
</style>
