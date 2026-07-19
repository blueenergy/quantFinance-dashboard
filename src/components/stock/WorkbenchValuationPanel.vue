<template>
  <section class="panel-grid">
    <article class="workbench-card">
      <div class="card-title-row">
        <h3>估值结论</h3>
        <div class="analysis-actions">
          <span class="muted">
            {{ valuationStatus.as_of || '暂无日期' }}
            <template v-if="loading"> · 刷新中…</template>
          </span>
          <button
            type="button"
            class="text-link-button"
            :disabled="loading"
            @click="emit('refresh')"
          >
            刷新估值
          </button>
        </div>
      </div>
      <div v-if="valuationDataStatusFound" class="financial-metrics">
        <div v-for="metric in valuationConclusionMetrics" :key="metric.label">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
        </div>
      </div>
      <div v-if="valuationConfidence.reasons?.length" class="muted-block mt-2">
        数据可信度：{{ valuationConfidenceLabel }}（{{ fmtNumber(valuationConfidence.score, 0) }} 分）。
        {{ valuationConfidence.reasons[0] }}
      </div>
      <div v-if="!valuationDataStatusFound" class="muted-block">暂无足够估值数据，等待 financial_daily_basic 与财务指标补齐。</div>
    </article>

    <article class="workbench-card">
      <div class="card-title-row">
        <h3>模型适用性</h3>
        <span class="muted">{{ valuationSuitability.recommended_model || '待判断' }}</span>
      </div>
      <div class="financial-metrics">
        <div>
          <span>推荐模型</span>
          <strong>{{ valuationModelLabel }}</strong>
        </div>
        <div>
          <span>置信度</span>
          <strong>{{ fmtNumber(valuationSuitability.confidence * 100, 0, '%') }}</strong>
        </div>
        <div>
          <span>价值评分</span>
          <strong>{{ fmtNumber(valuationValueScore) }}</strong>
        </div>
      </div>
      <div v-if="valuationApplicabilityItems.length" class="quote-table-wrap mt-2">
        <table class="quote-table">
          <thead>
            <tr>
              <th>模型</th>
              <th>适用性</th>
              <th>主要原因</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in valuationApplicabilityItems" :key="item.key">
              <td>{{ item.label }}</td>
              <td>{{ item.statusLabel }}</td>
              <td>{{ item.reason }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <ul v-if="valuationSuitabilityReasons.length" class="analysis-points-list">
        <li v-for="reason in valuationSuitabilityReasons" :key="reason">{{ reason }}</li>
      </ul>
    </article>
  </section>

  <section class="workbench-card">
    <div class="card-title-row">
      <h3>DDM / 分红验证</h3>
      <div class="analysis-actions">
        <span class="muted">{{ valuationDdm.method || valuationDdm.reason || '等待分红数据' }}</span>
        <button
          type="button"
          class="text-link-button"
          data-help-topic="ddm"
          @click="openValuationHelp('ddm')"
        >
          原理说明
        </button>
      </div>
    </div>
    <div
      v-if="valuationDdmDividendQuality.warnings?.length"
      class="valuation-quality-warnings muted-block"
    >
      <p v-for="(warning, idx) in valuationDdmDividendQuality.warnings" :key="`dqw-${idx}`" class="mb-1">
        {{ warning }}
      </p>
    </div>
    <div
      v-if="valuationDdmDividendQuality.signals && Object.keys(valuationDdmDividendQuality.signals).length"
      class="valuation-quality-signals muted-block mt-2"
    >
      <span v-if="valuationDdmDividendQuality.median_payout_ratio_3y != null">
        近年中位分红率（占净利） {{ fmtPctFromRatio(valuationDdmDividendQuality.median_payout_ratio_3y) }}
      </span>
      <span v-if="valuationDdmDividendQuality.median_ocf_coverage_3y != null" class="ml-2">
        经营现金流覆盖（中位） {{ fmtNumber(valuationDdmDividendQuality.median_ocf_coverage_3y, 2) }}×
      </span>
      <span v-if="valuationDdmDividendQuality.cagr_confidence" class="ml-2">
        分红 CAGR 置信度：{{ valuationDdmDividendQuality.cagr_confidence === 'normal' ? '正常' : '偏低（样本年数不足）' }}
      </span>
    </div>
    <div v-if="valuationDdmScenarios.length" class="quote-table-wrap">
      <table class="quote-table">
        <thead>
          <tr>
            <th>情景</th>
            <th>现金分红</th>
            <th>股权成本</th>
            <th>永续增长</th>
            <th class="valuation-ddm-g-source-col">g 来源</th>
            <th>DDM 股权价值</th>
            <th>相对当前市值</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="scenario in valuationDdmScenarios" :key="scenario.name">
            <td>{{ valuationScenarioLabel(scenario.name) }}</td>
            <td>{{ fmtAmount(scenario.cash_dividend_wan) }}</td>
            <td>{{ fmtPctFromRatio(scenario.ke) }}</td>
            <td>{{ fmtPctFromRatio(scenario.growth) }}</td>
            <td class="valuation-ddm-g-source">{{ ddmGrowthSourceLabel(scenario.growth_source, scenario.name) }}</td>
            <td>{{ fmtAmount(scenario.equity_value_wan) }}</td>
            <td>{{ fmtNumber(scenario.upside_pct, 2, '%') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="valuationDdmKeBreakdownSummary" class="muted-block mt-2 valuation-ke-breakdown">
      {{ valuationDdmKeBreakdownSummary }}
    </div>
    <div v-else class="muted-block">{{ valuationDdm.reason || '暂无可计算年度分红总额的实施分红记录。' }}</div>
    <div v-if="valuationDdmAnnualRows.length" class="quote-table-wrap mt-3">
      <table class="quote-table">
        <thead>
          <tr>
            <th>年度</th>
            <th>现金分红</th>
            <th>每股税前分红合计</th>
            <th>分红率</th>
            <th>经营现金流覆盖</th>
            <th>事件数</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in valuationDdmAnnualRows" :key="row.year">
            <td>{{ row.year }}</td>
            <td>{{ fmtAmount(row.total_cash_dividend_wan) }}</td>
            <td>{{ fmtNumber(row.cash_div_tax_sum) }}</td>
            <td>{{ fmtPctFromRatio(row.payout_ratio) }}</td>
            <td>{{ fmtNumber(row.ocf_coverage) }}</td>
            <td>{{ row.events || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="workbench-card">
    <div class="card-title-row">
      <h3>DCF 三情景</h3>
      <div class="analysis-actions">
        <span class="muted">{{ valuationDcf.method || valuationDcf.reason || 'FCFF + WACC' }}</span>
        <button
          type="button"
          class="text-link-button"
          data-help-topic="dcf"
          @click="openValuationHelp('dcf')"
        >
          原理说明
        </button>
      </div>
    </div>
    <div v-if="valuationIsFinancial" class="muted-block valuation-dcf-financial-note">
      银行/保险/证券：FCFF DCF 口径不适用，每股价值与安全边际不可作为目标价，请改看 PB-ROE / DDM 与股息率。
    </div>
    <div v-if="valuationDcfNetDebtNote" class="muted-block valuation-dcf-netdebt-note">
      {{ valuationDcfNetDebtNote }}
    </div>
    <div v-if="valuationDcfPerShareNote" class="muted-block valuation-dcf-per-share-note mt-2">
      {{ valuationDcfPerShareNote }}
    </div>
    <div v-if="valuationDcfSharesBasisNote" class="muted-block mt-2">
      {{ valuationDcfSharesBasisNote }}
    </div>
    <div v-if="valuationDcfFairValueGapNote" class="muted-block mt-2">
      {{ valuationDcfFairValueGapNote }}
    </div>
    <div v-if="valuationDcfScenarios.length" class="quote-table-wrap">
      <table class="quote-table">
        <thead>
          <tr>
            <th>情景</th>
            <th>WACC</th>
            <th>永续增长</th>
            <th>初始增长</th>
            <th>企业价值 EV</th>
            <th>每股价值</th>
            <th>安全边际</th>
            <th>股权价值</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="scenario in valuationDcfScenarios" :key="scenario.name">
            <td>{{ valuationScenarioLabel(scenario.name) }}</td>
            <td>{{ fmtPctFromRatio(scenario.wacc) }}</td>
            <td>{{ fmtPctFromRatio(scenario.terminal_growth) }}</td>
            <td>{{ fmtPctFromRatio(scenario.initial_growth) }}</td>
            <td>{{ fmtAmount(scenario.enterprise_value_wan) }}</td>
            <td :class="{ 'valuation-na-cell': valuationIsFinancial }">{{ valuationIsFinancial ? '不适用' : fmtNumber(scenario.fair_value_per_share) }}</td>
            <td :class="{ 'valuation-na-cell': valuationIsFinancial }">{{ valuationIsFinancial ? '不适用' : fmtNumber(scenario.safety_margin_pct, 2, '%') }}</td>
            <td>{{ fmtAmount(scenario.equity_value_wan) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div
      v-if="valuationDcfScenarios.length && valuationDcfSensitivityVariables.length"
      class="quote-table-wrap mt-3"
    >
      <table class="quote-table">
        <thead>
          <tr>
            <th>敏感项</th>
            <th>档位</th>
            <th>每股价值</th>
            <th>股权价值</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="variable in valuationDcfSensitivityVariables" :key="variable.key">
            <tr v-for="row in variable.cases" :key="`${variable.key}-${row.label}`">
              <td>{{ variable.label }}</td>
              <td>{{ row.label }}</td>
              <td :class="{ 'valuation-na-cell': valuationIsFinancial }">{{ valuationIsFinancial ? '不适用' : fmtNumber(row.fair_value_per_share) }}</td>
              <td>{{ fmtAmount(row.equity_value_wan) }}</td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <div v-if="!valuationDcfScenarios.length" class="muted-block">{{ valuationDcf.reason || '暂无足够现金流样本生成 DCF。' }}</div>
  </section>

  <section class="panel-grid">
    <article class="workbench-card">
      <div class="card-title-row">
        <h3>相对估值</h3>
        <span class="muted">当前倍数 vs 自身历史分位</span>
      </div>
      <div class="financial-metrics">
        <div v-for="metric in valuationMultipleMetrics" :key="metric.label">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
        </div>
      </div>
    </article>

    <article class="workbench-card">
      <div class="card-title-row">
        <h3>假设调参</h3>
        <span class="muted">阶段二</span>
      </div>
      <div class="muted-block">
        第一版使用后端固定保守/中性/乐观三情景。折现率、增长率、预测期等手动调参入口已预留，后续接带参 API。
      </div>
    </article>
  </section>

  <v-dialog v-model="valuationHelpOpen" max-width="720" scrollable>
    <v-card class="valuation-help-card">
      <v-card-title class="text-wrap">
        {{ valuationHelpContent.title }}
      </v-card-title>
      <v-card-text>
        <div class="valuation-help-content">
          <p class="muted">{{ valuationHelpContent.summary }}</p>
          <h4>核心公式</h4>
          <p><code>{{ valuationHelpContent.formula }}</code></p>
          <h4>如何理解当前结果</h4>
          <ul>
            <li v-for="item in valuationHelpContent.interpretation" :key="item">{{ item }}</li>
          </ul>
          <h4>主要局限</h4>
          <ul>
            <li v-for="item in valuationHelpContent.limits" :key="item">{{ item }}</li>
          </ul>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="valuationHelpOpen = false">关闭</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import {
  ddmGrowthSourceLabel,
  fmtAmount,
  fmtNumber,
  fmtPctFromRatio,
  valuationScenarioLabel,
} from '../../utils/workbenchFormat'

defineProps({
  valuationStatus: { type: Object, default: () => ({}) },
  valuationDataStatusFound: { type: Boolean, default: false },
  valuationConclusionMetrics: { type: Array, default: () => [] },
  valuationConfidence: { type: Object, default: () => ({}) },
  valuationConfidenceLabel: { type: String, default: '' },
  valuationSuitability: { type: Object, default: () => ({}) },
  valuationModelLabel: { type: String, default: '' },
  valuationValueScore: { type: [Number, String], default: null },
  valuationApplicabilityItems: { type: Array, default: () => [] },
  valuationSuitabilityReasons: { type: Array, default: () => [] },
  valuationDdm: { type: Object, default: () => ({}) },
  valuationDdmDividendQuality: { type: Object, default: () => ({}) },
  valuationDdmScenarios: { type: Array, default: () => [] },
  valuationDdmKeBreakdownSummary: { type: String, default: '' },
  valuationDdmAnnualRows: { type: Array, default: () => [] },
  valuationIsFinancial: { type: Boolean, default: false },
  valuationDcf: { type: Object, default: () => ({}) },
  valuationDcfNetDebtNote: { type: String, default: '' },
  valuationDcfPerShareNote: { type: String, default: '' },
  valuationDcfSharesBasisNote: { type: String, default: '' },
  valuationDcfFairValueGapNote: { type: String, default: '' },
  valuationDcfScenarios: { type: Array, default: () => [] },
  valuationDcfSensitivityVariables: { type: Array, default: () => [] },
  valuationMultipleMetrics: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['refresh'])

const VALUATION_HELP = {
  ddm: {
    title: 'DDM / 分红折现模型说明',
    summary: 'DDM 以已实施现金分红为起点，股权成本 ke 采用无风险利率 + 股权风险溢价 + 风险调整（buildup，非 CAPM），永续增长率 g 优先用 ROE×(1−分红率) 等可持续增长口径，并与中性档 WACC 对齐下限。',
    formula: '股权价值 = 下一期现金分红 / (股权成本 − 永续增长率)；ke ≥ WACC，且 g < ke、g 不超过约 3%。',
    interpretation: [
      '界面「g 来源」列说明中性档永续增长来自财报 ROE 与分红率推演还是配置回退。',
      '「股权成本构成」展示无风险利率、ERP 与风险调整，便于理解 ke 并非单一魔法数。',
      '分红质量信号（现金流覆盖、分红率持续性等）会抬高或压低风险调整，进而影响三档 ke。',
    ],
    limits: [
      '戈登 DDM 对股权成本和永续增长率非常敏感，两个参数差一点，估值会变化很大。',
      '模型假设分红长期稳定增长，不适合分红不规律、强周期或高速扩张但低分红的公司。',
      '当前口径基于实施分红记录，不等同于未来董事会一定会延续相同分红政策。',
    ],
  },
  dcf: {
    title: 'DCF / 自由现金流折现说明',
    summary: 'DCF 先将 FCFF 用 WACC 折现得到企业价值（EV），再扣除净债务与少数股东权益得到股权价值；金融（银行/保险/证券）不作净债务扣减，仅将 EV 作为同口径参考。',
    formula: '企业价值 EV = 预测期 FCFF 折现 + 永续期终值折现；股权价值 = EV − 净债务 − 少数股东权益；终值 = 末期 FCFF × (1 + g) / (WACC − g)',
    interpretation: [
      '表格中的「企业价值」为 EV，「股权价值」为扣减净债务与少数股东权益后的结果（金融行业除外）。',
      '保守、中性、乐观三档分别调整折现率、初始增长率和永续增长率，用来观察估值对假设的敏感性。',
      '若 DCF 明显高于市值，但 DDM 不支持，通常说明现金流估值乐观，需要检查资本开支、分红政策和现金流可分配性。',
    ],
    limits: [
      'DCF 对长期增长率和折现率高度敏感，尤其是永续期终值占比较高时。',
      '净债务采用资产负债表有息负债减货币资金，未调整非经营资产等项目。',
      '如果 FCFF 来自异常年份或周期高点，模型可能高估公司长期可持续现金流。',
    ],
  },
}

const valuationHelpOpen = ref(false)
const valuationHelpTopic = ref('ddm')
const valuationHelpContent = computed(() => VALUATION_HELP[valuationHelpTopic.value] || VALUATION_HELP.ddm)

function openValuationHelp(topic) {
  valuationHelpTopic.value = topic === 'dcf' ? 'dcf' : 'ddm'
  valuationHelpOpen.value = true
}
</script>

<style scoped>
.analysis-points-list {
  color: #cbd5e1;
  line-height: 1.7;
  margin: 12px 0 0;
  padding-left: 18px;
}
.quote-table th.valuation-ddm-g-source-col,
.quote-table td.valuation-ddm-g-source {
  color: #e8eef7;
  font-size: 12px;
  line-height: 1.4;
  max-width: 220px;
  text-align: left;
  white-space: normal;
}
.quote-table th.valuation-ddm-g-source-col {
  color: #cbd5e1;
}
.quote-table td.valuation-na-cell {
  color: #94a3b8;
  font-style: italic;
}
.valuation-help-card {
  background: #0f172a;
  color: #e2e8f0;
}
.valuation-help-content {
  color: #cbd5e1;
  line-height: 1.7;
}
.valuation-help-content .muted {
  color: #94a3b8;
}
.valuation-help-content h4 {
  color: #f8fafc;
  font-size: 14px;
  margin: 16px 0 6px;
}
.valuation-help-content code {
  background: rgba(15, 23, 42, .86);
  border: 1px solid rgba(148, 163, 184, .2);
  border-radius: 8px;
  color: #bfdbfe;
  display: block;
  padding: 10px 12px;
  white-space: normal;
}
.valuation-help-content ul {
  margin: 0;
  padding-left: 18px;
}
.valuation-help-content li + li {
  margin-top: 6px;
}
</style>
