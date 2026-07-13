import { watch, onMounted, onUnmounted } from 'vue'

/** 在浏览器 Tab 隐藏或主 Shell Tab 不可见时暂停轮询。 */
export function useVisibilityAwarePolling(tick, intervalMs, isActiveRef) {
  let timer = null

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function start() {
    stop()
    void tick()
    timer = setInterval(tick, intervalMs)
  }

  function sync() {
    const tabVisible = isActiveRef ? isActiveRef.value !== false : true
    if (!document.hidden && tabVisible) start()
    else stop()
  }

  if (isActiveRef) {
    watch(isActiveRef, sync)
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', sync)
    sync()
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', sync)
    stop()
  })

  return { start, stop, sync }
}
