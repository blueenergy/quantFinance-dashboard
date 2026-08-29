<template>
  <section class="workbench-card">
    <div class="card-title-row">
      <h3>公募库存四态</h3>
      <span class="muted">
        <template v-if="loading">刷新中…</template>
        <template v-else-if="snapshot">{{ snapshot.period_curr || '-' }} vs {{ snapshot.period_prev || '-' }}</template>
        <template v-else>暂无快照</template>
      </span>
    </div>
    <p class="muted lag-note">{{ snapshot?.lag_note || '主动基金季报持仓，剥股价后看存量还是新基金在买。不是今日买卖。' }}</p>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    <template v-if="snapshot">
      <div class="financial-metrics">
        <div>
          <span>库存状态</span>
          <strong :class="stateClass">{{ snapshot.state_label || '-' }}</strong>
        </div>
        <div>
          <span>剔除股价后净增减</span>
          <strong :class="chgClass(snapshot.net_ex_price_yi)">{{ fmtYi(snapshot.net_ex_price_yi) }}</strong>
        </div>
        <div>
          <span>表面持仓市值变化</span>
          <strong :class="chgClass(snapshot.surface_mv_chg_yi)">{{ fmtYi(snapshot.surface_mv_chg_yi) }}</strong>
        </div>
        <div>
          <span>股价贡献的市值</span>
          <strong>{{ fmtYi(snapshot.mv_price_effect_yi) }}</strong>
        </div>
        <div>
          <span>新进基金</span>
          <strong :class="chgClass(snapshot.new_inflow_yi)">{{ fmtYi(snapshot.new_inflow_yi) }}</strong>
        </div>
        <div>
          <span>存量机构变化</span>
          <strong :class="chgClass(snapshot.incumbent_delta_yi)">{{ fmtYi(snapshot.incumbent_delta_yi) }}</strong>
        </div>
      </div>
      <p v-if="snapshot.state_hint" class="muted-block">{{ snapshot.state_hint }}</p>
    </template>
    <div v-else-if="!loading && !error" class="muted-block">
      尚未生成公募库存快照。需要先回补两期全持仓并运行 fund_inventory 任务。
    </div>
  </section>

  <section v-if="snapshot" class="workbench-card">
    <div class="card-title-row">
      <h3>四个问题</h3>
      <span class="muted">{{ snapshot.compare_mode === 'full_vs_full' ? '全持仓对比' : '前十大对齐' }}</span>
    </div>
    <div class="question-list">
      <article v-for="item in questions" :key="item.id">
        <h4>{{ item.question }}</h4>
        <p class="answer" :class="chgClass(item.value_yi)">{{ fmtYi(item.value_yi) }}</p>
        <p class="muted">{{ item.detail }}</p>
      </article>
    </div>
  </section>

  <section v-if="snapshot" class="workbench-card">
    <div class="card-title-row">
      <h3>基金家数</h3>
      <span class="muted">主动偏股 · 份额已按策略合并</span>
    </div>
    <div class="financial-metrics">
      <div><span>上期</span><strong>{{ snapshot.n_funds_prev ?? '-' }}</strong></div>
      <div><span>本期</span><strong>{{ snapshot.n_funds_curr ?? '-' }}</strong></div>
      <div><span>新进</span><strong>{{ snapshot.n_new ?? '-' }}</strong></div>
      <div><span>退出</span><strong>{{ snapshot.n_exited ?? '-' }}</strong></div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  snapshot: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const questions = computed(() => Array.isArray(props.snapshot?.four_questions) ? props.snapshot.four_questions : [])
const stateClass = computed(() => {
  const state = props.snapshot?.state
  return {
    'is-strengthen': state === 'incumbent_strengthen',
    'is-new': state === 'new_inventory',
    'is-turnover': state === 'inventory_turnover',
    'is-exit': state === 'inventory_exit',
  }
})

function fmtYi(value) {
  if (value == null || value === '') return '-'
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)} 亿`
}

function chgClass(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return ''
  return n > 0 ? 'is-up' : 'is-down'
}
</script>

<style scoped>
.lag-note {
  margin: 0 0 14px;
}
.error-message {
  color: #f87171;
  margin: 0 0 14px;
}
.question-list {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}
.question-list article {
  background: rgba(15, 23, 42, .45);
  border: 1px solid rgba(148, 163, 184, .16);
  border-radius: 12px;
  padding: 12px;
}
.question-list h4 {
  font-size: 13px;
  margin: 0 0 8px;
}
.answer {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 6px;
}
.is-strengthen { color: #34d399; }
.is-new { color: #60a5fa; }
.is-turnover { color: #fbbf24; }
.is-exit { color: #f87171; }
</style>
