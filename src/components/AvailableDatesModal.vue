<template>
  <div v-if="show" class="modal-overlay" @click="emit('close')">
    <div class="modal-content available-dates-modal" @click.stop>
      <h4>选择 {{ symbol }} 的可用评分日期</h4>
      <div class="scroll-box mt-sm available-dates-scroll">
        <div v-if="availableDates.length === 0">未找到可用日期。</div>
        <div v-else>
          <div class="flex-row gap-sm mb-sm">
            <button type="button" class="btn-base btn-sm btn-gradient-green" @click="emit('select-all')">全选</button>
            <button type="button" class="btn-base btn-sm btn-gradient-gray" @click="emit('deselect-all')">全不选</button>
          </div>
          <label v-for="d in availableDates" :key="d" class="flex-row-center gap-sm pad-xs">
            <input
              type="checkbox"
              :value="d"
              :checked="selected.includes(d)"
              @change="emit('toggle', d, $event.target.checked)"
            />
            <span>{{ formatDateDisplay(d) }}</span>
          </label>
        </div>
      </div>
      <div class="available-dates-actions">
        <button type="button" class="btn-base btn-md btn-gradient-green" @click="emit('apply', selected)">应用 ({{ selected.length }})</button>
        <button type="button" class="btn-base btn-md btn-gradient-gray" @click="emit('close')">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  show: {
    type: Boolean,
    default: false
  },
  symbol: {
    type: String,
    default: ''
  },
  availableDates: {
    type: Array,
    default: () => []
  },
  selected: {
    type: Array,
    default: () => []
  },
  formatDateDisplay: {
    type: Function,
    default: value => value
  }
})

const emit = defineEmits(['close', 'select-all', 'deselect-all', 'toggle', 'apply'])
</script>

<style scoped>
.available-dates-modal {
  max-width: 520px;
}

.available-dates-scroll {
  max-height: 320px;
}

.available-dates-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
</style>
