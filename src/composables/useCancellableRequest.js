import { ref, onUnmounted } from 'vue'

/** 统一请求代数 + AbortController，快速切换 Tab 或重复刷新时取消旧请求。 */
export function useCancellableRequest() {
  const requestSeq = ref(0)
  let currentController = null

  function beginRequest() {
    requestSeq.value += 1
    const seq = requestSeq.value
    if (currentController) {
      try {
        currentController.abort()
      } catch {
        /* no-op */
      }
    }
    const controller = new AbortController()
    currentController = controller
    const isCurrent = () =>
      requestSeq.value === seq && currentController === controller
    return { seq, signal: controller.signal, isCurrent }
  }

  function abortAll() {
    if (currentController) {
      try {
        currentController.abort()
      } catch {
        /* no-op */
      }
      currentController = null
    }
  }

  onUnmounted(abortAll)

  return { beginRequest, abortAll, requestSeq }
}
