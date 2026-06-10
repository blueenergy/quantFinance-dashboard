<template>
  <section class="portfolio-plans">
    <header class="page-header">
      <div>
        <p class="eyebrow">Portfolio Plans</p>
        <h2>组合交易计划</h2>
        <p class="subtitle">查看指数增强策略的交易计划、人工审核状态和 paper trading 净值。</p>
      </div>
      <button :disabled="loading" @click="refreshAll">刷新</button>
    </header>

    <section class="toolbar">
      <label>
        策略
        <select v-model="selectedStrategyId" @change="loadPlans">
          <option value="">全部策略</option>
          <option v-for="strategy in strategies" :key="strategy.strategy_template_id" :value="strategy.strategy_template_id">
            {{ strategyOptionLabel(strategy) }}
          </option>
        </select>
      </label>
      <label>
        状态
        <select v-model="statusFilter" @change="loadPlans">
          <option value="">全部</option>
          <option value="generated">generated</option>
          <option value="needs_review">needs_review</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
          <option value="executed_paper">executed_paper</option>
          <option value="partially_executed">partially_executed</option>
        </select>
      </label>
    </section>

    <section class="card generate-card">
      <div>
        <h3>生成交易计划</h3>
        <p class="muted">从当前可用 strategy 生成新的 plan，生成后仍需人工审核。</p>
      </div>
      <label>
        策略
        <select v-model="generateForm.strategy_template_id" @change="onGenerateStrategyChange">
          <option value="">请选择 strategy</option>
          <option v-for="strategy in availableStrategies" :key="strategy.strategy_template_id" :value="strategy.strategy_template_id">
            {{ strategyOptionLabel(strategy) }}
          </option>
        </select>
      </label>
      <label>
        base_date
        <input v-model="generateForm.base_date" type="date" @change="loadPlanGenerationWatermark" />
      </label>
      <label>
        mode
        <select v-model="generateForm.mode">
          <option value="auto">auto</option>
          <option value="monitor">monitor</option>
          <option value="rebalance">rebalance</option>
        </select>
      </label>
      <label class="inline-check">
        <input v-model="generateForm.force" type="checkbox" />
        force
      </label>
      <div v-if="selectedGenerateStrategy" class="strategy-param-card">
        <div class="strategy-param-header">
          <div>
            <strong>本次 plan 参数</strong>
            <p class="muted">先选择策略模板和参数预设，再按本次计划需要调整参数；系统会把最终参数快照写入 plan。</p>
          </div>
          <span class="editable-badge">内部唯一键：params_hash</span>
        </div>
        <label>
          参数预设
          <select v-model="generateForm.preset_id" @change="applySelectedPreset">
            <option v-for="preset in parameterPresets" :key="preset.preset_id" :value="preset.preset_id">
              {{ presetLabel(preset) }}
            </option>
          </select>
        </label>
        <div v-if="selectedPreset" class="preset-evidence">
          <strong>推荐依据</strong>
          <span>evidence：{{ selectedPreset.evidence_count ?? presetEvidenceRows.length }} 条</span>
          <span>区间：{{ selectedPreset.data_window?.start_date || '-' }} → {{ selectedPreset.data_window?.end_date || '-' }}</span>
          <span>超额：{{ pct(selectedPreset.backtest_summary?.index_excess_cumulative_return) }}</span>
          <span>Sharpe：{{ num(selectedPreset.backtest_summary?.sharpe) }}</span>
          <span>回撤：{{ pct(selectedPreset.backtest_summary?.max_drawdown) }}</span>
        </div>
        <div v-if="presetEvidenceRows.length" class="preset-evidence-list">
          <strong>Evidence 明细</strong>
          <p v-for="evidence in presetEvidenceRows" :key="evidence.research_result_id || evidence.research_job_id">
            <span>{{ evidence.data_window?.start_date || '-' }} → {{ evidence.data_window?.end_date || '-' }}</span>
            <span>超额 {{ pct(evidence.best_row?.index_excess_cumulative_return) }}</span>
            <span>Sharpe {{ num(evidence.best_row?.sharpe) }}</span>
            <span>回撤 {{ pct(evidence.best_row?.max_drawdown) }}</span>
          </p>
        </div>
        <div class="strategy-param-grid editable">
          <label>
            universe
            <select v-model="generateForm.params.universe_index">
              <option v-for="universe in universeOptions" :key="universe.value" :value="universe.value">
                {{ universe.label }}
              </option>
            </select>
          </label>
          <label>
            top_n
            <input v-model.number="generateForm.params.top_n" type="number" min="1" />
          </label>
          <label>
            rebalance_days
            <input v-model.number="generateForm.params.rebalance_days" type="number" min="1" />
          </label>
          <label>
            construction_mode
            <select v-model="generateForm.params.construction_mode">
              <option value="top_n">top_n</option>
              <option value="industry_capped">industry_capped</option>
              <option value="industry_neutral">industry_neutral</option>
            </select>
          </label>
          <label>
            growth_weight
            <input
              :value="generateForm.params.growth_weight"
              type="number"
              min="0"
              max="1"
              step="0.05"
              @input="setGrowthWeight($event.target.value)"
            />
          </label>
          <label>
            cycle_weight
            <input
              :value="generateForm.params.cycle_weight"
              type="number"
              min="0"
              max="1"
              step="0.05"
              @input="setCycleWeight($event.target.value)"
            />
          </label>
          <label>
            industry cap
            <input v-model.number="generateForm.params.max_industry_weight" type="number" min="0" max="1" step="0.05" />
          </label>
          <label>
            cash_buffer
            <input v-model.number="generateForm.params.cash_buffer" type="number" min="0" max="1" step="0.01" />
          </label>
          <label>
            buy commission
            <input v-model.number="generateForm.params.buy_commission_rate" type="number" min="0" step="0.00001" />
          </label>
          <label>
            sell commission
            <input v-model.number="generateForm.params.sell_commission_rate" type="number" min="0" step="0.00001" />
          </label>
          <label>
            min commission
            <input v-model.number="generateForm.params.min_commission" type="number" min="0" step="0.1" />
          </label>
          <label>
            stamp tax
            <input v-model.number="generateForm.params.stamp_tax_rate" type="number" min="0" step="0.00001" />
          </label>
          <label>
            initial_capital
            <input v-model.number="generateForm.params.initial_capital" type="number" min="1" step="10000" />
          </label>
        </div>
      </div>
      <button :disabled="generateLoading || !generateForm.strategy_template_id || !generateForm.base_date" @click="generatePlan">
        {{ generateLoading ? '提交中...' : '生成 plan' }}
      </button>
      <p v-if="currentGenerationTask" class="task-status">
        任务 {{ currentGenerationTask.task_id }}：{{ currentGenerationTask.status }}
        <span v-if="currentGenerationTask.plan_id"> / plan {{ currentGenerationTask.plan_id }}</span>
        <span v-if="currentGenerationTask.error_message"> / {{ currentGenerationTask.error_message }}</span>
      </p>
    </section>

    <p v-if="message" class="message">{{ message }}</p>

    <section class="card watermark-card">
      <div class="task-list-header">
        <div>
          <h3>Plan 生成数据水位</h3>
          <p class="muted">确认当前 base_date 对应评分数据是否可用于生成 plan。</p>
        </div>
        <button :disabled="watermarkLoading || !generateForm.strategy_template_id" @click="loadPlanGenerationWatermark">
          刷新水位
        </button>
      </div>
      <p v-if="watermarkLoading" class="muted">正在加载数据水位...</p>
      <p v-else-if="!planGenerationWatermark" class="muted">请选择 strategy 后查看评分水位。</p>
      <template v-else>
        <div class="watermark-grid">
          <div>
            <span>universe</span>
            <strong>{{ planGenerationWatermark.universe_index || '-' }}</strong>
          </div>
          <div>
            <span>base_date 评分</span>
            <strong>{{ targetScoringRunText }}</strong>
            <small v-if="planGenerationWatermark.target_scoring_run?.updated_at">
              updated {{ planGenerationWatermark.target_scoring_run.updated_at }}
            </small>
          </div>
          <div>
            <span>最近完成评分</span>
            <strong>{{ latestCompletedScoringText }}</strong>
          </div>
          <div>
            <span>最新可用评分数据</span>
            <strong>{{ latestAvailableScoreText }}</strong>
            <small>{{ latestAvailableScoreMeta }}</small>
          </div>
          <div>
            <span>最近评分 run</span>
            <strong>{{ latestScoringRunText }}</strong>
          </div>
        </div>
        <p v-if="planGenerationWatermark.target_is_running" class="watermark-warning">
          当前 base_date 的评分仍在运行，plan generation worker 会等待，避免使用半成品评分。
        </p>
      </template>
    </section>

    <section class="card worker-status-card">
      <div class="task-list-header">
        <div>
          <h3>Plan 生成 Worker</h3>
          <p class="muted">展示 quant-scorer 最近一次 heartbeat，辅助判断任务是否有人消费。</p>
        </div>
        <button :disabled="workerStatusLoading" @click="loadWorkerStatus">刷新 worker</button>
      </div>
      <p v-if="workerStatusLoading" class="muted">正在加载 worker 状态...</p>
      <p v-else-if="!workerStatuses.length" class="muted">暂无 worker heartbeat。</p>
      <div v-else class="worker-status-grid">
        <div v-for="worker in workerStatuses" :key="worker.worker_id" class="worker-status-row">
          <span>{{ worker.worker_id }}</span>
          <strong>{{ worker.status }}</strong>
          <small>last_seen: {{ worker.last_seen_at || '-' }}</small>
          <small v-if="worker.current_task_id">current_task: {{ worker.current_task_id }}</small>
          <small v-else-if="worker.last_task_id">last_task: {{ worker.last_task_id }}</small>
          <small v-if="worker.last_message">{{ worker.last_message }}</small>
        </div>
      </div>
    </section>

    <section class="card live-ops-card">
      <div class="task-list-header">
        <div>
          <h3>实盘执行监控</h3>
          <p class="muted">
            <span v-if="selectedPlanId">当前 plan：{{ selectedPlanId }} · </span>
            signals {{ formatSummary(liveSignalStatusSummary) }} · executions {{ formatSummary(liveExecutionStatusSummary) }}
            <span v-if="latestTraderHeartbeat"> · quantTrader {{ latestTraderHeartbeat.status }} / {{ latestTraderHeartbeat.last_seen_at || '-' }}</span>
          </p>
        </div>
        <div class="task-list-actions">
          <select v-model="selectedLiveAccountId" @change="loadLiveOps">
            <option value="">全部账户</option>
            <option v-for="account in liveAccountOptions" :key="account.id" :value="account.id">
              {{ account.label }}
            </option>
          </select>
          <button :disabled="liveOpsLoading" @click="loadLiveOps">刷新实盘状态</button>
          <button @click="liveOpsExpanded = !liveOpsExpanded">
            {{ liveOpsExpanded ? '收起详情' : '展开详情' }}
          </button>
        </div>
      </div>
      <p v-if="liveOpsLoading && liveOpsExpanded" class="muted">正在加载实盘状态...</p>
      <div v-else-if="liveOpsExpanded" class="live-ops-grid">
        <div>
          <h4>quantTrader heartbeat</h4>
          <p v-if="!traderHeartbeats.length" class="muted">暂无 heartbeat。</p>
          <p v-for="heartbeat in traderHeartbeats" :key="heartbeat.worker_id" class="ops-line">
            <strong>{{ heartbeat.status }}</strong>
            <span>{{ heartbeat.worker_id }}</span>
            <small>{{ heartbeat.last_seen_at || '-' }}</small>
          </p>
        </div>
        <div>
          <h4>Live signals</h4>
          <p v-if="!liveSignals.length" class="muted">暂无 live signals。</p>
          <p v-for="signal in liveSignals.slice(0, 20)" :key="signal.order_id" class="ops-line">
            <strong>{{ signal.status }}</strong>
            <span>{{ signal.action }} {{ signalDisplayName(signal) }} x {{ signal.size }}</span>
            <small>{{ signal.execution_time || signal.created_at || signal.timestamp || '-' }}</small>
          </p>
        </div>
        <div>
          <h4>Executions</h4>
          <p v-if="!liveExecutions.length" class="muted">暂无 execution。</p>
          <p v-for="execution in liveExecutions.slice(0, 5)" :key="`${execution.order_id}-${execution.status}-${execution.timestamp}`" class="ops-line">
            <strong>{{ execution.status }}</strong>
            <span>{{ execution.action }} {{ execution.symbol }} filled {{ execution.filled_size ?? '-' }}</span>
            <small>{{ execution.execution_time || execution.timestamp || '-' }}</small>
          </p>
        </div>
      </div>
    </section>

    <section class="card task-list-card">
      <div class="task-list-header">
        <div>
          <h3>最近生成任务</h3>
          <p class="muted">
            {{ generationTasks.length }} 条最近任务
            <span v-if="latestGenerationTask">
              · 最新 {{ latestGenerationTask.status }} / {{ latestGenerationTask.strategy_template_id }} / {{ latestGenerationTask.base_date }}
            </span>
          </p>
        </div>
        <div class="task-list-actions">
          <button @click="generationTasksExpanded = !generationTasksExpanded">
            {{ generationTasksExpanded ? '折叠' : '展开' }}
          </button>
          <button :disabled="tasksLoading" @click="loadGenerationTasks">刷新任务</button>
        </div>
      </div>
      <template v-if="generationTasksExpanded">
        <p v-if="tasksLoading" class="muted">正在加载任务...</p>
        <p v-else-if="!generationTasks.length" class="muted">暂无生成任务。</p>
        <div v-else class="table-wrap compact generation-task-table">
          <table>
            <thead>
              <tr>
                <th>created_at</th>
                <th>status</th>
                <th>strategy</th>
                <th>base_date</th>
                <th>mode</th>
                <th>attempts</th>
                <th>worker</th>
                <th>plan/error</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="task in generationTasks"
                :key="task.task_id"
                :class="{ active: currentGenerationTask?.task_id === task.task_id }"
                @click="currentGenerationTask = task"
              >
                <td>{{ task.created_at || '-' }}</td>
                <td>{{ task.status || '-' }}</td>
                <td class="truncate" :title="task.strategy_template_id">{{ task.strategy_template_id || '-' }}</td>
                <td>{{ task.base_date || '-' }}</td>
                <td>{{ task.mode || '-' }}</td>
                <td>{{ task.attempts ?? 0 }}</td>
                <td class="truncate" :title="task.worker_id">{{ task.worker_id || '-' }}</td>
                <td class="truncate" :title="task.plan_id || task.error_message || task.task_id">
                  {{ task.plan_id || task.error_message || task.task_id }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>

    <div class="layout">
      <aside class="card plan-list">
        <h3>计划列表</h3>
        <p v-if="loading" class="muted">正在加载...</p>
        <button
          v-for="plan in plans"
          :key="plan.plan_id"
          class="plan-row"
          :class="{ active: selectedPlanId === plan.plan_id }"
          @click="selectPlan(plan.plan_id)"
        >
          <span>
            <strong>{{ plan.base_date }}</strong>
            <small>{{ planDisplayTitle(plan) }} · {{ planParamSummary(plan) }}</small>
          </span>
          <em>{{ plan.plan_type }} / {{ plan.status }}</em>
        </button>
        <p v-if="!loading && !plans.length" class="muted">暂无计划。</p>
      </aside>

      <main class="card detail">
        <template v-if="selectedDetail">
          <div class="detail-header">
            <div>
              <h3>{{ planDisplayTitle(selectedDetail.plan) }}</h3>
              <p class="muted">
                {{ selectedDetail.plan.base_date }} → {{ selectedDetail.plan.execute_date || '-' }}
                · {{ selectedDetail.plan.plan_type }} · {{ selectedDetail.plan.status }}
                · {{ planParamSummary(selectedDetail.plan) }}
                · initial capital {{ money(effectiveInitialCapital(selectedDetail.plan)) }}
              </p>
            </div>
            <div v-if="selectedDetail.plan.status === 'needs_review'" class="actions">
              <button :disabled="actionLoading" @click="review('approved')">审核通过</button>
              <button class="danger" :disabled="actionLoading" @click="review('rejected')">驳回</button>
            </div>
          </div>

          <div class="metrics">
            <div><span>买入</span><strong>{{ selectedDetail.plan.summary?.buy_count ?? 0 }}</strong></div>
            <div><span>卖出</span><strong>{{ selectedDetail.plan.summary?.sell_count ?? 0 }}</strong></div>
            <div><span>持有</span><strong>{{ selectedDetail.plan.summary?.hold_count ?? 0 }}</strong></div>
            <div><span>跳过</span><strong>{{ selectedDetail.plan.summary?.skip_count ?? 0 }}</strong></div>
            <div><span>目标 TopN</span><strong>{{ effectiveTopN(selectedDetail.plan) }}</strong></div>
            <div><span>换手</span><strong>{{ pct(selectedDetail.plan.summary?.estimated_turnover) }}</strong></div>
            <div><span>权益</span><strong>{{ money(selectedDetail.plan.summary?.equity) }}</strong></div>
          </div>

          <label class="review-comment" v-if="selectedDetail.plan.status === 'needs_review'">
            审核备注
            <textarea v-model="reviewComment" rows="2" placeholder="记录审核意见或风险确认" />
          </label>

          <section class="operation-log-panel">
            <div class="task-list-header">
              <div>
                <h4>操作日志</h4>
                <p class="muted">保留 reject/restore 与重生成任务的入队与完成记录。</p>
              </div>
              <div class="task-list-actions">
                <button :disabled="operationLogsLoading || !selectedPlanId" @click="loadOperationLogs">刷新日志</button>
              </div>
            </div>
            <p v-if="operationLogsLoading" class="muted">正在加载日志...</p>
            <p v-else-if="!operationLogs.length" class="muted">暂无操作日志。</p>
            <div v-else class="table-wrap compact operation-log-table">
              <table>
                <thead>
                  <tr>
                    <th>time</th>
                    <th>operation</th>
                    <th>symbol</th>
                    <th>status</th>
                    <th>task</th>
                    <th>message</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="log in operationLogs" :key="log.log_id">
                    <td>{{ log.created_at || '-' }}</td>
                    <td>{{ log.operation_type || '-' }}</td>
                    <td>{{ log.operation_symbol || '-' }}</td>
                    <td>{{ log.status || '-' }}</td>
                    <td class="truncate" :title="log.task_id || '-'">{{ log.task_id || '-' }}</td>
                    <td class="truncate" :title="log.message || '-'">{{ log.message || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section v-if="showPaperExecutionStatus" class="execution-status">
            <h4>后台执行状态</h4>
            <p v-if="selectedDetail.plan.status === 'approved'" class="muted">
              已审核，等待后台在开盘价就绪后自动执行。
            </p>
            <div class="status-grid">
              <div>
                <span>execute_date</span>
                <strong>{{ executionStatus.execute_date || '-' }}</strong>
                <small v-if="executionStatus.uses_runtime_execute_date">
                  后台将按运行日期 {{ executionStatus.effective_execute_date || '-' }} 检查
                </small>
              </div>
              <div>
                <span>开盘价是否就绪</span>
                <strong>{{ executionStatus.open_price_ready ? '已就绪' : '未就绪' }}</strong>
                <small v-if="!executionStatus.open_price_ready">
                  缺失 {{ executionStatus.missing_open_price_count ?? 0 }} 个
                </small>
              </div>
              <div>
                <span>后台执行状态</span>
                <strong>{{ executionStatus.backend_execution_status || '-' }}</strong>
              </div>
              <div>
                <span>最近一次执行结果</span>
                <strong>{{ latestExecutionText }}</strong>
                <small v-if="executionStatus.execution_count">累计 {{ executionStatus.execution_count }} 条成交记录</small>
              </div>
            </div>
            <p v-if="executionStatus.missing_open_price_examples?.length" class="muted">
              缺失示例：{{ executionStatus.missing_open_price_examples.join(', ') }}
            </p>
          </section>

          <section v-if="selectedDetail.plan.status === 'approved' && !selectedPlanHasLiveSignals" class="live-publish-panel">
            <div class="task-list-header">
              <div>
                <h4>发布到实盘</h4>
                <p class="muted">先 dry-run 生成 risk report，确认后才写入 executable live signals。</p>
              </div>
              <div class="task-list-actions">
                <button :disabled="paperExecuteLoading || livePublishLoading || !canExecutePaperNow" @click="executePaperNow">
                  立即执行 Paper
                </button>
                <select v-model="selectedLiveAccountId">
                  <option value="">请选择账户</option>
                  <option v-for="account in liveAccountOptions" :key="account.id" :value="account.id">
                    {{ account.label }}
                  </option>
                </select>
                <button :disabled="livePublishLoading || !selectedLiveAccountId" @click="previewLivePublish">实盘预检</button>
                <button :disabled="livePublishLoading || !selectedLiveAccountId || livePublishBlockers.length" @click="publishLiveSignals">
                  确认发布
                </button>
              </div>
            </div>
            <div v-if="livePublishPreview" class="risk-report">
              <p>
                待写入 {{ livePublishPreview.new_signals?.length ?? 0 }} 条，已有 {{ livePublishPreview.existing_count ?? 0 }} 条，
                阻断 {{ livePublishPreview.risk_report?.blocked_count ?? 0 }} 条
              </p>
              <p v-if="livePublishBlockers.length" class="watermark-warning">
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
                    <tr
                      v-for="item in livePublishRiskRows"
                      :key="item.order_id || `${item.symbol}-${item.action}-${item.size}`"
                      :class="{ blocked: item.blockers?.length }"
                    >
                      <td>{{ item.blockers?.length ? '阻断' : '通过' }}</td>
                      <td>{{ item.symbol || '-' }}</td>
                      <td>{{ item.action || '-' }}</td>
                      <td>{{ item.size ?? '-' }}</td>
                      <td>{{ num(item.price) }}</td>
                      <td>{{ money(item.estimated_amount) }}</td>
                      <td class="risk-reasons">
                        <span v-if="!item.blockers?.length">可发布</span>
                        <span
                          v-for="blocker in item.blockers"
                          v-else
                          :key="`${item.order_id}-${blocker}`"
                          class="risk-chip"
                          :title="blocker"
                        >
                          {{ blockerText(blocker) }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-if="livePublishPreview.new_signals?.length" class="table-wrap compact">
                <table>
                  <thead>
                    <tr>
                      <th>代码</th>
                      <th>方向</th>
                      <th>数量</th>
                      <th>限价</th>
                      <th>order_id</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="signal in livePublishPreview.new_signals.slice(0, 8)" :key="signal.order_id">
                      <td>{{ signalDisplayName(signal) }}</td>
                      <td>{{ signal.action }}</td>
                      <td>{{ signal.size }}</td>
                      <td>{{ num(signal.price) }}</td>
                      <td class="truncate" :title="signal.order_id">{{ signal.order_id }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section>
            <h4>目标持仓与交易明细</h4>
            <p v-if="reselectStatus.state !== 'idle'" class="reselect-status" :class="`is-${reselectStatus.state}`">
              <span v-if="reselectStatus.state === 'running'" class="spinner" />
              {{ reselectStatus.text }}
            </p>
            <p v-if="reselectTaskMeta.taskId" class="reselect-meta">
              task {{ reselectTaskMeta.taskId }} · {{ reselectTaskMeta.status || '-' }}
            </p>
            <p v-if="lastReselectSummary" class="reselect-summary">{{ lastReselectSummary }}</p>
            <div v-if="canReselectItems && selectedPlanExcluded.length" class="excluded-bar">
              <span class="excluded-label">已排除：</span>
              <span v-for="sym in selectedPlanExcluded" :key="sym" class="excluded-chip">
                {{ sym }}
                <button class="link-btn" :disabled="actionLoading || reselectBusy" @click="reselectItem(sym, true)">
                  {{ reselectBusy && pendingReselect?.symbol === sym ? '恢复中…' : '恢复' }}
                </button>
              </span>
            </div>
            <div class="table-wrap">
              <table class="plan-items-table">
                <thead>
                  <tr>
                    <th class="col-narrow">Rank</th>
                    <th class="col-symbol">代码</th>
                    <th class="col-name">名称</th>
                    <th class="col-ind">行业</th>
                    <th class="col-num">{{ selectedPlanHasLiveSignals ? '策略股数' : '当前股数' }}</th>
                    <th class="col-num">目标股数</th>
                    <th v-if="selectedPlanHasLiveSignals" class="col-num">账户股数</th>
                    <th v-if="selectedPlanHasLiveSignals" class="col-num">已成交</th>
                    <th v-if="selectedPlanHasLiveSignals" class="col-num">剩余</th>
                    <th v-if="selectedPlanHasLiveSignals" class="col-narrow">实盘状态</th>
                    <th class="col-num">预估价</th>
                    <th class="col-narrow">候选</th>
                    <th v-if="canReselectItems" class="col-action">操作</th>
                    <th class="col-risk">风险</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in selectedDetail.items" :key="`${item.symbol}-${item.rank}`">
                    <td class="col-narrow">{{ item.rank ?? '-' }}</td>
                    <td class="col-symbol">{{ item.symbol }}</td>
                    <td class="col-name" :title="`${actionBadge(item.action).label} ${item.name || ''}`">
                      <span class="action-tag" :class="actionBadge(item.action).cls">{{ actionBadge(item.action).text }}</span>{{ item.name || '-' }}
                    </td>
                    <td class="col-ind" :title="item.industry || ''">{{ item.industry || '-' }}</td>
                    <td class="col-num">{{ item.current_shares ?? 0 }}</td>
                    <td class="col-num">{{ item.target_shares ?? 0 }}</td>
                    <td v-if="selectedPlanHasLiveSignals" class="col-num">{{ item.account_current_shares ?? '-' }}</td>
                    <td v-if="selectedPlanHasLiveSignals" class="col-num">{{ item.live_filled_qty ?? 0 }}</td>
                    <td v-if="selectedPlanHasLiveSignals" class="col-num">{{ item.live_remaining_qty ?? Math.abs(item.delta_shares ?? 0) }}</td>
                    <td v-if="selectedPlanHasLiveSignals" class="col-narrow">{{ item.live_status || '-' }}</td>
                    <td class="col-num">{{ num(item.estimated_price) }}</td>
                    <td class="col-narrow">{{ item.candidate_appearances ?? 0 }}</td>
                    <td v-if="canReselectItems" class="col-action">
                      <button
                        v-if="selectedPlanExcluded.includes(item.symbol)"
                        class="link-btn"
                        :disabled="actionLoading || reselectBusy"
                        @click="reselectItem(item.symbol, true)"
                      >{{ reselectBusy && pendingReselect?.symbol === item.symbol ? '恢复中…' : '恢复' }}</button>
                      <button
                        v-else-if="item.rank != null && (item.current_shares ?? 0) > 0"
                        class="link-btn danger"
                        :disabled="actionLoading || reselectBusy"
                        title="移出目标并清仓该持仓，由候选池补一只新标的"
                        @click="reselectItem(item.symbol)"
                      >{{ reselectBusy && pendingReselect?.symbol === item.symbol ? '处理中…' : '清仓' }}</button>
                      <button
                        v-else-if="item.rank != null"
                        class="link-btn"
                        :disabled="actionLoading || reselectBusy"
                        title="拒绝该买入推荐，用候选池下一名替换"
                        @click="reselectItem(item.symbol)"
                      >{{ reselectBusy && pendingReselect?.symbol === item.symbol ? '处理中…' : '换一只' }}</button>
                      <span v-else>-</span>
                    </td>
                    <td class="col-risk" :title="(item.blockers || []).join(', ')">{{ (item.blockers || []).join(', ') || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section v-if="selectedPlanHasLiveSignals || showPaperSections">
            <h4>{{ selectedPlanHasLiveSignals ? '实盘资金曲线' : 'Paper 净值' }}</h4>
            <div v-if="realtimeEquity" class="realtime-equity">
              <div>
                <span>{{ selectedPlanHasLiveSignals ? '实盘实时估算权益' : '实时估算权益' }}</span>
                <strong>{{ money(realtimeEquity.equity) }}</strong>
              </div>
              <div>
                <span>较最新落库净值</span>
                <strong>{{ signedMoney(realtimeEquity.change) }} / {{ signedPct(realtimeEquity.change_pct) }}</strong>
              </div>
              <div>
                <span>实时市值</span>
                <strong>{{ money(realtimeEquity.market_value) }}</strong>
              </div>
              <div>
                <span>现金</span>
                <strong>{{ money(realtimeEquity.cash) }}</strong>
              </div>
              <div>
                <span>更新时间</span>
                <strong>{{ realtimeEquity.latest_update || '-' }}</strong>
              </div>
            </div>
            <p v-if="!equityRows.length" class="muted">
              {{ selectedPlanHasLiveSignals ? '暂无实盘资金曲线，盘后任务落库后显示。' : '暂无 paper 净值。' }}
            </p>
            <template v-else>
              <div class="equity-summary">
                <div>
                  <span>最新权益</span>
                  <strong>{{ money(equityRows[equityRows.length - 1]?.equity) }}</strong>
                </div>
                <div>
                  <span>累计收益</span>
                  <strong>{{ signedPct(equityChart.latestReturn) }}</strong>
                </div>
                <div>
                  <span>最近变化</span>
                  <strong>{{ signedMoney(equityRows[equityRows.length - 1]?.change) }}</strong>
                </div>
              </div>
              <div class="equity-chart" :aria-label="selectedPlanHasLiveSignals ? 'Live equity curve' : 'Paper equity curve'">
                <svg viewBox="0 0 640 220" role="img">
                  <line x1="28" y1="28" x2="28" y2="192" />
                  <line x1="28" y1="192" x2="612" y2="192" />
                  <polyline :points="equityChart.points" />
                  <circle
                    v-for="point in equityChart.points.split(' ')"
                    :key="point"
                    :cx="point.split(',')[0]"
                    :cy="point.split(',')[1]"
                    r="3"
                  />
                  <text x="36" y="22">{{ money(equityChart.max) }}</text>
                  <text x="36" y="186">{{ money(equityChart.min) }}</text>
                  <text
                    v-for="label in equityChart.labels"
                    :key="label.text"
                    :x="label.x"
                    :y="label.y"
                    :text-anchor="label.anchor"
                  >
                    {{ label.text }}
                  </text>
                </svg>
              </div>
              <div class="table-wrap compact">
                <table>
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>权益</th>
                      <th>日变化</th>
                      <th>日变化率</th>
                      <th>现金</th>
                      <th>市值</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="point in equityRows.slice().reverse()" :key="point.date">
                      <td>{{ point.date }}</td>
                      <td>{{ money(point.equity) }}</td>
                      <td>{{ signedMoney(point.change) }}</td>
                      <td>{{ signedPct(point.changePct) }}</td>
                      <td>{{ money(point.cash) }}</td>
                      <td>{{ money(point.market_value) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
          </section>

          <section v-if="showPaperSections">
            <h4>Paper 成交</h4>
            <p v-if="!executions.length" class="muted">暂无 paper 成交。</p>
            <div v-else class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th class="col-date">日期</th>
                    <th class="col-symbol">代码</th>
                    <th class="col-name">名称</th>
                    <th>动作</th>
                    <th>数量</th>
                    <th>买入价格</th>
                    <th>当前价格</th>
                    <th>涨跌幅</th>
                    <th>金额</th>
                    <th>阻塞原因</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="execution in executions" :key="execution.execution_id">
                    <td class="col-date">{{ execution.execute_date || '-' }}</td>
                    <td class="col-symbol">{{ execution.symbol || '-' }}</td>
                    <td class="col-name">{{ execution.name || '-' }}</td>
                    <td>{{ execution.action || '-' }}</td>
                    <td>{{ execution.quantity ?? 0 }}</td>
                    <td>{{ num(execution.price) }}</td>
                    <td>{{ num(currentPriceForExecution(execution)) }}</td>
                    <td>{{ executionReturnPct(execution) }}</td>
                    <td>{{ money(execution.amount) }}</td>
                    <td>{{ execution.blocker || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
        <p v-else class="muted">请选择一份计划。</p>
      </main>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  approvePortfolioPlan,
  executePortfolioPlanPaper,
  generatePortfolioPlan,
  getPortfolioPlan,
  getPortfolioPlanOperationLogs,
  getPortfolioPlanEquity,
  getPortfolioPlanExecutions,
  getPortfolioPlanLiveEquity,
  getPortfolioPlanLiveExecutions,
  getPortfolioPlanLiveRealtimeEquity,
  getPortfolioPlanGenerationTask,
  getPortfolioPlanGenerationWatermark,
  listPortfolioParameterPresets,
  listLiveTradeExecutions,
  listLiveTradeSignals,
  listPortfolioPlanGenerationTasks,
  listPortfolioPlans,
  listPortfolioStrategies,
  listPortfolioWorkerStatus,
  listTraderHeartbeats,
  publishPortfolioPlanLiveSignals,
  rejectPortfolioPlan,
  rejectPortfolioPlanItem,
  restorePortfolioPlanItem,
} from '../api/portfolioPlans'
import { getSecuritiesAccounts } from '../api/trader'

const strategies = ref([])
const parameterPresets = ref([])
const plans = ref([])
const selectedStrategyId = ref('')
const statusFilter = ref('')
const selectedPlanId = ref('')
const selectedDetail = ref(null)
const equity = ref([])
const realtimeEquity = ref(null)
const executions = ref([])
const operationLogs = ref([])
const loading = ref(false)
const actionLoading = ref(false)
const generateLoading = ref(false)
const tasksLoading = ref(false)
const watermarkLoading = ref(false)
const workerStatusLoading = ref(false)
const liveOpsLoading = ref(false)
const livePublishLoading = ref(false)
const paperExecuteLoading = ref(false)
const operationLogsLoading = ref(false)
const currentGenerationTask = ref(null)
// Tracks an in-flight per-item reselect so we can report the replacement once
// the regeneration task finishes (which symbol filled the freed slot).
const pendingReselect = ref(null)
const generationTasks = ref([])
const generationTasksExpanded = ref(false)
const planGenerationWatermark = ref(null)
const workerStatuses = ref([])
const traderHeartbeats = ref([])
const liveSignals = ref([])
const liveExecutions = ref([])
const liveOpsExpanded = ref(false)
const securitiesAccounts = ref([])
const selectedLiveAccountId = ref('')
const livePublishPreview = ref(null)
const message = ref('')
const reviewComment = ref('')
const lastReselectSummary = ref('')
const reselectStatus = ref({ state: 'idle', text: '' })
const reselectTaskMeta = ref({ taskId: '', status: '' })
let realtimeTimer = null
let generationTaskTimer = null

const generateForm = ref({
  strategy_template_id: '',
  base_date: todayInputDate(),
  mode: 'auto',
  force: false,
  preset_id: '',
  params: {},
})

const executionStatus = computed(() => selectedDetail.value?.execution_status || {})
// execution_mode is the backend's single source of truth: 'paper' | 'live' | 'not_executed'.
const selectedPlanExecutionMode = computed(() => selectedDetail.value?.execution_mode || 'not_executed')
const selectedPlanStatus = computed(() => selectedDetail.value?.plan?.status || '')
const selectedPlanHasLiveSignals = computed(() => selectedPlanExecutionMode.value === 'live')
const selectedPlanExcluded = computed(() => selectedDetail.value?.plan?.excluded_symbols || [])
// Only an unpublished, pre-approval plan can be reselected in place.
const canReselectItems = computed(() => ['needs_review', 'generated', 'draft'].includes(selectedDetail.value?.plan?.status))
const reselectBusy = computed(() => reselectStatus.value.state === 'running')
const paperExecutionCount = computed(() => Number(executionStatus.value?.execution_count || 0))
const hasPaperExecution = computed(() => Boolean(selectedDetail.value?.plan?.paper_executed_at) || paperExecutionCount.value > 0)
// Plan-detail page uses plan-level data only. Keep paper panels hidden while the
// plan is still reselectable to avoid showing stale history from prior plans.
const showPaperSections = computed(() => {
  if (!selectedDetail.value || selectedPlanHasLiveSignals.value || canReselectItems.value) return false
  return selectedPlanStatus.value === 'approved' || hasPaperExecution.value
})
const showPaperExecutionStatus = computed(() => showPaperSections.value && (
  selectedPlanStatus.value === 'approved' || paperExecutionCount.value > 0
))
const canExecutePaperNow = computed(() => (
  selectedPlanStatus.value === 'approved'
  && !selectedPlanHasLiveSignals.value
  && !hasPaperExecution.value
))

const latestExecutionText = computed(() => {
  const latest = executionStatus.value.latest_execution_result
  if (!latest) return '暂无'
  const action = latest.action || 'unknown'
  const symbol = latest.symbol || '-'
  const quantity = latest.quantity ?? 0
  const blocker = latest.blocker ? ` / ${latest.blocker}` : ''
  return `${latest.execute_date || '-'} ${action} ${symbol} ${quantity}${blocker}`
})

const realtimePriceBySymbol = computed(() => {
  const rows = realtimeEquity.value?.positions || []
  return Object.fromEntries(rows.map((row) => [row.symbol, row.realtime_price]))
})

const availableStrategies = computed(() => strategies.value.filter((strategy) => strategy.status !== 'disabled'))
const selectedGenerateStrategy = computed(() => (
  strategies.value.find((strategy) => strategy.strategy_template_id === generateForm.value.strategy_template_id) || null
))
const selectedPreset = computed(() => parameterPresets.value.find((preset) => preset.preset_id === generateForm.value.preset_id) || null)
const presetEvidenceRows = computed(() => {
  const rows = selectedPreset.value?.evidence || []
  if (!Array.isArray(rows)) return []
  return rows.slice(-5).reverse()
})
const universeOptions = [
  { value: 'hs300', label: 'hs300 - 沪深300' },
  { value: 'a500', label: 'a500 - 中证A500' },
  { value: 'csi500', label: 'csi500 - 中证500' },
  { value: 'csi1000', label: 'csi1000 - 中证1000' },
  { value: 'star50', label: 'star50 - 科创50' },
]

function strategyOptionLabel(strategy) {
  if (!strategy) return '-'
  return strategyDisplayName(strategy)
}

function isGrowthCycleLike(row) {
  const id = String(row?.strategy_template_id || '')
  const scoreType = String(row?.score_type || row?.params_snapshot?.score_type || '')
  return id.startsWith('growth_cycle') || scoreType.startsWith('growth_cycle')
}

function strategyDisplayName(row) {
  if (!row) return '-'
  if (isGrowthCycleLike(row)) return '成长周期指数增强'
  return row.strategy_name || row.name || row.strategy_template_id || '-'
}

function planDisplayTitle(plan) {
  return strategyDisplayName(plan)
}

function planParamsFromStrategy(strategy) {
  if (!strategy) return {}
  return {}
}

function clampWeight(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.min(1, Math.max(0, numeric))
}

function roundWeight(value) {
  return Number(clampWeight(value).toFixed(4))
}

function normalizePlanParams(params) {
  const next = { ...params }
  if (!universeOptions.some((option) => option.value === next.universe_index)) {
    next.universe_index = universeOptions[0].value
  }
  const growth = Number.isFinite(Number(next.growth_weight)) ? clampWeight(next.growth_weight) : 0.3
  next.growth_weight = roundWeight(growth)
  next.cycle_weight = roundWeight(1 - growth)
  const capital = Number(next.initial_capital)
  next.initial_capital = Number.isFinite(capital) && capital > 0 ? capital : 1_000_000
  for (const [key, fallback] of Object.entries({
    buy_commission_rate: 0.0001,
    sell_commission_rate: 0.0001,
    min_commission: 5,
    stamp_tax_rate: 0.0005,
    transfer_fee_rate: 0,
  })) {
    const value = Number(next[key])
    next[key] = Number.isFinite(value) && value >= 0 ? value : fallback
  }
  return next
}

function setGrowthWeight(value) {
  const growth = roundWeight(value)
  generateForm.value.params = {
    ...generateForm.value.params,
    growth_weight: growth,
    cycle_weight: roundWeight(1 - growth),
  }
}

function setCycleWeight(value) {
  const cycle = roundWeight(value)
  generateForm.value.params = {
    ...generateForm.value.params,
    cycle_weight: cycle,
    growth_weight: roundWeight(1 - cycle),
  }
}

function presetLabel(preset) {
  const defaultText = preset.is_default ? '默认 · ' : ''
  const source = preset.source === 'portfolio_research' ? '组合研究 · ' : ''
  const evidenceText = preset.evidence_count ? ` · evidence ${preset.evidence_count}` : ''
  return `${defaultText}${source}${preset.name || preset.preset_id}${evidenceText}`
}

function syncGenerateParamsFromStrategy() {
  generateForm.value.params = planParamsFromStrategy(selectedGenerateStrategy.value)
}

async function onGenerateStrategyChange() {
  generateForm.value.preset_id = ''
  syncGenerateParamsFromStrategy()
  await loadParameterPresets()
  applyDefaultPreset()
  await loadPlanGenerationWatermark()
}

function applySelectedPreset() {
  const base = planParamsFromStrategy(selectedGenerateStrategy.value)
  const presetParams = selectedPreset.value?.params || {}
  generateForm.value.params = normalizePlanParams({ ...base, ...presetParams })
}

function applyDefaultPreset() {
  if (generateForm.value.preset_id || !parameterPresets.value.length) return
  const preset = parameterPresets.value.find((row) => row.is_default)
    || parameterPresets.value.find((row) => row.status === 'recommended')
    || parameterPresets.value[0]
  generateForm.value.preset_id = preset.preset_id
  applySelectedPreset()
}

const latestGenerationTask = computed(() => generationTasks.value[0] || null)
const latestTraderHeartbeat = computed(() => traderHeartbeats.value[0] || null)
const liveSignalStatusSummary = computed(() => summarizeByStatus(liveSignals.value))
const liveExecutionStatusSummary = computed(() => summarizeByStatus(liveExecutions.value))
const liveAccountOptions = computed(() => securitiesAccounts.value.map((account) => ({
  id: account.id || account._id,
  label: `${account.broker || '-'} / ${account.account_id || '-'}${account.live_trading_enabled ? ' / live on' : ''}`,
})))
const livePublishBlockers = computed(() => {
  const items = livePublishPreview.value?.risk_report?.items || []
  return items.flatMap((item) => (item.blockers || []).map((blocker) => `${item.symbol}: ${blockerText(blocker)}`))
})
const livePublishRiskRows = computed(() => livePublishPreview.value?.risk_report?.items || [])

const targetScoringRunText = computed(() => scoringRunText(planGenerationWatermark.value?.target_scoring_run))
const latestCompletedScoringText = computed(() => scoringRunText(planGenerationWatermark.value?.latest_completed_scoring_run))
const latestScoringRunText = computed(() => scoringRunText(planGenerationWatermark.value?.latest_scoring_run))
const latestAvailableScoreText = computed(() => {
  const watermark = planGenerationWatermark.value
  if (!watermark?.latest_available_score_date) return '暂无记录'
  return `${watermark.latest_available_score_date} / ${watermark.latest_available_score_count ?? 0} 条`
})
const latestAvailableScoreMeta = computed(() => {
  const scope = planGenerationWatermark.value?.latest_available_score_scope
  if (scope === 'index_codes') return '按当前 universe 匹配'
  if (scope === 'global') return '全局最新 fallback'
  return '-'
})

const equityRows = computed(() => {
  return [...equity.value]
    .filter((point) => Number.isFinite(Number(point.equity)))
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    .map((point, index, rows) => {
      const value = Number(point.equity)
      const previous = index > 0 ? Number(rows[index - 1].equity) : NaN
      const change = Number.isFinite(previous) ? value - previous : null
      const changePct = Number.isFinite(previous) && previous !== 0 ? change / previous : null
      return { ...point, equity: value, change, changePct }
    })
})

const equityChart = computed(() => {
  const rows = equityRows.value
  if (!rows.length) return { points: '', labels: [], min: 0, max: 0, latestReturn: null }
  const values = rows.map((row) => row.equity)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const width = 640
  const height = 220
  const pad = 28
  const points = rows
    .map((row, index) => {
      const x = rows.length === 1 ? width / 2 : pad + (index * (width - pad * 2)) / (rows.length - 1)
      const y = height - pad - ((row.equity - min) * (height - pad * 2)) / span
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const first = rows[0].equity
  const latest = rows[rows.length - 1].equity
  return {
    points,
    min,
    max,
    latestReturn: first ? latest / first - 1 : null,
    labels: [
      { text: rows[0].date, x: pad, y: height - 6, anchor: 'start' },
      { text: rows[rows.length - 1].date, x: width - pad, y: height - 6, anchor: 'end' },
    ],
  }
})

function pct(value) {
  const number = Number(value)
  return Number.isFinite(number) ? `${(number * 100).toFixed(2)}%` : '-'
}

function money(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) : '-'
}

function num(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : '-'
}

function signedMoney(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  const formatted = Math.abs(number).toLocaleString('zh-CN', { maximumFractionDigits: 0 })
  return `${number >= 0 ? '+' : '-'}${formatted}`
}

function signedPct(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return `${number >= 0 ? '+' : ''}${(number * 100).toFixed(2)}%`
}

function currentPriceForExecution(execution) {
  return realtimePriceBySymbol.value[execution?.symbol]
}

function executionReturnPct(execution) {
  const entry = Number(execution?.price)
  const current = Number(currentPriceForExecution(execution))
  if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(current)) return '-'
  return signedPct(current / entry - 1)
}

function todayInputDate() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function scoringRunText(run) {
  if (!run) return '暂无记录'
  const scoreDate = run.score_date || '-'
  const status = run.status || 'unknown'
  return `${scoreDate} / ${status}`
}

function summarizeByStatus(rows) {
  return rows.reduce((acc, row) => {
    const status = row.status || 'unknown'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {})
}

function formatSummary(summary) {
  const entries = Object.entries(summary)
  if (!entries.length) return '暂无'
  return entries.map(([status, count]) => `${status}: ${count}`).join(' / ')
}

function signalDisplayName(signal) {
  return signal?.name || signal?.stock_name || signal?.symbol || '-'
}

function effectiveTopN(plan) {
  return plan?.summary?.target_top_n
    ?? plan?.params_snapshot?.top_n
    ?? '-'
}

function effectiveRebalanceDays(plan) {
  return plan?.params_snapshot?.rebalance_days
    ?? null
}

function effectiveConstructionMode(plan) {
  return plan?.params_snapshot?.construction_mode
    ?? null
}

function effectiveInitialCapital(plan) {
  return plan?.params_snapshot?.initial_capital
    ?? null
}

function planParamSummary(plan) {
  const parts = [`Top${effectiveTopN(plan)}`]
  const rebalanceDays = effectiveRebalanceDays(plan)
  if (rebalanceDays) parts.push(`${rebalanceDays}d`)
  const mode = effectiveConstructionMode(plan)
  if (mode) parts.push(mode)
  return parts.join(' · ')
}

function filterBySelectedAccount(rows) {
  if (!selectedLiveAccountId.value) return rows
  return rows.filter((row) => String(row.securities_account_id || '') === String(selectedLiveAccountId.value))
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

async function refreshAll() {
  await Promise.all([
    loadSecuritiesAccounts(),
    loadStrategies(),
  ])
  if (!generateForm.value.strategy_template_id && availableStrategies.value.length) {
    generateForm.value.strategy_template_id = availableStrategies.value[0].strategy_template_id
  }
  syncGenerateParamsFromStrategy()
  await Promise.all([
    loadParameterPresets(),
    loadWorkerStatus(),
    loadGenerationTasks(),
    loadPlans(),
  ])
  applyDefaultPreset()
  await loadPlanGenerationWatermark()
  loadLiveOps()
}

async function loadSecuritiesAccounts() {
  try {
    const accounts = await getSecuritiesAccounts()
    securitiesAccounts.value = Array.isArray(accounts) ? accounts : []
    if (!selectedLiveAccountId.value && securitiesAccounts.value.length) {
      selectedLiveAccountId.value = securitiesAccounts.value[0].id || securitiesAccounts.value[0]._id
    }
  } catch (error) {
    securitiesAccounts.value = []
  }
}

async function loadStrategies() {
  const res = await listPortfolioStrategies()
  strategies.value = res.data || []
}

async function loadParameterPresets() {
  if (!generateForm.value.strategy_template_id) {
    parameterPresets.value = []
    return
  }
  try {
    const res = await listPortfolioParameterPresets({ strategy_template_id: generateForm.value.strategy_template_id })
    parameterPresets.value = (res.data || []).filter((preset) => preset.status !== 'disabled')
  } catch (error) {
    parameterPresets.value = []
  }
}

async function loadPlans() {
  loading.value = true
  message.value = ''
  try {
    const params = {}
    if (selectedStrategyId.value) params.strategy_template_id = selectedStrategyId.value
    if (statusFilter.value) params.status = statusFilter.value
    const res = await listPortfolioPlans(params)
    plans.value = res.data || []
    if (selectedPlanId.value && !plans.value.some((plan) => plan.plan_id === selectedPlanId.value)) {
      selectedPlanId.value = ''
      selectedDetail.value = null
      equity.value = []
      realtimeEquity.value = null
      executions.value = []
    }
  } catch (error) {
    message.value = error.response?.data?.detail || error.message || '加载计划失败'
  } finally {
    loading.value = false
  }
}

async function loadGenerationTasks() {
  tasksLoading.value = true
  try {
    const res = await listPortfolioPlanGenerationTasks({ limit: 20 })
    generationTasks.value = res.data || []
  } catch (error) {
    message.value = error.response?.data?.detail || error.message || '加载生成任务失败'
  } finally {
    tasksLoading.value = false
  }
}

async function loadWorkerStatus() {
  workerStatusLoading.value = true
  try {
    const res = await listPortfolioWorkerStatus({ worker_type: 'portfolio_plan_generator', limit: 20 })
    workerStatuses.value = res.data || []
  } catch (error) {
    message.value = error.response?.data?.detail || error.message || '加载 worker 状态失败'
  } finally {
    workerStatusLoading.value = false
  }
}

async function loadLiveOps() {
  liveOpsLoading.value = true
  try {
    const params = { limit: 20 }
    if (selectedLiveAccountId.value) params.securities_account_id = selectedLiveAccountId.value
    const heartbeatsPromise = listTraderHeartbeats({ limit: 20 })
    if (selectedPlanId.value) {
      const [planLiveRes, heartbeatsRes] = await Promise.all([
        getPortfolioPlanLiveExecutions(selectedPlanId.value),
        heartbeatsPromise,
      ])
      liveSignals.value = filterBySelectedAccount(planLiveRes.data?.signals || [])
      liveExecutions.value = filterBySelectedAccount(planLiveRes.data?.executions || [])
      traderHeartbeats.value = heartbeatsRes.data || []
      return
    }
    const [signalsRes, executionsRes, heartbeatsRes] = await Promise.all([
      listLiveTradeSignals(params),
      listLiveTradeExecutions(params),
      heartbeatsPromise,
    ])
    liveSignals.value = signalsRes.data || []
    liveExecutions.value = executionsRes.data || []
    traderHeartbeats.value = heartbeatsRes.data || []
  } catch (error) {
    message.value = error.response?.data?.detail || error.message || '加载实盘执行状态失败'
  } finally {
    liveOpsLoading.value = false
  }
}

async function loadPlanGenerationWatermark() {
  if (!generateForm.value.strategy_template_id) {
    planGenerationWatermark.value = null
    return
  }
  watermarkLoading.value = true
  try {
    const res = await getPortfolioPlanGenerationWatermark({
      strategy_template_id: generateForm.value.strategy_template_id,
      base_date: generateForm.value.base_date,
    })
    planGenerationWatermark.value = res.data || null
  } catch (error) {
    message.value = error.response?.data?.detail || error.message || '加载数据水位失败'
  } finally {
    watermarkLoading.value = false
  }
}

async function generatePlan() {
  if (!generateForm.value.strategy_template_id || !generateForm.value.base_date) return
  generateLoading.value = true
  message.value = ''
  try {
    const payload = {
      strategy_template_id: generateForm.value.strategy_template_id,
      base_date: generateForm.value.base_date,
      mode: generateForm.value.mode,
      force: generateForm.value.force,
      preset_id: generateForm.value.preset_id || null,
      params_override: normalizePlanParams(generateForm.value.params),
    }
    const res = await generatePortfolioPlan(payload)
    currentGenerationTask.value = res.data
    await loadPlanGenerationWatermark()
    await loadGenerationTasks()
    selectedStrategyId.value = generateForm.value.strategy_template_id
    statusFilter.value = ''
    message.value = `已提交生成任务 ${res.data?.task_id || ''}`
    startGenerationTaskPolling(res.data?.task_id)
  } catch (error) {
    message.value = error.response?.data?.detail || error.message || '生成计划失败'
  } finally {
    generateLoading.value = false
  }
}

function startGenerationTaskPolling(taskId) {
  if (!taskId) return
  if (generationTaskTimer) window.clearInterval(generationTaskTimer)
  pollGenerationTask(taskId)
  generationTaskTimer = window.setInterval(() => pollGenerationTask(taskId), 3000)
}

async function pollGenerationTask(taskId) {
  try {
    const res = await getPortfolioPlanGenerationTask(taskId)
    currentGenerationTask.value = res.data
    if (pendingReselect.value) {
      reselectTaskMeta.value = { taskId: res.data?.task_id || taskId, status: res.data?.status || '' }
    }
    if (['completed', 'failed'].includes(res.data?.status)) {
      if (generationTaskTimer) {
        window.clearInterval(generationTaskTimer)
        generationTaskTimer = null
      }
      await loadPlanGenerationWatermark()
      await loadWorkerStatus()
      await loadGenerationTasks()
      await loadPlans()
      if (res.data.status === 'completed' && res.data.plan_id) {
        await selectPlan(res.data.plan_id)
        if (pendingReselect.value) {
          const summary = describeReselectResult(pendingReselect.value)
          message.value = summary
          lastReselectSummary.value = summary
          reselectStatus.value = { state: 'success', text: summary }
          reselectTaskMeta.value = { taskId: res.data?.task_id || taskId, status: 'completed' }
          pendingReselect.value = null
        } else {
          message.value = `已生成计划 ${res.data.plan_id}`
        }
      } else if (res.data.status === 'failed') {
        const taskErr = res.data.error_message || '生成计划失败'
        message.value = taskErr
        if (pendingReselect.value) {
          reselectStatus.value = { state: 'error', text: `重选任务失败：${taskErr}` }
          reselectTaskMeta.value = { taskId: res.data?.task_id || taskId, status: 'failed' }
        }
        pendingReselect.value = null
      }
    }
  } catch (error) {
    const detailText = formatApiDetail(error.response?.data?.detail)
    const errText = detailText || error.message || '查询生成任务失败'
    message.value = errText
    if (pendingReselect.value) {
      reselectStatus.value = { state: 'error', text: `重选任务查询失败：${errText}` }
      reselectTaskMeta.value = { taskId, status: 'query_failed' }
    }
  }
}

async function selectPlan(planId) {
  selectedPlanId.value = planId
  reviewComment.value = ''
  livePublishPreview.value = null
  lastReselectSummary.value = ''
  reselectStatus.value = { state: 'idle', text: '' }
  reselectTaskMeta.value = { taskId: '', status: '' }
  const res = await getPortfolioPlan(planId)
  selectedDetail.value = res.data
  if (selectedPlanHasLiveSignals.value) {
    executions.value = []
    await Promise.all([
      loadEquity(),
      loadRealtimeEquity(),
      loadOperationLogs(),
      loadLiveOps(),
    ])
    return
  }
  await Promise.all([
    loadEquity(),
    loadRealtimeEquity(),
    loadExecutions(),
    loadOperationLogs(),
    loadLiveOps(),
  ])
}

async function previewLivePublish() {
  if (!selectedPlanId.value || !selectedLiveAccountId.value) return
  livePublishLoading.value = true
  message.value = ''
  try {
    const res = await publishPortfolioPlanLiveSignals(selectedPlanId.value, {
      securities_account_id: selectedLiveAccountId.value,
      dry_run: true,
    })
    livePublishPreview.value = res.data
  } catch (error) {
    message.value = error.response?.data?.detail?.message || error.response?.data?.detail || error.message || '实盘发布预检失败'
  } finally {
    livePublishLoading.value = false
  }
}

async function publishLiveSignals() {
  if (!selectedPlanId.value || !selectedLiveAccountId.value) return
  livePublishLoading.value = true
  message.value = ''
  try {
    const res = await publishPortfolioPlanLiveSignals(selectedPlanId.value, {
      securities_account_id: selectedLiveAccountId.value,
      dry_run: false,
    })
    livePublishPreview.value = res.data
    message.value = `已发布 ${res.data?.inserted_count ?? 0} 条 live signals，已有 ${res.data?.existing_count ?? 0} 条`
    await loadLiveOps()
    await loadPlans()
  } catch (error) {
    const detail = error.response?.data?.detail
    livePublishPreview.value = detail?.risk_report ? { risk_report: detail.risk_report, blocked: true } : livePublishPreview.value
    message.value = detail?.message || detail || error.message || '实盘发布失败'
  } finally {
    livePublishLoading.value = false
  }
}

async function executePaperNow() {
  if (!selectedPlanId.value || !canExecutePaperNow.value) return
  paperExecuteLoading.value = true
  message.value = ''
  try {
    const res = await executePortfolioPlanPaper(selectedPlanId.value, { force: false })
    const status = res.data?.status || 'executed_paper'
    message.value = `Paper 执行已触发：${status}`
    await selectPlan(selectedPlanId.value)
    await loadPlans()
  } catch (error) {
    const detail = error.response?.data?.detail
    message.value = detail?.message || detail || error.message || '执行 Paper 失败'
  } finally {
    paperExecuteLoading.value = false
  }
}

async function loadEquity() {
  if (selectedPlanHasLiveSignals.value) {
    if (!selectedPlanId.value) {
      equity.value = []
      return
    }
    const res = await getPortfolioPlanLiveEquity(selectedPlanId.value)
    equity.value = res.data || []
    return
  }
  if (!selectedPlanId.value) {
    equity.value = []
    return
  }
  if (!showPaperSections.value) {
    equity.value = []
    return
  }
  const res = await getPortfolioPlanEquity(selectedPlanId.value)
  equity.value = res.data || []
}

async function loadRealtimeEquity() {
  if (selectedPlanHasLiveSignals.value) {
    if (!selectedPlanId.value) {
      realtimeEquity.value = null
      return
    }
    const res = await getPortfolioPlanLiveRealtimeEquity(selectedPlanId.value)
    realtimeEquity.value = res.data || null
    return
  }
  // Plan detail should not consume strategy-level realtime snapshots.
  realtimeEquity.value = null
}

async function loadExecutions() {
  if (!showPaperSections.value) {
    executions.value = []
    return
  }
  if (!selectedPlanId.value) {
    executions.value = []
    return
  }
  const res = await getPortfolioPlanExecutions(selectedPlanId.value)
  executions.value = res.data || []
}

async function loadOperationLogs() {
  if (!selectedPlanId.value) {
    operationLogs.value = []
    return
  }
  operationLogsLoading.value = true
  try {
    const res = await getPortfolioPlanOperationLogs(selectedPlanId.value, { limit: 100 })
    operationLogs.value = res.data || []
  } catch (error) {
    const detailText = formatApiDetail(error.response?.data?.detail)
    message.value = detailText || error.message || '加载操作日志失败'
  } finally {
    operationLogsLoading.value = false
  }
}

async function review(decision) {
  if (!selectedPlanId.value) return
  actionLoading.value = true
  try {
    const payload = { comment: reviewComment.value }
    if (decision === 'approved') {
      await approvePortfolioPlan(selectedPlanId.value, payload)
    } else {
      await rejectPortfolioPlan(selectedPlanId.value, payload)
    }
    await selectPlan(selectedPlanId.value)
    await loadPlans()
  } finally {
    actionLoading.value = false
  }
}

function actionBadge(action) {
  switch (action) {
    case 'buy':
      return { text: 'B', label: '买入', cls: 'tag-buy' }
    case 'sell':
      return { text: 'S', label: '卖出', cls: 'tag-sell' }
    case 'hold':
      return { text: 'H', label: '持有', cls: 'tag-hold' }
    default:
      return { text: '·', label: '跳过', cls: 'tag-skip' }
  }
}

function describeReselectResult(pending) {
  const items = selectedDetail.value?.items || []
  const nameOf = (sym) => {
    const hit = items.find((item) => item.symbol === sym)
    return hit?.name ? `${sym}(${hit.name})` : sym
  }
  const before = new Set(pending.beforeTargets || [])
  const afterTargets = items.filter((item) => item.rank != null).map((item) => item.symbol)
  const added = afterTargets.filter((sym) => !before.has(sym) && sym !== pending.symbol)
  if (pending.type === 'restore') {
    return afterTargets.includes(pending.symbol)
      ? `已恢复 ${nameOf(pending.symbol)}，重新纳入目标`
      : `已恢复 ${pending.symbol}（当前排名未进入目标）`
  }
  if (added.length) {
    return `已排除 ${pending.symbol}，补位换为 ${added.map(nameOf).join('、')}`
  }
  return `已排除 ${pending.symbol}，候选池无可补位标的（目标持仓数减少）`
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

async function reselectItem(symbol, restore = false) {
  if (!selectedPlanId.value || !symbol || reselectBusy.value) return
  if (restore && !selectedPlanExcluded.value.includes(symbol)) {
    const txt = `无需恢复：${symbol} 当前不在已排除列表中`
    reselectStatus.value = { state: 'success', text: txt }
    lastReselectSummary.value = txt
    return
  }
  actionLoading.value = true
  try {
    const apiCall = restore ? restorePortfolioPlanItem : rejectPortfolioPlanItem
    // Snapshot current target names so we can diff after regeneration.
    const beforeTargets = (selectedDetail.value?.items || [])
      .filter((item) => item.rank != null)
      .map((item) => item.symbol)
    const res = await apiCall(selectedPlanId.value, symbol)
    const task = res.data?.task
    if (task?.task_id) {
      lastReselectSummary.value = ''
      pendingReselect.value = { type: restore ? 'restore' : 'reject', symbol, beforeTargets }
      reselectTaskMeta.value = { taskId: task.task_id, status: 'pending' }
      currentGenerationTask.value = task
      reselectStatus.value = {
        state: 'running',
        text: restore ? `正在恢复 ${symbol}，任务 ${task.task_id} 执行中…` : `正在重选 ${symbol}，任务 ${task.task_id} 执行中…`,
      }
      message.value = restore ? `已恢复 ${symbol}，正在重算计划…` : `已排除 ${symbol}，正在重选补位…`
      await loadOperationLogs()
      await loadGenerationTasks()
      startGenerationTaskPolling(task.task_id)
    } else if (res.data?.operation_log?.status === 'noop') {
      const noopMsg = res.data?.operation_log?.message || `无需恢复：${symbol}`
      reselectStatus.value = { state: 'success', text: noopMsg }
      lastReselectSummary.value = noopMsg
      await loadOperationLogs()
    } else {
      reselectStatus.value = { state: 'error', text: '重选任务创建失败：未返回 task_id' }
      reselectTaskMeta.value = { taskId: '', status: 'create_failed' }
    }
  } catch (error) {
    const detailText = formatApiDetail(error.response?.data?.detail)
    const errText = detailText || error.message || '重选失败'
    reselectStatus.value = { state: 'error', text: `重选失败：${errText}` }
    reselectTaskMeta.value = { taskId: '', status: 'request_failed' }
    message.value = errText
  } finally {
    actionLoading.value = false
  }
}

onMounted(() => {
  refreshAll()
  realtimeTimer = window.setInterval(() => {
    if (selectedDetail.value?.plan?.strategy_template_id) {
      loadRealtimeEquity()
    }
  }, 60000)
})

onUnmounted(() => {
  if (realtimeTimer) window.clearInterval(realtimeTimer)
  if (generationTaskTimer) window.clearInterval(generationTaskTimer)
})
</script>

<style scoped>
.portfolio-plans {
  background: #fff;
  box-sizing: border-box;
  color: #111827;
  display: flex;
  flex-direction: column;
  gap: 16px;
  line-height: 1.5;
  margin: 0 auto;
  max-width: 1440px;
  padding: 24px;
  width: 100%;
}

.page-header,
.toolbar,
.detail-header,
.metrics,
.layout {
  display: flex;
  gap: 12px;
}

.page-header,
.detail-header {
  align-items: center;
  justify-content: space-between;
}

.eyebrow,
.muted {
  color: #374151;
  font-size: 13px;
}

.subtitle {
  color: #111827;
  margin-top: 4px;
}

h2,
h3,
h4,
p {
  margin: 0;
}

button,
input,
select,
textarea {
  background: #fff;
  border: 1px solid #111827;
  border-radius: 4px;
  color: #111827;
  padding: 8px 10px;
}

button {
  background: #fff;
  color: #111827;
  cursor: pointer;
}

button:disabled {
  color: #6b7280;
  cursor: not-allowed;
}

button.danger {
  border-color: #111827;
  color: #111827;
}

.link-btn {
  background: transparent;
  border: 1px solid #c7ccd6;
  border-radius: 3px;
  color: #1f2937;
  font-size: 12px;
  padding: 2px 8px;
}

.link-btn.danger {
  border-color: #b91c1c;
  color: #b91c1c;
}

.excluded-bar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.reselect-summary {
  color: #2563eb;
  font-size: 12px;
  margin: 4px 0 8px;
}

.reselect-meta {
  color: #6b7280;
  font-size: 11px;
  margin: -4px 0 8px;
}

.operation-log-panel {
  margin-bottom: 12px;
}

.operation-log-table td,
.operation-log-table th {
  white-space: nowrap;
}

.reselect-meta {
  color: #6b7280;
  font-size: 11px;
  margin: -4px 0 8px;
}

.reselect-status {
  align-items: center;
  border-radius: 4px;
  display: inline-flex;
  font-size: 12px;
  gap: 6px;
  margin: 4px 0 8px;
  padding: 4px 8px;
}

.reselect-status.is-running {
  background: #eff6ff;
  color: #1d4ed8;
}

.reselect-status.is-success {
  background: #ecfdf5;
  color: #047857;
}

.reselect-status.is-error {
  background: #fef2f2;
  color: #b91c1c;
}

.spinner {
  animation: spin 0.8s linear infinite;
  border: 2px solid #c7d2fe;
  border-radius: 999px;
  border-top-color: #2563eb;
  display: inline-block;
  height: 12px;
  width: 12px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.excluded-label {
  color: #6b7280;
  font-size: 12px;
}

.excluded-chip {
  align-items: center;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  display: inline-flex;
  font-size: 12px;
  gap: 6px;
  padding: 2px 4px 2px 10px;
}

.excluded-chip .link-btn {
  border: none;
  color: #2563eb;
  padding: 0 4px;
}

.plan-items-table {
  table-layout: fixed;
  width: 100%;
}

.plan-items-table th,
.plan-items-table td {
  font-size: 12px;
  overflow: hidden;
  padding: 3px 5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plan-items-table .col-num {
  text-align: right;
  width: 54px;
}

.plan-items-table .col-narrow {
  width: 44px;
}

.plan-items-table .col-symbol {
  width: 70px;
}

.plan-items-table .col-name {
  width: 92px;
}

.plan-items-table .col-ind {
  width: 62px;
}

.plan-items-table .col-action {
  overflow: visible;
  width: 60px;
}

.plan-items-table .col-action .link-btn {
  padding: 1px 6px;
}

.plan-items-table .col-risk {
  width: 84px;
}

.plan-items-table .link-btn {
  white-space: nowrap;
}

.action-tag {
  border-radius: 3px;
  color: #fff;
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  line-height: 14px;
  margin-right: 4px;
  text-align: center;
  width: 14px;
}

/* A股配色：买入=红，卖出=绿 */
.action-tag.tag-buy {
  background: #d12b2b;
}

.action-tag.tag-sell {
  background: #1f9d55;
}

.action-tag.tag-hold {
  background: #6b7280;
}

.action-tag.tag-skip {
  background: #c7ccd6;
}

.card {
  background: #fff;
  border: 1px solid #111827;
  border-radius: 4px;
  color: #111827;
  padding: 14px;
}

.generate-card {
  align-items: end;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(220px, 1fr) minmax(220px, 1.2fr) minmax(160px, 0.7fr) minmax(140px, 0.6fr) auto auto;
}

.generate-card label,
.toolbar label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.generate-card .inline-check {
  align-items: center;
  flex-direction: row;
  gap: 6px;
  padding-bottom: 8px;
}

.strategy-param-card {
  background: #f9fafb;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  grid-column: 1 / -1;
  padding: 12px;
}

.strategy-param-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 10px;
}

.strategy-param-header p {
  margin: 4px 0 0;
}

.editable-badge {
  border: 1px solid #111827;
  border-radius: 999px;
  flex-shrink: 0;
  font-size: 12px;
  padding: 3px 8px;
}

.strategy-param-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.strategy-param-grid div {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  min-width: 0;
  padding: 8px;
}

.strategy-param-grid.editable label {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 8px;
}

.strategy-param-grid span {
  color: #6b7280;
  display: block;
  font-size: 12px;
  margin-bottom: 4px;
}

.preset-evidence {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin: 8px 0 10px;
}

.preset-evidence span {
  color: #4b5563;
  font-size: 12px;
}

.preset-evidence-list {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  margin: 0 0 10px;
  padding: 8px 10px;
}

.preset-evidence-list strong {
  display: block;
  margin-bottom: 6px;
}

.preset-evidence-list p {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin: 4px 0;
}

.preset-evidence-list span {
  color: #4b5563;
  font-size: 12px;
}

.strategy-param-grid strong {
  display: block;
  overflow-wrap: anywhere;
}

.task-status {
  grid-column: 1 / -1;
}

.task-list-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-list-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.task-list-actions {
  display: flex;
  gap: 8px;
}

.generation-task-table tbody tr {
  cursor: pointer;
}

.generation-task-table tbody tr.active {
  background: #f3f4f6;
}

.truncate {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.worker-status-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.live-ops-card,
.live-publish-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.live-ops-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.ops-line {
  border: 1px solid #111827;
  border-radius: 4px;
  display: grid;
  gap: 4px;
  grid-template-columns: 90px 1fr;
  margin-top: 6px;
  padding: 8px;
}

.ops-line small {
  color: #374151;
  grid-column: 1 / -1;
  overflow-wrap: anywhere;
}

.risk-report {
  border: 1px solid #111827;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
}

.risk-report-table tr.blocked {
  background: #fef2f2;
}

.risk-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-width: 360px;
  white-space: normal;
}

.risk-chip {
  border: 1px solid #111827;
  border-radius: 999px;
  display: inline-block;
  padding: 2px 8px;
}

.watermark-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.watermark-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.watermark-grid div {
  border: 1px solid #111827;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
}

.watermark-grid span,
.watermark-grid small {
  color: #374151;
}

.watermark-warning {
  background: #f3f4f6;
  border: 1px solid #111827;
  border-radius: 4px;
  padding: 10px;
}

.worker-status-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.worker-status-row {
  border: 1px solid #111827;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
}

.worker-status-row span,
.worker-status-row small {
  color: #374151;
  overflow-wrap: anywhere;
}

.plan-list {
  flex: 0 0 340px;
}

.detail {
  flex: 1;
  overflow: hidden;
}

.plan-row {
  background: #fff;
  border: 1px solid #111827;
  color: #111827;
  display: block;
  margin-top: 8px;
  text-align: left;
  width: 100%;
}

.plan-row.active {
  background: #f3f4f6;
  border-color: #111827;
}

.plan-row span,
.plan-row small,
.plan-row em {
  display: block;
}

.plan-row small,
.plan-row em {
  color: #111827;
  font-style: normal;
}

.metrics {
  flex-wrap: wrap;
  margin: 14px 0;
}

.metrics div {
  background: #fff;
  border: 1px solid #111827;
  border-radius: 4px;
  color: #111827;
  padding: 10px 12px;
}

.metrics span {
  color: #111827;
  display: block;
  font-size: 12px;
}

.execution-status {
  margin-bottom: 14px;
}

.status-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin-top: 8px;
}

.status-grid div {
  border: 1px solid #111827;
  border-radius: 4px;
  min-width: 0;
  overflow-wrap: anywhere;
  padding: 8px 10px;
  word-break: break-word;
}

.status-grid span,
.status-grid small {
  display: block;
  font-size: 12px;
  line-height: 1.4;
}

.status-grid strong {
  display: block;
  line-height: 1.4;
  white-space: normal;
}

.message {
  color: #111827;
}

.review-comment {
  display: block;
  margin-bottom: 14px;
}

.review-comment textarea {
  display: block;
  margin-top: 6px;
  width: 100%;
}

.table-wrap {
  overflow: auto;
}

table {
  border-collapse: collapse;
  font-size: 13px;
  min-width: 980px;
  width: 100%;
}

th,
td {
  border: 1px solid #111827;
  color: #111827;
  padding: 8px 10px;
  text-align: left;
  white-space: nowrap;
}

th {
  background: #f3f4f6;
  color: #111827;
  font-weight: 700;
}

.col-date {
  max-width: 86px;
  width: 86px;
}

.col-symbol {
  max-width: 92px;
  width: 92px;
}

.col-name {
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 90px;
}

.equity-summary,
.realtime-equity {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.equity-summary div,
.realtime-equity div {
  background: #fff;
  border: 1px solid #111827;
  border-radius: 4px;
  color: #111827;
  padding: 8px 10px;
}

.equity-summary span,
.realtime-equity span {
  display: block;
  font-size: 12px;
}

.equity-chart {
  border: 1px solid #111827;
  margin-bottom: 10px;
  overflow: hidden;
}

.equity-chart svg {
  background: #fff;
  display: block;
  height: 260px;
  width: 100%;
}

.equity-chart line {
  stroke: #111827;
  stroke-width: 1;
}

.equity-chart polyline {
  fill: none;
  stroke: #111827;
  stroke-width: 3;
}

.equity-chart circle {
  fill: #111827;
}

.equity-chart text {
  fill: #111827;
  font-size: 12px;
}

.table-wrap.compact table {
  min-width: 720px;
}

@media (max-width: 768px) {
  .portfolio-plans {
    padding: 12px;
  }
}
</style>
