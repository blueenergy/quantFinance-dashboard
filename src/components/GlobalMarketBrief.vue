<template>
  <div class="global-brief-card">
    <div class="card-header">
      <div class="header-main">
        <h3>🌍 隔夜全球市场联动分析</h3>
        <span v-if="analysisTimestamp" class="header-time">
          ({{ formatDateTime(analysisTimestamp) }} 分析)
        </span>
        <v-btn 
          :icon="mdiRefresh" 
          variant="text" 
          size="x-small" 
          color="grey"
          :disabled="refreshing || !canTriggerGlobalAnalysis"
          :loading="refreshing"
          @click="refreshAnalysis"
          class="ml-1"
        ></v-btn>
        <span v-if="!canTriggerGlobalAnalysis" class="pro-hint">专业版可用</span>
      </div>
      <div v-if="brief" class="sentiment-indicator" :class="getSentimentClass(brief.sentiment_score)">
        <span class="score">{{ brief.sentiment_score }}</span>
        <span class="label">{{ brief.sentiment_mood }}</span>
      </div>
    </div>

    <div class="card-content">
      <div v-if="loading" class="loading-state">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
        <p>正在同步全球市场数据与AI分析...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <v-alert type="error" variant="tonal" density="compact">
          {{ error }}
        </v-alert>
      </div>

      <div v-if="brief" class="brief-body">

        <div
          v-if="brief.international_shock_score !== undefined || brief.domestic_hedge_score !== undefined || brief.net_impact_score !== undefined"
          class="score-strip-wrap"
        >
          <div class="score-strip-header">
            <span class="score-strip-title">📐 量化对冲分</span>
            <v-btn
              size="x-small"
              variant="text"
              color="primary"
              :prepend-icon="mdiHelpCircleOutline"
              @click="showScoreHelp = !showScoreHelp"
            >
              {{ showScoreHelp ? '收起解读' : '解读' }}
            </v-btn>
          </div>

          <v-expand-transition>
            <div v-if="showScoreHelp" class="score-help-panel">
              <p class="score-help-line">
                <strong>国际冲击分</strong> {{ scoreInterpretation.international.value }}（{{ scoreInterpretation.international.level }}）：
                {{ scoreInterpretation.international.text }}
              </p>
              <p class="score-help-line">
                <strong>国内对冲分</strong> {{ scoreInterpretation.domestic.value }}（{{ scoreInterpretation.domestic.level }}）：
                {{ scoreInterpretation.domestic.text }}
              </p>
              <p class="score-help-line">
                <strong>净影响分</strong> {{ scoreInterpretation.net.value }}（{{ scoreInterpretation.net.level }}）：
                {{ scoreInterpretation.net.text }}
              </p>
              <p v-if="openingSignal" class="score-help-line">
                <strong>A股开盘信号</strong> {{ formatScore(openingSignal.score) }}（{{ openingSignal.mood }}）：
                基础 50 分；美股四大股指期货涨跌幅均值 × 6；VIX 上涨最多扣 15 分、下跌最多加 10 分；
                离岸人民币涨跌超过 0.2% 才计分，最多 ±6 分；最后限制在 0–100。
                它只反映隔夜外盘风险偏好，不含 A 股价格、政策和 IV，不是概率。
              </p>
              <p v-if="openingSignal?.drivers?.length" class="score-help-drivers">
                触发项：{{ openingSignal.drivers.join('；') }}
              </p>
              <p class="score-help-summary">综合解读：{{ scoreInterpretation.summary }}</p>
            </div>
          </v-expand-transition>

          <div class="score-strip">
          <div class="score-pill score-international">
            <span class="pill-label">国际冲击分</span>
            <span class="pill-value">{{ formatScore(brief.international_shock_score) }}</span>
          </div>
          <div class="score-pill score-domestic">
            <span class="pill-label">国内对冲分</span>
            <span class="pill-value">{{ formatScore(brief.domestic_hedge_score) }}</span>
          </div>
          <div class="score-pill score-net">
            <span class="pill-label">净影响分</span>
            <span class="pill-value">{{ formatScore(brief.net_impact_score) }}</span>
          </div>
          <div v-if="openingSignal" class="score-pill score-opening" :title="openingSignalTooltip">
            <span class="pill-label">A股开盘信号</span>
            <span class="pill-value">{{ formatScore(openingSignal.score) }}</span>
            <span class="pill-sub">{{ openingSignal.mood }}</span>
          </div>
          <div
            v-if="brief.iv_snapshot?.available"
            class="score-pill score-iv"
            :class="'score-iv--' + brief.iv_snapshot.level"
            :title="brief.iv_snapshot.source === 'HV' ? '上证50历史波动率（20日）' : 'A股三大指数期权30日隐含波动率'"
          >
            <span class="pill-label">{{ brief.iv_snapshot.source === 'HV' ? 'A股HV20' : 'A股IV' }}</span>
            <span class="pill-value">{{ brief.iv_snapshot.iv_30 }}%</span>
            <span class="pill-sub">{{ brief.iv_snapshot.underlying }} · {{ brief.iv_snapshot.level_zh }}<span v-if="brief.iv_snapshot.skew_pp !== null"> · 偏度{{ brief.iv_snapshot.skew_pp > 0 ? '+' : '' }}{{ brief.iv_snapshot.skew_pp }}pp</span></span>
          </div>
          </div>

          <!-- A股波动率水位：把 IV 数值翻译成可读的水位与日均波动 -->
          <div v-if="ivIndices.length" class="iv-level-panel">
            <div class="iv-level-header">
              <span class="iv-level-title">
                A股波动率水位
                <span class="iv-level-sub">30日年化隐含波动率（IV）</span>
              </span>
              <v-btn
                size="x-small"
                variant="text"
                color="primary"
                @click="showIvHelp = !showIvHelp"
              >
                {{ showIvHelp ? '收起解读' : '解读' }}
              </v-btn>
            </div>

            <div class="iv-level-legend">
              <span class="iv-zone iv-zone--calm">&lt;15% 平静</span>
              <span class="iv-zone iv-zone--normal">15–25% 正常</span>
              <span class="iv-zone iv-zone--elevated">25–35% 偏高</span>
              <span class="iv-zone iv-zone--panic">≥35% 恐慌</span>
            </div>

            <div
              v-for="idx in ivIndices"
              :key="idx.key"
              class="iv-level-row"
              :title="ivRowTooltip(idx)"
            >
              <span class="iv-level-name">{{ idx.name }}<em v-if="idx.label">{{ idx.label }}</em></span>
              <div class="iv-level-track">
                <span class="iv-level-marker" :style="{ left: idx.markerPct + '%' }"></span>
              </div>
              <span class="iv-level-val" :class="'iv-level-val--' + idx.level">{{ idx.iv_30 }}%</span>
              <span class="iv-level-mean">≈日均 ±{{ idx.dailySigma }}%</span>
              <span class="iv-level-state" :class="'iv-level-state--' + idx.level">
                {{ idx.level_zh }}<template v-if="idx.term_inverted"> · 期限倒挂</template>
              </span>
            </div>

            <v-expand-transition>
              <div v-if="showIvHelp" class="iv-help-panel">
                <p><strong>IV 是什么：</strong>隐含波动率由期权价格反推，是市场对未来 30 天波动的“预期定价”，不是过去已经发生的涨跌；数值按年化标准差表示。</p>
                <p><strong>{{ ivExample.name }} {{ ivExample.iv }}% 怎么读：</strong>年化 1σ ≈ {{ ivExample.iv }}%，按 √252 折算，单日 1σ ≈ ±{{ ivExample.dailySigma }}%。粗略地说，约 2/3 的交易日涨跌幅落在 ±{{ ivExample.dailySigma }}% 内，95% 落在 ±{{ ivExample.twoSigma }}% 内；假设持有 100 万线性相关资产，单日 1σ 波动约 ±{{ ivExample.dailySigma }} 万。</p>
                <p><strong>跨指数比较：</strong>小盘指数 IV 天然高于大盘，长期排序大致是 中证1000 &gt; 中证500 &gt; 沪深300 &gt; 上证50。所以中证1000 高于沪深300 本身不代表更恐慌，要看绝对水位、单日变化和期限结构。</p>
                <p><strong>认沽偏度：</strong>认沽 IV − 认购 IV。正数表示市场愿意为下跌保护支付更高溢价，正值越大，尾部避险需求越强。</p>
                <p><strong>期限倒挂：</strong>近月 IV &gt; 远月 IV，通常意味着市场把风险定价在眼前，需要提高警惕。</p>
                <p class="iv-help-note">阈值：&lt;15% 平静 · 15–25% 正常 · 25–35% 偏高 · ≥35% 恐慌。数据来自 CFFEX / SSE 期权，30 日插值。</p>
              </div>
            </v-expand-transition>
          </div>
        </div>
        
        <!-- 市场数据：优先展示 MongoDB 最新同步（Yahoo），与下方 AI 报告解耦 -->
        <div v-if="displayMarketData" class="market-dashboard">
          <div class="dashboard-header">
            <h4>
              📉 全球市场行情
              <span v-if="marketDate" class="snap-time">（{{ marketDate }} 口径）</span>
            </h4>
            <v-chip size="x-small" :color="isShowingLiveQuotes ? 'success' : 'grey'" variant="tonal">
              {{ isShowingLiveQuotes ? '库内最新' : '分析快照' }}
            </v-chip>
          </div>
          <p class="dashboard-footnote">
            <template v-if="isShowingLiveQuotes && liveSyncedAtMax">
              {{ liveSourceNote }} · 同步入库时间不晚于 {{ formatDateTime(liveSyncedAtMax) }}
            </template>
            <template v-else-if="isShowingLiveQuotes && !liveSyncedAtMax">
              {{ liveSourceNote }}（未返回单条时间戳，请以数据引擎同步任务为准）
            </template>
            <template v-else>
              暂未能从行情库拉取最新数据，当前为<strong>分析报告附带</strong>的快照；刷新页面或稍后重试。下方 AI 段落仍对应标题所示分析时间。
            </template>
          </p>

          <v-tabs
            v-model="activeMarketTab"
            bg-color="transparent"
            color="primary"
            density="compact"
            class="market-tabs mb-3"
            show-arrows
          >
            <v-tab value="indices">🇺🇸 核心指数</v-tab>
            <v-tab value="china">🇨🇳 中国资产</v-tab>
            <v-tab value="tech">🤖 科技巨头</v-tab>
            <v-tab value="commodities">🪙 商品外汇</v-tab>
            <v-tab value="other">📉 债券加密</v-tab>
          </v-tabs>

          <v-window v-model="activeMarketTab">
            <!-- 1. 核心指数 -->
            <v-window-item value="indices">
              <div class="market-indices">
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.indices, '^IXIC')?.change_pct)" :title="buildQuoteSourceTooltip(getMarketItem(displayMarketData.indices, '^IXIC'))">
                  <span class="m-name">纳斯达克</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.indices, '^IXIC')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.indices, '^IXIC')?.change_pct) }}</span>
                  <button class="kline-btn" @click.stop="openChart('^IXIC', '纳斯达克')" title="查看K线">📈</button>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.indices, '^GSPC')?.change_pct)" :title="buildQuoteSourceTooltip(getMarketItem(displayMarketData.indices, '^GSPC'))">
                  <span class="m-name">标普500</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.indices, '^GSPC')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.indices, '^GSPC')?.change_pct) }}</span>
                  <button class="kline-btn" @click.stop="openChart('^GSPC', '标普500')" title="查看K线">📈</button>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.indices, '^DJI')?.change_pct)" :title="buildQuoteSourceTooltip(getMarketItem(displayMarketData.indices, '^DJI'))">
                  <span class="m-name">道琼斯</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.indices, '^DJI')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.indices, '^DJI')?.change_pct) }}</span>
                  <button v-if="hasKline('^DJI')" class="kline-btn" @click.stop="openChart('^DJI', '道琼斯')" title="查看K线">📈</button>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.indices, '^RUT')?.change_pct)" :title="buildQuoteSourceTooltip(getMarketItem(displayMarketData.indices, '^RUT'))">
                  <span class="m-name">罗素2000</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.indices, '^RUT')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.indices, '^RUT')?.change_pct) }}</span>
                  <button v-if="hasKline('^RUT')" class="kline-btn" @click.stop="openChart('^RUT', '罗素2000')" title="查看K线">📈</button>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.indices, '^VIX')?.change_pct)" :title="buildQuoteSourceTooltip(getMarketItem(displayMarketData.indices, '^VIX'))">
                  <span class="m-name">恐慌指数(VIX)</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.indices, '^VIX')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.indices, '^VIX')?.change_pct) }}</span>
                  <button class="kline-btn" @click.stop="openChart('^VIX', 'VIX恐慌指数')" title="查看K线">📈</button>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.us_index_futures, 'NQ=F')?.change_pct)" :title="buildQuoteSourceTooltip(getMarketItem(displayMarketData.us_index_futures, 'NQ=F'))">
                  <span class="m-name">纳指期货</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.us_index_futures, 'NQ=F')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.us_index_futures, 'NQ=F')?.change_pct) }}</span>
                  <button v-if="hasKline('NQ=F')" class="kline-btn" @click.stop="openChart('NQ=F', '纳指期货')" title="查看K线">📈</button>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.us_index_futures, 'ES=F')?.change_pct)" :title="buildQuoteSourceTooltip(getMarketItem(displayMarketData.us_index_futures, 'ES=F'))">
                  <span class="m-name">标普期货</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.us_index_futures, 'ES=F')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.us_index_futures, 'ES=F')?.change_pct) }}</span>
                  <button v-if="hasKline('ES=F')" class="kline-btn" @click.stop="openChart('ES=F', '标普期货')" title="查看K线">📈</button>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.us_index_futures, 'YM=F')?.change_pct)" :title="buildQuoteSourceTooltip(getMarketItem(displayMarketData.us_index_futures, 'YM=F'))">
                  <span class="m-name">道指期货</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.us_index_futures, 'YM=F')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.us_index_futures, 'YM=F')?.change_pct) }}</span>
                  <button v-if="hasKline('YM=F')" class="kline-btn" @click.stop="openChart('YM=F', '道指期货')" title="查看K线">📈</button>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.us_index_futures, 'RTY=F')?.change_pct)" :title="buildQuoteSourceTooltip(getMarketItem(displayMarketData.us_index_futures, 'RTY=F'))">
                  <span class="m-name">罗素期货</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.us_index_futures, 'RTY=F')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.us_index_futures, 'RTY=F')?.change_pct) }}</span>
                  <button v-if="hasKline('RTY=F')" class="kline-btn" @click.stop="openChart('RTY=F', '罗素期货')" title="查看K线">📈</button>
                </div>
              </div>
            </v-window-item>

            <!-- 2. 中国资产 -->
            <v-window-item value="china">
              <div class="market-indices">
                <div class="market-item" v-for="(symbol, index) in ['FXI', '2823.HK', 'PGJ', 'BABA', 'PDD', 'JD', 'NIO']" :key="index"
                     :class="getChangeClass(getMarketItem(displayMarketData.china_concepts, symbol)?.change_pct)">
                  <span class="m-name">{{ getMarketItem(displayMarketData.china_concepts, symbol)?.name || symbol }}</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.china_concepts, symbol)?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.china_concepts, symbol)?.change_pct) }}</span>
                  <button v-if="hasKline(symbol)" class="kline-btn" @click.stop="openChart(symbol, getMarketItem(displayMarketData.china_concepts, symbol)?.name || symbol)" title="查看K线">📈</button>
                </div>
              </div>
            </v-window-item>

            <!-- 3. 科技巨头 -->
            <v-window-item value="tech">
              <div class="market-indices">
                <div class="market-item" v-for="(symbol, index) in ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'GOOG', 'META', 'AMZN', 'AMD', 'INTC']" :key="index"
                     :class="getChangeClass(getMarketItem(displayMarketData.tech_giants, symbol)?.change_pct)">
                  <span class="m-name">{{ getMarketItem(displayMarketData.tech_giants, symbol)?.name || symbol }}</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.tech_giants, symbol)?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.tech_giants, symbol)?.change_pct) }}</span>
                  <button v-if="hasKline(symbol)" class="kline-btn" @click.stop="openChart(symbol, getMarketItem(displayMarketData.tech_giants, symbol)?.name || symbol)" title="查看K线">📈</button>
                </div>
              </div>
            </v-window-item>

            <!-- 4. 商品外汇 -->
            <v-window-item value="commodities">
              <div class="market-indices">
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.commodities, 'GC=F')?.change_pct)">
                  <span class="m-name">黄金</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.commodities, 'GC=F')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.commodities, 'GC=F')?.change_pct) }}</span>
                  <button v-if="hasKline('GC=F')" class="kline-btn" @click.stop="openChart('GC=F', '黄金')" title="查看K线">📈</button>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.commodities, 'SI=F')?.change_pct)">
                  <span class="m-name">白银</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.commodities, 'SI=F')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.commodities, 'SI=F')?.change_pct) }}</span>
                  <button v-if="hasKline('SI=F')" class="kline-btn" @click.stop="openChart('SI=F', '白银')" title="查看K线">📈</button>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.commodities, 'CL=F')?.change_pct)">
                  <span class="m-name">WTI原油</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.commodities, 'CL=F')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.commodities, 'CL=F')?.change_pct) }}</span>
                  <button v-if="hasKline('CL=F')" class="kline-btn" @click.stop="openChart('CL=F', 'WTI原油')" title="查看K线">📈</button>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.forex, 'USDCNH=X')?.change_pct)">
                  <span class="m-name">离岸人民币</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.forex, 'USDCNH=X')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.forex, 'USDCNH=X')?.change_pct) }}</span>
                  <button v-if="hasKline('USDCNH=X')" class="kline-btn" @click.stop="openChart('USDCNH=X', '离岸人民币')" title="查看K线">📈</button>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.forex, 'DX-Y.NYB')?.change_pct)">
                  <span class="m-name">美元指数</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.forex, 'DX-Y.NYB')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.forex, 'DX-Y.NYB')?.change_pct) }}</span>
                  <button v-if="hasKline('DX-Y.NYB')" class="kline-btn" @click.stop="openChart('DX-Y.NYB', '美元指数')" title="查看K线">📈</button>
                </div>
              </div>
            </v-window-item>
            
            <!-- 5. 债券加密 -->
            <v-window-item value="other">
               <div class="market-indices">
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.bonds, '^TNX')?.change_pct)">
                  <span class="m-name">10年美债</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.bonds, '^TNX')?.price) }}%</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.bonds, '^TNX')?.change_pct) }}</span>
                  <button class="kline-btn" @click.stop="openChart('^TNX', '10年美债收益率')" title="查看K线">📈</button>
                </div>
                <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.crypto, 'BTC-USD')?.change_pct)">
                  <span class="m-name">比特币</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.crypto, 'BTC-USD')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.crypto, 'BTC-USD')?.change_pct) }}</span>
                  <button v-if="hasKline('BTC-USD')" class="kline-btn" @click.stop="openChart('BTC-USD', '比特币')" title="查看K线">📈</button>
                </div>
                 <div class="market-item" :class="getChangeClass(getMarketItem(displayMarketData.crypto, 'ETH-USD')?.change_pct)">
                  <span class="m-name">以太坊</span>
                  <span class="m-price">{{ formatNumber(getMarketItem(displayMarketData.crypto, 'ETH-USD')?.price) }}</span>
                  <span class="m-change">{{ formatPercent(getMarketItem(displayMarketData.crypto, 'ETH-USD')?.change_pct) }}</span>
                  <button v-if="hasKline('ETH-USD')" class="kline-btn" @click.stop="openChart('ETH-USD', '以太坊')" title="查看K线">📈</button>
                </div>
               </div>
            </v-window-item>

          </v-window>
        </div>

        <!-- AI 分析报告区：与上方行情解耦；过时提示仅出现在此区域 -->
        <div class="analysis-report-region">
          <div class="report-region-header">
            <h4 class="report-region-title">📝 AI 分析报告</h4>
            <p v-if="analysisTimestamp" class="report-meta">
              本段文字与量化打分基于 <strong>{{ formatDateTime(analysisTimestamp) }}</strong> 生成时的行情与新闻摘要。
              <template v-if="isShowingLiveQuotes && liveSyncedAtMax">
                当前页顶部报价已更新至 <strong>{{ formatDateTime(liveSyncedAtMax) }}</strong>（库内同步），二者不完全一致属正常；若关键标的波动显著，请以顶部数字为准并考虑重新分析。
              </template>
            </p>
            <p v-if="isPreOpenReport" class="report-caveat">
              ⚠️ 盘前报告：文中提到的“上证指数”等 A 股涨跌，均为<strong>上一交易日收盘</strong>数据，不代表今日开盘表现。
            </p>
          </div>

          <div v-if="watchdogAlert" class="stale-report-alert">
            <v-alert density="compact" type="warning" variant="tonal" class="mb-0">
              <div class="d-flex flex-column flex-sm-row justify-space-between stale-report-alert-row">
                <span class="stale-report-text">
                  <strong>报告可能已滞后</strong>：自分析完成以来，
                  <strong>{{ watchdogAlert.name }}</strong> 相对当时用于分析的快照价已
                  {{ watchdogAlert.direction === 'up' ? '上涨' : '下跌' }}约 <strong>{{ watchdogAlert.diffPct }}%</strong>
                 （分析时参考价 {{ formatNumber(watchdogAlert.snapshotPrice) }} → 当前库内价 {{ formatNumber(watchdogAlert.currentPrice) }}）。
                  下方结论未自动重写，专业版可点击「刷新分析」触发重新研判。
                </span>
                <v-btn
                  v-if="canTriggerGlobalAnalysis"
                  size="x-small"
                  color="warning"
                  variant="flat"
                  class="align-self-start flex-shrink-0"
                  @click="refreshAnalysis"
                  :loading="refreshing"
                >
                  刷新分析
                </v-btn>
              </div>
            </v-alert>
          </div>

        <!-- Step 1: 国外市场分析 -->
        <div v-if="brief.foreign_impact" class="analysis-section foreign-section">
          <h4 class="section-title">📊 国外市场影响</h4>
          <p class="analysis-content">{{ brief.foreign_impact }}</p>
        </div>

        <!-- Step 2: 国内政策对冲 (核心) -->
        <div v-if="brief.policy_hedge" class="analysis-section policy-section highlight">
          <h4 class="section-title">🏛️ 国内政策对冲<span class="key-badge">KEY</span></h4>
          <p class="analysis-content">{{ brief.policy_hedge }}</p>
        </div>

        <!-- Step 3: 综合影响 -->
        <div v-if="brief.net_impact" class="analysis-section net-impact-section">
          <h4 class="section-title">💡 综合影响评估</h4>
          <p class="analysis-content">{{ brief.net_impact }}</p>
        </div>

        <!-- 推荐板块 -->
        <div v-if="brief.key_sectors && brief.key_sectors.length" class="sectors-section">
          <h4 class="section-title">🎯 推荐板块</h4>
          <div class="sectors-grid">
            <v-chip 
              v-for="(sector, index) in brief.key_sectors" 
              :key="index"
              color="primary"
              variant="tonal"
              class="sector-chip"
            >
              {{ sector }}
            </v-chip>
          </div>
          <p v-if="brief.logic" class="logic-text">{{ brief.logic }}</p>
        </div>

        <!-- 风险提示 -->
        <div class="risk-box" v-if="brief.risk_factors && brief.risk_factors.length">
          <h4>⚠️ 风险提示</h4>
          <ul>
            <li v-for="risk in brief.risk_factors" :key="risk">{{ risk }}</li>
          </ul>
        </div>

        <!-- 兼容旧版数据结构 (可选) -->
        <div v-if="!brief.foreign_impact && brief.summary" class="legacy-format">
          <div class="summary-section">
            <p class="main-summary">{{ brief.summary }}</p>
          </div>

          <div class="events-grid" v-if="brief.key_events">
            <div v-for="(event, index) in brief.key_events" :key="index" class="event-item">
              <div class="event-header">
                <span class="event-title">{{ event.event }}</span>
                <v-chip size="x-small" :color="getStrengthColor(event.strength)" variant="flat">
                  {{ event.strength }}
                </v-chip>
              </div>
              <div class="impact-mapping">
                <span class="impact-label">映射板块:</span>
                <span class="impact-sector">{{ event.impact_sector }}</span>
              </div>
              <p class="logic-text">{{ event.logic }}</p>
            </div>
          </div>

          <div class="suggestion-box" v-if="brief.trading_suggestion">
            <h4>💡 今日建议</h4>
            <p>{{ brief.trading_suggestion }}</p>
          </div>
        </div>
        </div>
      </div>

      <div v-if="!brief && !loading && !error" class="empty-state">
        <p>📡 暂无隔夜全球数据，请等待 08:30 自动简报生成</p>
      </div>
    </div>

    <!-- K线弹窗 -->
    <v-dialog v-model="chartDialog" max-width="900">
      <v-card style="background:#1a1a1a; height:520px; display:flex; flex-direction:column;">
        <v-card-title style="color:#fff; padding:8px 16px; font-size:14px; display:flex; align-items:center; flex-shrink:0;">
          {{ chartName }} K线
          <v-spacer />
          <v-btn icon size="small" @click="chartDialog=false" variant="text" color="grey">✕</v-btn>
        </v-card-title>
        <v-card-text style="padding:0; height:460px; overflow:hidden;">
          <Suspense>
            <GlobalMarketChart v-if="chartDialog" :symbol="chartSymbol" :name="chartName" />
          </Suspense>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import request from '../utils/request'

const GlobalMarketChart = defineAsyncComponent(() => import('./GlobalMarketChart.vue'))

const klineSymbols = ref(new Set())
const chartDialog = ref(false)
const chartSymbol = ref('')
const chartName = ref('')
function hasKline(symbol) { return klineSymbols.value.has(symbol) }
function openChart(symbol, name) { chartSymbol.value = symbol; chartName.value = name || symbol; chartDialog.value = true }

async function fetchKlineSymbols() {
  try {
    const res = await request({ method: 'get', url: '/global-market/kline-symbols' })
    if (res?.success && Array.isArray(res.symbols)) {
      klineSymbols.value = new Set(res.symbols)
    }
  } catch (e) {
    // fallback: leave empty, no kline buttons shown
  }
}
import { mdiRefresh, mdiHelpCircleOutline } from '@mdi/js'
import { useAuth } from '../services/auth.js'
import { canUseProFeature } from '../utils/entitlements'

const loading = ref(false)
const error = ref('')
const analysisResult = ref(null)
const activeMarketTab = ref('indices')
const showScoreHelp = ref(false)
const { user } = useAuth()
const canTriggerGlobalAnalysis = computed(() => canUseProFeature(user.value))
const showQuoteDebug = computed(() => {
  try {
    let value = new URLSearchParams(window.location.search).get('debugQuote')
    if (!value && window.location.hash && window.location.hash.includes('?')) {
      const hashQuery = window.location.hash.split('?')[1] || ''
      value = new URLSearchParams(hashQuery).get('debugQuote')
    }
    if (!value) return false
    const v = value.toLowerCase()
    return v === '1' || v === 'true' || v === 'yes'
  } catch (_) {
    return false
  }
})

// 提取数据
// 后端现在直接返回 { categories: { indices: {...}, ... } }
const brief = computed(() => analysisResult.value?.analysis || null)
const showIvHelp = ref(false)

const openingSignal = computed(() => {
  const sig = analysisResult.value?.market_data?.a_share_opening_signal
  if (!sig || sig.score === undefined || sig.score === null) return null
  return sig
})

const openingSignalTooltip = computed(() => {
  const sig = openingSignal.value
  if (!sig) return ''
  const parts = [
    `开盘信号 ${formatScore(sig.score)}（${sig.mood || '--'}）`,
    '以 50 为中性',
  ]
  if (sig.drivers?.length) parts.push(sig.drivers.join('；'))
  parts.push('只反映隔夜外盘，不是概率')
  return parts.join(' · ')
})

// 水位条按 0–50% 画；IV 超过 50% 时标记停在最右端，实际数值仍按原值显示。
const IV_SCALE_MAX = 50
const IV_ORDER = ['hs300', 'sz50', 'csi500', 'csi1000']

const ivIndices = computed(() => {
  const snap = brief.value?.iv_snapshot
  if (!snap?.available) return []
  const raw = snap.indices && Object.keys(snap.indices).length
    ? snap.indices
    : {
        primary: {
          name: snap.underlying,
          label: '主指数',
          iv_30: snap.iv_30,
          level: snap.level,
          level_zh: snap.level_zh,
          skew_pp: snap.skew_pp,
        },
      }
  const keys = IV_ORDER
    .filter((key) => raw[key])
    .concat(Object.keys(raw).filter((key) => !IV_ORDER.includes(key)))
  return keys.map((key) => {
    const idx = raw[key]
    const iv = Number(idx.iv_30)
    return {
      key,
      name: idx.name || key,
      label: idx.label || '',
      iv_30: iv,
      dailySigma: Number.isFinite(iv) ? (iv / Math.sqrt(252)).toFixed(2) : '--',
      markerPct: Number.isFinite(iv)
        ? Math.min(100, Math.max(0, (iv / IV_SCALE_MAX) * 100))
        : 0,
      level: idx.level || 'normal',
      level_zh: idx.level_zh || '--',
      skew_pp: idx.skew_pp,
      term_inverted: !!idx.term_inverted,
    }
  }).filter((idx) => Number.isFinite(idx.iv_30))
})

const ivExample = computed(() => {
  const rows = ivIndices.value
  if (!rows.length) return { name: '该指数', iv: '--', dailySigma: '--', twoSigma: '--' }
  const row = rows.find((r) => r.key === 'csi1000') || rows[rows.length - 1]
  return {
    name: row.name,
    iv: row.iv_30,
    dailySigma: row.dailySigma,
    twoSigma: (Number(row.dailySigma) * 2).toFixed(2),
  }
})

function ivRowTooltip(idx) {
  const parts = [
    `${idx.name}：30日年化隐含波动率 ${idx.iv_30}%`,
    `约合单日 1σ ±${idx.dailySigma}%`,
    idx.level_zh,
  ]
  if (idx.skew_pp !== null && idx.skew_pp !== undefined) {
    parts.push(`认沽偏度 ${idx.skew_pp > 0 ? '+' : ''}${idx.skew_pp}pp`)
  }
  if (idx.term_inverted) parts.push('近月 IV 高于远月（期限倒挂）')
  return parts.join(' · ')
}
/** 写入 global_analysis 文档时的行情快照（LLM 当时所见） */
const snapshotMarketData = computed(() => {
  const data = analysisResult.value?.market_data
  return data?.categories || data || null
})

const liveDashboardPayload = ref(null)

const displayMarketData = computed(() => {
  const live = liveDashboardPayload.value?.categories
  if (live && typeof live === 'object') {
    const hasAny = Object.keys(live).some(
      (cat) => live[cat] && typeof live[cat] === 'object' && Object.keys(live[cat]).length > 0
    )
    if (hasAny) return live
  }
  return snapshotMarketData.value
})

const isShowingLiveQuotes = computed(() => {
  const live = liveDashboardPayload.value?.categories
  if (!live || typeof live !== 'object') return false
  return Object.keys(live).some(
    (cat) => live[cat] && typeof live[cat] === 'object' && Object.keys(live[cat]).length > 0
  )
})

const liveSyncedAtMax = computed(() => liveDashboardPayload.value?.synced_at_max || null)
const liveSourceNote = computed(() => liveDashboardPayload.value?.source_note || 'Yahoo Finance（经同步任务入库）')

const analysisTimestamp = computed(() => analysisResult.value?.analyzed_at || analysisResult.value?.timestamp)

const isPreOpenReport = computed(() => {
  const ctx = analysisResult.value?.market_context
  if (ctx?.a_share_session) return ctx.a_share_session === 'pre_open'
  if (!analysisTimestamp.value) return false
  const d = new Date(analysisTimestamp.value)
  if (Number.isNaN(d.getTime())) return false
  return d.getHours() < 9 || (d.getHours() === 9 && d.getMinutes() < 30)
})

const marketDate = computed(() => {
  if (!displayMarketData.value?.indices) return null
  const ixic = displayMarketData.value.indices['^IXIC']
  if (ixic?.date) return ixic.date
  const firstKey = Object.keys(displayMarketData.value.indices)[0]
  return displayMarketData.value.indices[firstKey]?.date || null
})

// --- 库内最新价 vs 分析快照：仅在报告区提示，不遮挡顶部行情 ---
const watchdogAlert = ref(null)
let livePollTimer = null
let pollInFlight = false

const WATCH_SYMBOLS = ['NQ=F', 'ES=F', 'YM=F', 'RTY=F', 'FXI', 'GC=F']

function getItemFromCategories(categories, sym) {
  if (!categories || typeof categories !== 'object') return null
  const order = ['indices', 'us_index_futures', 'china_concepts', 'tech_giants', 'commodities', 'forex', 'bonds', 'crypto']
  for (const cat of order) {
    const bucket = categories[cat]
    if (bucket && bucket[sym]) return bucket[sym]
  }
  return null
}

function checkStaleVsSnapshot() {
  const snap = snapshotMarketData.value
  const live = liveDashboardPayload.value?.categories
  if (!snap || !live) {
    watchdogAlert.value = null
    return
  }
  for (const sym of WATCH_SYMBOLS) {
    const snapshotItem = getItemFromCategories(snap, sym)
    const liveItem = getItemFromCategories(live, sym)
    if (!snapshotItem || !liveItem) continue
    const snapPrice = Number(snapshotItem.price)
    const currPrice = Number(liveItem.price)
    if (!Number.isFinite(snapPrice) || snapPrice === 0 || !Number.isFinite(currPrice)) continue
    const diff = Math.abs(currPrice - snapPrice)
    const pct = (diff / snapPrice) * 100
    if (pct > 1.0) {
      watchdogAlert.value = {
        symbol: sym,
        name: snapshotItem.name || sym,
        diffPct: pct.toFixed(1),
        currentPrice: currPrice,
        snapshotPrice: snapPrice,
        direction: currPrice > snapPrice ? 'up' : 'down',
      }
      return
    }
  }
  watchdogAlert.value = null
}

async function fetchLiveDashboard() {
  if (!brief.value) return
  if (pollInFlight) return
  pollInFlight = true
  try {
    const res = await request.get('/global-market-dashboard', {
      timeout: 120000,
      silentErrorLog: true,
    })
    if (res.success && res.data) {
      liveDashboardPayload.value = res.data
      checkStaleVsSnapshot()
    }
  } catch (e) {
    if (e?.code !== 'ECONNABORTED') {
      console.warn('[GlobalMarketBrief] 拉取 global-market-dashboard 失败:', e)
    }
  } finally {
    pollInFlight = false
  }
}

function startLivePoll() {
  stopLivePoll()
  const tick = async () => {
    if (!brief.value) return
    await fetchLiveDashboard()
  }
  void tick()
  livePollTimer = setInterval(tick, 60 * 1000)
}

function stopLivePoll() {
  if (livePollTimer) clearInterval(livePollTimer)
  livePollTimer = null
}

async function fetchGlobalAnalysis() {
  loading.value = true
  error.value = ''
  try {
    // 后端默认裁剪 market_data 体积；全量调试可改为 params: { full: 'true' }
    const data = await request.get('/global-analysis', { timeout: 120000 })
    if (data.success) {
      analysisResult.value = data.data
      if (analysisResult.value?.analysis) {
        void fetchLiveDashboard()
        startLivePoll()
      } else {
        stopLivePoll()
        liveDashboardPayload.value = null
        watchdogAlert.value = null
      }
    } else {
      if (!data.error?.includes('今日尚无')) {
        error.value = data.error
      }
      if (data.error?.includes('今日尚无')) {
        analysisResult.value = null
        stopLivePoll()
        liveDashboardPayload.value = null
        watchdogAlert.value = null
      }
    }
  } catch (err) {
    if (err?.code === 'ECONNABORTED') {
      console.warn('[GlobalMarketBrief] 全球市场分析请求超时（已 120s），请检查 analyzer DB 与网络')
    } else {
      console.error('Failed to fetch global analysis:', err)
    }
  } finally {
    loading.value = false
  }
}

function formatDateTime(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatTime(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// 现在的 collection 是一个 dict，直接取值
function getMarketItem(collection, symbol) {
  if (!collection) return null
  return collection[symbol]
}

function buildQuoteSourceTooltip(item) {
  if (!showQuoteDebug.value || !item) return ''

  const changeSource = item.change_pct_source || ''
  const prevSource = item.prev_close_source || ''
  if (!changeSource && !prevSource) {
    return '数据口径说明\n暂无来源字段（请先运行新版 global sync 写入来源字段）'
  }

  const parts = ['数据口径说明']
  if (changeSource) parts.push(`涨跌幅来源: ${changeSource}`)
  if (prevSource) parts.push(`前收来源: ${prevSource}`)
  if (item.prev_close !== undefined && item.prev_close !== null) {
    parts.push(`前收值: ${formatNumber(item.prev_close)}`)
  }
  return parts.join('\n')
}

function formatNumber(num) {
  if (num === undefined || num === null) return '--'
  return Number(num).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function formatPercent(num) {
  if (num === undefined || num === null) return '--'
  const val = Number(num)
  return (val > 0 ? '+' : '') + val.toFixed(2) + '%'
}

function formatScore(num) {
  if (num === undefined || num === null || num === '') return '--'
  const val = Number(num)
  if (Number.isNaN(val)) return '--'
  return Math.round(val)
}

function normalizeScore(num) {
  if (num === undefined || num === null || num === '') return null
  const val = Number(num)
  if (Number.isNaN(val)) return null
  return Math.max(0, Math.min(100, Math.round(val)))
}

function buildScoreInsight(score, type) {
  if (score === null) {
    return { value: '--', level: '未知', text: '当前暂无有效数据。' }
  }

  if (type === 'international') {
    if (score >= 70) return { value: score, level: '高', text: '外部风险冲击较强，地缘与全球风险偏好对A股影响偏负。' }
    if (score >= 55) return { value: score, level: '中高', text: '外部扰动存在，开盘情绪可能偏谨慎。' }
    if (score >= 40) return { value: score, level: '中性', text: '外部冲击可控，更多取决于国内资金与政策。' }
    return { value: score, level: '低', text: '外部冲击有限，海外因素压制较弱。' }
  }

  if (type === 'domestic') {
    if (score >= 70) return { value: score, level: '强', text: '国内政策与产业支撑较强，具备明显对冲能力。' }
    if (score >= 55) return { value: score, level: '中强', text: '国内托底力度尚可，可部分对冲外部波动。' }
    if (score >= 40) return { value: score, level: '中性', text: '国内对冲力度一般，难以完全抵消外部冲击。' }
    return { value: score, level: '弱', text: '国内对冲偏弱，市场更易受外部风险牵引。' }
  }

  if (score >= 60) return { value: score, level: '偏多', text: '综合影响偏正，风险偏好有改善空间。' }
  if (score >= 45) return { value: score, level: '中性偏谨慎', text: '多空因素交织，建议以节奏和仓位控制为主。' }
  return { value: score, level: '偏空', text: '综合影响偏负，防守与风控优先。' }
}

const scoreInterpretation = computed(() => {
  const b = brief.value || {}
  const international = buildScoreInsight(normalizeScore(b.international_shock_score), 'international')
  const domestic = buildScoreInsight(normalizeScore(b.domestic_hedge_score), 'domestic')
  const net = buildScoreInsight(normalizeScore(b.net_impact_score), 'net')

  let summary = '当前数据不足，建议结合盘中走势再判断。'
  if (net.value !== '--') {
    if (net.level === '偏多') {
      summary = '净影响偏多，可适度提高风险偏好，但仍需观察外部事件是否反复。'
    } else if (net.level === '偏空') {
      summary = '净影响偏空，建议控制追涨，优先防守和仓位管理。'
    } else {
      summary = '净影响中性偏谨慎，建议结构化配置并保持策略弹性。'
    }
  }

  return { international, domestic, net, summary }
})

function getChangeClass(change, inverse = false) {
  if (change === undefined || change === null) return ''
  const val = Number(change)
  if (val === 0) return 'text-neutral'
  
  if (inverse) {
    // For pairs like CNH, up is depreciation (bad for assets usually), but context dependent.
    // Let's stick to standard: Up = Red (China style), Down = Green
    return val > 0 ? 'text-up' : 'text-down'
  }
  return val > 0 ? 'text-up' : 'text-down'
}

function getSentimentClass(score) {
  if (score >= 65) return 'sentiment-bullish'
  if (score <= 35) return 'sentiment-bearish'
  return 'sentiment-neutral'
}

function getStrengthColor(strength) {
  const s = strength?.toLowerCase() || ''
  if (s.includes('high') || s.includes('高')) return 'error'
  if (s.includes('medium') || s.includes('中')) return 'warning'
  return 'success'
}

onMounted(() => {
  fetchKlineSymbols()
  fetchGlobalAnalysis()
})

onUnmounted(() => {
  stopLivePoll()
})

const refreshing = ref(false)

async function refreshAnalysis() {
  if (refreshing.value) return
  
  refreshing.value = true
  try {
    // 1. Trigger backend analysis
    const res = await request.post('/analyze-global')
    
    if (res.success) {
      // 2. Clear current analysis temporarily or show loading state
      // loading.value = true -- maybe not, just keep showing old one with a loading indicator
      
      // 3. Wait a bit for the async task to be picked up (optional)
      // Since it's async, we can't wait for completion here easily without polling.
      // We'll just reload the current data after a short delay in case it was a fast update or just to confirm "pending" status if we had that.
      // But mainly we want to tell user it's started.
      
      // For better UX, we could use a snackbar, but here we'll just reload data after 2 seconds
      setTimeout(() => {
        fetchGlobalAnalysis()
        refreshing.value = false
      }, 2000)
    } else {
      console.error('Trigger analysis failed:', res.error)
      refreshing.value = false
    }
  } catch (e) {
    console.error('Trigger analysis error:', e)
    refreshing.value = false
  }
}
</script>

<style scoped>
.global-brief-card {
  background: white;
  border-radius: 12px;
  border: 1px solid #e1e8ed;
  margin-bottom: 20px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.card-header {
  background: #1a202c;
  color: white;
  padding: 12px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-main h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-time {
  font-size: 12px;
  color: #a0aec0;
  margin-left: 4px;
}

.pro-hint {
  margin-left: 6px;
  font-size: 11px;
  color: #cbd5e0;
}

.sentiment-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2px 10px;
  border-radius: 8px;
  background: rgba(255,255,255,0.1);
}

.sentiment-indicator .score {
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}

.sentiment-indicator .label {
  font-size: 10px;
  text-transform: uppercase;
  opacity: 0.8;
}

.sentiment-bullish { color: #48bb78; border-left: 4px solid #48bb78; }
.sentiment-bearish { color: #f56565; border-left: 4px solid #f56565; }
.sentiment-neutral { color: #ecc94b; border-left: 4px solid #ecc94b; }

.card-content {
  padding: 16px 20px;
  min-height: 100px;
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  color: #718096;
  font-size: 14px;
  gap: 12px;
}

.main-summary {
  font-size: 15px;
  font-weight: 500;
  color: #2d3748;
  line-height: 1.5;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px dashed #edf2f7;
}

.events-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.event-item {
  background: #f7fafc;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #edf2f7;
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.event-title {
  font-weight: 700;
  color: #1a202c;
  font-size: 14px;
}

.impact-mapping {
  font-size: 13px;
  margin-bottom: 6px;
  display: flex;
  gap: 6px;
}

.impact-label { color: #718096; }
.impact-sector { color: #3182ce; font-weight: 600; }

.logic-text {
  font-size: 12px;
  color: #4a5568;
  line-height: 1.4;
}

.bottom-sections {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 768px) {
  .bottom-sections { grid-template-columns: 1fr; }
}

.suggestion-box, .risk-box {
  padding: 12px;
  border-radius: 8px;
  font-size: 13px;
}

.suggestion-box {
  background: #ebf8ff;
  border: 1px solid #bee3f8;
  color: #2a4365;
}

.risk-box {
  background: #fff5f5;
  border: 1px solid #fed7d7;
  color: #742a2a;
}

.suggestion-box h4, .risk-box h4 {
  margin: 0 0 6px 0;
  font-size: 14px;
}

.risk-box ul {
  margin: 0;
  padding-left: 18px;
}

/* 新样式：三步骤分析 */
.analysis-section {
  background: #ffffff;
  border: 1px solid #e1e8ed;
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 12px;
}

.score-strip {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.score-strip-wrap {
  margin-bottom: 12px;
}

.score-strip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.score-strip-title {
  font-size: 12px;
  color: #4a5568;
  font-weight: 600;
}

.score-help-panel {
  border: 1px solid #dbeafe;
  background: #f8fbff;
  border-radius: 10px;
  padding: 8px 10px;
  margin-bottom: 8px;
}

.score-help-line {
  margin: 0 0 4px 0;
  font-size: 12px;
  color: #2d3748;
  line-height: 1.5;
}

.score-help-drivers {
  margin: 2px 0 4px;
  font-size: 11px;
  color: #718096;
  line-height: 1.5;
}

.score-help-summary {
  margin: 6px 0 0 0;
  font-size: 12px;
  color: #1a365d;
  font-weight: 600;
}

.score-pill {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}

.pill-label {
  font-size: 12px;
  color: #4a5568;
}

.pill-value {
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
}

.score-international .pill-value { color: #c53030; }
.score-domestic .pill-value { color: #2b6cb0; }
.score-net .pill-value { color: #2f855a; }

/* IV pill */
.score-iv { flex-direction: column; align-items: flex-start; gap: 2px; }
.score-iv .pill-sub { font-size: 11px; color: #718096; }
.score-iv--calm    { border-color: #c3dafe; background: #ebf4ff; }
.score-iv--calm    .pill-value { color: #2b6cb0; }
.score-iv--normal  { border-color: #c6f6d5; background: #f0fff4; }
.score-iv--normal  .pill-value { color: #276749; }
.score-iv--elevated{ border-color: #feebc8; background: #fffaf0; }
.score-iv--elevated .pill-value { color: #c05621; }
.score-iv--panic   { border-color: #fed7d7; background: #fff5f5; }
.score-iv--panic   .pill-value { color: #c53030; }

/* 开盘信号 pill */
.score-opening { flex-direction: column; align-items: flex-start; gap: 2px; }
.score-opening .pill-value { color: #975a16; }
.score-opening .pill-sub { font-size: 11px; color: #718096; }

/* A股波动率水位 */
.iv-level-panel {
  margin: 4px 0 12px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fbfdff;
}
.iv-level-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.iv-level-title { font-size: 12px; font-weight: 600; color: #2d3748; }
.iv-level-sub { margin-left: 6px; font-size: 11px; font-weight: 400; color: #718096; }
.iv-level-legend { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 8px; }
.iv-zone { font-size: 10px; padding: 1px 6px; border-radius: 8px; }
.iv-zone--calm     { background: #ebf4ff; color: #2b6cb0; }
.iv-zone--normal   { background: #f0fff4; color: #276749; }
.iv-zone--elevated { background: #fffaf0; color: #c05621; }
.iv-zone--panic    { background: #fff5f5; color: #c53030; }

.iv-level-row {
  display: grid;
  grid-template-columns: 96px minmax(120px, 1fr) 52px 80px 96px;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
}
.iv-level-name { font-size: 12px; color: #2d3748; white-space: nowrap; }
.iv-level-name em { margin-left: 4px; font-size: 10px; font-style: normal; color: #a0aec0; }
.iv-level-track {
  position: relative;
  height: 8px;
  border-radius: 4px;
  background: linear-gradient(to right,
    #dbeafe 0%, #dbeafe 30%,
    #c6f6d5 30%, #c6f6d5 50%,
    #feebc8 50%, #feebc8 70%,
    #fed7d7 70%, #fed7d7 100%);
}
.iv-level-marker {
  position: absolute;
  top: -3px;
  width: 4px;
  height: 14px;
  margin-left: -2px;
  border-radius: 2px;
  background: #1a202c;
  box-shadow: 0 0 0 2px #fff;
}
.iv-level-val { font-family: 'Roboto Mono', monospace; font-size: 12px; font-weight: 700; text-align: right; }
.iv-level-val--calm     { color: #2b6cb0; }
.iv-level-val--normal   { color: #276749; }
.iv-level-val--elevated { color: #c05621; }
.iv-level-val--panic    { color: #c53030; }
.iv-level-mean { font-size: 11px; color: #718096; text-align: right; white-space: nowrap; }
.iv-level-state { font-size: 11px; font-weight: 600; white-space: nowrap; }
.iv-level-state--calm     { color: #2b6cb0; }
.iv-level-state--normal   { color: #276749; }
.iv-level-state--elevated { color: #c05621; }
.iv-level-state--panic    { color: #c53030; }

.iv-help-panel {
  margin-top: 8px;
  padding: 8px 10px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #f8fbff;
}
.iv-help-panel p { margin: 0 0 5px; font-size: 12px; line-height: 1.55; color: #2d3748; }
.iv-help-panel p:last-child { margin-bottom: 0; }
.iv-help-note { color: #718096 !important; font-size: 11px !important; }

@media (max-width: 640px) {
  .iv-level-row { grid-template-columns: 80px minmax(90px, 1fr) 48px; }
  .iv-level-mean, .iv-level-state { display: none; }
}

.analysis-section.highlight {
  background: linear-gradient(135deg, #ebf8ff 0%, #f0fff4 100%);
  border: 2px solid #4299e1;
  box-shadow: 0 2px 12px rgba(66, 153, 225, 0.15);
}

.section-title {
  margin: 0 0 10px 0;
  font-size: 14px;
  font-weight: 600;
  color: #1a202c;
  display: flex;
  align-items: center;
  gap: 6px;
}

.key-badge {
  background: #48bb78;
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 700;
  margin-left: 4px;
}

.analysis-content {
  font-size: 13px;
  color: #2d3748;
  line-height: 1.6;
  margin: 0;
}

.sectors-section {
  background: #f7fafc;
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 12px;
}

.sectors-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.sector-chip {
  font-weight: 500;
}

.logic-text {
  font-size: 12px;
  color: #4a5568;
  margin: 0;
}

/* 市场数据仪表盘样式 */
.market-dashboard {
  background: #f8f9fa;
  border-bottom: 1px solid #e1e8ed;
  padding: 12px 16px;
  margin: -16px -20px 16px -20px; /* 撑满卡片宽度 */
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.dashboard-header h4 {
  margin: 0;
  font-size: 13px;
  color: #4a5568;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.dashboard-footnote {
  margin: 0 0 10px 0;
  font-size: 11px;
  color: #718096;
  line-height: 1.45;
}

.analysis-report-region {
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px dashed #e2e8f0;
}

.report-region-header {
  margin-bottom: 10px;
}

.report-region-title {
  margin: 0 0 6px 0;
  font-size: 14px;
  font-weight: 600;
  color: #1a202c;
}

.report-meta {
  margin: 0;
  font-size: 12px;
  color: #4a5568;
  line-height: 1.55;
}

.report-caveat {
  margin: 6px 0 0;
  padding: 6px 10px;
  border: 1px solid #feebc8;
  border-radius: 8px;
  background: #fffaf0;
  font-size: 12px;
  color: #975a16;
  line-height: 1.5;
}

.stale-report-alert {
  margin-bottom: 12px;
  animation: fadeIn 0.35s ease-out;
}

.stale-report-alert-row {
  gap: 10px;
}

.stale-report-text {
  font-size: 12px;
  line-height: 1.5;
}

.snap-time {
  font-weight: normal;
  margin-left: 6px;
  font-size: 11px;
}

.market-indices {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.market-item {
  display: flex;
  flex-direction: column;
  min-width: 72px;
  flex: 0 1 auto;
}

.m-name {
  font-size: 10px;
  color: #718096;
  margin-bottom: 2px;
  white-space: nowrap;
}

.m-price {
  font-size: 13px;
  font-weight: 600;
  font-family: 'Roboto Mono', monospace;
  color: #2d3748;
  line-height: 1.2;
}

.m-change {
  font-size: 11px;
  font-weight: 500;
}

.kline-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 11px;
  padding: 0;
  opacity: 0.5;
  line-height: 1;
  align-self: flex-end;
  margin-top: 1px;
}
.kline-btn:hover { opacity: 1; }

.text-up { color: #f56565; }
.text-down { color: #48bb78; }
.text-neutral { color: #a0aec0; }

.market-tabs {
  border-bottom: 1px solid #edf2f7;
  margin-left: -16px;
  margin-right: -16px;
  padding-left: 16px;
  padding-right: 16px; 
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
