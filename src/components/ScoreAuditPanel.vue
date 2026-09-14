<template>
  <div class="score-audit">
    <p class="hint">
      抽查本环境 <code>stock_scores</code> 是否还等于当前 scorer。过期就刷<strong>这一套</strong>库，不必和另一套环境对账。
    </p>
    <form class="form" @submit.prevent="submit">
      <label>
        开始
        <input v-model="form.start_date" type="date" required />
      </label>
      <label>
        结束
        <input v-model="form.end_date" type="date" required />
      </label>
      <label>
        指数
        <select v-model="form.universe_index">
          <option v-for="code in universes" :key="code" :value="code">{{ code }}</option>
        </select>
      </label>
      <label>
        隔几天
        <input v-model.number="form.step" type="number" min="1" max="40" />
      </label>
      <label>
        每日抽样
        <input v-model.number="form.sample" type="number" min="0" max="50" />
      </label>
      <button type="submit" :disabled="submitting">排队检查</button>
    </form>
    <p v-if="message" class="ok">{{ message }}</p>
    <p v-if="error" class="err">{{ error }}</p>

    <div v-if="loading && !jobs.length" class="empty">加载中…</div>
    <ul v-else class="jobs">
      <li
        v-for="job in jobs"
        :key="job.job_id"
        :class="{ active: job.job_id === selectedId }"
        role="button"
        tabindex="0"
        @click="openDetail(job.job_id)"
        @keydown.enter.prevent="openDetail(job.job_id)"
      >
        <span class="verdict" :class="tone(listTone(job))">
          {{ listHeadline(job) }}
        </span>
        <span class="meta">
          {{ job.start_date }}–{{ job.end_date }} · {{ job.universe_index }} · {{ job.source }}
          <span v-if="jobTiming(job)" class="timing"> · {{ jobTiming(job) }}</span>
        </span>
        <span v-if="rollupLabel(job)" class="rollup" :class="rollupClass(job)">{{ rollupLabel(job) }}</span>
        <span v-if="job.error_message" class="err">{{ job.error_message }}</span>
        <span class="chevron">›</span>
      </li>
    </ul>
    <p v-if="!loading && !jobs.length" class="empty">还没有自查记录。周一 08:30 会抽最近 40 天，也可以上面排队。</p>

    <v-dialog v-model="detailOpen" max-width="640" scrollable>
      <v-card>
        <v-card-title class="detail-title">
          自查单详情
          <span v-if="detail" class="detail-sub">
            {{ detail.start_date }}–{{ detail.end_date }} · {{ detail.universe_index }}
            <span v-if="jobTiming(detail)"> · {{ jobTiming(detail) }}</span>
          </span>
        </v-card-title>
        <v-card-text>
          <div v-if="detailLoading" class="detail-loading">加载中…</div>
          <template v-else-if="detail">
            <p class="detail-summary">
              <span class="verdict" :class="tone(detail.overall_verdict || detail.status)">
                {{ detail.overall_verdict ? verdictLabel(detail.overall_verdict) : detail.status }}
              </span>
              <span class="meta"> · {{ detail.source || 'manual' }}</span>
            </p>
            <p v-if="repairHint" class="repair">{{ repairHint }}</p>
            <div v-if="canRepair" class="actions">
              <button type="button" :disabled="repairing" @click="confirmRepair">确认刷本环境</button>
            </div>
            <p class="progress" v-if="detail.progress_message">{{ detail.progress_stage }} {{ detail.progress_message }}</p>
            <p v-if="detail.error_message" class="err">{{ detail.error_message }}</p>
            <table v-if="detail.report?.dates_detail?.length">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>结论</th>
                  <th>|dG| max</th>
                  <th>|dC| max</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in detail.report.dates_detail" :key="row.score_date">
                  <td>{{ row.score_date }}</td>
                  <td>{{ verdictLabel(row.verdict) }}</td>
                  <td>{{ fmt(row.growth?.max) }}</td>
                  <td>{{ fmt(row.cycle?.max) }}</td>
                </tr>
              </tbody>
            </table>
            <ul v-if="worst.length" class="worst">
              <li v-for="row in worst" :key="row.score_date + row.symbol">
                {{ row.score_date }} {{ row.symbol }} stored {{ row.stored_growth }} live {{ row.live_growth }} dG={{ fmt(row.d_growth) }}
              </li>
            </ul>
            <div v-if="repairJobs.length" class="repair-jobs">
              <p class="subhead">关联修复任务</p>
              <ul>
                <li v-for="row in sortedRepairJobs" :key="row.job_id" :class="{ stale: isSuperseded(row) }">
                  {{ repairJobLabel(row) }} · {{ row.job_kind }} · {{ row.start_date }}–{{ row.end_date }}
                  <span v-if="shardSummary(row)"> · {{ shardSummary(row) }}</span>
                </li>
              </ul>
            </div>
            <div v-if="repairLog.length" class="repair-log">
              <p class="subhead">修复记录</p>
              <ul>
                <li v-for="(row, index) in repairLog" :key="index">
                  {{ row.method }} {{ row.container_name }}
                  <span v-if="row.exit_code != null"> exit={{ row.exit_code }}</span>
                  <span v-if="row.start"> {{ row.start }}–{{ row.end }}</span>
                  <span v-if="row.note"> {{ row.note }}</span>
                </li>
              </ul>
            </div>
            <p v-if="!detail.report?.dates_detail?.length && !worst.length && !repairJobs.length && !repairLog.length" class="empty">
              暂无逐日明细；若已点「确认刷本环境」，修复状态会出现在上方「关联修复任务」。
            </p>
          </template>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="detailOpen = false">关闭</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { createScoreAuditJob, getScoreAuditJob, listScoreAuditJobs } from '../api/scoreAudit'
import { createOpsRepairJob, listOpsRepairJobs } from '../api/opsRepair'
import {
  SCORE_AUDIT_VERDICT_LABEL,
  buildOpsRepairPayload,
  buildScoreAuditPayload,
  canQueueOpsRepair,
  defaultScoreAuditRange,
  formatAuditJobTiming,
  getRepairRollupStatus,
  isSupersededRepairJob,
  listAuditHeadline,
  needsYearConfirm,
  repairJobStatusLabel,
  repairRollupLabel,
  repairStatusHint,
  sortRepairJobsNewestFirst,
} from '../utils/scoreAuditPayload'

const universes = ['csi1000', 'hs300', 'a500', 'csi500', 'star50']
const form = reactive({
  ...defaultScoreAuditRange(),
  universe_index: 'csi1000',
  step: 2,
  sample: 12,
})
const jobs = ref([])
const repairJobsByAudit = ref({})
const selectedId = ref('')
const detail = ref(null)
const loading = ref(false)
const submitting = ref(false)
const repairing = ref(false)
const message = ref('')
const error = ref('')
const repairJobs = ref([])
const detailOpen = ref(false)
const detailLoading = ref(false)
let pollTimer = null

const worst = computed(() => detail.value?.artifact?.worst || detail.value?.report?.dates_detail?.[0]?.worst || [])
const repairLog = computed(() => detail.value?.repair_log || [])
const sortedRepairJobs = computed(() => sortRepairJobsNewestFirst(repairJobs.value))
const canRepair = computed(() =>
  canQueueOpsRepair(detail.value, { repairJobs: repairJobs.value, repairLog: repairLog.value }),
)
const repairHint = computed(() =>
  repairStatusHint(detail.value, { repairJobs: repairJobs.value, repairLog: repairLog.value }),
)

function verdictLabel(value) {
  return SCORE_AUDIT_VERDICT_LABEL[value] || value || '—'
}

function tone(value) {
  if (value === 'self_consistent' || value === 'completed') return 'ok'
  if (value === 'pending' || value === 'running') return 'wait'
  return 'bad'
}

function fmt(value) {
  if (value == null || value === '') return '—'
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : String(value)
}

function repairJobsFor(job) {
  return repairJobsByAudit.value[job?.job_id] || []
}

function rollupStatus(job) {
  return getRepairRollupStatus(job, repairJobsFor(job))
}

function rollupLabel(job) {
  return repairRollupLabel(rollupStatus(job))
}

function rollupClass(job) {
  const status = rollupStatus(job)
  if (status === 'repaired') return 'ok'
  if (status === 'repairing') return 'wait'
  if (status === 'failed' || status === 'needs_repair') return 'bad'
  return ''
}

function listHeadline(job) {
  return listAuditHeadline(job, repairJobsFor(job))
}

function listTone(job) {
  const status = rollupStatus(job)
  if (status === 'repaired') return 'ok'
  if (status === 'repairing') return 'wait'
  return job.overall_verdict || job.status
}

function isSuperseded(row) {
  return isSupersededRepairJob(row, detail.value, repairJobs.value)
}

function repairJobLabel(row) {
  return repairJobStatusLabel(row, detail.value, repairJobs.value)
}

function jobTiming(job) {
  return formatAuditJobTiming(job)
}

async function loadJobs() {
  loading.value = true
  try {
    const [auditRes, repairRes] = await Promise.all([
      listScoreAuditJobs({ limit: 20 }),
      listOpsRepairJobs({ limit: 50 }),
    ])
    jobs.value = auditRes.data || []
    const map = {}
    for (const row of repairRes.data || []) {
      const auditId = row.source_audit_job_id
      if (!auditId) continue
      if (!map[auditId]) map[auditId] = []
      map[auditId].push(row)
    }
    repairJobsByAudit.value = map
  } catch (exc) {
    error.value = exc.response?.data?.detail || exc.message || '无法加载评分自查'
  } finally {
    loading.value = false
  }
}

async function loadDetail(jobId) {
  selectedId.value = jobId
  try {
    const res = await getScoreAuditJob(jobId)
    detail.value = res.data
    try {
      const repairs = await listOpsRepairJobs({ source_audit_job_id: jobId, limit: 10 })
      repairJobs.value = repairs.data || []
      repairJobsByAudit.value = {
        ...repairJobsByAudit.value,
        [jobId]: repairJobs.value,
      }
    } catch {
      repairJobs.value = []
    }
  } catch (exc) {
    error.value = exc.response?.data?.detail || exc.message || '无法加载详情'
    detail.value = null
    throw exc
  }
}

async function openDetail(jobId) {
  detailOpen.value = true
  detailLoading.value = true
  error.value = ''
  try {
    await loadDetail(jobId)
  } finally {
    detailLoading.value = false
  }
}

async function select(jobId) {
  if (detailOpen.value) {
    detailLoading.value = true
    try {
      await loadDetail(jobId)
    } finally {
      detailLoading.value = false
    }
    return
  }
  selectedId.value = jobId
}

function shardSummary(job) {
  const shards = job?.shards || []
  if (!shards.length) return ''
  return shards.map((row) => `${row.start}:${row.end} ${row.status || ''}${row.exit_code != null ? ` exit=${row.exit_code}` : ''}`).join('；')
}

async function confirmRepair() {
  message.value = ''
  error.value = ''
  const job = detail.value
  if (!job) return
  try {
    const needsConfirm = needsYearConfirm(job.start_date, job.end_date)
    if (needsConfirm && !window.confirm(`窗口 ${job.start_date}–${job.end_date} 跨年，确认刷整段 CSI1000 growth+cycle？`)) {
      return
    }
    repairing.value = true
    const payload = buildOpsRepairPayload(job, { confirmYears: needsConfirm })
    const res = await createOpsRepairJob(payload)
    message.value = `已入队修复 ${res.data?.job_id || ''}，launcher 将自动按年切片刷库`
    await select(job.job_id)
  } catch (exc) {
    error.value = exc.response?.data?.detail || exc.message || '入队修复失败'
  } finally {
    repairing.value = false
  }
}

async function submit() {
  message.value = ''
  error.value = ''
  submitting.value = true
  try {
    const payload = buildScoreAuditPayload(form)
    const res = await createScoreAuditJob(payload)
    message.value = `已排队 ${res.data?.job_id || ''}，scorer 空闲时抽检（约每 5 分钟）`
    await loadJobs()
    if (res.data?.job_id) await openDetail(res.data.job_id)
  } catch (exc) {
    error.value = exc.response?.data?.detail || exc.message || '排队失败'
  } finally {
    submitting.value = false
  }
}

function hasLiveJobs() {
  return jobs.value.some((job) => job.status === 'pending' || job.status === 'running')
    || repairJobs.value.some((job) => job.status === 'pending' || job.status === 'running' || job.status === 'blocked')
}

async function poll() {
  if (!hasLiveJobs() && !detailOpen.value) return
  await loadJobs()
  if (detailOpen.value && selectedId.value) await select(selectedId.value)
}

onMounted(async () => {
  await loadJobs()
  pollTimer = setInterval(poll, 15000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
.score-audit {
  font-size: 12px;
  color: #2d3748;
}
.hint {
  margin: 0 0 8px;
  color: #4a5568;
  line-height: 1.45;
}
.repair {
  margin: 0 0 8px;
  color: #975a16;
  line-height: 1.45;
}
.form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: flex-end;
  margin-bottom: 8px;
}
.form label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: #718096;
  font-size: 11px;
}
.form input,
.form select {
  min-width: 0;
  padding: 4px 6px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
}
.form button {
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: #3182ce;
  color: #fff;
  cursor: pointer;
}
.form button:disabled {
  opacity: 0.6;
}
.actions {
  margin: 0 0 8px;
}
.actions button {
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: #c05621;
  color: #fff;
  cursor: pointer;
}
.subhead {
  margin: 8px 0 4px;
  font-weight: 600;
  color: #4a5568;
}
.repair-jobs ul,
.repair-log ul {
  margin: 0;
  padding-left: 16px;
  color: #4a5568;
}
.jobs {
  list-style: none;
  margin: 0;
  padding: 0;
}
.jobs li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 6px 4px;
  border-bottom: 1px dashed #edf2f7;
  cursor: pointer;
}
.jobs li:hover {
  background: #f7fafc;
}
.jobs li.active {
  background: #ebf8ff;
}
.chevron {
  margin-left: auto;
  color: #a0aec0;
  font-size: 16px;
  line-height: 1;
}
.rollup {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 6px;
}
.rollup.ok { background: #c6f6d5; color: #22543d; }
.rollup.wait { background: #feebc8; color: #7b341e; }
.rollup.bad { background: #fed7d7; color: #822727; }
.repair-jobs li.stale {
  color: #a0aec0;
  text-decoration: line-through;
}
.detail-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 15px !important;
  line-height: 1.3;
}
.detail-sub {
  font-size: 12px;
  font-weight: 400;
  color: #718096;
}
.detail-loading {
  padding: 16px 0;
  color: #718096;
  text-align: center;
}
.detail-summary {
  margin: 0 0 8px;
}
.verdict {
  font-weight: 600;
}
.verdict.ok { color: #276749; }
.verdict.wait { color: #975a16; }
.verdict.bad { color: #c53030; }
.meta { color: #718096; }
.timing { color: #a0aec0; white-space: nowrap; }
.empty, .ok { color: #718096; }
.err { color: #c53030; }
.detail {
  margin-top: 8px;
}
.detail table {
  width: 100%;
  border-collapse: collapse;
}
.detail th,
.detail td {
  text-align: left;
  padding: 4px 6px;
  border-bottom: 1px solid #edf2f7;
}
.worst {
  margin: 8px 0 0;
  padding-left: 16px;
  color: #4a5568;
}
</style>
