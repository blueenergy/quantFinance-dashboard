<template>
  <div class="industry-signals" v-if="signals && (signals.surge?.length || signals.decay?.length)">
    <div class="signals-header">
      <h4>⚡ 多维行业异动监控</h4>
      <span v-if="signals.updated_at" class="data-freshness">
        📊 行业数据更新时间: {{ formatDateTime(signals.updated_at) }}
      </span>
    </div>

    <!-- Surge Signals (The Breakouts) -->
    <div v-if="signals.surge?.length" class="signal-group surge">
      <div class="group-title">🚀 环比突破 (Surge)</div>
      <div class="signal-cards">
        <div v-for="s in signals.surge" :key="s.industry" class="signal-card surge-card">
          <div class="card-left">
            <span class="industry-name">{{ s.industry }}</span>
            <span class="stats">涨停: <strong>{{ s.today_count }}</strong> | 5日均: {{ s.avg_5d }}</span>
          </div>
          <div class="card-right">
            <div class="strength-gauge">
              <span class="label">强度</span>
              <span class="value">{{ s.strength }}x</span>
            </div>
            <div v-if="s.resonance?.active" class="resonance-tag" :class="{ positive: s.resonance.is_positive }">
              <span class="res-icon">🎯</span>
              <span class="res-text">{{ s.resonance.etf_name }} {{ s.resonance.pct_chg > 0 ? '+' : '' }}{{ s.resonance.pct_chg }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Panic Signals (The Crashes) -->
    <div v-if="signals.panic?.length" class="signal-group panic">
      <div class="group-title">💀 恐慌杀跌 (Panic)</div>
      <div class="signal-cards">
        <div v-for="s in signals.panic" :key="s.industry" class="signal-card panic-card">
          <div class="card-left">
            <span class="industry-name">{{ s.industry }}</span>
            <span class="stats">今日跌停: <strong>{{ s.today_count }}</strong> 只</span>
          </div>
          <div class="card-right">
            <div v-if="s.resonance?.active" class="resonance-tag" :class="{ positive: s.resonance.is_positive }">
              <span class="res-icon">🎯</span>
              <span class="res-text">{{ s.resonance.etf_name }} {{ s.resonance.pct_chg > 0 ? '+' : '' }}{{ s.resonance.pct_chg }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Decay Signals (The Laggers) -->
    <div v-if="signals.decay?.length" class="signal-group decay">
      <div class="group-title">📉 衰退迹象 (Decay)</div>
      <div class="signal-cards">
        <div v-for="s in signals.decay" :key="s.industry" class="signal-card decay-card">
          <div class="card-left">
            <span class="industry-name">{{ s.industry }}</span>
            <span class="stats">涨停: <strong>{{ s.today_count }}</strong> | 5日均: {{ s.avg_5d }}</span>
          </div>
          <div class="card-right">
            <div class="strength-gauge">
              <span class="label">衰减</span>
              <span class="value">{{ s.strength }}x</span>
            </div>
            <div v-if="s.resonance?.active" class="resonance-tag" :class="{ positive: s.resonance.is_positive }">
              <span class="res-icon">⚠️</span>
              <span class="res-text">{{ s.resonance.etf_name }} {{ s.resonance.pct_chg > 0 ? '+' : '' }}{{ s.resonance.pct_chg }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="no-signals">
    <p>🍃 暂无行业显著异动数据</p>
  </div>
</template>

<script setup>
const props = defineProps({
  signals: {
    type: Object,
    default: () => ({ surge: [], decay: [], updated_at: null })
  }
})

function formatDateTime(timestamp) {
  if (!timestamp) return '未知'
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.industry-signals {
  margin-top: 24px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  color: #fff;
}

.signals-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 8px;
}

.signals-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #a5b4fc;
}

.data-freshness {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.signal-group {
  margin-bottom: 20px;
}

.group-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
  opacity: 0.9;
}

.signal-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.signal-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: transform 0.2s, background 0.2s;
}

.signal-card:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.06);
}

.card-left {
  display: flex;
  flex-direction: column;
}

.industry-name {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
}

.stats {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}

.stats strong {
  color: #fff;
}

.card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.strength-gauge {
  background: rgba(0, 0, 0, 0.2);
  padding: 2px 8px;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.strength-gauge .label {
  font-size: 9px;
  text-transform: uppercase;
  opacity: 0.6;
}

.strength-gauge .value {
  font-size: 13px;
  font-weight: 700;
}

.surge-card .value { color: #10b981; }
.decay-card .value { color: #f43f5e; }

.resonance-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
}

.resonance-tag.positive {
  color: #34d399;
  border: 1px solid rgba(52, 211, 153, 0.2);
}

.resonance-tag:not(.positive) {
  color: #fb7185;
  border: 1px solid rgba(251, 113, 133, 0.2);
}

.no-signals {
  text-align: center;
  padding: 24px;
  color: #666;
  font-style: italic;
}
</style>
