<template>
  <div class="holdings-header">
    <h3>最新持仓</h3>
    <div class="holdings-actions">
      <button type="button" :disabled="!selectedLatestPlanId || riskLoading" @click="$emit('load-risk')">
        {{ riskLoading ? '体检中…' : '风控体检' }}
      </button>
      <button
        type="button"
        class="holdings-edit-toggle"
        :class="{ active: editMode }"
        :aria-pressed="editMode ? 'true' : 'false'"
        :disabled="!hasHoldings"
        @click="$emit('update:editMode', !editMode)"
      >
        {{ editToggleLabel }}
      </button>
      <button
        v-if="editMode"
        type="button"
        :disabled="!hasManualChanges"
        @click="$emit('open-manual')"
      >
        提交手动调仓
      </button>
      <details ref="moreMenu" class="holdings-more">
        <summary>更多</summary>
        <div class="holdings-more-menu">
          <button
            type="button"
            class="danger"
            :disabled="!hasHoldings || liquidateSubmitting"
            @click="emitAndClose('open-liquidate')"
          >
            {{ isLivePortfolio ? '实盘一键清仓' : '纸面一键清仓' }}
          </button>
          <button
            v-if="isLivePortfolio"
            type="button"
            :disabled="externalManualSubmitting"
            @click="emitAndClose('open-external-manual')"
          >
            {{ externalManualSubmitting ? '补录中…' : '补录 miniQMT 手工操作' }}
          </button>
        </div>
      </details>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  selectedLatestPlanId: { type: String, default: '' },
  riskLoading: { type: Boolean, default: false },
  hasManualChanges: { type: Boolean, default: false },
  hasHoldings: { type: Boolean, default: false },
  liquidateSubmitting: { type: Boolean, default: false },
  isLivePortfolio: { type: Boolean, default: false },
  externalManualSubmitting: { type: Boolean, default: false },
  editMode: { type: Boolean, default: false },
})

const emit = defineEmits([
  'load-risk',
  'open-manual',
  'open-liquidate',
  'open-external-manual',
  'update:editMode',
])

const moreMenu = ref(null)

const editToggleLabel = computed(() => {
  if (props.editMode) return '退出手动调仓'
  if (props.hasManualChanges) return '手动调仓 · 未提交'
  return '手动调仓'
})

function emitAndClose(name) {
  if (moreMenu.value) moreMenu.value.open = false
  emit(name)
}
</script>
