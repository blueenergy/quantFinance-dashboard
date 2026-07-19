<template>
  <div class="stock-workbench">
    <WorkbenchSearchBar
      v-model="directSymbol"
      :loading="loading"
      :recent-stocks="recentStocks"
      @select="selectSearchCandidate"
      @submit="submitDirectSymbol"
      @load-symbol="loadSymbol"
      @clear-recent="clearRecentSymbols"
    />

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      class="mb-4"
    >
      {{ error }}
    </v-alert>

    <section v-if="!payload && !loading" class="empty-state">
      <h3>选择一只股票开始研究</h3>
      <p>例如输入 600519、000858 或股票名称，工作台会自动聚合评分、财务与深度分析结果。</p>
    </section>

    <template v-if="payload">
      <WorkbenchHero
        :name="stockName"
        :symbol="stockSymbol"
        :fallback-symbol="payload.symbol"
        :industry="stockIndustry"
        :industry-l2="stockIndustryL2"
        :industry-l3="stockIndustryL3"
        :index-codes="indexCodes"
        :section-status-items="sectionStatusItems"
        :latest-price="latestPrice"
        :latest-pct-change="latestPctChange"
        :change-class="changeClass"
        :price-change-title="priceChangeTitle"
        :quote-loading="sectionLoading.quote"
        :composite-score="currentCompositeScore"
        :rating-text="ratingText"
        :score-date="dataStatus.score_date"
        :quote-date="dataStatus.quote_date"
        @select-panel="activePanel = $event"
      />

      <v-tabs v-model="activePanel" class="workbench-tabs" color="primary">
        <v-tab value="overview">总览</v-tab>
        <v-tab value="quote">行情资金</v-tab>
        <v-tab value="nine-turn">神奇九转</v-tab>
        <v-tab value="scores">量化评分</v-tab>
        <v-tab value="financial">财务业绩</v-tab>
        <v-tab value="valuation">估值模型</v-tab>
        <v-tab value="shareholders">股东筹码</v-tab>
        <v-tab value="swot">SWOT</v-tab>
        <v-tab value="analysis">深度分析</v-tab>
      </v-tabs>

      <v-window v-model="activePanel">
        <v-window-item value="overview">
          <WorkbenchOverviewPanel
            :score-items="scoreItems"
            :deep-analysis="deepAnalysis"
            :analysis-summary="analysisSummary"
            :analysis-points="analysisPoints"
            :overview-quote-metrics="overviewQuoteMetrics"
            :status-items="statusItems"
            :quote-data-available="overviewQuoteDataAvailable"
            :active="activePanel === 'overview'"
            @goto-panel="activePanel = $event"
          />
        </v-window-item>

        <v-window-item value="quote">
          <WorkbenchQuotePanel
            v-model:quote-kline-tf="quoteKlineTf"
            :quote-section-date="quoteSectionDate"
            :loading="sectionLoading.quote"
            :quote-metrics="quoteMetrics"
            :latest-money-flow="latestMoneyFlow"
            :money-flow-metrics="moneyFlowMetrics"
            :entry-risk="entryRisk"
            :entry-risk-severity="entryRiskSeverity"
            :entry-risk-severity-label="entryRiskSeverityLabel"
            :entry-risk-narrative-rows="entryRiskNarrativeRows"
            :quote-kline-tf-options="quoteKlineTfOptions"
            :quote-kline-title="quoteKlineTitle"
            :quote-kline-short-label="quoteKlineShortLabel"
            :quote-kline-rows="quoteKlineRows"
            :quote-kline-is-loading="quoteKlineIsLoading"
            :active-money-flow-history="activeMoneyFlowHistory"
            :money-flow-summary="moneyFlowSummary"
            :money-flow-is-loading="moneyFlowIsLoading"
            @refresh="refreshQuoteSection"
          />
        </v-window-item>

        <v-window-item value="nine-turn">
          <WorkbenchNineTurnPanel
            :nine-turn-status="nineTurnStatus"
            :loading="sectionLoading.nine_turn"
            :latest-nine-turn-signal="latestNineTurnSignal"
            :nine-turn-daily-rows="nineTurnDailyRows"
            :nine-turn-signals="nineTurnSignals"
            :nine-turn-markers="nineTurnMarkers"
          />
        </v-window-item>

        <v-window-item value="scores">
          <WorkbenchScoresPanel
            :score-items="scoreItems"
            :score-history="scoreHistory"
            :loading="sectionLoading.scores"
          />
        </v-window-item>

        <v-window-item value="financial">
          <WorkbenchFinancialPanel
            v-model:financial-mode="financialMode"
            :financial-mode-label="financialModeLabel"
            :financial-chart-data="financialChartData"
            :financial-metrics="financialMetrics"
            :financial-metrics-period-text="financialMetricsPeriodText"
            :financial-quality-cards="financialQualityCards"
            :income-report-sections="incomeReportSections"
            :balance-rows="balanceRows"
            :cashflow-report-sections="cashflowReportSections"
            :indicator-rows="indicatorRows"
            :earnings-events="earningsEvents"
            :report-rc-rows="reportRcRows"
            :loading="sectionLoading.financials"
          />
        </v-window-item>

        <v-window-item value="valuation">
          <WorkbenchValuationPanel
            :valuation-status="valuationStatus"
            :valuation-data-status-found="valuationDataStatusFound"
            :valuation-conclusion-metrics="valuationConclusionMetrics"
            :valuation-confidence="valuationConfidence"
            :valuation-confidence-label="valuationConfidenceLabel"
            :valuation-suitability="valuationSuitability"
            :valuation-model-label="valuationModelLabel"
            :valuation-value-score="valuationValueScore"
            :valuation-applicability-items="valuationApplicabilityItems"
            :valuation-suitability-reasons="valuationSuitabilityReasons"
            :valuation-ddm="valuationDdm"
            :valuation-ddm-dividend-quality="valuationDdmDividendQuality"
            :valuation-ddm-scenarios="valuationDdmScenarios"
            :valuation-ddm-ke-breakdown-summary="valuationDdmKeBreakdownSummary"
            :valuation-ddm-annual-rows="valuationDdmAnnualRows"
            :valuation-is-financial="valuationIsFinancial"
            :valuation-dcf="valuationDcf"
            :valuation-dcf-net-debt-note="valuationDcfNetDebtNote"
            :valuation-dcf-per-share-note="valuationDcfPerShareNote"
            :valuation-dcf-shares-basis-note="valuationDcfSharesBasisNote"
            :valuation-dcf-fair-value-gap-note="valuationDcfFairValueGapNote"
            :valuation-dcf-scenarios="valuationDcfScenarios"
            :valuation-dcf-sensitivity-variables="valuationDcfSensitivityVariables"
            :valuation-multiple-metrics="valuationMultipleMetrics"
            :loading="sectionLoading.valuation"
            @refresh="refreshValuationSection"
          />
        </v-window-item>

        <v-window-item value="shareholders">
          <section class="workbench-card">
            <div class="card-title-row">
              <h3>股东筹码概览</h3>
              <span class="muted">
                <template v-if="sectionLoading.shareholders">刷新中…</template>
                <template v-else>户数 {{ shSummary.holder_num_date || '-' }} · 北向 {{ shSummary.northbound_date || '-' }}</template>
              </span>
            </div>
            <div class="financial-metrics">
              <div>
                <span>股东户数</span>
                <strong>{{ shSummary.holder_num != null ? Math.round(shSummary.holder_num).toLocaleString() : '-' }}</strong>
              </div>
              <div>
                <span>户数环比<small class="muted">（降为筹码集中）</small></span>
                <strong :class="holderTrendClass(shSummary.holder_num_chg_pct)">{{ fmtPct(shSummary.holder_num_chg_pct) }}</strong>
              </div>
              <div>
                <span>北向持股占比</span>
                <strong>{{ fmtNullablePct(shSummary.northbound_ratio) }}</strong>
              </div>
              <div>
                <span>北向占比变动</span>
                <strong :class="pctClass(shSummary.northbound_ratio_chg)">{{ shSummary.northbound_ratio_chg != null ? `${shSummary.northbound_ratio_chg > 0 ? '+' : ''}${shSummary.northbound_ratio_chg.toFixed(2)}pct` : '-' }}</strong>
              </div>
              <div>
                <span>外资机构变化</span>
                <strong>{{ shSummary.intl_change_count ?? shSummary.intl_new_count ?? 0 }} 家</strong>
              </div>
              <div>
                <span>香港中央结算变化</span>
                <strong :class="pctClass(shSummary.hksc_hold_ratio_chg)">{{ shSummary.hksc_hold_ratio_chg != null ? `${shSummary.hksc_hold_ratio_chg > 0 ? '+' : ''}${shSummary.hksc_hold_ratio_chg.toFixed(2)}pct` : '-' }}</strong>
              </div>
            </div>
          </section>

          <section class="panel-grid">
            <article class="workbench-card">
              <div class="card-title-row">
                <h3>股东户数趋势</h3>
                <span class="muted">
                  按报告期 · {{ shHolderNumbers.length || 0 }} 条
                  <button type="button" class="text-link-button" @click="holderNumberTableExpanded = !holderNumberTableExpanded">
                    {{ holderNumberTableExpanded ? '收起明细' : '展开明细' }}
                  </button>
                </span>
              </div>
              <div v-if="shHolderNumbers.length" ref="holderNumberChartRef" class="shareholder-mini-chart"></div>
              <div v-if="holderNumberTableExpanded && shHolderNumbers.length" class="quote-table-wrap">
                <table class="quote-table">
                  <thead>
                    <tr><th>报告期</th><th>股东户数</th><th>环比</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, idx) in shHolderNumbers.slice(0, 12)" :key="row.end_date">
                      <td>{{ row.end_date }}</td>
                      <td>{{ row.holder_num != null ? Math.round(row.holder_num).toLocaleString() : '-' }}</td>
                      <td :class="holderTrendClass(holderNumQoq(idx))">{{ fmtPct(holderNumQoq(idx)) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else-if="holderNumberTableExpanded" class="muted-block">暂无股东户数数据。</div>
              <div v-else-if="shHolderNumbers.length" class="muted-block">明细表默认收起，图表已展示主要趋势。</div>
              <div v-else class="muted-block">暂无股东户数数据。</div>
            </article>

            <article class="workbench-card">
              <div class="card-title-row">
                <h3>北向持股（沪深港股通）</h3>
                <span class="muted">2024-08 起按季披露</span>
              </div>
              <div v-if="shHkHold.length" ref="hkHoldChartRef" class="shareholder-mini-chart"></div>
              <div v-if="shHkHold.length" class="quote-table-wrap">
                <table class="quote-table">
                  <thead>
                    <tr><th>日期</th><th>持股量</th><th>占流通比</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in shHkHold.slice(0, 12)" :key="row.trade_date">
                      <td>{{ row.trade_date }}</td>
                      <td>{{ fmtShares(row.vol) }}</td>
                      <td>{{ fmtNullablePct(row.ratio) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="muted-block">暂无北向持股数据。</div>
            </article>
          </section>

          <section class="workbench-card">
            <div class="card-title-row">
              <h3>前十大流通股东变化</h3>
              <span class="muted">
                {{ shTop10Change.period_curr || '-' }}
                <template v-if="shTop10Change.period_prev"> vs {{ shTop10Change.period_prev }}</template>
              </span>
            </div>
            <div v-if="shTop10Change.period_curr" class="shareholder-signal-grid">
              <article>
                <h4>国际机构/外资席位变化</h4>
                <div v-if="shIntlChanges.length" class="chip-list">
                  <span
                    v-for="row in shIntlChanges"
                    :key="`${row.norm_key}-${row.current?.holder_name || row.previous?.holder_name || row.holder_name}`"
                    class="chip-pill"
                  >
                    {{ row.norm_label }} · {{ top10ChangeLabel(row.change_type) }}
                    <template v-if="row.current">
                      · 本期 {{ fmtShares(row.current.hold_amount) }} / {{ fmtNullablePct(row.current.hold_ratio) }}
                    </template>
                    <template v-if="row.previous && row.change_type === 'exited'">
                      · 上期 {{ fmtShares(row.previous.hold_amount) }} / {{ fmtNullablePct(row.previous.hold_ratio) }}
                    </template>
                    <template v-if="row.hold_ratio_chg != null && !['new', 'exited'].includes(row.change_type)">
                      · {{ top10RatioChangeText(row) }}
                    </template>
                  </span>
                </div>
                <p v-else class="muted">最近两期未识别到高盛/摩根/UBS 等国际机构持仓变化。</p>
              </article>
              <article>
                <h4>香港中央结算有限公司</h4>
                <template v-if="shHksc.current">
                  <p>
                    本期 {{ fmtShares(shHksc.current.hold_amount) }} · {{ fmtNullablePct(shHksc.current.hold_ratio) }}
                  </p>
                  <p>
                    较上期 {{ top10ChangeLabel(shHksc.change_type) }}
                    <strong :class="valueClass(shHksc.hold_amount_chg)">{{ fmtSignedShares(shHksc.hold_amount_chg) }}</strong>
                    /
                    <strong :class="pctClass(shHksc.hold_ratio_chg)">{{ top10RatioChangeText(shHksc) }}</strong>
                  </p>
                  <small>北向集合账户,不是单一外资机构,但持仓变化本身值得跟踪。</small>
                </template>
                <p v-else class="muted">本期未进入前十大流通股东。</p>
              </article>
            </div>
            <div v-else class="muted-block">暂无前十大流通股东变化数据。</div>
          </section>

          <section class="workbench-card">
            <div class="card-title-row">
              <h3>股东增减持</h3>
              <span class="muted">
                公告驱动 · {{ shHolderTrades.length || 0 }} 条
                <button type="button" class="text-link-button" @click="shareholderTradesExpanded = !shareholderTradesExpanded">
                  {{ shareholderTradesExpanded ? '收起' : '展开' }}
                </button>
              </span>
            </div>
            <div v-if="shareholderTradesExpanded && shHolderTrades.length" class="quote-table-wrap">
              <table class="quote-table">
                <thead>
                  <tr><th>公告日</th><th>股东</th><th>方向</th><th>变动股数</th><th>占比</th><th>变动后持股比</th><th>均价</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in shHolderTrades.slice(0, 15)" :key="`${row.ann_date}-${row.holder_name}-${idx}`">
                    <td>{{ row.ann_date }}</td>
                    <td class="cell-name">{{ row.holder_name || '-' }}</td>
                    <td :class="row.in_de === 'IN' ? 'is-up' : row.in_de === 'DE' ? 'is-down' : ''">{{ inDeLabel(row.in_de) }}</td>
                    <td>{{ fmtShares(row.change_vol) }}</td>
                    <td>{{ fmtNullablePct(row.change_ratio) }}</td>
                    <td>{{ fmtNullablePct(row.after_ratio) }}</td>
                    <td>{{ fmtNullableNumber(row.avg_price) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else-if="shareholderTradesExpanded" class="muted-block">暂无股东增减持记录。</div>
            <div v-else class="muted-block">默认收起公告驱动的股东增减持明细，可展开查看。</div>
          </section>

          <section class="panel-grid">
            <article class="workbench-card">
              <div class="card-title-row">
                <h3>限售解禁</h3>
                <span class="muted">
                  float_date 为解禁日 · {{ shShareFloats.length || 0 }} 条
                  <button type="button" class="text-link-button" @click="shareFloatExpanded = !shareFloatExpanded">
                    {{ shareFloatExpanded ? '收起' : '展开' }}
                  </button>
                </span>
              </div>
              <div v-if="shareFloatExpanded && shShareFloats.length" class="quote-table-wrap">
                <table class="quote-table">
                  <thead>
                    <tr><th>解禁日</th><th>类型</th><th>解禁股数</th><th>占比</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, idx) in shShareFloats.slice(0, 12)" :key="`${row.float_date}-${idx}`">
                      <td>{{ row.float_date }}<small v-if="isFutureDate(row.float_date)" class="badge-upcoming">待解禁</small></td>
                      <td class="cell-name">{{ row.share_type || '-' }}</td>
                      <td>{{ fmtShares(row.float_share) }}</td>
                      <td>{{ fmtNullablePct(row.float_ratio) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else-if="shareFloatExpanded" class="muted-block">暂无限售解禁数据。</div>
              <div v-else class="muted-block">默认收起限售解禁明细，可展开查看。</div>
            </article>

            <article class="workbench-card">
              <div class="card-title-row">
                <h3>股票回购</h3>
                <span class="muted">含回购阶段</span>
              </div>
              <div v-if="shRepurchases.length" class="quote-table-wrap">
                <table class="quote-table">
                  <thead>
                    <tr><th>公告日</th><th>阶段</th><th>回购股数</th><th>金额</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, idx) in shRepurchases.slice(0, 12)" :key="`${row.ann_date}-${row.proc}-${idx}`">
                      <td>{{ row.ann_date }}</td>
                      <td class="cell-name">{{ row.proc || '-' }}</td>
                      <td>{{ fmtShares(row.vol) }}</td>
                      <td>{{ fmtStatementAmount(row.amount) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="muted-block">暂无股票回购数据。</div>
            </article>
          </section>
        </v-window-item>

        <v-window-item value="swot">
          <StockWorkbenchSwotPanel
            :symbol="stockSymbol"
            :name="stockName"
            :swot="swotPayload.swot"
            :signal-review="swotPayload.signal_review"
            :internal-signal-review="swotPayload.internal_signal_review"
            :industry-reference="swotPayload.industry_signal_reference"
            :data-status="swotPayload.data_status"
            :loading="sectionLoading.signals"
            :error="swotError"
            :collecting="signalCollecting"
            :collection-message="signalCollectionMessage"
            :collection-error="signalCollectionError"
            :internal-refreshing="internalSignalRefreshing"
            :internal-refresh-message="internalSignalRefreshMessage"
            :internal-refresh-error="internalSignalRefreshError"
            :pending-finding="pendingSwotFinding"
            @changed="refreshSwotSection"
            @retry="refreshSwotSection"
            @collect="collectSwotSignals"
            @refresh-internal="refreshInternalSwotSignals"
            @analyze-url="analyzeSwotNewsUrl"
          />
        </v-window-item>

        <v-window-item value="analysis">
          <section class="workbench-card">
            <div class="card-title-row">
              <h3>AI 命中率</h3>
              <span class="muted">
                <template v-if="sectionLoading.ai">刷新中…</template>
                <template v-else>基于已完成的历史评估</template>
              </span>
            </div>
            <div class="financial-metrics">
              <div>
                <span>综合命中率</span>
                <strong>{{ fmtPctPlain(evaluationSummary.hit_rate) }}</strong>
              </div>
              <div>
                <span>严格准确率</span>
                <strong>{{ fmtPctPlain(evaluationSummary.accuracy_rate) }}</strong>
              </div>
              <div>
                <span>已评估 / 最近分析</span>
                <strong>{{ evaluationSummary.evaluated_count || 0 }} / {{ evaluationSummary.recent_analyses || analysisHistory.length }}</strong>
              </div>
              <div>
                <span>待评估</span>
                <strong>{{ evaluationSummary.pending_count || 0 }} 条</strong>
              </div>
            </div>
            <div v-if="evaluationRows.length" class="evaluation-list">
              <article v-for="row in evaluationRows.slice(0, 3)" :key="row.history_id" class="evaluation-item">
                <div>
                  <span>{{ row.analysis_created_at || '-' }}</span>
                  <strong>{{ row.title || '历史分析' }}</strong>
                  <small>{{ row.summary || row.short_review || '暂无评估摘要' }}</small>
                </div>
                <b :class="['evaluation-badge', row.outcome_accuracy || 'unknown']">
                  {{ accuracyLabel(row.outcome_accuracy) }}
                </b>
              </article>
            </div>
            <div v-else class="muted-block">
              暂无已完成评估。可在个股深度分析历史中手动触发评估，完成后这里会汇总命中率。
            </div>
          </section>
          <section class="workbench-card">
            <div class="card-title-row">
              <h3>交易状态</h3>
              <span class="muted">
                <template v-if="sectionLoading.trading">刷新中…</template>
                <template v-else>自选 / 策略 / 持仓 / 信号</template>
              </span>
            </div>
            <div class="financial-metrics">
              <div>
                <span>自选状态</span>
                <strong>{{ watchlistContext.in_watchlist ? '已加入' : '未加入' }}</strong>
              </div>
              <div>
                <span>绑定策略</span>
                <strong>{{ watchlistStrategies.length }} 个</strong>
              </div>
              <div>
                <span>持仓记录</span>
                <strong>{{ tradingPositions.length }} 条</strong>
              </div>
              <div>
                <span>最近信号</span>
                <strong>{{ recentTradeSignals.length }} 条</strong>
              </div>
            </div>
            <div v-if="watchlistStrategies.length || tradingPositions.length || recentTradeSignals.length" class="trading-context-grid">
              <article v-if="watchlistStrategies.length">
                <h4>自选策略</h4>
                <p v-for="row in watchlistStrategies.slice(0, 3)" :key="`${row.symbol}-${row.strategy_key}`">
                  {{ row.strategy_key || row.strategy || '未命名策略' }}
                  <span>{{ row.enabled === false ? '停用' : '启用' }}</span>
                </p>
              </article>
              <article v-if="tradingPositions.length">
                <h4>持仓</h4>
                <p v-for="row in tradingPositions.slice(0, 3)" :key="`${row.symbol}-${row.securities_account_id || row.account_id || row.updated_at}`">
                  数量 {{ row.quantity ?? row.shares ?? row.volume ?? '-' }}
                  <span>成本 {{ fmtNumber(row.avg_cost ?? row.cost_basis ?? row.cost_price) }}</span>
                </p>
              </article>
              <article v-if="recentTradeSignals.length">
                <h4>交易信号</h4>
                <p v-for="row in recentTradeSignals.slice(0, 3)" :key="row.order_id || `${row.symbol}-${row.timestamp}`">
                  {{ row.action || row.signal_type || '-' }}
                  <span>{{ row.status || row.created_at || row.timestamp || '-' }}</span>
                </p>
              </article>
            </div>
            <div v-else class="muted-block">暂无自选策略、持仓或交易信号。</div>
          </section>
          <section class="workbench-card">
            <div class="card-title-row">
              <h3>深度分析</h3>
              <div class="analysis-actions">
                <span v-if="sectionLoading.ai" class="muted">刷新中…</span>
                <v-select
                  v-model="analysisMode"
                  :items="analysisModeOptions"
                  density="compact"
                  variant="outlined"
                  hide-details
                  class="analysis-mode-select"
                />
                <v-btn
                  color="primary"
                  variant="tonal"
                  :loading="analysisSubmitting"
                  :disabled="!stockSymbol || stockSymbol === '-'"
                  @click="submitDeepAnalysis"
                >
                  {{ deepAnalysis?.analysis ? '重新分析' : '开始深度分析' }}
                </v-btn>
              </div>
            </div>
            <v-alert v-if="analysisSubmitError" type="error" variant="tonal" class="mb-3">
              {{ analysisSubmitError }}
            </v-alert>
            <v-alert v-if="analysisSubmitStatus" type="info" variant="tonal" class="mb-3">
              {{ analysisSubmitStatus }}
            </v-alert>
            <div v-if="deepAnalysis?.created_at" class="analysis-time">
              最近分析时间：{{ deepAnalysis.created_at }}
            </div>
            <AnalysisDetailContent
              v-if="deepAnalysis?.analysis"
              :analysis="deepAnalysis.analysis"
              :analysis-mode="deepAnalysis.analysis_mode || 'classic'"
              layout="stacked"
              mode="stock"
              show-mode
            />
            <div v-else class="muted-block">暂无深度分析，可点击上方按钮直接发起分析任务。</div>
          </section>
          <section class="workbench-card">
            <div class="card-title-row">
              <h3>最近分析历史</h3>
              <span class="muted">最近 {{ analysisHistory.length }} 条</span>
            </div>
            <div v-if="analysisHistory.length" class="analysis-history-list">
              <button
                v-for="item in analysisHistory"
                :key="item.id || item.created_at"
                type="button"
                class="analysis-history-item"
                :class="{ active: item.id && item.id === deepAnalysis?.id }"
                @click="selectAnalysisHistory(item)"
              >
                <span>{{ item.created_at || '-' }}</span>
                <strong>{{ analysisHistoryTitle(item) }}</strong>
                <small>
                  {{ item.analysis_mode || 'classic' }}
                  <b
                    v-if="evaluationByHistoryId[item.id]"
                    :class="['evaluation-inline-badge', evaluationByHistoryId[item.id].outcome_accuracy || 'unknown']"
                  >
                    {{ accuracyLabel(evaluationByHistoryId[item.id].outcome_accuracy) }}
                  </b>
                </small>
              </button>
            </div>
            <div v-else class="muted-block">暂无历史分析。</div>
          </section>
        </v-window-item>
      </v-window>
    </template>

    <v-overlay :model-value="loading && !payload" class="align-center justify-center" persistent>
      <v-progress-circular indeterminate size="48" />
    </v-overlay>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import request from '../utils/request'
import * as echarts from 'echarts'
import {
  collectStockWorkbenchSignals,
  analyzeStockWorkbenchNewsUrl,
  getStockWorkbenchSignalTask,
  refreshStockWorkbenchInternalSignals,
} from '../api/stock'
import { useStockWorkbench } from '../composables/useStockWorkbench'
import AnalysisDetailContent from '../components/AnalysisDetailContent.vue'
import StockWorkbenchSwotPanel from '../components/stock/StockWorkbenchSwotPanel.vue'
import WorkbenchFinancialPanel from '../components/stock/WorkbenchFinancialPanel.vue'
import WorkbenchHero from '../components/stock/WorkbenchHero.vue'
import WorkbenchNineTurnPanel from '../components/stock/WorkbenchNineTurnPanel.vue'
import WorkbenchOverviewPanel from '../components/stock/WorkbenchOverviewPanel.vue'
import WorkbenchQuotePanel from '../components/stock/WorkbenchQuotePanel.vue'
import WorkbenchSearchBar from '../components/stock/WorkbenchSearchBar.vue'
import WorkbenchScoresPanel from '../components/stock/WorkbenchScoresPanel.vue'
import WorkbenchValuationPanel from '../components/stock/WorkbenchValuationPanel.vue'
import {
  calcYoy,
  diffOrNull,
  firstFinite,
  fmtAmount,
  fmtNumber,
  fmtNullableNumber,
  fmtNullablePct,
  fmtPct,
  fmtPctFromRatio,
  fmtPctPlain,
  fmtShares,
  fmtSignedShares,
  fmtStatementAmount,
  fmtWanAmount,
  holderTrendClass,
  inDeLabel,
  isFutureDate,
  pctClass,
  ratioPct,
  reportQuarter,
  reportYear,
  signedPctPoint,
  signedRelativePct,
  statementReportTypeLabel,
  sumFinite,
  toNumber,
  top10ChangeLabel,
  top10RatioChangeText,
  valuationRelativeLabel,
  valueClass,
} from '../utils/workbenchFormat'

const props = defineProps({
  pendingNavigation: {
    type: Object,
    default: null,
  },
})

const SCORE_DEFS = [
  { key: 'technical', label: '技术面' },
  { key: 'fundamental', label: '基本面' },
  { key: 'value', label: '价值' },
  { key: 'growth', label: '成长' },
  { key: 'money_flow', label: '资金流' },
  { key: 'cycle', label: '动量' },
]

const analysisMode = ref('multi_expert_v1')
const analysisSubmitting = ref(false)
const analysisSubmitStatus = ref('')
const analysisSubmitError = ref('')
const financialMode = ref('quarterly')
const signalCollecting = ref(false)
const signalCollectionMessage = ref('')
const signalCollectionError = ref(false)
const internalSignalRefreshing = ref(false)
const internalSignalRefreshMessage = ref('')
const internalSignalRefreshError = ref(false)
const holderNumberTableExpanded = ref(false)
const shareholderTradesExpanded = ref(false)
const shareFloatExpanded = ref(false)
const holderNumberChartRef = ref(null)
const hkHoldChartRef = ref(null)
let holderNumberChart = null
let hkHoldChart = null
let analysisPollTimer = null
let signalCollectionTimer = null
let signalCollectionPollCount = 0
const signalCollectionMode = ref('')
let internalSignalTimer = null
let internalSignalPollCount = 0

const {
  loading,
  error,
  payload,
  activePanel,
  directSymbol,
  recentStocks,
  sectionLoading,
  sectionLoaded,
  incomeRows,
  indicatorRows,
  balanceRows,
  cashflowRows,
  earnings,
  tradingContext,
  valuationData,
  shareholderData,
  swotData,
  swotError,
  quoteKlineTf,
  quoteKlineLoading,
  moneyFlowLoading,
  stockSymbol,
  loadSymbol,
  loadWorkbenchSection,
  isCurrentWorkbenchSymbol,
  refreshQuoteSection,
  refreshValuationSection,
  refreshSwotSection,
  selectSearchCandidate,
  submitDirectSymbol,
  clearRecentSymbols,
} = useStockWorkbench({
  pendingNavigation: () => props.pendingNavigation,
  onBeforeLoadSymbol() {
    clearAnalysisPolling()
    clearSignalCollectionPolling()
    analysisSubmitStatus.value = ''
    analysisSubmitError.value = ''
    signalCollectionMessage.value = ''
    signalCollectionError.value = false
    internalSignalRefreshMessage.value = ''
    internalSignalRefreshError.value = false
    holderNumberTableExpanded.value = false
    shareholderTradesExpanded.value = false
    shareFloatExpanded.value = false
  },
  async onShareholdersLoaded() {
    await nextTick()
    renderShareholderCharts()
  },
  onDisposeShareholderCharts() {
    disposeShareholderCharts()
  },
})

const analysisModeOptions = [
  { title: '多专家', value: 'multi_expert_v1' },
  { title: '经典', value: 'classic' },
]

const score = computed(() => payload.value?.score || {})
const stock = computed(() => payload.value?.stock || {})
const quote = computed(() => payload.value?.quote || {})
const deepAnalysis = computed(() => payload.value?.deep_analysis || null)
const dataStatus = computed(() => payload.value?.data_status || {})
const analysisHistory = computed(() => Array.isArray(payload.value?.analysis_history) ? payload.value.analysis_history : [])
const evaluationSummary = computed(() => payload.value?.evaluation_summary || {})
const evaluationRows = computed(() => Array.isArray(evaluationSummary.value.latest_evaluations) ? evaluationSummary.value.latest_evaluations : [])
const evaluationByHistoryId = computed(() => Object.fromEntries(
  evaluationRows.value
    .filter((row) => row.history_id)
    .map((row) => [row.history_id, row]),
))
const scoreHistory = computed(() => Array.isArray(payload.value?.score_history) ? payload.value.score_history : [])
const quoteDailyRows = computed(() => Array.isArray(payload.value?.daily_quotes) ? payload.value.daily_quotes : [])
const quoteWeeklyRows = computed(() => Array.isArray(payload.value?.weekly_quotes) ? payload.value.weekly_quotes : [])
const quoteMonthlyRows = computed(() => Array.isArray(payload.value?.monthly_quotes) ? payload.value.monthly_quotes : [])
const latestDailyBasic = computed(() => payload.value?.daily_basic || {})
const latestMoneyFlow = computed(() => payload.value?.money_flow || null)
const moneyFlowHistory = computed(() => Array.isArray(payload.value?.money_flow_history) ? payload.value.money_flow_history : [])
const moneyFlowHistoryByTf = computed(() => payload.value?.money_flow_history_by_tf || {})
const moneyFlowSummary = computed(() => payload.value?.money_flow_summary || {})
const entryRisk = computed(() => payload.value?.entry_risk || {})
const entryRiskMetrics = computed(() => entryRisk.value?.metrics || {})
const quoteSectionDate = computed(() => dataStatus.value?.sections?.quote?.as_of || latestDailyBasic.value.trade_date || quote.value.trade_date || '')
const nineTurnDailyRows = computed(() => Array.isArray(payload.value?.nine_turn_daily_quotes) ? payload.value.nine_turn_daily_quotes : [])
const nineTurnSignals = computed(() => {
  const rows = Array.isArray(payload.value?.nine_turn_signals) ? payload.value.nine_turn_signals : []
  return [...rows].sort((a, b) => String(b.trade_date || '').localeCompare(String(a.trade_date || '')))
})
const latestNineTurnSignal = computed(() => payload.value?.latest_nine_turn_signal || nineTurnSignals.value[0] || null)
const swotPayload = computed(() => swotData.value || {})

const pendingSwotFinding = computed(() => {
  const nav = props.pendingNavigation
  if (!nav?.findingKey) return null
  return {
    findingKey: nav.findingKey,
    dimension: nav.dimension || 'strength',
  }
})
const nineTurnStatus = computed(() => dataStatus.value?.sections?.nine_turn || {})
const nineTurnMarkers = computed(() => nineTurnSignals.value.map((signal) => ({
  trade_date: signal.trade_date,
  direction: signal.direction,
  label: signal.count || 9,
  grade: signal.grade,
  high: signal.high,
  low: signal.low,
})))
const watchlistContext = computed(() => tradingContext.value.watchlist || {})
const watchlistStrategies = computed(() => Array.isArray(tradingContext.value.watchlist_strategies) ? tradingContext.value.watchlist_strategies : [])
const tradingPositions = computed(() => Array.isArray(tradingContext.value.positions) ? tradingContext.value.positions : [])
const recentTradeSignals = computed(() => Array.isArray(tradingContext.value.recent_signals) ? tradingContext.value.recent_signals : [])
const shSummary = computed(() => shareholderData.value.summary || {})
const shHolderNumbers = computed(() => Array.isArray(shareholderData.value.holder_numbers) ? shareholderData.value.holder_numbers : [])
const shHkHold = computed(() => Array.isArray(shareholderData.value.hk_hold) ? shareholderData.value.hk_hold : [])
const shHolderTrades = computed(() => Array.isArray(shareholderData.value.holder_trades) ? shareholderData.value.holder_trades : [])
const shShareFloats = computed(() => Array.isArray(shareholderData.value.share_floats) ? shareholderData.value.share_floats : [])
const shRepurchases = computed(() => Array.isArray(shareholderData.value.repurchases) ? shareholderData.value.repurchases : [])
const shTop10Change = computed(() => shareholderData.value.top10_float_change || {})
const shIntlNew = computed(() => Array.isArray(shTop10Change.value.intl_new) ? shTop10Change.value.intl_new : [])
const shIntlChanges = computed(() => {
  if (Array.isArray(shTop10Change.value.intl_changes)) {
    return shTop10Change.value.intl_changes.filter((row) => row?.change_type !== 'unchanged')
  }
  return shIntlNew.value.map((row) => ({
    norm_key: row.norm_key,
    norm_label: row.norm_label,
    holder_name: row.holder_name,
    change_type: 'new',
    current: row,
    previous: null,
    hold_amount_chg: null,
    hold_ratio_chg: null,
    hold_ratio_rel_chg_pct: null,
  }))
})
const shHksc = computed(() => shTop10Change.value.hksc || {})
const valuationStatus = computed(() => dataStatus.value?.sections?.valuation || valuationData.value.data_status || {})
const valuationDataStatusFound = computed(() => Boolean(valuationStatus.value.found || valuationData.value?.data_status?.found))
const valuationMarket = computed(() => valuationData.value.market_multiples || {})
const valuationCurrentMultiples = computed(() => valuationMarket.value.current || {})
const valuationPercentiles = computed(() => valuationMarket.value.percentiles || {})
const valuationDcf = computed(() => valuationData.value.dcf || {})
const valuationDcfScenarios = computed(() => Array.isArray(valuationDcf.value.scenarios) ? valuationDcf.value.scenarios : [])
const valuationDcfSensitivity = computed(() => valuationDcf.value.sensitivity || {})
const valuationDcfSensitivityVariables = computed(() => Array.isArray(valuationDcfSensitivity.value.variables) ? valuationDcfSensitivity.value.variables : [])
const valuationBaseScenario = computed(() => valuationDcfScenarios.value.find((row) => row.name === 'base') || valuationDcfScenarios.value[0] || {})
const valuationDdm = computed(() => valuationData.value.ddm || {})
const valuationDdmScenarios = computed(() => Array.isArray(valuationDdm.value.scenarios) ? valuationDdm.value.scenarios : [])
const valuationDdmAnnualRows = computed(() => Array.isArray(valuationDdm.value.annual_dividends) ? valuationDdm.value.annual_dividends : [])
const valuationDdmDividendQuality = computed(() => valuationDdm.value.dividend_quality || {})
const valuationDdmBaseScenario = computed(() => valuationDdmScenarios.value.find((row) => row.name === 'base') || {})
const valuationDdmKeBreakdownSummary = computed(() => {
  const kb = valuationDdmBaseScenario.value.ke_breakdown
  if (!kb || typeof kb !== 'object') return ''
  const rf = Number(kb.risk_free)
  const erp = Number(kb.equity_risk_premium)
  const ra = Number(kb.risk_adjustment)
  const fk = Number(kb.final_ke)
  if (![rf, erp, ra, fk].every((x) => Number.isFinite(x))) return ''
  return `中性档股权成本构成：无风险 ${(rf * 100).toFixed(2)}% + ERP ${(erp * 100).toFixed(2)}% + 风险调整 ${(ra * 100).toFixed(2)}% → ke ${(fk * 100).toFixed(2)}%（不低于中性档 WACC）。`
})
const valuationDcfNetDebtNote = computed(() => {
  const adj = valuationDcf.value.net_debt_adjustment
  if (!adj || valuationDcf.value.status !== 'ok') return ''
  if (adj.skipped_financial_sector) {
    return adj.reason || '金融行业：未扣净债务，表内「股权价值」等同于企业价值 EV，仅作同口径参考。'
  }
  if (adj.status === 'missing') {
    return adj.reason || '缺少资产负债表，净债务与少数股东权益按 0 处理。'
  }
  const nd = adj.net_debt_wan
  const mi = adj.minority_interest_wan
  const parts = []
  if (nd != null && Number.isFinite(Number(nd))) parts.push(`净债务约 ${fmtAmount(nd)}`)
  if (mi != null && Number.isFinite(Number(mi))) parts.push(`少数股东权益约 ${fmtAmount(mi)}`)
  if (!parts.length) return ''
  return `各情景股权价值 = 企业价值 EV − ${parts.join(' − ')}。`
})
const valuationDcfPerShareNote = computed(() => {
  const ps = valuationDcf.value.per_share
  if (!ps || ps.status !== 'missing_inputs' || !ps.reason) return ''
  return ps.reason
})
/** 后端成功推算 implied 万股时展示数据来源，便于与行情侧核对 */
const valuationDcfSharesBasisNote = computed(() => {
  const ps = valuationDcf.value.per_share
  if (!ps || ps.status !== 'ok' || !ps.shares_basis) return ''
  const sw = ps.shares_implied_wan
  const tail =
    sw != null && Number.isFinite(Number(sw))
      ? ` 推算股本约 ${Number(sw).toFixed(2)} 万股（市值÷价）。`
      : ''
  return `股本推算依据：${ps.shares_basis}。${tail}`
})
const valuationDcfFairValueGapNote = computed(() => {
  const ps = valuationDcf.value.per_share
  if (!ps || ps.status !== 'ok' || valuationDcf.value.status !== 'ok') return ''
  const base = valuationDcfScenarios.value.find((row) => row.name === 'base') || {}
  const ev = base.enterprise_value_wan
  const fv = base.fair_value_per_share
  if (fv != null && Number.isFinite(Number(fv))) return ''
  if (ev == null && (base.wacc != null && base.terminal_growth != null) && base.wacc <= base.terminal_growth) {
    return '中性档 WACC 不高于永续增长，永续价值未闭合，企业价值与每股价值无法给出数值（非数据缺失）。'
  }
  if (ev == null) return '中性档企业价值未算出（例如折现参数导致永续项无效），每股价值显示为「-」。'
  return ''
})
const valuationRelative = computed(() => valuationData.value.relative_valuation || {})
const valuationSuitability = computed(() => valuationData.value.model_suitability || {})
const valuationSuitabilityReasons = computed(() => Array.isArray(valuationSuitability.value.reasons) ? valuationSuitability.value.reasons : [])
const valuationApplicability = computed(() => valuationSuitability.value.model_applicability || {})
const valuationIsFinancial = computed(() => {
  const tags = valuationSuitability.value.signals?.industry_tags
  return Array.isArray(tags) && tags.includes('financial')
})
const valuationConfidence = computed(() => valuationData.value.valuation_confidence || {})
const valuationConfidenceLabel = computed(() => ({
  high: '高',
  medium: '中',
  low: '低',
})[valuationConfidence.value.level] || '待判断')
const valuationValueScore = computed(() => valuationData.value.value_score_link?.value_score)
const valuationModelLabel = computed(() => ({
  dcf: 'DCF 现金流折现',
  relative_valuation: '相对估值',
  pb_roe_or_ddm: 'PB-ROE / DDM',
  ddm: 'DDM 分红折现',
  tech_ps: '科技 PS 框架',
})[valuationSuitability.value.recommended_model] || valuationSuitability.value.recommended_model || '-')
const valuationApplicabilityItems = computed(() => {
  const modelLabels = {
    dcf: 'DCF 现金流折现',
    relative_valuation: '相对估值',
    ddm: 'DDM 分红折现',
    tech_ps: '科技 PS 框架',
  }
  const statusLabels = {
    primary: '主模型',
    secondary: '辅助',
    not_recommended: '不推荐',
    not_applicable: '不适用',
  }
  return ['dcf', 'relative_valuation', 'ddm', 'tech_ps']
    .map((key) => {
      const item = valuationApplicability.value?.[key] || {}
      const reasons = Array.isArray(item.reasons) ? item.reasons : []
      return {
        key,
        label: modelLabels[key] || key,
        statusLabel: statusLabels[item.status] || item.status || '-',
        reason: reasons[0] || '-',
      }
    })
    .filter((item) => item.statusLabel !== '-')
})
const valuationConclusionMetrics = computed(() => [
  { label: '当前价格', value: fmtNumber(latestPrice.value) },
  { label: '中性每股价值', value: valuationIsFinancial.value ? '不适用' : fmtNumber(valuationBaseScenario.value.fair_value_per_share) },
  { label: '安全边际', value: valuationIsFinancial.value ? '不适用' : fmtNumber(valuationBaseScenario.value.safety_margin_pct, 2, '%') },
  { label: '数据可信度', value: valuationConfidence.value.score != null ? `${valuationConfidenceLabel.value} / ${fmtNumber(valuationConfidence.value.score, 0)}` : '-' },
  { label: '相对估值', value: valuationRelativeLabel(valuationRelative.value.verdict) },
  { label: 'PE TTM', value: fmtNumber(valuationCurrentMultiples.value.pe_ttm) },
  { label: 'PB', value: fmtNumber(valuationCurrentMultiples.value.pb) },
])
const valuationMultipleMetrics = computed(() => [
  { label: 'PE TTM', value: valuationMultipleWithPercentile('pe_ttm') },
  { label: 'PB', value: valuationMultipleWithPercentile('pb') },
  { label: 'PS TTM', value: valuationMultipleWithPercentile('ps_ttm') },
  { label: '股息率 TTM', value: valuationMultipleWithPercentile('dv_ttm', '%') },
  { label: 'PEG', value: fmtNumber(valuationRelative.value.peg) },
  { label: '历史样本', value: valuationMarket.value.history_sample_count ? `${valuationMarket.value.history_sample_count} 条` : '-' },
])

const quoteKlineTfOptions = [
  { value: '1d', label: '日 K', title: '日线 K 线', shortLabel: '日线' },
  { value: '1w', label: '周 K', title: '周线 K 线', shortLabel: '周线' },
  { value: '1m', label: '月 K', title: '月线 K 线', shortLabel: '月线' },
]
const quoteKlineTfMeta = computed(
  () => quoteKlineTfOptions.find((item) => item.value === quoteKlineTf.value) || quoteKlineTfOptions[0],
)
const quoteKlineTitle = computed(() => quoteKlineTfMeta.value.title)
const quoteKlineShortLabel = computed(() => quoteKlineTfMeta.value.shortLabel)
const quoteKlineRows = computed(() => {
  if (quoteKlineTf.value === '1w') return quoteWeeklyRows.value
  if (quoteKlineTf.value === '1m') return quoteMonthlyRows.value
  return quoteDailyRows.value
})
const quoteKlineIsLoading = computed(() => quoteKlineTf.value === '1d'
  ? Boolean(sectionLoading.value.quote)
  : Boolean(quoteKlineLoading.value[quoteKlineTf.value]))
const activeMoneyFlowHistory = computed(() => {
  if (quoteKlineTf.value === '1d') return moneyFlowHistory.value
  const rows = moneyFlowHistoryByTf.value?.[quoteKlineTf.value]
  return Array.isArray(rows) ? rows : []
})
const moneyFlowIsLoading = computed(() => quoteKlineTf.value === '1d'
  ? Boolean(sectionLoading.value.quote)
  : Boolean(moneyFlowLoading.value[quoteKlineTf.value] || quoteKlineLoading.value[quoteKlineTf.value]))

const stockName = computed(() => stock.value.name || stock.value.stock_name || '')
const shenwan = computed(() => stock.value.shenwan_industry || {})
const stockIndustry = computed(() => shenwan.value.l1_name || stock.value.industry || '')
const stockIndustryL2 = computed(() => shenwan.value.l2_name || '')
const stockIndustryL3 = computed(() => shenwan.value.l3_name || '')
const indexCodes = computed(() => Array.isArray(score.value.index_codes) ? score.value.index_codes : [])

const latestPrice = computed(() => quote.value.close ?? quote.value.price ?? quote.value.latest_price)
const latestPctChange = computed(() => {
  const normalizedPct = toNumber(quote.value.display_pct_chg)
  if (normalizedPct != null) return normalizedPct

  const explicitPct = firstFinite([
    quote.value.pct_chg,
    quote.value.pct_change,
    quote.value.change_percent,
  ])
  if (explicitPct != null && Math.abs(explicitPct) <= 30) {
    return explicitPct
  }

  const close = toNumber(latestPrice.value)
  const previousClose = firstFinite([
    quote.value.pre_close,
    quote.value.prev_close,
    quote.value.previous_close,
    quote.value.yesterday_close,
    quote.value.last_close,
  ])
  if (close != null && previousClose > 0) {
    return ((close - previousClose) / previousClose) * 100
  }

  return null
})
const priceChangeTitle = computed(() => {
  const source = quote.value.display_pct_chg_source
  const preClose = toNumber(quote.value.display_pre_close)
  if (source && source !== 'unavailable') {
    const preText = preClose != null ? `，昨收 ${fmtNumber(preClose)}` : ''
    return `当日涨跌幅：后端已按“最新价相对昨收价”归一计算${preText}。来源：${source}。`
  }
  return '当日涨跌幅：优先使用后端归一字段 display_pct_chg；缺失时才使用行情 pct_chg / pct_change 或用昨收价计算。'
})
const changeClass = computed(() => {
  const n = Number(latestPctChange.value)
  return n > 0 ? 'is-up' : n < 0 ? 'is-down' : ''
})

const compositeScore = computed(() => score.value.composite_score || {})
const currentCompositeScore = computed(() => {
  if (compositeScore.value && typeof compositeScore.value === 'object') {
    if (compositeScore.value.balanced != null) return compositeScore.value.balanced
    const firstKey = Object.keys(compositeScore.value).find((key) => compositeScore.value[key] != null)
    return firstKey ? compositeScore.value[firstKey] : null
  }
  return compositeScore.value
})
const ratingText = computed(() => {
  const n = Number(currentCompositeScore.value)
  if (n >= 80) return '强烈关注'
  if (n >= 70) return '推荐关注'
  if (n >= 60) return '谨慎观察'
  if (n >= 50) return '暂不推荐'
  return Number.isFinite(n) ? '回避' : '-'
})

const scoreItems = computed(() => {
  const details = score.value.details || {}
  return SCORE_DEFS.map((def) => ({
    ...def,
    score: score.value[`${def.key}_score`],
    details: details[`${def.key}_details`] || score.value[`${def.key}_details`] || {},
  })).filter((item) => item.score != null || Object.keys(item.details || {}).length > 0)
})

const statusItems = computed(() => [
  { label: '行情', value: dataStatus.value.quote_found ? '已覆盖' : '未覆盖' },
  { label: '评分', value: dataStatus.value.score_found ? '已覆盖' : '未覆盖' },
  { label: 'AI分析', value: dataStatus.value.deep_analysis_found ? '已覆盖' : '未覆盖' },
])
const sectionStatusItems = computed(() => {
  const sections = dataStatus.value.sections || {}
  const defs = [
    { key: 'quote', label: '行情资金', panel: 'quote' },
    { key: 'nine_turn', label: '神奇九转', panel: 'nine-turn' },
    { key: 'scores', label: '量化评分', panel: 'scores' },
    { key: 'financials', label: '财务业绩', panel: 'financial' },
    { key: 'valuation', label: '估值模型', panel: 'valuation' },
    { key: 'shareholders', label: '股东筹码', panel: 'shareholders' },
    { key: 'signals', label: 'SWOT', panel: 'swot' },
    { key: 'ai', label: 'AI 分析', panel: 'analysis' },
    { key: 'trading', label: '交易状态', panel: 'analysis' },
  ]
  return defs.map((def) => {
    const status = sections[def.key] || {}
    const fallbackFound = {
      quote: dataStatus.value.quote_found,
      nine_turn: Boolean(nineTurnSignals.value.length),
      scores: dataStatus.value.score_found,
      financials: Boolean(incomeRows.value.length || indicatorRows.value.length),
      valuation: Boolean(valuationData.value?.data_status?.found),
      shareholders: Boolean(shHolderNumbers.value.length || shHkHold.value.length),
      signals: Boolean(swotPayload.value?.data_status?.found),
      ai: dataStatus.value.deep_analysis_found,
      trading: Boolean(watchlistContext.value.in_watchlist || tradingPositions.value.length || recentTradeSignals.value.length),
    }[def.key]
    return {
      ...def,
      found: status.found ?? fallbackFound,
      stale: Boolean(status.stale),
      asOf: status.as_of || '',
      title: `${def.label}：${status.expected_freshness || '暂无新鲜度说明'}${status.source ? `；来源 ${status.source}` : ''}`,
    }
  })
})

const analysisObj = computed(() => deepAnalysis.value?.analysis || {})
const analysisSummary = computed(() => {
  const a = analysisObj.value
  return a.final_conclusion
    || a.investment_advice
    || a.long_term_forecast
    || a.mid_term_forecast
    || '暂无结构化摘要。'
})
const analysisPoints = computed(() => {
  const a = analysisObj.value
  const points = a.key_points || a.consensus_points || a.risk_factors || []
  if (Array.isArray(points)) return points.slice(0, 5)
  if (typeof points === 'string') return [points]
  return []
})

const financialChartData = computed(() => {
  const incomeByPeriod = new Map()
  for (const row of incomeRows.value) {
    const period = row.end_date || row.period || row.report_date
    if (period) incomeByPeriod.set(period, row)
  }
  const rows = indicatorRows.value.map((indicator) => {
    const period = indicator.end_date || indicator.period || indicator.report_date
    const income = incomeByPeriod.get(period) || {}
    const quarter = reportQuarter(period)
    return {
      period,
      year: reportYear(period),
      quarter,
      periodLabel: quarter ? `${reportYear(period)}Q${quarter}` : period,
      cumulative_revenue: toNumber(income.revenue || income.total_revenue || indicator.revenue),
      cumulative_net_profit: toNumber(income.n_income_attr_p || income.net_profit || indicator.net_profit),
      revenue: toNumber(income.revenue || income.total_revenue || indicator.revenue),
      net_profit: toNumber(income.n_income_attr_p || income.net_profit || indicator.net_profit),
      tr_yoy: toNumber(indicator.tr_yoy || indicator.or_yoy || indicator.revenue_yoy),
      revenue_yoy: toNumber(indicator.tr_yoy || indicator.or_yoy || indicator.revenue_yoy),
      netprofit_yoy: toNumber(indicator.netprofit_yoy || indicator.profit_to_gr),
      dt_netprofit_yoy: toNumber(indicator.dt_netprofit_yoy),
      grossprofit_margin: toNumber(indicator.grossprofit_margin),
      gross_margin: toNumber(indicator.grossprofit_margin),
      roe: toNumber(indicator.roe || indicator.roe_dt),
    }
  }).filter((row) => row.period && row.year && row.quarter)
    .sort((a, b) => String(a.period).localeCompare(String(b.period)))

  const byYearQuarter = new Map(rows.map((row) => [`${row.year}-${row.quarter}`, row]))
  const normalized = rows
    .filter((row) => financialMode.value === 'annual' ? row.quarter === 4 : true)
    .map((row) => {
      if (financialMode.value === 'annual') {
        return {
          ...row,
          period: String(row.year),
          tr_yoy: row.revenue_yoy,
        }
      }
      const previousQuarter = row.quarter > 1 ? byYearQuarter.get(`${row.year}-${row.quarter - 1}`) : null
      const previousYearSameQuarter = byYearQuarter.get(`${row.year - 1}-${row.quarter}`)
      const revenue = row.quarter === 1
        ? row.cumulative_revenue
        : diffOrNull(row.cumulative_revenue, previousQuarter?.cumulative_revenue)
      const netProfit = row.quarter === 1
        ? row.cumulative_net_profit
        : diffOrNull(row.cumulative_net_profit, previousQuarter?.cumulative_net_profit)
      const priorRevenue = previousYearSameQuarter
        ? (row.quarter === 1
          ? previousYearSameQuarter.cumulative_revenue
          : diffOrNull(
            previousYearSameQuarter.cumulative_revenue,
            byYearQuarter.get(`${row.year - 1}-${row.quarter - 1}`)?.cumulative_revenue,
          ))
        : null
      const priorNetProfit = previousYearSameQuarter
        ? (row.quarter === 1
          ? previousYearSameQuarter.cumulative_net_profit
          : diffOrNull(
            previousYearSameQuarter.cumulative_net_profit,
            byYearQuarter.get(`${row.year - 1}-${row.quarter - 1}`)?.cumulative_net_profit,
          ))
        : null
      return {
        ...row,
        period: row.periodLabel,
        revenue,
        net_profit: netProfit,
        tr_yoy: calcYoy(revenue, priorRevenue),
        revenue_yoy: calcYoy(revenue, priorRevenue),
        netprofit_yoy: calcYoy(netProfit, priorNetProfit),
      }
    })
    .filter((row) => row.revenue != null || row.net_profit != null || row.tr_yoy != null || row.netprofit_yoy != null)

  return normalized.slice(-8)
})

const financialModeLabel = computed(() => financialMode.value === 'annual' ? '年度对比' : '单季对比')

const financialMetrics = computed(() => {
  const latest = indicatorRows.value[0] || {}
  const latestBalance = balanceRows.value[0] || {}
  const latestCashflow = cashflowRows.value[0] || {}
  return [
    { label: 'ROE', value: fmtNumber(latest.roe || latest.roe_dt, 2, '%') },
    { label: '毛利率', value: fmtNumber(latest.grossprofit_margin, 2, '%') },
    { label: '净利同比', value: fmtNumber(latest.netprofit_yoy || latest.profit_to_gr, 2, '%') },
    { label: '营收同比', value: fmtNumber(latest.tr_yoy || latest.or_yoy, 2, '%') },
    { label: 'PE TTM', value: fmtNumber((indicatorRows.value[0] || {}).pe_ttm || quote.value.pe_ttm) },
    { label: 'PB', value: fmtNumber((indicatorRows.value[0] || {}).pb || quote.value.pb) },
    { label: '总资产', value: fmtStatementAmount(latestBalance.total_assets) },
    { label: '经营现金流', value: fmtStatementAmount(latestCashflow.n_cashflow_act) },
  ]
})

const financialMetricsPeriodText = computed(() => {
  const latest = indicatorRows.value[0] || {}
  const latestBalance = balanceRows.value[0] || {}
  const latestCashflow = cashflowRows.value[0] || {}
  const parts = [
    ['指标', latest.end_date || latest.period || latest.report_date],
    ['资产负债', latestBalance.end_date || latestBalance.period || latestBalance.report_date],
    ['现金流', latestCashflow.end_date || latestCashflow.period || latestCashflow.report_date],
  ].filter(([, value]) => value)
  if (!parts.length) return '暂无报告期'
  return parts.map(([label, value]) => `${label} ${value}`).join(' · ')
})

const incomeReportSections = computed(() => groupStatementRowsByReportType(incomeRows.value))
const cashflowReportSections = computed(() => groupStatementRowsByReportType(cashflowRows.value))

function groupStatementRowsByReportType(rows) {
  const grouped = new Map()
  for (const row of rows || []) {
    const key = String(row.report_type ?? row.report_type_name ?? 'unknown')
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        label: statementReportTypeLabel(row.report_type ?? row.report_type_name),
        rows: [],
      })
    }
    grouped.get(key).rows.push(row)
  }
  const order = { '1': 1, '2': 2, unknown: 99 }
  return [...grouped.values()].sort((a, b) => (order[a.key] || 50) - (order[b.key] || 50))
}

const financialQualityCards = computed(() => {
  const rows = financialChartData.value
  const latest = rows[rows.length - 1] || {}
  const previous = rows[rows.length - 2] || {}
  const latestIndicator = indicatorRows.value[0] || {}
  const latestBalance = balanceRows.value[0] || {}
  const latestCashflow = cashflowRows.value[0] || {}
  const latestIncome = incomeRows.value[0] || {}

  const cards = []
  if (latest.tr_yoy != null || latest.netprofit_yoy != null) {
    const revenueYoy = toNumber(latest.tr_yoy)
    const profitYoy = toNumber(latest.netprofit_yoy)
    const improving = [revenueYoy, profitYoy].filter((v) => v != null && v > 0).length
    cards.push({
      key: 'growth',
      label: '增长质量',
      level: improving >= 2 ? 'good' : improving === 1 ? 'neutral' : 'warn',
      title: improving >= 2 ? '收入利润同步增长' : improving === 1 ? '增长结构分化' : '增长承压',
      detail: `营收同比 ${fmtPctPlain(revenueYoy)}，净利同比 ${fmtPctPlain(profitYoy)}。`,
    })
  }

  const grossMargin = toNumber(latest.grossprofit_margin ?? latest.gross_margin ?? latestIndicator.grossprofit_margin)
  const roe = toNumber(latest.roe ?? latestIndicator.roe ?? latestIndicator.roe_dt)
  if (grossMargin != null || roe != null) {
    const stableMargin = previous.grossprofit_margin == null || grossMargin == null
      ? true
      : grossMargin >= previous.grossprofit_margin - 1
    const strongProfitability = (roe != null && roe >= 10) || (grossMargin != null && grossMargin >= 25)
    cards.push({
      key: 'profitability',
      label: '盈利质量',
      level: strongProfitability && stableMargin ? 'good' : stableMargin ? 'neutral' : 'warn',
      title: strongProfitability && stableMargin ? '盈利能力较稳' : stableMargin ? '盈利能力一般' : '毛利率走弱',
      detail: `毛利率 ${fmtPctPlain(grossMargin)}，ROE ${fmtPctPlain(roe)}。`,
    })
  }

  const operatingCashflow = toNumber(latestCashflow.n_cashflow_act)
  const netProfit = toNumber(latestIncome.n_income_attr_p ?? latestIncome.n_income ?? latest.cumulative_net_profit)
  if (operatingCashflow != null || netProfit != null) {
    const ratio = netProfit ? operatingCashflow / Math.abs(netProfit) : null
    cards.push({
      key: 'cashflow',
      label: '现金流质量',
      level: ratio == null ? 'neutral' : ratio >= 0.8 ? 'good' : ratio >= 0 ? 'neutral' : 'warn',
      title: ratio == null ? '现金流待观察' : ratio >= 0.8 ? '现金流匹配利润' : ratio >= 0 ? '现金流弱于利润' : '经营现金流为负',
      detail: `经营现金流 ${fmtStatementAmount(operatingCashflow)}，归母净利 ${fmtStatementAmount(netProfit)}。`,
    })
  }

  const debtToAssets = firstFinite([
    latestIndicator.debt_to_assets,
    latestBalance.debt_to_assets,
    ratioPct(latestBalance.total_liab, latestBalance.total_assets),
  ])
  if (debtToAssets != null) {
    cards.push({
      key: 'leverage',
      label: '资产负债',
      level: debtToAssets <= 45 ? 'good' : debtToAssets <= 65 ? 'neutral' : 'warn',
      title: debtToAssets <= 45 ? '杠杆水平较低' : debtToAssets <= 65 ? '杠杆水平适中' : '杠杆压力偏高',
      detail: `资产负债率 ${fmtPctPlain(debtToAssets)}，总资产 ${fmtStatementAmount(latestBalance.total_assets)}。`,
    })
  }

  const receivablesRatio = ratioPct(sumFinite(latestBalance.accounts_receiv, latestBalance.notes_receiv), latestBalance.total_assets)
  const inventoryRatio = ratioPct(latestBalance.inventories, latestBalance.total_assets)
  if (receivablesRatio != null || inventoryRatio != null) {
    const riskHigh = (receivablesRatio != null && receivablesRatio > 20) || (inventoryRatio != null && inventoryRatio > 20)
    cards.push({
      key: 'risk',
      label: '风险项',
      level: riskHigh ? 'warn' : 'good',
      title: riskHigh ? '营运资产占比较高' : '营运资产压力不高',
      detail: `应收/票据占资产 ${fmtPctPlain(receivablesRatio)}，存货占资产 ${fmtPctPlain(inventoryRatio)}。`,
    })
  }

  return cards
})

const earningsEvents = computed(() => {
  const rows = []
  const source = earnings.value || {}
  for (const row of source.forecast || []) rows.push({ type: '业绩预告', date: row.ann_date || row.end_date, title: row.type || row.summary || '业绩预告', raw: row })
  for (const row of source.express || []) rows.push({ type: '业绩快报', date: row.ann_date || row.end_date, title: row.revenue ? `营收 ${fmtStatementAmount(row.revenue)}` : '业绩快报', raw: row })
  for (const row of source.disclosure || []) rows.push({ type: '披露日历', date: row.ann_date || row.pre_date, title: row.pre_date ? `预计披露 ${row.pre_date}` : '披露日历', raw: row })
  return rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 8)
})

const reportRcRows = computed(() => {
  const rows = Array.isArray(earnings.value?.report_rc) ? earnings.value.report_rc : []
  return [...rows].sort((a, b) => String(b.report_date || b.create_time || '').localeCompare(String(a.report_date || a.create_time || '')))
})

const quoteMetrics = computed(() => [
  { label: '换手率', value: fmtNumber(latestDailyBasic.value.turnover_rate, 2, '%') },
  { label: '量比', value: fmtNumber(latestDailyBasic.value.volume_ratio) },
  { label: 'PE TTM', value: fmtNumber(latestDailyBasic.value.pe_ttm ?? latestDailyBasic.value.pe) },
  { label: 'PB', value: fmtNumber(latestDailyBasic.value.pb) },
  { label: '股息率 TTM', value: fmtNumber(latestDailyBasic.value.dv_ttm, 2, '%') },
  { label: '流通市值', value: fmtAmount(latestDailyBasic.value.circ_mv) },
  { label: '总市值', value: fmtAmount(latestDailyBasic.value.total_mv) },
  { label: '日线样本', value: quoteDailyRows.value.length ? `${quoteDailyRows.value.length} 条` : '-' },
])

const moneyFlowMetrics = computed(() => {
  const mf = latestMoneyFlow.value || {}
  const mainNet = moneyFlowSummary.value.main_net_today ?? mf.net_mf_amount
  return [
    { label: '主力净额', value: fmtWanAmount(mainNet), className: valueClass(mainNet) },
    { label: '超大单买入', value: fmtAmount(mf.buy_elg_amount) },
    { label: '超大单卖出', value: fmtAmount(mf.sell_elg_amount) },
    { label: '大单买入', value: fmtAmount(mf.buy_lg_amount) },
    { label: '大单卖出', value: fmtAmount(mf.sell_lg_amount) },
    { label: '中单净额', value: fmtAmount(toNumber(mf.buy_md_amount) - toNumber(mf.sell_md_amount)) },
  ]
})
const entryRiskSeverity = computed(() => entryRisk.value?.severity || 'none')
const entryRiskSeverityLabel = computed(() => ({
  high: '高风险',
  medium: '中风险',
  low: '低风险',
  none: '正常',
})[entryRiskSeverity.value] || '正常')
const entryRiskNarrativeRows = computed(() => {
  const metrics = entryRiskMetrics.value || {}
  return [
    {
      label: '高位状态',
      value: `hipos120 ${fmtNumber(metrics.hipos120, 3)}，距离120日高点 ${fmtNumber(metrics.distance_to_120d_high_pct, 1, '%')}`,
    },
    {
      label: '主力20日净流',
      value: `mainflow20 ${fmtPctFromRatio(metrics.mainflow20)}`,
      className: valueClass(metrics.mainflow20),
    },
    {
      label: '资金流规模',
      value: `${fmtWanAmount(metrics.main_net_20d)} / 成交额 ${fmtWanAmount(metrics.amount_20d_wan)}`,
      className: valueClass(metrics.main_net_20d),
    },
    {
      label: '高位派发',
      value: `派发风险值 ${fmtNumber(metrics.distrib, 4)}，${entryRiskSeverityLabel.value}`,
      className: entryRiskSeverity.value === 'none' ? '' : `entry-risk-text-${entryRiskSeverity.value}`,
    },
  ]
})
const overviewQuoteMetrics = computed(() => [
  { label: '换手率', value: fmtNumber(latestDailyBasic.value.turnover_rate, 2, '%') },
  { label: 'PE TTM', value: fmtNumber(latestDailyBasic.value.pe_ttm ?? latestDailyBasic.value.pe) },
  { label: 'PB', value: fmtNumber(latestDailyBasic.value.pb) },
  { label: '主力净额', value: fmtWanAmount(moneyFlowSummary.value.main_net_today ?? latestMoneyFlow.value?.net_mf_amount), className: valueClass(moneyFlowSummary.value.main_net_today ?? latestMoneyFlow.value?.net_mf_amount) },
])
const overviewQuoteDataAvailable = computed(() => Boolean(
  quoteDailyRows.value.length
  || latestMoneyFlow.value
  || Object.keys(latestDailyBasic.value).length,
))

function clearCollectPolling() {
  if (signalCollectionTimer) {
    window.clearTimeout(signalCollectionTimer)
    signalCollectionTimer = null
  }
  signalCollectionPollCount = 0
  signalCollecting.value = false
  signalCollectionMode.value = ''
}

function clearInternalPolling() {
  if (internalSignalTimer) {
    window.clearTimeout(internalSignalTimer)
    internalSignalTimer = null
  }
  internalSignalPollCount = 0
  internalSignalRefreshing.value = false
}

// 机会/风险搜集与优势/劣势刷新是两条独立的轮询链路，
// 该函数仅用于离开页面/切换标的等需要同时清理的场景。
function clearSignalCollectionPolling() {
  clearCollectPolling()
  clearInternalPolling()
}

function friendlyNewsUrlError(rawError = '') {
  const text = String(rawError || '').toLowerCase()
  if (!text) return '新闻链接分析失败，请稍后重试'
  if (text.includes('too short') || text.includes('empty')) {
    return '无法从该链接提取正文（可能需要登录或由脚本动态渲染），请换一个正文可直接访问的新闻链接'
  }
  if (text.includes('unsupported content type')) {
    return '该链接不是网页文章（可能是 PDF 或其它类型），暂不支持分析'
  }
  if (text.includes('blocked') || text.includes('resolve') || text.includes('not allowed')) {
    return '该链接指向的地址不可访问或被拦截，请确认是公开可访问的新闻链接'
  }
  if (text.includes('too large')) {
    return '页面内容过大，无法分析，请更换链接'
  }
  if (text.includes('status') || text.includes('redirect') || text.includes('fetch')) {
    return '抓取新闻失败（目标站点返回错误或拒绝访问），请稍后重试或更换链接'
  }
  if (text.includes('json') || text.includes('parse')) {
    return '分析结果解析失败，请稍后重试'
  }
  return '新闻链接分析失败，请稍后重试'
}

function formatNewsUrlTaskMessage(summary = {}, status = 'completed') {
  if (summary.status === 'unrelated_to_tracked_risk') {
    return summary.relation_reason
      ? `该新闻与所跟踪风险无直接关联，未更新：${summary.relation_reason}`
      : '该新闻与所跟踪风险无直接关联，未更新。'
  }
  if (summary.status === 'follow_up_updated') {
    return '已更新所跟踪风险的最新进展，SWOT 已刷新。'
  }
  if (summary.status === 'no_material_impact') {
    return '未发现对该股票的实质影响。'
  }
  const riskCount = Number(summary.risk_finding_count || 0)
  const oppCount = Number(summary.opportunity_finding_count || 0)
  if (riskCount || oppCount) {
    const parts = []
    if (riskCount) parts.push(`${riskCount} 条风险`)
    if (oppCount) parts.push(`${oppCount} 条机会`)
    return `新闻分析完成，已写入 ${parts.join('、')}，SWOT 已刷新。`
  }
  if (status === 'completed_with_parse_error') {
    return '新闻分析已完成，但部分结果解析失败；已刷新可用信号。'
  }
  return '新闻分析完成，SWOT 已刷新。'
}

async function collectSwotSignals() {
  const symbol = stockSymbol.value && stockSymbol.value !== '-' ? stockSymbol.value : directSymbol.value
  if (!symbol || signalCollecting.value) return
  clearCollectPolling()
  signalCollecting.value = true
  signalCollectionMode.value = 'collect'
  signalCollectionError.value = false
  signalCollectionMessage.value = '已提交机会与风险证据搜集，等待分析任务处理…'
  try {
    const task = await collectStockWorkbenchSignals(symbol)
    if (!task?.task_id) throw new Error('分析任务未返回 task_id')
    signalCollectionMessage.value = task.reused
      ? '已有该股票的搜集分析任务正在运行…'
      : '正在搜集公告、新闻等证据并分析机会与风险…'
    await pollSwotSignalTask(task.task_id, symbol, 'collect')
  } catch (e) {
    clearCollectPolling()
    signalCollectionError.value = true
    signalCollectionMessage.value = e?.message || '机会与风险搜集分析提交失败'
  }
}

async function refreshInternalSwotSignals() {
  const symbol = stockSymbol.value && stockSymbol.value !== '-' ? stockSymbol.value : directSymbol.value
  if (!symbol || internalSignalRefreshing.value) return
  clearInternalPolling()
  internalSignalRefreshing.value = true
  internalSignalRefreshError.value = false
  internalSignalRefreshMessage.value = '已提交优势与劣势规则评估，等待任务处理…'
  try {
    const task = await refreshStockWorkbenchInternalSignals(symbol)
    if (!task?.task_id) throw new Error('分析任务未返回 task_id')
    internalSignalRefreshMessage.value = task.reused
      ? '已有该股票的优势与劣势评估任务正在运行…'
      : '正在读取财务指标并评估优势与劣势…'
    await pollSwotSignalTask(task.task_id, symbol, 'internal')
  } catch (e) {
    clearInternalPolling()
    internalSignalRefreshError.value = true
    internalSignalRefreshMessage.value = e?.message || '优势与劣势规则评估提交失败'
  }
}

async function analyzeSwotNewsUrl(payload) {
  const url = typeof payload === 'string' ? payload : payload?.url
  const findingKey = typeof payload === 'string' ? '' : (payload?.findingKey || '')
  const symbol = stockSymbol.value && stockSymbol.value !== '-' ? stockSymbol.value : directSymbol.value
  if (!symbol || signalCollecting.value || !url) return
  clearCollectPolling()
  signalCollecting.value = true
  signalCollectionMode.value = 'news-url'
  signalCollectionError.value = false
  signalCollectionMessage.value = findingKey
    ? '已提交后续新闻，正在核对与所跟踪风险的关联…'
    : '已提交新闻链接分析，正在抓取正文…'
  try {
    const task = await analyzeStockWorkbenchNewsUrl(symbol, { url, findingKey })
    if (!task?.task_id) throw new Error('分析任务未返回 task_id')
    signalCollectionMessage.value = task.reused
      ? '已有该新闻链接分析任务正在运行…'
      : '正在抓取新闻正文并由 LLM 研判机会与风险…'
    await pollSwotSignalTask(task.task_id, symbol, 'collect')
  } catch (e) {
    clearCollectPolling()
    signalCollectionError.value = true
    signalCollectionMessage.value = e?.message || '新闻链接分析提交失败'
  }
}

async function pollSwotSignalTask(taskId, symbol, track = 'collect') {
  const isInternal = track === 'internal'
  const clearThis = isInternal ? clearInternalPolling : clearCollectPolling
  try {
    const response = await getStockWorkbenchSignalTask(taskId)
    if (!isCurrentWorkbenchSymbol(symbol)) {
      clearThis()
      return
    }
    const status = response?.task_meta?.status || ''
    const resultStatus = response?.base_result?.summary?.status || response?.base_result?.status || ''
    const mode = signalCollectionMode.value
    if (status === 'failed') {
      clearThis()
      if (isInternal) {
        internalSignalRefreshError.value = true
        internalSignalRefreshMessage.value = response?.task_meta?.error || '优势与劣势规则评估失败'
      } else if (mode === 'news-url') {
        signalCollectionError.value = true
        signalCollectionMessage.value = friendlyNewsUrlError(response?.task_meta?.error)
      } else {
        signalCollectionError.value = true
        signalCollectionMessage.value = response?.task_meta?.error || '机会与风险搜集分析失败'
      }
      return
    }
    if (status === 'completed' || status === 'completed_with_parse_error') {
      clearThis()
      const summary = response?.base_result?.summary || {}
      if (isInternal) {
        const counts = response?.base_result?.result_counts || {}
        internalSignalRefreshMessage.value = resultStatus === 'skipped_unchanged'
          ? '内部财务证据没有变化，已保留当前优势与劣势判断。'
          : `优势与劣势评估完成：${Number(counts.strength || 0)} 条优势、${Number(counts.weakness || 0)} 条劣势。`
        internalSignalRefreshError.value = false
      } else {
        if (mode === 'news-url') {
          signalCollectionMessage.value = formatNewsUrlTaskMessage(summary, status)
        } else if (resultStatus === 'skipped_unchanged') {
          signalCollectionMessage.value = '证据没有变化，已保留当前机会与风险判断。'
        } else {
          signalCollectionMessage.value = status === 'completed_with_parse_error'
            ? '分析已完成，但部分结果解析失败；已刷新可用信号。'
            : '机会与风险分析完成，SWOT 已刷新。'
        }
        signalCollectionError.value = status === 'completed_with_parse_error'
      }
      await loadWorkbenchSection('signals', { force: true })
      return
    }
    if (isInternal) {
      internalSignalPollCount += 1
      if (internalSignalPollCount >= 90) {
        clearThis()
        internalSignalRefreshError.value = true
        internalSignalRefreshMessage.value = '规则评估任务处理时间较长，请稍后重新进入 SWOT 查看结果。'
        return
      }
      internalSignalTimer = window.setTimeout(
        () => pollSwotSignalTask(taskId, symbol, track),
        2000,
      )
    } else {
      signalCollectionPollCount += 1
      if (signalCollectionPollCount >= 90) {
        clearThis()
        signalCollectionError.value = true
        signalCollectionMessage.value = '分析任务处理时间较长，请稍后重新进入 SWOT 查看结果。'
        return
      }
      signalCollectionTimer = window.setTimeout(
        () => pollSwotSignalTask(taskId, symbol, track),
        2000,
      )
    }
  } catch (e) {
    clearThis()
    if (isInternal) {
      internalSignalRefreshError.value = true
      internalSignalRefreshMessage.value = e?.message || '优势与劣势任务查询失败'
    } else {
      signalCollectionError.value = true
      signalCollectionMessage.value = e?.message || '机会与风险分析任务查询失败'
    }
  }
}

function clearAnalysisPolling() {
  if (analysisPollTimer) {
    clearInterval(analysisPollTimer)
    analysisPollTimer = null
  }
}

async function selectAnalysisHistory(item) {
  if (!item?.id) return
  try {
    const body = await request.get(`/analysis-history/${item.id}`)
    const full = body?.data || item
    payload.value = {
      ...(payload.value || {}),
      deep_analysis: full,
    }
  } catch (_) {
    payload.value = {
      ...(payload.value || {}),
      deep_analysis: item,
    }
  }
}

function analysisHistoryTitle(item) {
  const analysis = item?.analysis || {}
  return analysis.final_conclusion
    || analysis.investment_advice
    || analysis.long_term_forecast
    || analysis.mid_term_forecast
    || analysis.short_term_forecast
    || item?.stock_name
    || '查看分析详情'
}

function accuracyLabel(value) {
  return {
    accurate: '准确',
    mixed: '部分准确',
    inaccurate: '不准确',
  }[value] || value || '未评估'
}

async function submitDeepAnalysis() {
  const symbol = stockSymbol.value && stockSymbol.value !== '-' ? stockSymbol.value : directSymbol.value
  if (!symbol) return
  clearAnalysisPolling()
  analysisSubmitting.value = true
  analysisSubmitError.value = ''
  analysisSubmitStatus.value = ''
  try {
    const body = await request.post(
      '/analyze/deep-analysis',
      { symbol, priority: 30, analysis_mode: analysisMode.value },
    )
    if (!body?.success) {
      analysisSubmitError.value = body?.message || '提交失败'
      analysisSubmitting.value = false
      return
    }
    const taskId = body.task_id
    analysisSubmitStatus.value = `已提交，前方 ${body.queue_ahead ?? '?'} 个任务。${body.wait_hint || '分析中…'}`
    let tries = 0
    analysisPollTimer = setInterval(async () => {
      tries += 1
      if (tries > 120) {
        clearAnalysisPolling()
        analysisSubmitStatus.value = '等待超时，请稍后刷新工作台或在个股深度分析历史中查看。'
        analysisSubmitting.value = false
        return
      }
      try {
        const poll = await request.get(`/analyze/task/${taskId}`)
        const status = poll?.status
        if (status === 'completed') {
          clearAnalysisPolling()
          analysisSubmitting.value = false
          analysisSubmitStatus.value = '分析完成，已更新当前工作台。'
          const analysis = poll?.analysis || {}
          const nextDeepAnalysis = {
            id: taskId,
            symbol,
            stock_name: analysis.stock_name || stockName.value || '',
            analysis_mode: poll?.analysis_mode || analysis.analysis_mode || analysisMode.value,
            analysis,
            model: poll?.model,
            created_at: new Date().toISOString(),
          }
          payload.value = {
            ...(payload.value || {}),
            deep_analysis: nextDeepAnalysis,
            analysis_history: [
              nextDeepAnalysis,
              ...analysisHistory.value.filter((item) => item.id !== nextDeepAnalysis.id),
            ],
            data_status: {
              ...(payload.value?.data_status || {}),
              deep_analysis_found: true,
              analysis_created_at: nextDeepAnalysis.created_at,
            },
          }
        } else if (status === 'failed' || status === 'completed_with_parse_error') {
          clearAnalysisPolling()
          analysisSubmitting.value = false
          analysisSubmitStatus.value = ''
          analysisSubmitError.value = poll?.error || '分析失败'
        } else if (status === 'pending') {
          analysisSubmitStatus.value = `排队中，前方 ${poll?.queue_ahead ?? '?'} 个任务。${poll?.wait_hint || '预计等待时间计算中'}`
        } else if (status === 'processing') {
          analysisSubmitStatus.value = poll?.wait_hint || '正在分析，LLM 响应时间可能有波动'
        }
      } catch (_) {
        // Keep polling through transient network/server hiccups.
      }
    }, 3000)
  } catch (e) {
    analysisSubmitError.value = e.response?.data?.detail || e.message || '提交失败'
    analysisSubmitting.value = false
  }
}

function renderShareholderCharts() {
  renderHolderNumberChart()
  renderHkHoldChart()
}

function renderHolderNumberChart() {
  const rows = shHolderNumbers.value
    .slice(0, 12)
    .reverse()
    .map((row) => ({
      date: row.end_date,
      value: toNumber(row.holder_num),
    }))
    .filter((row) => row.date && row.value != null)
  if (!holderNumberChartRef.value || !rows.length) return
  if (!holderNumberChart) holderNumberChart = echarts.init(holderNumberChartRef.value)
  holderNumberChart.setOption({
    backgroundColor: 'transparent',
    grid: { left: 44, right: 18, top: 20, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      formatter: (items) => {
        const row = items?.[0]
        return row ? `${row.axisValue}<br/>股东户数：${Number(row.data).toLocaleString()}` : ''
      },
    },
    xAxis: {
      type: 'category',
      data: rows.map((row) => row.date),
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(148,163,184,.3)' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#94a3b8',
        formatter: (value) => {
          if (Math.abs(value) >= 10000) return `${Math.round(value / 10000)}万`
          return `${Math.round(value)}`
        },
      },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,.16)' } },
    },
    series: [{
      type: 'line',
      data: rows.map((row) => row.value),
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: '#60a5fa', width: 2 },
      itemStyle: { color: '#93c5fd' },
      areaStyle: { color: 'rgba(96,165,250,.14)' },
    }],
  })
  holderNumberChart.resize()
}

function renderHkHoldChart() {
  const rows = shHkHold.value
    .slice(0, 12)
    .reverse()
    .map((row) => ({
      date: row.trade_date,
      ratio: toNumber(row.ratio),
    }))
    .filter((row) => row.date && row.ratio != null)
  if (!hkHoldChartRef.value || !rows.length) return
  if (!hkHoldChart) hkHoldChart = echarts.init(hkHoldChartRef.value)
  hkHoldChart.setOption({
    backgroundColor: 'transparent',
    grid: { left: 42, right: 18, top: 20, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      formatter: (items) => {
        const row = items?.[0]
        return row ? `${row.axisValue}<br/>北向占比：${Number(row.data).toFixed(2)}%` : ''
      },
    },
    xAxis: {
      type: 'category',
      data: rows.map((row) => row.date),
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(148,163,184,.3)' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#94a3b8', formatter: (value) => `${value}%` },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,.16)' } },
    },
    series: [{
      type: 'line',
      data: rows.map((row) => row.ratio),
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: '#f97316', width: 2 },
      itemStyle: { color: '#fb923c' },
      areaStyle: { color: 'rgba(249,115,22,.13)' },
    }],
  })
  hkHoldChart.resize()
}

function disposeShareholderCharts() {
  if (holderNumberChart) {
    holderNumberChart.dispose()
    holderNumberChart = null
  }
  if (hkHoldChart) {
    hkHoldChart.dispose()
    hkHoldChart = null
  }
}

function valuationMultipleWithPercentile(field, suffix = '') {
  const value = fmtNumber(valuationCurrentMultiples.value?.[field], 2, suffix)
  const pct = valuationPercentiles.value?.[field]
  if (pct == null) return value
  return `${value} / P${Number(pct).toFixed(0)}`
}

function holderNumQoq(idx) {
  const rows = shHolderNumbers.value
  const curr = Number(rows[idx]?.holder_num)
  const prev = Number(rows[idx + 1]?.holder_num)
  if (!Number.isFinite(curr) || !Number.isFinite(prev) || prev === 0) return null
  return (curr - prev) / Math.abs(prev) * 100
}

onBeforeUnmount(() => {
  clearAnalysisPolling()
  clearSignalCollectionPolling()
})
</script>

<style scoped>
.stock-workbench {
  color: #e2e8f0;
  padding: 6px;
}
.workbench-card,
.empty-state {
  background: rgba(15, 23, 42, 0.76);
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 18px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
}
.eyebrow {
  color: #93c5fd;
  font-size: 12px;
  letter-spacing: .08em;
  margin: 0 0 5px;
  text-transform: uppercase;
}
h1, h2, h3 {
  margin: 0;
}
.empty-state {
  padding: 44px;
  text-align: center;
}
.empty-state p,
.muted,
.muted-block {
  color: #94a3b8;
}
.text-link-button {
  background: transparent;
  border: 0;
  color: #93c5fd;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
}
.text-link-button:hover {
  color: #bfdbfe;
}
.financial-metrics div {
  background: rgba(30, 41, 59, .78);
  border-radius: 14px;
  padding: 14px;
}
.financial-metrics span {
  color: #94a3b8;
  display: block;
  font-size: 12px;
}
.financial-metrics strong {
  color: #f8fafc;
  display: block;
  font-size: 22px;
  margin: 4px 0;
}
.is-up {
  color: #ef4444;
}
.is-down {
  color: #22c55e;
}
.workbench-tabs {
  margin-bottom: 14px;
}
.panel-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, .8fr);
}
.workbench-card {
  margin-bottom: 16px;
  padding: 20px;
}
.card-title-row {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 14px;
}
.analysis-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}
.analysis-mode-select {
  min-width: 140px;
}
.analysis-time {
  color: #94a3b8;
  font-size: 13px;
  margin: -4px 0 14px;
}
.analysis-history-list {
  display: grid;
  gap: 10px;
}
.evaluation-list {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}
.evaluation-item {
  align-items: center;
  background: rgba(30, 41, 59, .62);
  border: 1px solid rgba(148, 163, 184, .16);
  border-radius: 12px;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr) auto;
  padding: 12px 14px;
}
.evaluation-item span,
.evaluation-item small {
  color: #94a3b8;
  display: block;
  font-size: 12px;
}
.evaluation-item strong {
  color: #f8fafc;
  display: block;
  margin: 2px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.evaluation-badge,
.evaluation-inline-badge {
  border: 1px solid rgba(148, 163, 184, .24);
  border-radius: 999px;
  color: #cbd5e1;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 8px;
  white-space: nowrap;
}
.evaluation-badge.accurate,
.evaluation-inline-badge.accurate {
  background: rgba(34, 197, 94, .14);
  border-color: rgba(34, 197, 94, .34);
  color: #86efac;
}
.evaluation-badge.mixed,
.evaluation-inline-badge.mixed {
  background: rgba(234, 179, 8, .14);
  border-color: rgba(234, 179, 8, .34);
  color: #fde68a;
}
.evaluation-badge.inaccurate,
.evaluation-inline-badge.inaccurate {
  background: rgba(239, 68, 68, .14);
  border-color: rgba(239, 68, 68, .34);
  color: #fca5a5;
}
.evaluation-inline-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 7px;
}
.analysis-history-item {
  background: rgba(30, 41, 59, .62);
  border: 1px solid rgba(148, 163, 184, .16);
  border-radius: 12px;
  color: #cbd5e1;
  cursor: pointer;
  display: grid;
  gap: 6px;
  grid-template-columns: 170px minmax(0, 1fr) 110px;
  padding: 12px 14px;
  text-align: left;
}
.analysis-history-item:hover,
.analysis-history-item.active {
  background: rgba(96, 165, 250, .14);
  border-color: rgba(96, 165, 250, .34);
}
.analysis-history-item span,
.analysis-history-item small {
  color: #94a3b8;
  font-size: 12px;
}
.analysis-history-item strong {
  color: #f8fafc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.analysis-points-list {
  color: #cbd5e1;
  margin: 12px 0 0;
  padding-left: 18px;
  line-height: 1.7;
}
.financial-metrics {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
details summary {
  color: #bfdbfe;
  cursor: pointer;
}
.quote-table-wrap {
  margin-top: 14px;
  overflow-x: auto;
}
.quote-table {
  border-collapse: collapse;
  min-width: 680px;
  width: 100%;
}
.quote-table th,
.quote-table td {
  border-bottom: 1px solid rgba(148, 163, 184, .16);
  color: #cbd5e1;
  font-size: 13px;
  padding: 10px 8px;
  text-align: right;
  white-space: nowrap;
}
.quote-table th:first-child,
.quote-table td:first-child {
  text-align: left;
}
.quote-table th {
  color: #94a3b8;
  font-weight: 600;
}
.quote-table td.cell-name {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shareholder-mini-chart {
  height: 180px;
  margin-bottom: 10px;
  width: 100%;
}
.shareholder-signal-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}
.shareholder-signal-grid article {
  background: rgba(15, 23, 42, .45);
  border: 1px solid rgba(148, 163, 184, .16);
  border-radius: 12px;
  padding: 12px;
}
.shareholder-signal-grid h4 {
  color: #e2e8f0;
  font-size: 14px;
  margin: 0 0 8px;
}
.shareholder-signal-grid p {
  color: #cbd5e1;
  margin: 6px 0;
}
.shareholder-signal-grid small {
  color: #94a3b8;
}
.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip-pill {
  background: rgba(96, 165, 250, .14);
  border: 1px solid rgba(96, 165, 250, .24);
  border-radius: 999px;
  color: #bfdbfe;
  font-size: 12px;
  padding: 5px 10px;
}
.badge-upcoming {
  background: rgba(248, 113, 113, .16);
  border-radius: 4px;
  color: #f87171;
  font-size: 11px;
  margin-left: 6px;
  padding: 1px 5px;
}
.trading-context-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin-top: 14px;
}
.trading-context-grid article {
  background: rgba(30, 41, 59, .56);
  border: 1px solid rgba(148, 163, 184, .14);
  border-radius: 12px;
  padding: 14px;
}
.trading-context-grid h4 {
  color: #e2e8f0;
  margin: 0 0 10px;
}
.trading-context-grid p {
  color: #f8fafc;
  display: flex;
  gap: 8px;
  justify-content: space-between;
  margin: 8px 0 0;
}
.trading-context-grid span {
  color: #94a3b8;
}
.muted-block {
  background: rgba(30, 41, 59, .56);
  border-radius: 12px;
  padding: 18px;
}
@media (max-width: 980px) {
  .panel-grid {
    grid-template-columns: 1fr;
  }
}
</style>
