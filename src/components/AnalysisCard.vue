<template>
  <div>
    <!-- 触发按钮卡片 -->
    <v-card class="analysis-trigger-card mb-4">
      <v-card-text class="d-flex align-center justify-space-between">
        <div>
          <span class="text-subtitle-1 font-weight-bold">{{ icon }} {{ title }}</span>
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
    <v-dialog v-model="dialog" max-width="1000px" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center justify-space-between">
          <div>
            <span>{{ icon }} {{ title }}</span>
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
            {{ description }}
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

            <!-- 补涨机会（自选股分析用） -->
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

            <!-- 高抛低吸建议（持仓分析用） -->
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
              暂无明显交易机会。
            </v-alert>
          </div>

          <!-- 错误提示 -->
          <v-alert v-if="error" type="error" variant="tonal">
            {{ error }}
          </v-alert>
        </v-card-text>

        <hr class="divider" />

        <v-card-actions class="text-caption text-grey">
          <span>{{ stockCount }} 只股票</span>
          <v-spacer />
          <span>{{ provider }} / {{ model }}</span>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { pollPortfolioTask } from '../api/portfolio'

const props = defineProps({
  type: {
    type: String,
    required: true,
    validator: (v) => ['watchlist', 'positions'].includes(v)
  },
  analyzeApi: {
    type: Function,
    required: true
  },
  getLatestApi: {
    type: Function,
    required: true
  }
})

const dialog = ref(false)
const loading = ref(false)
const analyzed = ref(false)
const analysis = ref(null)
const error = ref('')
const ladderDate = ref('')
const stockCount = ref(0)
const provider = ref('')
const model = ref('')
const latestAnalysisTime = ref(null)
const statusText = ref('')

// 根据类型显示不同文案
const icon = computed(() => props.type === 'watchlist' ? '⭐' : '💼')
const title = computed(() => props.type === 'watchlist' ? '自选股分析' : '持仓分析')
const description = computed(() => 
  props.type === 'watchlist' 
    ? '基于今日连板天梯主线，分析自选股的补涨机会。'
    : '基于今日市场情绪，分析持仓股票的高抛低吸机会。'
)

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
  
  if (!analyzed.value) {
    await loadLatestAnalysis()
  }
}

async function loadLatestAnalysis() {
  try {
    const res = await props.getLatestApi(props.type)
    
    if (res.success) {
      analysis.value = res.analysis
      ladderDate.value = res.ladder_date
      stockCount.value = props.type === 'watchlist' ? res.watchlist_count : res.positions_count
      provider.value = res.provider || ''
      model.value = res.model || ''
      latestAnalysisTime.value = res.created_at
      analyzed.value = true
    }
  } catch (e) {
    console.log('No previous analysis found')
  }
}

async function analyze() {
  loading.value = true
  error.value = ''
  statusText.value = '正在提交分析任务...'
  
  try {
    // 1. 提交异步任务
    const submitRes = await props.analyzeApi()
    
    if (!submitRes.success) {
      error.value = submitRes.error || '提交分析任务失败'
      return
    }
    
    stockCount.value = submitRes.watchlist_count || submitRes.positions_count || 0
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

onMounted(() => {
  loadLatestAnalysis()
})
</script>

<style scoped>
.analysis-trigger-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: all 0.2s;
}

.analysis-trigger-card:hover {
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
</style>
