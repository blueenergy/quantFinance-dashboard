<template>
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content score-detail-modal" @click.stop>
      <h4>{{ stock?.symbol }} - {{ stock?.name }} 评分详情</h4>
      <div class="score-detail-content">
        <div class="score-item total-score">
          <span class="score-label">总分</span>
          <span class="score-value" :style="getScoreStyle(stock?.composite_score)">{{ stock?.composite_score }}</span>
        </div>
        <div class="score-breakdown">
          <div class="score-item">
            <span class="score-label">周期评分</span>
            <span class="score-value cycle">{{ stock?.cycle_score }}</span>
            <span class="score-weight">(权重: 25%)</span>
          </div>
          <div class="score-item">
            <span class="score-label">成长评分</span>
            <span class="score-value growth">{{ stock?.growth_score }}</span>
            <span class="score-weight">(权重: 25%)</span>
          </div>
          <div class="score-item">
            <span class="score-label">基本面评分</span>
            <span class="score-value fundamental">{{ stock?.fundamental_score }}</span>
            <span class="score-weight">(权重: 35%)</span>
          </div>
          <div class="score-item">
            <span class="score-label">价值评分</span>
            <span class="score-value value">{{ stock?.value_score }}</span>
            <span class="score-weight">(权重: 35%)</span>
          </div>
          <div class="score-item">
            <span class="score-label">技术面评分</span>
            <span class="score-value technical">{{ stock?.technical_score }}</span>
            <span class="score-weight">(权重: 25%)</span>
          </div>
          <div class="score-item">
            <span class="score-label">资金流评分</span>
            <span class="score-value money">{{ stock?.money_flow_score }}</span>
            <span class="score-weight">(权重: 15%)</span>
          </div>
        </div>
        <div class="score-detail-actions">
          <button @click="$emit('view-chart', stock?.symbol)" class="btn-chart-detail">查看走势图</button>
          <button @click="$emit('toggle-watchlist', stock?.symbol)" class="btn-watchlist-detail">{{ isInWatchlist ? '从自选股移除' : '添加到自选股' }}</button>
        </div>
      </div>
      <button @click="$emit('close')" class="btn-close">关闭</button>
    </div>
  </div>
</template>

<script setup>
import { defineProps, computed } from 'vue'

const props = defineProps({ show: Boolean, stock: Object, getScoreStyle: Function, isInWatchlist: [Function, Boolean] })

const inWatchlist = computed(() => {
  if (!props.stock) return false
  if (typeof props.isInWatchlist === 'function') return props.isInWatchlist(props.stock?.symbol)
  return !!props.isInWatchlist
})
</script>

<style scoped>
/* Score detail modal styles moved from StockRanking.vue */
.score-detail-modal { max-width: 500px; }
.score-detail-content { margin: 20px 0; }
.score-item { display: flex; align-items: center; margin-bottom: 15px; padding: 10px; border-radius: 6px; background-color: #f8f9fa; }
.score-item.total-score { background: linear-gradient(135deg, #e3f2fd, #f3e5f5); border: 2px solid #2196f3; font-size: 18px; font-weight: bold; }
.score-label { flex: 1; font-weight: bold; color: #495057; }
.score-value { padding: 4px 12px; border-radius: 12px; color: white; font-weight: bold; min-width: 50px; text-align: center; margin-right: 10px; }
.score-value.cycle { background: linear-gradient(135deg, #42a5f5, #1976d2); }
.score-value.growth { background: linear-gradient(135deg, #43e97b, #38f9d7); color: #222; }
.score-value.fundamental { background: linear-gradient(135deg, #ffa726, #fb8c00); }
.score-value.value { background: linear-gradient(135deg, #ffd700, #ffb300); color: #222; }
.score-value.technical { background: linear-gradient(135deg, #26c6da, #00838f); }
.score-value.money { background: linear-gradient(135deg, #ef5350, #b71c1c); }
.score-weight { color: #6c757d; font-size: 12px; }
.score-breakdown { border-top: 1px solid #ddd; padding-top: 15px; }
.score-detail-actions { display: flex; gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd; }
.btn-chart-detail, .btn-watchlist-detail { flex: 1; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
.btn-chart-detail { background: linear-gradient(135deg, #17a2b8, #138496); color: white; }
.btn-watchlist-detail { background: linear-gradient(135deg, #28a745, #20c997); color: white; }
.btn-close { width: 100%; padding: 10px; background: linear-gradient(135deg, #6c757d, #545b62); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; margin-top: 15px; }
</style>
