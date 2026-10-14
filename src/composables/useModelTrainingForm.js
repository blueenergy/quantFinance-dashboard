import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { createModelTrainingJob, listModelTrainingSnapshots } from '../api/modelTraining'
import { formatResearchApiError } from '../utils/portfolioResearchPayload'
import {
  buildModelTrainingPayload,
  defaultModelTrainingForm,
  formFromJobParams,
  withModelTrainingRerunNameSuffix,
} from '../utils/modelTrainingPayload'

export const MODEL_TRAINING_LOAD_PARAMS_HINT =
  '将当前任务参数填入侧栏，可调整后提交新任务（不修改原任务）'

export function useModelTrainingForm({
  selectedJob,
  message,
  errorMessage,
  loadJobs,
  selectJob,
} = {}) {
  const form = ref(defaultModelTrainingForm())
  const drawerOpen = ref(false)
  const drawerMode = ref('create')
  const formSourceJobId = ref('')
  const submitting = ref(false)
  const snapshots = ref([])
  const snapshotsLoading = ref(false)

  const drawerTitle = computed(() => (
    drawerMode.value === 'rerun' ? '基于原参数新建训练' : '新建模型训练'
  ))
  const drawerSubtitle = computed(() => {
    if (drawerMode.value === 'rerun' && formSourceJobId.value) {
      return `来源任务 ${formSourceJobId.value} · 提交后创建新任务，原任务与结果不变`
    }
    return '提交后由 quant-model-trainer worker 异步执行 walk-forward 评估。'
  })
  const submitButtonLabel = computed(() => {
    if (submitting.value) return '提交中...'
    return drawerMode.value === 'rerun' ? '提交新任务' : '创建任务'
  })

  async function loadSnapshots() {
    snapshotsLoading.value = true
    try {
      const res = await listModelTrainingSnapshots({ limit: 100 })
      snapshots.value = Array.isArray(res.data) ? res.data : []
    } catch (err) {
      snapshots.value = []
      if (errorMessage) {
        errorMessage.value = formatResearchApiError(err, '加载数据快照列表失败')
      }
    } finally {
      snapshotsLoading.value = false
    }
  }

  function openDrawer(mode) {
    drawerMode.value = mode
    drawerOpen.value = true
    void loadSnapshots()
  }

  function openCreateDrawer() {
    form.value = defaultModelTrainingForm()
    formSourceJobId.value = ''
    openDrawer('create')
  }

  function closeDrawer() {
    drawerOpen.value = false
    formSourceJobId.value = ''
    drawerMode.value = 'create'
  }

  function loadParamsFromSelectedJob() {
    const job = selectedJob?.value
    if (!job) return
    const loaded = formFromJobParams(job.params || {}, job.name)
    form.value = {
      ...loaded,
      name: withModelTrainingRerunNameSuffix(loaded.name),
    }
    formSourceJobId.value = job.job_id
    if (errorMessage) errorMessage.value = ''
    if (message) {
      message.value = `已加载任务 ${job.job_id} 的参数，可调整后提交新任务`
    }
    openDrawer('rerun')
  }

  function onDrawerEscape(event) {
    if (event.key === 'Escape' && drawerOpen.value) closeDrawer()
  }

  onMounted(() => {
    window.addEventListener('keydown', onDrawerEscape)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onDrawerEscape)
  })

  async function submitJobForm() {
    submitting.value = true
    if (message) message.value = ''
    if (errorMessage) errorMessage.value = ''
    try {
      const payload = buildModelTrainingPayload(form.value)
      const res = await createModelTrainingJob(payload)
      const jobId = res.data?.job_id
      const sourceId = formSourceJobId.value
      if (message) {
        if (sourceId && jobId) {
          message.value = `已基于任务 ${sourceId} 创建新训练 ${jobId}`
        } else if (jobId) {
          message.value = `已创建训练任务 ${jobId}`
        } else {
          message.value = '已创建训练任务'
        }
      }
      closeDrawer()
      await loadJobs()
      if (jobId) await selectJob(jobId, { scrollDetail: true })
    } catch (err) {
      if (errorMessage) {
        errorMessage.value = formatResearchApiError(err, '创建训练任务失败')
      }
    } finally {
      submitting.value = false
    }
  }

  function onDrawerFormUpdate(patch) {
    form.value = { ...form.value, ...patch }
  }

  return {
    form,
    drawerOpen,
    drawerMode,
    formSourceJobId,
    submitting,
    snapshots,
    snapshotsLoading,
    drawerTitle,
    drawerSubtitle,
    submitButtonLabel,
    loadParamsHint: MODEL_TRAINING_LOAD_PARAMS_HINT,
    openCreateDrawer,
    closeDrawer,
    loadParamsFromSelectedJob,
    onDrawerFormUpdate,
    submitJobForm,
  }
}
