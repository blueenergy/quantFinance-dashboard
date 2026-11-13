<template>
  <section class="workbench-search">
    <div>
      <p class="eyebrow">Stock Workbench</p>
      <h2>股票研究工作台</h2>
      <p>以单只股票为中心，集中查看量化评分、财务快照和 AI 深度分析。</p>
    </div>
    <div class="stock-input-panel">
      <div class="stock-code-row">
        <StockSearchInput
          :model-value="modelValue"
          input-id="stock-workbench-symbol-input"
          label="输入股票代码 / 名称 / 拼音"
          placeholder="例如 600519、平安银行、PAYH、600519.SH"
          density="comfortable"
          tone="on-light"
          @update:model-value="$emit('update:modelValue', $event)"
          @select="$emit('select', $event)"
          @submit="$emit('submit')"
        />
        <v-btn
          color="primary"
          size="large"
          :loading="loading"
          @click="$emit('submit')"
        >
          加载工作台
        </v-btn>
      </div>
      <div class="quick-symbols">
        <span>快速示例</span>
        <button
          v-for="symbol in exampleSymbols"
          :key="symbol"
          type="button"
          @click="$emit('load-symbol', symbol)"
        >
          {{ symbol }}
        </button>
      </div>
      <div v-if="recentStocks.length" class="quick-symbols recent-symbols">
        <span>最近使用</span>
        <button
          v-for="item in recentStocks"
          :key="item.symbol"
          type="button"
          class="recent-stock-btn"
          :title="item.symbol"
          @click="$emit('load-symbol', item.symbol)"
        >
          <strong>{{ item.name || item.symbol }}</strong>
          <small v-if="item.name">{{ item.symbol }}</small>
        </button>
        <button type="button" class="clear-recent-btn" @click="$emit('clear-recent')">
          清空
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import StockSearchInput from '../StockSearchInput.vue'

defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  loading: {
    type: Boolean,
    default: false,
  },
  recentStocks: {
    type: Array,
    default: () => [],
  },
  exampleSymbols: {
    type: Array,
    default: () => ['600519.SH', '000858.SZ', '000001.SZ'],
  },
})

defineEmits(['update:modelValue', 'select', 'submit', 'load-symbol', 'clear-recent'])
</script>

<style scoped>
.workbench-search {
  align-items: center;
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: 18px;
  box-shadow: var(--surface-shadow);
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 460px);
  margin-bottom: 18px;
  padding: 22px;
}
.eyebrow {
  color: var(--color-primary);
  font-size: 12px;
  letter-spacing: .08em;
  margin: 0 0 5px;
  text-transform: uppercase;
}
h2 {
  margin: 0;
}
.workbench-search p:not(.eyebrow) {
  color: var(--text-muted);
  margin: 7px 0 0;
}
.stock-input-panel {
  display: grid;
  gap: 12px;
}
.stock-code-row {
  align-items: center;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr) auto;
}
.quick-symbols {
  align-items: center;
  color: var(--text-muted);
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 13px;
}
.quick-symbols button {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  color: #1d4ed8;
  cursor: pointer;
  padding: 5px 10px;
}
.quick-symbols button:hover {
  background: #dbeafe;
}
.quick-symbols .recent-stock-btn {
  align-items: flex-start;
  border-radius: 12px;
  display: inline-flex;
  flex-direction: column;
  gap: 1px;
  line-height: 1.2;
  padding: 6px 10px;
}
.recent-stock-btn strong {
  color: #1d4ed8;
  font-size: 13px;
}
.recent-stock-btn small {
  color: var(--text-muted);
  font-size: 11px;
  opacity: .88;
}
@media (max-width: 980px) {
  .workbench-search,
  .stock-code-row {
    grid-template-columns: 1fr;
  }
}
</style>
