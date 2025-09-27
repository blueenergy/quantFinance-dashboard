<template>
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop style="max-width:520px;">
      <h4>选择 {{ symbol }} 的可用评分日期</h4>
      <div style="max-height:320px; overflow:auto; border:1px solid #eee; padding:8px; margin-top:8px;">
        <div v-if="availableDates.length === 0">未找到可用日期。</div>
        <div v-else>
          <div style="display:flex; gap:8px; margin-bottom:8px;">
            <button @click="$emit('select-all')" class="btn-apply">全选</button>
            <button @click="$emit('deselect-all')" class="btn-cancel">全不选</button>
          </div>
          <label v-for="d in availableDates" :key="d" style="display:flex; align-items:center; gap:8px; padding:6px 4px;">
            <input type="checkbox" :value="d" :checked="selected.includes(d)" @change="$emit('toggle', d, $event.target.checked)" />
            <span>{{ formatDateDisplay(d) }}</span>
          </label>
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
        <button @click="$emit('apply', selected)" class="btn-apply">应用 ({{ selected.length }})</button>
        <button @click="$emit('close')" class="btn-cancel">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps } from 'vue'

const props = defineProps({
  show: Boolean,
  symbol: String,
  availableDates: Array,
  selected: Array,
  formatDateDisplay: Function
})
</script>

<style scoped>
/* AvailableDatesModal-specific button styles moved from StockRanking.vue */
.btn-apply, .btn-cancel {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}
.btn-apply { background: linear-gradient(135deg, #28a745, #20c997); color: white; }
.btn-cancel { background: linear-gradient(135deg, #6c757d, #545b62); color: white; }

/* Ensure modal content scroll area has small padding/visuals if needed */
.modal-content { max-width: 520px; }
.modal-content::-webkit-scrollbar { height: 8px; width: 8px; }
.modal-content::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.18); border-radius: 6px; }
</style>
