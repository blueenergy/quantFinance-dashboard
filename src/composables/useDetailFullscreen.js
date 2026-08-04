import { onUnmounted, ref, watch } from 'vue'

export function useDetailFullscreen({ resetWhen } = {}) {
  const detailMaximized = ref(false)

  function toggleDetailFullscreen() {
    detailMaximized.value = !detailMaximized.value
  }

  function exitDetailFullscreen() {
    detailMaximized.value = false
  }

  function onDetailFullscreenKeydown(event) {
    if (event.key === 'Escape' && detailMaximized.value) {
      event.preventDefault()
      event.stopPropagation()
      exitDetailFullscreen()
    }
  }

  watch(detailMaximized, (value) => {
    document.body.style.overflow = value ? 'hidden' : ''
    if (value) {
      window.addEventListener('keydown', onDetailFullscreenKeydown, true)
    } else {
      window.removeEventListener('keydown', onDetailFullscreenKeydown, true)
    }
  })

  if (resetWhen) {
    watch(resetWhen, () => {
      detailMaximized.value = false
    })
  }

  onUnmounted(() => {
    document.body.style.overflow = ''
    window.removeEventListener('keydown', onDetailFullscreenKeydown, true)
  })

  return {
    detailMaximized,
    toggleDetailFullscreen,
    exitDetailFullscreen,
  }
}
