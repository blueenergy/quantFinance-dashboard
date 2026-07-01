const RELOAD_STORAGE_KEY = 'quant-dashboard:preload-error-reload-at'
const RELOAD_THROTTLE_MS = 30000

function readLastReloadAt(storage) {
  try {
    const value = Number(storage?.getItem(RELOAD_STORAGE_KEY) || 0)
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

function writeLastReloadAt(storage, value) {
  try {
    storage?.setItem(RELOAD_STORAGE_KEY, String(value))
  } catch {
    // Storage can be unavailable in private browsing or strict contexts.
  }
}

export function installPreloadErrorReload({
  windowRef = globalThis.window,
  storage = globalThis.window?.sessionStorage,
  now = () => Date.now(),
  reload = () => windowRef.location.reload(),
  throttleMs = RELOAD_THROTTLE_MS,
} = {}) {
  if (!windowRef?.addEventListener) return

  windowRef.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()

    const currentTime = now()
    const lastReloadAt = readLastReloadAt(storage)

    if (currentTime - lastReloadAt < throttleMs) return

    writeLastReloadAt(storage, currentTime)
    reload()
  })
}
