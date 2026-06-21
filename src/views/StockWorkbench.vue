<template>
  <div class="stock-workbench">
    <section class="workbench-search">
      <div>
        <p class="eyebrow">Stock Workbench</p>
        <h2>股票研究工作台</h2>
        <p>以单只股票为中心，集中查看量化评分、财务快照和 AI 深度分析。</p>
      </div>
      <div class="stock-input-panel">
        <div class="stock-code-row">
          <StockSearchInput
            v-model="directSymbol"
            input-id="stock-workbench-symbol-input"
            label="输入股票代码 / 名称 / 拼音"
            placeholder="例如 600519、平安银行、PAYH、600519.SH"
            density="comfortable"
            bg-color="rgba(255,255,255,.06)"
            input-class="stock-code-input"
            @select="selectSearchCandidate"
            @submit="submitDirectSymbol"
          />
          <v-btn
            color="primary"
            size="large"
            :loading="loading"
            @click="submitDirectSymbol"
          >
            加载工作台
          </v-btn>
        </div>
        <div class="quick-symbols">
          <span>快速示例</span>
          <button type="button" @click="loadSymbol('600519.SH')">600519.SH</button>
          <button type="button" @click="loadSymbol('000858.SZ')">000858.SZ</button>
          <button type="button" @click="loadSymbol('000001.SZ')">000001.SZ</button>
        </div>
        <div v-if="recentStocks.length" class="quick-symbols recent-symbols">
          <span>最近使用</span>
          <button
            v-for="item in recentStocks"
            :key="item.symbol"
            type="button"
            class="recent-stock-btn"
            :title="item.symbol"
            @click="loadSymbol(item.symbol)"
          >
            <strong>{{ item.name || item.symbol }}</strong>
            <small v-if="item.name">{{ item.symbol }}</small>
          </button>
          <button type="button" class="clear-recent-btn" @click="clearRecentSymbols">清空</button>
        </div>
      </div>
    </section>

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
      <section class="hero-card">
        <div class="hero-main">
          <p class="eyebrow">{{ stockIndustry || '行业未覆盖' }}</p>
          <h1>{{ stockName || payload.symbol }} <span>{{ stockSymbol }}</span></h1>
          <div class="hero-tags">
            <span v-if="stockIndustryL2">{{ stockIndustryL2 }}</span>
            <span v-if="stockIndustryL3">{{ stockIndustryL3 }}</span>
            <span v-for="code in indexCodes" :key="code">{{ code }}</span>
          </div>
          <div class="section-status-row">
            <button
              v-for="item in sectionStatusItems"
              :key="item.key"
              type="button"
              class="section-status-chip"
              :class="{ 'is-missing': !item.found, 'is-stale': item.stale }"
              :title="item.title"
              @click="activePanel = item.panel"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.found ? '已覆盖' : '暂无' }}</strong>
              <small v-if="item.asOf">{{ item.asOf }}</small>
            </button>
          </div>
        </div>
        <div class="hero-metrics">
          <div>
            <small>最新价</small>
            <strong>{{ fmtNumber(latestPrice) }}</strong>
            <span v-if="sectionLoading.quote" class="muted">行情刷新中…</span>
            <span
              v-else
              class="price-change-line"
              :class="changeClass"
              :title="priceChangeTitle"
            >
              日涨跌幅 {{ fmtPct(latestPctChange) }}
            </span>
          </div>
          <div>
            <small>综合评分</small>
            <strong>{{ fmtNumber(currentCompositeScore) }}</strong>
            <span>{{ ratingText }}</span>
          </div>
          <div>
            <small>数据日期</small>
            <strong>评分 {{ dataStatus.score_date || '-' }}</strong>
            <span>行情 {{ dataStatus.quote_date || '未覆盖' }}</span>
          </div>
        </div>
      </section>

      <v-tabs v-model="activePanel" class="workbench-tabs" color="primary">
        <v-tab value="overview">总览</v-tab>
        <v-tab value="quote">行情资金</v-tab>
        <v-tab value="nine-turn">神奇九转</v-tab>
        <v-tab value="scores">量化评分</v-tab>
        <v-tab value="financial">财务业绩</v-tab>
        <v-tab value="valuation">估值模型</v-tab>
        <v-tab value="shareholders">股东筹码</v-tab>
        <v-tab value="analysis">深度分析</v-tab>
      </v-tabs>

      <v-window v-model="activePanel">
        <v-window-item value="overview">
          <section class="panel-grid panel-grid--overview">
            <article class="workbench-card">
              <div class="card-title-row">
                <h3>评分雷达</h3>
                <span class="muted">按维度展示最新量化评分</span>
              </div>
              <div ref="radarRef" class="score-radar"></div>
            </article>

            <article class="workbench-card">
              <h3>AI 研究摘要</h3>
              <div v-if="deepAnalysis" class="analysis-summary">
                <p class="summary-line">{{ analysisSummary }}</p>
                <div class="summary-meta">
                  <span>模式：{{ deepAnalysis.analysis_mode || 'classic' }}</span>
                  <span>时间：{{ deepAnalysis.created_at || '-' }}</span>
                </div>
                <ul v-if="analysisPoints.length">
                  <li v-for="(point, idx) in analysisPoints" :key="idx">{{ point }}</li>
                </ul>
              </div>
              <div v-else class="muted-block">暂无该股票的 AI 深度分析记录。</div>
            </article>

            <article class="workbench-card">
              <div class="card-title-row">
                <h3>行情资金快照</h3>
                <button type="button" class="text-link-button" @click="activePanel = 'quote'">查看详情</button>
              </div>
              <div class="financial-metrics">
                <div v-for="metric in overviewQuoteMetrics" :key="metric.label">
                  <span>{{ metric.label }}</span>
                  <strong :class="metric.className">{{ metric.value }}</strong>
                </div>
              </div>
              <div v-if="!quoteDailyRows.length && !latestMoneyFlow && !Object.keys(latestDailyBasic).length" class="muted-block">
                暂无行情资金分区数据。
              </div>
            </article>

            <article class="workbench-card">
              <h3>核心状态</h3>
              <div class="status-grid">
                <div v-for="item in statusItems" :key="item.label">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
            </article>
          </section>
        </v-window-item>

        <v-window-item value="quote">
          <section class="panel-grid">
            <article class="workbench-card">
              <div class="card-title-row">
                <h3>行情估值</h3>
                <span class="muted">
                  {{ quoteSectionDate || '暂无日期' }}
                  <template v-if="sectionLoading.quote"> · 刷新中…</template>
                </span>
              </div>
              <div class="financial-metrics">
                <div v-for="metric in quoteMetrics" :key="metric.label">
                  <span>{{ metric.label }}</span>
                  <strong>{{ metric.value }}</strong>
                </div>
              </div>
            </article>

            <article class="workbench-card">
              <div class="card-title-row">
                <h3>资金流</h3>
                <span class="muted">{{ latestMoneyFlow?.trade_date || '暂无日期' }}</span>
              </div>
              <div v-if="latestMoneyFlow" class="financial-metrics">
                <div v-for="metric in moneyFlowMetrics" :key="metric.label">
                  <span>{{ metric.label }}</span>
                  <strong :class="metric.className">{{ metric.value }}</strong>
                </div>
              </div>
              <div v-else class="muted-block">暂无该股票的资金流数据。</div>
            </article>
          </section>

          <section class="workbench-card">
            <div class="card-title-row">
              <h3>{{ quoteKlineTitle }}</h3>
              <div class="quote-kline-actions">
                <div class="quote-kline-tf">
                  <button
                    v-for="item in quoteKlineTfOptions"
                    :key="item.value"
                    type="button"
                    :class="{ on: quoteKlineTf === item.value }"
                    @click="quoteKlineTf = item.value"
                  >
                    {{ item.label }}
                  </button>
                </div>
                <span class="muted">最近 {{ quoteKlineRows.length }} 根</span>
              </div>
            </div>
            <StockKLineChart
              v-if="quoteKlineRows.length"
              :records="quoteKlineRows"
              :tf="quoteKlineTf"
            />
            <details v-if="quoteKlineRows.length" class="quote-details">
              <summary>展开最近 10 根{{ quoteKlineShortLabel }}行情明细</summary>
              <div class="quote-table-wrap">
                <table class="quote-table">
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>收盘</th>
                      <th>涨跌幅</th>
                      <th>最高</th>
                      <th>最低</th>
                      <th>成交额</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in quoteKlineRows.slice(0, 10)" :key="row.trade_date">
                      <td>
                        {{ row.trade_date }}
                        <span v-if="row.is_partial" class="partial-kline-tag">未完</span>
                      </td>
                      <td>{{ fmtNumber(row.close) }}</td>
                      <td :class="pctClass(row.pct_chg ?? row.pct_change)">{{ fmtPct(row.pct_chg ?? row.pct_change) }}</td>
                      <td>{{ fmtNumber(row.high) }}</td>
                      <td>{{ fmtNumber(row.low) }}</td>
                      <td>{{ fmtKlineAmount(row) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </details>
            <div v-else-if="quoteKlineIsLoading" class="muted-block">正在加载{{ quoteKlineShortLabel }}行情…</div>
            <div v-else class="muted-block">暂无该股票的{{ quoteKlineShortLabel }}行情。</div>
          </section>

          <section class="workbench-card">
            <div class="card-title-row">
              <h3>主力资金趋势</h3>
              <span class="muted">金额单位：万元，展示按亿/万自动换算</span>
            </div>
            <MoneyFlowPanel
              :latest="latestMoneyFlow"
              :history="activeMoneyFlowHistory"
              :summary="moneyFlowSummary"
              :period="quoteKlineTf"
              :kline-rows="quoteKlineRows"
              :loading="moneyFlowIsLoading"
            />
          </section>
        </v-window-item>

        <v-window-item value="nine-turn">
          <section class="panel-grid">
            <article class="workbench-card nine-turn-latest-card">
              <div class="card-title-row">
                <h3>最近九转信号</h3>
                <span class="muted">
                  {{ nineTurnStatus.as_of || '暂无日期' }}
                  <template v-if="sectionLoading.nine_turn"> · 刷新中…</template>
                </span>
              </div>
              <div v-if="latestNineTurnSignal" class="nine-turn-summary">
                <strong :class="nineturnSignalClass(latestNineTurnSignal)">
                  {{ latestNineTurnSignal.label }} · {{ latestNineTurnSignal.grade_label }}
                </strong>
                <span>{{ latestNineTurnSignal.trade_date }} · 强度 {{ latestNineTurnSignal.strength }}/4</span>
                <p>
                  完美结构 {{ formatCheck(latestNineTurnSignal.perfect) }}，
                  量能过滤 {{ formatCheck(latestNineTurnSignal.vol_filter_pass) }}，
                  均线过滤 {{ formatCheck(latestNineTurnSignal.trend_filter_pass) }}
                </p>
              </div>
              <div v-else class="muted-block">暂无已完成的九转信号。</div>
            </article>

            <article class="workbench-card">
              <div class="card-title-row">
                <h3>规则说明</h3>
                <span class="muted">Tushare 原始计数 + 本地增强</span>
              </div>
              <div class="nine-turn-rules">
                <span>下九转：第 8/9 天低点低于第 6/7 天低点</span>
                <span>上九转：第 8/9 天高点高于第 6/7 天高点</span>
                <span>过滤：下九转缩量 + 站上 60 日线；上九转放量</span>
              </div>
            </article>
          </section>

          <section class="workbench-card">
            <div class="card-title-row">
              <h3>九转 K 线</h3>
              <span class="muted">最近 {{ nineTurnDailyRows.length }} 个交易日 · {{ nineTurnSignals.length }} 个信号</span>
            </div>
            <StockKLineChart
              v-if="nineTurnDailyRows.length"
              :records="nineTurnDailyRows"
              :markers="nineTurnMarkers"
            />
            <div v-else class="muted-block">暂无该股票的九转 K 线数据。</div>
          </section>

          <section class="workbench-card">
            <div class="card-title-row">
              <h3>信号明细</h3>
              <span class="muted">普通 / 完美 / 强</span>
            </div>
            <div v-if="nineTurnSignals.length" class="quote-table-wrap">
              <table class="quote-table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>方向</th>
                    <th>分级</th>
                    <th>完美结构</th>
                    <th>量能过滤</th>
                    <th>均线过滤</th>
                    <th>收盘</th>
                    <th>5日均量</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="signal in nineTurnSignals" :key="`${signal.trade_date}-${signal.direction}`">
                    <td>{{ signal.trade_date }}</td>
                    <td :class="nineturnSignalClass(signal)">{{ signal.label }}</td>
                    <td>{{ signal.grade_label }}</td>
                    <td>{{ formatCheck(signal.perfect) }}</td>
                    <td>{{ formatCheck(signal.vol_filter_pass) }}</td>
                    <td>{{ formatCheck(signal.trend_filter_pass) }}</td>
                    <td>{{ fmtNumber(signal.close) }}</td>
                    <td>{{ fmtNumber(signal.volume_ma) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="muted-block">暂无完成 9 计数的九转信号。</div>
          </section>
        </v-window-item>

        <v-window-item value="scores">
          <section class="workbench-card">
            <div class="card-title-row">
              <h3>量化评分详情</h3>
              <span class="muted">
                来自最新 `stock_scores` 文档
                <template v-if="scoreHistory.length"> · 最近 {{ scoreHistory.length }} 条历史</template>
                <template v-if="sectionLoading.scores"> · 刷新中…</template>
              </span>
            </div>
            <div class="score-grid">
              <article v-for="item in scoreItems" :key="item.key" class="score-card">
                <div class="score-card__head">
                  <span>{{ item.label }}</span>
                  <strong>{{ fmtNumber(item.score) }}</strong>
                </div>
                <div class="score-bar"><i :style="{ width: `${scorePercent(item.score)}%` }"></i></div>
                <details>
                  <summary>查看详情</summary>
                  <pre>{{ formatDetail(item.details) }}</pre>
                </details>
              </article>
            </div>
            <div class="score-history-block">
              <h4>评分历史</h4>
              <div v-if="scoreHistory.length" class="quote-table-wrap">
                <table class="quote-table">
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>综合</th>
                      <th>技术</th>
                      <th>基本面</th>
                      <th>价值</th>
                      <th>成长</th>
                      <th>资金流</th>
                      <th>动量</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in scoreHistory.slice(0, 12)" :key="row.score_date">
                      <td>{{ row.score_date || '-' }}</td>
                      <td>{{ fmtNumber(scoreRowComposite(row)) }}</td>
                      <td>{{ fmtNumber(row.technical_score) }}</td>
                      <td>{{ fmtNumber(row.fundamental_score) }}</td>
                      <td>{{ fmtNumber(row.value_score) }}</td>
                      <td>{{ fmtNumber(row.growth_score) }}</td>
                      <td>{{ fmtNumber(row.money_flow_score) }}</td>
                      <td>{{ fmtNumber(row.cycle_score) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="muted-block">暂无评分历史。</div>
            </div>
          </section>
        </v-window-item>

        <v-window-item value="financial">
          <section class="panel-grid">
            <article class="workbench-card">
              <div class="card-title-row">
                <h3>财务成长图</h3>
                <span class="muted">
                  {{ financialModeLabel }} · 最近 {{ financialChartData.length }} 期
                  <template v-if="sectionLoading.financials"> · 刷新中…</template>
                </span>
              </div>
              <v-btn-toggle
                v-model="financialMode"
                class="financial-mode-toggle"
                color="primary"
                density="compact"
                mandatory
                variant="outlined"
              >
                <v-btn value="quarterly">单季对比</v-btn>
                <v-btn value="annual">年度对比</v-btn>
              </v-btn-toggle>
              <GrowthChart v-if="financialChartData.length" :series="financialChartData" />
              <div v-else class="muted-block">暂无足够财务数据。</div>
            </article>
            <article class="workbench-card">
              <div class="card-title-row">
                <h3>核心财务指标</h3>
                <span class="muted">{{ financialMetricsPeriodText }}</span>
              </div>
              <div class="financial-metrics">
                <div v-for="metric in financialMetrics" :key="metric.label">
                  <span>{{ metric.label }}</span>
                  <strong>{{ metric.value }}</strong>
                </div>
              </div>
            </article>
          </section>
          <section class="workbench-card">
            <div class="card-title-row">
              <h3>财务质量摘要</h3>
              <span class="muted">基于当前{{ financialModeLabel }}口径与最新财报数据</span>
            </div>
            <div v-if="financialQualityCards.length" class="quality-card-grid">
              <article
                v-for="card in financialQualityCards"
                :key="card.key"
                :class="['quality-card', `quality-card--${card.level}`]"
              >
                <span>{{ card.label }}</span>
                <strong>{{ card.title }}</strong>
                <small>{{ card.detail }}</small>
              </article>
            </div>
            <div v-else class="muted-block">暂无足够财务数据生成质量摘要。</div>
          </section>
          <section class="workbench-card">
            <div class="card-title-row">
              <h3>原始财报明细</h3>
              <span class="muted">最近 8 期关键字段，金额按报表元口径换算</span>
            </div>
            <div class="financial-raw-sections">
              <details open>
                <summary>利润表</summary>
                <div v-if="incomeReportSections.length" class="financial-report-groups">
                  <div v-for="section in incomeReportSections" :key="section.key" class="financial-report-group">
                    <h4>{{ section.label }}</h4>
                    <div class="quote-table-wrap">
                      <table class="quote-table financial-raw-table">
                        <thead>
                          <tr>
                            <th>报告期</th>
                            <th>公告日</th>
                            <th>营业总收入</th>
                            <th>营业收入</th>
                            <th>归母净利</th>
                            <th>净利润</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="row in section.rows.slice(0, 8)" :key="`income-${section.key}-${statementPeriod(row)}`">
                            <td>{{ statementPeriod(row) }}</td>
                            <td>{{ blankDash(row.ann_date || row.f_ann_date) }}</td>
                            <td>{{ fmtStatementAmount(row.total_revenue) }}</td>
                            <td>{{ fmtStatementAmount(row.revenue) }}</td>
                            <td>{{ fmtStatementAmount(row.n_income_attr_p) }}</td>
                            <td>{{ fmtStatementAmount(row.n_income) }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <div v-else class="muted-block">暂无利润表明细。</div>
              </details>
              <details>
                <summary>资产负债表</summary>
                <div v-if="balanceRows.length" class="quote-table-wrap">
                  <table class="quote-table financial-raw-table">
                    <thead>
                      <tr>
                        <th>报告期</th>
                        <th>公告日</th>
                        <th>总资产</th>
                        <th>总负债</th>
                        <th>股东权益</th>
                        <th>应收账款</th>
                        <th>存货</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in balanceRows.slice(0, 8)" :key="`balance-${statementPeriod(row)}`">
                        <td>{{ statementPeriod(row) }}</td>
                        <td>{{ blankDash(row.ann_date || row.f_ann_date) }}</td>
                        <td>{{ fmtStatementAmount(row.total_assets) }}</td>
                        <td>{{ fmtStatementAmount(row.total_liab) }}</td>
                        <td>{{ fmtStatementAmount(row.total_hldr_eqy_exc_min_int || row.total_hldr_eqy_inc_min_int) }}</td>
                        <td>{{ fmtStatementAmount(row.accounts_receiv) }}</td>
                        <td>{{ fmtStatementAmount(row.inventories) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-else class="muted-block">暂无资产负债表明细。</div>
              </details>
              <details>
                <summary>现金流量表</summary>
                <div v-if="cashflowReportSections.length" class="financial-report-groups">
                  <div v-for="section in cashflowReportSections" :key="section.key" class="financial-report-group">
                    <h4>{{ section.label }}</h4>
                    <div class="quote-table-wrap">
                      <table class="quote-table financial-raw-table">
                        <thead>
                          <tr>
                            <th>报告期</th>
                            <th>公告日</th>
                            <th>经营现金流</th>
                            <th>投资现金流</th>
                            <th>筹资现金流</th>
                            <th>购建长期资产</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="row in section.rows.slice(0, 8)" :key="`cashflow-${section.key}-${statementPeriod(row)}`">
                            <td>{{ statementPeriod(row) }}</td>
                            <td>{{ blankDash(row.ann_date || row.f_ann_date) }}</td>
                            <td>{{ fmtStatementAmount(row.n_cashflow_act) }}</td>
                            <td>{{ fmtStatementAmount(row.n_cashflow_inv_act) }}</td>
                            <td>{{ fmtStatementAmount(row.n_cash_flows_fnc_act) }}</td>
                            <td>{{ fmtStatementAmount(row.c_pay_acq_const_fiolta) }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <div v-else class="muted-block">暂无现金流量表明细。</div>
              </details>
              <details>
                <summary>财务指标</summary>
                <div v-if="indicatorRows.length" class="quote-table-wrap">
                  <table class="quote-table financial-raw-table">
                    <thead>
                      <tr>
                        <th>报告期</th>
                        <th>公告日</th>
                        <th>ROE</th>
                        <th>毛利率</th>
                        <th>营收同比</th>
                        <th>净利同比</th>
                        <th>资产负债率</th>
                        <th>流动比率</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in indicatorRows.slice(0, 8)" :key="`indicator-${statementPeriod(row)}`">
                        <td>{{ statementPeriod(row) }}</td>
                        <td>{{ blankDash(row.ann_date || row.f_ann_date) }}</td>
                        <td>{{ fmtNullablePct(row.roe || row.roe_dt) }}</td>
                        <td>{{ fmtNullablePct(row.grossprofit_margin) }}</td>
                        <td>{{ fmtNullablePct(row.tr_yoy || row.or_yoy) }}</td>
                        <td>{{ fmtNullablePct(row.netprofit_yoy || row.profit_to_gr) }}</td>
                        <td>{{ fmtNullablePct(row.debt_to_assets) }}</td>
                        <td>{{ fmtNullableNumber(row.current_ratio) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-else class="muted-block">暂无财务指标明细。</div>
              </details>
            </div>
          </section>
          <section class="workbench-card">
            <div class="card-title-row">
              <h3>业绩事件</h3>
              <span class="muted">预告 / 快报 / 披露日历</span>
            </div>
            <div v-if="earningsEvents.length" class="event-list">
              <article v-for="event in earningsEvents" :key="`${event.type}-${event.date}-${event.title}`" class="event-item">
                <span>{{ event.type }}</span>
                <strong>{{ event.title }}</strong>
                <small>{{ event.date || '-' }}</small>
              </article>
            </div>
            <div v-else class="muted-block">暂无业绩事件。</div>
          </section>
          <section class="workbench-card">
            <div class="card-title-row">
              <h3>卖方研报</h3>
              <span class="muted">最近 {{ reportRcRows.length }} 条，来自 Tushare report_rc</span>
            </div>
            <div v-if="reportRcRows.length" class="quote-table-wrap">
              <table class="quote-table report-rc-table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>券商</th>
                    <th>评级</th>
                    <th>目标价</th>
                    <th>预测期</th>
                    <th>营收</th>
                    <th>营业利润</th>
                    <th>利润总额</th>
                    <th>净利润</th>
                    <th>EPS</th>
                    <th>PE</th>
                    <th>股息率</th>
                    <th>ROE</th>
                    <th>EV/EBITDA</th>
                    <th>报告标题</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in reportRcRows" :key="`${row.report_date || row.create_time}-${row.org_name}-${row.report_title}`">
                    <td>{{ blankDash(row.report_date || row.create_time) }}</td>
                    <td>{{ blankDash(row.org_name || row.organ_name || row.org) }}</td>
                    <td>{{ blankDash(row.rating_name || row.rating) }}</td>
                    <td>{{ reportRcTargetRange(row) || '-' }}</td>
                    <td>{{ blankDash(row.quarter) }}</td>
                    <td>{{ fmtWanAmount(row.op_rt) }}</td>
                    <td>{{ fmtWanAmount(row.op_pr) }}</td>
                    <td>{{ fmtWanAmount(row.tp) }}</td>
                    <td>{{ fmtWanAmount(row.np) }}</td>
                    <td>{{ fmtNullableNumber(row.eps) }}</td>
                    <td>{{ fmtNullableNumber(row.pe) }}</td>
                    <td>{{ fmtNullablePct(row.rd) }}</td>
                    <td>{{ fmtNullablePct(row.roe) }}</td>
                    <td>{{ fmtNullableNumber(row.ev_ebitda) }}</td>
                    <td class="report-title-cell">{{ blankDash(row.report_title || row.title || row.name) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="muted-block">暂无卖方研报数据。</div>
          </section>
        </v-window-item>

        <v-window-item value="valuation">
          <section class="panel-grid">
            <article class="workbench-card">
              <div class="card-title-row">
                <h3>估值结论</h3>
                <div class="analysis-actions">
                  <span class="muted">
                    {{ valuationStatus.as_of || '暂无日期' }}
                    <template v-if="sectionLoading.valuation"> · 刷新中…</template>
                  </span>
                  <button
                    type="button"
                    class="text-link-button"
                    :disabled="sectionLoading.valuation"
                    @click="refreshValuationSection"
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
              <div v-else class="muted-block">暂无足够估值数据，等待 daily_basic 与财务指标补齐。</div>
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
                <button type="button" class="text-link-button" @click="openValuationHelp('ddm')">原理说明</button>
              </div>
            </div>
            <div v-if="valuationDdmScenarios.length" class="quote-table-wrap">
              <table class="quote-table">
                <thead>
                  <tr>
                    <th>情景</th>
                    <th>现金分红</th>
                    <th>股权成本</th>
                    <th>永续增长</th>
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
                    <td>{{ fmtAmount(scenario.equity_value_wan) }}</td>
                    <td>{{ fmtNumber(scenario.upside_pct, 2, '%') }}</td>
                  </tr>
                </tbody>
              </table>
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
                <button type="button" class="text-link-button" @click="openValuationHelp('dcf')">原理说明</button>
              </div>
            </div>
            <div v-if="valuationDcfScenarios.length" class="quote-table-wrap">
              <table class="quote-table">
                <thead>
                  <tr>
                    <th>情景</th>
                    <th>WACC</th>
                    <th>永续增长</th>
                    <th>初始增长</th>
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
                    <td>{{ fmtNumber(scenario.fair_value_per_share) }}</td>
                    <td>{{ fmtNumber(scenario.safety_margin_pct, 2, '%') }}</td>
                    <td>{{ fmtAmount(scenario.equity_value_wan) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="muted-block">{{ valuationDcf.reason || '暂无足够现金流样本生成 DCF。' }}</div>
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
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import * as echarts from 'echarts'
import {
  getStockWorkbench,
  getStockWorkbenchAi,
  getStockWorkbenchFinancials,
  getStockWorkbenchKline,
  getStockWorkbenchMoneyFlow,
  getStockWorkbenchNineTurn,
  getStockWorkbenchQuote,
  getStockWorkbenchScores,
  getStockWorkbenchShareholders,
  getStockWorkbenchTrading,
  getStockWorkbenchValuation,
} from '../api/stock'
import AnalysisDetailContent from '../components/AnalysisDetailContent.vue'
import GrowthChart from '../components/GrowthChart.vue'
import MoneyFlowPanel from '../components/MoneyFlowPanel.vue'
import StockKLineChart from '../components/StockKLineChart.vue'
import StockSearchInput from '../components/StockSearchInput.vue'

const SCORE_DEFS = [
  { key: 'technical', label: '技术面' },
  { key: 'fundamental', label: '基本面' },
  { key: 'value', label: '价值' },
  { key: 'growth', label: '成长' },
  { key: 'money_flow', label: '资金流' },
  { key: 'cycle', label: '动量' },
]

const loading = ref(false)
const error = ref('')
const payload = ref(null)
const activePanel = ref('overview')
const directSymbol = ref('')
const recentStocks = ref([])
const analysisMode = ref('multi_expert_v1')
const analysisSubmitting = ref(false)
const analysisSubmitStatus = ref('')
const analysisSubmitError = ref('')
const incomeRows = ref([])
const indicatorRows = ref([])
const balanceRows = ref([])
const cashflowRows = ref([])
const earnings = ref({})
const tradingContext = ref({})
const valuationData = ref({})
const financialMode = ref('quarterly')
const quoteKlineTf = ref('1d')
const quoteKlineLoading = ref({ '1d': false, '1w': false, '1m': false })
const moneyFlowLoading = ref({ '1d': false, '1w': false, '1m': false })
const sectionLoading = ref({ quote: false, nine_turn: false, scores: false, financials: false, valuation: false, ai: false, trading: false, shareholders: false })
const sectionLoaded = ref({ quote: false, nine_turn: false, scores: false, financials: false, valuation: false, ai: false, trading: false, shareholders: false })
const shareholderData = ref({})
const holderNumberTableExpanded = ref(false)
const shareholderTradesExpanded = ref(false)
const shareFloatExpanded = ref(false)
const valuationHelpOpen = ref(false)
const valuationHelpTopic = ref('ddm')
const radarRef = ref(null)
const holderNumberChartRef = ref(null)
const hkHoldChartRef = ref(null)
let radarChart = null
let holderNumberChart = null
let hkHoldChart = null
let analysisPollTimer = null

const RECENT_SYMBOLS_KEY = 'stock-workbench:recent-symbols'

const analysisModeOptions = [
  { title: '多专家', value: 'multi_expert_v1' },
  { title: '经典', value: 'classic' },
]

const VALUATION_HELP = {
  ddm: {
    title: 'DDM / 分红折现模型说明',
    summary: '当前 DDM 使用已实施现金分红作为基础，适合分红稳定、盈利和现金流覆盖较好的成熟公司。',
    formula: '股权价值 = 下一期现金分红 / (股权成本 - 永续增长率)',
    interpretation: [
      '中性情景低于当前市值，说明市场价格已经包含较高分红持续性或增长预期。',
      '乐观情景高于当前市值，通常意味着只有在分红维持高位并持续增长时才有明显上行空间。',
      '保守、中性、乐观三档主要改变年度现金分红、股权成本和永续增长率。',
    ],
    limits: [
      '戈登 DDM 对股权成本和永续增长率非常敏感，两个参数差一点，估值会变化很大。',
      '模型假设分红长期稳定增长，不适合分红不规律、强周期或高速扩张但低分红的公司。',
      '当前口径基于实施分红记录，不等同于未来董事会一定会延续相同分红政策。',
    ],
  },
  dcf: {
    title: 'DCF / 自由现金流折现说明',
    summary: '当前 DCF 使用 FCFF 作为现金流基础，并用 WACC 折现，估算企业经营现金流创造的股权价值参考区间。',
    formula: '企业价值 = 预测期 FCFF 折现值 + 永续期终值折现值；终值 = 末期 FCFF × (1 + g) / (WACC - g)',
    interpretation: [
      '保守、中性、乐观三档分别调整折现率、初始增长率和永续增长率，用来观察估值对假设的敏感性。',
      '若 DCF 明显高于市值，但 DDM 不支持，通常说明现金流估值乐观，需要检查资本开支、分红政策和现金流可分配性。',
      '安全边际为正表示模型估值高于当前价格，但它不是买入建议，只是该组假设下的估值差。',
    ],
    limits: [
      'DCF 对长期增长率和折现率高度敏感，尤其是永续期终值占比较高时。',
      '当前版本未精细调整净债务、少数股东权益和非经营资产，因此更适合做区间参考。',
      '如果 FCFF 来自异常年份或周期高点，模型可能高估公司长期可持续现金流。',
    ],
  },
}

const score = computed(() => payload.value?.score || {})
const stock = computed(() => payload.value?.stock || {})
const quote = computed(() => payload.value?.quote || {})
const deepAnalysis = computed(() => payload.value?.deep_analysis || null)
const dataStatus = computed(() => payload.value?.data_status || {})
const valuationHelpContent = computed(() => VALUATION_HELP[valuationHelpTopic.value] || VALUATION_HELP.ddm)
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
const quoteSectionDate = computed(() => dataStatus.value?.sections?.quote?.as_of || latestDailyBasic.value.trade_date || quote.value.trade_date || '')
const nineTurnDailyRows = computed(() => Array.isArray(payload.value?.nine_turn_daily_quotes) ? payload.value.nine_turn_daily_quotes : [])
const nineTurnSignals = computed(() => {
  const rows = Array.isArray(payload.value?.nine_turn_signals) ? payload.value.nine_turn_signals : []
  return [...rows].sort((a, b) => String(b.trade_date || '').localeCompare(String(a.trade_date || '')))
})
const latestNineTurnSignal = computed(() => payload.value?.latest_nine_turn_signal || nineTurnSignals.value[0] || null)
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
const valuationBaseScenario = computed(() => valuationDcfScenarios.value.find((row) => row.name === 'base') || valuationDcfScenarios.value[0] || {})
const valuationDdm = computed(() => valuationData.value.ddm || {})
const valuationDdmScenarios = computed(() => Array.isArray(valuationDdm.value.scenarios) ? valuationDdm.value.scenarios : [])
const valuationDdmAnnualRows = computed(() => Array.isArray(valuationDdm.value.annual_dividends) ? valuationDdm.value.annual_dividends : [])
const valuationRelative = computed(() => valuationData.value.relative_valuation || {})
const valuationSuitability = computed(() => valuationData.value.model_suitability || {})
const valuationSuitabilityReasons = computed(() => Array.isArray(valuationSuitability.value.reasons) ? valuationSuitability.value.reasons : [])
const valuationValueScore = computed(() => valuationData.value.value_score_link?.value_score)
const valuationModelLabel = computed(() => ({
  dcf: 'DCF 现金流折现',
  relative_valuation: '相对估值',
  pb_roe_or_ddm: 'PB-ROE / DDM',
})[valuationSuitability.value.recommended_model] || valuationSuitability.value.recommended_model || '-')
const valuationConclusionMetrics = computed(() => [
  { label: '当前价格', value: fmtNumber(latestPrice.value) },
  { label: '中性每股价值', value: fmtNumber(valuationBaseScenario.value.fair_value_per_share) },
  { label: '安全边际', value: fmtNumber(valuationBaseScenario.value.safety_margin_pct, 2, '%') },
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

const stockSymbol = computed(() => stock.value.symbol || payload.value?.symbol || '-')
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
const overviewQuoteMetrics = computed(() => [
  { label: '换手率', value: fmtNumber(latestDailyBasic.value.turnover_rate, 2, '%') },
  { label: 'PE TTM', value: fmtNumber(latestDailyBasic.value.pe_ttm ?? latestDailyBasic.value.pe) },
  { label: 'PB', value: fmtNumber(latestDailyBasic.value.pb) },
  { label: '主力净额', value: fmtWanAmount(moneyFlowSummary.value.main_net_today ?? latestMoneyFlow.value?.net_mf_amount), className: valueClass(moneyFlowSummary.value.main_net_today ?? latestMoneyFlow.value?.net_mf_amount) },
])

watch([scoreItems, activePanel], async () => {
  if (activePanel.value !== 'overview') return
  await nextTick()
  renderRadar()
}, { deep: true })

watch(activePanel, async (panel) => {
  if (!payload.value) return
  if (panel === 'quote') {
    await loadWorkbenchSection('quote')
    if (quoteKlineTf.value !== '1d') {
      await Promise.all([
        ensureQuoteKline(quoteKlineTf.value),
        ensureQuoteMoneyFlow(quoteKlineTf.value),
      ])
    }
  } else if (panel === 'nine-turn') {
    await loadWorkbenchSection('nine_turn')
  } else if (panel === 'scores') {
    await loadWorkbenchSection('scores')
  } else if (panel === 'financial') {
    await loadWorkbenchSection('financials')
  } else if (panel === 'valuation') {
    await loadWorkbenchSection('valuation')
  } else if (panel === 'shareholders') {
    await loadWorkbenchSection('shareholders')
  } else if (panel === 'analysis') {
    await Promise.all([
      loadWorkbenchSection('ai'),
      loadWorkbenchSection('trading'),
    ])
  }
})

watch(quoteKlineTf, (tf) => {
  void Promise.all([
    ensureQuoteKline(tf),
    ensureQuoteMoneyFlow(tf),
  ])
})

function selectSearchCandidate(item) {
  if (!item) return
  const symbol = item.symbol || item.ts_code
  if (!symbol) return
  directSymbol.value = symbol
  loadSymbol(symbol)
}

function submitDirectSymbol() {
  loadSymbol(directSymbol.value)
}

async function loadSymbol(symbol) {
  const clean = String(symbol || '').trim()
  if (!clean) return
  directSymbol.value = clean
  const optimistic = createWorkbenchShell(clean)
  payload.value = optimistic
  loading.value = true
  error.value = ''
  try {
    clearAnalysisPolling()
    analysisSubmitStatus.value = ''
    analysisSubmitError.value = ''
    sectionLoaded.value = { quote: false, nine_turn: false, scores: false, financials: false, valuation: false, ai: false, trading: false, shareholders: false }
    sectionLoading.value = { quote: false, nine_turn: false, scores: false, financials: false, valuation: false, ai: false, trading: false, shareholders: false }
    quoteKlineLoading.value = { '1d': false, '1w': false, '1m': false }
    moneyFlowLoading.value = { '1d': false, '1w': false, '1m': false }
    holderNumberTableExpanded.value = false
    shareholderTradesExpanded.value = false
    shareFloatExpanded.value = false
    const workbench = await getStockWorkbench(clean)
    if (canonicalSymbol(directSymbol.value) !== canonicalSymbol(clean)) return
    payload.value = {
      ...optimistic,
      ...workbench,
      data_status: {
        ...(optimistic.data_status || {}),
        ...(workbench?.data_status || {}),
        sections: {
          ...(optimistic.data_status?.sections || {}),
          ...(workbench?.data_status?.sections || {}),
        },
      },
    }
    rememberRecentStock({
      symbol: workbench?.stock?.symbol || workbench?.symbol || clean,
      name: workbench?.stock?.name || workbench?.stock?.stock_name || '',
    })
    sectionLoaded.value = {
      quote: Boolean(workbench?.quote),
      nine_turn: false,
      scores: Boolean(workbench?.score),
      financials: false,
      valuation: false,
      ai: Boolean(workbench?.deep_analysis),
      trading: false,
      shareholders: false,
    }
    incomeRows.value = []
    indicatorRows.value = []
    balanceRows.value = []
    cashflowRows.value = []
    earnings.value = {}
    tradingContext.value = {}
    valuationData.value = {}
    shareholderData.value = {}
    disposeShareholderCharts()
    queueInitialSectionLoads({ deferQuote: true })
    await nextTick()
    renderRadar()
  } catch (e) {
    if (canonicalSymbol(directSymbol.value) === canonicalSymbol(clean)) {
      error.value = e?.message || '股票工作台数据加载失败'
    }
  } finally {
    if (canonicalSymbol(directSymbol.value) === canonicalSymbol(clean)) {
      loading.value = false
    }
  }
}

function createWorkbenchShell(symbol) {
  const normalized = String(symbol || '').trim().toUpperCase()
  return {
    symbol: normalized,
    stock: { symbol: normalized },
    quote: null,
    score: null,
    deep_analysis: null,
    data_status: {
      stock_found: true,
      quote_found: false,
      score_found: false,
      deep_analysis_found: false,
      quote_date: '',
      score_date: '',
      analysis_created_at: '',
      sections: {},
    },
  }
}

function queueInitialSectionLoads(options = {}) {
  const tasks = []
  if (options.deferQuote) {
    scheduleIdleSectionLoad('quote')
    if (activePanel.value === 'quote' && quoteKlineTf.value !== '1d') {
      scheduleIdleTask(() => {
        void Promise.all([
          ensureQuoteKline(quoteKlineTf.value),
          ensureQuoteMoneyFlow(quoteKlineTf.value),
        ])
      })
    }
  } else {
    tasks.push(loadWorkbenchSection('quote', { force: true }))
  }
  if (activePanel.value === 'scores') {
    tasks.push(loadWorkbenchSection('scores', { force: true }))
  } else if (activePanel.value === 'nine-turn') {
    tasks.push(loadWorkbenchSection('nine_turn', { force: true }))
  } else if (activePanel.value === 'financial') {
    tasks.push(loadWorkbenchSection('financials', { force: true }))
  } else if (activePanel.value === 'valuation') {
    tasks.push(loadWorkbenchSection('valuation', { force: true }))
  } else if (activePanel.value === 'shareholders') {
    tasks.push(loadWorkbenchSection('shareholders', { force: true }))
  } else if (activePanel.value === 'analysis') {
    tasks.push(loadWorkbenchSection('ai', { force: true }))
    tasks.push(loadWorkbenchSection('trading', { force: true }))
  }
  if (tasks.length) {
    Promise.all(tasks).catch((e) => {
      console.warn('load initial stock workbench sections failed', e)
    })
  }
}

function scheduleIdleSectionLoad(section) {
  scheduleIdleTask(() => {
    loadWorkbenchSection(section, { force: true }).catch((e) => {
      console.warn(`load deferred stock workbench section ${section} failed`, e)
    })
  })
}

function scheduleIdleTask(callback) {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(callback, { timeout: 800 })
    return
  }
  window.setTimeout(callback, 80)
}

function loadRecentSymbols() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_SYMBOLS_KEY) || '[]')
    recentStocks.value = Array.isArray(parsed)
      ? parsed.map(normalizeRecentStock).filter((item) => item.symbol).slice(0, 8)
      : []
  } catch (_) {
    recentStocks.value = []
  }
}

function rememberRecentStock(stockItem) {
  const item = normalizeRecentStock(stockItem)
  if (!item.symbol) return
  const next = [
    item,
    ...recentStocks.value.filter((row) => canonicalSymbol(row.symbol) !== canonicalSymbol(item.symbol)),
  ].slice(0, 8)
  recentStocks.value = next
  localStorage.setItem(RECENT_SYMBOLS_KEY, JSON.stringify(next))
}

function normalizeRecentStock(value) {
  if (typeof value === 'string') {
    return { symbol: value.trim().toUpperCase(), name: '' }
  }
  if (!value || typeof value !== 'object') {
    return { symbol: '', name: '' }
  }
  return {
    symbol: String(value.symbol || value.ts_code || '').trim().toUpperCase(),
    name: String(value.name || value.stock_name || '').trim(),
  }
}

function clearRecentSymbols() {
  recentStocks.value = []
  localStorage.removeItem(RECENT_SYMBOLS_KEY)
}

async function loadWorkbenchSection(section, options = {}) {
  const force = Boolean(options.force)
  const symbol = stockSymbol.value && stockSymbol.value !== '-' ? stockSymbol.value : directSymbol.value
  if (!symbol || !payload.value) return
  if (!force && sectionLoaded.value[section]) return

  sectionLoading.value = { ...sectionLoading.value, [section]: true }
  try {
    if (section === 'quote') {
      const data = await getStockWorkbenchQuote(symbol)
      if (!isCurrentWorkbenchSymbol(symbol)) return
      const dailyMoneyFlowHistory = Array.isArray(data?.money_flow_history) ? data.money_flow_history : []
      mergeWorkbenchSection('quote', data, {
        quote: data?.quote || null,
        daily_quotes: Array.isArray(data?.daily_quotes) ? data.daily_quotes : [],
        daily_basic: data?.daily_basic || null,
        money_flow: data?.money_flow || null,
        money_flow_history: dailyMoneyFlowHistory,
        money_flow_history_by_tf: {
          ...(payload.value?.money_flow_history_by_tf || {}),
          '1d': dailyMoneyFlowHistory,
        },
        money_flow_summary: data?.money_flow_summary || {},
      })
    } else if (section === 'nine_turn') {
      const data = await getStockWorkbenchNineTurn(symbol)
      if (!isCurrentWorkbenchSymbol(symbol)) return
      mergeWorkbenchSection('nine_turn', data, {
        nine_turn_daily_quotes: Array.isArray(data?.daily_quotes) ? data.daily_quotes : [],
        nine_turn_rows: Array.isArray(data?.nine_turn_rows) ? data.nine_turn_rows : [],
        nine_turn_signals: Array.isArray(data?.signals) ? data.signals : [],
        latest_nine_turn_signal: data?.latest_signal || null,
      })
    } else if (section === 'scores') {
      const data = await getStockWorkbenchScores(symbol)
      if (!isCurrentWorkbenchSymbol(symbol)) return
      mergeWorkbenchSection('scores', data, {
        score: data?.score || null,
        score_history: Array.isArray(data?.score_history) ? data.score_history : [],
      })
      await nextTick()
      renderRadar()
    } else if (section === 'financials') {
      const data = await getStockWorkbenchFinancials(symbol)
      if (!isCurrentWorkbenchSymbol(symbol)) return
      incomeRows.value = Array.isArray(data?.income) ? data.income : []
      indicatorRows.value = Array.isArray(data?.indicators) ? data.indicators : []
      balanceRows.value = Array.isArray(data?.balance) ? data.balance : []
      cashflowRows.value = Array.isArray(data?.cashflow) ? data.cashflow : []
      earnings.value = data?.earnings || {}
      mergeWorkbenchSection('financials', data, {})
    } else if (section === 'valuation') {
      const data = await getStockWorkbenchValuation(symbol)
      if (!isCurrentWorkbenchSymbol(symbol)) return
      valuationData.value = data || {}
      mergeWorkbenchSection('valuation', data, {
        valuation: data || {},
      })
    } else if (section === 'ai') {
      const data = await getStockWorkbenchAi(symbol)
      if (!isCurrentWorkbenchSymbol(symbol)) return
      mergeWorkbenchSection('ai', data, {
        deep_analysis: data?.deep_analysis || null,
        analysis_history: Array.isArray(data?.analysis_history) ? data.analysis_history : [],
        analysis_history_total: data?.analysis_history_total || 0,
        evaluation_summary: data?.evaluation_summary || {},
      })
    } else if (section === 'trading') {
      const data = await getStockWorkbenchTrading(symbol)
      if (!isCurrentWorkbenchSymbol(symbol)) return
      tradingContext.value = data || {}
      mergeWorkbenchSection('trading', data, {})
    } else if (section === 'shareholders') {
      const data = await getStockWorkbenchShareholders(symbol)
      if (!isCurrentWorkbenchSymbol(symbol)) return
      shareholderData.value = data || {}
      mergeWorkbenchSection('shareholders', data, {})
      await nextTick()
      renderShareholderCharts()
    }
    sectionLoaded.value = { ...sectionLoaded.value, [section]: true }
  } catch (e) {
    console.warn(`load stock workbench section ${section} failed`, e)
  } finally {
    if (isCurrentWorkbenchSymbol(symbol)) {
      sectionLoading.value = { ...sectionLoading.value, [section]: false }
    }
  }
}

function refreshValuationSection() {
  loadWorkbenchSection('valuation', { force: true }).catch((e) => {
    console.warn('refresh valuation section failed', e)
  })
}

function openValuationHelp(topic) {
  valuationHelpTopic.value = topic === 'dcf' ? 'dcf' : 'ddm'
  valuationHelpOpen.value = true
}

async function ensureQuoteKline(tf = quoteKlineTf.value) {
  if (!payload.value) return
  if (tf === '1d') {
    if (!quoteDailyRows.value.length) await loadWorkbenchSection('quote')
    return
  }
  if (tf === '1w' && quoteWeeklyRows.value.length) return
  if (tf === '1m' && quoteMonthlyRows.value.length) return
  if (quoteKlineLoading.value[tf]) return

  const symbol = stockSymbol.value && stockSymbol.value !== '-' ? stockSymbol.value : directSymbol.value
  if (!symbol) return
  quoteKlineLoading.value = { ...quoteKlineLoading.value, [tf]: true }
  try {
    const data = await getStockWorkbenchKline(symbol, tf)
    if (!isCurrentWorkbenchSymbol(symbol)) return
    const rows = Array.isArray(data?.rows) ? data.rows : []
    payload.value = {
      ...(payload.value || {}),
      ...(tf === '1w' ? { weekly_quotes: rows } : {}),
      ...(tf === '1m' ? { monthly_quotes: rows } : {}),
      data_status: {
        ...(payload.value?.data_status || {}),
        sections: {
          ...(payload.value?.data_status?.sections || {}),
          [`kline_${tf}`]: data?.data_status || {},
        },
      },
    }
  } catch (e) {
    console.warn(`load stock workbench kline ${tf} failed`, e)
  } finally {
    if (isCurrentWorkbenchSymbol(symbol)) {
      quoteKlineLoading.value = { ...quoteKlineLoading.value, [tf]: false }
    }
  }
}

async function ensureQuoteMoneyFlow(tf = quoteKlineTf.value) {
  if (!payload.value) return
  if (tf === '1d') {
    if (!moneyFlowHistory.value.length) await loadWorkbenchSection('quote')
    return
  }
  const existing = payload.value?.money_flow_history_by_tf?.[tf]
  if (Array.isArray(existing) && existing.length) return
  if (moneyFlowLoading.value[tf]) return

  const symbol = stockSymbol.value && stockSymbol.value !== '-' ? stockSymbol.value : directSymbol.value
  if (!symbol) return
  moneyFlowLoading.value = { ...moneyFlowLoading.value, [tf]: true }
  try {
    const data = await getStockWorkbenchMoneyFlow(symbol, tf)
    if (!isCurrentWorkbenchSymbol(symbol)) return
    const rows = Array.isArray(data?.history) ? data.history : []
    payload.value = {
      ...(payload.value || {}),
      money_flow: payload.value?.money_flow || data?.latest || null,
      money_flow_summary: payload.value?.money_flow_summary || data?.summary || {},
      money_flow_history_by_tf: {
        ...(payload.value?.money_flow_history_by_tf || {}),
        [tf]: rows,
      },
      data_status: {
        ...(payload.value?.data_status || {}),
        sections: {
          ...(payload.value?.data_status?.sections || {}),
          [`money_flow_${tf}`]: data?.data_status || {},
        },
      },
    }
  } catch (e) {
    console.warn(`load stock workbench money flow ${tf} failed`, e)
  } finally {
    if (isCurrentWorkbenchSymbol(symbol)) {
      moneyFlowLoading.value = { ...moneyFlowLoading.value, [tf]: false }
    }
  }
}

function mergeWorkbenchSection(section, data, updates) {
  const status = data?.data_status || {}
  const nextStatus = {
    ...(payload.value?.data_status || {}),
    sections: {
      ...(payload.value?.data_status?.sections || {}),
      [section]: status,
    },
  }
  if (section === 'quote') {
    nextStatus.quote_found = Boolean(updates.quote)
    nextStatus.quote_date = status.as_of || nextStatus.quote_date
  } else if (section === 'nine_turn') {
    nextStatus.nine_turn_found = Boolean(status.found)
    nextStatus.nine_turn_date = status.as_of || nextStatus.nine_turn_date
  } else if (section === 'scores') {
    nextStatus.score_found = Boolean(updates.score)
    nextStatus.score_date = status.as_of || nextStatus.score_date
  } else if (section === 'financials') {
    nextStatus.financials_found = Boolean(status.found)
    nextStatus.financials_date = status.as_of || nextStatus.financials_date
  } else if (section === 'valuation') {
    nextStatus.valuation_found = Boolean(status.found)
    nextStatus.valuation_date = status.as_of || nextStatus.valuation_date
  } else if (section === 'ai') {
    nextStatus.deep_analysis_found = Boolean(updates.deep_analysis)
    nextStatus.analysis_created_at = status.as_of || nextStatus.analysis_created_at
  } else if (section === 'trading') {
    nextStatus.trading_found = Boolean(status.found)
    nextStatus.trading_date = status.as_of || nextStatus.trading_date
  }

  payload.value = {
    ...(payload.value || {}),
    ...updates,
    data_status: nextStatus,
  }
}

function clearAnalysisPolling() {
  if (analysisPollTimer) {
    clearInterval(analysisPollTimer)
    analysisPollTimer = null
  }
}

function selectAnalysisHistory(item) {
  if (!item) return
  payload.value = {
    ...(payload.value || {}),
    deep_analysis: item,
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
  const token = localStorage.getItem('access_token')
  try {
    const res = await axios.post(
      '/api/analyze/deep-analysis',
      { symbol, priority: 30, analysis_mode: analysisMode.value },
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!res.data?.success) {
      analysisSubmitError.value = res.data?.message || '提交失败'
      analysisSubmitting.value = false
      return
    }
    const taskId = res.data.task_id
    analysisSubmitStatus.value = `已提交，前方 ${res.data.queue_ahead ?? '?'} 个任务。${res.data.wait_hint || '分析中…'}`
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
        const poll = await axios.get(`/api/analyze/task/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const status = poll.data?.status
        if (status === 'completed') {
          clearAnalysisPolling()
          analysisSubmitting.value = false
          analysisSubmitStatus.value = '分析完成，已更新当前工作台。'
          const analysis = poll.data?.analysis || {}
          const nextDeepAnalysis = {
            id: taskId,
            symbol,
            stock_name: analysis.stock_name || stockName.value || '',
            analysis_mode: poll.data?.analysis_mode || analysis.analysis_mode || analysisMode.value,
            analysis,
            model: poll.data?.model,
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
          analysisSubmitError.value = poll.data?.error || '分析失败'
        } else if (status === 'pending') {
          analysisSubmitStatus.value = `排队中，前方 ${poll.data?.queue_ahead ?? '?'} 个任务。${poll.data?.wait_hint || '预计等待时间计算中'}`
        } else if (status === 'processing') {
          analysisSubmitStatus.value = poll.data?.wait_hint || '正在分析，LLM 响应时间可能有波动'
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

function renderRadar() {
  if (!radarRef.value || !scoreItems.value.length) return
  if (!radarChart) radarChart = echarts.init(radarRef.value)
  const items = scoreItems.value.filter((item) => item.score != null)
  radarChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    radar: {
      indicator: items.map((item) => ({ name: item.label, max: 100 })),
      radius: '62%',
      splitLine: { lineStyle: { color: 'rgba(148,163,184,.35)' } },
      splitArea: { areaStyle: { color: ['rgba(15,23,42,.25)', 'rgba(30,41,59,.35)'] } },
      axisName: { color: '#cbd5e1' },
      axisLine: { lineStyle: { color: 'rgba(148,163,184,.35)' } },
    },
    series: [{
      type: 'radar',
      data: [{
        name: '评分',
        value: items.map((item) => Number(item.score || 0)),
        areaStyle: { color: 'rgba(96,165,250,.25)' },
        lineStyle: { color: '#60a5fa', width: 2 },
        itemStyle: { color: '#93c5fd' },
      }],
    }],
  })
  radarChart.resize()
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

function formatDetail(detail) {
  if (!detail || !Object.keys(detail).length) return '暂无详情'
  return JSON.stringify(detail, null, 2)
}

function scorePercent(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

function scoreRowComposite(row) {
  const composite = row?.composite_score
  if (composite && typeof composite === 'object') {
    if (composite.balanced != null) return composite.balanced
    const firstKey = Object.keys(composite).find((key) => composite[key] != null)
    return firstKey ? composite[firstKey] : null
  }
  return composite
}

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function firstFinite(values) {
  for (const value of values) {
    const n = toNumber(value)
    if (n != null) return n
  }
  return null
}

function reportYear(period) {
  const text = String(period || '')
  const year = Number(text.slice(0, 4))
  return Number.isFinite(year) ? year : null
}

function reportQuarter(period) {
  const suffix = String(period || '').slice(4)
  return {
    '0331': 1,
    '0630': 2,
    '0930': 3,
    '1231': 4,
  }[suffix] || null
}

function diffOrNull(current, previous) {
  const a = toNumber(current)
  const b = toNumber(previous)
  if (a == null || b == null) return null
  return a - b
}

function calcYoy(current, previous) {
  const a = toNumber(current)
  const b = toNumber(previous)
  if (a == null || b == null || b === 0) return null
  return ((a - b) / Math.abs(b)) * 100
}

function reportRcTargetRange(row = {}) {
  const minPrice = toNumber(row.min_price)
  const maxPrice = toNumber(row.max_price)
  if (minPrice != null && maxPrice != null && minPrice > 0 && maxPrice > 0) {
    return minPrice === maxPrice
      ? `目标价 ${fmtNumber(minPrice)}元`
      : `目标价 ${fmtNumber(minPrice)}-${fmtNumber(maxPrice)}元`
  }
  if (maxPrice != null && maxPrice > 0) return `目标价 ${fmtNumber(maxPrice)}元`
  if (minPrice != null && minPrice > 0) return `目标价 ${fmtNumber(minPrice)}元`
  return ''
}

function blankDash(value) {
  const text = String(value ?? '').trim()
  return text || '-'
}

function statementPeriod(row = {}) {
  return blankDash(row.end_date || row.period || row.report_date)
}

function statementReportTypeLabel(value) {
  const text = String(value ?? '').trim()
  if (text === '1') return '合并报表（report_type=1）'
  if (text === '2') return '单季度报表（report_type=2）'
  return text ? `report_type=${text}` : '未标注口径'
}

function fmtNullableNumber(value, digits = 2) {
  const n = toNumber(value)
  return n == null ? '-' : n.toFixed(digits)
}

function fmtNullablePct(value) {
  const n = toNumber(value)
  return n == null ? '-' : `${n.toFixed(2)}%`
}

function fmtWanAmount(value) {
  const n = toNumber(value)
  if (n == null) return '-'
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(2)}亿`
  return `${n.toFixed(2)}万`
}

function ratioPct(numerator, denominator) {
  const a = toNumber(numerator)
  const b = toNumber(denominator)
  if (a == null || b == null || b === 0) return null
  return (a / Math.abs(b)) * 100
}

function sumFinite(...values) {
  const numbers = values.map(toNumber).filter((value) => value != null)
  if (!numbers.length) return null
  return numbers.reduce((sum, value) => sum + value, 0)
}

function canonicalSymbol(value) {
  return String(value || '').trim().toUpperCase().split('.')[0]
}

function isCurrentWorkbenchSymbol(symbol) {
  const current = stockSymbol.value && stockSymbol.value !== '-' ? stockSymbol.value : directSymbol.value
  return canonicalSymbol(symbol) === canonicalSymbol(current)
}

function fmtNumber(value, digits = 2, suffix = '') {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${n.toFixed(digits)}${suffix}`
}

function fmtPct(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
}

function fmtPctPlain(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${n.toFixed(1)}%`
}

function fmtPctFromRatio(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${(n * 100).toFixed(2)}%`
}

function valuationScenarioLabel(value) {
  return {
    conservative: '保守',
    base: '中性',
    optimistic: '乐观',
  }[value] || value || '-'
}

function valuationRelativeLabel(value) {
  return {
    below_own_history: '低于自身历史',
    near_own_history_midrange: '接近历史中枢',
    above_own_history: '高于自身历史',
    insufficient_data: '样本不足',
  }[value] || value || '-'
}

function valuationMultipleWithPercentile(field, suffix = '') {
  const value = fmtNumber(valuationCurrentMultiples.value?.[field], 2, suffix)
  const pct = valuationPercentiles.value?.[field]
  if (pct == null) return value
  return `${value} / P${Number(pct).toFixed(0)}`
}

function fmtAmount(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(2)}亿`
  return `${n.toFixed(2)}万`
}

function fmtKlineAmount(row) {
  const n = Number(row?.amount)
  if (!Number.isFinite(n)) return '-'
  const unit = String(row?.amount_unit || 'qian_yuan').toLowerCase()
  if (unit === 'yuan') return `${(n / 100000000).toFixed(2)}亿`
  if (unit === 'wan_yuan') return `${(n / 10000).toFixed(2)}亿`
  return `${(n / 100000).toFixed(2)}亿`
}

function fmtStatementAmount(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  if (Math.abs(n) >= 100000000) return `${(n / 100000000).toFixed(2)}亿`
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(2)}万`
  return `${n.toFixed(2)}元`
}

function valueClass(value) {
  const n = Number(value)
  return n > 0 ? 'is-up' : n < 0 ? 'is-down' : ''
}

function nineturnSignalClass(signal) {
  if (!signal) return ''
  return signal.direction === 'up' ? 'is-up' : signal.direction === 'down' ? 'is-down' : ''
}

function formatCheck(value) {
  if (value === true) return '通过'
  if (value === false) return '未通过'
  return '不适用'
}

function fmtShares(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  if (Math.abs(n) >= 100000000) return `${(n / 100000000).toFixed(2)}亿股`
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(2)}万股`
  return `${n.toFixed(0)}股`
}

function fmtSignedShares(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  const absText = fmtShares(Math.abs(n))
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${absText}`
}

function signedPctPoint(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}pct`
}

function signedRelativePct(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
}

function top10RatioChangeText(row) {
  if (!row) return '-'
  const pointText = signedPctPoint(row.hold_ratio_chg)
  const relText = signedRelativePct(row.hold_ratio_rel_chg_pct)
  if (pointText === '-' && relText === '-') return '-'
  if (relText === '-') return `占比 ${pointText}`
  if (pointText === '-') return `相对 ${relText}`
  return `占比 ${pointText}（相对 ${relText}）`
}

function top10ChangeLabel(value) {
  const labels = {
    increased: '增持',
    decreased: '减持',
    new: '新进',
    exited: '退出',
    unchanged: '不变',
  }
  return labels[value] || '变化未知'
}

// 股东户数下降视为筹码集中（利多→红），上升视为分散（利空→绿）。
function holderTrendClass(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return ''
  return n < 0 ? 'is-up' : 'is-down'
}

function holderNumQoq(idx) {
  const rows = shHolderNumbers.value
  const curr = Number(rows[idx]?.holder_num)
  const prev = Number(rows[idx + 1]?.holder_num)
  if (!Number.isFinite(curr) || !Number.isFinite(prev) || prev === 0) return null
  return (curr - prev) / Math.abs(prev) * 100
}

function inDeLabel(value) {
  return value === 'IN' ? '增持' : value === 'DE' ? '减持' : (value || '-')
}

function isFutureDate(value) {
  const s = String(value || '').replace(/-/g, '')
  if (s.length !== 8) return false
  const today = new Date()
  const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  return s > ymd
}

function pctClass(value) {
  return valueClass(value)
}

async function onOpenWorkbench(e) {
  const detail = e?.detail || {}
  const symbol = typeof detail === 'string' ? detail : detail.symbol
  if (symbol) {
    directSymbol.value = symbol
    await loadSymbol(symbol)
  }
}

onMounted(() => {
  loadRecentSymbols()
  window.addEventListener('stock-workbench:set-symbol', onOpenWorkbench)
})

onBeforeUnmount(() => {
  window.removeEventListener('stock-workbench:set-symbol', onOpenWorkbench)
  clearAnalysisPolling()
  if (radarChart) {
    radarChart.dispose()
    radarChart = null
  }
  disposeShareholderCharts()
})
</script>

<style scoped>
.stock-workbench {
  color: #e2e8f0;
  padding: 6px;
}
.workbench-search,
.hero-card,
.workbench-card,
.empty-state {
  background: rgba(15, 23, 42, 0.76);
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 18px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
}
.workbench-search {
  align-items: center;
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 460px);
  margin-bottom: 18px;
  padding: 22px;
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
.workbench-search p:not(.eyebrow) {
  color: #94a3b8;
  margin: 7px 0 0;
}
.stock-input-panel {
  display: grid;
  gap: 12px;
}
.stock-code-row {
  align-items: center;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr) auto;
}
.stock-code-input {
  background: rgba(255,255,255,.06);
  border-radius: 12px;
}
.quick-symbols {
  align-items: center;
  color: #94a3b8;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 13px;
}
.quick-symbols button {
  background: rgba(96, 165, 250, .14);
  border: 1px solid rgba(96, 165, 250, .32);
  border-radius: 999px;
  color: #bfdbfe;
  cursor: pointer;
  padding: 5px 10px;
}
.quick-symbols button:hover {
  background: rgba(96, 165, 250, .24);
}
.quick-symbols .recent-stock-btn {
  align-items: flex-start;
  border-radius: 12px;
  display: inline-flex;
  flex-direction: column;
  gap: 1px;
  line-height: 1.2;
  padding: 6px 10px;
}
.recent-stock-btn strong {
  color: #e0f2fe;
  font-size: 13px;
}
.recent-stock-btn small {
  color: #93c5fd;
  font-size: 11px;
  opacity: .88;
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
.hero-card {
  display: grid;
  gap: 22px;
  grid-template-columns: minmax(0, 1fr) auto;
  margin-bottom: 16px;
  padding: 24px;
}
.hero-main h1 {
  color: #f8fafc;
  font-size: 34px;
}
.hero-main h1 span {
  color: #94a3b8;
  font-size: 20px;
  font-weight: 500;
}
.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.hero-tags span,
.summary-meta span {
  background: rgba(96, 165, 250, .12);
  border: 1px solid rgba(96, 165, 250, .24);
  border-radius: 999px;
  color: #bfdbfe;
  padding: 5px 10px;
}
.section-status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}
.section-status-chip {
  background: rgba(34, 197, 94, .10);
  border: 1px solid rgba(34, 197, 94, .30);
  border-radius: 14px;
  color: #dcfce7;
  cursor: pointer;
  display: grid;
  gap: 2px;
  min-width: 116px;
  padding: 9px 12px;
  text-align: left;
}
.section-status-chip:hover {
  background: rgba(34, 197, 94, .18);
}
.section-status-chip.is-missing {
  background: rgba(148, 163, 184, .10);
  border-color: rgba(148, 163, 184, .24);
  color: #cbd5e1;
}
.section-status-chip.is-stale {
  background: rgba(245, 158, 11, .12);
  border-color: rgba(245, 158, 11, .35);
  color: #fde68a;
}
.section-status-chip span {
  font-size: 12px;
  opacity: .86;
}
.section-status-chip strong {
  font-size: 14px;
}
.section-status-chip small {
  color: inherit;
  font-size: 11px;
  opacity: .72;
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
.hero-metrics {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, 130px);
}
.hero-metrics div,
.status-grid div,
.financial-metrics div {
  background: rgba(30, 41, 59, .78);
  border-radius: 14px;
  padding: 14px;
}
.hero-metrics small,
.status-grid span,
.financial-metrics span {
  color: #94a3b8;
  display: block;
  font-size: 12px;
}
.hero-metrics strong,
.status-grid strong,
.financial-metrics strong {
  color: #f8fafc;
  display: block;
  font-size: 22px;
  margin: 4px 0;
}
.price-change-line {
  cursor: help;
  display: block;
  font-size: 12px;
  line-height: 1.35;
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
.panel-grid--overview {
  grid-template-columns: minmax(0, 1.1fr) minmax(300px, .9fr);
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
.valuation-help-card {
  background: #0f172a;
  color: #e2e8f0;
}
.valuation-help-content {
  color: #cbd5e1;
  line-height: 1.7;
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
.quote-kline-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}
.quote-kline-tf {
  background: rgba(15, 23, 42, .72);
  border: 1px solid rgba(148, 163, 184, .18);
  border-radius: 999px;
  display: inline-flex;
  gap: 4px;
  padding: 3px;
}
.quote-kline-tf button {
  background: transparent;
  border: 0;
  border-radius: 999px;
  color: #94a3b8;
  cursor: pointer;
  font-size: 12px;
  padding: 5px 10px;
}
.quote-kline-tf button:hover {
  color: #dbeafe;
}
.quote-kline-tf button.on {
  background: rgba(37, 99, 235, .88);
  color: #fff;
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
.score-radar {
  height: 360px;
  min-height: 360px;
}
.financial-mode-toggle {
  margin: 14px 0 10px;
}
.financial-mode-toggle :deep(.v-btn) {
  color: #cbd5e1;
}
.financial-mode-toggle :deep(.v-btn--active) {
  color: #f8fafc;
}
.nine-turn-summary {
  background: rgba(30, 41, 59, .62);
  border: 1px solid rgba(148, 163, 184, .18);
  border-radius: 14px;
  padding: 16px;
}
.nine-turn-summary strong {
  display: block;
  font-size: 22px;
  margin-bottom: 8px;
}
.nine-turn-summary span,
.nine-turn-summary p {
  color: #cbd5e1;
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
}
.nine-turn-rules {
  display: grid;
  gap: 10px;
}
.nine-turn-rules span {
  background: rgba(15, 23, 42, .58);
  border: 1px solid rgba(148, 163, 184, .16);
  border-radius: 12px;
  color: #cbd5e1;
  font-size: 13px;
  line-height: 1.5;
  padding: 10px 12px;
}
.quality-card-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}
.quality-card {
  background: rgba(30, 41, 59, .62);
  border: 1px solid rgba(148, 163, 184, .18);
  border-radius: 14px;
  padding: 14px;
}
.quality-card span {
  color: #94a3b8;
  display: block;
  font-size: 12px;
  margin-bottom: 6px;
}
.quality-card strong {
  color: #f8fafc;
  display: block;
  font-size: 16px;
  margin-bottom: 8px;
}
.quality-card small {
  color: #cbd5e1;
  line-height: 1.5;
}
.quality-card--good {
  border-color: rgba(34, 197, 94, .35);
}
.quality-card--neutral {
  border-color: rgba(234, 179, 8, .32);
}
.quality-card--warn {
  border-color: rgba(239, 68, 68, .35);
}
.summary-line {
  color: #f8fafc;
  font-size: 18px;
  line-height: 1.7;
}
.summary-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}
.analysis-summary ul {
  color: #cbd5e1;
  margin: 12px 0 0;
  padding-left: 18px;
}
.analysis-points-list {
  color: #cbd5e1;
  margin: 12px 0 0;
  padding-left: 18px;
  line-height: 1.7;
}
.status-grid,
.financial-metrics {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.score-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}
.score-card {
  background: rgba(30, 41, 59, .72);
  border: 1px solid rgba(148, 163, 184, .16);
  border-radius: 14px;
  padding: 16px;
}
.score-card__head {
  align-items: center;
  display: flex;
  justify-content: space-between;
}
.score-card__head strong {
  color: #93c5fd;
  font-size: 24px;
}
.score-history-block {
  margin-top: 22px;
}
.score-history-block h4 {
  color: #e2e8f0;
  margin: 0 0 12px;
}
.score-bar {
  background: rgba(148, 163, 184, .18);
  border-radius: 999px;
  height: 8px;
  margin: 12px 0;
  overflow: hidden;
}
.score-bar i {
  background: linear-gradient(90deg, #38bdf8, #818cf8);
  display: block;
  height: 100%;
}
details summary {
  color: #bfdbfe;
  cursor: pointer;
}
pre {
  background: rgba(2, 6, 23, .68);
  border-radius: 10px;
  color: #cbd5e1;
  margin: 10px 0 0;
  max-height: 360px;
  overflow: auto;
  padding: 12px;
  white-space: pre-wrap;
}
.quote-table-wrap {
  margin-top: 14px;
  overflow-x: auto;
}
.quote-details {
  background: rgba(15, 23, 42, .36);
  border: 1px solid rgba(148, 163, 184, .14);
  border-radius: 12px;
  margin-top: 14px;
  padding: 10px 12px;
}
.quote-details summary {
  color: #bfdbfe;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
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
.partial-kline-tag {
  background: rgba(96, 165, 250, .14);
  border: 1px solid rgba(96, 165, 250, .34);
  border-radius: 999px;
  color: #bfdbfe;
  display: inline-flex;
  font-size: 11px;
  margin-left: 6px;
  padding: 1px 6px;
}
.report-rc-table {
  min-width: 1280px;
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
.financial-raw-sections {
  display: grid;
  gap: 12px;
}
.financial-raw-sections details {
  background: rgba(30, 41, 59, .46);
  border: 1px solid rgba(148, 163, 184, .14);
  border-radius: 12px;
  padding: 12px 14px;
}
.financial-raw-sections summary {
  color: #bfdbfe;
  cursor: pointer;
  font-weight: 700;
}
.financial-raw-table {
  min-width: 860px;
}
.financial-report-groups {
  display: grid;
  gap: 16px;
}
.financial-report-group h4 {
  color: #e2e8f0;
  font-size: 14px;
  margin: 4px 0 0;
}
.report-title-cell {
  max-width: 360px;
  min-width: 260px;
  overflow: hidden;
  text-align: left !important;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.event-list {
  display: grid;
  gap: 10px;
}
.event-item {
  align-items: center;
  background: rgba(30, 41, 59, .56);
  border: 1px solid rgba(148, 163, 184, .14);
  border-radius: 12px;
  display: grid;
  gap: 10px;
  grid-template-columns: 90px minmax(0, 1fr) 110px;
  padding: 12px 14px;
}
.event-item span {
  color: #93c5fd;
  font-size: 12px;
}
.event-item strong {
  color: #f8fafc;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.event-item small {
  color: #94a3b8;
  text-align: right;
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
  .workbench-search,
  .hero-card,
  .panel-grid,
  .panel-grid--overview {
    grid-template-columns: 1fr;
  }
  .hero-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .stock-code-row {
    grid-template-columns: 1fr;
  }
}
</style>
