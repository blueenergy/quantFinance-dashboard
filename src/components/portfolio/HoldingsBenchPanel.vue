<template>
  <section v-if="benchData" class="lineup-card bench-candidates-card">
    <div class="lineup-header">
      <div>
        <h3>替补候选</h3>
        <p class="muted lineup-hint">
          当前不在持仓中的策略候选，按算法评分排序。评分快照 {{ benchData.score_date || '-' }} ·
          替补池约 {{ benchData.bench_multiplier }}×Top{{ benchData.top_n }}。
        </p>
      </div>
      <button type="button" class="link-btn" @click="$emit('toggle-bench')">
        {{ benchExpanded ? '收起' : '展开' }}
      </button>
    </div>
    <div v-if="benchExpanded">
      <div v-if="benchLoading" class="muted">加载替补候选中…</div>
      <template v-else>
        <div class="bench-risk-bar">
          <span v-if="benchRisk" class="bench-risk-summary">
            规则风控：<b class="risk-high">{{ benchRisk.high || 0 }}高</b>
            / <b class="risk-medium">{{ benchRisk.medium || 0 }}中</b>
            / <b class="risk-low">{{ benchRisk.low || 0 }}低</b>
          </span>
          <span v-else class="muted">替补候选可先体检，高风险候选上场前会二次确认。</span>
          <button
            type="button"
            class="link-btn"
            :disabled="benchRiskLoading || !benchData.bench?.length"
            @click="$emit('load-bench-risk')"
          >
            {{ benchRiskLoading ? '规则风控运行中…' : '运行规则风控' }}
          </button>
          <button
            type="button"
            class="link-btn"
            :disabled="benchLlmRiskLoading || !benchData.bench?.length"
            @click="$emit('load-bench-llm-risk')"
          >
            {{ benchLlmRiskLoading ? 'AI 风险/机会分析运行中…' : '运行 AI 风险/机会分析' }}
          </button>
        </div>
        <div v-if="benchData.bench?.length" class="table-wrap">
          <table class="lineup-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>代码</th>
                <th>名称</th>
                <th>行业</th>
                <th>分数</th>
                <th>最新收盘</th>
                <th>规则风控</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in benchData.bench" :key="row.symbol">
                <td>{{ row.rank }}</td>
                <td>{{ row.symbol }}</td>
                <td>{{ row.name || '-' }}</td>
                <td>{{ row.industry || '-' }}</td>
                <td>{{ num(row.score_value) }}</td>
                <td class="bench-price-cell" :title="benchDailyTitle(row)">
                  <span>{{ num(row.latest_close) }}</span>
                  <small v-if="row.latest_trade_date">{{ formatBenchTradeDate(row.latest_trade_date) }}</small>
                  <small
                    v-if="row.latest_pct_chg != null"
                    :class="signClass(row.latest_pct_chg)"
                  >
                    {{ pctSigned(row.latest_pct_chg) }}
                  </small>
                </td>
                <td>
                  <div class="risk-tags">
                    <span
                      v-if="benchRowRisk(row)"
                      class="risk-badge"
                      :class="`risk-${riskDisplaySeverity(benchRowRisk(row))}`"
                      :title="aiRiskTitle(benchRowRisk(row))"
                    >
                      {{ riskSeverityLabel(riskDisplaySeverity(benchRowRisk(row))) }}
                    </span>
                    <span v-else class="muted">-</span>
                    <span
                      v-if="benchRowRisk(row)?.llm"
                      class="llm-risk-tag llm-risk-tag--btn"
                      :class="[`risk-${benchRowRisk(row).llm.severity || 'none'}`, { 'is-active': llmDetailKey === llmKey('bench', row) }]"
                      title="点击查看/放大完整风险分析"
                      role="button"
                      tabindex="0"
                      @click.stop="openLlm(benchRowRisk(row), row, 'bench', $event)"
                      @keydown.enter.stop="openLlm(benchRowRisk(row), row, 'bench', $event)"
                    >风险</span>
                    <span
                      v-if="row.ai_opportunity?.llm"
                      class="llm-risk-tag llm-risk-tag--btn llm-opportunity-tag"
                      :class="[`opportunity-${row.ai_opportunity.llm.strength || 'none'}`, { 'is-active': llmDetailKey === llmKey('bench-opp', row) }]"
                      title="点击查看/放大完整 LLM 机会"
                      role="button"
                      tabindex="0"
                      @click.stop="openLlm(row.ai_opportunity, row, 'bench-opp', $event, 'opportunity')"
                      @keydown.enter.stop="openLlm(row.ai_opportunity, row, 'bench-opp', $event, 'opportunity')"
                    >机会</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="muted">暂无替补候选。</p>
      </template>
    </div>
  </section>
</template>

<script setup>
import {
  aiRiskTitle,
  money,
  num,
  pctSigned,
  riskDisplaySeverity,
  riskSeverityLabel,
  signClass,
} from '../../composables/usePortfolioPlanFormat'

const props = defineProps({
  benchData: { type: Object, default: null },
  benchExpanded: { type: Boolean, default: false },
  benchLoading: { type: Boolean, default: false },
  benchRisk: { type: Object, default: null },
  benchRiskBySymbol: { type: Object, default: () => ({}) },
  benchRiskLoading: { type: Boolean, default: false },
  benchLlmRiskLoading: { type: Boolean, default: false },
  llmDetailKey: { type: String, default: '' },
})

const emit = defineEmits([
  'toggle-bench',
  'load-bench-risk',
  'load-bench-llm-risk',
  'open-llm',
])

function llmKey(scope, row) {
  return `${scope}:${row?.symbol || row?.name || 'unknown'}`
}

function openLlm(payload, row, scope, event, mode = 'risk') {
  emit('open-llm', { payload, row, scope, event, mode })
}

function symbolRisk(map, symbol) {
  const text = String(symbol || '')
  return map?.[text] || map?.[text.split('.')[0]] || null
}

function mergeRisk(primary, secondary) {
  const merged = { ...(secondary || {}), ...(primary || {}) }
  if (primary?.llm || secondary?.llm) merged.llm = primary?.llm || secondary?.llm
  return Object.keys(merged).length ? merged : null
}

function benchRowRisk(row) {
  return mergeRisk(row?.ai_risk || null, symbolRisk(props.benchRiskBySymbol, row?.symbol))
}

function formatBenchTradeDate(value) {
  const text = String(value || '')
  if (text.length === 8) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
  return text || '-'
}

function benchDailyTitle(row) {
  return [
    `${row.name || row.symbol || '-'} ${row.symbol || ''}`.trim(),
    `日期：${formatBenchTradeDate(row.latest_trade_date)}`,
    `开：${num(row.latest_open)}`,
    `高：${num(row.latest_high)}`,
    `低：${num(row.latest_low)}`,
    `收：${num(row.latest_close)}`,
    `昨收：${num(row.latest_pre_close)}`,
    `涨跌：${num(row.latest_change)}`,
    `涨跌幅：${pctSigned(row.latest_pct_chg)}`,
    `成交量：${money(row.latest_volume)}`,
    `成交额：${money(row.latest_amount)}`,
    `更新：${row.latest_update_time || '-'}`,
    `来源：${row.latest_price_source || '-'}`,
  ].join('\n')
}
</script>
