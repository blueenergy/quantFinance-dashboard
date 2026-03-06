<template>
  <div class="earnings-hunter-container">
    <div class="header-section">
      <h2>🎯 财报猎手：寻找戴维斯双击</h2>
      <div class="controls">
        <div class="control-item">
          <label>聚合方式：</label>
          <select v-model="groupMode">
            <option value="none">默认时间序</option>
            <option value="industry">按行业归类</option>
            <option value="signal_type">按信号类型</option>
            <option value="date">按披露日期</option>
          </select>
        </div>
        <div class="control-item">
          <label>查询天数：</label>
          <select v-model="days" @change="fetchSignals">
            <option :value="3">最近 3 天</option>
            <option :value="7">最近 7 天</option>
            <option :value="14">最近 14 天</option>
            <option :value="30">最近 30 天</option>
          </select>
        </div>
        <button class="action-btn primary" @click="fetchSignals" :disabled="loading">
          <span class="icon">⟳</span> {{ loading ? '扫描中...' : '重新扫描' }}
        </button>
      </div>
    </div>

    <!-- 行业筛选（多选）区 -->
    <div class="filters-section" v-if="availableIndustries.length > 0">
      <div class="filter-label">行业筛选：</div>
      <div class="filter-pills">
        <button 
          class="pill-btn"
          :class="{ active: selectedIndustries.length === 0 }"
          @click="selectedIndustries = []"
        >全部</button>
        <button 
          v-for="ind in availableIndustries" 
          :key="ind"
          class="pill-btn"
          :class="{ active: selectedIndustries.includes(ind) }"
          @click="toggleIndustry(ind)"
        >
          {{ ind }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="skeleton skeleton-table">数据加载中...</div>
    
    <div v-else-if="signals.length === 0" class="no-data">
        近期未发现符合条件的财报信号
    </div>

    <div v-else class="groups-container">
      <div v-for="group in groupedSignals" :key="group.title" class="signal-group">
        <div v-if="group.title" class="group-header">
          <h3 class="group-title">{{ group.title }}</h3>
          <span class="group-count">{{ group.items.length }} 份</span>
        </div>
        <div class="signals-grid">
          <div v-for="signal in group.items" :key="signal.id" class="signal-card">
        <div class="card-header">
          <div class="stock-info">
            <span class="stock-name">{{ signal.name || signal.ts_code }}</span>
            <span class="stock-code">{{ signal.ts_code }}</span>
          </div>
          <span :class="['signal-badge', getBadgeClass(signal.signal_type)]">
            {{ signal.signal_type }}
          </span>
        </div>
        
        <div class="card-body">
          <div class="data-row">
            <span class="label">日期：</span>
            <span class="value">{{ formatDisplayDate(signal.date) }}</span>
          </div>
          <div class="data-row">
            <span class="label">来源：</span>
            <span class="value">{{ signal.subtype || '-' }}</span>
          </div>
          <div class="data-row highlight">
            <span class="label">核心指标：</span>
            <span class="value">{{ signal.core_metric || '-' }}</span>
          </div>
          <div v-if="signal.reason" class="data-row">
            <span class="label">详情：</span>
            <span class="value ext-text" :title="signal.reason">{{ signal.reason }}</span>
          </div>
          
          <!-- 已有AI分析结果的展示区域 -->
          <div v-if="signal.ai_analysis || hasAiAnalysis(signal)" class="ai-result">
            <div class="ai-score" :class="getScoreClass(getScore(signal))">
              评分: <strong>{{ getScore(signal) }}</strong>/10
            </div>
            <div class="ai-verdict">
              {{ getVerdict(signal) }}
            </div>
          </div>
        </div>
        
        <div class="card-footer">
          <button 
            v-if="!signal.analyzing && !hasAiAnalysis(signal)"
            class="analyze-btn" 
            @click="triggerAnalysis(signal)"
          >
            🧠 启动AI研判
          </button>
          <span v-else-if="signal.analyzing" class="analyzing-text">🤖 猎手已出动...</span>
          <span v-else class="analyzing-text success-text">✅ 已研判</span>
        </div>
      </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { earningsHunterApi } from '../api/earningsHunter'

const days = ref(30)
const groupMode = ref('none')
const signals = ref([])
const loading = ref(false)

const selectedIndustries = ref([])

const availableIndustries = computed(() => {
  const inds = new Set(signals.value.map(s => s.industry || '未知行业'))
  return Array.from(inds).sort((a,b) => a.localeCompare(b, 'zh-CN'))
})

const toggleIndustry = (ind) => {
  const idx = selectedIndustries.value.indexOf(ind)
  if (idx === -1) {
    selectedIndustries.value.push(ind)
  } else {
    selectedIndustries.value.splice(idx, 1)
  }
}

const getBadgeClass = (type) => {
  switch(type) {
    case '业绩预告': return 'badge-forecast'
    case '业绩快报': return 'badge-express'
    case '卖方研报': return 'badge-report'
    default: return ''
  }
}

const formatDisplayDate = (d) => {
  if (!d) return ''
  // yyyymmdd to YYYY-MM-DD
  if (d.length === 8) {
    return `${d.substring(0,4)}-${d.substring(4,6)}-${d.substring(6,8)}`
  }
  return d
}

// 提取 AI 结果辅助函数
const hasAiAnalysis = (signal) => {
  return signal?.ai_analysis != null || signal?.ai_score != null
}

const getScore = (signal) => {
  if (signal?.ai_analysis?.score) return signal.ai_analysis.score
  if (signal?.ai_score) return signal.ai_score
  return '-'
}

const getVerdict = (signal) => {
  if (signal?.ai_analysis?.verdict) return signal.ai_analysis.verdict
  return signal?.ai_analysis?.growth_quality || '-'
}

const getScoreClass = (score) => {
  const num = parseFloat(score)
  if (isNaN(num)) return ''
  if (num >= 8) return 'score-high'
  if (num >= 5) return 'score-medium'
  return 'score-low'
}

const fetchSignals = async () => {
  loading.value = true
  try {
    const res = await earningsHunterApi.getSignals(days.value)
    if (res.data?.success) {
      signals.value = res.data.data.map(item => ({...item, analyzing: false}))
      // 每次重新获取数据时清空选中筛选，或者保留也行，但考虑到行业列表可能变了，主动清空比较保险
      selectedIndustries.value = []
    } else {
      console.error('Failed to fetch signals:', res.data?.error)
    }
  } catch (e) {
    console.error('Error fetching signals:', e)
  } finally {
    loading.value = false
  }
}

// 计算属性：应用筛选后的信号
const filteredSignals = computed(() => {
  if (selectedIndustries.value.length === 0) return signals.value
  return signals.value.filter(s => selectedIndustries.value.includes(s.industry || '未知行业'))
})

// 计算属性：对信号进行分组归类
const groupedSignals = computed(() => {
  const baseSignals = filteredSignals.value
  if (groupMode.value === 'none') {
    return [{ title: '', items: baseSignals }]
  }
  
  const groups = {}
  baseSignals.forEach(sig => {
    let key = '其他'
    if (groupMode.value === 'industry') key = sig.industry || '未知行业'
    else if (groupMode.value === 'signal_type') key = sig.signal_type || '未知类型'
    else if (groupMode.value === 'date') key = formatDisplayDate(sig.date) || '未知日期'
    
    if (!groups[key]) groups[key] = []
    groups[key].push(sig)
  })
  
  // 对于行业和信号类型，按首字母或拼音降序。对于日期则按照时间近的在前
  return Object.keys(groups)
    .sort((a, b) => {
      // 如果大模型评分比较高也可以放前面，目前简化按key排序（降序让最近日期在前）
      if (groupMode.value === 'date') return b.localeCompare(a)
      // 其他按拼音/默认升序
      return a.localeCompare(b, 'zh-CN')
    })
    .map(k => ({
      title: k,
      items: groups[k]
    }))
})

const triggerAnalysis = async (signal) => {
  signal.analyzing = true
  try {
    const res = await earningsHunterApi.analyzeSignal(signal.id, signal.signal_type)
    if (res.data?.success) {
      alert(`AI 研判任务已提交！\n任务ID: ${res.data.task_id}\n猎手正在进行深度分析，稍后请刷新或前往分析历史查看。`)
    } else {
      alert('分析提交失败: ' + res.data.error)
      signal.analyzing = false
    }
  } catch (e) {
    alert('请求失败，请检查网络或登录状态。')
    signal.analyzing = false
  }
}

onMounted(() => {
  fetchSignals()
})
</script>

<style scoped>
.earnings-hunter-container {
  padding: 24px;
}
.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  background: var(--surface-card, #2b2b2b);
  padding: 16px 24px;
  border-radius: 8px;
}
.header-section h2 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--text-color, #e0e0e0);
}

.filters-section {
  display: flex;
  align-items: flex-start;
  margin-bottom: 24px;
  background: var(--surface-card, #2b2b2b);
  padding: 16px 24px;
  border-radius: 8px;
  gap: 12px;
}
.filter-label {
  color: var(--text-muted, #aaa);
  font-size: 0.95rem;
  white-space: nowrap;
  padding-top: 6px;
}
.filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.pill-btn {
  background: var(--surface-ground, #1e1e1e);
  border: 1px solid var(--border-color, #444);
  color: var(--text-color, #aaa);
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}
.pill-btn:hover {
  border-color: #64b5f6;
  color: #64b5f6;
}
.pill-btn.active {
  background: rgba(25, 118, 210, 0.15);
  border-color: #1976d2;
  color: #64b5f6;
  font-weight: 500;
}

.controls {
  display: flex;
  gap: 16px;
  align-items: center;
}
.control-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.control-item label {
  color: var(--text-muted, #aaa);
  font-size: 0.95rem;
}
select {
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--surface-ground, #1e1e1e);
  color: var(--text-color, #e0e0e0);
  border: 1px solid var(--border-color, #444);
  font-size: 0.95rem;
  outline: none;
  cursor: pointer;
}
select:hover {
  border-color: #64b5f6;
}
.action-btn {
  padding: 8px 18px;
  border-radius: 6px;
  border: 1px solid var(--border-color, #444);
  background: var(--surface-ground, #1e1e1e);
  color: var(--text-color, #e0e0e0);
  cursor: pointer;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}
.action-btn.primary {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  color: #fff;
  border: none;
  box-shadow: 0 4px 10px rgba(25, 118, 210, 0.3);
}
.action-btn.primary:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}
.action-btn.primary:disabled {
  background: #555;
  box-shadow: none;
  cursor: not-allowed;
}

.groups-container {
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.signal-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.group-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  border-left: 4px solid var(--primary-color, #1976d2);
  padding-left: 12px;
}
.group-title {
  margin: 0;
  font-size: 1.3rem;
  color: var(--text-color, #eee);
  font-weight: 600;
}
.group-count {
  font-size: 0.9rem;
  color: var(--text-muted, #999);
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 8px;
  border-radius: 12px;
}

.signals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}
.signal-card {
  background: var(--surface-card, #2b2b2b);
  border: 1px solid var(--border-color, #3a3a3a);
  border-radius: 10px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s;
}
.signal-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.4);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  border-bottom: 1px dashed var(--border-color, #444);
  padding-bottom: 12px;
}
.stock-name {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-color, #fff);
}
.stock-code {
  font-size: 0.85rem;
  color: var(--text-muted, #888);
  margin-top: 2px;
}
.signal-badge {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
}
.badge-forecast { background-color: rgba(25, 118, 210, 0.2); color: #64b5f6; border: 1px solid #1976d2; }
.badge-express { background-color: rgba(46, 125, 50, 0.2); color: #81c784; border: 1px solid #2e7d32; }
.badge-report { background-color: rgba(245, 124, 0, 0.2); color: #ffb74d; border: 1px solid #f57c00; }

.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 0.95rem;
}
.data-row {
  display: flex;
}
.data-row .label {
  color: var(--text-muted, #999);
  min-width: 75px;
}
.data-row .value {
  color: var(--text-color, #e0e0e0);
  flex: 1;
}
.data-row.highlight .value {
  color: var(--error-color, #ef5350); /* Red highlights for performance in dark mode usually */
  font-weight: bold;
}
.ext-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.85rem;
  color: var(--text-muted, #aaa);
}

.ai-result {
  margin-top: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  border-left: 3px solid #6a11cb;
}
.ai-score {
  font-weight: 600;
  margin-bottom: 6px;
}
.score-high { color: #ef5350; }
.score-medium { color: #ffb74d; }
.score-low { color: #81c784; }
.ai-verdict {
  font-style: italic;
  font-size: 0.9rem;
  color: var(--text-color, #ddd);
}

.card-footer {
  margin-top: 18px;
  display: flex;
  justify-content: flex-end;
}
.analyze-btn {
  background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 18px;
  cursor: pointer;
  font-weight: 500;
  transition: opacity 0.2s;
  width: 100%;
}
.analyze-btn:hover {
  opacity: 0.9;
}
.analyzing-text {
  color: #64b5f6;
  font-style: italic;
  font-size: 0.9rem;
  padding: 8px 0;
  text-align: center;
  width: 100%;
}
.success-text {
  color: #81c784;
}
.no-data {
  text-align: center;
  padding: 40px;
  color: var(--text-muted, #888);
}
</style>
