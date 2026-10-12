import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { createModelTrainingJob } from '../api/modelTraining'
import { formatResearchApiError } from '../utils/portfolioResearchPayload'
import { buildModelTrainingPayload, defaultModelTrainingForm } from '../utils/modelTrainingPayload'

export function useModelTrainingForm({
  message,
  errorMessage,
  loadJobs,
  selectJob,
} = {}) {
  const form = ref(defaultModelTrainingForm())
  const drawerOpen = ref(false)
  const submitting = ref(false)

  const drawerTitle = computed(() => '新建模型训练')
  const drawerSubtitle = computed(() => '提交后由 quant-model-trainer worker 异步执行 walk-forward 评估。')
  const submitButtonLabel = computed(() => (submitting.value ? '提交中...' : '创建任务'))

  function openCreateDrawer() {
    form.value = defaultModelTrainingForm()
    drawerOpen.value = true
  }

  function closeDrawer() {
    drawerOpen.value = false
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
      if (message) message.value = jobId ? `已创建训练任务 ${jobId}` : '已创建训练任务'
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
    submitting,
    drawerTitle,
    drawerSubtitle,
    submitButtonLabel,
    openCreateDrawer,
    closeDrawer,
    onDrawerFormUpdate,
    submitJobForm,
  }
}
