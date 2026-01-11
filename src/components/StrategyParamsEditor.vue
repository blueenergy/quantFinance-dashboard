<template>
  <div class="strategy-params-editor">
    <!-- 策略信息卡片 -->
    <v-card v-if="strategyInfo" class="mb-4" variant="outlined">
      <v-card-title>
        <div class="info-title">
          <span>📋 {{ strategyInfo.name }}</span>
        </div>
      </v-card-title>
      <v-card-text>
        <div class="strategy-desc mb-2" v-if="strategyInfo.summary">
          <strong>策略简介：</strong>{{ strategyInfo.summary }}
        </div>
        <div class="strategy-principle mb-2" v-if="strategyInfo.principle">
          <strong>策略原理：</strong>{{ strategyInfo.principle }}
        </div>
        <div v-if="strategyInfo.suitable_for" class="strategy-suitable mb-2">
          <strong>适用场景：</strong>{{ strategyInfo.suitable_for }}
        </div>
        <v-alert v-if="strategyInfo.risk_warning" type="warning" density="compact" class="mt-2">
          <strong>⚠️ 风险提示：</strong>{{ strategyInfo.risk_warning }}
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- 预设参数选择 -->
    <v-card v-if="presets && presets.length > 0" class="mb-4" variant="outlined">
      <v-card-title class="d-flex justify-space-between align-center">
        <span class="text-subtitle-1">🎛️ 预设参数</span>
        <v-btn 
          v-if="defaultPreset" 
          size="small" 
          variant="text" 
          color="primary"
          @click="resetToDefault"
        >
          重置为默认
        </v-btn>
      </v-card-title>
      <v-card-text>
        <v-chip-group v-model="selectedPresetIndex" column>
          <v-chip
            v-for="(preset, index) in presets"
            :key="preset.preset"
            :value="index"
            variant="outlined"
            filter
            @click="loadPreset(preset)"
          >
            <span v-if="preset.is_default" class="default-star">⭐</span>
            {{ preset.name || preset.preset || `预设${index + 1}` }}
          </v-chip>
        </v-chip-group>
        <div v-if="selectedPreset" class="preset-desc mt-2">
          <span>ℹ️ {{ selectedPreset.description || '无描述' }}</span>
        </div>
      </v-card-text>
    </v-card>

    <!-- 参数编辑表格 -->
    <v-card variant="outlined">
      <v-card-title class="text-subtitle-1">
        ⚙️ 参数配置
      </v-card-title>
      <v-card-text>
        <v-table density="compact" class="params-table">
          <thead>
            <tr>
              <th style="width: 30%">参数名</th>
              <th style="width: 30%">参数值</th>
              <th style="width: 40%">说明</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(paramDef, paramName) in paramsWithMeta" :key="paramName">
              <td>
                <strong>{{ paramName }}</strong>
              </td>
              <td>
                <!-- 数字类型 -->
                <v-text-field
                  v-if="paramDef.type === 'number'"
                  v-model.number="localParams[paramName]"
                  type="number"
                  density="compact"
                  variant="outlined"
                  hide-details
                  step="any"
                />
                <!-- 布尔类型 -->
                <v-switch
                  v-else-if="paramDef.type === 'boolean'"
                  v-model="localParams[paramName]"
                  density="compact"
                  hide-details
                  color="primary"
                />
                <!-- 字符串类型 -->
                <v-text-field
                  v-else
                  v-model="localParams[paramName]"
                  density="compact"
                  variant="outlined"
                  hide-details
                />
              </td>
              <td>
                <div class="param-desc-wrapper">
                  <span class="param-desc-text">{{ paramDef.description || '无说明' }}</span>
                  <v-tooltip v-if="paramDef.description" location="top" max-width="400">
                    <template #activator="{ props }">
                      <v-icon v-bind="props" size="small" color="info" class="help-icon">
                        mdi-help-circle-outline
                      </v-icon>
                    </template>
                    <div>{{ paramDef.description }}</div>
                  </v-tooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
    </v-card>

    <!-- JSON预览 -->
    <v-card v-if="showJsonPreview" class="mt-4" variant="outlined">
      <v-card-title class="text-subtitle-1">
        { } JSON预览
      </v-card-title>
      <v-card-text>
        <pre class="json-preview">{{ JSON.stringify(localParams, null, 2) }}</pre>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, toRefs } from 'vue'

const props = defineProps({
  strategyKey: {
    type: String,
    required: true
  },
  strategyInfo: {
    type: Object,
    default: null
  },
  presets: {
    type: Array,
    default: () => []
  },
  initialParams: {
    type: Object,
    default: () => ({})
  },
  preferredPreset: {
    type: String,
    default: ''
  },
  showJsonPreview: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:params', 'update:preset'])

// Destructure props for template access
const { strategyKey, strategyInfo, presets, initialParams, preferredPreset, showJsonPreview } = toRefs(props)

// Local state
const localParams = ref({ ...props.initialParams })
const selectedPresetIndex = ref(null)
const selectedPreset = computed(() => {
  return selectedPresetIndex.value !== null ? presets.value[selectedPresetIndex.value] : null
})

// Find default preset
const defaultPreset = computed(() => {
  return presets.value.find(p => p.is_default) || null
})

// Merge params with metadata
const paramsWithMeta = computed(() => {
  const result = {}
  const paramDefs = strategyInfo.value?.param_definitions || {}
  
  // 遍历当前参数
  Object.keys(localParams.value).forEach(paramName => {
    const value = localParams.value[paramName]
    const def = paramDefs[paramName] || {}
    
    result[paramName] = {
      value,
      type: typeof value,
      description: def.description || '',
      ...def
    }
  })
  
  return result
})

// Watch local params changes
watch(localParams, (newParams) => {
  emit('update:params', { ...newParams })
}, { deep: true })

// Select preset
function selectPreset(index, preset) {
  selectedPresetIndex.value = index
  loadPreset(preset)
}

// Extract params from params_with_desc structure
function extractParams(paramsWithDesc) {
  const result = {}
  for (const [key, config] of Object.entries(paramsWithDesc)) {
    result[key] = config.value
  }
  return result
}

// Load preset
function loadPreset(preset) {
  console.log('Loading preset:', preset)
  selectedPresetIndex.value = presets.value.findIndex(p => p.preset === preset.preset)
  // Extract values from params_with_desc structure (params field removed in Plan B)
  localParams.value = extractParams(preset.params_with_desc || {})
  emit('update:preset', preset?.preset || '')
  console.log('Preset loaded, selectedIndex:', selectedPresetIndex.value, 'params:', localParams.value)
}

// Reset to default preset
function resetToDefault() {
  if (defaultPreset.value) {
    loadPreset(defaultPreset.value)
    console.log('Reset to default preset')
  }
}

// Debug: log presets when component mounts
onMounted(() => {
  console.log('StrategyParamsEditor mounted')
  console.log('- strategyKey:', strategyKey.value)
  console.log('- presets:', presets.value)
  console.log('- initialParams:', initialParams.value)
  console.log('- preferredPreset:', preferredPreset.value)

  // Prefer an explicitly provided preset (e.g., from strategy-pool selection)
  if (preferredPreset.value) {
    const match = presets.value.find(p => p.preset === preferredPreset.value)
    if (match) {
      console.log('Auto-loading preferred preset:', match)
      loadPreset(match)
      return
    }
  }

  // If initial params are provided, keep them as-is (do not override with default preset)
  if (initialParams.value && Object.keys(initialParams.value).length > 0) {
    localParams.value = { ...initialParams.value }
    selectedPresetIndex.value = null
    console.log('Using provided initialParams; skip auto-loading default preset')
    return
  }
  
  // Auto-load default preset on mount if available
  if (defaultPreset.value) {
    console.log('Auto-loading default preset:', defaultPreset.value)
    loadPreset(defaultPreset.value)
  }
})
</script>

<style scoped>
.strategy-params-editor {
  max-width: 1000px;
}

.info-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.strategy-desc,
.strategy-principle,
.strategy-suitable {
  line-height: 1.6;
  color: #555;
}

.preset-desc {
  color: #666;
  font-style: italic;
  padding: 8px 0;
}

.default-star {
  margin-right: 4px;
  font-size: 14px;
}

.params-table {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.params-table thead th {
  background: #f5f5f5;
  font-weight: 600;
}

.param-desc-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.param-desc-text {
  font-size: 13px;
  color: #666;
}

.help-icon {
  cursor: help;
}

.json-preview {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  overflow-x: auto;
}
</style>
