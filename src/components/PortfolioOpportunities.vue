<template>
  <div>
    <!-- 触发按钮 -->
    <v-card class="portfolio-opportunities-trigger mb-4">
      <v-card-text class="d-flex align-center justify-space-between">
        <div>
          <span class="text-subtitle-1 font-weight-bold">🎯 智能机会分析</span>
          <span v-if="latestAnalysisTime" class="text-caption text-grey ml-2">
            {{ timeAgo }}
          </span>
        </div>
        <v-btn
          color="primary"
          variant="tonal"
          size="small"
          @click="openDialog"
        >
          查看分析
        </v-btn>
      </v-card-text>
    </v-card>

    <!-- 分析对话框 -->
    <v-dialog v-model="dialog" max-width="1200px" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center justify-space-between">
          <div>
            <span>🎯 智能机会分析</span>
            <v-chip v-if="ladderDate" size="small" class="ml-2" color="info">
              {{ formatDate(ladderDate) }}
            </v-chip>
            <v-chip v-if="latestAnalysisTime" size="small" class="ml-2" color="grey" variant="outlined">
              {{ timeAgo }}
            </v-chip>
          </div>
          <div>
            <v-btn
              color="primary"
              variant="tonal"
              size="small"
              :loading="loading"
              @click="analyze"
              class="mr-2"
            >
              🔍 重新分析
            </v-btn>
            <v-btn icon size="small" variant="text" @click="dialog = false">
              ✕
            </v-btn>
          </div>
        </v-card-title>

        <hr class="divider" />

        <v-card-text style="max-height: 70vh;">
          <!-- 初始提示 -->
          <v-alert v-if="!analyzed && !loading" type="info" variant="tonal" density="compact">
            点击"重新分析"按钮，基于今日连板天梯主线，分析你的自选股补涨机会和持仓高抛低吸建议。
          </v-alert>

          <!-- 加载中 -->
          <div v-if="loading" class="text-center py-8">
            <v-progress-circular indeterminate color="primary" size="48" />
            <p class="text-grey mt-4">{{ statusText || '正在分析...' }}</p>
          </div>

          <!-- 分析结果 -->
          <div v-if="analyzed && !loading && analysis">
            <!-- 总结 -->
            <v-alert 
              v-if="analysis.summary" 
              type="success" 
              variant="tonal" 
              density="compact" 
              class="mb-4"
            >
              {{ analysis.summary }}
            </v-alert>

            <!-- A股IV温度计 -->
            <div v-if="analysis.iv_snapshot?.available" class="iv-regime-bar mb-4" :class="'iv-regime--' + analysis.iv_snapshot.level">
              <span class="iv-regime__icon">📊</span>
              <span class="iv-regime__label">A股波动率环境</span>
              <span class="iv-regime__val">{{ analysis.iv_snapshot.source === 'IV' ? 'IV' : 'HV20' }} {{ analysis.iv_snapshot.iv_30 }}%</span>
              <span class="iv-regime__badge">{{ analysis.iv_snapshot.level_zh }}</span>
              <span v-if="analysis.iv_snapshot.skew_pp !== null" class="iv-regime__skew">认沽偏度 {{ analysis.iv_snapshot.skew_pp > 0 ? '+' : '' }}{{ analysis.iv_snapshot.skew_pp }}pp</span>
              <span class="iv-regime__src">（{{ analysis.iv_snapshot.underlying }}）</span>
            </div>

            <!-- 补涨机会 -->
            <div v-if="analysis.catchup_opportunities?.length > 0" class="mb-6">
              <h4 class="text-h6 font-weight-bold mb-3">
                🚀 补涨机会 
                <span class="text-grey">({{ analysis.catchup_opportunities.length }})</span>
              </h4>
              <v-row>
                <v-col 
                  v-for="opp in analysis.catchup_opportunities" 
                  :key="opp.symbol" 
                  cols="12" 
                  md="6"
                >
                  <v-card variant="outlined" class="opportunity-card">
                    <v-card-text>
                      <div class="d-flex justify-space-between align-center mb-2">
                        <div>
                          <span class="text-h6 font-weight-bold">{{ opp.name }}</span>
                          <span class="text-grey-lighten-1 ml-2">{{ opp.symbol }}</span>
                        </div>
                        <v-chip 
                          :color="getScoreColor(opp.catchup_score)" 
                          size="large"
                        >
                          {{ opp.catchup_score }}分
                        </v-chip>
                      </div>
                      <div class="mb-3">
                        <v-chip size="small" variant="tonal" class="mr-2">
                          {{ opp.industry }}
                        </v-chip>
                        <v-chip size="small" color="red" variant="outlined">
                          关联: {{ opp.related_mainline }}
                        </v-chip>
                      </div>
                      <p class="text-body-1 mb-2">
                        {{ opp.analysis }}
                      </p>
                      <p class="text-body-2 text-orange">
                        ⚠️ {{ opp.risk }}
                      </p>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </div>

            <!-- 高抛低吸建议 -->
            <div v-if="analysis.swing_trading?.length > 0">
              <h4 class="text-h6 font-weight-bold mb-3">
                📊 高抛低吸建议 
                <span class="text-grey">({{ analysis.swing_trading.length }})</span>
              </h4>
              <v-table>
                <thead>
                  <tr>
                    <th class="text-left">股票</th>
                    <th class="text-left">操作建议</th>
                    <th class="text-left">理由</th>
                    <th class="text-left">目标价</th>
                    <th class="text-left">止损价</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="trade in analysis.swing_trading" :key="trade.symbol">
                    <td>
                      <div>
                        <span class="font-weight-medium">{{ trade.name }}</span>
                        <div class="text-caption text-grey">{{ trade.symbol }}</div>
                      </div>
                    </td>
                    <td>
                      <v-chip 
                        :color="getActionColor(trade.action)" 
                        size="small"
                      >
                        {{ trade.action }}
                      </v-chip>
                    </td>
                    <td class="text-body-2">{{ trade.reason }}</td>
                    <td>{{ trade.target_price || '-' }}</td>
                    <td>{{ trade.stop_loss || '-' }}</td>
                  </tr>
                </tbody>
              </v-table>
            </div>

            <!-- 无机会提示 -->
            <v-alert 
              v-if="!analysis.catchup_opportunities?.length && !analysis.swing_trading?.length"
              type="info" 
              variant="tonal"
            >
              当前自选股和持仓与今日主线关联度较低，暂无明显交易机会。
            </v-alert>
          </div>

          <!-- 错误提示 -->
          <v-alert v-if="error" type="error" variant="tonal">
            {{ error }}
          </v-alert>
        </v-card-text>

        <hr class="divider" />

        <v-card-actions class="text-caption text-grey">
          <span>自选股: {{ watchlistCount }} 只 | 持仓: {{ positionsCount }} 只</span>
          <v-spacer />
          <span>{{ provider }} / {{ model }}</span>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getPortfolioOpportunities, getLatestPortfolioAnalysis, pollPortfolioTask } from '../api/portfolio'

const dialog = ref(false)
const loading = ref(false)
const analyzed = ref(false)
const analysis = ref(null)
const error = ref('')
const ladderDate = ref('')
const watchlistCount = ref(0)
const positionsCount = ref(0)
const provider = ref('')
const model = ref('')
const latestAnalysisTime = ref(null)
const statusText = ref('')

// 计算时间差
const timeAgo = computed(() => {
  if (!latestAnalysisTime.value) return ''
  
  const now = new Date()
  const analysisTime = new Date(latestAnalysisTime.value)
  const diffMs = now - analysisTime
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}小时前`
  
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}天前`
})

async function openDialog() {
  dialog.value = true
  
  // 如果还没有加载过数据，尝试加载最新的分析
  if (!analyzed.value) {
    await loadLatestAnalysis()
  }
}

async function loadLatestAnalysis() {
  try {
    const res = await getLatestPortfolioAnalysis()
    
    if (res.success) {
      analysis.value = res.analysis
      ladderDate.value = res.ladder_date
      watchlistCount.value = res.watchlist_count || 0
      positionsCount.value = res.positions_count || 0
      provider.value = res.provider || ''
      model.value = res.model || ''
      latestAnalysisTime.value = res.created_at
      analyzed.value = true
    }
  } catch (e) {
    // 没有历史数据，不显示错误
    console.log('No previous analysis found')
  }
}

async function analyze() {
  loading.value = true
  error.value = ''
  statusText.value = '正在提交分析任务...'
  
  try {
    // 1. 提交异步任务
    const submitRes = await getPortfolioOpportunities()
    
    if (!submitRes.success) {
      error.value = submitRes.error || '提交分析任务失败'
      return
    }
    
    watchlistCount.value = submitRes.watchlist_count || 0
    positionsCount.value = submitRes.positions_count || 0
    statusText.value = '分析任务已提交，等待处理...'
    
    // 2. 轮询任务结果
    const result = await pollPortfolioTask(submitRes.task_id, (progress) => {
      if (progress.status === 'processing') {
        statusText.value = '正在进行 AI 分析...'
      } else if (progress.status === 'pending') {
        statusText.value = '任务排队中...'
      }
    })
    
    // 3. 处理最终结果
    if (result.status === 'completed' && result.success) {
      analysis.value = result.analysis
      model.value = result.model || ''
      latestAnalysisTime.value = result.created_at
      analyzed.value = true
    } else if (result.status === 'failed') {
      error.value = result.error || '分析失败'
    } else {
      error.value = '分析结果异常'
    }
  } catch (e) {
    error.value = e.message || '请求失败'
  } finally {
    loading.value = false
    statusText.value = ''
  }
}

function formatDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return dateStr
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
}

function getScoreColor(score) {
  if (score >= 80) return 'red'
  if (score >= 60) return 'orange'
  if (score >= 40) return 'green'
  return 'grey'
}

function getActionColor(action) {
  if (action === '高抛') return 'red'
  if (action === '低吸') return 'green'
  return 'grey'
}

// 组件挂载时加载最新分析
onMounted(() => {
  loadLatestAnalysis()
})
</script>

<style scoped>
.portfolio-opportunities-trigger {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: all 0.2s;
}

.portfolio-opportunities-trigger:hover {
  background: rgba(255, 255, 255, 0.05);
}

.opportunity-card {
  background: rgba(255, 255, 255, 0.02);
  transition: all 0.2s;
  height: 100%;
}

.opportunity-card:hover {
  background: rgba(255, 255, 255, 0.05);
  transform: translateY(-2px);
}

.divider {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin: 0;
}

/* IV regime bar */
.iv-regime-bar {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 6px 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px;
}
.iv-regime__icon  { font-size: 14px; }
.iv-regime__label { color: #718096; }
.iv-regime__val   { font-weight: 700; }
.iv-regime__badge { padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.iv-regime__skew  { font-size: 11px; color: #718096; }
.iv-regime__src   { font-size: 11px; color: #a0aec0; margin-left: auto; }
.iv-regime--calm     { background: #ebf4ff; border-color: #c3dafe; }
.iv-regime--calm     .iv-regime__val { color: #2b6cb0; }
.iv-regime--calm     .iv-regime__badge { background: #bee3f8; color: #2a4365; }
.iv-regime--normal   { background: #f0fff4; border-color: #c6f6d5; }
.iv-regime--normal   .iv-regime__val { color: #276749; }
.iv-regime--normal   .iv-regime__badge { background: #c6f6d5; color: #1c4532; }
.iv-regime--elevated { background: #fffaf0; border-color: #feebc8; }
.iv-regime--elevated .iv-regime__val { color: #c05621; }
.iv-regime--elevated .iv-regime__badge { background: #feebc8; color: #7b341e; }
.iv-regime--panic    { background: #fff5f5; border-color: #fed7d7; }
.iv-regime--panic    .iv-regime__val { color: #c53030; }
.iv-regime--panic    .iv-regime__badge { background: #fed7d7; color: #742a2a; }
</style>
