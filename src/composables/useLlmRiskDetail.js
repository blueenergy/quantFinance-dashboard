import { ref } from 'vue'
import { llmRiskTitle } from './usePortfolioPlanFormat'
import { copyTextToClipboard } from '../utils/clipboard'
import {
  addManualSymbolRisk,
  confirmSymbolRiskResolution,
  resolveSymbolRisk,
} from '../api/symbolRisk'

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
export function useLlmRiskDetail({ onRiskChanged } = {}) {
  const detail = ref(null)
  const copiedKey = ref('')
  const fontPx = ref(loadLlmFontPx())
  const actionBusy = ref(false)
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

  function computePopoverPos(event) {
    const rect = event?.currentTarget?.getBoundingClientRect?.()
    if (!rect || typeof window === 'undefined') return null
    const margin = 12
    const gap = 6
    const maxH = 520
    const width = Math.min(620, window.innerWidth - margin * 2)
    let left = rect.left
    if (left + width > window.innerWidth - margin) left = window.innerWidth - margin - width
    if (left < margin) left = margin
    let top = rect.bottom + gap
    if (top + maxH > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - margin - maxH)
    }
    return { top, left, width, maxHeight: maxH }
  }

  function toggleLlmDetail({ key, symbol = '', name = '', risk, event, planId = '' } = {}) {
    if (!key) return
    if (detail.value?.key === key) {
      detail.value = null
      return
    }
    detail.value = {
      key,
      symbol,
      name,
      risk,
      planId,
      text: llmRiskTitle(risk),
      pos: computePopoverPos(event),
    }
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

  async function notifyChanged() {
    if (typeof onRiskChanged === 'function') {
      await onRiskChanged()
    }
  }

  async function confirmResolution(finding) {
    const symbol = detail.value?.symbol
    const findingKey = finding?.finding_key
    if (!symbol || !findingKey || actionBusy.value) return
    actionBusy.value = true
    try {
      await confirmSymbolRiskResolution(symbol, findingKey, {
        plan_id: detail.value?.planId || undefined,
        reason: finding?.suggested_resolution?.reason || '',
      })
      closeLlmDetail()
      await notifyChanged()
    } finally {
      actionBusy.value = false
    }
  }

  async function resolveFinding(finding) {
    const symbol = detail.value?.symbol
    const findingKey = finding?.finding_key
    if (!symbol || !findingKey || actionBusy.value) return
    actionBusy.value = true
    try {
      await resolveSymbolRisk(symbol, findingKey, {
        plan_id: detail.value?.planId || undefined,
        reason: 'manual_resolve_from_panel',
      })
      closeLlmDetail()
      await notifyChanged()
    } finally {
      actionBusy.value = false
    }
  }

  async function manualAddRisk(payload) {
    const symbol = detail.value?.symbol
    if (!symbol || actionBusy.value) return
    actionBusy.value = true
    try {
      await addManualSymbolRisk(symbol, {
        severity: payload?.severity || 'medium',
        summary: payload?.summary || '',
        detail: payload?.detail || '',
        resolution_mode: 'event',
      })
      closeLlmDetail()
      await notifyChanged()
    } finally {
      actionBusy.value = false
    }
  }

  return {
    detail,
    copiedKey,
    fontPx,
    actionBusy,
    LLM_FONT_MIN,
    LLM_FONT_MAX,
    incLlmFont,
    decLlmFont,
    toggleLlmDetail,
    closeLlmDetail,
    copyLlmText,
    confirmResolution,
    resolveFinding,
    manualAddRisk,
  }
}
