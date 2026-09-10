<template>
  <div class="score-audit">
    <p class="hint">
      抽查本环境 <code>stock_scores</code> 是否还等于当前 scorer。过期就刷<strong>这一套</strong>库，不必和另一套环境对账。
    </p>
    <p v-if="repairHint" class="repair">{{ repairHint }}</p>
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
        @click="select(job.job_id)"
      >
        <span class="verdict" :class="tone(job.overall_verdict || job.status)">
          {{ job.overall_verdict ? verdictLabel(job.overall_verdict) : job.status }}
        </span>
        <span class="meta">
          {{ job.start_date }}–{{ job.end_date }} · {{ job.universe_index }} · {{ job.source }}
        </span>
      </li>
    </ul>
    <p v-if="!loading && !jobs.length" class="empty">还没有自查记录。周一 08:30 会抽最近 40 天，也可以上面排队。</p>

    <div v-if="detail" class="detail">
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
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { createScoreAuditJob, getScoreAuditJob, listScoreAuditJobs } from '../api/scoreAudit'
import {
  SCORE_AUDIT_VERDICT_LABEL,
  buildScoreAuditPayload,
  defaultScoreAuditRange,
} from '../utils/scoreAuditPayload'

const universes = ['csi1000', 'hs300', 'a500', 'csi500', 'star50']
const form = reactive({
  ...defaultScoreAuditRange(),
  universe_index: 'csi1000',
  step: 2,
  sample: 12,
})
const jobs = ref([])
const selectedId = ref('')
const detail = ref(null)
const loading = ref(false)
const submitting = ref(false)
const message = ref('')
const error = ref('')
let pollTimer = null

const worst = computed(() => detail.value?.artifact?.worst || detail.value?.report?.dates_detail?.[0]?.worst || [])
const repairHint = computed(() => {
  const verdict = detail.value?.overall_verdict || ''
  if (!String(verdict).includes('stale')) return ''
  const start = detail.value?.start_date || form.start_date.replace(/-/g, '')
  const end = detail.value?.end_date || form.end_date.replace(/-/g, '')
  return `过期不要进 quant-scorer。k8s：python -m tools.ops.audit_stored_scores --repair --start-date ${start} --end-date ${end} --apply`
})

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

async function loadJobs() {
  loading.value = true
  try {
    const res = await listScoreAuditJobs({ limit: 20 })
    jobs.value = res.data || []
  } catch (exc) {
    error.value = exc.response?.data?.detail || exc.message || '无法加载评分自查'
  } finally {
    loading.value = false
  }
}

async function select(jobId) {
  selectedId.value = jobId
  try {
    const res = await getScoreAuditJob(jobId)
    detail.value = res.data
  } catch (exc) {
    error.value = exc.response?.data?.detail || exc.message || '无法加载详情'
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
    if (res.data?.job_id) await select(res.data.job_id)
  } catch (exc) {
    error.value = exc.response?.data?.detail || exc.message || '排队失败'
  } finally {
    submitting.value = false
  }
}

function hasLiveJobs() {
  return jobs.value.some((job) => job.status === 'pending' || job.status === 'running')
}

async function poll() {
  if (!hasLiveJobs() && !selectedId.value) return
  await loadJobs()
  if (selectedId.value) await select(selectedId.value)
}

onMounted(async () => {
  await loadJobs()
  if (jobs.value[0]?.job_id) await select(jobs.value[0].job_id)
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
.jobs {
  list-style: none;
  margin: 0;
  padding: 0;
}
.jobs li {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 4px;
  border-bottom: 1px dashed #edf2f7;
  cursor: pointer;
}
.jobs li.active {
  background: #ebf8ff;
}
.verdict {
  font-weight: 600;
}
.verdict.ok { color: #276749; }
.verdict.wait { color: #975a16; }
.verdict.bad { color: #c53030; }
.meta { color: #718096; }
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
