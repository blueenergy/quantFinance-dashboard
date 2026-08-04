<template>
  <div v-if="open" class="drawer-overlay" @click.self="emit('close')">
    <aside class="drawer-panel" role="dialog" aria-modal="true" aria-label="新建策略对比实验" @keydown.esc.stop="emit('close')">
      <header class="drawer-head">
        <div>
          <h3>新建策略对比实验</h3>
          <p class="muted">
            {{ parsedSymbols.length }} 标的 × {{ activeCombos.length }} 组合 =
            合计 {{ totalTasks }} 个任务 · 串行执行 · 粗估约 {{ estimatedMinutes }} 分钟
          </p>
        </div>
        <button type="button" class="link-btn" @click="emit('close')">关闭 ✕</button>
      </header>

      <div class="drawer-body">
        <section class="drawer-section">
          <h4>实验定义</h4>
          <div class="form-grid">
            <label>
              实验名
              <input v-model="name" placeholder="自动生成可修改" @blur="syncDefaultName" />
            </label>
            <label class="symbols-field">
              标的代码（可多选，逗号/空格分隔）
              <textarea
                v-model="symbolsText"
                rows="2"
                placeholder="000001.SZ, 510300.SH"
                @blur="onSymbolsBlur"
              />
            </label>
            <label>
              默认资产类型
              <select v-model="assetType" @change="onSymbolsBlur">
                <option value="stock">股票</option>
                <option value="etf">ETF</option>
              </select>
              <span class="field-hint">有交易所后缀时按代码自动识别；可混选股票与 ETF</span>
            </label>
            <label>
              开始日期
              <input v-model="startDate" placeholder="YYYYMMDD" maxlength="8" />
            </label>
            <label>
              结束日期
              <input v-model="endDate" placeholder="YYYYMMDD" maxlength="8" />
            </label>
            <label>
              初始资金
              <input v-model.number="initialCash" type="number" min="10000" step="10000" />
            </label>
          </div>

          <div v-if="parsedSymbols.length" class="selected-symbols">
            <button
              v-for="code in parsedSymbols"
              :key="code"
              type="button"
              class="symbol-chip"
              :title="`移除 ${code}`"
              @click="removeSymbol(code)"
            >
              {{ code }}
              <span aria-hidden="true">×</span>
            </button>
            <button type="button" class="link-btn clear-symbols" @click="clearSymbols()">
              清空标的
            </button>
          </div>

          <div class="universe-shortcuts">
            <div class="shortcut-toolbar">
              <span class="shortcut-title">快捷填入标的</span>
              <button
                type="button"
                class="shortcut-action"
                :disabled="universeLoading"
                @click="loadWatchlistSymbols"
              >
                自选股
              </button>
              <button
                type="button"
                class="shortcut-action"
                :disabled="universeLoading"
                @click="loadFeaturedEtfs"
              >
                精选 ETF
              </button>
              <button
                v-for="universe in indexUniverses"
                :key="universe.key"
                type="button"
                class="shortcut-action"
                :disabled="universeLoading"
                @click="loadIndexUniverse(universe)"
              >
                {{ universe.label }}
              </button>
            </div>
            <p class="field-hint">
              自选股 / 指数会替换当前标的；精选 ETF 与分组全选为追加。
              指数成分较多时请配合少量策略/预设（任务上限 {{ MAX_COMPARE_TASKS }}）。
            </p>
            <p v-if="universeLoading" class="muted">正在加载标的…</p>
          </div>

          <div class="etf-shortcuts">
            <div v-for="group in featuredEtfGroups" :key="group.title" class="etf-group">
              <div class="group-title-row">
                <span class="shortcut-title">{{ group.title }}（点击加入/移除）</span>
                <button type="button" class="link-btn" @click="addEtfGroup(group)">本组全选</button>
              </div>
              <div class="shortcut-list">
                <button
                  v-for="etf in group.items"
                  :key="etf.code"
                  type="button"
                  class="shortcut-chip"
                  :class="{ active: isSymbolSelected(etf.code) }"
                  @click="toggleSymbol(etf.code, 'etf')"
                >
                  <span>{{ etf.name }}</span>
                  <small>{{ etf.code }}</small>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section class="drawer-section">
          <div class="section-head-row">
            <h4>搜索方式</h4>
            <div class="segmented">
              <button
                type="button"
              :class="{ active: searchMode === 'single' }"
              @click="setSearchMode('single')"
              >
                单次
              </button>
              <button
                type="button"
              :class="{ active: searchMode === 'grid' }"
              @click="setSearchMode('grid')"
              >
                网格
              </button>
            </div>
          </div>

          <div class="strategy-picker">
            <div class="section-head-row">
              <span class="field-label">候选策略</span>
              <div class="shortcut-toolbar compact">
                <button
                  type="button"
                  class="link-btn"
                  :disabled="searchMode === 'single'"
                  @click="selectAllStrategies"
                >
                  全选可用
                </button>
                <button type="button" class="link-btn" @click="clearStrategies">清空</button>
                <button
                  type="button"
                  class="link-btn"
                  :disabled="searchMode === 'single' || !selectedStrategyKeys.length"
                  @click="selectAllPresets"
                >
                  全选所有预设
                </button>
                <button
                  type="button"
                  class="link-btn"
                  :disabled="!selectedStrategyKeys.length"
                  @click="selectDefaultPresetsOnly"
                >
                  仅默认预设
                </button>
              </div>
            </div>
            <div class="chip-list">
              <button
                v-for="strategy in strategies"
                :key="strategy.key"
                type="button"
                class="chip"
                :class="{ active: selectedStrategyKeys.includes(strategy.key) }"
                :disabled="!strategy.can_use"
                @click="toggleStrategy(strategy.key)"
              >
                {{ strategy.name || strategy.key }}
              </button>
            </div>
          </div>

          <div v-for="state in activeStrategyStates" :key="state.strategyKey" class="strategy-card">
            <button type="button" class="strategy-card-head" @click="toggleExpanded(state.strategyKey)">
              <div>
                <strong>{{ state.strategyName }}</strong>
                <span class="muted">本策略 {{ strategyComboCount(state.strategyKey) }} 个组合</span>
              </div>
              <span>{{ state.expanded ? '收起' : '展开参数' }}</span>
            </button>

            <div class="preset-chips">
              <button
                v-for="preset in state.presets"
                :key="preset.preset"
                type="button"
                class="chip small"
                :class="{ active: state.selectedPresetKeys.includes(preset.preset) }"
                @click="togglePreset(state.strategyKey, preset.preset)"
              >
                {{ preset.name || preset.preset }}
              </button>
              <button
                v-if="searchMode === 'grid' && state.presets.length > 1"
                type="button"
                class="link-btn"
                @click="selectAllPresetsForStrategy(state.strategyKey)"
              >
                本策略全选预设
              </button>
            </div>

            <div v-if="state.expanded" class="strategy-card-body">
              <div v-for="preset in expandedPresets(state)" :key="preset.preset" class="preset-block">
                <h5>{{ preset.name || preset.preset }}</h5>
                <ParamGridTable
                  :params-with-desc="preset.params_with_desc || {}"
                  :experiment-values="experimentMap(state, preset.preset)"
                  :param-labels="paramLabels(preset)"
                  @update:experiment-values="(val) => setExperimentMap(state.strategyKey, preset.preset, val)"
                />
              </div>
            </div>
          </div>

          <div class="combo-summary">
            <span>{{ comboSummaryText }}</span>
            <button
              v-if="activeCombos.length && activeCombos.length <= 100"
              type="button"
              class="link-btn"
              @click="previewOpen = !previewOpen"
            >
              {{ previewOpen ? '收起清单' : '展开组合清单' }}
            </button>
            <span v-else-if="activeCombos.length > 100" class="muted">组合超过 100，仅显示计数</span>
          </div>

          <ul v-if="previewOpen && activeCombos.length" class="combo-preview">
            <li v-for="combo in activeCombos" :key="combo.preview_key">
              <span>{{ formatComboLine(combo) }}</span>
              <button type="button" class="link-btn" @click="excludeCombo(combo.preview_key)">移除</button>
            </li>
          </ul>
        </section>

        <p v-if="message" :class="messageLooksLikeError ? 'error' : 'info-msg'">{{ message }}</p>
        <p v-if="totalTasks > MAX_COMPARE_TASKS" class="error">
          任务数 {{ totalTasks }} 超过上限 {{ MAX_COMPARE_TASKS }}，请减少标的、策略、预设或参数档位。
        </p>
      </div>

      <footer class="drawer-foot">
        <button type="button" class="secondary-btn" @click="emit('close')">取消</button>
        <button type="button" class="primary" :disabled="!canSubmit || submitting" @click="submit">
          {{ submitting ? '提交中…' : '提交对比实验' }}
        </button>
      </footer>
    </aside>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { getWatchlist } from '../../api/user'
import { listEtfs } from '../../api/strategyLab'
import { FEATURED_ETF_GROUPS } from '../../constants/featuredEtfGroups'
import {
  COMPARE_INDEX_UNIVERSES,
  extractSymbolsFromEtfListResponse,
  extractSymbolsFromIndexResponse,
  extractSymbolsFromWatchlistResponse,
} from '../../constants/compareUniverseShortcuts'
import { useStrategyCompareForm } from '../../composables/useStrategyCompareForm'
import { buildStrategyCombos, normalizeCompareSymbols } from '../../utils/backtestComboPayload'
import { resolveParamLabel } from '../../utils/strategyLabParams'
import request from '../../utils/request'
import ParamGridTable from './ParamGridTable.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  strategies: { type: Array, default: () => [] },
  templates: { type: Object, default: () => ({}) },
  submitting: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'submit'])

const strategiesRef = computed(() => props.strategies)
const templatesRef = computed(() => props.templates)

const formApi = useStrategyCompareForm({ strategies: strategiesRef, templates: templatesRef })

const {
  searchMode,
  name,
  symbolsText,
  parsedSymbols,
  assetType,
  startDate,
  endDate,
  initialCash,
  selectedStrategyKeys,
  strategyStates,
  excludedPreviewKeys,
  message,
  activeStrategyStates,
  activeCombos,
  totalTasks,
  estimatedSeconds,
  canSubmit,
  toggleStrategy,
  selectAllStrategies,
  clearStrategies,
  selectAllPresets,
  selectAllPresetsForStrategy,
  selectDefaultPresetsOnly,
  ensureStrategyState,
  buildPayload,
  syncDefaultName,
  addSymbols,
  replaceSymbols,
  clearSymbols,
  removeSymbol,
  toggleSymbol,
  MAX_COMPARE_TASKS,
} = formApi

const featuredEtfGroups = FEATURED_ETF_GROUPS
const indexUniverses = COMPARE_INDEX_UNIVERSES
const previewOpen = ref(false)
const universeLoading = ref(false)

const estimatedMinutes = computed(() => Math.max(1, Math.ceil(estimatedSeconds.value / 60)))

const messageLooksLikeError = computed(() => {
  const text = String(message.value || '')
  return /失败|无效|超过|只能|请先|为空|未能|没有可用/.test(text)
})

const comboSummaryText = computed(() => {
  const parts = activeStrategyStates.value.map((s) => {
    const count = strategyComboCount(s.strategyKey)
    return `${s.strategyName} ${count}`
  })
  if (!parts.length) return '未选择策略'
  return `分策略：${parts.join(' + ')} · 合计 ${activeCombos.value.length} 个组合`
})

watch(parsedSymbols, () => syncDefaultName(), { deep: true })

function onSymbolsBlur() {
  const normalized = normalizeCompareSymbols(symbolsText.value, assetType.value)
  symbolsText.value = normalized.join(', ')
  syncDefaultName()
}

function isSymbolSelected(code) {
  const normalized = normalizeCompareSymbols([code], 'etf')[0]
  return Boolean(normalized && parsedSymbols.value.includes(normalized))
}

function addEtfGroup(group) {
  const codes = (group?.items || []).map((item) => item.code)
  const next = addSymbols(codes, 'etf')
  message.value = `已追加 ${group.title}（当前 ${next.length} 只标的）`
}

function reportUniverseResult(label, next, { append = false } = {}) {
  const comboCount = activeCombos.value.length || 1
  const projected = next.length * comboCount
  let text = append
    ? `已追加${label}（当前 ${next.length} 只标的）`
    : `已填入${label} ${next.length} 只标的`
  if (projected > MAX_COMPARE_TASKS) {
    text += `；按当前 ${comboCount} 个组合将产生 ${projected} 个任务，超过上限 ${MAX_COMPARE_TASKS}，请减少组合或标的`
  }
  message.value = text
}

async function loadWatchlistSymbols() {
  universeLoading.value = true
  try {
    const payload = await getWatchlist()
    const symbols = extractSymbolsFromWatchlistResponse(payload)
    if (!symbols.length) {
      message.value = '自选股为空'
      return
    }
    const next = replaceSymbols(symbols, 'stock')
    reportUniverseResult('自选股', next)
  } catch (err) {
    message.value = err?.message || '加载自选股失败'
  } finally {
    universeLoading.value = false
  }
}

async function loadFeaturedEtfs() {
  universeLoading.value = true
  try {
    let codes = []
    try {
      const payload = await listEtfs({ featured: true, sort: 'total_share', limit: 80 })
      codes = extractSymbolsFromEtfListResponse(payload)
    } catch {
      codes = []
    }
    if (!codes.length) {
      codes = featuredEtfGroups.flatMap((group) => group.items.map((item) => item.code))
    }
    const next = addSymbols(codes, 'etf')
    reportUniverseResult('精选 ETF', next, { append: true })
  } catch (err) {
    message.value = err?.message || '加载精选 ETF 失败'
  } finally {
    universeLoading.value = false
  }
}

async function loadIndexUniverse(universe) {
  universeLoading.value = true
  try {
    const payload = await request({ method: 'get', url: universe.path })
    const symbols = extractSymbolsFromIndexResponse(payload)
    if (!symbols.length) {
      message.value = `未能加载 ${universe.label} 成分股`
      return
    }
    const next = replaceSymbols(symbols, universe.assetType || 'stock')
    reportUniverseResult(universe.label, next)
  } catch (err) {
    message.value = err?.message || `加载 ${universe.label} 失败`
  } finally {
    universeLoading.value = false
  }
}

function setSearchMode(mode) {
  searchMode.value = mode
  if (mode === 'single' && selectedStrategyKeys.value.length > 1) {
    const first = selectedStrategyKeys.value[0]
    selectedStrategyKeys.value = [first]
    const keep = strategyStates.value[first]
    strategyStates.value = keep ? { [first]: keep } : {}
  }
}

function toggleExpanded(strategyKey) {
  const state = ensureStrategyState(strategyKey)
  state.expanded = !state.expanded
}

function togglePreset(strategyKey, presetKey) {
  const state = ensureStrategyState(strategyKey)
  const idx = state.selectedPresetKeys.indexOf(presetKey)
  if (searchMode.value === 'single') {
    state.selectedPresetKeys = [presetKey]
    return
  }
  if (idx >= 0) {
    if (state.selectedPresetKeys.length <= 1) return
    state.selectedPresetKeys.splice(idx, 1)
  } else {
    state.selectedPresetKeys.push(presetKey)
  }
}

function expandedPresets(state) {
  return state.presets.filter((p) => state.selectedPresetKeys.includes(p.preset))
}

function experimentMap(state, presetKey) {
  return state.experimentValuesByPreset[presetKey] || {}
}

function setExperimentMap(strategyKey, presetKey, values) {
  const state = ensureStrategyState(strategyKey)
  state.experimentValuesByPreset = {
    ...state.experimentValuesByPreset,
    [presetKey]: values,
  }
}

function paramLabels(preset) {
  const labels = {}
  const desc = preset.params_with_desc || {}
  for (const key of Object.keys(desc)) {
    labels[key] = resolveParamLabel(key, desc)
  }
  return labels
}

function strategyComboCount(strategyKey) {
  const state = strategyStates.value[strategyKey]
  if (!state) return 0
  const presets = templatesRef.value[strategyKey] || []
  return buildStrategyCombos({
    strategyKey,
    presets,
    selectedPresetKeys: state.selectedPresetKeys,
    experimentValuesByPreset: state.experimentValuesByPreset,
  }).filter((c) => !excludedPreviewKeys.value.includes(c.preview_key)).length
}

function formatComboLine(combo) {
  const parts = [combo.strategy_key, combo.preset || 'default']
  const params = combo.strategy_params || {}
  const diff = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ')
  if (diff) parts.push(diff)
  return parts.join(' · ')
}

function excludeCombo(previewKey) {
  if (!excludedPreviewKeys.value.includes(previewKey)) {
    excludedPreviewKeys.value.push(previewKey)
  }
}

function submit() {
  const payload = buildPayload()
  if (!payload) return
  emit('submit', payload)
}
</script>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  justify-content: flex-end;
  z-index: 1200;
}

.drawer-panel {
  width: min(720px, 100%);
  height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 24px rgba(15, 23, 42, 0.12);
}

.drawer-head,
.drawer-foot {
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.drawer-foot {
  border-bottom: none;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.drawer-body {
  flex: 1;
  overflow: auto;
  padding: 16px 20px;
}

.drawer-section + .drawer-section {
  margin-top: 20px;
}

.form-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-weight: 600;
  color: #334155;
  font-size: 13px;
}

.symbols-field {
  grid-column: 1 / -1;
}

input,
select,
textarea {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
}

textarea {
  resize: vertical;
  min-height: 56px;
}

.field-hint {
  font-size: 11px;
  font-weight: 400;
  color: #94a3b8;
}

.selected-symbols {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
  align-items: center;
}

.clear-symbols {
  margin-left: 4px;
}

.universe-shortcuts {
  margin-top: 12px;
}

.shortcut-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.shortcut-toolbar.compact {
  justify-content: flex-end;
}

.shortcut-action {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}

.shortcut-action:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.group-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.symbol-chip {
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.info-msg {
  color: #1d4ed8;
  margin-top: 12px;
}

.muted {
  color: #64748b;
  font-weight: 400;
}

.etf-shortcuts {
  margin-top: 12px;
}

.etf-group + .etf-group {
  margin-top: 8px;
}

.shortcut-title {
  color: #64748b;
  font-size: 12px;
}

.shortcut-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.shortcut-chip {
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 8px;
  padding: 6px 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  font-size: 12px;
}

.shortcut-chip.active {
  border-color: #2563eb;
  background: #eff6ff;
  color: #1d4ed8;
}

.section-head-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.segmented {
  display: flex;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  overflow: hidden;
}

.segmented button {
  border: none;
  background: #fff;
  padding: 6px 14px;
  cursor: pointer;
}

.segmented button.active {
  background: #0f6bdc;
  color: #fff;
}

.chip-list,
.preset-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.chip {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 999px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
}

.chip.active {
  background: #eff6ff;
  border-color: #2563eb;
  color: #1d4ed8;
}

.chip.small {
  font-size: 12px;
  padding: 4px 10px;
}

.strategy-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-top: 12px;
  padding: 12px;
}

.strategy-card-head {
  width: 100%;
  border: none;
  background: transparent;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  padding: 0;
  text-align: left;
}

.strategy-card-body {
  margin-top: 12px;
}

.preset-block + .preset-block {
  margin-top: 16px;
}

.combo-summary {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 13px;
}

.combo-preview {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  max-height: 200px;
  overflow: auto;
}

.combo-preview li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 12px;
}

.error {
  color: #b91c1c;
  margin-top: 12px;
}

.primary {
  border: 1px solid #0f6bdc;
  background: #0f6bdc;
  color: #fff;
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
}

.secondary-btn {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
}

.link-btn {
  border: none;
  background: transparent;
  color: #0f6bdc;
  cursor: pointer;
  text-decoration: underline;
  font: inherit;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
