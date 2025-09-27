<template>
  <table class="ranking-table">
    <thead>
      <tr class="table-header">
        <th class="th-rank">{{ viewMode === 'ranking' ? '排名' : '序号' }}</th>
        <th class="th-symbol">股票代码</th>
        <th class="th-name">股票名称</th>
        <th class="th-date">日期</th>
        <th class="th-score">总分</th>
        <th class="th-cycle">周期</th>
        <th class="th-growth">成长</th>
        <th class="th-value">基本面</th>
        <th class="th-value">价值</th>
        <th class="th-technical">技术</th>
        <th class="th-money">资金</th>
        <th class="th-action">操作</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, index) in displayRows" :key="row.symbol + '_' + (row.display_date || row.score_date || index)" class="table-row" :class="getRowClass(row, index + 1)">
        <td class="td-rank">
          <span :style="getRankStyle(row, index + 1)" class="rank-badge">
            {{ index + 1 }}
          </span>
        </td>
        <td class="td-symbol">
          <span class="symbol-text">{{ row.symbol }}</span>
        </td>
        <td class="td-name">
          <span class="name-text" :title="row.name">{{ row.name || '-' }}</span>
        </td>
        <td class="td-date">
          <span>{{ formatDateDisplay(row.display_date || row.score_date) }}</span>
        </td>
        <td class="td-score" @click="onShowScore(row._origin || row)">
          <div style="display:flex; align-items:center; gap:8px; justify-content:center;">
            <span :style="getScoreStyle(row.display_composite_score)" class="score-badge clickable">
              {{ row.display_composite_score }}
            </span>
          </div>
        </td>
        <td class="td-cycle">
          <span class="cycle-score">{{ row.cycle_score }}</span>
        </td>
        <td class="td-growth">
          <span class="growth-score">{{ row.growth_score }}</span>
        </td>
        <td class="td-fundamental">
          <span class="fundamental-score">{{ row.fundamental_score }}</span>
        </td>
        <td class="td-value">
          <span class="value-score">{{ row.value_score }}</span>
        </td>
        <td class="td-technical">
          <span class="technical-score">{{ row.technical_score }}</span>
        </td>
        <td class="td-money">
          <span class="money-score">{{ row.money_flow_score }}</span>
        </td>
        <td class="td-action">
          <button @click="onViewChart(row.symbol)" class="btn-chart" title="查看图表">📊</button>
          <button
            @click="onToggleWatchlist(row.symbol)"
            :class="isInWatchlist ? (isInWatchlist(row.symbol) ? 'btn-watch-active' : 'btn-watch') : 'btn-watch'"
            :title="isInWatchlist ? (isInWatchlist(row.symbol) ? '从自选股移除' : '添加到自选股') : '添加到自选股'"
          >
            {{ isInWatchlist ? (isInWatchlist(row.symbol) ? '★' : '⭐') : '⭐' }}
          </button>
          <button
            v-if="viewMode === 'selected'"
            @click="onRemoveStock(row.symbol)"
            class="btn-remove"
            title="从查询中移除"
          >
            🗑️
          </button>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  displayRows: { type: Array, required: true },
  viewMode: { type: String, required: true },
  formatDateDisplay: { type: Function, required: true },
  getScoreStyle: { type: Function, required: true },
  getRankStyle: { type: Function, required: true },
  getRowClass: { type: Function, required: true },
  isInWatchlist: { type: Function, required: false }
})

const emit = defineEmits(['view-chart', 'toggle-watchlist', 'remove-stock', 'show-score'])

function onViewChart(symbol) { emit('view-chart', symbol) }
function onToggleWatchlist(symbol) { emit('toggle-watchlist', symbol) }
function onRemoveStock(symbol) { emit('remove-stock', symbol) }
function onShowScore(stock) { emit('show-score', stock) }

// helpers to access props in template
const formatDateDisplay = props.formatDateDisplay
const getScoreStyle = props.getScoreStyle
const getRankStyle = props.getRankStyle
const getRowClass = props.getRowClass
const isInWatchlist = props.isInWatchlist
const viewMode = props.viewMode
const displayRows = props.displayRows
</script>

<style scoped>
/* table-specific styles moved from StockRanking.vue */
.ranking-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  border-radius: 8px;
  overflow: hidden;
  font-size: 16px;
  color: #222;
}

.table-header {
  background: linear-gradient(135deg, #23272f, #34495e);
  color: #fff;
  font-size: 17px;
  letter-spacing: 1px;
}

.table-header th {
  border: 1px solid #34495e;
  padding: 14px 10px;
  font-weight: bold;
  text-shadow: 1px 1px 4px rgba(0,0,0,0.35);
  color: #fff;
}

.th-rank {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
  width: 40px;
  min-width: 40px;
  max-width: 40px;
}
.th-symbol { background: linear-gradient(135deg, #3498db, #2980b9); }
.th-name { background: linear-gradient(135deg, #9b59b6, #8e44ad); }
.th-score { background: linear-gradient(135deg, #e67e22, #d35400); }
.th-cycle { background: linear-gradient(135deg, #1abc9c, #16a085); }
.th-growth { background: linear-gradient(135deg, #43e97b, #38f9d7); }
.th-fundamental { background: linear-gradient(135deg, #f39c12, #e67e22); }
.th-value { background: linear-gradient(135deg, #ffd700, #ffb300); }
.th-technical { background: linear-gradient(135deg, #2ecc71, #27ae60); }
.th-money { background: linear-gradient(135deg, #e74c3c, #c0392b); }
.th-action { background: linear-gradient(135deg, #95a5a6, #7f8c8d); }

.table-row { transition: all 0.3s ease; }
.table-row:hover { background-color: #f8f9fa; transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.1); }

.top-three { background: linear-gradient(135deg, #fff5f5, #ffebee); border-left: 4px solid #ff5252; }
.top-ten { background: linear-gradient(135deg, #fff8e1, #fffde7); border-left: 4px solid #ffa726; }
.top-thirty { background: linear-gradient(135deg, #f1f8e9, #f9fbe7); border-left: 4px solid #66bb6a; }

.ranking-table td {
  border: 1px solid #e0e0e0;
  padding: 12px 10px;
  vertical-align: middle;
  color: #1a1a1a;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(255,255,255,0.15);
}

.rank-badge { display: inline-block; min-width: 30px; height: 30px; line-height: 30px; text-align: center; border-radius: 50%; font-weight: bold; }

.symbol-text {
  display: inline-block;
  background: linear-gradient(135deg, #3498db, #2980b9);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: bold;
  font-family: 'Courier New', monospace;
  letter-spacing: 1px;
}

.name-text {
  display: inline-block;
  background: linear-gradient(135deg, #9b59b6, #8e44ad);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: bold;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score-badge { display: inline-block; min-width: 50px; padding: 7px 14px; border-radius: 20px; font-weight: bold; text-align: center; font-size: 18px; color: #fff; text-shadow: 1px 1px 6px rgba(0,0,0,0.18); letter-spacing: 1px; }

.cycle-score, .fundamental-score, .technical-score, .money-score, .growth-score, .value-score { display: inline-block; padding: 5px 10px; border-radius: 5px; font-weight: bold; min-width: 44px; text-align: center; font-size: 16px; color: #fff; text-shadow: 1px 1px 6px rgba(0,0,0,0.18); letter-spacing: 1px; }
.cycle-score { background: linear-gradient(135deg, #1abc9c, #16a085); color: white; }
.fundamental-score { background: linear-gradient(135deg, #f39c12, #e67e22); color: white; }
.technical-score { background: linear-gradient(135deg, #2ecc71, #27ae60); color: white; }
.money-score { background: linear-gradient(135deg, #e74c3c, #c0392b); color: white; }
.growth-score { background: linear-gradient(135deg, #43e97b, #38f9d7); color: #0a2a0a; }
.value-score { background: linear-gradient(135deg, #ffd700, #ffb300); color: #7a4a00; }

.btn-chart, .btn-watch { background: linear-gradient(135deg, #3498db, #2980b9); color: white; border: none; padding: 6px 10px; border-radius: 4px; margin: 0 2px; cursor: pointer; font-size: 14px; transition: all 0.3s ease; }
.btn-chart:hover, .btn-watch:hover { transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
.btn-watch { background: linear-gradient(135deg, #f39c12, #e67e22); }

.btn-remove { background: linear-gradient(135deg, #dc3545, #c82333); color: white; border: none; padding: 6px 10px; border-radius: 4px; margin: 0 2px; cursor: pointer; font-size: 12px; }

@media (max-width: 768px) {
  .ranking-table { font-size: 12px; }
  .symbol-text, .name-text { padding: 2px 4px; font-size: 11px; }
  .cycle-score, .fundamental-score, .technical-score, .money-score { padding: 2px 4px; font-size: 11px; }
}
</style>
