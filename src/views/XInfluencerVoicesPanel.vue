<template>
  <v-container fluid class="market-risk-panel pa-4">
    <div class="mrp-paper">
      <v-row class="mb-3">
        <v-col cols="12" md="8">
          <h1 class="mrp-h1">🐦 X 大V情报</h1>
          <p class="mrp-sub">
            跟踪 Elon Musk、Donald Trump、Chamath 等账号推文（官方 X API v2），LLM 解读对 A股/港股的情绪与主题影响。不构成投资建议。
          </p>
        </v-col>
        <v-col cols="12" md="4" class="d-flex align-center justify-end gap-2 flex-wrap">
          <input
            v-model="filterUser"
            type="text"
            class="mrp-date-input xiv-filter-input"
            placeholder="筛选 @用户名"
            @keyup.enter="load"
          />
          <button type="button" class="mrp-btn-sm mrp-btn-ghost" :disabled="loading" @click="load">刷新</button>
        </v-col>
      </v-row>

      <div v-if="errorMsg" class="xiv-error-bar mb-3">
        {{ errorMsg }}
        <button type="button" class="xiv-error-dismiss" aria-label="关闭" @click="errorMsg = ''">×</button>
      </div>

      <div v-if="loading" class="no-data-hint">加载中…</div>

      <div v-else-if="!items.length" class="no-data-hint">
        <p>暂无推文数据。请确认已配置 TWITTER_BEARER_TOKEN 并运行</p>
        <p class="mrp-caption">python -m quant_data_engine.tasks.run_x_influencer_sync</p>
      </div>

      <div v-else class="xiv-panels-wrap">
        <v-expansion-panels v-model="openPanels" class="xiv-panels" variant="accordion" multiple>
          <v-expansion-panel v-for="(row, idx) in items" :key="row.tweet_id || idx" :value="idx">
            <v-expansion-panel-title class="xiv-panel-title">
              <span class="xiv-title-user">@{{ row.author_username }}</span>
              <span class="xiv-title-time">{{ fmtTime(row) }}</span>
              <span v-if="chipFor(row)" class="xiv-pill">{{ chipFor(row) }}</span>
            </v-expansion-panel-title>
            <v-expansion-panel-text class="xiv-panel-body">
              <p class="xiv-tweet-text">{{ row.text }}</p>
              <a v-if="row.permalink" class="xiv-link" :href="row.permalink" target="_blank" rel="noopener">在 X 打开</a>
              <div v-if="row.analysis?.analysis" class="xiv-analysis">
                <h3 class="xiv-analysis-h">LLM 解读</h3>
                <p><span class="xiv-k">摘要</span> {{ row.analysis.analysis.summary_zh }}</p>
                <p><span class="xiv-k">美股风向标</span> {{ row.analysis.analysis.us_weathervane_zh }}</p>
                <p><span class="xiv-k">A/H 关注</span> {{ row.analysis.analysis.ah_focus_zh }}</p>
                <p v-if="themes(row).length">
                  <span class="xiv-k">主题</span> {{ themes(row).join('、') }}
                </p>
                <p class="mrp-caption mt-2">
                  情绪 {{ row.analysis.analysis.sentiment }} · 波动 {{ row.analysis.analysis.volatility_hint }} · 置信度
                  {{ row.analysis.analysis.confidence }}
                </p>
              </div>
              <div v-else class="xiv-pending">
                <span class="mrp-muted">暂无解读</span>
                <button
                  type="button"
                  class="mrp-btn-sm mrp-btn-dark"
                  :disabled="reanalyzeId === row.tweet_id"
                  @click="reanalyze(row.tweet_id)"
                >
                  {{ reanalyzeId === row.tweet_id ? '提交中…' : '触发解读' }}
                </button>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </div>
    </div>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { fetchXInfluencerPosts, triggerXInfluencerAnalyze } from '../api/xInfluencer.js'

const items = ref([])
const loading = ref(false)
const errorMsg = ref('')
const filterUser = ref('')
const openPanels = ref([0])
const reanalyzeId = ref(null)

function fmtTime(row) {
  const t = row.created_at || row.ingested_at
  if (!t) return ''
  try {
    return new Date(t).toLocaleString()
  } catch {
    return String(t)
  }
}

function themes(row) {
  const th = row.analysis?.analysis?.relevant_themes
  return Array.isArray(th) ? th : []
}

function chipFor(row) {
  return row.analysis?.analysis?.sentiment || ''
}

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    const u = filterUser.value?.trim().replace(/^@/, '') || undefined
    const data = await fetchXInfluencerPosts({
      limit: 40,
      username: u,
      with_analysis: true,
    })
    items.value = data.items || []
  } catch (e) {
    errorMsg.value = e.response?.data?.detail || e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function reanalyze(tweetId) {
  if (!tweetId) return
  reanalyzeId.value = tweetId
  errorMsg.value = ''
  try {
    await triggerXInfluencerAnalyze(tweetId)
    await load()
  } catch (e) {
    errorMsg.value = e.response?.data?.detail || e.message || '触发失败'
  } finally {
    reanalyzeId.value = null
  }
}

onMounted(() => {
  load()
})
</script>

<style scoped>
/* 与 MarketRiskPanel 一致的纸面浅灰底 + 白底内容区 */
.market-risk-panel {
  min-height: 100vh;
  background: #f5f5f5;
}

.mrp-paper {
  background: #ffffff;
  color: #111111;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  max-width: 1100px;
  margin: 0 auto;
  padding: 20px 24px;
}

.mrp-h1 {
  font-size: 1.35rem;
  font-weight: 700;
  color: #000;
  margin: 0 0 0.3rem;
}

.mrp-sub {
  font-size: 0.875rem;
  color: #555;
  margin: 0;
}

.mrp-muted {
  font-size: 0.85rem;
  color: #777;
}

.mrp-caption {
  font-size: 0.78rem;
  color: #888;
}

.mrp-btn-sm {
  padding: 5px 12px;
  font-size: 0.78rem;
  border-radius: 3px;
  cursor: pointer;
  border: 1px solid;
  line-height: 1.6;
}

.mrp-btn-dark {
  background: #111;
  color: #fff;
  border-color: #111;
}

.mrp-btn-dark:disabled {
  opacity: 0.5;
  cursor: default;
}

.mrp-btn-ghost {
  background: transparent;
  color: #333;
  border-color: #ccc;
}

.mrp-date-input {
  height: 30px;
  padding: 0 8px;
  font-size: 0.82rem;
  color: #111;
  background: #fff;
  border: 1px solid #bbb;
  border-radius: 3px;
  outline: none;
  box-sizing: border-box;
}

.mrp-date-input:hover {
  border-color: #666;
}

.mrp-date-input:focus {
  border-color: #333;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.08);
}

.xiv-filter-input {
  max-width: 200px;
  width: 100%;
}

.no-data-hint {
  text-align: center;
  padding: 48px 20px;
  color: #777;
}

.xiv-error-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  font-size: 0.85rem;
  color: #5c2121;
  background: #fff5f5;
  border: 1px solid #e0b4b4;
  border-radius: 3px;
}

.xiv-error-dismiss {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: #666;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}

.xiv-error-dismiss:hover {
  color: #111;
}

/* 折叠面板：白底、灰线，不用主题色 */
.xiv-panels-wrap :deep(.v-expansion-panels) {
  background: transparent;
}

.xiv-panels :deep(.v-expansion-panel) {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 8px;
  overflow: hidden;
}

.xiv-panels :deep(.v-expansion-panel::before) {
  box-shadow: none;
}

.xiv-panels :deep(.v-expansion-panel-title) {
  min-height: 44px;
  padding: 10px 14px;
  font-size: 0.875rem;
  color: #111;
  background: #fafafa;
}

.xiv-panels :deep(.v-expansion-panel-title__overlay) {
  background: transparent;
}

.xiv-panels :deep(.v-expansion-panel-text__wrapper) {
  padding: 12px 14px 14px;
  color: #111;
  background: #fff;
}

.xiv-panel-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.xiv-title-user {
  font-weight: 700;
  color: #000;
}

.xiv-title-time {
  color: #666;
  font-weight: 400;
}

.xiv-pill {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 2px;
  border: 1px solid #bbb;
  background: #f0f0f0;
  color: #333;
}

.xiv-tweet-text {
  white-space: pre-wrap;
  font-size: 0.9rem;
  line-height: 1.55;
  color: #111;
  margin: 0 0 10px;
}

.xiv-link {
  font-size: 0.82rem;
  color: #1565c0;
}

.xiv-link:hover {
  text-decoration: underline;
}

.xiv-analysis {
  margin-top: 14px;
  padding: 12px 14px;
  background: #fafafa;
  border: 1px solid #ddd;
  border-left: 3px solid #333;
  border-radius: 4px;
  font-size: 0.875rem;
  line-height: 1.55;
  color: #111;
}

.xiv-analysis-h {
  font-size: 0.95rem;
  font-weight: 700;
  color: #000;
  margin: 0 0 10px;
}

.xiv-k {
  font-weight: 600;
  color: #000;
  margin-right: 4px;
}

.xiv-pending {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
