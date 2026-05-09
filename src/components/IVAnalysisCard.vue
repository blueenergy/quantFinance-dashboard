<template>
  <div class="iv-card">
    <!-- 标题行 -->
    <div class="iv-card__header">
      <div class="iv-card__title">
        📈 A股波动率分析
        <span v-if="snapshotDate" class="iv-card__date">{{ snapshotDate }}</span>
        <span v-if="snapshotSource" class="iv-src-badge" :class="'iv-src--' + snapshotSource">
          {{ {'live':'实时','mem_cache':'缓存','db_cache':'DB缓存','market_daily_fallback':'日报副产品'}[snapshotSource] || snapshotSource }}
        </span>
      </div>
      <div class="iv-card__actions">
        <button class="iv-btn iv-btn--ghost" :disabled="loading" @click="reload" title="刷新快照">↻</button>
        <button
          class="iv-btn iv-btn--primary"
          :disabled="interpreting"
          @click="triggerInterpret"
          :title="!ivSnap ? '数据就绪后 quantAnalyzer 将自动解读' : 'LLM 分析（异步，约30-60秒）'"
        >
          <span v-if="interpreting === 'submitted'">⏳ 已提交</span>
          <span v-else-if="interpreting === 'polling'">↻ 刷新中</span>
          <span v-else>🤖 LLM 解读</span>
        </button>
      </div>
    </div>
    <div class="iv-card__divider" />

    <!-- 加载中 -->
    <div v-if="loading" class="iv-card__loading">加载波动率数据中…</div>

    <!-- 无数据 -->
    <div v-else-if="!ivSnap" class="iv-card__empty">
      暂无波动率数据，点击「LLM 解读」按钮触发分析任务（quantAnalyzer 将从 Tushare 拉取数据并生成解读）
    </div>

    <!-- 主体 -->
    <div v-else class="iv-card__body">
      <!-- 主指数大卡 -->
      <div class="iv-primary-row">
        <div class="iv-primary-badge" :class="'iv-primary--' + ivSnap.level">
          <div class="iv-primary__name">{{ ivSnap.underlying }}（主要参考）</div>
          <div class="iv-primary__val">{{ ivSnap.source === 'HV' ? 'HV20' : 'IV' }} {{ ivSnap.iv_30 }}%</div>
          <div class="iv-primary__level">{{ ivSnap.level_zh }}</div>
          <div v-if="ivSnap.skew_pp !== null" class="iv-primary__skew">
            认沽偏度 {{ ivSnap.skew_pp > 0 ? '+' : '' }}{{ ivSnap.skew_pp }}pp
          </div>
        </div>

        <!-- 波动率水位说明 -->
        <div class="iv-level-legend">
          <div class="iv-legend__title">历史水位参考</div>
          <div v-for="row in LEVEL_LEGEND" :key="row.level" class="iv-legend__row" :class="'iv-legend--' + row.level">
            <span class="iv-legend__range">{{ row.range }}</span>
            <span class="iv-legend__label">{{ row.label }}</span>
          </div>
        </div>
      </div>

      <!-- 四指数对比 -->
      <div v-if="hasMultiIndex" class="iv-indices-section">
        <div class="iv-indices__title">全指数对比（对标 A股版 VIX 矩阵）</div>
        <div class="iv-indices-grid">
          <div
            v-for="(idx, key) in ivSnap.indices"
            :key="key"
            class="iv-index-card"
            :class="'iv-index--' + idx.level"
          >
            <div class="iv-index__top">
              <span class="iv-index__name">{{ idx.name }}</span>
              <span class="iv-index__label">{{ idx.label }}</span>
            </div>
            <div class="iv-index__val">{{ idx.iv_30 }}%</div>
            <div class="iv-index__bottom">
              <span class="iv-index__level">{{ idx.level_zh }}</span>
              <span v-if="idx.skew_pp !== null" class="iv-index__skew">偏{{ idx.skew_pp > 0 ? '+' : '' }}{{ idx.skew_pp }}pp</span>
            </div>
            <div class="iv-index__src">{{ idx.source }}</div>
          </div>
        </div>
      </div>

      <!-- LLM 解读区域 -->
      <div v-if="interpretation || interpreting" class="iv-interp-section">
        <div class="iv-interp__header">
          <span class="iv-interp__title">🧠 LLM 专业解读</span>
          <span v-if="interpretedAt" class="iv-interp__time">{{ interpretedAt }}</span>
        </div>
        <div v-if="interpreting" class="iv-interp__loading">
          <span class="iv-interp__spinner">⏳</span>
          <span v-if="interpreting === 'submitted'">分析任务已提交，quantAnalyzer 正在处理（约30-60秒）…</span>
          <span v-else>刷新中…</span>
        </div>
        <div v-else class="iv-interp__text">{{ interpretation }}</div>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="iv-card__error">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getIVSnapshot, interpretIVSnapshot } from '../api/riskReport.js'

const loading      = ref(false)
const interpreting = ref(null)  // null | 'submitted' | 'polling'
const error        = ref('')
const taskMsg      = ref('')

const ivSnap         = ref(null)
const snapshotDate   = ref(null)
const snapshotSource = ref(null)   // 'live' | 'mem_cache' | 'db_cache' | 'market_daily_fallback'
const interpretation = ref(null)
const interpretedAt  = ref(null)

const hasMultiIndex = computed(() =>
  ivSnap.value && Object.keys(ivSnap.value.indices || {}).length > 1
)

const LEVEL_LEGEND = [
  { level: 'calm',     range: '< 15%',   label: '低波动 — 市场平静/乐观' },
  { level: 'normal',   range: '15–20%',  label: '正常区间' },
  { level: 'elevated', range: '20–35%',  label: '偏高 — 市场偏谨慎' },
  { level: 'panic',    range: '> 35%',   label: '高位预警 — 恐慌/危机' },
]

async function reload() {
  loading.value = true
  error.value = ''
  try {
    const data = await getIVSnapshot()
    ivSnap.value         = data.iv_snapshot   || null
    snapshotDate.value   = data.snapshot_date || null
    snapshotSource.value = data.snapshot_source || null
    interpretation.value = data.interpretation || null
    interpretedAt.value  = data.interpreted_at
      ? data.interpreted_at.slice(0, 16).replace('T', ' ')
      : null
  } catch (e) {
    error.value = `加载失败：${e.message}`
  } finally {
    loading.value = false
  }
}

async function triggerInterpret() {
  interpreting.value = 'submitted'
  error.value = ''
  taskMsg.value = ''
  try {
    const data = await interpretIVSnapshot()
    // 后端现在返回 {task_id, status, message} — 任务异步执行
    taskMsg.value = data.message || 'IV分析任务已提交'
    // 30s 内每5s轮询一次，直到拿到新的解读结果
    let attempts = 0
    const maxAttempts = 8
    const poll = async () => {
      if (attempts >= maxAttempts) {
        interpreting.value = null
        return
      }
      attempts++
      interpreting.value = attempts === 1 ? 'submitted' : 'polling'
      await new Promise(r => setTimeout(r, 5000))
      try {
        const snap = await getIVSnapshot()
        const newInterp = snap.interpretation || null
        if (newInterp && newInterp !== interpretation.value) {
          // 拿到新解读，更新并停止轮询
          ivSnap.value         = snap.iv_snapshot   || ivSnap.value
          snapshotDate.value   = snap.snapshot_date || snapshotDate.value
          snapshotSource.value = snap.snapshot_source || snapshotSource.value
          interpretation.value = newInterp
          interpretedAt.value  = snap.interpreted_at
            ? snap.interpreted_at.slice(0, 16).replace('T', ' ')
            : null
          interpreting.value = null
          return
        }
      } catch (_) { /* ignore, keep polling */ }
      poll()
    }
    poll()
  } catch (e) {
    error.value = `提交失败：${e.message}`
    interpreting.value = null
  }
}

onMounted(reload)
</script>

<style scoped>
/* ── 卡片容器 ── */
.iv-card {
  background: #fff;
  border-radius: 12px;
  border: 1.5px solid #e2e8f0;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,.06);
}

.iv-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.iv-card__title {
  font-size: 16px;
  font-weight: 700;
  color: #1a202c;
  display: flex;
  align-items: center;
  gap: 8px;
}
.iv-card__date {
  font-size: 12px;
  font-weight: 400;
  color: #718096;
}
.iv-src-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 7px;
  border-radius: 10px;
  border: 1px solid transparent;
}
.iv-src--live      { background: #f0fff4; border-color: #9ae6b4; color: #276749; }
.iv-src--mem_cache { background: #ebf4ff; border-color: #bee3f8; color: #2b6cb0; }
.iv-src--db_cache  { background: #fffaf0; border-color: #fbd38d; color: #c05621; }
.iv-card__actions { display: flex; gap: 8px; align-items: center; }
.iv-card__divider { height: 1px; background: #edf2f7; margin: 12px 0; }
.iv-card__loading, .iv-card__empty { color: #a0aec0; font-size: 14px; padding: 12px 0; }
.iv-card__error { color: #c53030; font-size: 13px; margin-top: 8px; }
.iv-card__body { display: flex; flex-direction: column; gap: 20px; }

/* ── 按钮 ── */
.iv-btn {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: opacity .15s;
}
.iv-btn:disabled { opacity: .5; cursor: default; }
.iv-btn--ghost   { background: #f7fafc; border-color: #e2e8f0; color: #4a5568; }
.iv-btn--ghost:hover:not(:disabled)   { background: #edf2f7; }
.iv-btn--primary { background: #2b6cb0; color: #fff; }
.iv-btn--primary:hover:not(:disabled) { background: #2c5282; }

/* ── 主指数行 ── */
.iv-primary-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}
.iv-primary-badge {
  flex: 0 0 auto;
  padding: 14px 20px;
  border-radius: 12px;
  border: 2px solid transparent;
  min-width: 160px;
}
.iv-primary__name  { font-size: 12px; opacity: .75; margin-bottom: 4px; }
.iv-primary__val   { font-size: 26px; font-weight: 800; line-height: 1.1; }
.iv-primary__level { font-size: 14px; font-weight: 600; margin-top: 4px; }
.iv-primary__skew  { font-size: 12px; opacity: .8; margin-top: 2px; }

.iv-primary--calm     { background: #ebf4ff; border-color: #bee3f8; color: #2b6cb0; }
.iv-primary--normal   { background: #f0fff4; border-color: #9ae6b4; color: #276749; }
.iv-primary--elevated { background: #fffaf0; border-color: #fbd38d; color: #c05621; }
.iv-primary--panic    { background: #fff5f5; border-color: #fc8181; color: #c53030; }

/* ── 水位图例 ── */
.iv-level-legend {
  flex: 1;
  min-width: 180px;
}
.iv-legend__title { font-size: 11px; color: #a0aec0; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .04em; }
.iv-legend__row   { display: flex; align-items: center; gap: 8px; padding: 4px 10px; border-radius: 6px; margin-bottom: 3px; font-size: 12px; }
.iv-legend__range { font-weight: 600; min-width: 60px; }
.iv-legend--calm     { background: #ebf4ff; color: #2b6cb0; }
.iv-legend--normal   { background: #f0fff4; color: #276749; }
.iv-legend--elevated { background: #fffaf0; color: #c05621; }
.iv-legend--panic    { background: #fff5f5; color: #c53030; }

/* ── 四指数网格 ── */
.iv-indices-section { }
.iv-indices__title { font-size: 12px; color: #718096; margin-bottom: 10px; }
.iv-indices-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}
.iv-index-card {
  padding: 12px 14px;
  border-radius: 10px;
  border: 1.5px solid transparent;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.iv-index__top    { display: flex; flex-direction: column; gap: 1px; }
.iv-index__name   { font-size: 13px; font-weight: 700; }
.iv-index__label  { font-size: 11px; opacity: .7; }
.iv-index__val    { font-size: 22px; font-weight: 800; margin: 4px 0 2px; }
.iv-index__bottom { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.iv-index__level  { font-size: 12px; font-weight: 600; }
.iv-index__skew   { font-size: 11px; opacity: .75; }
.iv-index__src    { font-size: 10px; opacity: .5; margin-top: 4px; }

.iv-index--calm     { background: #ebf4ff; border-color: #bee3f8; color: #2b6cb0; }
.iv-index--normal   { background: #f0fff4; border-color: #9ae6b4; color: #276749; }
.iv-index--elevated { background: #fffaf0; border-color: #fbd38d; color: #c05621; }
.iv-index--panic    { background: #fff5f5; border-color: #fc8181; color: #c53030; }

/* ── LLM 解读区 ── */
.iv-interp-section {
  background: #f7fafc;
  border-radius: 10px;
  padding: 14px 16px;
  border-left: 3px solid #4299e1;
}
.iv-interp__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.iv-interp__title { font-size: 13px; font-weight: 700; color: #2d3748; }
.iv-interp__time  { font-size: 11px; color: #a0aec0; }
.iv-interp__loading { color: #718096; font-size: 13px; }
.iv-interp__spinner { animation: spin 1.5s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }
.iv-interp__text {
  font-size: 13.5px;
  color: #2d3748;
  line-height: 1.75;
  white-space: pre-wrap;
}
</style>
