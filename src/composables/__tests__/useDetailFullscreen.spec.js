import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useDetailFullscreen } from '../useDetailFullscreen'

function mountFullscreen(options = {}) {
  let api
  const Host = defineComponent({
    setup() {
      api = useDetailFullscreen(options)
      return () => null
    },
  })
  const wrapper = mount(Host)
  return { wrapper, get api() { return api } }
}

describe('useDetailFullscreen', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
  })

  it('toggles fullscreen and locks body scroll', async () => {
    const host = mountFullscreen()

    expect(host.api.detailMaximized.value).toBe(false)
    expect(document.body.style.overflow).toBe('')

    host.api.toggleDetailFullscreen()
    await Promise.resolve()

    expect(host.api.detailMaximized.value).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')

    host.api.exitDetailFullscreen()
    await Promise.resolve()

    expect(host.api.detailMaximized.value).toBe(false)
    expect(document.body.style.overflow).toBe('')
  })

  it('resets fullscreen when resetWhen changes', async () => {
    const resetWhen = ref('a')
    const host = mountFullscreen({ resetWhen })

    host.api.toggleDetailFullscreen()
    await Promise.resolve()
    expect(host.api.detailMaximized.value).toBe(true)

    resetWhen.value = 'b'
    await Promise.resolve()
    expect(host.api.detailMaximized.value).toBe(false)
  })
})
