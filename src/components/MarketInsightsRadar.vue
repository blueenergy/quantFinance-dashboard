<template>
  <div class="insights-page">
    <div class="page-header">
      <div>
        <h3>火眼金睛</h3>
        <p>不预测，不煽动，只揭示市场结构变化的证据。</p>
      </div>
      <div class="actions">
        <input v-model="tradeDate" type="date" />
        <select v-model="eventType" @change="loadEvents">
          <option value="">全部事件</option>
          <option v-for="type in eventTypeOptions" :key="type.id" :value="type.id">
            {{ type.label }}
          </option>
        </select>
        <select v-model="eventCategory" @change="loadEvents">
          <option value="">全部类别</option>
          <option v-for="category in eventCategoryOptions" :key="category" :value="category">
            {{ category }}
          </option>
        </select>
        <select v-model="eventSeverity" @change="loadEvents">
          <option value="">全部级别</option>
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
        <select v-model="minConfidence" @change="loadEvents">
          <option value="">全部置信度</option>
          <option value="90">90 分以上</option>
          <option value="80">80 分以上</option>
          <option value="70">70 分以上</option>
        </select>
        <select v-model="sectorLevel" @change="loadSectorStrength">
          <option value="L1">L1</option>
          <option value="L2">L2</option>
          <option value="L3">L3</option>
        </select>
        <button class="btn primary" :disabled="loading" @click="loadAll">刷新</button>
        <button class="btn" :disabled="loading" @click="generateEvents">生成洞察</button>
        <button class="btn" :disabled="loading" @click="reviewFocus">验证焦点</button>
      </div>
    </div>

    <div v-if="error" class="alert error">{{ error }}</div>
    <div v-if="message" class="alert info">{{ message }}</div>

    <section class="overview">
      <div class="card">
        <span>市场状态</span>
        <strong>{{ overview?.market_state || '-' }}</strong>
      </div>
      <div class="card">
        <span>实时阳谱</span>
        <strong>{{ percent(overview?.latest_spectrum?.yang_spectrum) }}</strong>
      </div>
      <div class="card">
        <span>事件数</span>
        <strong>{{ overview?.event_count ?? '-' }}</strong>
      </div>
      <div class="card">
        <span>最新快照</span>
        <strong>{{ overview?.latest_spectrum?.snapshot_time || overview?.latest_event_snapshot_time || '-' }}</strong>
      </div>
    </section>

    <section class="focus-panel">
      <div class="panel-title">
        <h4>今日焦点</h4>
        <span>最多 {{ focusItems.length }} 个优先观察项</span>
      </div>
      <div v-if="focusItems.length" class="focus-grid">
        <div
          v-for="item in focusItems"
          :key="`${item.subject_name}-${item.event_label}`"
          role="button"
          tabindex="0"
          :class="['focus-card', { active: item.primary_event?._id && selectedEvent?._id === item.primary_event?._id }]"
          @click="selectFocus(item)"
          @keydown.enter="selectFocus(item)"
        >
          <div class="focus-top">
            <span class="focus-score">{{ score(item.attention_score) }}</span>
            <span>{{ item.category || item.event_label }}</span>
          </div>
          <div v-if="item.feedback?.action" class="focus-feedback-current">
            已标记：{{ item.feedback.label || feedbackActionLabel(item.feedback.action) }}
          </div>
          <div v-if="item.review?.status" :class="['focus-review', item.review.status]">
            验证：{{ item.review.label || reviewStatusLabel(item.review.status) }}
          </div>
          <div v-if="item.relevance?.labels?.length" class="focus-tags">
            <span v-for="label in item.relevance.labels" :key="label">{{ label }}</span>
          </div>
          <div v-if="focusExplainTags(item).length" class="focus-explain-tags">
            <span
              v-for="tag in focusExplainTags(item)"
              :key="tag.text"
              :class="['focus-explain-tag', tag.tone]"
              :title="tag.detail"
            >
              {{ tag.text }}
            </span>
          </div>
          <h4>{{ item.title }}</h4>
          <p>{{ item.summary }}</p>
          <div class="focus-reason">
            <strong>为什么先看</strong>
            <span>{{ item.why_focus }}</span>
          </div>
          <div class="focus-action">
            <strong>下一步</strong>
            <span>{{ item.next_action }}</span>
          </div>
          <div class="focus-feedback-actions" @click.stop>
            <button type="button" :disabled="loading" @click="submitFocusFeedback(item, 'valuable')">有价值</button>
            <button type="button" :disabled="loading" @click="submitFocusFeedback(item, 'ignore')">忽略</button>
            <button type="button" :disabled="loading" @click="submitFocusFeedback(item, 'false_positive')">误报</button>
          </div>
        </div>
      </div>
      <div v-else class="empty compact">暂无焦点，可先生成洞察事件。</div>
    </section>

    <section class="guide-panel">
      <div class="panel-title">
        <h4>事件说明书</h4>
        <span>帮助理解每类洞察该怎么用</span>
      </div>
      <div class="guide-grid">
        <button
          v-for="type in eventTypeOptions"
          :key="type.id"
          type="button"
          :class="['guide-card', { active: activeGuideType === type.id }]"
          @click="activeGuideType = activeGuideType === type.id ? '' : type.id"
        >
          <div class="guide-card-head">
            <strong>{{ type.label }}</strong>
            <span>{{ type.category }}</span>
          </div>
          <p>{{ eventMeta(type.id)?.meaning || '用于识别对应的市场结构变化。' }}</p>
          <div v-if="activeGuideType === type.id" class="guide-detail">
            <div>
              <b>为什么重要</b>
              <p>{{ eventMeta(type.id)?.why_it_matters || '-' }}</p>
            </div>
            <div>
              <b>怎么看证据</b>
              <ul>
                <li v-for="item in eventMeta(type.id)?.evidence_guide || []" :key="item">{{ item }}</li>
              </ul>
            </div>
            <div>
              <b>可能误判点</b>
              <p>{{ eventMeta(type.id)?.false_positive || '-' }}</p>
            </div>
          </div>
        </button>
      </div>
    </section>

    <section class="quality-panel">
      <div class="panel-title">
        <div>
          <h4>复盘效果</h4>
          <span>同类事件的历史验证表现，用于辅助判断规则质量</span>
        </div>
        <div class="quality-actions">
          <select v-model="qualityDimension" @change="loadQuality">
            <option value="event_type">按事件类型</option>
            <option value="category">按事件类别</option>
            <option value="subject_type">按主体类型</option>
          </select>
          <button class="btn" :disabled="loading" @click="refreshQuality">刷新质量评分</button>
        </div>
      </div>
      <table v-if="qualityItems.length" class="quality-table">
        <thead>
          <tr>
            <th>{{ qualityDimensionLabel }}</th>
            <th>确认</th>
            <th>反证</th>
            <th>确认率</th>
            <th>有效样本</th>
            <th>质量权重</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in qualityItems" :key="`${item.dimension}-${item.key}`">
            <td>
              <strong>{{ qualityItemLabel(item) }}</strong>
              <div class="muted">{{ item.key }}</div>
            </td>
            <td>{{ item.confirmed_count || 0 }}</td>
            <td>{{ item.faded_count || 0 }}</td>
            <td>{{ percent(item.confirmation_rate) }}</td>
            <td>{{ item.decisive_count || 0 }}</td>
            <td :class="numClass(item.weight)">{{ signedNumber(item.weight) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty compact">暂无复盘质量数据，可先执行盘后验证。</div>
    </section>

    <section class="layout">
      <div class="panel events">
        <div class="panel-title">
          <h4>实时洞察事件流</h4>
          <span>{{ events.length }} 条</span>
        </div>
        <div v-if="loading" class="empty">加载中...</div>
        <div v-else-if="events.length === 0" class="empty">暂无事件，可先点击“生成洞察”。</div>
        <template v-else>
          <button
            v-for="event in events"
            :key="event._id"
            type="button"
            :class="['event-item', { active: selectedEvent?._id === event._id }]"
            @click="selectedEvent = event"
          >
            <div class="event-top">
              <span :class="['badge', event.severity]">{{ eventLabel(event.event_type) }}</span>
              <span>{{ score(event.confidence) }}</span>
            </div>
            <strong>{{ event.title }}</strong>
            <p>{{ event.summary }}</p>
            <small>{{ formatSnapshot(event.snapshot_time) }} · {{ event.subject_name }}</small>
          </button>
        </template>
      </div>

      <div class="panel sectors">
        <div class="panel-title">
          <h4>板块结构雷达</h4>
          <span>{{ sectorStrength.length }} 个 {{ sectorLevel }}</span>
        </div>
        <table v-if="sectorStrength.length">
          <thead>
            <tr>
              <th>板块</th>
              <th>上涨比例</th>
              <th>相对强弱</th>
              <th>变化</th>
              <th>均笔</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in sectorStrength" :key="row.sector_code" @click="selectSector(row)">
              <td>
                <strong>{{ row.sector_name }}</strong>
                <div class="muted">{{ row.sector_code }}</div>
              </td>
              <td>{{ percent(row.positive_ratio) }}</td>
              <td :class="numClass(row.relative_positive_ratio)">{{ percent(row.relative_positive_ratio) }}</td>
              <td :class="numClass(row.delta_positive_ratio)">{{ percent(row.delta_positive_ratio) }}</td>
              <td>{{ yuan(row.avg_trade_size_yuan) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty">暂无板块强弱数据。</div>
      </div>

      <div class="panel evidence">
        <div class="panel-title">
          <h4>证据透视镜</h4>
          <span>{{ selectedEvent?.subject_name || '未选择事件' }}</span>
        </div>
        <template v-if="selectedEvent">
          <h3>{{ selectedEvent.title }}</h3>
          <p class="summary">{{ selectedEvent.summary }}</p>
          <div class="kv">
            <span>类型</span><strong>{{ eventLabel(selectedEvent.event_type) }}</strong>
            <span>分类</span><strong>{{ selectedEventMeta?.category || '-' }}</strong>
            <span>置信度</span><strong>{{ score(selectedEvent.confidence) }}</strong>
            <span>严重程度</span><strong>{{ selectedEvent.severity }}</strong>
            <span>主体</span><strong>{{ selectedEvent.subject_name }}</strong>
            <span>时间</span><strong>{{ formatSnapshot(selectedEvent.snapshot_time) }}</strong>
          </div>
          <div v-if="selectedEventMeta?.meaning" class="usage-card">
            <h5>如何使用这个事件</h5>
            <div class="usage-row">
              <strong>它是什么意思</strong>
              <p>{{ selectedEventMeta.meaning }}</p>
            </div>
            <div class="usage-row">
              <strong>为什么重要</strong>
              <p>{{ selectedEventMeta.why_it_matters }}</p>
            </div>
            <div class="usage-row">
              <strong>怎么看证据</strong>
              <ul>
                <li v-for="item in selectedEventMeta.evidence_guide || []" :key="item">{{ item }}</li>
              </ul>
            </div>
            <div class="usage-row">
              <strong>可能误判点</strong>
              <p>{{ selectedEventMeta.false_positive }}</p>
            </div>
            <div class="usage-row">
              <strong>下一步观察</strong>
              <ul>
                <li v-for="item in selectedEventMeta.next_watch || []" :key="item">{{ item }}</li>
              </ul>
            </div>
          </div>
          <h5>支持证据</h5>
          <ul>
            <li v-for="item in selectedEvent.supporting_points || []" :key="item">{{ item }}</li>
          </ul>
          <h5>反向证据</h5>
          <ul>
            <li v-for="item in selectedEvent.counter_points || []" :key="item">{{ item }}</li>
          </ul>
          <h5>后续观察</h5>
          <ul>
            <li v-for="item in selectedEvent.watch_conditions || []" :key="item">{{ item }}</li>
          </ul>
          <h5>核心指标</h5>
          <pre>{{ JSON.stringify(selectedEvent.evidence || {}, null, 2) }}</pre>
          <SectorContributorsPanel
            v-if="canLoadSectorContributors(selectedEvent)"
            class="insight-sector-contributors"
            :loading="sectorContributorsLoading"
            :error="sectorContributorsError"
            :payload="sectorContributorsPayload"
            :title="sectorContributorsTitle"
            :description="sectorContributorsDescription"
            :top-n="insightContributorTopN"
            :ma-period="5"
            :data-key="sectorContributorsDataKey"
          />
          <template v-if="selectedSectorSeries.length">
            <h5>板块趋势</h5>
            <div v-if="selectedSectorSeriesSimulated" class="simulated-note">
              当前真实快照不足，以下趋势为基于最新快照的非持久化模拟序列，仅用于周末/盘后调试界面和规则。
            </div>
            <div class="trend-chart">
              <svg viewBox="0 0 320 120" preserveAspectRatio="none">
                <polyline :points="trendPoints" fill="none" stroke="#2563eb" stroke-width="2" />
              </svg>
              <div class="trend-axis">
                <span>{{ formatSnapshot(selectedSectorSeries[0]?.snapshot_time) }}</span>
                <span>{{ formatSnapshot(selectedSectorSeries[selectedSectorSeries.length - 1]?.snapshot_time) }}</span>
              </div>
            </div>
            <div class="trend-kpis">
              <span>首值 {{ percent(selectedSectorSeries[0]?.positive_ratio) }}</span>
              <span>最新 {{ percent(selectedSectorSeries[selectedSectorSeries.length - 1]?.positive_ratio) }}</span>
              <span>样本 {{ selectedSectorSeries.length }}</span>
            </div>
          </template>
        </template>
        <div v-else class="empty">点击左侧事件查看证据链。</div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import SectorContributorsPanel from './SectorContributorsPanel.vue'

const today = new Date().toISOString().slice(0, 10)
const tradeDate = ref(today)
const eventType = ref('')
const eventCategory = ref('')
const eventSeverity = ref('')
const minConfidence = ref('')
const sectorLevel = ref('L2')
const loading = ref(false)
const error = ref('')
const message = ref('')
const overview = ref(null)
const focusItems = ref([])
const events = ref([])
const selectedEvent = ref(null)
const eventTypeMeta = ref({})
const activeGuideType = ref('')
const sectorStrength = ref([])
const selectedSectorSeries = ref([])
const selectedSectorSeriesSimulated = ref(false)
const qualityDimension = ref('event_type')
const qualityItems = ref([])
/** 与阴阳谱页同一接口：板块内成交额与 MA 位置拆解 */
const sectorContributorsPayload = ref(null)
const sectorContributorsLoading = ref(false)
const sectorContributorsError = ref('')
const insightContributorTopN = 25
const sectorContributorsDescription = '与「阴阳谱」页同一口径：按成交额排序，分列站上 MA5 与未站上 MA5（快照时间对齐当前事件）。'
const sectorContributorsTitle = computed(() => (
  `板块内谁在驱动结构 · ${sectorContributorsPayload.value?.sector_name || selectedEvent.value?.subject_name || '板块'}`
))
const sectorContributorsDataKey = computed(() => (
  `${selectedEvent.value?.subject_code || ''}-${String(sectorContributorsPayload.value?.snapshot_time || sectorContributorsPayload.value?.trade_date || '')}`
))

const fallbackEventTypeMeta = {
  MARKET_BREADTH_RECOVERY: {
    label: '广度修复',
    category: '市场状态类',
    meaning: '全市场阳谱在短时间内回升，说明上涨家数正在从低位修复。',
    why_it_matters: '它反映市场内部参与度改善，而不只是指数价格上涨。',
    evidence_guide: ['重点看 yang_spectrum_now', '比较 delta_yang_spectrum_15m 是否持续为正'],
    false_positive: '如果修复只持续一两个快照，可能只是盘中反抽。',
  },
  MARKET_BREADTH_DIVERGENCE: {
    label: '广度走弱',
    category: '市场状态类',
    meaning: '全市场阳谱短时间下降，市场内部上涨家数减少。',
    why_it_matters: '它可以提醒用户指数表面稳定时，内部结构可能已经变弱。',
    evidence_guide: ['重点看 yang_spectrum_now 是否低于中性区', '看 delta_yang_spectrum_15m 是否明显为负'],
    false_positive: '午间或尾盘流动性变化可能放大短时波动。',
  },
  COUNTER_TREND_SECTOR_STRENGTH: {
    label: '逆势扩散',
    category: '板块扩散类',
    meaning: '全市场广度偏弱时，某个局部板块仍然逆势扩散。',
    why_it_matters: '它帮助用户发现弱市中仍有资金聚集的方向。',
    evidence_guide: ['看 market_weak', '看 market_yang_spectrum', '看板块 positive_ratio 和 relative_positive_ratio'],
    false_positive: '逆势扩散可能是短线避险轮动，不一定能持续。',
  },
  EARLY_SECTOR_DIFFUSION: {
    label: '早期扩散',
    category: '板块扩散类',
    meaning: 'L3 细分行业已经开始扩散，但所属 L2/L1 大行业还没有同步确认。',
    why_it_matters: '这可能是结构变化的早期信号，说明资金先在更细分方向试探。',
    evidence_guide: ['看 L3 positive_ratio', '看 parent_l2_positive_ratio', '看 parent_confirmed 是否为 false'],
    false_positive: '如果父级行业迟迟不扩散，可能只是细分方向的短线脉冲。',
  },
  SECTOR_DIFFUSION: {
    label: '板块扩散',
    category: '板块扩散类',
    meaning: '某个板块内部上涨家数快速增加，并且强于全市场。',
    why_it_matters: '扩散说明资金不只集中在少数个股，板块内部共振更真实。',
    evidence_guide: ['看 positive_ratio_now', '看 delta_positive_ratio_15m', '看 relative_positive_ratio'],
    false_positive: '如果成交质量没有同步增强，可能只是短线轮动。',
  },
  SECTOR_FALSE_STRENGTH: {
    label: '板块假强',
    category: '去妄存真类',
    meaning: '板块看起来强，但内部上涨家数不足，可能只是少数权重股或核心股撑起来。',
    why_it_matters: '它帮助用户识别表面强势和真实扩散之间的差异。',
    evidence_guide: ['看 positive_ratio_now 是否低于 50%', '比较 avg_pct_chg 和 median_pct_chg', '看 relative_positive_ratio'],
    false_positive: '强势初期也可能先由龙头带动，后续扩散后会转为真强。',
  },
  SECTOR_FADE: {
    label: '板块退潮',
    category: '板块扩散类',
    meaning: '板块内部上涨家数快速下降，扩散状态开始收缩。',
    why_it_matters: '它提示板块热度或承接开始减弱，避免只看少数仍上涨个股。',
    evidence_guide: ['看 positive_ratio_now 是否跌破中性区', '看 delta_positive_ratio_15m 是否明显为负'],
    false_positive: '强势板块盘中洗盘也可能造成短时退潮。',
  },
  VOLUME_QUALITY_SHIFT: {
    label: '成交质量变化',
    category: '质量识别类',
    meaning: '板块均笔成交额等质量指标出现变化，但方向尚未完全确认。',
    why_it_matters: '它提示资金行为可能正在变化，适合作为后续扩散的观察线索。',
    evidence_guide: ['看 avg_trade_size_yuan', '结合 positive_ratio 判断是否转化为扩散'],
    false_positive: '大单成交可能来自个别股票，不能单独作为方向信号。',
  },
}

const eventTypeOptions = computed(() => {
  const meta = Object.keys(eventTypeMeta.value || {}).length ? eventTypeMeta.value : fallbackEventTypeMeta
  return Object.entries(meta).map(([id, item]) => ({ id, label: item.label || id, category: item.category || '' }))
})

const eventCategoryOptions = computed(() => {
  const categories = eventTypeOptions.value.map((item) => item.category).filter(Boolean)
  return [...new Set(categories)].sort()
})

const selectedEventMeta = computed(() => {
  if (!selectedEvent.value?.event_type) return null
  return eventTypeMeta.value[selectedEvent.value.event_type] || fallbackEventTypeMeta[selectedEvent.value.event_type] || null
})

function canLoadSectorContributors(ev) {
  if (!ev) return false
  if (String(ev.subject_type || '') !== 'sector') return false
  const code = String(ev.subject_code || ev.evidence?.sector_code || '').trim()
  const st = String(ev.snapshot_time || ev.evidence?.snapshot_time || '').replace(/\D/g, '')
  return Boolean(code && st.length >= 12)
}

function contributorLevelForApi(ev) {
  const lv = String(ev?.level || sectorLevel.value || 'L2').toUpperCase()
  if (lv === 'L1' || lv === 'L2' || lv === 'L3') return lv
  return 'L2'
}

function sectorContributorRequestParams(ev) {
  if (!canLoadSectorContributors(ev)) return null
  const code = String(ev.subject_code || ev.evidence?.sector_code || '').trim()
  const st = String(ev.snapshot_time || ev.evidence?.snapshot_time || '').replace(/\D/g, '').slice(0, 12)
  return {
    mode: 'realtime',
    level: contributorLevelForApi(ev),
    sector_code: code,
    snapshot_time: st,
    ma_period: 5,
    top_n: insightContributorTopN,
  }
}

async function loadInsightsSectorContributors() {
  const ev = selectedEvent.value
  const params = sectorContributorRequestParams(ev)
  if (!params) {
    sectorContributorsPayload.value = null
    sectorContributorsError.value = ''
    sectorContributorsLoading.value = false
    return
  }
  sectorContributorsLoading.value = true
  sectorContributorsError.value = ''
  try {
    const res = await axios.get('/api/market-spectrum/sector-contributors', { params })
    sectorContributorsPayload.value = res.data
    if (!res.data?.success) {
      sectorContributorsError.value = res.data?.error || res.data?.detail || '加载失败'
    }
  } catch (err) {
    sectorContributorsPayload.value = null
    sectorContributorsError.value = err?.response?.data?.detail || err?.message || '加载失败'
  } finally {
    sectorContributorsLoading.value = false
  }
}

watch(
  () => [
    selectedEvent.value?._id,
    selectedEvent.value?.subject_code,
    selectedEvent.value?.snapshot_time,
    selectedEvent.value?.level,
    selectedEvent.value?.subject_type,
  ],
  () => {
    loadInsightsSectorContributors()
  },
)

const trendPoints = computed(() => {
  const rows = selectedSectorSeries.value
  if (!rows.length) return ''
  const values = rows.map((row) => Number(row.positive_ratio)).filter((n) => Number.isFinite(n))
  if (!values.length) return ''
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)
  const range = max - min || 1
  return rows
    .map((row, index) => {
      const x = rows.length === 1 ? 160 : (index / (rows.length - 1)) * 320
      const y = 110 - ((Number(row.positive_ratio) - min) / range) * 100
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})

const qualityDimensionLabel = computed(() => ({
  event_type: '事件类型',
  category: '事件类别',
  subject_type: '主体类型',
}[qualityDimension.value] || '维度'))

function compactDate() {
  return (tradeDate.value || '').replaceAll('-', '')
}

function setError(err, fallback) {
  error.value = err?.response?.data?.detail || err?.message || fallback
}

async function loadOverview() {
  const res = await axios.get('/api/market-insights/overview', { params: { trade_date: compactDate() } })
  overview.value = res.data
}

async function loadEventTypes() {
  try {
    const res = await axios.get('/api/market-insights/event-types')
    eventTypeMeta.value = res.data?.data || {}
  } catch (err) {
    eventTypeMeta.value = fallbackEventTypeMeta
  }
}

async function loadFocus() {
  const res = await axios.get('/api/market-insights/focus', { params: { trade_date: compactDate(), limit: 5 } })
  focusItems.value = res.data?.data || []
}

async function loadEvents() {
  const params = { trade_date: compactDate(), limit: 100 }
  if (eventType.value) params.event_type = eventType.value
  if (eventCategory.value) params.category = eventCategory.value
  if (eventSeverity.value) params.severity = eventSeverity.value
  if (minConfidence.value) params.min_confidence = Number(minConfidence.value)
  const res = await axios.get('/api/market-insights/events', { params })
  events.value = res.data?.data || []
  if (!selectedEvent.value || !events.value.some((e) => e._id === selectedEvent.value?._id)) {
    selectedEvent.value = events.value[0] || null
  }
}

async function loadSectorStrength() {
  const res = await axios.get('/api/market-insights/sector-strength', {
    params: { trade_date: compactDate(), level: sectorLevel.value, window: 15, limit: 50 },
  })
  sectorStrength.value = res.data?.data || []
  selectedSectorSeries.value = []
  selectedSectorSeriesSimulated.value = false
}

async function loadQuality() {
  const res = await axios.get('/api/market-insights/quality', {
    params: { dimension: qualityDimension.value, limit: 20 },
  })
  qualityItems.value = res.data?.data || []
}

async function loadAll() {
  loading.value = true
  error.value = ''
  message.value = ''
  try {
    await Promise.all([loadEventTypes(), loadOverview(), loadFocus(), loadEvents(), loadSectorStrength(), loadQuality()])
  } catch (err) {
    setError(err, '加载火眼金睛数据失败')
  } finally {
    loading.value = false
  }
}

async function generateEvents() {
  loading.value = true
  error.value = ''
  try {
    const res = await axios.post('/api/market-insights/generate', null, { params: { trade_date: compactDate() } })
    message.value = `已生成/更新 ${res.data?.written || 0} 条洞察事件`
    await loadAll()
  } catch (err) {
    setError(err, '生成洞察事件失败')
  } finally {
    loading.value = false
  }
}

async function reviewFocus() {
  loading.value = true
  error.value = ''
  try {
    const res = await axios.post('/api/market-insights/focus/review', null, {
      params: { trade_date: compactDate(), horizon_minutes: 60 },
    })
    message.value = `已验证 ${res.data?.written || 0} 个焦点`
    await Promise.all([loadFocus(), loadQuality()])
  } catch (err) {
    setError(err, '验证焦点失败')
  } finally {
    loading.value = false
  }
}

async function refreshQuality() {
  loading.value = true
  error.value = ''
  try {
    const res = await axios.post('/api/market-insights/quality/refresh')
    message.value = `已刷新 ${res.data?.count || 0} 条质量评分`
    await loadQuality()
  } catch (err) {
    setError(err, '刷新复盘质量评分失败')
  } finally {
    loading.value = false
  }
}

async function selectFocus(item) {
  selectedEvent.value = item.primary_event || null
  selectedSectorSeries.value = []
  selectedSectorSeriesSimulated.value = false
  const event = item.primary_event || {}
  if (event.subject_type !== 'sector' || !event.subject_code) return
  try {
    await loadSectorSeries({
      level: event.level || sectorLevel.value,
      sector_code: event.subject_code,
    })
  } catch (err) {
    setError(err, '加载焦点趋势失败')
  }
}

function feedbackActionLabel(action) {
  return {
    valuable: '有价值',
    ignore: '忽略',
    false_positive: '误报',
  }[action] || action || ''
}

function reviewStatusLabel(status) {
  return {
    confirmed: '已验证',
    faded: '反证',
    unconfirmed: '未验证',
    insufficient_data: '待观察',
  }[status] || status || ''
}

function focusExplainTags(item) {
  const breakdown = item?.score_breakdown || {}
  const tags = []
  const preferenceWeight = Number(breakdown.preference_weight || 0)
  const globalQualityWeight = Number(breakdown.global_quality_weight || 0)
  if (preferenceWeight >= 1) {
    tags.push({
      text: '根据您的反馈加权',
      tone: 'positive',
      detail: '您过往更认可这类焦点，所以排序略微前移。',
    })
  } else if (preferenceWeight <= -1) {
    tags.push({
      text: '根据您的反馈降权',
      tone: 'negative',
      detail: '您过往较少认可这类焦点，所以排序略微后移。',
    })
  }
  if (globalQualityWeight >= 1) {
    tags.push({
      text: '同类历史验证较好',
      tone: 'positive',
      detail: '同类焦点在盘后复盘中更常被验证。',
    })
  } else if (globalQualityWeight <= -1) {
    tags.push({
      text: '同类历史验证偏弱',
      tone: 'warning',
      detail: '同类焦点在盘后复盘中验证质量偏弱，建议更重视证据链。',
    })
  }
  return tags
}

function qualityItemLabel(item) {
  if (!item) return '-'
  if (item.dimension === 'event_type') return eventLabel(item.key)
  if (item.dimension === 'subject_type') {
    return {
      market: '全市场',
      sector: '板块',
      stock: '个股',
    }[item.key] || item.key || '-'
  }
  return item.key || '-'
}

async function submitFocusFeedback(item, action) {
  if (!item.focus_key) return
  error.value = ''
  try {
    const res = await axios.post('/api/market-insights/focus/feedback', {
      focus_key: item.focus_key,
      action,
      trade_date: compactDate(),
    })
    item.feedback = res.data?.data || { action, label: feedbackActionLabel(action) }
    message.value = `已标记为${feedbackActionLabel(action)}`
    await loadFocus()
  } catch (err) {
    setError(err, '保存焦点反馈失败')
  }
}

async function loadSectorSeries(row) {
  const res = await axios.get('/api/market-insights/sector-strength/series', {
    params: {
      trade_date: compactDate(),
      level: row.level || sectorLevel.value,
      sector_code: row.sector_code,
      limit: 120,
      simulate_if_sparse: true,
    },
  })
  selectedSectorSeries.value = res.data?.data || []
  selectedSectorSeriesSimulated.value = !!res.data?.is_simulated
}

async function selectSector(row) {
  selectedEvent.value = {
    event_type: 'SECTOR_STRUCTURE',
    severity: 'info',
    confidence: 0,
    title: `${row.sector_name} 板块结构`,
    summary: `${row.sector_name} 当前上涨比例 ${percent(row.positive_ratio)}，相对全市场 ${percent(row.relative_positive_ratio)}。`,
    subject_type: 'sector',
    subject_code: row.sector_code,
    subject_name: row.sector_name,
    level: row.level || sectorLevel.value,
    snapshot_time: row.snapshot_time,
    supporting_points: ['这是板块结构快照，不是买卖信号'],
    counter_points: ['需要结合事件流判断变化方向'],
    watch_conditions: ['观察 15 分钟变化和成交质量是否持续'],
    evidence: row,
  }
  try {
    await loadSectorSeries(row)
  } catch (err) {
    setError(err, '加载板块趋势失败')
  }
}

function percent(value) {
  const n = Number(value)
  return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : '-'
}

function eventLabel(type) {
  return eventTypeMeta.value[type]?.label || fallbackEventTypeMeta[type]?.label || type || '-'
}

function eventMeta(type) {
  return eventTypeMeta.value[type] || fallbackEventTypeMeta[type] || null
}

function score(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? `${n.toFixed(1)}分` : '-'
}

function yuan(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  return n.toFixed(0)
}

function signedNumber(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return '0.0'
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}`
}

function numClass(value) {
  const n = Number(value)
  return {
    positive: Number.isFinite(n) && n > 0,
    negative: Number.isFinite(n) && n < 0,
  }
}

function formatSnapshot(value) {
  const s = String(value || '')
  if (s.length !== 12) return s || '-'
  return `${s.slice(8, 10)}:${s.slice(10, 12)}`
}

onMounted(loadAll)
</script>

<style scoped>
.insights-page {
  background: #fff;
  border-radius: 8px;
  color: #1f2937;
  padding: 16px;
}
.page-header,
.actions,
.overview,
.panel-title,
.event-top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.page-header,
.panel-title,
.event-top {
  justify-content: space-between;
}
.page-header {
  flex-wrap: wrap;
  margin-bottom: 14px;
}
h3,
h4,
h5,
p {
  margin: 0;
}
.page-header p,
.summary,
.muted {
  color: #64748b;
}
.actions {
  flex-wrap: wrap;
}
input,
select {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 6px 8px;
}
.btn {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  cursor: pointer;
  padding: 6px 10px;
}
.btn.primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.alert {
  border-radius: 6px;
  margin-bottom: 10px;
  padding: 8px 10px;
}
.alert.error {
  background: #fee2e2;
  color: #991b1b;
}
.alert.info {
  background: #e0f2fe;
  color: #075985;
}
.overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 12px;
}
.card,
.panel {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
}
.card span {
  color: #64748b;
  display: block;
  font-size: 12px;
}
.card strong {
  display: block;
  font-size: 20px;
  margin-top: 4px;
}
.focus-panel {
  background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  margin-bottom: 12px;
  padding: 12px;
}
.focus-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 10px;
}
.focus-card {
  background: #fff;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  cursor: pointer;
  padding: 12px;
  text-align: left;
}
.focus-card.active,
.focus-card:hover {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
}
.focus-card:focus {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
.focus-top {
  align-items: center;
  color: #64748b;
  display: flex;
  font-size: 12px;
  justify-content: space-between;
  margin-bottom: 8px;
}
.focus-score {
  background: #2563eb;
  border-radius: 999px;
  color: #fff;
  font-weight: 700;
  padding: 2px 8px;
}
.focus-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 8px;
}
.focus-tags span {
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
  border-radius: 999px;
  color: #166534;
  font-size: 11px;
  padding: 2px 7px;
}
.focus-explain-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 8px;
}
.focus-explain-tag {
  border-radius: 999px;
  font-size: 11px;
  padding: 2px 7px;
}
.focus-explain-tag.positive {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1d4ed8;
}
.focus-explain-tag.negative {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}
.focus-explain-tag.warning {
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
}
.focus-feedback-current {
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 6px;
  color: #92400e;
  font-size: 12px;
  margin-bottom: 8px;
  padding: 5px 7px;
}
.focus-review {
  border-radius: 6px;
  font-size: 12px;
  margin-bottom: 8px;
  padding: 5px 7px;
}
.focus-review.confirmed {
  background: #dcfce7;
  border: 1px solid #bbf7d0;
  color: #166534;
}
.focus-review.faded {
  background: #fee2e2;
  border: 1px solid #fecaca;
  color: #991b1b;
}
.focus-review.unconfirmed {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #475569;
}
.focus-review.insufficient_data {
  background: #fef9c3;
  border: 1px solid #fde68a;
  color: #854d0e;
}
.focus-feedback-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.focus-feedback-actions button {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  color: #334155;
  cursor: pointer;
  font-size: 12px;
  padding: 4px 9px;
}
.focus-feedback-actions button:hover {
  background: #eff6ff;
  border-color: #93c5fd;
  color: #1d4ed8;
}
.focus-card h4 {
  font-size: 15px;
}
.focus-card p,
.focus-reason,
.focus-action {
  color: #475569;
  font-size: 13px;
  margin-top: 7px;
}
.focus-reason strong,
.focus-action strong {
  color: #1d4ed8;
  display: block;
  font-size: 12px;
  margin-bottom: 2px;
}
.guide-panel {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 12px;
  padding: 12px;
}
.guide-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 10px;
}
.guide-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  padding: 9px;
  text-align: left;
}
.guide-card.active {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
}
.guide-card-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.guide-card-head span {
  color: #64748b;
  font-size: 12px;
  white-space: nowrap;
}
.guide-card p,
.guide-detail {
  color: #475569;
  font-size: 12px;
  margin-top: 6px;
}
.guide-detail b {
  color: #334155;
}
.quality-panel {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 12px;
  padding: 12px;
}
.quality-panel .panel-title {
  align-items: flex-start;
}
.quality-panel .panel-title span {
  color: #64748b;
  display: block;
  font-size: 12px;
  margin-top: 2px;
}
.quality-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
.quality-table td:last-child {
  font-weight: 700;
}
.quality-table tbody tr {
  cursor: default;
}
.layout {
  display: grid;
  grid-template-columns: minmax(260px, 0.9fr) minmax(420px, 1.35fr) minmax(320px, 1fr);
  gap: 12px;
}
.layout > .panel {
  min-width: 0;
}
.event-item {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  display: block;
  margin-top: 10px;
  padding: 10px;
  text-align: left;
  width: 100%;
}
.event-item.active {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
}
.event-item p {
  color: #475569;
  font-size: 13px;
  margin: 6px 0;
}
.event-item small {
  color: #64748b;
}
.badge {
  background: #f1f5f9;
  border-radius: 999px;
  color: #475569;
  display: inline-block;
  font-size: 11px;
  padding: 2px 7px;
}
.badge.high {
  background: #fee2e2;
  color: #b91c1c;
}
.badge.medium {
  background: #fef3c7;
  color: #92400e;
}
.badge.low {
  background: #dcfce7;
  color: #166534;
}
table {
  border-collapse: collapse;
  margin-top: 10px;
  width: 100%;
}
th,
td {
  border: 1px solid #e2e8f0;
  font-size: 13px;
  padding: 7px 8px;
  text-align: left;
}
th {
  background: #f8fafc;
  color: #475569;
}
tbody tr {
  cursor: pointer;
}
tbody tr:hover {
  background: #f8fafc;
}
.positive {
  color: #dc2626;
}
.negative {
  color: #16a34a;
}
.empty {
  color: #64748b;
  padding: 20px;
  text-align: center;
}
.empty.compact {
  padding: 10px;
}
.kv {
  display: grid;
  gap: 6px 12px;
  grid-template-columns: 80px 1fr;
  margin: 12px 0;
}
.kv span {
  color: #64748b;
}
.usage-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin: 12px 0;
  padding: 10px;
}
.usage-row {
  margin-top: 8px;
}
.usage-row strong {
  color: #334155;
  display: block;
  font-size: 13px;
  margin-bottom: 3px;
}
.usage-row p {
  color: #475569;
  font-size: 13px;
}
ul {
  margin: 6px 0 12px 18px;
  padding: 0;
}
pre {
  background: #0f172a;
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 12px;
  max-height: 280px;
  overflow: auto;
  padding: 10px;
}
.trend-chart {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-top: 8px;
  padding: 8px;
}
.simulated-note {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 6px;
  color: #9a3412;
  font-size: 12px;
  margin-top: 8px;
  padding: 7px 8px;
}
.trend-chart svg {
  display: block;
  height: 120px;
  width: 100%;
}
.trend-axis,
.trend-kpis {
  color: #64748b;
  display: flex;
  font-size: 12px;
  justify-content: space-between;
  margin-top: 6px;
}
.insight-sector-contributors {
  margin-top: 8px;
}
@media (max-width: 1100px) {
  .layout,
  .overview,
  .focus-grid,
  .guide-grid {
    grid-template-columns: 1fr;
  }
}
</style>
