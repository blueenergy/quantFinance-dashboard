<template>
  <div class="flex-row gap-sm justify-center mt-md mb-md" v-if="totalPages > 0">
    <button class="btn-base btn-sm btn-gradient-blue" :disabled="page <= 1" @click="$emit('change', page - 1)">上一页</button>
    <span class="text-muted">第 {{ page }} 页，共 {{ totalPages }} 页</span>
    <button class="btn-base btn-sm btn-gradient-blue" :disabled="page >= totalPages" @click="$emit('change', page + 1)">下一页</button>
  </div>
</template>
<script setup>
defineProps({
  page: { type: Number, required: true },
  totalPages: { type: Number, required: true }
})
</script>
<style scoped>
span { font-size:12px; }
</style>