import { ref } from 'vue'
import { llmRiskTitle } from './usePortfolioPlanFormat'
import { copyTextToClipboard } from '../utils/clipboard'

export const LLM_FONT_MIN = 12
export const LLM_FONT_MAX = 30
const LLM_FONT_STEP = 2
const LLM_FONT_STORAGE_KEY = 'planLlmRiskFontPx'
const LLM_FONT_DEFAULT = 15

function loadLlmFontPx() {
  if (typeof localStorage === 'undefined') return LLM_FONT_DEFAULT
  const raw = Number(localStorage.getItem(LLM_FONT_STORAGE_KEY))
  if (Number.isFinite(raw) && raw >= LLM_FONT_MIN && raw <= LLM_FONT_MAX) return raw
  return LLM_FONT_DEFAULT
}

// Shared state/behaviour for the expandable, zoomable LLM event-risk detail
// panel used across plan/holdings/bench tables. The font size is persisted so
// the reader's preference carries across panels and sessions.
export function useLlmRiskDetail() {
  const detail = ref(null)
  const copiedKey = ref('')
  const fontPx = ref(loadLlmFontPx())
  let copyTimer = null

  function persistFontPx() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LLM_FONT_STORAGE_KEY, String(fontPx.value))
    }
  }

  function incLlmFont() {
    fontPx.value = Math.min(LLM_FONT_MAX, fontPx.value + LLM_FONT_STEP)
    persistFontPx()
  }

  function decLlmFont() {
    fontPx.value = Math.max(LLM_FONT_MIN, fontPx.value - LLM_FONT_STEP)
    persistFontPx()
  }

  function toggleLlmDetail({ key, symbol = '', name = '', risk } = {}) {
    if (!key) return
    if (detail.value?.key === key) {
      detail.value = null
      return
    }
    detail.value = { key, symbol, name, risk, text: llmRiskTitle(risk) }
  }

  function closeLlmDetail() {
    detail.value = null
  }

  async function copyLlmText(risk, key) {
    const ok = await copyTextToClipboard(llmRiskTitle(risk))
    if (!ok) return
    copiedKey.value = key
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      if (copiedKey.value === key) copiedKey.value = ''
    }, 2000)
  }

  return {
    detail,
    copiedKey,
    fontPx,
    LLM_FONT_MIN,
    LLM_FONT_MAX,
    incLlmFont,
    decLlmFont,
    toggleLlmDetail,
    closeLlmDetail,
    copyLlmText,
  }
}
