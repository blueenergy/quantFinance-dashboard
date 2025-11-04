<template>
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
  <div class="modal-content max-w-520" @click.stop>
      <h4>选择 {{ symbol }} 的可用评分日期</h4>
  <div class="scroll-box mt-sm">
        <div v-if="availableDates.length === 0">未找到可用日期。</div>
        <div v-else>
          <div class="flex-row gap-sm mb-sm">
            <button @click="$emit('select-all')" class="btn-base btn-sm btn-gradient-green">全选</button>
            <button @click="$emit('deselect-all')" class="btn-base btn-sm btn-gradient-gray">全不选</button>
          </div>
          <label v-for="d in availableDates" :key="d" class="flex-row-center gap-sm pad-xs">
            <input type="checkbox" :value="d" :checked="selected.includes(d)" @change="$emit('toggle', d, $event.target.checked)" />
            <span>{{ formatDateDisplay(d) }}</span>
          </label>
        </div>
      </div>
  <div class="flex-row gap-sm justify-end mt-md">
        <button @click="$emit('apply', selected)" class="btn-base btn-sm btn-gradient-green">应用 ({{ selected.length }})</button>
        <button @click="$emit('close')" class="btn-base btn-sm btn-gradient-gray">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  show: Boolean,
  symbol: String,
  availableDates: Array,
  selected: Array,
  formatDateDisplay: Function
})
</script>

<style scoped>
/* Ensure modal content scroll area has small padding/visuals if needed */
.modal-content { max-width: 520px; }
.modal-content::-webkit-scrollbar { height: 8px; width: 8px; }
.modal-content::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.18); border-radius: 6px; }
</style>
