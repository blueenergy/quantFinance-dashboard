/**
 * Wait until an ECharts host element has a non-zero layout box.
 * Lazy panels / v-window / v-show often leave clientWidth/Height at 0 for
 * one or more frames after mount; calling echarts.init then logs warnings.
 */
export function isChartDomReady(el) {
  return Boolean(el && el.clientWidth >= 2 && el.clientHeight >= 2)
}

function waitAnimationFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  })
}

export async function waitForChartDom(el, { tries = 8, delayMs = 50 } = {}) {
  if (!el) return false
  if (isChartDomReady(el)) return true
  await waitAnimationFrame()
  if (isChartDomReady(el)) return true
  for (let i = 0; i < tries; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    if (isChartDomReady(el)) return true
  }
  return isChartDomReady(el)
}
