<template>
  <div class="portfolio-overview">
    <header class="overview-header">
      <h2>组合总览（实盘 + 纸面）</h2>
      <p class="muted">
        按策略参数血缘（params_hash）合并多期 plan；实盘需有 live 成交回报才标为实盘，纸面展示 paper 净值与观察周期。
      </p>
    </header>

    <section class="toolbar">
      <label class="field">
        <span>选择组合</span>
        <select v-model="selectedPortfolioKey" :disabled="loadingList || !portfolios.length">
          <option value="">请选择</option>
          <option
            v-for="p in portfolios"
            :key="portfolioKey(p)"
            :value="portfolioKey(p)"
          >
            [{{ executionVenueLabel(p.execution_venue) }}] {{ portfolioOptionLabel(p) }}
          </option>
        </select>
      </label>
      <button type="button" :disabled="!selectedPortfolioKey || loadingDetail" @click="refreshDetail">
        <span v-if="loadingDetail" class="spinner" />
        {{ loadingDetail ? '加载中…' : '刷新' }}
      </button>
    </section>

    <p v-if="message" class="message" :class="{ error: messageIsError }">{{ message }}</p>

    <template v-if="selectedPortfolioKey && selectedPortfolio">
      <section class="portfolio-identity-card">
        <h3>组合标识</h3>
        <div class="identity-grid">
          <div>
            <span class="label">策略</span>
            <strong>{{ selectedPortfolio.strategy_name || selectedPortfolio.strategy_template_id }}</strong>
            <small>{{ selectedPortfolio.strategy_template_id }}</small>
          </div>
          <div>
            <span class="label">参数摘要</span>
            <strong>{{ selectedPortfolio.param_summary || '-' }}</strong>
            <small>
              universe {{ selectedPortfolio.universe_index || '-' }}
              · Top{{ selectedPortfolio.top_n ?? '-' }}
              · {{ selectedPortfolio.rebalance_days ?? '-' }} 日调仓
              · {{ selectedPortfolio.construction_mode || '-' }}
            </small>
          </div>
          <div>
            <span class="label">params_hash</span>
            <strong :title="selectedPortfolio.params_hash">{{ selectedPortfolio.params_hash_short || '-' }}</strong>
            <small>完整：{{ selectedPortfolio.params_hash || '-' }}</small>
          </div>
          <div>
            <span class="label">维护区间</span>
            <strong>{{ selectedPortfolio.first_base_date || '-' }} → {{ selectedPortfolio.last_base_date || '-' }}</strong>
            <small>{{ selectedPortfolio.plan_count }} 期 plan · 最新 {{ selectedPortfolio.latest_plan_type || '-' }} / {{ selectedPortfolio.latest_plan_status || '-' }}</small>
          </div>
          <div v-if="selectedPortfolio.execution_venue === 'paper'">
            <span class="label">纸面快照</span>
            <strong>{{ selectedPortfolio.paper_snapshot_date || '无快照' }}</strong>
            <small>持仓 {{ selectedPortfolio.paper_holding_count ?? 0 }} 只 · 权益 {{ money(selectedPortfolio.paper_equity) }}</small>
          </div>
          <div v-if="selectedPortfolio.paper_execution_mode">
            <span class="label">纸面执行</span>
            <strong>{{ paperExecutionModeLabel(selectedPortfolio.paper_execution_mode) }}</strong>
            <small v-if="selectedPortfolio.paper_execution_mode === 'auto_shadow'">调仓日自动批准，次日开盘价执行</small>
          </div>
          <div v-if="selectedPortfolio.paused">
            <span class="label">自动调仓</span>
            <strong class="negative">已暂停</strong>
            <small>手动清仓后暂停；可恢复自动调仓</small>
          </div>
        </div>
        <div v-if="selectedPortfolio.paused" class="paused-banner">
          <span>该组合已暂停自动调仓（上次手动清仓或主动暂停）。</span>
          <button type="button" :disabled="manualSubmitting" @click="resumeLineageAction">恢复自动调仓</button>
        </div>
      </section>

      <section v-if="holdingsOutOfSync" class="reconcile-banner">
        <div class="reconcile-head">
          <strong>⚠ 系统账本与券商实时持仓不一致</strong>
          <button type="button" :disabled="!isLivePortfolio" @click="openExternalManualModal">补录 miniQMT 手工操作</button>
        </div>
        <p class="muted">
          可能是 miniQMT 端手工买卖后系统尚未记录。补录后账本即可与券商对齐。
          <span v-if="reconcileData?.account_synced_at"> · 券商同步于 {{ formatSyncedAt(reconcileData.account_synced_at) }}</span>
        </p>
        <div class="table-wrap">
          <table class="lineup-table">
            <thead>
              <tr>
                <th>代码</th>
                <th>名称</th>
                <th>账本股数</th>
                <th>券商股数</th>
                <th>差异</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in reconcileData.diffs" :key="row.symbol">
                <td>{{ row.symbol }}</td>
                <td>{{ row.name || '-' }}</td>
                <td>{{ row.ledger_shares }}</td>
                <td>{{ row.account_shares }}</td>
                <td :class="row.diff > 0 ? 'pos' : 'neg'">{{ formatShareDelta(row.diff) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="timelineData" class="cycle-card" :class="{ 'needs-action': timelineData.action_required }">
        <div class="cycle-card-header">
          <div>
            <h3>当前周期状态</h3>
            <p class="cycle-state">{{ timelineData.today_state }}</p>
          </div>
          <span class="funding-badge" :class="`mode-${selectedPortfolio.execution_venue}`">
            {{ executionVenueLabel(selectedPortfolio.execution_venue) }}
          </span>
        </div>
        <div class="cycle-metrics">
          <div>
            <span class="label">调仓进度</span>
            <strong>
              {{ timelineData.current_cycle?.elapsed_trading_days ?? 0 }}
              / {{ timelineData.current_cycle?.rebalance_days ?? '-' }} 交易日
            </strong>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${cycleProgressPct}%` }" />
            </div>
          </div>
          <div>
            <span class="label">预计下次调仓</span>
            <strong>{{ timelineData.current_cycle?.next_rebalance_estimate || '-' }}</strong>
          </div>
          <div>
            <span class="label">理论漂移换手</span>
            <strong>{{ pct(timelineData.latest_drift_summary?.estimated_turnover) }}</strong>
            <small>
              买 {{ timelineData.latest_drift_summary?.buy_count ?? 0 }}
              / 卖 {{ timelineData.latest_drift_summary?.sell_count ?? 0 }}
            </small>
          </div>
          <div>
            <span class="label">需处理</span>
            <strong>{{ timelineData.action_required ? '是' : '否' }}</strong>
          </div>
        </div>
        <p v-if="timelineData.latest_drift_summary?.non_executable_reason === 'monitor_no_trade'" class="monitor-hint">
          未到调仓周期，本日不交易；上方漂移为若今日调仓的理论变化。
        </p>
        <div v-if="timelineData.action_required || selectedLatestPlanId" class="cycle-actions">
          <p v-if="pendingActionPlan" class="action-banner">
            待审批计划：<strong>{{ pendingActionPlan.date }}</strong> · {{ pendingActionPlan.today_state }}
            <span class="muted">请在下方「待审批计划复核」核对标的与 AI 风控后批准/拒绝。</span>
          </p>
          <button
            type="button"
            class="secondary"
            :disabled="forceRebalanceSubmitting || !selectedLatestPlanId || Boolean(forceRebalanceBlockReason)"
            :title="forceRebalanceBlockReason || ''"
            @click="submitForceRebalance"
          >
            {{ forceRebalanceSubmitting ? '提交中…' : '立即调仓 / 强制建仓' }}
          </button>
          <span v-if="forceRebalanceBlockReason" class="warning-text">{{ forceRebalanceBlockReason }}</span>
          <span v-else class="muted">
            重新生成一份强制调仓计划；不会执行当前已有 plan。
          </span>
        </div>
      </section>

      <section v-if="needsReviewPlan && planTargetRows.length" class="plan-ops-card plan-review-card">
        <div class="plan-ops-header">
          <div>
            <h3>待审批计划复核</h3>
            <p class="muted">
              最新 plan：<code>{{ shortPlanId(selectedLatestPlanId) }}</code> · 待审批 ·
              请先核对下方买/卖/持有方向与 AI 风控，再决定批准或拒绝。
            </p>
            <p class="plan-id-row">
              <span class="label">完整 plan_id</span>
              <code>{{ selectedLatestPlanId || '-' }}</code>
              <button
                type="button"
                class="link-button"
                :disabled="!selectedLatestPlanId"
                @click="copyPlanId(selectedLatestPlanId)"
              >
                复制
              </button>
            </p>
          </div>
          <div class="pending-plan-summary">
            <span class="tag-buy">买 {{ planReviewSummary.buy }}</span>
            <span class="tag-sell">卖 {{ planReviewSummary.sell }}</span>
            <span class="tag-hold">持有 {{ planReviewSummary.hold }}</span>
          </div>
        </div>

        <p
          v-if="planReviewRiskSummary.high"
          class="warning-text plan-review-risk-warning"
        >
          AI 风控发现 {{ planReviewRiskSummary.high }} 个高风险标的，批准前请重点确认。
        </p>

        <div class="table-wrap compact risk-report-table">
          <table>
            <thead>
              <tr>
                <th>方向</th>
                <th>标的</th>
                <th>行业</th>
                <th>加权分</th>
                <th>当前</th>
                <th>目标</th>
                <th>变化</th>
                <th>预估价</th>
                <th>预估金额</th>
                <th>AI风控</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in planTargetRows" :key="row.symbol">
                <td>
                  <span class="action-tag" :class="planItemActionClass(row.action)">
                    {{ planItemActionLabel(row.action) }}
                  </span>
                </td>
                <td>
                  <strong>{{ row.name || row.symbol }}</strong>
                  <small class="muted symbol-line">{{ row.symbol }}</small>
                </td>
                <td>{{ row.industry || '-' }}</td>
                <td>{{ num(row.score_value) }}</td>
                <td>{{ row.current_shares ?? 0 }}</td>
                <td>{{ row.target_shares ?? 0 }}</td>
                <td :class="signClass(row.delta_shares)">{{ formatShareDelta(row.delta_shares) }}</td>
                <td>{{ num(row.estimated_price) }}</td>
                <td>{{ money(row.estimated_amount) }}</td>
                <td>
                  <span
                    v-if="row.ai_risk"
                    class="risk-badge"
                    :class="`risk-${row.ai_risk.severity || 'none'}`"
                    :title="(row.ai_risk.reasons || []).join('、')"
                  >
                    {{ riskSeverityLabel(row.ai_risk.severity) }}
                  </span>
                  <span v-else class="muted">-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="plan-ops-actions plan-review-actions">
          <button
            type="button"
            :disabled="approveSubmitting || rejectSubmitting || !reviewPlanId"
            @click="approvePendingPlan"
          >
            {{ approveSubmitting ? '审批中…' : '批准计划' }}
          </button>
          <button
            type="button"
            class="secondary"
            :disabled="reviewAiRiskLoading"
            @click="rerunReviewAiRisk"
          >
            {{ reviewAiRiskLoading ? 'AI 风控复检中…' : '运行 AI 风控复检' }}
          </button>
          <button
            type="button"
            class="danger"
            :disabled="approveSubmitting || rejectSubmitting || !reviewPlanId"
            @click="rejectPendingPlan"
          >
            {{ rejectSubmitting ? '拒绝中…' : '拒绝计划' }}
          </button>
        </div>
      </section>

      <section v-if="showPlanOpsPanel" class="plan-ops-card">
        <div class="plan-ops-header">
          <div>
            <h3>计划执行操作</h3>
            <p class="muted">
              当前组合最新 plan：<code>{{ shortPlanId(selectedLatestPlanId) }}</code>
              · {{ selectedPlanStatus || '-' }}
              · {{ selectedPlanExecutionModeLabel }}
            </p>
            <p class="plan-id-row">
              <span class="label">完整 plan_id</span>
              <code>{{ selectedLatestPlanId || '-' }}</code>
              <button
                type="button"
                class="link-button"
                :disabled="!selectedLatestPlanId"
                @click="copyPlanId(selectedLatestPlanId)"
              >
                复制
              </button>
            </p>
          </div>
          <span class="funding-badge" :class="`mode-${selectedPortfolio.execution_venue}`">
            {{ executionVenueLabel(selectedPortfolio.execution_venue) }}
          </span>
        </div>

        <div v-if="isPaperPortfolio" class="plan-ops-actions">
          <button
            type="button"
            :disabled="paperExecuteLoading || !canExecutePaperNow"
            :title="paperExecuteReadyText"
            @click="executePaperNow"
          >
            {{ paperExecuteLoading ? '执行中…' : '立即执行 Paper' }}
          </button>
          <span class="muted">{{ paperExecuteReadyText }}</span>
        </div>

        <div v-else class="plan-ops-actions">
          <select v-model="selectedLiveAccountId">
            <option value="">请选择账户</option>
            <option v-for="account in liveAccountOptions" :key="account.id" :value="account.id">
              {{ account.label }}
            </option>
          </select>
          <template v-if="!selectedPlanHasLiveSignals">
            <button
              type="button"
              :disabled="livePublishLoading || !selectedLiveAccountId || !canPublishLiveSignals"
              @click="previewLivePublish"
            >
              {{ livePublishLoading ? '预检中…' : '实盘预检' }}
            </button>
            <button
              type="button"
              :disabled="livePublishLoading || !selectedLiveAccountId || !canPublishLiveSignals || livePublishBlockers.length"
              @click="publishLiveSignals"
            >
              确认发布
            </button>
          </template>
          <template v-else>
            <input v-model="remainderReason" class="reason-input" type="text" placeholder="补单原因（可选）">
            <button type="button" :disabled="remainderLoading || !selectedLiveAccountId" @click="previewRemainder">
              {{ remainderLoading ? '预检中…' : '缺口预检' }}
            </button>
            <button
              type="button"
              :disabled="remainderLoading || !selectedLiveAccountId || !remainderActionableCount || remainderBlockers.length"
              @click="confirmRemainder"
            >
              确认补单
            </button>
          </template>
        </div>

        <div class="plan-ops-actions cancel-plan-row">
          <button
            type="button"
            class="danger"
            :disabled="cancelPlanLoading || !canCancelCurrentPlan"
            :title="cancelPlanReadyText"
            @click="cancelCurrentPlan"
          >
            {{ cancelPlanLoading ? '作废中…' : '作废当前计划' }}
          </button>
          <span class="muted">{{ cancelPlanReadyText }}</span>
        </div>

        <div v-if="pendingPlanRows.length" class="pending-plan-items">
          <div class="pending-plan-header">
            <div>
              <h4>待发布/待执行计划标的</h4>
              <p class="muted">
                当前 approved plan 的目标列表；发布/执行前请确认买卖方向和目标股数。
              </p>
            </div>
            <div class="pending-plan-summary">
              <span class="tag-buy">买 {{ pendingPlanSummary.buy }}</span>
              <span class="tag-sell">卖 {{ pendingPlanSummary.sell }}</span>
              <span class="tag-hold">持有 {{ pendingPlanSummary.hold }}</span>
            </div>
          </div>
          <div class="table-wrap compact risk-report-table">
            <table>
              <thead>
                <tr>
                  <th>方向</th>
                  <th>标的</th>
                  <th>行业</th>
                  <th>加权分</th>
                  <th>当前</th>
                  <th>目标</th>
                  <th>变化</th>
                  <th>预估价</th>
                  <th>预估金额</th>
                  <th>AI风控</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in pendingPlanRows" :key="row.symbol">
                  <td>
                    <span class="action-tag" :class="planItemActionClass(row.action)">
                      {{ planItemActionLabel(row.action) }}
                    </span>
                  </td>
                  <td>
                    <strong>{{ row.name || row.symbol }}</strong>
                    <small class="muted symbol-line">{{ row.symbol }}</small>
                  </td>
                  <td>{{ row.industry || '-' }}</td>
                  <td>{{ num(row.score_value) }}</td>
                  <td>{{ row.current_shares ?? 0 }}</td>
                  <td>{{ row.target_shares ?? 0 }}</td>
                  <td :class="signClass(row.delta_shares)">{{ formatShareDelta(row.delta_shares) }}</td>
                  <td>{{ num(row.estimated_price) }}</td>
                  <td>{{ money(row.estimated_amount) }}</td>
                  <td>
                    <span
                      v-if="row.ai_risk"
                      class="risk-badge"
                      :class="`risk-${row.ai_risk.severity || 'none'}`"
                      :title="(row.ai_risk.reasons || []).join('、')"
                    >
                      {{ riskSeverityLabel(row.ai_risk.severity) }}
                    </span>
                    <span v-else class="muted">-</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="livePublishPreview" class="risk-report">
          <p>
            待写入 {{ livePublishPreview.new_signals?.length ?? 0 }} 条，已有 {{ livePublishPreview.existing_count ?? 0 }} 条，
            阻断 {{ livePublishPreview.risk_report?.blocked_count ?? 0 }} 条
          </p>
          <p v-if="livePublishBlockers.length" class="warning-text">
            {{ livePublishBlockers.slice(0, 8).join(' / ') }}
          </p>
          <div v-if="livePublishRiskRows.length" class="table-wrap compact risk-report-table">
            <table>
              <thead>
                <tr>
                  <th>状态</th>
                  <th>股票</th>
                  <th>方向</th>
                  <th>数量</th>
                  <th>价格</th>
                  <th>预估金额</th>
                  <th>预检结果</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in livePublishRiskRows" :key="item.order_id || `${item.symbol}-${item.action}-${item.size}`" :class="{ blocked: item.blockers?.length }">
                  <td>{{ item.blockers?.length ? '阻断' : '通过' }}</td>
                  <td>{{ item.symbol || '-' }}</td>
                  <td>{{ item.action || '-' }}</td>
                  <td>{{ item.size ?? '-' }}</td>
                  <td>{{ num(item.price) }}</td>
                  <td>{{ money(item.estimated_amount) }}</td>
                  <td>{{ (item.blockers || []).map(blockerText).join(' / ') || '可发布' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="remainderPreview" class="risk-report">
          <p>
            可补 {{ remainderActionableCount }} 项，阻断 {{ remainderPreview.risk_report?.blocked_count ?? 0 }} 条，
            可用现金 {{ money(remainderPreview.available_cash) }}
            <span v-if="remainderPreview.account_synced === false" class="warning-text">账户未同步持仓，无法补单</span>
          </p>
          <p v-if="remainderBlockers.length" class="warning-text">
            {{ remainderBlockers.slice(0, 8).join(' / ') }}
          </p>
          <div v-if="remainderRows.length" class="table-wrap compact risk-report-table">
            <table>
              <thead>
                <tr>
                  <th>股票</th>
                  <th>方向</th>
                  <th>目标</th>
                  <th>账户持仓</th>
                  <th>缺口</th>
                  <th>补单量</th>
                  <th>预估金额</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in remainderRows" :key="row.symbol" :class="{ blocked: !row.actionable }">
                  <td>{{ row.name || row.symbol }}</td>
                  <td>{{ row.action || '-' }}</td>
                  <td>{{ row.target_shares ?? '-' }}</td>
                  <td>{{ row.account_current_shares ?? '-' }}</td>
                  <td>{{ row.gap_shares ?? 0 }}</td>
                  <td>{{ row.topup_shares ?? 0 }}</td>
                  <td>{{ money(row.estimated_amount) }}</td>
                  <td>{{ (row.reasons || []).map(remainderReasonText).join(' / ') || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section v-if="foldedTimeline.length" class="timeline-section">
        <h3>观察 / 调仓时间线</h3>
        <p class="timeline-hint muted">调仓节点可展开查看买卖明细；观察日折叠段仅显示漂移摘要。</p>
        <ul class="timeline-list">
          <li
            v-for="(entry, idx) in foldedTimeline"
            :key="entry.type === 'monitor_fold' ? `fold-${entry.end}-${idx}` : entry.node.plan_id"
            :class="timelineEntryClass(entry)"
          >
            <template v-if="entry.type === 'monitor_fold'">
              <strong>{{ entry.end }} ~ {{ entry.start }}</strong>
              <span>观察 {{ entry.count }} 次</span>
              <span v-if="entry.maxDrift > 0">最大漂移换手 {{ pct(entry.maxDrift) }}</span>
            </template>
            <template v-else>
              <div class="timeline-node-head">
                <button
                  v-if="timelineTradeItems(entry.node).length"
                  type="button"
                  class="timeline-expand"
                  :aria-expanded="expandedTimelinePlanId === entry.node.plan_id"
                  @click="toggleTimelineDetail(entry.node.plan_id)"
                >
                  {{ expandedTimelinePlanId === entry.node.plan_id ? '▾' : '▸' }}
                </button>
                <strong>{{ entry.node.date }}</strong>
                <span class="node-type">{{ nodeTypeLabel(entry.node.node_type) }}</span>
                <span>{{ entry.node.today_state }}</span>
                <span v-if="entry.node.drift_brief?.buy_count">
                  买 {{ entry.node.drift_brief.buy_count }}
                </span>
                <span v-if="entry.node.drift_brief?.sell_count">
                  卖 {{ entry.node.drift_brief.sell_count }}
                </span>
                <span v-if="entry.node.drift_brief?.estimated_turnover != null">
                  换手 {{ pct(entry.node.drift_brief.estimated_turnover) }}
                </span>
              </div>
              <div
                v-if="expandedTimelinePlanId === entry.node.plan_id && timelineTradeItems(entry.node).length"
                class="timeline-trade-detail"
              >
                <p v-if="entry.node.drift_brief?.mode === 'drift'" class="timeline-detail-note">
                  观察日未执行，以下为若今日调仓的理论买卖。
                </p>
                <div class="table-wrap compact">
                  <table>
                    <thead>
                      <tr>
                        <th>方向</th>
                        <th>代码</th>
                        <th>名称</th>
                        <th>变动股数</th>
                        <th>持仓 → 目标</th>
                        <th>估算金额</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in timelineTradeItems(entry.node)" :key="`${entry.node.plan_id}-${row.symbol}`">
                        <td>
                          <span class="action-tag" :class="row.action === 'buy' ? 'tag-buy' : 'tag-sell'">
                            {{ row.action === 'buy' ? '买' : '卖' }}
                          </span>
                        </td>
                        <td>{{ row.symbol }}</td>
                        <td>{{ row.name || '-' }}</td>
                        <td>{{ formatShareDelta(row.delta_shares) }}</td>
                        <td>{{ row.current_shares }} → {{ row.target_shares }}</td>
                        <td>{{ money(row.estimated_amount) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>
          </li>
        </ul>
      </section>

      <section v-if="equityCaveat" class="caveat-box">
        <strong>说明：</strong>{{ equityCaveat }}
      </section>

      <section class="summary-cards" v-if="bookEquity">
        <div class="card">
          <div class="label">连续权益（一本账）</div>
          <div class="value">{{ money(bookEquity.equity) }}</div>
        </div>
        <div class="card">
          <div class="label">初始本金</div>
          <div class="value">{{ money(bookEquity.initial_capital) }}</div>
        </div>
        <div class="card">
          <div class="label">可用现金</div>
          <div class="value">{{ money(bookEquity.cash) }}</div>
        </div>
        <div class="card">
          <div class="label">累计盈亏</div>
          <div class="value">{{ signedMoney(Number(bookEquity.realized_pnl || 0) + Number(bookEquity.unrealized_pnl || 0)) }}</div>
        </div>
      </section>

      <section class="chart-section">
        <h3>净值曲线（账户整体权益 · 日频）</h3>
        <div v-if="!equityRowsForChart.length" class="muted">暂无净值数据。</div>
        <div v-else class="equity-chart" aria-label="Lineage equity curve" @mouseleave="onChartLeave">
          <svg
            class="equity-svg"
            :viewBox="`0 0 ${equityChart.width} ${equityChart.height}`"
            @mousemove="onChartMove"
          >
            <defs>
              <linearGradient :id="equityGradId" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" :stop-color="equityChart.up ? 'rgba(220,38,38,0.30)' : 'rgba(22,163,74,0.30)'" />
                <stop offset="100%" stop-color="rgba(0,0,0,0)" />
              </linearGradient>
            </defs>
            <g class="grid">
              <line
                v-for="tick in equityChart.yTicks"
                :key="`grid-${tick.y}`"
                :x1="equityChart.plotLeft"
                :x2="equityChart.plotRight"
                :y1="tick.y"
                :y2="tick.y"
              />
              <text
                v-for="tick in equityChart.yTicks"
                :key="`yl-${tick.y}`"
                class="axis-label"
                :x="equityChart.plotLeft - 8"
                :y="tick.y + 4"
                text-anchor="end"
              >{{ tick.label }}</text>
            </g>
            <g v-if="equityChart.baselineY != null">
              <line
                class="baseline"
                :x1="equityChart.plotLeft"
                :x2="equityChart.plotRight"
                :y1="equityChart.baselineY"
                :y2="equityChart.baselineY"
              />
              <text class="baseline-label" :x="equityChart.plotRight" :y="equityChart.baselineY - 6" text-anchor="end">
                成本线 {{ moneyShort(equityChart.baseline) }}
              </text>
            </g>
            <path v-if="equityChart.areaPath" class="area" :d="equityChart.areaPath" :fill="`url(#${equityGradId})`" />
            <polyline class="line" :class="equityChart.up ? 'up' : 'down'" :points="equityChart.linePoints" />
            <text
              v-for="tick in equityChart.xTicks"
              :key="`xl-${tick.x}`"
              class="axis-label"
              :x="tick.x"
              :y="equityChart.height - 8"
              :text-anchor="tick.anchor"
            >{{ tick.text }}</text>
            <g v-if="hoverPoint">
              <line
                class="crosshair"
                :x1="hoverPoint.x"
                :x2="hoverPoint.x"
                :y1="equityChart.plotTop"
                :y2="equityChart.plotBottom"
              />
              <circle class="dot" :cx="hoverPoint.x" :cy="hoverPoint.y" r="4.5" />
            </g>
          </svg>
          <div v-if="hoverPoint" class="equity-tip" :style="hoverPoint.tipStyle">
            <div class="tip-date">{{ hoverPoint.date }}</div>
            <div class="tip-row"><span>账户总额</span><strong>{{ money(hoverPoint.equity) }}</strong></div>
            <div class="tip-row">
              <span>当日盈亏</span>
              <strong :class="signClass(hoverPoint.dayPnl)">{{ signedMoney(hoverPoint.dayPnl) }} · {{ signedPct(hoverPoint.dayPct) }}</strong>
            </div>
            <div class="tip-row">
              <span>累计盈亏</span>
              <strong :class="signClass(hoverPoint.cumPnl)">{{ signedMoney(hoverPoint.cumPnl) }} · {{ signedPct(hoverPoint.cumPct) }}</strong>
            </div>
          </div>
          <p v-if="equityChart.latestReturn != null" class="chart-meta">
            区间收益：<strong :class="signClass(equityChart.latestReturn)">{{ signedPct(equityChart.latestReturn) }}</strong>
            <span class="chart-meta-hint">· 悬浮查看每日净值与盈亏</span>
          </p>
          <p v-if="equityRows.length === 0 && equityRowsForChart.length" class="muted chart-note">
            当前暂无账户日权益快照；这里用一本账当前权益生成一个估算点。
          </p>
        </div>
      </section>

      <section class="summary-cards" v-if="positionSummary">
        <div class="card">
          <div class="label">持仓市值</div>
          <div class="value">{{ money(positionSummary.total_market_value) }}</div>
        </div>
        <div class="card">
          <div class="label">已实现盈亏</div>
          <div class="value">{{ signedMoney(positionSummary.total_realized_pnl) }}</div>
        </div>
        <div class="card">
          <div class="label">浮动盈亏</div>
          <div class="value">{{ signedMoney(positionSummary.total_unrealized_pnl) }}</div>
        </div>
        <div class="card">
          <div class="label">持仓标的数</div>
          <div class="value">{{ positionSummary.holding_count }}</div>
        </div>
      </section>

      <section class="holdings-section">
        <div class="holdings-header">
          <h3>最新持仓</h3>
          <div class="holdings-actions">
            <button type="button" :disabled="!selectedLatestPlanId || riskLoading" @click="loadHoldingsRisk(true)">
              {{ riskLoading ? '体检中…' : '风控体检' }}
            </button>
            <button type="button" :disabled="!manualChangeRows.length" @click="openManualModal">
              提交手动调仓
            </button>
            <button
              type="button"
              class="danger"
              :disabled="!latestHoldingRows.length || liquidateSubmitting"
              @click="openLiquidateModal"
            >
              {{ isLivePortfolio ? '实盘一键清仓' : '纸面一键清仓' }}
            </button>
            <button
              v-if="isLivePortfolio"
              type="button"
              :disabled="externalManualSubmitting"
              @click="openExternalManualModal"
            >
              {{ externalManualSubmitting ? '补录中…' : '补录 miniQMT 手工操作' }}
            </button>
          </div>
        </div>
        <p v-if="holdingsRisk?.reviewed_count" class="muted holdings-risk-summary">
          持仓风控：高 {{ holdingsRisk.high }} · 中 {{ holdingsRisk.medium }} · 低 {{ holdingsRisk.low }}
          <span v-if="holdingsRisk.checked_at"> · 更新 {{ formatRiskTime(holdingsRisk.checked_at) }}</span>
        </p>
        <div v-if="!latestHoldingRows.length" class="muted">暂无当前持仓。</div>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>风控</th>
                <th>代码</th>
                <th>名称</th>
                <th>买入日</th>
                <th>当前</th>
                <th>目标</th>
                <th>变动</th>
                <th>均价</th>
                <th>现价</th>
                <th>市值</th>
                <th>浮动</th>
                <th>快思考</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in latestHoldingRows" :key="row.symbol" :class="riskRowClass(row.symbol)">
                <td>
                  <span v-if="holdingsRiskBySymbol[row.symbol]" class="risk-badge" :class="`risk-${holdingsRiskBySymbol[row.symbol].severity}`">
                    {{ riskSeverityLabel(holdingsRiskBySymbol[row.symbol].severity) }}
                  </span>
                  <span v-else class="muted">-</span>
                </td>
                <td>{{ row.symbol }}</td>
                <td>{{ row.name || '-' }}</td>
                <td>{{ row.buy_date || '-' }}</td>
                <td>{{ row.shares }}</td>
                <td>
                  <input
                    :value="effectiveTarget(row.symbol)"
                    type="number"
                    min="0"
                    step="100"
                    class="target-input"
                    @input="setManualTarget(row.symbol, $event.target.value)"
                  >
                </td>
                <td :class="signClass(manualDelta(row))">{{ formatShareDelta(manualDelta(row)) }}</td>
                <td>{{ num(row.avg_cost) }}</td>
                <td>{{ num(row.last_price) }}</td>
                <td>{{ money(row.market_value) }}</td>
                <td :class="signClass(row.unrealized_pnl)">{{ signedMoney(row.unrealized_pnl) }}</td>
                <td class="fast-actions">
                  <button type="button" class="fast-btn fast-btn-swap" @click="openSwapModal(row)">换股</button>
                  <button type="button" class="fast-btn fast-btn-reduce" @click="openQuickReduceModal(row, halfTargetShares(row))">减半</button>
                  <button type="button" class="fast-btn fast-btn-clear" @click="openQuickReduceModal(row, 0)">清仓</button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="holdingsRiskBySymbolHigh.length" class="muted">
            高风险提示：
            <span v-for="item in holdingsRiskBySymbolHigh" :key="item.symbol">
              {{ item.symbol }}（{{ item.ai_risk?.reasons?.join('、') || '风险' }}）
            </span>
          </p>
        </div>

        <section v-if="benchData" class="lineup-card bench-candidates-card">
          <div class="lineup-header">
            <div>
              <h3>替补候选</h3>
              <p class="muted lineup-hint">
                当前不在持仓中的策略候选，按算法评分排序。评分快照 {{ benchData.score_date || '-' }} ·
                替补池约 {{ benchData.bench_multiplier }}×Top{{ benchData.top_n }}。
              </p>
            </div>
            <button type="button" class="link-btn" @click="benchExpanded = !benchExpanded">
              {{ benchExpanded ? '收起' : '展开' }}
            </button>
          </div>
          <div v-if="benchExpanded">
            <div v-if="benchLoading" class="muted">加载替补候选中…</div>
            <template v-else>
              <div class="bench-risk-bar">
                <span v-if="benchRisk" class="bench-risk-summary">
                  AI风控：<b class="risk-high">{{ benchRisk.high || 0 }}高</b>
                  / <b class="risk-medium">{{ benchRisk.medium || 0 }}中</b>
                  / <b class="risk-low">{{ benchRisk.low || 0 }}低</b>
                </span>
                <span v-else class="muted">替补候选可先体检，高风险候选上场前会二次确认。</span>
                <button
                  type="button"
                  class="link-btn"
                  :disabled="benchRiskLoading || !benchData.bench?.length"
                  @click="loadBenchRisk"
                >
                  {{ benchRiskLoading ? 'AI 风控运行中…' : '运行 AI 风控' }}
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
                      <th>AI风控</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in benchData.bench" :key="row.symbol">
                      <td>{{ row.rank }}</td>
                      <td>{{ row.symbol }}</td>
                      <td>{{ row.name || '-' }}</td>
                      <td>{{ row.industry || '-' }}</td>
                      <td>{{ num(row.score_value) }}</td>
                      <td>{{ num(row.latest_close) }}</td>
                      <td>
                        <span
                          v-if="benchRiskBySymbol[row.symbol]"
                          class="risk-badge"
                          :class="`risk-${benchRiskBySymbol[row.symbol].severity}`"
                          :title="(benchRiskBySymbol[row.symbol].reasons || []).join('、')"
                        >
                          {{ riskSeverityLabel(benchRiskBySymbol[row.symbol].severity) }}
                        </span>
                        <span v-else class="muted">-</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-else class="muted">暂无替补候选。</p>
            </template>
          </div>
        </section>
      </section>

      <div v-if="showSwapModal" class="modal-backdrop" @click.self="showSwapModal = false">
        <div class="modal-card modal-wide">
          <h3>替补换股</h3>
          <p class="muted">
            换下 <strong>{{ swapStarter?.symbol }}</strong>（{{ swapStarter?.name || '-' }}），从替补席选择上场球员。
            仅本次生效，预览确认后立即下单。
          </p>
          <div class="bench-risk-bar">
            <span v-if="benchRisk" class="bench-risk-summary">
              AI风控：<b class="risk-high">{{ benchRisk.high || 0 }}高</b>
              / <b class="risk-medium">{{ benchRisk.medium || 0 }}中</b>
              / <b class="risk-low">{{ benchRisk.low || 0 }}低</b>
            </span>
            <span v-else class="muted">未体检；高风险候选上场前会二次确认。</span>
            <button
              type="button"
              class="link-btn"
              :disabled="benchRiskLoading || !benchData?.bench?.length"
              @click="loadBenchRisk"
            >
              {{ benchRiskLoading ? 'AI 风控运行中…' : '运行 AI 风控' }}
            </button>
          </div>
          <div v-if="benchData?.bench?.length" class="table-wrap">
            <table class="lineup-table">
              <thead>
                <tr>
                  <th>排名</th>
                  <th>代码</th>
                  <th>名称</th>
                  <th>分数</th>
                  <th>最新收盘</th>
                  <th>AI风控</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in benchData.bench" :key="row.symbol">
                  <td>{{ row.rank }}</td>
                  <td>{{ row.symbol }}</td>
                  <td>{{ row.name || '-' }}</td>
                  <td>{{ num(row.score_value) }}</td>
                  <td>{{ num(row.latest_close) }}</td>
                  <td>
                    <span
                      v-if="benchRiskBySymbol[row.symbol]"
                      class="risk-badge"
                      :class="`risk-${benchRiskBySymbol[row.symbol].severity}`"
                      :title="(benchRiskBySymbol[row.symbol].reasons || []).join('、')"
                    >
                      {{ riskSeverityLabel(benchRiskBySymbol[row.symbol].severity) }}
                    </span>
                    <span v-else class="muted">-</span>
                  </td>
                  <td>
                    <button type="button" class="link-btn" :disabled="fastActionSubmitting" @click="previewSwap(row)">
                      替补上场
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="muted">替补席为空，无法换股。</p>
          <p v-if="swapError" class="modal-error">{{ swapError }}</p>
          <div class="modal-actions">
            <button type="button" @click="showSwapModal = false">取消</button>
          </div>
        </div>
      </div>

      <div v-if="showFastActionModal" class="modal-backdrop" @click.self="showFastActionModal = false">
        <div class="modal-card">
          <h3>{{ fastActionPreview.title }}</h3>
          <p class="muted">{{ fastActionPreview.description }}</p>
          <ul v-if="fastActionPreview.items?.length" class="manual-preview">
            <li v-for="item in fastActionPreview.items" :key="item.symbol">
              {{ item.symbol }} {{ item.name || '' }}：
              {{ item.current_shares }} → {{ item.target_shares }}
              （{{ formatShareDelta(item.delta_shares) }}）
              <span v-if="item.blockers?.length" class="warning-text"> · {{ item.blockers.join('、') }}</span>
            </li>
          </ul>
          <p v-if="fastActionPreview.blocked" class="warning-text">风控拦截，无法提交。</p>
          <div class="modal-actions">
            <button type="button" @click="showFastActionModal = false">取消</button>
            <button
              type="button"
              :disabled="fastActionSubmitting || fastActionPreview.blocked || !fastActionPreview.items?.length"
              @click="confirmFastAction"
            >
              {{ fastActionSubmitting ? '提交中…' : (isLivePortfolio ? '确认并下单' : '确认执行') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="showManualModal" class="modal-backdrop" @click.self="showManualModal = false">
        <div class="modal-card">
          <h3>确认手动调仓</h3>
          <p v-if="isLivePortfolio" class="muted">
            实盘组合：将按实盘持仓即时下发买/卖委托（交易器盘中约 1 秒轮询执行），并落一条 origin=manual 计划留痕。
          </p>
          <p v-else class="muted">
            纸面组合：将按当前纸面持仓即时按<strong>实时价</strong>成交买/卖，并写入纸面快照/净值；同时落一条 origin=manual 计划留痕。
          </p>
          <p v-if="holdingsRiskBySymbolHigh.length" class="muted">高风险标的已默认清仓，可在上方表格调整目标股数。</p>
          <ul class="manual-preview">
            <li v-for="row in manualChangeRows" :key="row.symbol">
              {{ row.symbol }} {{ row.name || '' }}：
              {{ row.shares }} → {{ row.target }}
              （{{ formatShareDelta(row.delta) }}）
            </li>
          </ul>
          <p v-if="willPauseAfterManual" class="warning-text">全部卖空后将暂停该组合自动调仓。</p>
          <label class="checkbox-row">
            <input v-model="excludeAfter" type="checkbox">
            将卖出的标的加入排除名单（下次策略调仓不再买回）
          </label>
          <div class="modal-actions">
            <button type="button" @click="showManualModal = false">取消</button>
            <button type="button" :disabled="manualSubmitting" @click="submitManualRebalance">
              {{ manualSubmitting ? '提交中…' : (isLivePortfolio ? '确认并下单' : '确认生成计划') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="showLiquidateModal" class="modal-backdrop" @click.self="showLiquidateModal = false">
        <div class="modal-card">
          <h3>{{ isLivePortfolio ? '确认实盘清仓' : '确认纸面清仓' }}</h3>
          <p v-if="isLivePortfolio" class="muted">
            将按实盘持仓即时下发<strong>卖出</strong>信号，交易器盘中（约 1 秒轮询）提交券商执行；
            同时落一条 origin=manual 的清仓计划留痕。跌停等市场原因卖不出由市场决定，不会拦截。
          </p>
          <p v-else class="muted">
            将按当前纸面持仓即时按<strong>实时价</strong>成交清仓，并写入纸面快照/净值；同时落一条 origin=manual 计划留痕。
          </p>
          <ul class="manual-preview">
            <li v-for="sym in liquidateTargets" :key="sym">
              {{ sym }} {{ holdingNameBySymbol[sym] || '' }}：{{ holdingSharesBySymbol[sym] || 0 }} → 0
            </li>
          </ul>
          <p v-if="!liquidateTargets.length" class="warning-text">没有可清仓的持仓。</p>
          <label class="checkbox-row">
            <input v-model="liquidateExcludeAfter" type="checkbox">
            将清仓标的加入排除名单（下次策略调仓不再买回）
          </label>
          <div class="modal-actions">
            <button type="button" @click="showLiquidateModal = false">取消</button>
            <button
              type="button"
              class="danger"
              :disabled="liquidateSubmitting || !liquidateTargets.length"
              @click="submitLiveLiquidate"
            >
              {{ liquidateSubmitting ? '提交中…' : (isLivePortfolio ? '确认清仓并下单' : '确认清仓') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="showExternalManualModal" class="modal-backdrop" @click.self="showExternalManualModal = false">
        <div class="modal-card wide">
          <h3>补录 miniQMT 手工操作</h3>
          <p class="muted">
            用于你已经在 miniQMT 直接买/卖的情况。这里不会再下单，只会把成交补进组合实盘账本留痕；
            支持部分减仓/加仓或全部清仓。只需填方向、数量和成交价，费用默认 0，成交时间/批次号/说明由系统自动填充。
          </p>
          <div class="table-wrap compact external-fill-table">
            <table>
              <thead>
                <tr>
                  <th>方向</th>
                  <th>代码</th>
                  <th>名称</th>
                  <th>数量</th>
                  <th>成交价</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in externalManualRows" :key="row.key">
                  <td>
                    <select
                      :value="row.action"
                      @change="updateExternalManualRow(idx, 'action', $event.target.value)"
                    >
                      <option value="sell">卖出</option>
                      <option value="buy">买入</option>
                    </select>
                  </td>
                  <td>
                    <span v-if="!row.editableSymbol">{{ row.symbol }}</span>
                    <input
                      v-else
                      :value="row.symbol"
                      type="text"
                      placeholder="如 600000.SH"
                      @input="updateExternalManualRow(idx, 'symbol', $event.target.value)"
                    >
                  </td>
                  <td>{{ row.name || '-' }}</td>
                  <td>
                    <input
                      :value="row.filled_size"
                      type="number"
                      min="1"
                      step="100"
                      @input="updateExternalManualRow(idx, 'filled_size', $event.target.value)"
                    >
                  </td>
                  <td>
                    <input
                      :value="row.filled_price"
                      type="number"
                      min="0.01"
                      step="0.01"
                      @input="updateExternalManualRow(idx, 'filled_price', $event.target.value)"
                    >
                  </td>
                  <td>
                    <button type="button" class="link-btn" @click="removeExternalManualRow(idx)">移除</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <button type="button" class="add-row-btn" @click="addExternalManualRow">+ 添加一笔</button>
          <p class="muted">
            结果持仓 = 当前持仓 + 手工买入 − 手工卖出。默认只更新账本，不影响后续策略调仓建议。
          </p>
          <label class="checkbox-row">
            <input v-model="externalManualExcludeAfter" type="checkbox">
            将清空（卖到 0）的标的加入排除名单（通常不需要）
          </label>
          <label class="checkbox-row">
            <input v-model="externalManualPauseLineage" type="checkbox">
            若清空全部持仓，则暂停该组合自动调仓（通常不需要）
          </label>
          <div class="modal-actions">
            <button type="button" @click="showExternalManualModal = false">取消</button>
            <button
              type="button"
              :disabled="externalManualSubmitting || !externalManualReady"
              @click="submitExternalManual"
            >
              {{ externalManualSubmitting ? '补录中…' : '确认补录' }}
            </button>
          </div>
        </div>
      </div>

      <section>
        <h3>{{ isLivePortfolio ? '实盘成交明细' : '纸面成交明细' }}</h3>
        <div v-if="!tradeDetailRows.length" class="muted">暂无成交记录。</div>
        <div v-else class="table-wrap compact">
          <table>
            <thead>
              <tr>
                <th>调仓日</th>
                <th>代码</th>
                <th>名称</th>
                <th>买入日</th>
                <th>买价</th>
                <th>卖出日</th>
                <th>卖价</th>
                <th>数量</th>
                <th>买入额</th>
                <th>持有收益</th>
                <th>净盈亏</th>
                <th>费用</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in tradeDetailRows" :key="`${row.trade_id || row.buy_order_id || row.symbol}-${idx}`" :class="{ 'open-trade': row.status === 'open' }">
                <td>{{ row.rebalance_date || '-' }}</td>
                <td>{{ row.symbol || '-' }}</td>
                <td>{{ row.name || '-' }}</td>
                <td>{{ row.buy_date || '-' }}</td>
                <td>{{ num(row.buy_price) }}</td>
                <td>{{ row.sell_date || '-' }}</td>
                <td>
                  <span v-if="row.status === 'open'" class="badge-open">持有中</span>
                  <span v-else>{{ num(row.sell_price) }}</span>
                </td>
                <td>{{ money(row.quantity) }}</td>
                <td>{{ money(row.buy_amount) }}</td>
                <td :class="signClass(row.holding_return)">{{ pct(row.holding_return) }}</td>
                <td :class="signClass(row.net_pnl)">{{ signedMoney(row.net_pnl) }}</td>
                <td>{{ money(row.fee) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="totals-row">
                <td colspan="8">合计（{{ tradeTotals.count }} 笔 · 已平 {{ tradeTotals.closedCount }} / 持有 {{ tradeTotals.openCount }}）</td>
                <td>{{ money(tradeTotals.buyAmount) }}</td>
                <td></td>
                <td :class="signClass(tradeTotals.netPnl)">{{ signedMoney(tradeTotals.netPnl) }}</td>
                <td>{{ money(tradeTotals.fee) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p v-if="tradeDetailRows.length" class="muted combo-note">
          成交明细按 <strong>FIFO（先进先出）</strong> 将每笔卖出与对应买入批次配对，一行为一段往返；未平仓部分以“持有中”行按最新价估算浮动盈亏。
          <template v-if="isLivePortfolio">
            上方汇总卡片的「已实现盈亏」按<strong>加权平均成本法</strong>计算，与本表净盈亏合计在分批建仓/部分卖出时口径不同，全部平仓后两者一致。
          </template>
          <template v-else>
            纸面成交来自各调仓日开盘价模拟执行（portfolio_paper_executions），不含佣金。
          </template>
        </p>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import {
  approvePortfolioPlan,
  cancelPortfolioPlan,
  executePortfolioPlanPaper,
  forceRebalanceLineage,
  getLineageLiveEquity,
  getLineageLiveExecutions,
  getLineageLivePositions,
  getLineagePaperExecutions,
  getLineagePaperPositions,
  getPortfolioPlanBench,
  reconcilePortfolioHoldings,
  liveRebalancePortfolio,
  paperRebalancePortfolio,
  enqueuePortfolioHoldingsRisk,
  enqueuePortfolioBenchRisk,
  getPortfolioPlan,
  getPortfolioPlanGenerationTask,
  getPortfolioPlanLineageEquity,
  getPortfolioPlanLineageTimeline,
  listPortfolios,
  publishPortfolioPlanLiveSignals,
  recordExternalManualRecord,
  rejectPortfolioPlan,
  replanPortfolioPlanRemainder,
  rerunPortfolioPlanAiRisk,
  resumePortfolioLineage,
} from '../api/portfolioPlans'
import { getSecuritiesAccounts } from '../api/trader'

const portfolios = ref([])
const selectedPortfolioKey = ref('')
const loadingList = ref(false)
const loadingDetail = ref(false)
const message = ref('')
const messageIsError = ref(false)

const equityRows = ref([])
const equityCaveat = ref('')
const bookEquity = ref(null)
const positionRows = ref([])
const positionSummary = ref(null)
const tradeRows = ref([])
const timelineData = ref(null)
const latestPlanDetail = ref(null)
const expandedTimelinePlanId = ref(null)
const holdingsRisk = ref(null)
const manualTargets = ref({})
const excludeAfter = ref(false)
const showManualModal = ref(false)
const manualSubmitting = ref(false)
const riskLoading = ref(false)
const showLiquidateModal = ref(false)
const liquidateSubmitting = ref(false)
const liquidateExcludeAfter = ref(true)
const liquidateTargets = ref([])
const showExternalManualModal = ref(false)
const externalManualSubmitting = ref(false)
const externalManualRows = ref([])
const externalManualExcludeAfter = ref(true)
const externalManualPauseLineage = ref(true)
const externalManualReason = ref('miniQMT manual operation')
const externalManualBatchId = ref('')
let externalManualRowSeq = 0

const benchData = ref(null)
const benchLoading = ref(false)
const benchRisk = ref(null)
const benchRiskLoading = ref(false)
const reconcileData = ref(null)
const benchExpanded = ref(false)
const showSwapModal = ref(false)
const swapStarter = ref(null)
const swapError = ref('')
const showFastActionModal = ref(false)
const fastActionSubmitting = ref(false)
const fastActionPreview = ref({ title: '', description: '', targets: {}, items: [], blocked: false })
const approveSubmitting = ref(false)
const rejectSubmitting = ref(false)
const reviewAiRiskLoading = ref(false)
const forceRebalanceSubmitting = ref(false)
const securitiesAccounts = ref([])
const selectedLiveAccountId = ref('')
const livePublishPreview = ref(null)
const livePublishLoading = ref(false)
const paperExecuteLoading = ref(false)
const cancelPlanLoading = ref(false)
const remainderPreview = ref(null)
const remainderLoading = ref(false)
const remainderReason = ref('')

const selectedPortfolio = computed(() => (
  portfolios.value.find((row) => portfolioKey(row) === selectedPortfolioKey.value) || null
))

const selectedLatestPlanId = computed(() => selectedPortfolio.value?.latest_plan_id || '')

const benchPlanId = computed(() => (
  timelineData.value?.latest_drift_summary?.plan_id || selectedLatestPlanId.value
))

const pendingActionPlan = computed(() => {
  const nodes = timelineData.value?.timeline || []
  return nodes.find((node) => node.action_required && node.status === 'needs_review') || null
})

const isLivePortfolio = computed(() => selectedPortfolio.value?.execution_venue === 'live')
const isPaperPortfolio = computed(() => selectedPortfolio.value?.execution_venue === 'paper')

const latestPlan = computed(() => latestPlanDetail.value?.plan || null)
const executionStatus = computed(() => latestPlanDetail.value?.execution_status || {})
const selectedPlanStatus = computed(() => latestPlan.value?.status || '')
const selectedPlanExecutionMode = computed(() => latestPlanDetail.value?.execution_mode || 'not_executed')
const liveExecutionContext = computed(() => latestPlanDetail.value?.live_execution_context || {})
const selectedPlanHasLiveSignals = computed(() => selectedPlanExecutionMode.value === 'live')
const selectedPlanLiveSignalCount = computed(() => Number(liveExecutionContext.value?.signal_count || 0))
const selectedPlanActiveLiveSignalCount = computed(() => Number(liveExecutionContext.value?.active_signal_count || 0))
const latestPlanItems = computed(() => latestPlanDetail.value?.items || [])
const paperExecutionCount = computed(() => Number(executionStatus.value?.execution_count || 0))
const hasPaperExecution = computed(() => Boolean(latestPlan.value?.paper_executed_at) || paperExecutionCount.value > 0)
const hasApprovedPlanAwaitingAction = computed(() => (
  selectedPlanStatus.value === 'approved'
  && !selectedPlanHasLiveSignals.value
  && !hasPaperExecution.value
))
const forceRebalanceBlockReason = computed(() => (
  hasApprovedPlanAwaitingAction.value
    ? '当前已有已批准计划，请先发布/执行或拒绝后再重新生成'
    : ''
))
const canExecutePaperNow = computed(() => (
  isPaperPortfolio.value
  && selectedPlanStatus.value === 'approved'
  && !selectedPlanHasLiveSignals.value
  && !hasPaperExecution.value
  && executionStatus.value?.open_price_ready !== false
))
const canPublishLiveSignals = computed(() => (
  isLivePortfolio.value
  && selectedPlanStatus.value === 'approved'
  && !selectedPlanHasLiveSignals.value
  && !hasPaperExecution.value
))
const canCancelCurrentPlan = computed(() => (
  selectedPlanStatus.value === 'approved'
  && !hasPaperExecution.value
))
const showPlanOpsPanel = computed(() => (
  Boolean(selectedLatestPlanId.value)
  && selectedPlanStatus.value === 'approved'
  && (isPaperPortfolio.value || isLivePortfolio.value)
))
const selectedPlanExecutionModeLabel = computed(() => {
  if (selectedPlanExecutionMode.value === 'live') {
    if (selectedPlanActiveLiveSignalCount.value > 0) {
      return `实盘信号在途 ${selectedPlanActiveLiveSignalCount.value}/${selectedPlanLiveSignalCount.value}`
    }
    return `有历史实盘信号（无在途，${selectedPlanLiveSignalCount.value} 条）`
  }
  if (selectedPlanExecutionMode.value === 'paper') return '已执行 Paper'
  return '未执行'
})
const paperExecuteReadyText = computed(() => {
  if (!isPaperPortfolio.value) return '仅纸面组合支持 Paper 执行'
  if (hasPaperExecution.value) return '该 plan 已执行过 Paper，不能重复执行'
  if (selectedPlanHasLiveSignals.value) return '该 plan 存在实盘信号历史，不能再执行 Paper'
  if (selectedPlanStatus.value !== 'approved') return '需要先审核通过 plan'
  if (executionStatus.value?.missing_execute_date) return '缺少 execute_date，请等待自动执行或先补齐下一交易日 execute_date'
  if (executionStatus.value?.open_price_ready === false) {
    const date = executionStatus.value.execute_date || executionStatus.value.effective_execute_date || '-'
    const count = executionStatus.value.missing_open_price_count ?? 0
    return `开盘价未就绪：execute_date=${date}，缺失 ${count} 个标的`
  }
  return '使用 execute_date 开盘价立即执行 Paper'
})
const cancelPlanReadyText = computed(() => {
  if (hasPaperExecution.value) return '该 plan 已执行 Paper，不能作废'
  if (selectedPlanStatus.value !== 'approved') return '只有 approved plan 可以作废'
  if (selectedPlanHasLiveSignals.value) return '该 plan 存在实盘信号历史；作废会取消未成交信号，若已有成交后端会拒绝'
  return '误点确认发布/审批后可作废；作废后状态变为 cancelled'
})
const liveAccountOptions = computed(() => securitiesAccounts.value.map((account) => ({
  id: account.id || account._id,
  label: `${account.broker || '-'} / ${account.account_id || '-'}${account.live_trading_enabled ? ' / live on' : ''}`,
})))
const livePublishBlockers = computed(() => {
  const items = livePublishPreview.value?.risk_report?.items || []
  return items.flatMap((item) => (item.blockers || []).map((blocker) => `${item.symbol}: ${blockerText(blocker)}`))
})
const livePublishRiskRows = computed(() => livePublishPreview.value?.risk_report?.items || [])
const remainderRows = computed(() => remainderPreview.value?.remainder || [])
const remainderActionableCount = computed(() => remainderPreview.value?.actionable_count || 0)
const remainderBlockers = computed(() => {
  const items = remainderPreview.value?.risk_report?.items || []
  return items.flatMap((item) => (item.blockers || []).map((blocker) => `${item.symbol}: ${blockerText(blocker)}`))
})
// Normalized plan target list (buy/sell/hold, skip filtered, score-sorted).
// AI risk (ai_risk) is written onto each item by the plan-generation worker, so
// it is available as soon as the plan exists — including while it is still
// needs_review. The display gating below is purely about *which lifecycle
// states* should surface this table, not about data availability.
const planTargetRows = computed(() => (
  latestPlanItems.value
    .map((item) => normalizePlanItemRow(item))
    .filter((item) => item.action !== 'skip')
    .sort((a, b) => {
      const order = { buy: 0, sell: 1, hold: 2, skip: 3 }
      const aScore = Number(a.score_value)
      const bScore = Number(b.score_value)
      const aHasScore = Number.isFinite(aScore)
      const bHasScore = Number.isFinite(bScore)
      if (aHasScore && bHasScore && bScore !== aScore) return bScore - aScore
      if (aHasScore !== bHasScore) return aHasScore ? -1 : 1
      return (order[a.action] ?? 9) - (order[b.action] ?? 9) || String(a.symbol).localeCompare(String(b.symbol))
    })
))
function summarizePlanRows(rows) {
  return rows.reduce(
    (acc, row) => {
      if (row.action === 'buy') acc.buy += 1
      else if (row.action === 'sell') acc.sell += 1
      else if (row.action === 'hold') acc.hold += 1
      return acc
    },
    { buy: 0, sell: 0, hold: 0 },
  )
}
const needsReviewPlan = computed(() => selectedPlanStatus.value === 'needs_review')
// Single source of truth for which plan the review card acts on. Prefer the
// timeline's action-required node, but fall back to the currently selected
// latest plan so approve/reject always target the plan the user is looking at.
const reviewPlanId = computed(() => pendingActionPlan.value?.plan_id || selectedLatestPlanId.value || '')
const planReviewRiskSummary = computed(() => planTargetRows.value.reduce(
  (acc, row) => {
    const severity = row.ai_risk?.severity
    if (severity === 'high') acc.high += 1
    else if (severity === 'medium') acc.medium += 1
    else if (severity === 'low') acc.low += 1
    return acc
  },
  { high: 0, medium: 0, low: 0 },
))
const pendingPlanRows = computed(() => (
  hasApprovedPlanAwaitingAction.value ? planTargetRows.value : []
))
const pendingPlanSummary = computed(() => summarizePlanRows(pendingPlanRows.value))
const planReviewSummary = computed(() => summarizePlanRows(planTargetRows.value))

const cycleProgressPct = computed(() => {
  const cycle = timelineData.value?.current_cycle
  if (!cycle?.rebalance_days) return 0
  const elapsed = Number(cycle.elapsed_trading_days || 0)
  return Math.min(100, Math.round((elapsed / cycle.rebalance_days) * 100))
})

const foldedTimeline = computed(() => {
  const nodes = timelineData.value?.timeline || []
  const folded = []
  let monitorRun = null
  for (const node of nodes) {
    const isPassiveMonitor = node.node_type === 'monitor' && !node.action_required
    if (isPassiveMonitor) {
      const drift = Number(node.drift_brief?.estimated_turnover || 0)
      if (!monitorRun) {
        monitorRun = {
          type: 'monitor_fold',
          start: node.date,
          end: node.date,
          count: 1,
          maxDrift: drift,
        }
      } else {
        monitorRun.end = node.date
        monitorRun.count += 1
        monitorRun.maxDrift = Math.max(monitorRun.maxDrift, drift)
      }
      continue
    }
    if (monitorRun) {
      folded.push(monitorRun)
      monitorRun = null
    }
    folded.push({ type: 'node', node })
  }
  if (monitorRun) folded.push(monitorRun)
  return folded
})

function portfolioKey(portfolio) {
  return `${portfolio.strategy_template_id}:${portfolio.params_hash}`
}

function portfolioOptionLabel(portfolio) {
  const name = portfolio.strategy_name || portfolio.strategy_template_id || '组合'
  const params = portfolio.param_summary || '参数未记录'
  const range = portfolio.first_base_date && portfolio.last_base_date
    ? `${portfolio.first_base_date}→${portfolio.last_base_date}`
    : (portfolio.last_base_date || '-')
  const hash = portfolio.params_hash_short || (portfolio.params_hash ? portfolio.params_hash.slice(0, 8) : '--------')
  const holdings = portfolio.execution_venue === 'paper'
    ? ` · 持仓${portfolio.paper_holding_count ?? 0}`
    : ''
  const account = portfolio.securities_account_id
    ? ` · 账户${portfolio.securities_account_id.slice(-6)}`
    : ''
  return `${name} · ${params} · ${range}（${portfolio.plan_count}期${holdings}${account} · #${hash}）`
}

function executionVenueLabel(venue) {
  if (venue === 'live') return '实盘'
  if (venue === 'paper') return '纸面'
  return venue || '-'
}

function shortPlanId(planId) {
  const text = String(planId || '')
  if (!text) return '-'
  if (text.length <= 28) return text
  return `${text.slice(0, 18)}…${text.slice(-8)}`
}

async function copyPlanId(planId) {
  const text = String(planId || '')
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    message.value = `已复制 plan_id：${text}`
    messageIsError.value = false
  } catch {
    message.value = `无法自动复制，请手动复制 plan_id：${text}`
    messageIsError.value = true
  }
}

function paperExecutionModeLabel(mode) {
  if (mode === 'auto_shadow') return '自动跟跑'
  if (mode === 'manual_review') return '人工审核'
  return mode || '-'
}

function blockerText(blocker) {
  const labels = {
    account_binding_missing: '账户绑定不完整',
    insufficient_available_position: '可卖持仓不足',
    insufficient_cash: '可用资金不足',
    limit_up: '已涨停',
    live_trading_disabled: '账户未开启实盘',
    max_daily_amount_exceeded: '超过单日交易金额上限',
    max_order_amount_exceeded: '超过单笔金额上限',
    max_position_pct_exceeded: '超过单票仓位上限',
    missing_price: '缺少有效价格',
    st_stock: 'ST 股票',
    suspended: '停牌',
  }
  return labels[blocker] || blocker || '-'
}

function remainderReasonText(reason) {
  const labels = {
    item_not_a_planned_trade: '非计划交易项',
    already_at_target: '已达目标',
    live_signal_active: '有在飞信号',
    reference_price_unavailable: '无可用价格',
    account_not_synced: '账户未同步',
    budget_capped: '预算封顶',
    cash_capped: '现金封顶',
    available_position_below_gap: '可卖持仓不足',
    estimated_price_missing: '缺计划价',
  }
  return labels[reason] || reason || '-'
}

function nodeTypeLabel(nodeType) {
  if (nodeType === 'rebalance') return '调仓'
  if (nodeType === 'manual') return '补录'
  return '观察'
}

function timelineEntryClass(entry) {
  if (entry.type === 'monitor_fold') return 'timeline-item timeline-fold'
  const node = entry.node
  if (node.action_required) return 'timeline-item timeline-strong'
  if (node.node_type === 'rebalance') return 'timeline-item timeline-strong'
  return 'timeline-item'
}

function timelineTradeItems(node) {
  return node?.drift_brief?.items || []
}

function toggleTimelineDetail(planId) {
  expandedTimelinePlanId.value = expandedTimelinePlanId.value === planId ? null : planId
}

function normalizePlanItemRow(item) {
  const current = Number(item?.current_shares ?? 0)
  const target = Number(item?.target_shares ?? 0)
  const rawDelta = item?.delta_shares ?? (target - current)
  const delta = Number(rawDelta || 0)
  let action = item?.action || ''
  if (!action) {
    if (delta > 0) action = 'buy'
    else if (delta < 0) action = 'sell'
    else if (target > 0) action = 'hold'
    else action = 'skip'
  }
  if (action === 'hold' && current > 0 && target > 0 && delta !== 0) {
    action = delta > 0 ? 'buy' : 'sell'
  }
  return {
    ...item,
    action,
    current_shares: current,
    target_shares: target,
    delta_shares: delta,
  }
}

function planItemActionLabel(action) {
  if (action === 'buy') return '买'
  if (action === 'sell') return '卖'
  if (action === 'hold') return '持'
  return '跳过'
}

function planItemActionClass(action) {
  if (action === 'buy') return 'tag-buy'
  if (action === 'sell') return 'tag-sell'
  if (action === 'hold') return 'tag-hold'
  return 'tag-skip'
}

function formatShareDelta(value) {
  const n = Number(value || 0)
  if (!Number.isFinite(n) || n === 0) return '0'
  return n > 0 ? `+${n}` : String(n)
}

function formatSyncedAt(value) {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  return new Date(seconds * 1000).toLocaleString()
}

const openBuyDateBySymbol = computed(() => {
  const map = {}
  for (const t of tradeRows.value) {
    if (t.status !== 'open' || !t.buy_date) continue
    const keys = [t.symbol, String(t.symbol || '').split('.')[0]]
    for (const key of keys) {
      if (!key) continue
      if (!map[key] || t.buy_date < map[key]) map[key] = t.buy_date
    }
  }
  return map
})

const latestHoldingRows = computed(() => (
  positionRows.value
    .filter((row) => Number(row.shares) > 0)
    .map((row) => ({
      ...row,
      buy_date:
        openBuyDateBySymbol.value[row.symbol] ||
        openBuyDateBySymbol.value[String(row.symbol || '').split('.')[0]] ||
        row.buy_date ||
        '',
    }))
    .sort((a, b) => Number(b.market_value || 0) - Number(a.market_value || 0))
))

const holdingsRiskBySymbol = computed(() => {
  const map = {}
  for (const row of holdingsRisk.value?.holdings || []) {
    if (row?.symbol) map[row.symbol] = row.ai_risk || {}
  }
  return map
})

const holdingsRiskBySymbolHigh = computed(() => (
  (holdingsRisk.value?.holdings || []).filter((row) => row?.ai_risk?.severity === 'high')
))

const benchRiskBySymbol = computed(() => {
  const map = {}
  for (const row of benchRisk.value?.symbols || []) {
    if (row?.symbol) map[row.symbol] = row.ai_risk || {}
  }
  return map
})

const holdingNameBySymbol = computed(() => {
  const map = {}
  for (const row of latestHoldingRows.value) map[row.symbol] = row.name || ''
  return map
})

const holdingSharesBySymbol = computed(() => {
  const map = {}
  for (const row of latestHoldingRows.value) map[row.symbol] = Number(row.shares || 0)
  return map
})

// Default target for an untouched holding: high-risk positions default to a
// suggested full liquidation (0) so the "risk found -> liquidate" flow is one
// click; everything else defaults to "keep current". An explicit user edit in
// manualTargets always wins.
function defaultTarget(symbol) {
  const current = Number(latestHoldingRows.value.find((h) => h.symbol === symbol)?.shares || 0)
  if (holdingsRiskBySymbol.value[symbol]?.severity === 'high') return 0
  return current
}

function effectiveTarget(symbol) {
  const override = manualTargets.value[symbol]
  if (override == null || override === '') return defaultTarget(symbol)
  return Number(override)
}

function setManualTarget(symbol, value) {
  const next = { ...manualTargets.value }
  next[symbol] = value === '' || value == null ? null : Number(value)
  manualTargets.value = next
}

const manualChangeRows = computed(() => (
  latestHoldingRows.value
    .map((row) => {
      const current = Number(row.shares || 0)
      const target = effectiveTarget(row.symbol)
      return { ...row, target, delta: target - current }
    })
    .filter((row) => row.delta !== 0)
))

const willPauseAfterManual = computed(() => {
  if (!latestHoldingRows.value.length) return false
  return latestHoldingRows.value.every((row) => effectiveTarget(row.symbol) === 0)
})

const externalManualReady = computed(() => (
  isLivePortfolio.value
    && externalManualRows.value.length > 0
    && externalManualRows.value.every((row) => (
      String(row.symbol || '').trim().length > 0
      && Number(row.filled_size) > 0
      && Number(row.filled_price) > 0
    ))
))

// Targets are derived from holdings + risk defaults, so a portfolio switch only
// needs to clear any prior manual overrides.
function syncManualTargets() {
  manualTargets.value = {}
}

function manualDelta(row) {
  return effectiveTarget(row.symbol) - Number(row.shares || 0)
}

function riskSeverityLabel(severity) {
  if (severity === 'high') return '高'
  if (severity === 'medium') return '中'
  if (severity === 'low') return '低'
  return '无'
}

function riskRowClass(symbol) {
  const severity = holdingsRiskBySymbol.value[symbol]?.severity
  return severity === 'high' ? 'risk-row-high' : ''
}

function formatRiskTime(value) {
  if (!value) return ''
  const text = String(value)
  return text.length >= 19 ? text.slice(0, 19).replace('T', ' ') : text
}

function openManualModal() {
  if (!manualChangeRows.value.length) return
  showManualModal.value = true
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// The heavy work (manual plan generation, holdings risk review) runs in the
// plan-generation worker. The API returns a task_id; poll it until terminal.
async function pollGenerationTask(taskId, { attempts = 90, intervalMs = 2000 } = {}) {
  for (let i = 0; i < attempts; i += 1) {
    const res = await getPortfolioPlanGenerationTask(taskId)
    const task = res.data || {}
    if (task.status === 'completed') return task
    if (task.status === 'failed') {
      throw new Error(task.error_message || '任务执行失败')
    }
    await sleep(intervalMs)
  }
  throw new Error('任务处理超时，请稍后到「组合交易计划」查看结果')
}

async function loadHoldingsRisk(force = false) {
  const planId = selectedLatestPlanId.value
  if (!planId) return
  if (!force && holdingsRisk.value) return
  riskLoading.value = true
  try {
    const res = await enqueuePortfolioHoldingsRisk(planId)
    const meta = res.data || {}
    const task = await pollGenerationTask(meta.task_id)
    // Merge worker result (holdings + risk) with the immediately-known control
    // flags (paused / excluded) returned by the enqueue call.
    holdingsRisk.value = {
      ...(task.result || {}),
      paused: meta.paused,
      excluded_symbols: meta.excluded_symbols || [],
      anchor_plan_id: meta.anchor_plan_id,
    }
    // High-risk holdings are picked up automatically via defaultTarget() ->
    // effectiveTarget().
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '持仓风控加载失败'
    messageIsError.value = true
  } finally {
    riskLoading.value = false
  }
}

async function submitManualRebalance() {
  const planId = selectedLatestPlanId.value
  if (!planId || !manualChangeRows.value.length) return
  // Both live and paper go through synchronous rebalance endpoints (immediate
  // execution); only the venue differs.
  await submitRebalance(buildTargetsFromRows(manualChangeRows.value), { excludeAfter: excludeAfter.value })
  excludeAfter.value = false
}

function buildTargetsFromRows(rows) {
  const targets = {}
  for (const row of rows) targets[row.symbol] = Number(row.target)
  return targets
}

function roundToLot(shares, lotSize = 100) {
  const lot = Math.max(1, Number(lotSize) || 100)
  const raw = Math.max(0, Math.floor(Number(shares) || 0))
  if (raw === 0) return 0
  return Math.floor(raw / lot) * lot
}

function estimateSwapBenchShares(starter, benchPlayer) {
  const lot = Number(benchData.value?.lot_size || 100)
  const aPrice = Number(starter?.estimated_price || 0)
  const bPrice = Number(benchPlayer?.latest_close || 0)
  const aShares = Number(starter?.target_shares || starter?.current_shares || 0)
  if (!aPrice || !bPrice || !aShares) return 0
  const amount = aShares * aPrice
  return roundToLot(amount / bPrice, lot)
}

function halfTargetShares(row) {
  const lot = Number(benchData.value?.lot_size || 100)
  const current = Number(row?.shares || 0)
  return roundToLot(current / 2, lot)
}

function openSwapModal(starter) {
  swapStarter.value = {
    ...starter,
    current_shares: starter?.current_shares ?? starter?.shares ?? 0,
    target_shares: effectiveTarget(starter?.symbol),
    estimated_price: starter?.estimated_price ?? starter?.last_price ?? starter?.price ?? 0,
  }
  swapError.value = ''
  showSwapModal.value = true
}

function openQuickReduceModal(row, targetShares) {
  const targets = { [row.symbol]: Math.max(0, Number(targetShares) || 0) }
  previewFastAction({
    title: targetShares === 0 ? '确认快思考清仓' : '确认快思考减仓',
    description: `${row.symbol} ${row.name || ''}：${row.shares} → ${targets[row.symbol]}（预览确认后立即下单）`,
    targets,
  })
}

async function previewSwap(benchPlayer) {
  const starter = swapStarter.value
  if (!starter || !benchPlayer) return
  swapError.value = ''
  // If AI risk flagged this substitute as high, make the coach confirm before
  // putting it on the field. Advisory only — they can still proceed.
  const benchRiskInfo = benchRiskBySymbol.value[benchPlayer.symbol]
  if (benchRiskInfo?.severity === 'high') {
    const reasons = (benchRiskInfo.reasons || []).join('、') || '高风险信号'
    const proceed = window.confirm(
      `AI 风控提示：替补 ${benchPlayer.symbol}（${benchPlayer.name || '-'}）为高风险——${reasons}。仍要换上吗？`
    )
    if (!proceed) return
  }
  const aPrice = Number(starter?.estimated_price || 0)
  const bPrice = Number(benchPlayer?.latest_close || 0)
  const aShares = Number(starter?.target_shares || starter?.current_shares || 0)
  if (!aPrice || !aShares) {
    swapError.value = `无法估算：首发 ${starter.symbol} 缺少目标股数或参考价。`
    return
  }
  if (!bPrice) {
    swapError.value = `无法估算：替补 ${benchPlayer.symbol} 暂无参考价（行情未同步）。`
    return
  }
  const benchShares = estimateSwapBenchShares(starter, benchPlayer)
  if (!benchShares) {
    swapError.value = `按 ${starter.symbol} 仓位金额估算 ${benchPlayer.symbol} 不足 1 手，无法换股。`
    return
  }
  const targets = {
    [starter.symbol]: 0,
    [benchPlayer.symbol]: benchShares,
  }
  const ok = await previewFastAction({
    title: '确认替补换股',
    description: `换下 ${starter.symbol}，换上 ${benchPlayer.symbol}（约 ${benchShares} 股）；仅本次生效。`,
    targets,
  })
  if (ok) showSwapModal.value = false
  else swapError.value = message.value || '预览失败，请重试。'
}

function normalizeFastPreviewItems(data) {
  return (data?.items || []).map((item) => ({
    symbol: item.symbol,
    name: item.name || '',
    current_shares: Number(item.current_shares || 0),
    target_shares: Number(item.target_shares || 0),
    delta_shares: Number(item.delta_shares || 0),
    blockers: item.blockers || [],
  }))
}

async function previewFastAction({ title, description, targets }) {
  fastActionSubmitting.value = true
  message.value = ''
  messageIsError.value = false
  try {
    const data = await submitRebalance(targets, { excludeAfter: false, dryRun: true })
    fastActionPreview.value = {
      title,
      description,
      targets,
      items: normalizeFastPreviewItems(data),
      blocked: Boolean(data?.blocked),
    }
    showFastActionModal.value = true
    return true
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '预览失败'
    messageIsError.value = true
    return false
  } finally {
    fastActionSubmitting.value = false
  }
}

async function confirmFastAction() {
  const targets = fastActionPreview.value.targets || {}
  if (!Object.keys(targets).length) return
  fastActionSubmitting.value = true
  try {
    await submitRebalance(targets, { excludeAfter: false, dryRun: false })
    showFastActionModal.value = false
    fastActionPreview.value = { title: '', description: '', targets: {}, items: [], blocked: false }
  } finally {
    fastActionSubmitting.value = false
  }
}

async function approvePendingPlan() {
  const planId = reviewPlanId.value
  if (!planId) return
  approveSubmitting.value = true
  message.value = ''
  messageIsError.value = false
  try {
    await approvePortfolioPlan(planId, { comment: 'approved from portfolio overview' })
    message.value = `计划 ${planId} 已审批通过。`
    await Promise.all([loadPortfolios(), refreshDetail()])
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '审批失败'
    messageIsError.value = true
  } finally {
    approveSubmitting.value = false
  }
}

async function rejectPendingPlan() {
  const planId = reviewPlanId.value
  if (!planId) return
  const reason = window.prompt('拒绝原因（可选，会记录到 plan review）：', '')
  if (reason === null) return
  rejectSubmitting.value = true
  message.value = ''
  messageIsError.value = false
  try {
    await rejectPortfolioPlan(planId, { comment: reason || 'rejected from portfolio overview' })
    message.value = `计划 ${planId} 已拒绝。`
    await Promise.all([loadPortfolios(), refreshDetail()])
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '拒绝失败'
    messageIsError.value = true
  } finally {
    rejectSubmitting.value = false
  }
}

async function rerunReviewAiRisk() {
  const planId = selectedLatestPlanId.value
  if (!planId) return
  reviewAiRiskLoading.value = true
  message.value = ''
  messageIsError.value = false
  try {
    const res = await rerunPortfolioPlanAiRisk(planId)
    const taskId = res.data?.task_id
    if (taskId) await pollGenerationTask(taskId)
    await refreshDetail()
    message.value = 'AI 风控已复检，标的风险等级已刷新。'
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || 'AI 风控复检失败'
    messageIsError.value = true
  } finally {
    reviewAiRiskLoading.value = false
  }
}

async function previewLivePublish() {
  const planId = selectedLatestPlanId.value
  if (!planId || !selectedLiveAccountId.value || !canPublishLiveSignals.value) return
  livePublishLoading.value = true
  message.value = ''
  messageIsError.value = false
  try {
    const res = await publishPortfolioPlanLiveSignals(planId, {
      securities_account_id: selectedLiveAccountId.value,
      dry_run: true,
    })
    livePublishPreview.value = res.data || {}
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '实盘发布预检失败'
    messageIsError.value = true
  } finally {
    livePublishLoading.value = false
  }
}

async function publishLiveSignals() {
  const planId = selectedLatestPlanId.value
  if (!planId || !selectedLiveAccountId.value || !canPublishLiveSignals.value) return
  livePublishLoading.value = true
  message.value = ''
  messageIsError.value = false
  try {
    const res = await publishPortfolioPlanLiveSignals(planId, {
      securities_account_id: selectedLiveAccountId.value,
      dry_run: false,
    })
    livePublishPreview.value = res.data || {}
    message.value = `已发布 ${res.data?.inserted_count ?? 0} 条 live signals，已有 ${res.data?.existing_count ?? 0} 条。`
    await Promise.all([loadPortfolios(), refreshDetail()])
  } catch (error) {
    const detail = error.response?.data?.detail
    livePublishPreview.value = detail?.risk_report ? { risk_report: detail.risk_report, blocked: true } : livePublishPreview.value
    message.value = formatApiDetail(detail) || error.message || '实盘发布失败'
    messageIsError.value = true
  } finally {
    livePublishLoading.value = false
  }
}

async function previewRemainder() {
  const planId = selectedLatestPlanId.value
  if (!planId || !selectedLiveAccountId.value) return
  remainderLoading.value = true
  message.value = ''
  messageIsError.value = false
  try {
    const res = await replanPortfolioPlanRemainder(planId, {
      securities_account_id: selectedLiveAccountId.value,
      dry_run: true,
      reason: remainderReason.value || '',
    })
    remainderPreview.value = res.data || {}
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '补缺口预检失败'
    messageIsError.value = true
  } finally {
    remainderLoading.value = false
  }
}

async function confirmRemainder() {
  const planId = selectedLatestPlanId.value
  if (!planId || !selectedLiveAccountId.value) return
  remainderLoading.value = true
  message.value = ''
  messageIsError.value = false
  try {
    const res = await replanPortfolioPlanRemainder(planId, {
      securities_account_id: selectedLiveAccountId.value,
      dry_run: false,
      reason: remainderReason.value || '',
    })
    remainderPreview.value = res.data || {}
    message.value = `已补发 ${res.data?.inserted_count ?? 0} 条 plan_topup 信号。`
    await Promise.all([loadPortfolios(), refreshDetail()])
  } catch (error) {
    const detail = error.response?.data?.detail
    remainderPreview.value = detail?.risk_report
      ? { ...(remainderPreview.value || {}), risk_report: detail.risk_report, blocked: true }
      : remainderPreview.value
    message.value = formatApiDetail(detail) || error.message || '补缺口失败'
    messageIsError.value = true
  } finally {
    remainderLoading.value = false
  }
}

async function executePaperNow() {
  const planId = selectedLatestPlanId.value
  if (!planId || !canExecutePaperNow.value) return
  paperExecuteLoading.value = true
  message.value = ''
  messageIsError.value = false
  try {
    const res = await executePortfolioPlanPaper(planId, { force: false })
    const status = res.data?.status || 'executed_paper'
    message.value = `Paper 执行已触发：${status}。`
    await Promise.all([loadPortfolios(), refreshDetail()])
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '执行 Paper 失败'
    messageIsError.value = true
  } finally {
    paperExecuteLoading.value = false
  }
}

async function cancelCurrentPlan() {
  const planId = selectedLatestPlanId.value
  if (!planId || !canCancelCurrentPlan.value) return
  const ok = window.confirm(
    '确定作废当前计划吗？如果已发布 live signals 且尚未成交，会一起标记为 cancelled；如果已有成交，后端会拒绝作废。'
  )
  if (!ok) return
  cancelPlanLoading.value = true
  message.value = ''
  messageIsError.value = false
  try {
    const res = await cancelPortfolioPlan(planId, { comment: 'cancelled from portfolio overview' })
    const count = res.data?.cancelled_signal_count ?? 0
    message.value = `计划 ${planId} 已作废，取消 ${count} 条未成交 live signals。`
    await Promise.all([loadPortfolios(), refreshDetail()])
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '作废计划失败'
    messageIsError.value = true
  } finally {
    cancelPlanLoading.value = false
  }
}

async function submitForceRebalance() {
  const planId = selectedLatestPlanId.value
  if (!planId) return
  if (forceRebalanceBlockReason.value) {
    message.value = forceRebalanceBlockReason.value
    messageIsError.value = true
    return
  }
  forceRebalanceSubmitting.value = true
  message.value = ''
  messageIsError.value = false
  let taskId = ''
  try {
    const res = await forceRebalanceLineage(planId, {})
    taskId = res.data?.task_id || ''
    message.value = '已提交立即调仓任务，正在等待 worker 生成计划…'
    const task = await pollGenerationTask(taskId)
    const newPlanId = task.plan_id || task.result?.plan_id
    message.value = newPlanId
      ? `已提交立即调仓，新计划 ${newPlanId} 待审批。`
      : '已提交立即调仓任务，请稍后刷新查看新计划。'
    await Promise.all([loadPortfolios(), refreshDetail()])
  } catch (error) {
    const detail = formatApiDetail(error.response?.data?.detail) || error.message || '立即调仓提交失败'
    if (detail.includes('任务处理超时')) {
      message.value = taskId
        ? `任务 ${taskId} 已提交，worker 仍在后台生成计划；请稍后刷新组合总览或到「组合交易计划」查看结果。`
        : '立即调仓任务已提交，worker 仍在后台生成计划；请稍后刷新查看结果。'
      messageIsError.value = false
      await Promise.all([loadPortfolios(), refreshDetail()])
    } else {
      message.value = detail
      messageIsError.value = true
    }
  } finally {
    forceRebalanceSubmitting.value = false
  }
}

async function loadBench() {
  const planId = benchPlanId.value
  if (!planId) {
    benchData.value = null
    return
  }
  benchLoading.value = true
  // A new lineup invalidates any prior bench risk snapshot (different pool).
  benchRisk.value = null
  try {
    const res = await getPortfolioPlanBench(planId, { bench_multiplier: 1.5 })
    benchData.value = res.data || null
  } catch (error) {
    benchData.value = null
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '加载阵容失败'
    messageIsError.value = true
  } finally {
    benchLoading.value = false
  }
}

// Run the AI risk pass over the bench candidates (mirror of holdings 风控体检).
// Advisory only: surfaces per-symbol severity so the coach can vet a substitute
// before swapping it onto the field.
async function loadBenchRisk() {
  const planId = benchPlanId.value
  if (!planId) return
  benchRiskLoading.value = true
  message.value = ''
  messageIsError.value = false
  try {
    const res = await enqueuePortfolioBenchRisk(planId, { bench_multiplier: 1.5 })
    const task = await pollGenerationTask(res.data?.task_id)
    benchRisk.value = task.result || {}
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '替补风控加载失败'
    messageIsError.value = true
  } finally {
    benchRiskLoading.value = false
  }
}

// Live-only: warn when the system ledger disagrees with the broker's synced
// positions (e.g. a manual miniQMT trade not yet recorded). Best-effort; a
// failure here must not block the rest of the overview.
async function loadReconcile() {
  reconcileData.value = null
  if (!isLivePortfolio.value) return
  const planId = selectedLatestPlanId.value
  if (!planId) return
  try {
    const res = await reconcilePortfolioHoldings(planId)
    reconcileData.value = res.data || null
  } catch (error) {
    reconcileData.value = null
  }
}

const holdingsOutOfSync = computed(() => (
  Boolean(reconcileData.value?.applicable) && reconcileData.value?.in_sync === false
))

// Unified synchronous rebalance submit (reduce / clear / add). Routes to the
// live (broker signals) or paper (paper-book fill) endpoint based on the
// portfolio venue. Used by both the manual-rebalance flow and the one-click
// clear shortcut.
async function submitRebalance(targets, { excludeAfter = false, dryRun = false } = {}) {
  if (isLivePortfolio.value) {
    return submitLiveRebalance(targets, { excludeAfter, dryRun })
  }
  return submitPaperRebalance(targets, { excludeAfter, dryRun })
}

async function submitPaperRebalance(targets, { excludeAfter = false, dryRun = false } = {}) {
  const planId = selectedLatestPlanId.value
  if (!planId || !Object.keys(targets || {}).length) return null
  if (!dryRun) {
    manualSubmitting.value = true
    liquidateSubmitting.value = true
  }
  message.value = ''
  messageIsError.value = false
  try {
    const res = await paperRebalancePortfolio(planId, {
      targets,
      exclude_after: excludeAfter,
      dry_run: dryRun,
    })
    const data = res.data || {}
    if (dryRun) return data
    showManualModal.value = false
    showLiquidateModal.value = false
    const count = data.changed_symbols?.length || 0
    const label = data.manual_action === 'liquidate' ? '纸面清仓' : '纸面调仓'
    message.value = `已完成${label}：${count} 只标的按实时价即时成交（${data.status === 'partially_executed' ? '部分成交' : '全部成交'}）。`
    if (data.status === 'partially_executed') messageIsError.value = true
    await Promise.all([loadPortfolios(), refreshDetail()])
    return data
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '纸面调仓提交失败'
    messageIsError.value = true
    throw error
  } finally {
    if (!dryRun) {
      manualSubmitting.value = false
      liquidateSubmitting.value = false
    }
  }
}

// Shared synchronous live-rebalance submit (reduce / clear / add). Used by both
// the live manual-rebalance flow and the one-click clear shortcut.
async function submitLiveRebalance(targets, { excludeAfter = false, dryRun = false } = {}) {
  const planId = selectedLatestPlanId.value
  const accountId = selectedPortfolio.value?.securities_account_id
  if (!planId || !Object.keys(targets || {}).length) return null
  if (!accountId) {
    message.value = '该组合未绑定券商账户，无法实盘下单。'
    messageIsError.value = true
    showManualModal.value = false
    showLiquidateModal.value = false
    return null
  }
  if (!dryRun) {
    manualSubmitting.value = true
    liquidateSubmitting.value = true
  }
  message.value = ''
  messageIsError.value = false
  try {
    const res = await liveRebalancePortfolio(planId, {
      securities_account_id: accountId,
      targets,
      exclude_after: excludeAfter,
      dry_run: dryRun,
    })
    const data = res.data || {}
    if (dryRun) return data
    showManualModal.value = false
    showLiquidateModal.value = false
    const count = data.changed_symbols?.length || 0
    const inserted = data.inserted_count ?? (data.new_signals?.length || 0)
    const label = data.manual_action === 'liquidate' ? '实盘清仓' : '实盘调仓'
    message.value = `已提交${label}：${count} 只标的、${inserted} 笔委托已下发，交易器盘中执行。`
    await Promise.all([loadPortfolios(), refreshDetail()])
    return data
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '实盘下单提交失败'
    messageIsError.value = true
    throw error
  } finally {
    if (!dryRun) {
      manualSubmitting.value = false
      liquidateSubmitting.value = false
    }
  }
}

// Symbols flagged for full clear: any held position whose effective target is 0
// (high-risk holdings auto-default to 0, see defaultTarget). Reuses the same
// selection model as manual rebalance so "风控发现 -> 一键清仓" is one flow.
function openLiquidateModal() {
  const zeroed = latestHoldingRows.value
    .filter((row) => Number(row.shares || 0) > 0 && effectiveTarget(row.symbol) === 0)
    .map((row) => row.symbol)
  const fallbackAll = latestHoldingRows.value
    .filter((row) => Number(row.shares || 0) > 0)
    .map((row) => row.symbol)
  liquidateTargets.value = zeroed.length ? zeroed : fallbackAll
  liquidateExcludeAfter.value = true
  showLiquidateModal.value = true
}

async function submitLiveLiquidate() {
  if (!liquidateTargets.value.length) return
  const targets = {}
  for (const symbol of liquidateTargets.value) targets[symbol] = 0
  await submitRebalance(targets, { excludeAfter: liquidateExcludeAfter.value })
}

function compactDateTimeForBatch(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('')
}

function openExternalManualModal() {
  if (!isLivePortfolio.value) return
  const now = new Date()
  externalManualRowSeq = 0
  // Pre-fill current holdings as sell rows (the common "I cleared/reduced in
  // miniQMT" case); rows can be edited, removed, or new buy rows added.
  externalManualRows.value = latestHoldingRows.value.map((row) => ({
    key: `row-${externalManualRowSeq += 1}`,
    symbol: row.symbol,
    name: row.name || '',
    action: 'sell',
    filled_size: Number(row.shares || 0),
    filled_price: Number(row.last_price || row.avg_cost || 0),
    editableSymbol: false,
  }))
  externalManualExcludeAfter.value = false
  externalManualPauseLineage.value = false
  externalManualReason.value = 'miniQMT manual operation'
  externalManualBatchId.value = `miniqmt-manual-${compactDateTimeForBatch(now)}`
  showExternalManualModal.value = true
}

function addExternalManualRow() {
  externalManualRows.value = [
    ...externalManualRows.value,
    {
      key: `row-${externalManualRowSeq += 1}`,
      symbol: '',
      name: '',
      action: 'buy',
      filled_size: 100,
      filled_price: 0,
      editableSymbol: true,
    },
  ]
}

function removeExternalManualRow(index) {
  externalManualRows.value = externalManualRows.value.filter((_, idx) => idx !== index)
}

function updateExternalManualRow(index, field, value) {
  const rows = externalManualRows.value.map((row) => ({ ...row }))
  if (!rows[index]) return
  if (['filled_size', 'filled_price'].includes(field)) {
    rows[index][field] = value === '' ? '' : Number(value)
  } else if (field === 'symbol') {
    rows[index][field] = String(value || '').trim().toUpperCase()
  } else {
    rows[index][field] = value
  }
  externalManualRows.value = rows
}

function externalFillPayload(row) {
  return {
    symbol: String(row.symbol || '').trim(),
    action: row.action === 'buy' ? 'buy' : 'sell',
    filled_size: Number(row.filled_size),
    filled_price: Number(row.filled_price),
    commission: 0,
    name: row.name || '',
  }
}

async function submitExternalManual() {
  const planId = selectedLatestPlanId.value
  const accountId = selectedPortfolio.value?.securities_account_id
  if (!planId || !accountId || !externalManualReady.value) return
  externalManualSubmitting.value = true
  message.value = ''
  messageIsError.value = false
  try {
    const res = await recordExternalManualRecord(planId, {
      securities_account_id: accountId,
      external_batch_id: externalManualBatchId.value || undefined,
      reason: externalManualReason.value || 'miniQMT manual operation',
      pause_lineage: externalManualPauseLineage.value,
      exclude_after: externalManualExcludeAfter.value,
      fills: externalManualRows.value.map(externalFillPayload),
    })
    const data = res.data || {}
    showExternalManualModal.value = false
    if (data.already_recorded) {
      message.value = `该批次已补录过：${data.external_batch_id || externalManualBatchId.value}`
    } else {
      const count = data.inserted_execution_count || externalManualRows.value.length
      message.value = data.is_liquidation
        ? `已补录 miniQMT 手工操作：${count} 笔，组合账本已校准为空仓。`
        : `已补录 miniQMT 手工操作：${count} 笔，组合实盘账本已更新。`
    }
    messageIsError.value = false
    await Promise.all([loadPortfolios(), refreshDetail()])
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '补录手工操作失败'
    messageIsError.value = true
  } finally {
    externalManualSubmitting.value = false
  }
}

async function resumeLineageAction() {
  const planId = selectedLatestPlanId.value
  if (!planId) return
  manualSubmitting.value = true
  try {
    await resumePortfolioLineage(planId)
    message.value = '已恢复该组合的自动调仓。'
    messageIsError.value = false
    await loadPortfolios()
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '恢复失败'
    messageIsError.value = true
  } finally {
    manualSubmitting.value = false
  }
}

const equityRowsForChart = computed(() => {
  if (equityRows.value.length) return equityRows.value
  const currentEquity = Number(bookEquity.value?.equity)
  if (!Number.isFinite(currentEquity) || currentEquity <= 0) return []
  return [{ date: '当前估算', equity: currentEquity, estimated: true }]
})

const tradeDetailRows = computed(() => tradeRows.value)

const tradeTotals = computed(() => {
  const rows = tradeDetailRows.value
  let netPnl = 0
  let fee = 0
  let buyAmount = 0
  let closedCount = 0
  let openCount = 0
  for (const row of rows) {
    const pnl = Number(row.net_pnl)
    if (Number.isFinite(pnl)) netPnl += pnl
    const f = Number(row.fee)
    if (Number.isFinite(f)) fee += f
    const amt = Number(row.buy_amount)
    if (Number.isFinite(amt)) buyAmount += amt
    if (row.status === 'open') openCount += 1
    else closedCount += 1
  }
  return { count: rows.length, closedCount, openCount, netPnl, fee, buyAmount }
})

const hoverIndex = ref(null)
const equityGradId = `equityFill-${Math.random().toString(36).slice(2, 8)}`

function moneyShort(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  const abs = Math.abs(n)
  if (abs >= 1e8) return `${(n / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${(n / 1e4).toFixed(1)}万`
  return n.toFixed(0)
}

function shortDate(value) {
  const text = String(value || '')
  if (/^\d{8}$/.test(text)) return `${text.slice(4, 6)}-${text.slice(6, 8)}`
  return text
}

const equityChart = computed(() => {
  const rows = equityRowsForChart.value
  const width = 720
  const height = 260
  const plotLeft = 58
  const plotRight = width - 18
  const plotTop = 18
  const plotBottom = height - 28
  const empty = {
    width, height, plotLeft, plotRight, plotTop, plotBottom,
    linePoints: '', areaPath: '', coords: [], yTicks: [], xTicks: [],
    min: 0, max: 0, baseline: null, baselineY: null, up: true, latestReturn: null,
  }
  if (!rows.length) return empty

  const values = rows.map((row) => Number(row.equity)).filter((v) => Number.isFinite(v))
  if (!values.length) return empty
  const baselineRaw = Number(bookEquity.value?.initial_capital)
  const baseline = Number.isFinite(baselineRaw) && baselineRaw > 0 ? baselineRaw : values[0]

  let min = Math.min(...values, baseline)
  let max = Math.max(...values, baseline)
  if (max === min) { max += 1; min -= 1 }
  const headroom = (max - min) * 0.08
  min -= headroom
  max += headroom
  const span = max - min || 1

  const xAt = (index) =>
    rows.length === 1 ? (plotLeft + plotRight) / 2 : plotLeft + (index * (plotRight - plotLeft)) / (rows.length - 1)
  const yAt = (equity) => plotBottom - ((equity - min) * (plotBottom - plotTop)) / span

  const coords = rows.map((row, index) => {
    const equity = Number(row.equity)
    const prev = index > 0 ? Number(rows[index - 1].equity) : equity
    const dayPnl = index > 0 ? equity - prev : 0
    const dayPct = index > 0 && prev ? equity / prev - 1 : 0
    return {
      x: xAt(index),
      y: yAt(equity),
      date: row.date,
      equity,
      dayPnl,
      dayPct,
      cumPnl: equity - baseline,
      cumPct: baseline ? equity / baseline - 1 : 0,
    }
  })

  const linePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const areaPath = coords.length > 1
    ? `M ${coords[0].x.toFixed(1)},${plotBottom} ` +
      coords.map((c) => `L ${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ') +
      ` L ${coords[coords.length - 1].x.toFixed(1)},${plotBottom} Z`
    : ''

  const tickCount = 4
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const value = min + (span * i) / tickCount
    return { value, y: yAt(value), label: moneyShort(value) }
  })

  const labelCount = Math.min(rows.length, 5)
  const xTicks = Array.from({ length: labelCount }, (_, i) => {
    const index = labelCount === 1 ? 0 : Math.round((i * (rows.length - 1)) / (labelCount - 1))
    const c = coords[index]
    const anchor = i === 0 ? 'start' : i === labelCount - 1 ? 'end' : 'middle'
    return { x: c.x, text: shortDate(c.date), anchor }
  })

  const first = values[0]
  const latest = values[values.length - 1]
  return {
    width, height, plotLeft, plotRight, plotTop, plotBottom,
    linePoints, areaPath, coords, yTicks, xTicks,
    min, max,
    baseline,
    baselineY: yAt(baseline),
    up: latest >= baseline,
    latestReturn: first ? latest / first - 1 : null,
  }
})

const hoverPoint = computed(() => {
  const chart = equityChart.value
  const i = hoverIndex.value
  if (i == null || !chart.coords[i]) return null
  const c = chart.coords[i]
  const leftPct = Math.max(14, Math.min(86, (c.x / chart.width) * 100))
  return { ...c, tipStyle: { left: `${leftPct}%` } }
})

function onChartMove(event) {
  const chart = equityChart.value
  const n = chart.coords.length
  if (!n) { hoverIndex.value = null; return }
  const rect = event.currentTarget.getBoundingClientRect()
  if (!rect.width) return
  const frac = (event.clientX - rect.left) / rect.width
  const left = chart.plotLeft / chart.width
  const right = chart.plotRight / chart.width
  const t = Math.max(0, Math.min(1, (frac - left) / (right - left || 1)))
  hoverIndex.value = Math.round(t * (n - 1))
}

function onChartLeave() {
  hoverIndex.value = null
}

function money(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) : '-'
}

function num(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : '-'
}

function signedMoney(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  const formatted = Math.abs(number).toLocaleString('zh-CN', { maximumFractionDigits: 0 })
  return `${number >= 0 ? '+' : '-'}${formatted}`
}

function signedPct(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return `${number >= 0 ? '+' : ''}${(number * 100).toFixed(2)}%`
}

function pct(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  return Number.isFinite(number) ? `${(number * 100).toFixed(2)}%` : '-'
}

function signClass(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number === 0) return ''
  return number > 0 ? 'positive' : 'negative'
}

function formatApiDetail(detail) {
  if (!detail) return ''
  if (typeof detail === 'string') return detail
  if (typeof detail === 'object' && detail.message) return String(detail.message)
  try {
    return JSON.stringify(detail)
  } catch {
    return String(detail)
  }
}

async function loadPortfolios() {
  loadingList.value = true
  message.value = ''
  messageIsError.value = false
  const previousKey = selectedPortfolioKey.value
  try {
    const res = await listPortfolios()
    portfolios.value = res.data?.portfolios || []
    if (!portfolios.value.length) {
      selectedPortfolioKey.value = ''
      message.value = '当前没有已执行的实盘或纸面组合血缘。'
      return
    }
    if (previousKey && portfolios.value.some((row) => portfolioKey(row) === previousKey)) {
      selectedPortfolioKey.value = previousKey
    }
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '加载组合列表失败'
    messageIsError.value = true
  } finally {
    loadingList.value = false
  }
}

async function loadSecuritiesAccounts() {
  try {
    const accounts = await getSecuritiesAccounts()
    securitiesAccounts.value = Array.isArray(accounts)
      ? accounts
      : (Array.isArray(accounts?.data) ? accounts.data : [])
    syncSelectedLiveAccount()
  } catch (error) {
    securitiesAccounts.value = []
  }
}

function syncSelectedLiveAccount() {
  const portfolioAccount = selectedPortfolio.value?.securities_account_id
  if (portfolioAccount) {
    selectedLiveAccountId.value = portfolioAccount
    return
  }
  if (!selectedLiveAccountId.value && securitiesAccounts.value.length) {
    selectedLiveAccountId.value = securitiesAccounts.value[0].id || securitiesAccounts.value[0]._id || ''
  }
}

async function refreshDetail() {
  const planId = selectedLatestPlanId.value
  if (!planId) return
  loadingDetail.value = true
  message.value = ''
  messageIsError.value = false
  try {
    const [timelineRes, latestPlanRes] = await Promise.all([
      getPortfolioPlanLineageTimeline(planId, { limit: 120 }),
      getPortfolioPlan(planId),
    ])
    timelineData.value = timelineRes.data || null
    latestPlanDetail.value = latestPlanRes.data || null
    livePublishPreview.value = null
    remainderPreview.value = null
    remainderReason.value = ''
    syncSelectedLiveAccount()

    if (isLivePortfolio.value) {
      const [eqRes, posRes, exRes] = await Promise.all([
        getLineageLiveEquity(planId),
        getLineageLivePositions(planId),
        getLineageLiveExecutions(planId),
      ])
      equityRows.value = (eqRes.data?.rows || []).map((row) => ({
        ...row,
        equity: Number(row.equity),
      }))
      equityCaveat.value = eqRes.data?.caveat || ''
      bookEquity.value = eqRes.data?.current_book_equity || null
      positionRows.value = posRes.data?.positions || []
      positionSummary.value = posRes.data?.summary || null
      tradeRows.value = exRes.data?.trades || []
    } else {
      const [eqRes, posRes, exRes] = await Promise.all([
        getPortfolioPlanLineageEquity(planId),
        getLineagePaperPositions(planId),
        getLineagePaperExecutions(planId),
      ])
      const rows = eqRes.data?.rows || []
      equityRows.value = rows.map((row) => ({
        ...row,
        equity: Number(row.equity),
      }))
      const snapshotDate = posRes.data?.as_of_date
      equityCaveat.value = snapshotDate
        ? `纸面净值由各 plan 日更 portfolio_paper_equity 拼接；最新持仓快照 ${snapshotDate}（plan ${posRes.data?.source_plan_id || '-'}）。`
        : '纸面净值由各 plan 日更 portfolio_paper_equity 拼接；当前血缘暂无 paper 持仓快照。'
      const latestRow = rows[rows.length - 1]
      const summary = posRes.data?.summary || {}
      bookEquity.value = latestRow || summary.equity
        ? {
            equity: Number(summary.equity || latestRow?.equity || 0),
            initial_capital: Number(
              eqRes.data?.initial_capital ||
              latestPlanDetail.value?.plan?.params_snapshot?.initial_capital ||
              selectedPortfolio.value?.initial_capital ||
              rows[0]?.equity ||
              0,
            ),
            cash: Number(summary.cash || latestRow?.cash || 0),
            realized_pnl: 0,
            unrealized_pnl: Number(summary.total_unrealized_pnl || 0),
          }
        : null
      positionRows.value = posRes.data?.positions || []
      positionSummary.value = summary.holding_count != null
        ? summary
        : {
            total_market_value: positionRows.value.reduce((sum, row) => sum + Number(row.market_value || 0), 0),
            total_realized_pnl: 0,
            total_unrealized_pnl: 0,
            holding_count: positionRows.value.length,
          }
      tradeRows.value = exRes.data?.trades || []
    }
    syncManualTargets()
    await loadBench()
    await loadReconcile()
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '加载详情失败'
    messageIsError.value = true
  } finally {
    loadingDetail.value = false
  }
}

watch(selectedPortfolioKey, (key) => {
  expandedTimelinePlanId.value = null
  holdingsRisk.value = null
  manualTargets.value = {}
  showLiquidateModal.value = false
  liquidateTargets.value = []
  showExternalManualModal.value = false
  externalManualRows.value = []
  showSwapModal.value = false
  showFastActionModal.value = false
  benchData.value = null
  reconcileData.value = null
  latestPlanDetail.value = null
  livePublishPreview.value = null
  remainderPreview.value = null
  remainderReason.value = ''
  if (key) refreshDetail()
  else {
    timelineData.value = null
    equityRows.value = []
    equityCaveat.value = ''
    bookEquity.value = null
    positionRows.value = []
    positionSummary.value = null
    tradeRows.value = []
  }
})

watch(latestHoldingRows, () => {
  syncManualTargets()
}, { immediate: true })

onMounted(() => {
  loadSecuritiesAccounts()
  loadPortfolios()
})
</script>

<style scoped>
/* Align contrast with PortfolioPlans.vue: #111827 body, #374151 secondary */
.portfolio-overview {
  background: #fff;
  box-sizing: border-box;
  color: #111827;
  line-height: 1.5;
  margin: 0 auto;
  max-width: 1200px;
  padding: 24px;
  width: 100%;
}

.overview-header h2 {
  color: #111827;
  font-size: 20px;
  margin: 0 0 8px;
}

.muted {
  color: #374151;
  font-size: 13px;
  margin: 0;
}

.muted code {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  color: #111827;
  font-size: 12px;
  padding: 1px 6px;
}

.toolbar {
  align-items: flex-end;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 20px 0 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.field span {
  color: #111827;
  font-weight: 600;
}

.field select,
button {
  background: #fff;
  border: 1px solid #111827;
  border-radius: 4px;
  color: #111827;
  padding: 8px 10px;
}

.field select {
  min-width: 420px;
}

.field select:disabled,
button:disabled {
  border-color: #9ca3af;
  color: #6b7280;
  cursor: not-allowed;
  opacity: 1;
}

.message {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  color: #111827;
  font-size: 14px;
  padding: 10px 12px;
}

.message.error {
  background: #fef2f2;
  border-color: #b91c1c;
  color: #7f1d1d;
}

.caveat-box {
  background: #fffbeb;
  border: 1px solid #d97706;
  border-radius: 6px;
  color: #422006;
  font-size: 13px;
  line-height: 1.55;
  margin-bottom: 16px;
  padding: 12px 14px;
}

.caveat-box strong {
  color: #1c1917;
}

.portfolio-identity-card {
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  margin-bottom: 16px;
  padding: 14px 16px;
}

.portfolio-identity-card h3 {
  font-size: 15px;
  margin: 0 0 12px;
}

.identity-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

.identity-grid .label {
  color: #64748b;
  display: block;
  font-size: 12px;
  margin-bottom: 4px;
}

.identity-grid strong {
  color: #0f172a;
  display: block;
  font-size: 14px;
}

.identity-grid small {
  color: #64748b;
  display: block;
  font-size: 12px;
  margin-top: 4px;
  word-break: break-all;
}

.cycle-card {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  margin-bottom: 16px;
  padding: 14px 16px;
}

.cycle-card.needs-action {
  background: #fffbeb;
  border-color: #d97706;
}

.cycle-card-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 12px;
}

.cycle-card-header h3 {
  font-size: 15px;
  margin: 0 0 4px;
}

.cycle-state {
  color: #1e293b;
  font-size: 14px;
  font-weight: 600;
  margin: 0;
}

.funding-badge {
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
}

.funding-badge.mode-live {
  background: #dbeafe;
  color: #1d4ed8;
}

.funding-badge.mode-paper {
  background: #ecfdf5;
  color: #047857;
}

.cycle-metrics {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

.cycle-metrics .label {
  color: #64748b;
  display: block;
  font-size: 12px;
  margin-bottom: 4px;
}

.cycle-metrics strong {
  color: #0f172a;
  font-size: 15px;
}

.cycle-metrics small {
  color: #64748b;
  display: block;
  font-size: 12px;
  margin-top: 4px;
}

.progress-bar {
  background: #e2e8f0;
  border-radius: 999px;
  height: 6px;
  margin-top: 8px;
  overflow: hidden;
}

.progress-fill {
  background: #2563eb;
  height: 100%;
}

.monitor-hint {
  color: #475569;
  font-size: 13px;
  margin: 12px 0 0;
}

.plan-ops-card {
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  margin-bottom: 16px;
  padding: 14px 16px;
}

/* 待审批复核卡片：用琥珀色边框强调“需要先看清楚再批” */
.plan-review-card {
  border-color: #f59e0b;
  background: #fffdf7;
}

.plan-review-risk-warning {
  margin: 8px 0 4px;
}

.plan-review-actions {
  margin-top: 12px;
}

.plan-ops-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 12px;
}

.plan-ops-header h3 {
  font-size: 15px;
  margin: 0 0 4px;
}

.plan-id-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0 0;
}

.plan-id-row .label {
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
}

.plan-id-row code {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  color: #0f172a;
  font-size: 12px;
  padding: 2px 6px;
}

.link-button {
  background: transparent;
  border: 0;
  color: #2563eb;
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
}

.link-button:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.plan-ops-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.plan-ops-actions select,
.plan-ops-actions input {
  border: 1px solid #111827;
  border-radius: 4px;
  color: #111827;
  min-height: 36px;
  padding: 8px 10px;
}

.reason-input {
  min-width: 220px;
}

.pending-plan-items {
  background: #f8fafc;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  margin-top: 12px;
  padding: 12px;
}

.pending-plan-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 10px;
}

.pending-plan-header h4 {
  font-size: 14px;
  margin: 0 0 4px;
}

.pending-plan-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pending-plan-summary span {
  border-radius: 999px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  white-space: nowrap;
}

.pending-plan-summary .tag-buy {
  background: #dc2626;
}

.pending-plan-summary .tag-sell {
  background: #16a34a;
}

.pending-plan-summary .tag-hold {
  background: #64748b;
}

.symbol-line {
  display: block;
}

.risk-report {
  background: #f8fafc;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  margin-top: 12px;
  padding: 12px;
}

.risk-report p {
  margin: 0 0 8px;
}

.warning-text {
  color: #b45309;
  font-size: 13px;
}

.risk-report-table tr.blocked {
  background: #fef2f2;
}

.timeline-section {
  margin-bottom: 16px;
}

.timeline-list {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.timeline-item {
  border-bottom: 1px solid #e5e7eb;
  color: #64748b;
  display: block;
  font-size: 13px;
  padding: 10px 12px;
}

.timeline-node-head {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.timeline-expand {
  background: transparent;
  border: none;
  color: #1d4ed8;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
}

.timeline-hint {
  font-size: 12px;
  margin: -4px 0 8px;
}

.timeline-trade-detail {
  margin-top: 10px;
  width: 100%;
}

.timeline-detail-note {
  color: #92400e;
  font-size: 12px;
  margin: 0 0 8px;
}

.action-tag {
  border-radius: 3px;
  color: #fff;
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  min-width: 20px;
  text-align: center;
}

.action-tag.tag-buy {
  background: #dc2626;
}

.action-tag.tag-sell {
  background: #16a34a;
}

.action-tag.tag-hold {
  background: #64748b;
}

.action-tag.tag-skip {
  background: #cbd5e1;
  color: #334155;
}

.timeline-item:last-child {
  border-bottom: none;
}

.timeline-item strong {
  color: #0f172a;
}

.timeline-fold {
  background: #f8fafc;
}

.timeline-strong {
  background: #fff;
  color: #1e293b;
  font-weight: 500;
}

.timeline-strong .node-type {
  color: #1d4ed8;
  font-weight: 600;
}

.chart-section h3,
section h3 {
  color: #111827;
  font-size: 15px;
  font-weight: 600;
  margin: 20px 0 8px;
}

.equity-chart {
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 10px;
  position: relative;
}

.equity-chart .equity-svg {
  width: 100%;
  height: auto;
  display: block;
  cursor: crosshair;
}

.equity-chart polyline.line {
  fill: none;
  stroke-width: 2.25;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.equity-chart polyline.line.up {
  stroke: #dc2626;
}

.equity-chart polyline.line.down {
  stroke: #16a34a;
}

.equity-chart .grid line {
  stroke: #eef2f7;
  stroke-width: 1;
}

.equity-chart .axis-label {
  fill: #94a3b8;
  font-size: 11px;
}

.equity-chart .baseline {
  stroke: #94a3b8;
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.equity-chart .baseline-label {
  fill: #94a3b8;
  font-size: 11px;
}

.equity-chart .crosshair {
  stroke: #94a3b8;
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.equity-chart .dot {
  fill: #fff;
  stroke: #1d4ed8;
  stroke-width: 2;
}

.equity-tip {
  position: absolute;
  top: 14px;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.94);
  color: #f8fafc;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.5;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.25);
  z-index: 2;
}

.equity-tip .tip-date {
  font-weight: 600;
  margin-bottom: 4px;
  color: #e2e8f0;
}

.equity-tip .tip-row {
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.equity-tip .tip-row span {
  color: #94a3b8;
}

.equity-tip .tip-row strong {
  font-weight: 600;
  color: #f8fafc;
}

.equity-tip .tip-row strong.positive {
  color: #f87171;
}

.equity-tip .tip-row strong.negative {
  color: #4ade80;
}

.chart-meta {
  color: #374151;
  font-size: 13px;
  margin: 10px 0 0;
}

.chart-meta strong {
  color: #111827;
}

.chart-meta strong.positive {
  color: #dc2626;
}

.chart-meta strong.negative {
  color: #16a34a;
}

.chart-meta-hint {
  color: #94a3b8;
  margin-left: 6px;
}

/* A-share convention: profit red, loss green. */
.positive {
  color: #dc2626;
}

.negative {
  color: #16a34a;
}

.summary-cards {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  margin: 16px 0;
}

.summary-cards .card {
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 12px 14px;
}

.summary-cards .label {
  color: #374151;
  font-size: 12px;
  font-weight: 500;
}

.summary-cards .value {
  color: #111827;
  font-size: 18px;
  font-weight: 700;
  margin-top: 6px;
}

.table-wrap {
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  overflow-x: auto;
}

.table-wrap.compact table {
  font-size: 13px;
}

table {
  border-collapse: collapse;
  width: 100%;
}

th,
td {
  border-bottom: 1px solid #e5e7eb;
  color: #111827;
  padding: 10px 12px;
  text-align: left;
}

th {
  background: #f3f4f6;
  color: #111827;
  font-size: 13px;
  font-weight: 600;
}

tbody tr:hover td {
  background: #f9fafb;
}

.open-trade td {
  background: #f8fafc;
}

.badge-open {
  background: #eff6ff;
  border: 1px solid #93c5fd;
  border-radius: 4px;
  color: #1d4ed8;
  font-size: 12px;
  padding: 1px 6px;
  white-space: nowrap;
}

.totals-row td {
  background: #f3f4f6;
  border-top: 2px solid #d1d5db;
  font-weight: 700;
}

.combo-note {
  margin-top: 8px;
}

.truncate {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spinner {
  animation: spin 0.8s linear infinite;
  border: 2px solid #d1d5db;
  border-radius: 50%;
  border-top-color: #111827;
  display: inline-block;
  height: 12px;
  margin-right: 6px;
  vertical-align: middle;
  width: 12px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

button {
  cursor: pointer;
  font-weight: 500;
}

button.danger {
  background: #dc2626;
  border-color: #dc2626;
  color: #fff;
}

button.danger:disabled {
  background: #fca5a5;
  border-color: #fca5a5;
}

.holdings-section {
  margin-top: 8px;
}

.holdings-header {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 8px;
}

.holdings-actions {
  display: flex;
  gap: 8px;
}

.paused-banner {
  align-items: center;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-top: 12px;
  padding: 10px 12px;
}

.target-input {
  max-width: 88px;
  width: 88px;
}

.risk-badge {
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
}

.risk-badge.risk-high {
  background: #fee2e2;
  color: #dc2626;
}

.risk-badge.risk-medium {
  background: #ffedd5;
  color: #c2410c;
}

.risk-badge.risk-low {
  background: #fef9c3;
  color: #a16207;
}

.risk-badge.risk-none {
  background: #ecfdf5;
  color: #047857;
}

.risk-row-high {
  background: #fff7f7;
}

.bench-risk-bar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: space-between;
  margin: 8px 0;
}

.bench-risk-summary {
  font-size: 12px;
}

.bench-risk-summary .risk-high {
  color: #dc2626;
}

.bench-risk-summary .risk-medium {
  color: #c2410c;
}

.bench-risk-summary .risk-low {
  color: #a16207;
}

.modal-backdrop {
  align-items: center;
  background: rgba(17, 24, 39, 0.45);
  display: flex;
  inset: 0;
  justify-content: center;
  position: fixed;
  z-index: 50;
}

.modal-card {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  max-width: 520px;
  padding: 20px;
  width: calc(100% - 32px);
}

.modal-card.wide {
  max-width: 920px;
}

.external-fill-table input,
.external-fill-table select {
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  box-sizing: border-box;
  color: #111827;
  max-width: 180px;
  padding: 7px 8px;
  width: 100%;
}

.add-row-btn {
  background: none;
  border: 1px dashed #94a3b8;
  border-radius: 4px;
  color: #2563eb;
  cursor: pointer;
  margin-top: 8px;
  padding: 6px 10px;
}

.link-btn {
  background: none;
  border: none;
  color: #c2410c;
  cursor: pointer;
  padding: 0;
}

.external-fill-table {
  margin-top: 10px;
}

.external-fill-table td {
  vertical-align: middle;
}

.manual-preview {
  margin: 12px 0;
  padding-left: 18px;
}

.checkbox-row {
  align-items: center;
  display: flex;
  gap: 8px;
  margin: 12px 0;
}

.warning-text {
  color: #c2410c;
  font-weight: 600;
}

.modal-error {
  margin: 8px 0 0;
  color: #b91c1c;
  font-weight: 600;
}

.off-universe-tag {
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 8px;
  font-size: 11px;
  background: #fef3c7;
  color: #92400e;
}

.reconcile-banner {
  margin-bottom: 16px;
  padding: 14px 16px;
  border: 1px solid #fca5a5;
  border-radius: 10px;
  background: #fef2f2;
}

.reconcile-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.reconcile-head strong {
  color: #b91c1c;
}

.reconcile-banner .pos {
  color: #047857;
  font-weight: 600;
}

.reconcile-banner .neg {
  color: #b91c1c;
  font-weight: 600;
}

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
}

.cycle-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

.action-banner {
  align-items: center;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0;
  padding: 10px 12px;
}

.lineup-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  margin-top: 16px;
  padding: 16px;
}

.lineup-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.lineup-hint {
  margin: 6px 0 0;
}

.bench-candidates-card {
  margin-top: 16px;
}

.lineup-table {
  width: 100%;
}

.modal-wide {
  max-width: 760px;
}

.fast-actions {
  white-space: nowrap;
}

.fast-actions .fast-btn {
  display: inline-block;
  margin: 2px 4px 2px 0;
  padding: 3px 10px;
  font-size: 12px;
  line-height: 1.4;
  border-radius: 6px;
  border: 1px solid transparent;
  background: #fff;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

/* 换股：中性蓝，表示“替换为替补” */
.fast-btn-swap {
  color: #1d4ed8;
  border-color: #bfdbfe;
  background: #eff6ff;
}
.fast-btn-swap:hover {
  background: #dbeafe;
  border-color: #93c5fd;
}

/* 减半：警示橙，表示“部分减仓” */
.fast-btn-reduce {
  color: #b45309;
  border-color: #fcd9a8;
  background: #fff7ed;
}
.fast-btn-reduce:hover {
  background: #ffedd5;
  border-color: #fbbf24;
}

/* 清仓：危险红，表示“全部卖出” */
.fast-btn-clear {
  color: #b91c1c;
  border-color: #fca5a5;
  background: #fef2f2;
}
.fast-btn-clear:hover {
  background: #fee2e2;
  border-color: #f87171;
}

.danger-text {
  color: #c2410c;
}

button.secondary {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
}
</style>
