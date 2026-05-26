<template>
  <div class="strategy-lab">
    <header class="lab-header">
      <div>
        <p class="eyebrow">Strategy Lab</p>
        <h2>策略实验室</h2>
        <p class="subtitle">批量回测、横截面排名、AI 复盘和下一轮实验生成。</p>
      </div>
      <button class="primary" :disabled="loading || loopSubmitting" @click="refreshAll">刷新</button>
    </header>

    <section class="card">
      <h3>批量实验配置</h3>
      <p class="subtitle">这组配置可用于创建单次批量实验，也可作为自动迭代 Loop 的第 1 轮输入。</p>
      <div class="form-grid">
        <label>
          实验名
          <input v-model="form.name" placeholder="中证1000 海龟保守参数" />
        </label>
        <label>
          实验对象
          <select v-model="form.target_mode">
            <option value="index">指数成分股</option>
            <option value="single_etf">单个 ETF</option>
            <option value="manual">自定义标的列表</option>
            <option value="strategy_pool">策略选股池</option>
          </select>
        </label>
        <label v-if="form.target_mode === 'index'">
          指数
          <input v-model="form.universe_value" placeholder="例如 csi1000" />
        </label>
        <label v-else-if="form.target_mode === 'single_etf'">
          ETF
          <select v-model="form.etf_symbol" @focus="loadEtfOptions">
            <option value="">请选择 ETF</option>
            <option v-for="etf in etfOptions" :key="etf.ts_code" :value="etf.ts_code">
              {{ etf.ts_code }} · {{ etf.name || 'ETF' }}
            </option>
          </select>
          <input v-model="etfSearch" placeholder="搜索 ETF 代码/名称，如 512100 或 中证1000" @keyup.enter="searchEtfOptions" />
          <div class="inline-actions">
            <button type="button" class="mini-btn" :disabled="etfOptionsLoading" @click="searchEtfOptions">
              {{ etfOptionsLoading ? '搜索中…' : '搜索 ETF' }}
            </button>
            <span v-if="etfOptionsMessage" class="muted">{{ etfOptionsMessage }}</span>
          </div>
          <small>直接对 ETF 本身跑回测，不展开指数成分股；也可搜索后从下拉选择。</small>
        </label>
        <label v-else-if="form.target_mode === 'strategy_pool'">
          选股池
          <input v-model="form.universe_value" placeholder="例如 dragon_default" />
        </label>
        <label v-else>
          标的类型
          <select v-model="form.asset_type">
            <option value="stock">股票</option>
            <option value="etf">ETF</option>
          </select>
        </label>
        <label>
          策略
          <select v-model="form.strategy_key">
            <option v-if="!usableStrategies.length" value="">策略加载失败，请刷新</option>
            <option v-for="strategy in usableStrategies" :key="strategy.key" :value="strategy.key">
              {{ strategy.name || strategy.key }}（{{ strategy.key }}）
            </option>
          </select>
          <small v-if="strategyLoadError">{{ strategyLoadError }}，已使用本地默认列表</small>
        </label>
        <label>
          Preset
          <select v-model="form.preset">
            <option value="">默认参数</option>
            <option v-for="preset in selectedPresets" :key="preset.preset" :value="preset.preset">
              {{ preset.description || preset.preset }}
            </option>
          </select>
        </label>
        <label>
          初始资金
          <input v-model.number="form.initial_cash" type="number" />
        </label>
        <label v-if="form.target_mode === 'single_etf'">
          资金使用率
          <input v-model.number="form.etf_position_pct" type="number" min="0.01" max="1" step="0.01" />
          <small>单 ETF 建仓时使用的账户资金比例，例如 0.95 表示尽量使用 95% 资金。</small>
        </label>
        <label v-if="form.target_mode !== 'single_etf'">
          测试数量限制
          <input v-model.number="form.limit_symbols" type="number" min="0" />
          <small>0 表示跑完整股票池</small>
        </label>
        <label>
          开始日期
          <input v-model="form.start_date" placeholder="20240101" />
        </label>
        <label>
          结束日期
          <input v-model="form.end_date" placeholder="20241231" />
        </label>
      </div>
      <label v-if="form.target_mode === 'manual'" class="full">
        自定义标的（逗号/空格/换行分隔）
        <textarea v-model="symbolsText" rows="3" placeholder="000001.SZ, 000858.SZ"></textarea>
      </label>
      <div class="params-table-wrap full">
        <button type="button" class="collapse-toggle" @click="createParamsExpanded = !createParamsExpanded">
          <span class="collapse-chevron" :class="{ expanded: createParamsExpanded }">▸</span>
          <strong>策略参数</strong>
          <span class="muted">（{{ createParamTableRows.length }} 项）</span>
        </button>
        <div v-show="createParamsExpanded" class="collapse-body">
          <table class="params-table" v-if="createParamTableRows.length">
            <thead>
              <tr>
                <th>参数</th>
                <th>默认值</th>
                <th>实验值</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in createParamTableRows"
                :key="row.key"
                :class="{
                  'param-row-changed': row.changed && row.hasCurrent,
                  'param-row-new': row.isNew,
                }"
              >
                <td class="param-name">
                  <span class="param-key">{{ row.key }}</span>
                  <small v-if="createParamLabel(row.key) !== row.key" class="param-desc">
                    {{ createParamLabel(row.key) }}
                  </small>
                </td>
                <td class="param-current">{{ formatParamDisplay(row.currentValue) }}</td>
                <td class="param-next">
                  <input
                    :value="formatParamDisplay(row.nextValue)"
                    @change="setCreateFormParam(row.key, $event.target.value, row.currentValue)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <p v-else class="muted">选择 Preset 或策略后将显示可编辑参数；也可先选策略再改实验值。</p>
        </div>
      </div>
    </section>

    <section class="card loop-panel">
      <div class="section-title-row">
        <div>
          <p class="section-kicker">自动化流程 · Loop 维度</p>
          <h3>自动迭代 Loop</h3>
        </div>
        <span class="type-badge loop-badge">Loop 流程</span>
      </div>
      <p class="subtitle">一条 Loop 会串联多次批量实验：批量完成 → AI 复盘 → 应用建议参数 → 再测，直到达到停止规则或最大轮数。</p>
      <div class="loop-health-panel" :class="{ unhealthy: loopHealth && !loopHealth.auto_advance_available }">
        <div>
          <strong>自动推进状态</strong>
          <span>{{ loopHealthStatusText }}</span>
        </div>
        <div class="loop-health-meta">
          <span>scheduler：{{ loopHealth?.scheduler_online ? '在线' : '离线/未知' }}</span>
          <span>tick：{{ loopHealth?.tick_enabled ? '启用' : '禁用' }} / {{ loopHealth?.tick_loaded ? '已加载' : '未加载' }}</span>
          <span>运行中 Loop：{{ loopHealth?.active_loop_count ?? '-' }}</span>
          <span v-if="loopHealth?.heartbeat_age_seconds !== null && loopHealth?.heartbeat_age_seconds !== undefined">
            心跳 {{ Math.round(loopHealth.heartbeat_age_seconds) }}s 前
          </span>
        </div>
      </div>
      <div class="form-grid">
        <label>
          最大轮数
          <input v-model.number="loopForm.max_iterations" type="number" min="1" max="20" />
        </label>
        <label>
          复盘目标
          <input v-model="loopForm.objective" placeholder="提高收益并控制回撤" />
        </label>
        <label>
          最低完成率
          <input v-model.number="loopForm.min_completion_rate" type="number" min="0" max="1" step="0.05" />
        </label>
      </div>
      <div class="actions">
        <button class="primary" :disabled="loopSubmitting" @click="() => startAutoLoop()">从上方配置启动</button>
        <button
          :disabled="!canStartLoopFromBatch || loopSubmitting"
          :title="startLoopFromBatchHint"
          @click="() => startAutoLoopFromBatch()"
        >
          从当前实验启动
        </button>
        <button :disabled="!selectedLoopId" @click="refreshSelectedLoop">刷新 Loop</button>
        <span v-if="loopMessage" class="message">{{ loopMessage }}</span>
      </div>
      <div class="loop-layout" v-if="loops.length">
        <aside class="loop-list">
          <div class="list-caption">
            <strong>Loop 列表</strong>
            <span>每条代表一组自动迭代流程</span>
          </div>
          <button
            v-for="loop in loops"
            :key="loop.loop_id"
            class="batch-row loop-row"
            :class="{ active: selectedLoopId === loop.loop_id }"
            @click="selectLoop(loop.loop_id)"
          >
            <span class="row-type">Loop</span>
            <strong>{{ loop.name || loop.loop_id }}</strong>
            <small>流程状态：{{ loop.status }} · 第 {{ loop.current_iteration }}/{{ loop.max_iterations }} 轮 · {{ loopStepLabel(loop.current_step) }}</small>
          </button>
        </aside>
        <div class="loop-detail" v-if="selectedLoop">
          <div class="detail-actions">
            <button
              v-if="selectedLoop.status === 'running'"
              :disabled="loopSubmitting"
              @click="() => pauseSelectedLoop()"
            >
              暂停
            </button>
            <button
              v-if="selectedLoop.status === 'paused'"
              :disabled="loopSubmitting"
              @click="() => resumeSelectedLoop()"
            >
              继续
            </button>
            <button
              v-if="canManageActiveLoop"
              :disabled="loopSubmitting"
              @click="() => cancelSelectedLoop()"
            >
              取消 Loop
            </button>
            <button
              v-if="canAdvanceLoop"
              :disabled="loopSubmitting"
              title="推进一轮：批量完成 → 复盘 → 再测"
              @click="() => advanceSelectedLoop()"
            >
              手动推进
            </button>
            <button
              class="danger"
              :disabled="!canDeleteSelectedLoop || loopSubmitting"
              :title="canDeleteSelectedLoop ? '只删除 Loop 历史记录，不删除关联的批量实验' : '运行中/暂停中的 Loop 需要先取消或完成后才能删除'"
              @click="() => deleteSelectedLoop()"
            >
              删除历史 Loop
            </button>
          </div>
          <div v-if="pendingDeleteLoop" class="inline-confirm danger-confirm">
            <strong>确认删除历史 Loop「{{ pendingDeleteLoop.name }}」？</strong>
            <p>只删除 Loop 流程记录，不删除关联的批量实验和回测结果。</p>
            <div class="confirm-actions">
              <button class="danger" :disabled="loopSubmitting" @click="() => confirmDeleteSelectedLoop()">
                确认删除
              </button>
              <button :disabled="loopSubmitting" @click="pendingDeleteLoop = null">取消</button>
            </div>
          </div>
          <p v-if="selectedLoop.stop_reason" class="message">停止原因：{{ selectedLoop.stop_reason }}</p>
          <section class="loop-wait-panel" v-if="loopSummary?.waiting_reason">
            <strong>当前等待：{{ loopSummary.waiting_reason }}</strong>
            <p>{{ loopSummary.waiting_detail }}</p>
            <div class="loop-health-meta" v-if="loopSummary.waiting_status_counts">
              <span>pending：{{ loopSummary.waiting_status_counts.pending || 0 }}</span>
              <span>claimed：{{ loopSummary.waiting_status_counts.claimed || 0 }}</span>
              <span>running：{{ loopSummary.waiting_status_counts.running || 0 }}</span>
              <span>completed：{{ loopSummary.waiting_status_counts.completed || 0 }}</span>
              <span>failed：{{ loopSummary.waiting_status_counts.failed || 0 }}</span>
            </div>
            <div class="loop-review-task-box" v-if="loopSummary.waiting_review_task">
              <strong>AI 复盘任务</strong>
              <div class="loop-health-meta">
                <span>状态：{{ loopSummary.waiting_review_task.status }}</span>
                <span>任务：{{ loopSummary.waiting_review_task.task_id || '-' }}</span>
                <span>Worker：{{ loopSummary.waiting_review_task.worker_id || '-' }}</span>
                <span>创建：{{ formatDateTime(loopSummary.waiting_review_task.created_at) }}</span>
                <span>更新：{{ formatDateTime(loopSummary.waiting_review_task.updated_at) }}</span>
                <span>结果文档：{{ loopSummary.waiting_review_doc_exists ? '已写入' : '未写入' }}</span>
              </div>
              <p v-if="loopSummary.waiting_review_task.error" class="error">
                {{ loopSummary.waiting_review_task.error }}
              </p>
            </div>
            <p v-else-if="loopSummary.current_step === 'wait_review'" class="muted">
              尚未找到 AI 复盘任务记录；可能还没入队，或任务记录写入异常。
            </p>
            <button
              v-if="loopSummary.current_batch_id"
              type="button"
              class="mini-btn"
              @click="() => selectBatch(loopSummary.current_batch_id)"
            >
              查看当前轮实验
            </button>
          </section>
          <section class="loop-final-report-panel" v-if="loopSummary">
            <h4>AI 综合结论</h4>
            <p v-if="loopSummary.final_report_status === 'pending'" class="muted">
              正在由 quantAnalyzer 生成跨轮综合报告，通常需 1–3 分钟。请稍后点击「刷新 Loop」查看。
            </p>
            <p v-else-if="loopSummary.final_report_status === 'failed'" class="message">
              综合报告生成失败：{{ loopSummary.final_report_error || '未知错误' }}
              <button type="button" class="mini-btn" @click="() => requestLoopFinalReport(true)">重试</button>
            </p>
            <template v-else-if="loopSummary.has_final_report_content">
              <p class="report-lead">{{ loopSummary.final_report.summary }}</p>
              <p v-if="loopSummary.final_report.best_iteration" class="muted">
                相对最优：第 {{ loopSummary.final_report.best_iteration }} 轮
                <span v-if="loopSummary.final_report.best_iteration_reason">
                  — {{ loopSummary.final_report.best_iteration_reason }}
                </span>
              </p>
              <div v-if="loopSummary.final_report.iteration_comparison?.length" class="report-block">
                <strong>各轮对比</strong>
                <ul>
                  <li
                    v-for="(item, idx) in loopSummary.final_report.iteration_comparison"
                    :key="item.batch_id || item.iteration || idx"
                  >
                    第 {{ item.iteration }} 轮（{{ item.batch_id || '—' }}）：{{ item.verdict }}
                    <span v-if="item.metric_note" class="param-desc"> — {{ item.metric_note }}</span>
                  </li>
                </ul>
              </div>
              <div v-if="loopSummary.final_report.main_findings?.length" class="report-block">
                <strong>主要发现</strong>
                <ul>
                  <li v-for="(item, idx) in loopSummary.final_report.main_findings" :key="idx">{{ item }}</li>
                </ul>
              </div>
              <div v-if="loopSummary.final_report.lessons_learned?.length" class="report-block">
                <strong>经验总结</strong>
                <ul>
                  <li v-for="(item, idx) in loopSummary.final_report.lessons_learned" :key="idx">{{ item }}</li>
                </ul>
              </div>
              <div
                v-if="loopSummary.final_report.recommended_params && Object.keys(loopSummary.final_report.recommended_params).length"
                class="report-block"
              >
                <strong>推荐参数</strong>
                <ul>
                  <li
                    v-for="(val, key) in loopSummary.final_report.recommended_params"
                    :key="key"
                  >
                    {{ key }} = {{ formatParamDisplay(val) }}
                  </li>
                </ul>
              </div>
              <div v-if="loopSummary.final_report.next_steps?.length" class="report-block">
                <strong>后续建议</strong>
                <ul>
                  <li v-for="(item, idx) in loopSummary.final_report.next_steps" :key="idx">{{ item }}</li>
                </ul>
              </div>
            </template>
            <p v-else-if="loopSummary.can_request_final_report" class="muted">
              Loop 已完成，可生成跨 {{ loopSummary.iterations?.length || 0 }} 轮的综合 AI 结论。
              <button type="button" class="mini-btn primary-mini" @click="() => requestLoopFinalReport(true)">
                生成综合结论
              </button>
            </p>
            <p v-else class="muted">
              暂无综合结论。
              <button
                v-if="loopSummary.can_request_final_report"
                type="button"
                class="mini-btn primary-mini"
                @click="() => requestLoopFinalReport(true)"
              >
                生成综合结论
              </button>
            </p>
          </section>
          <p v-else-if="loopSummaryLoading" class="muted">加载迭代总结…</p>
          <p v-else-if="selectedLoopId && !loopSummary" class="muted">
            迭代总结未加载，请点「刷新 Loop」重试。
          </p>
          <section class="loop-summary-panel" v-if="loopSummary">
            <h4>迭代总结（{{ loopSummary.iterations?.length || 0 }} 轮回测）</h4>
            <p v-if="loopSummary.is_terminal" class="muted">
              各轮完整 AI 复盘可在下方实验列表中点开对应 batch 查看；此处汇总各轮批量指标与复盘摘要。
            </p>
            <table class="params-table loop-summary-table" v-if="loopSummary.iterations?.length">
              <thead>
                <tr>
                  <th>轮次</th>
                  <th>实验</th>
                  <th>状态</th>
                  <th>完成率</th>
                  <th>中位收益</th>
                  <th>均回撤</th>
                  <th>决策</th>
                  <th>复盘摘要</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in loopSummary.iterations" :key="`${row.iteration}-${row.batch_id}`">
                  <td>第 {{ row.iteration }} 轮</td>
                  <td>
                    <button type="button" class="link-btn" @click="selectBatch(row.batch_id)">
                      {{ row.batch_name || row.batch_id }}
                    </button>
                    <small class="param-desc">{{ row.batch_id }}</small>
                    <small v-if="row.param_changes?.length" class="param-desc">
                      调参：{{ row.param_changes.join(', ') }}
                    </small>
                  </td>
                  <td>{{ row.batch_status || '—' }}</td>
                  <td>{{ pct(row.completion_rate) }}</td>
                  <td>{{ pct(row.median_total_return) }}</td>
                  <td>{{ pct(row.avg_max_drawdown) }}</td>
                  <td>
                    <span v-if="row.decision">{{ row.decision }}</span>
                    <span v-else class="muted">—</span>
                    <small v-if="row.decision_reason" class="param-desc">{{ row.decision_reason }}</small>
                  </td>
                  <td class="review-snippet">
                    <span v-if="row.review_summary">{{ row.review_summary }}</span>
                    <span v-else-if="row.has_review" class="muted">复盘已生成（无摘要字段）</span>
                    <span v-else class="muted">暂无复盘</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-else class="muted">尚无已记录的回测轮次。</p>
            <div v-if="loopSummary.is_terminal && loopSummary.final_summary" class="loop-final-box">
              <strong>末轮指标</strong>
              <span>中位收益 {{ pct(loopSummary.final_summary.median_total_return) }}</span>
              <span>完成率 {{ pct(loopSummary.final_summary.completion_rate) }}</span>
            </div>
          </section>
          <ul class="loop-timeline">
            <li v-for="entry in selectedLoop.iterations || []" :key="`${entry.iteration}-${entry.batch_id}`">
              第 {{ entry.iteration }} 轮 · {{ entry.batch_id }}
              <span v-if="entry.decision"> · {{ entry.decision }}</span>
              <span v-if="entry.decision_reason">（{{ entry.decision_reason }}）</span>
              <span v-if="entry.child_batch_id"> → {{ entry.child_batch_id }}</span>
            </li>
          </ul>
        </div>
      </div>
      <p v-else class="muted">暂无自动迭代任务</p>
    </section>

    <section class="layout">
      <aside class="card batch-list">
        <div class="section-title-row compact">
          <div>
            <p class="section-kicker">批量回测 · 单次实验维度</p>
            <h3>实验列表</h3>
          </div>
          <span class="type-badge batch-badge">Batch 实验</span>
        </div>
        <p class="subtitle">每条是一次具体批量回测；Loop 的每一轮也会落成一条实验记录。</p>
        <div class="list-action-block">
          <button class="primary" :disabled="submitting" @click="submitBatch">
            用上方配置创建实验
          </button>
          <span v-if="createMessage" class="message">{{ createMessage }}</span>
        </div>
        <button
          v-for="batch in batches"
          :key="batch.batch_id"
          class="batch-row experiment-row"
          :class="{
            active: selectedBatchId === batch.batch_id,
            'loop-iteration-batch': Boolean(batch.loop_id),
          }"
          @click="selectBatch(batch.batch_id)"
        >
          <span class="row-type">
            {{ loopIterationByBatchId[batch.batch_id] ? `第 ${loopIterationByBatchId[batch.batch_id].iteration} 轮` : (batch.loop_id ? 'Loop' : '实验') }}
          </span>
          <strong>{{ loopIterationByBatchId[batch.batch_id]?.batch_name || batch.name }}</strong>
          <span>{{ batch.universe_type }} {{ batch.universe_value || '' }}</span>
          <small v-if="batch.loop_id">
            Loop：{{ loopNameById[batch.loop_id] || batch.loop_id }} · {{ batch.status }}
          </small>
          <small v-else>单次回测：{{ batch.strategy_key }} · {{ batch.status }}</small>
        </button>
      </aside>

      <main class="card details" v-if="selectedBatch">
        <div class="detail-header">
          <div>
            <h3>{{ selectedBatch.name }}</h3>
            <p>{{ selectedBatch.strategy_key }} / {{ selectedBatch.preset || 'default' }} · {{ selectedBatch.start_date }} - {{ selectedBatch.end_date }}</p>
          </div>
          <div class="detail-actions">
            <button :disabled="batchActionSubmitting" @click="() => loadSelected()">刷新详情</button>
            <button
              v-if="canRetryFailedBatch"
              :disabled="batchActionSubmitting"
              @click="() => retryFailed()"
            >
              重试失败
            </button>
            <button
              v-if="canQueueBatchReview"
              :disabled="batchActionSubmitting"
              :title="canQueueBatchReview ? '' : '请等待本批回测结束后再复盘'"
              @click="() => queueReview()"
            >
              AI 复盘
            </button>
            <button
              v-if="canCreateNextExperiment"
              :disabled="batchActionSubmitting"
              @click="() => createNextExperiment()"
            >
              下一轮实验
            </button>
            <button class="danger" :disabled="batchActionSubmitting" @click="() => requestDeleteSelectedBatch()">
              删除实验
            </button>
            <button
              v-if="canCancelBatch"
              class="danger"
              title="终止尚未完成的子任务（排队中/执行中），不会撤销已完成的回测结果"
              @click="cancelSelected"
            >
              终止未完成任务
            </button>
          </div>
        </div>

        <div class="metrics">
          <div><span>状态</span><strong>{{ selectedBatch.status }}</strong></div>
          <div><span>总数</span><strong>{{ summary.total || selectedBatch.symbols_count || 0 }}</strong></div>
          <div><span>完成</span><strong>{{ summary.completed || 0 }}</strong></div>
          <div><span>失败</span><strong>{{ summary.failed || 0 }}</strong></div>
          <div><span>平均收益</span><strong>{{ pct(summary.avg_total_return) }}</strong></div>
          <div><span>中位收益</span><strong>{{ pct(summary.median_total_return) }}</strong></div>
        </div>
        <p v-if="batchMessage" class="message detail-message">{{ batchMessage }}</p>

        <div v-if="pendingDeleteBatch" class="inline-confirm danger-confirm">
          <strong>确认删除实验「{{ pendingDeleteBatch.name }}」？</strong>
          <p>将永久删除该批次的所有子任务与回测结果，且不可恢复。</p>
          <div class="confirm-actions">
            <button class="danger" :disabled="batchActionSubmitting" @click="() => confirmDeleteSelectedBatch()">
              确认删除
            </button>
            <button :disabled="batchActionSubmitting" @click="pendingDeleteBatch = null">取消</button>
          </div>
        </div>

        <section class="batch-config-panel">
          <h4>本实验 · 下一轮配置</h4>
          <p class="muted">选中实验的配置仅在此展示；应用 AI 建议不会改动上方「创建批量实验」公共区域。</p>
          <p v-if="batchLinkedLoop" class="muted">
            已关联自动迭代 Loop：{{ batchLinkedLoop.loop_id }}（{{ batchLinkedLoop.status }}）。
            若需自动迭代，请在该 Loop 中查看，勿重复从本实验启动。
          </p>
          <p v-else-if="hasBatchActiveTasks" class="muted">
            本批仍有子任务未完成，复盘与「下一轮实验」需在结束后使用。
          </p>
          <div class="form-grid">
            <label>
              当前实验名
              <input :value="selectedBatch.name" readonly />
            </label>
            <label>
              {{ batchLinkedLoop ? 'Loop 下一轮实验' : '下一轮实验名' }}
              <input
                v-if="batchLinkedLoop"
                :value="selectedLoopNextBatchName || '等待 Loop 复盘完成后自动生成'"
                readonly
              />
              <input v-else v-model="batchDraft.name" readonly placeholder="按策略和股票池自动生成" />
            </label>
            <label>
              策略
              <input :value="batchDraft.strategy_key" readonly />
            </label>
            <label>
              Preset
              <select v-model="batchDraft.preset">
                <option value="">默认参数</option>
                <option v-for="preset in batchPresets" :key="preset.preset" :value="preset.preset">
                  {{ preset.description || preset.preset }}
                </option>
              </select>
            </label>
            <label>
              股票池
              <input :value="batchUniverseLabel" readonly />
            </label>
            <label>
              日期区间
              <input :value="`${selectedBatch.start_date} - ${selectedBatch.end_date}`" readonly />
            </label>
          </div>
          <label v-if="batchSymbolsDisplay" class="full">
            Symbols（{{ selectedBatch.symbols_count || 0 }} 只）
            <textarea :value="batchSymbolsDisplay" rows="2" readonly></textarea>
          </label>
          <div class="params-table-wrap full">
            <button type="button" class="collapse-toggle" @click="batchParamsExpanded = !batchParamsExpanded">
              <span class="collapse-chevron" :class="{ expanded: batchParamsExpanded }">▸</span>
              <strong>策略参数</strong>
              <span class="muted">（{{ batchParamTableRows.length }} 项）</span>
            </button>
            <div v-show="batchParamsExpanded" class="collapse-body">
              <table class="params-table" v-if="batchParamTableRows.length">
                <thead>
                  <tr>
                    <th>参数</th>
                    <th>当前值</th>
                    <th>下一轮值</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in batchParamTableRows"
                    :key="row.key"
                    :class="{
                      'param-row-changed': row.changed && row.hasCurrent,
                      'param-row-new': row.isNew,
                    }"
                  >
                    <td class="param-name">
                      <span class="param-key">{{ row.key }}</span>
                      <small v-if="paramLabel(row.key) !== row.key" class="param-desc">{{ paramLabel(row.key) }}</small>
                    </td>
                    <td class="param-current">{{ formatParamDisplay(row.currentValue) }}</td>
                    <td class="param-next">
                      <input
                        :value="formatParamDisplay(row.nextValue)"
                        @change="setBatchNextParam(row.key, $event.target.value, row.currentValue)"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-else class="muted">当前实验未记录策略参数。</p>
            </div>
          </div>
          <p v-if="batchMessage" class="message">{{ batchMessage }}</p>
        </section>

        <div class="table-toolbar">
          <select v-model="resultStatus" @change="loadResults">
            <option value="">全部状态</option>
            <option value="completed">完成</option>
            <option value="failed">失败</option>
            <option value="pending">待执行</option>
          </select>
          <select v-model="sortBy" @change="loadResults">
            <option value="total_return">账户收益</option>
            <option value="invested_return">投入资金收益</option>
            <option value="capital_utilization">资金使用率</option>
            <option value="max_drawdown">最大回撤</option>
            <option value="sharpe_ratio">夏普</option>
            <option value="win_rate">胜率</option>
            <option value="total_trades">交易次数</option>
          </select>
        </div>

        <section class="trade-panel" v-if="selectedTradeResult || tradeResultLoading || tradeResultMessage">
          <div class="section-title-row compact">
            <div>
              <h4>交易列表</h4>
              <p class="muted" v-if="selectedTradeResult">
                {{ selectedTradeResult.symbol }} · {{ selectedTradeResult.strategy_key }} ·
                {{ selectedTradeResult.trades?.length || 0 }} 笔交易
              </p>
              <p class="muted" v-if="selectedTradeResult?.metrics">
                账户收益 {{ pct(selectedTradeResult.metrics.total_return) }} ·
                投入资金收益 {{ pct(selectedTradeResult.metrics.invested_return) }} ·
                实际投入 {{ money(selectedTradeResult.metrics.invested_cash) }} ·
                资金使用率 {{ pct(selectedTradeResult.metrics.capital_utilization) }}
              </p>
            </div>
            <button
              v-if="selectedTradeResult"
              type="button"
              class="mini-btn"
              @click="selectedTradeResult = null"
            >
              收起
            </button>
          </div>
          <p v-if="tradeResultLoading" class="muted">正在加载交易列表…</p>
          <p v-else-if="tradeResultMessage" class="message">{{ tradeResultMessage }}</p>
          <div v-else-if="selectedTradeResult" class="table-wrap trade-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>方向</th>
                  <th>价格</th>
                  <th>数量</th>
                  <th>PnL</th>
                  <th>手续费</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(trade, idx) in selectedTradeResult.trades || []" :key="`${trade.datetime}-${idx}`">
                  <td>{{ trade.datetime || '-' }}</td>
                  <td>{{ trade.action || '-' }}</td>
                  <td>{{ num(trade.price) }}</td>
                  <td>{{ trade.quantity ?? '-' }}</td>
                  <td>{{ num(trade.pnl) }}</td>
                  <td>{{ num(trade.commission) }}</td>
                </tr>
              </tbody>
            </table>
            <p v-if="!(selectedTradeResult.trades || []).length" class="muted">该回测没有交易记录。</p>
          </div>
        </section>

        <section class="review-panel" v-if="latestReview">
          <h4>AI 复盘</h4>
          <p>{{ latestReview.review?.summary || '复盘已完成' }}</p>
          <div class="review-grid">
            <div>
              <strong>主要发现</strong>
              <ul>
                <li v-for="item in latestReview.review?.main_findings || []" :key="item">{{ item }}</li>
              </ul>
            </div>
            <div>
              <strong>下一轮实验</strong>
              <ul>
                <li v-for="item in latestReview.review?.next_experiments || []" :key="item.name || item.hypothesis || item">
                  <span>{{ item.name || item.hypothesis || item }}</span>
                  <button class="mini-btn" @click="() => applyReviewSuggestion(item)">应用到本实验</button>
                  <button
                    class="mini-btn primary-mini"
                    :disabled="!canCreateNextExperiment"
                    @click="() => applyReviewSuggestion(item, true)"
                  >
                    应用并测试
                  </button>
                </li>
              </ul>
            </div>
          </div>
          <div class="suggestion-list" v-if="latestReview.review?.parameter_suggestions?.length">
            <strong>参数建议</strong>
            <div
              v-for="item in latestReview.review.parameter_suggestions"
              :key="item.name || item.rationale || JSON.stringify(item)"
              class="suggestion-row"
            >
              <span>{{ item.name || '参数组合' }}：{{ item.rationale || item.suggested_values || item }}</span>
              <button class="mini-btn" @click="() => applyReviewSuggestion(item)">应用到本实验</button>
              <button
                class="mini-btn primary-mini"
                :disabled="!canCreateNextExperiment"
                @click="() => applyReviewSuggestion(item, true)"
              >
                应用并测试
              </button>
            </div>
          </div>
        </section>

        <p v-if="!canDeleteResultRows && results.length === 1" class="muted result-action-hint">
          当前实验只有一条回测结果；如需删除，请使用上方「删除实验」，避免留下空实验记录。
        </p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>名称</th>
                <th>状态</th>
                <th>账户收益</th>
                <th>投入资金收益</th>
                <th>资金使用率</th>
                <th>最大回撤</th>
                <th>夏普</th>
                <th>胜率</th>
                <th>交易</th>
                <th>错误</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in results" :key="row.task_id">
                <td>{{ row.symbol }}</td>
                <td>{{ row.stock_name || '-' }}</td>
                <td>{{ row.status }}</td>
                <td>{{ pct(row.total_return) }}</td>
                <td>{{ pct(row.invested_return) }}</td>
                <td>{{ pct(row.capital_utilization) }}</td>
                <td>{{ pct(row.max_drawdown) }}</td>
                <td>{{ num(row.sharpe_ratio) }}</td>
                <td>{{ pct(row.win_rate) }}</td>
                <td>{{ row.total_trades ?? '-' }}</td>
                <td class="error">{{ row.error_message || '-' }}</td>
                <td>
                  <button
                    class="mini-btn"
                    :disabled="row.status !== 'completed' || tradeResultLoading"
                    title="查看该标的的买卖明细"
                    @click="() => loadTradeResult(row)"
                  >
                    查看交易
                  </button>
                  <button
                    v-if="canDeleteResultRows"
                    class="mini-btn danger-mini"
                    :disabled="row.status === 'running' || row.status === 'claimed'"
                    title="仅删除该标的的子任务和回测结果，不删除整个实验"
                    @click="() => deleteResultRow(row)"
                  >
                    删除该结果
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>

      <main class="card empty" v-else>
        请选择一个实验，或先创建新的批量实验。
      </main>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import {
  cancelBatch,
  deleteBatch,
  deleteBacktestTask,
  createBatch,
  getBatch,
  getBacktestResult,
  getBatchResults,
  listBatchReviews,
  listBatches,
  listEtfs,
  listStrategies,
  listStrategyTemplates,
  requestBatchReview,
  retryFailedBatch,
  rerunBatch,
  listLoops,
  getLoopHealth,
  createLoop,
  getLoop,
  getLoopSummary,
  queueLoopFinalReport,
  pauseLoop,
  resumeLoop,
  cancelLoop,
  deleteLoop,
  advanceLoop,
} from '../api/strategyLab'
import {
  applySuggestionToParams,
  buildParamTableRows,
  coerceParamsDict,
  coerceParamValue,
  formatParamDisplay,
  isExperimentReviewItem,
  normalizeStrategies,
  normalizeTemplateGroups,
  filterValidParamDict,
  isPlainParamsObject,
  resolveParamLabel,
} from '../utils/strategyLabParams'

const batches = ref([])
const selectedBatch = ref(null)
const selectedBatchId = ref('')
const results = ref([])
const selectedTradeResult = ref(null)
const tradeResultLoading = ref(false)
const tradeResultMessage = ref('')
const reviews = ref([])
const strategies = ref([])
const strategyTemplates = ref({})
const strategyLoadError = ref('')
const loading = ref(false)
const submitting = ref(false)
const suppressPresetApply = ref(false)
const createMessage = ref('')
const batchMessage = ref('')
const loopMessage = ref('')
const loopHealth = ref(null)
const symbolsText = ref('')
const etfOptions = ref([])
const etfSearch = ref('')
const etfOptionsLoading = ref(false)
const etfOptionsMessage = ref('')
const createFormParams = reactive({})
const createParamsExpanded = ref(true)
const batchParamsExpanded = ref(true)
const batchDraft = reactive({
  name: '',
  strategy_key: '',
  preset: '',
  nextParams: {},
})
const resultStatus = ref('')
const sortBy = ref('total_return')
const loops = ref([])
const selectedLoop = ref(null)
const selectedLoopId = ref('')
const loopSummary = ref(null)
const loopSummaryLoading = ref(false)
const loopSubmitting = ref(false)
let loopSummaryPollTimer = null
let loopHealthPollTimer = null
let loopRequestSeq = 0

const loopHealthStatusText = computed(() => {
  if (!loopHealth.value) return '正在检测自动推进服务...'
  return loopHealth.value.message || (
    loopHealth.value.auto_advance_available
      ? '自动推进服务正常'
      : '自动推进不可用'
  )
})

const canManageActiveLoop = computed(() => {
  const status = selectedLoop.value?.status
  return status === 'running' || status === 'paused'
})

const canAdvanceLoop = computed(() => selectedLoop.value?.status === 'running')

const LOOP_TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled'])

const canDeleteSelectedLoop = computed(() =>
  LOOP_TERMINAL_STATUSES.has((selectedLoop.value?.status || '').toLowerCase())
)

const BATCH_TERMINAL_STATUSES = new Set(['completed', 'partial_failed', 'failed', 'cancelled'])

const isBatchTerminal = computed(() =>
  BATCH_TERMINAL_STATUSES.has((selectedBatch.value?.status || '').toLowerCase())
)

const hasBatchActiveTasks = computed(() => {
  const counts = summary.value?.status_counts || {}
  return (
    (counts.pending || 0) + (counts.claimed || 0) + (counts.running || 0) > 0
  )
})

const canRetryFailedBatch = computed(() => (summary.value?.failed || 0) > 0)

const canQueueBatchReview = computed(
  () => isBatchTerminal.value && !hasBatchActiveTasks.value
)

const canCreateNextExperiment = computed(
  () => isBatchTerminal.value && !hasBatchActiveTasks.value && !batchLinkedLoop.value
)

const canDeleteResultRows = computed(() => results.value.length > 1)

const loopIterationByBatchId = computed(() => {
  const out = {}
  for (const row of loopSummary.value?.iterations || []) {
    if (row?.batch_id) out[row.batch_id] = row
  }
  return out
})

const loopNameById = computed(() => {
  const out = {}
  for (const loop of loops.value || []) {
    if (loop?.loop_id) out[loop.loop_id] = loop.name || loop.loop_id
  }
  return out
})

const selectedLoopIteration = computed(() => {
  if (!selectedBatchId.value) return null
  return loopIterationByBatchId.value[selectedBatchId.value] || null
})

const selectedLoopNextBatchName = computed(() => {
  const childBatchId = selectedLoopIteration.value?.child_batch_id
  if (!childBatchId) return ''
  const childBatch = batches.value.find((item) => item.batch_id === childBatchId)
  return childBatch?.name || selectedLoopIteration.value?.child_batch_name || childBatchId
})

const batchLinkedLoop = computed(() => {
  const loopId = selectedBatch.value?.loop_id
  if (!loopId) return null
  return loops.value.find((item) => item.loop_id === loopId) || { loop_id: loopId, status: 'unknown' }
})

const canStartLoopFromBatch = computed(() => {
  if (!selectedBatchId.value || !selectedBatch.value) return false
  if (!isBatchTerminal.value) return false
  const linked = batchLinkedLoop.value
  if (linked) {
    return false
  }
  return true
})

const startLoopFromBatchHint = computed(() => {
  if (!selectedBatchId.value) return '请先在左侧选中一个实验'
  if (!isBatchTerminal.value) return '请等待本批回测结束后再启动 Loop'
  const linked = batchLinkedLoop.value
  if (linked) {
    return `该实验已绑定 Loop（${linked.loop_id}）`
  }
  return ''
})

const batchActionSubmitting = ref(false)
const pendingDeleteBatch = ref(null)
const pendingDeleteLoop = ref(null)

const loopForm = reactive({
  max_iterations: 3,
  objective: '提高收益并控制回撤',
  min_completion_rate: 0.5,
})

function defaultDateRange() {
  const end = new Date()
  const start = new Date()
  start.setFullYear(start.getFullYear() - 1)
  const fmt = (date) => date.toISOString().slice(0, 10).replace(/-/g, '')
  return { start: fmt(start), end: fmt(end) }
}

const defaultDates = defaultDateRange()

const form = reactive({
  name: '',
  target_mode: 'index',
  asset_type: 'stock',
  universe_type: 'index',
  universe_value: 'csi1000',
  etf_symbol: '',
  strategy_key: 'turtle',
  preset: 'turtle_conservative',
  start_date: defaultDates.start,
  end_date: defaultDates.end,
  initial_cash: 1000000,
  etf_position_pct: 0.95,
  limit_symbols: 2,
})

const summary = computed(() => selectedBatch.value?.summary || {})

const canCancelBatch = computed(() => {
  const batch = selectedBatch.value
  if (!batch) return false
  const status = (batch.status || '').toLowerCase()
  if (status === 'pending' || status === 'running') return true
  const counts = summary.value?.status_counts || {}
  const active =
    (counts.pending || 0) + (counts.claimed || 0) + (counts.running || 0)
  return active > 0
})
const latestReview = computed(() => reviews.value[0] || null)
const usableStrategies = computed(() => strategies.value.filter((item) => item.allow_backtest !== false))
const selectedPresets = computed(() => strategyTemplates.value[form.strategy_key] || [])
const batchPresets = computed(() => strategyTemplates.value[batchDraft.strategy_key] || [])
const createPresets = computed(() => strategyTemplates.value[form.strategy_key] || [])

const createParamsWithDesc = computed(() => {
  const preset = createPresets.value.find((item) => item.preset === form.preset)
  return preset?.params_with_desc || {}
})

const createPresetBaseline = computed(() => {
  const preset = createPresets.value.find((item) => item.preset === form.preset)
  return filterValidParamDict(
    preset ? extractPresetParams(preset.params_with_desc) : {}
  )
})

const createParamTableRows = computed(() =>
  buildParamTableRows(createPresetBaseline.value, createFormParams)
)

const batchUniverseLabel = computed(() => {
  const batch = selectedBatch.value
  if (!batch) return ''
  if (batch.asset_type === 'etf') {
    const symbol = batch.symbols_preview?.[0] || batch.universe_value || ''
    return `单个 ETF ${symbol}`.trim()
  }
  if (batch.universe_type === 'manual') return '手工 symbols'
  if (batch.universe_type === 'index') return `指数成分 ${batch.universe_value || ''}`
  if (batch.universe_type === 'strategy_pool') return `策略股池 ${batch.universe_value || ''}`
  if (batch.universe_type === 'watchlist') return `观察列表 ${batch.universe_value || ''}`
  return `${batch.universe_type || ''} ${batch.universe_value || ''}`.trim()
})

const batchSymbolsDisplay = computed(() => {
  const batch = selectedBatch.value
  if (!batch || batch.universe_type !== 'manual') return ''
  const preview = batch.symbols_preview || []
  if (!preview.length) return ''
  const joined = preview.join(', ')
  const total = batch.symbols_count || preview.length
  if (total > preview.length) {
    return `${joined} … 等共 ${total} 只`
  }
  return joined
})

const batchParamsWithDesc = computed(() => {
  const preset = batchPresets.value.find((item) => item.preset === batchDraft.preset)
  return preset?.params_with_desc || {}
})

const batchParamTableRows = computed(() =>
  buildParamTableRows(selectedBatch.value?.strategy_params || {}, batchDraft.nextParams || {})
)

function paramLabel(key) {
  return resolveParamLabel(key, batchParamsWithDesc.value)
}

function createParamLabel(key) {
  return resolveParamLabel(key, createParamsWithDesc.value)
}

function setBatchNextParam(key, raw, hint) {
  batchDraft.nextParams[key] = coerceParamValue(raw, hint)
}

function setCreateFormParam(key, raw, hint) {
  createFormParams[key] = coerceParamValue(raw, hint)
}

function replaceCreateFormParams(params) {
  for (const key of Object.keys(createFormParams)) {
    delete createFormParams[key]
  }
  Object.assign(createFormParams, filterValidParamDict(params || {}))
}

function getCreateParamsForSubmit() {
  return coerceParamsDict(createFormParams, createPresetBaseline.value)
}

function normalizedEtfPositionPct() {
  const value = Number(form.etf_position_pct)
  if (!Number.isFinite(value)) return 0.95
  return Math.min(1, Math.max(0.01, value))
}

function getCreateStrategyParamsForSubmit(targetConfig = buildTargetConfig()) {
  const params = getCreateParamsForSubmit()
  if (targetConfig.asset_type === 'etf' && form.target_mode === 'single_etf') {
    params.target_position_pct = normalizedEtfPositionPct()
  }
  return params
}

function getBatchNextParamsForSubmit(override) {
  if (isPlainParamsObject(override)) {
    return coerceParamsDict(override, selectedBatch.value?.strategy_params || {})
  }
  return coerceParamsDict(batchDraft.nextParams, selectedBatch.value?.strategy_params || {})
}

const fallbackStrategies = [
  { key: 'turtle', name: '海龟交易法', allow_backtest: true, can_use: true },
  { key: 'grid', name: '网格策略', allow_backtest: true, can_use: true },
  { key: 'hidden_dragon', name: '潜龙低吸', allow_backtest: true, can_use: true },
  { key: 'single_yang', name: '单阳不破', allow_backtest: true, can_use: true },
  { key: 'boll', name: '布林带策略', allow_backtest: true, can_use: true },
  { key: 'mean_reversion', name: '均值回归', allow_backtest: true, can_use: true },
  { key: 'momentum_reversal', name: '动量反转', allow_backtest: true, can_use: true },
  { key: 'atr_breakout', name: 'ATR突破', allow_backtest: true, can_use: true },
  { key: 'volume_mfi_breakout', name: '量价突破', allow_backtest: true, can_use: true },
  { key: 'sma_cross', name: '双均线交叉', allow_backtest: true, can_use: true },
  { key: 'triple_sma', name: '三均线交叉', allow_backtest: true, can_use: true },
]

const fallbackTemplates = {
  turtle: [
    { preset: 'turtle_conservative', description: '保守参数', params_with_desc: {} },
    { preset: 'turtle_standard', description: '标准参数', params_with_desc: {} },
    { preset: 'turtle_aggressive', description: '激进参数', params_with_desc: {} },
  ],
  hidden_dragon: [
    { preset: 'dragon_conservative', description: '保守参数', params_with_desc: {} },
    { preset: 'dragon_default', description: '默认参数', params_with_desc: {} },
    { preset: 'dragon_aggressive', description: '激进参数', params_with_desc: {} },
  ],
  single_yang: [
    { preset: 'yang_conservative', description: '保守参数', params_with_desc: {} },
    { preset: 'yang_default', description: '默认参数', params_with_desc: {} },
    { preset: 'yang_aggressive', description: '激进参数', params_with_desc: {} },
  ],
}

function extractPresetParams(paramsWithDesc) {
  const out = {}
  if (!paramsWithDesc || typeof paramsWithDesc !== 'object') return out
  for (const [key, cfg] of Object.entries(paramsWithDesc)) {
    if (cfg && typeof cfg === 'object' && 'value' in cfg) out[key] = cfg.value
  }
  return out
}

function applyPresetParams() {
  replaceCreateFormParams(createPresetBaseline.value)
}

function parseSymbols(text) {
  return text.split(/[\s,，]+/).map((item) => item.trim()).filter(Boolean)
}

function normalizeSymbolInput(value) {
  return String(value || '').trim().toUpperCase()
}

function buildTargetConfig() {
  const targetMode = form.target_mode || 'index'
  if (targetMode === 'single_etf') {
    const symbol = normalizeSymbolInput(form.etf_symbol)
    return {
      asset_type: 'etf',
      universe_type: 'manual',
      universe_value: symbol,
      symbols: symbol ? [symbol] : [],
      limit_symbols: 0,
    }
  }
  if (targetMode === 'manual') {
    return {
      asset_type: form.asset_type || 'stock',
      universe_type: 'manual',
      universe_value: null,
      symbols: parseSymbols(symbolsText.value),
    }
  }
  if (targetMode === 'strategy_pool') {
    return {
      asset_type: 'stock',
      universe_type: 'strategy_pool',
      universe_value: form.universe_value,
      symbols: [],
    }
  }
  return {
    asset_type: 'stock',
    universe_type: 'index',
    universe_value: form.universe_value,
    symbols: [],
  }
}

async function loadEtfOptions({ q = '', force = false } = {}) {
  if (etfOptionsLoading.value) return
  if (!force && etfOptions.value.length && !q) return
  etfOptionsLoading.value = true
  etfOptionsMessage.value = ''
  try {
    const params = q
      ? { q, limit: 80 }
      : { featured: true, sort: 'total_share', limit: 80 }
    const payload = await listEtfs(params)
    etfOptions.value = payload?.data || []
    if (!etfOptions.value.length) {
      etfOptionsMessage.value = q ? '未找到匹配 ETF' : '暂无 ETF 列表'
    } else if (!form.etf_symbol && !q) {
      const csi1000 = etfOptions.value.find((item) => item.ts_code === '512100.SH')
      form.etf_symbol = csi1000?.ts_code || etfOptions.value[0].ts_code
    }
  } catch (error) {
    etfOptionsMessage.value = formatApiError(error, 'ETF 列表加载失败')
  } finally {
    etfOptionsLoading.value = false
  }
}

async function searchEtfOptions() {
  const q = etfSearch.value.trim()
  await loadEtfOptions({ q, force: true })
  if (q && etfOptions.value.length === 1) {
    form.etf_symbol = etfOptions.value[0].ts_code
  }
}

function sanitizeExperimentNamePart(value) {
  return String(value || '')
    .trim()
    .replace(/^rerun:/, '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function machineExperimentLabel(value) {
  const label = sanitizeExperimentNamePart(value)
  if (!/^[A-Za-z][A-Za-z0-9_.-]*$/.test(label)) return ''
  if (['next_experiment', 'experiment', 'batch', 'rerun'].includes(label.toLowerCase())) return ''
  return label
}

function isBatchRef(value) {
  const part = String(value || '').trim()
  return part.startsWith('rerun:') || part.startsWith('bb_')
}

function resolveBatchSourceUniverse(batch) {
  let universeType = batch?.source_universe_type ?? batch?.original_universe_type ?? batch?.universe_type
  let universeValue = batch?.source_universe_value ?? batch?.original_universe_value ?? batch?.universe_value
  if (universeValue && !isBatchRef(universeValue)) {
    return { universeType, universeValue }
  }

  let parentId = batch?.parent_batch_id
  if (!parentId && String(batch?.universe_value || '').startsWith('rerun:')) {
    parentId = String(batch.universe_value).replace(/^rerun:/, '')
  }
  const seen = new Set()
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId)
    const parent = batches.value.find((item) => item.batch_id === parentId)
    if (!parent) break
    universeType = parent.source_universe_type ?? parent.original_universe_type ?? parent.universe_type
    universeValue = parent.source_universe_value ?? parent.original_universe_value ?? parent.universe_value
    if (universeValue && !isBatchRef(universeValue)) {
      return { universeType, universeValue }
    }
    parentId = parent.parent_batch_id
    if (!parentId && String(parent.universe_value || '').startsWith('rerun:')) {
      parentId = String(parent.universe_value).replace(/^rerun:/, '')
    }
  }
  return { universeType, universeValue }
}

function buildStructuredBatchName(batch, overrides = {}) {
  const strategyKey = sanitizeExperimentNamePart(overrides.strategy_key ?? batch?.strategy_key)
  const preset = sanitizeExperimentNamePart(overrides.preset ?? batch?.preset)
  const label = machineExperimentLabel(overrides.label)
  const sourceUniverse = resolveBatchSourceUniverse(batch)
  const universeValue = sanitizeExperimentNamePart(sourceUniverse.universeValue)
  const universeType = sanitizeExperimentNamePart(sourceUniverse.universeType)
  const base = label || preset || strategyKey || sanitizeExperimentNamePart(batch?.name) || 'strategy_lab'
  const suffix = universeValue || (batch?.asset_type === 'etf' ? 'etf' : universeType)
  if (!suffix || base.endsWith(`_${suffix}`)) return base
  return `${base}_${suffix}`
}

function initBatchDraft(batch) {
  if (!batch) return
  batchDraft.name = buildStructuredBatchName(batch)
  batchDraft.strategy_key = batch.strategy_key || ''
  batchDraft.preset = batch.preset || ''
  batchDraft.nextParams = filterValidParamDict(batch.strategy_params || {})
  batchParamsExpanded.value = true
  batchMessage.value = ''
}

async function applyReviewSuggestion(item, createImmediately = false) {
  if (!selectedBatch.value) return
  const beforeParams = { ...batchDraft.nextParams }
  const { patch, mergedParams, hasPatch } = applySuggestionToParams(beforeParams, item)
  if (!hasPatch) {
    batchMessage.value = '该建议没有可应用的有效参数（请检查参数名是否为单个字段）'
    return
  }

  if (item && typeof item === 'object') {
    if (item.strategy_key) batchDraft.strategy_key = item.strategy_key
    if (item.preset !== undefined) batchDraft.preset = item.preset || ''
    if (isExperimentReviewItem(item)) {
      batchDraft.name = buildStructuredBatchName(selectedBatch.value, {
        strategy_key: batchDraft.strategy_key,
        preset: batchDraft.preset,
        label: item.name,
      })
    }
  }

  batchDraft.nextParams = { ...mergedParams }
  const addedKeys = Object.keys(patch).join(', ')
  batchMessage.value = `已合并到本实验：${addedKeys}`
  if (createImmediately) {
    await createNextExperiment(getBatchNextParamsForSubmit(mergedParams), batchDraft.name)
  }
}

function pct(value) {
  return typeof value === 'number' ? `${(value * 100).toFixed(2)}%` : '-'
}

function num(value) {
  return typeof value === 'number' ? value.toFixed(2) : '-'
}

function money(value) {
  return typeof value === 'number'
    ? value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
    : '-'
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-CN', { hour12: false })
}

async function loadBatches() {
  loading.value = true
  try {
    batches.value = await listBatches({ limit: 50 })
    if (!selectedBatchId.value && batches.value.length) {
      await selectBatch(batches.value[0].batch_id)
    }
  } catch (error) {
    createMessage.value = error?.response?.data?.detail || error.message || '历史实验列表加载失败'
  } finally {
    loading.value = false
  }
}

async function refreshAll() {
  await Promise.allSettled([loadBatches(), loadLoops()])
}

async function loadStrategyMeta() {
  strategyLoadError.value = ''
  try {
    const strategyPayload = await listStrategies()
    strategies.value = normalizeStrategies(strategyPayload.strategies, fallbackStrategies)
  } catch (error) {
    strategyLoadError.value = error?.message || '策略列表加载失败'
    strategies.value = normalizeStrategies([], fallbackStrategies)
  }

  try {
    const templatesPayload = await listStrategyTemplates()
    strategyTemplates.value = normalizeTemplateGroups(templatesPayload.templates, fallbackTemplates)
  } catch (error) {
    strategyLoadError.value = strategyLoadError.value || error?.message || '策略模板加载失败'
    strategyTemplates.value = normalizeTemplateGroups({}, fallbackTemplates)
  }

  if (!usableStrategies.value.some((item) => item.key === form.strategy_key) && usableStrategies.value.length) {
    form.strategy_key = usableStrategies.value[0].key
  }
  if (!form.preset && selectedPresets.value.length) {
    const defaultPreset = selectedPresets.value.find((item) => item.is_default) || selectedPresets.value[0]
    form.preset = defaultPreset.preset || ''
  }
  applyPresetParams()
}

async function selectBatch(batchId) {
  selectedBatchId.value = batchId
  try {
    await loadSelected()
    const linkedLoopId = selectedBatch.value?.loop_id
    if (linkedLoopId && linkedLoopId !== selectedLoopId.value) {
      await selectLoop(linkedLoopId)
    }
  } catch (error) {
    batchMessage.value = error?.response?.data?.detail || error.message || '实验详情加载失败'
  }
}

async function loadSelected() {
  if (!selectedBatchId.value) return
  selectedBatch.value = await getBatch(selectedBatchId.value)
  initBatchDraft(selectedBatch.value)
  await Promise.allSettled([loadResults(), loadReviews()])
}

async function loadResults() {
  if (!selectedBatchId.value) return
  try {
    const payload = await getBatchResults(selectedBatchId.value, {
      status: resultStatus.value || undefined,
      sort_by: sortBy.value,
      order: 'desc',
      limit: 300,
    })
    results.value = payload.rows || []
    syncAutoTradeResult()
  } catch (error) {
    results.value = []
    selectedTradeResult.value = null
    batchMessage.value = error?.response?.data?.detail || error.message || '批量结果加载失败'
  }
}

async function loadTradeResult(row, { silent = false } = {}) {
  if (!row?.task_id) return
  tradeResultLoading.value = true
  if (!silent) tradeResultMessage.value = ''
  try {
    selectedTradeResult.value = await getBacktestResult(row.task_id)
    tradeResultMessage.value = ''
  } catch (error) {
    selectedTradeResult.value = null
    tradeResultMessage.value = formatApiError(error, '交易列表加载失败')
  } finally {
    tradeResultLoading.value = false
  }
}

function syncAutoTradeResult() {
  const completedRows = results.value.filter((row) => row.status === 'completed')
  const shouldAutoLoad =
    selectedBatch.value?.asset_type === 'etf'
    && results.value.length === 1
    && completedRows.length === 1
  if (shouldAutoLoad) {
    loadTradeResult(completedRows[0], { silent: true })
    return
  }
  selectedTradeResult.value = null
  tradeResultMessage.value = ''
}

async function loadReviews() {
  if (!selectedBatchId.value) return
  try {
    reviews.value = await listBatchReviews(selectedBatchId.value, { limit: 5 })
  } catch (error) {
    reviews.value = []
    batchMessage.value = error?.response?.data?.detail || error.message || 'AI 复盘加载失败'
  }
}

function buildCreateBatchPayload() {
  const initialCash = Number(form.initial_cash)
  const limitSymbols = Number(form.limit_symbols)
  const targetConfig = buildTargetConfig()
  return {
    name: form.name,
    ...targetConfig,
    strategy_key: form.strategy_key,
    preset: form.preset || null,
    strategy_params: getCreateStrategyParamsForSubmit(targetConfig),
    start_date: form.start_date,
    end_date: form.end_date,
    initial_cash: Number.isFinite(initialCash) ? initialCash : 1000000,
    limit_symbols: targetConfig.limit_symbols !== undefined
      ? targetConfig.limit_symbols
      : (Number.isFinite(limitSymbols) ? Math.max(0, Math.floor(limitSymbols)) : 0),
  }
}

async function submitBatch() {
  const validationErrors = validateLoopBatchConfig(buildCreateBatchPayload())
  if (validationErrors.length) {
    createMessage.value = validationErrors.join('；')
    return
  }
  submitting.value = true
  createMessage.value = ''
  try {
    const created = await createBatch(buildCreateBatchPayload())
    createMessage.value = `已创建 ${created.created_tasks} 个子任务`
    await loadBatches()
    await selectBatch(created.batch_id)
  } catch (error) {
    createMessage.value = error?.response?.data?.detail || error.message || '创建失败'
  } finally {
    submitting.value = false
  }
}

function requestDeleteSelectedBatch() {
  if (batchActionSubmitting.value) return
  if (!selectedBatchId.value || !selectedBatch.value) {
    batchMessage.value = '请先选中一个实验再删除'
    return
  }
  const linked = batchLinkedLoop.value
  if (linked && ['running', 'paused'].includes(String(linked.status || '').toLowerCase())) {
    pendingDeleteBatch.value = null
    batchMessage.value = `该实验正在被自动迭代 Loop 使用（${linked.loop_id}，${linked.status}），请先取消/完成该 Loop 或删除历史 Loop 后再删除实验`
    return
  }
  pendingDeleteBatch.value = {
    batch_id: selectedBatchId.value,
    name: selectedBatch.value.name || selectedBatchId.value,
  }
  batchMessage.value = '请确认删除操作'
}

async function confirmDeleteSelectedBatch() {
  if (!pendingDeleteBatch.value || batchActionSubmitting.value) return
  const deletingBatchId = pendingDeleteBatch.value.batch_id
  batchActionSubmitting.value = true
  batchMessage.value = ''
  createMessage.value = ''
  try {
    const result = await deleteBatch(deletingBatchId)
    const n = result?.deleted_tasks ?? 0
    batchMessage.value = `已删除实验（${n} 个子任务）`
    batches.value = batches.value.filter((item) => item.batch_id !== deletingBatchId)
    selectedBatchId.value = ''
    selectedBatch.value = null
    results.value = []
    selectedTradeResult.value = null
    tradeResultMessage.value = ''
    reviews.value = []
    pendingDeleteBatch.value = null
    await Promise.allSettled([loadBatches(), loadLoops()])
  } catch (error) {
    batchMessage.value = formatApiError(error, '删除实验失败')
  } finally {
    batchActionSubmitting.value = false
  }
}

async function deleteResultRow(row) {
  if (!canDeleteResultRows.value) {
    batchMessage.value = '当前实验只有一条结果；请使用上方「删除实验」删除整个实验记录'
    return
  }
  if (!row?.task_id) return
  const label = row.stock_name || row.symbol || row.task_id
  const ok = window.confirm(`确定删除 ${label} 的子任务和回测结果吗？这不会删除整个实验。`)
  if (!ok) return
  try {
    const result = await deleteBacktestTask(row.task_id)
    batchMessage.value =
      result?.message?.includes('cancelled') || result?.message?.includes('取消')
        ? `已取消运行中的任务：${label}`
        : `已删除：${label}`
    await loadSelected()
  } catch (error) {
    batchMessage.value = error?.response?.data?.detail || error.message || '删除失败'
  }
}

async function cancelSelected() {
  if (!selectedBatchId.value || !canCancelBatch.value) return
  const ok = window.confirm(
    '将终止本实验中尚未完成的子任务（排队中/执行中）。已完成的回测结果不会被撤销。确定继续？'
  )
  if (!ok) return
  try {
    const result = await cancelBatch(selectedBatchId.value)
    const n = result?.cancelled_tasks ?? 0
    batchMessage.value =
      n > 0 ? `已终止 ${n} 个未完成任务` : (result?.message || '没有可终止的任务')
    await loadSelected()
  } catch (error) {
    batchMessage.value = error?.response?.data?.detail || error.message || '终止失败'
  }
}

async function retryFailed() {
  if (!selectedBatchId.value || !canRetryFailedBatch.value) return
  batchActionSubmitting.value = true
  batchMessage.value = ''
  try {
    await retryFailedBatch(selectedBatchId.value)
    batchMessage.value = '已重试失败子任务'
    await loadSelected()
  } catch (error) {
    batchMessage.value = formatApiError(error, '重试失败')
  } finally {
    batchActionSubmitting.value = false
  }
}

async function queueReview() {
  if (!selectedBatchId.value || !canQueueBatchReview.value) return
  batchActionSubmitting.value = true
  batchMessage.value = ''
  try {
    const result = await requestBatchReview(selectedBatchId.value, {
      objective: loopForm.objective || '提高收益并控制回撤',
      include_top_n: 20,
      include_bottom_n: 20,
      include_failures: true,
    })
    batchMessage.value = `AI 复盘已入队：${result.analysis_task_id}`
    await loadReviews()
  } catch (error) {
    batchMessage.value = formatApiError(error, 'AI 复盘入队失败')
  } finally {
    batchActionSubmitting.value = false
  }
}

function formatApiError(error, fallback = '请求失败') {
  const detail = error?.response?.data?.detail ?? error?.response?.data?.message
  if (typeof detail === 'string') return humanizeLoopError(detail)
  if (Array.isArray(detail)) {
    return detail.map((item) => item?.msg || JSON.stringify(item)).join('；')
  }
  if (detail && typeof detail === 'object') {
    return humanizeLoopError(detail.message || JSON.stringify(detail))
  }
  return error?.message || fallback
}

const LOOP_ADVANCE_ACTION_LABELS = {
  waiting_batch: '本轮回测尚未结束，请稍后再推进',
  queued_review: '已入队 AI 复盘，请等待完成后再次推进',
  waiting_review: '复盘任务进行中',
  waiting_review_doc: '等待复盘结果写入',
  rerun: '已根据复盘创建下一轮实验',
  completed: 'Loop 已结束',
  failed: 'Loop 失败',
  skipped: '当前状态不可推进',
  not_found: 'Loop 不存在',
  noop: '无可用操作',
}

const LOOP_STEP_LABELS = {
  wait_batch: '等待回测完成',
  wait_review: '等待 AI 复盘',
  completed: '已完成',
}

function loopStepLabel(step) {
  return LOOP_STEP_LABELS[step] || step || '-'
}

function formatAdvanceAction(result) {
  const action = result?.action || 'noop'
  const label = LOOP_ADVANCE_ACTION_LABELS[action] || action
  const extra = result.reason || result.batch_status || result.task_status
  return extra ? `${label}（${extra}）` : label
}

function humanizeLoopError(detail) {
  if (detail === 'No symbols resolved for batch backtest') {
    return '未能解析股票池：请检查指数/股池配置，或改用手工 symbols 并填写代码'
  }
  if (detail === 'batch_config or source_batch_id is required') {
    return '缺少实验配置：请使用上方表单或先选中一个实验再启动'
  }
  if (detail.includes('实验已关联自动迭代 Loop')) {
    return detail
  }
  if (detail.startsWith('Backtest batch not found:')) {
    return '当前实验不存在或无权访问，请刷新后重选实验'
  }
  return detail
}

function validateLoopForm() {
  const errors = []
  const maxIterations = Number(loopForm.max_iterations)
  if (!Number.isFinite(maxIterations) || maxIterations < 1 || maxIterations > 20) {
    errors.push('最大轮数需在 1–20 之间')
  }
  const minRate = Number(loopForm.min_completion_rate)
  if (!Number.isFinite(minRate) || minRate < 0 || minRate > 1) {
    errors.push('最低完成率需在 0–1 之间')
  }
  if (!String(loopForm.objective || '').trim()) {
    errors.push('请填写复盘目标')
  }
  return errors
}

function validateLoopBatchConfig(config) {
  const errors = []
  if (!config.strategy_key) errors.push('请选择策略')
  if (!String(config.start_date || '').trim() || !String(config.end_date || '').trim()) {
    errors.push('请填写开始/结束日期')
  }
  const universeType = (config.universe_type || 'manual').toLowerCase()
  if (universeType === 'manual' && !(config.symbols || []).length) {
    errors.push(config.asset_type === 'etf' ? '请填写 ETF 代码' : '自定义标的需填写 symbols（逗号/空格分隔）')
  }
  if (universeType === 'index' && !String(config.universe_value || '').trim()) {
    errors.push('指数成分股需填写指数代码（如 csi1000）')
  }
  if (universeType === 'strategy_pool' && !String(config.universe_value || '').trim()) {
    errors.push('策略选股池需填写池子名称')
  }
  return errors
}

function stopLoopSummaryPoll() {
  if (loopSummaryPollTimer) {
    clearInterval(loopSummaryPollTimer)
    loopSummaryPollTimer = null
  }
}

function stopLoopHealthPoll() {
  if (loopHealthPollTimer) {
    clearInterval(loopHealthPollTimer)
    loopHealthPollTimer = null
  }
}

async function loadLoopHealth() {
  try {
    loopHealth.value = await getLoopHealth()
  } catch (error) {
    loopHealth.value = {
      auto_advance_available: false,
      scheduler_online: false,
      tick_enabled: false,
      tick_loaded: false,
      active_loop_count: null,
      message: formatApiError(error, '自动推进服务状态不可用'),
    }
  }
}

function startLoopHealthPoll() {
  stopLoopHealthPoll()
  loopHealthPollTimer = setInterval(loadLoopHealth, 30000)
}

function syncLoopSummaryPoll() {
  stopLoopSummaryPoll()
  const shouldPoll =
    loopSummary.value?.final_report_status === 'pending'
    || selectedLoop.value?.status === 'running'
  if (!shouldPoll) return
  loopSummaryPollTimer = setInterval(() => {
    if (selectedLoopId.value) {
      refreshSelectedLoop()
    }
  }, 15000)
}

function buildLoopBatchConfig(nameSuffix = '') {
  const initialCash = Number(form.initial_cash)
  const limitSymbols = Number(form.limit_symbols)
  const targetConfig = buildTargetConfig()
  const structuredName = buildStructuredBatchName({ ...form, ...targetConfig })
  return {
    name: form.name ? `${form.name}${nameSuffix}` : structuredName,
    symbols: targetConfig.symbols,
    asset_type: targetConfig.asset_type,
    universe_type: targetConfig.universe_type,
    universe_value: targetConfig.universe_value,
    strategy_key: form.strategy_key,
    preset: form.preset || null,
    strategy_params: getCreateStrategyParamsForSubmit(targetConfig),
    start_date: form.start_date,
    end_date: form.end_date,
    initial_cash: Number.isFinite(initialCash) ? initialCash : 1000000,
    limit_symbols: targetConfig.limit_symbols !== undefined
      ? targetConfig.limit_symbols
      : (Number.isFinite(limitSymbols) ? Math.max(0, Math.floor(limitSymbols)) : 0),
  }
}

function buildLoopPayload(extra = {}) {
  const maxIterations = Number(loopForm.max_iterations)
  const minCompletion = Number(loopForm.min_completion_rate)
  return {
    max_iterations: Number.isFinite(maxIterations) ? Math.min(20, Math.max(1, Math.floor(maxIterations))) : 3,
    objective: loopForm.objective,
    stop_rules: {
      min_completion_rate: Number.isFinite(minCompletion) ? Math.min(1, Math.max(0, minCompletion)) : 0.5,
    },
    review_options: {
      objective: loopForm.objective,
      include_top_n: 20,
      include_bottom_n: 20,
      include_failures: true,
    },
    ...extra,
  }
}

async function loadLoops() {
  try {
    loops.value = await listLoops({ limit: 30 })
    await loadLoopHealth()
    if (!selectedLoopId.value && loops.value.length) {
      await selectLoop(loops.value[0].loop_id)
    }
  } catch (error) {
    loopMessage.value = formatApiError(error, 'Loop 列表加载失败')
  }
}

async function selectLoop(loopId) {
  selectedLoopId.value = loopId
  pendingDeleteLoop.value = null
  const requestId = ++loopRequestSeq
  await refreshSelectedLoop(requestId)
}

async function loadLoopSummary(requestId = loopRequestSeq) {
  if (!selectedLoopId.value) {
    loopSummary.value = null
    return
  }
  const loopId = selectedLoopId.value
  loopSummaryLoading.value = true
  try {
    const summary = await getLoopSummary(loopId)
    if (requestId !== loopRequestSeq || selectedLoopId.value !== loopId) return
    loopSummary.value = summary
    syncLoopSummaryPoll()
  } catch (error) {
    if (requestId !== loopRequestSeq || selectedLoopId.value !== loopId) return
    loopSummary.value = null
    stopLoopSummaryPoll()
    loopMessage.value = formatApiError(error, '迭代总结加载失败')
  } finally {
    if (requestId === loopRequestSeq && selectedLoopId.value === loopId) {
      loopSummaryLoading.value = false
    }
  }
}

async function requestLoopFinalReport(force = false) {
  if (!selectedLoopId.value) return
  loopSubmitting.value = true
  loopMessage.value = ''
  try {
    const result = await queueLoopFinalReport(selectedLoopId.value, force)
    loopMessage.value = result?.created === false
      ? `已有进行中的综合结论任务：${result.analysis_task_id}`
      : `综合结论已入队：${result.analysis_task_id}`
    await refreshSelectedLoop()
  } catch (error) {
    loopMessage.value = formatApiError(error, '综合结论入队失败')
  } finally {
    loopSubmitting.value = false
  }
}

async function refreshSelectedLoop(requestId = ++loopRequestSeq) {
  if (!selectedLoopId.value) return
  const loopId = selectedLoopId.value
  try {
    const loop = await getLoop(loopId)
    if (requestId !== loopRequestSeq || selectedLoopId.value !== loopId) return
    selectedLoop.value = loop
    await loadLoopSummary(requestId)
  } catch (error) {
    if (requestId !== loopRequestSeq || selectedLoopId.value !== loopId) return
    loopMessage.value = formatApiError(error, 'Loop 详情加载失败')
  }
}

async function startAutoLoop() {
  const batchConfig = buildLoopBatchConfig(' 自动迭代')
  const validationErrors = [...validateLoopForm(), ...validateLoopBatchConfig(batchConfig)]
  if (validationErrors.length) {
    loopMessage.value = validationErrors.join('；')
    return
  }
  loopSubmitting.value = true
  loopMessage.value = ''
  try {
    const created = await createLoop(buildLoopPayload({
      name: `${batchConfig.name} 自动迭代`,
      batch_config: batchConfig,
    }))
    loopMessage.value = `自动迭代已启动：${created.loop_id}`
    await loadLoops()
    await selectLoop(created.loop_id)
    if (created.current_batch_id) {
      await selectBatch(created.current_batch_id)
    }
  } catch (error) {
    loopMessage.value = formatApiError(error, '启动 Loop 失败')
  } finally {
    loopSubmitting.value = false
  }
}

async function startAutoLoopFromBatch() {
  if (!selectedBatchId.value) return
  if (!selectedBatch.value) {
    loopMessage.value = '实验详情未加载，请稍候或重新选中实验'
    return
  }
  const formErrors = validateLoopForm()
  if (formErrors.length) {
    loopMessage.value = formErrors.join('；')
    return
  }
  loopSubmitting.value = true
  loopMessage.value = ''
  try {
    const created = await createLoop(buildLoopPayload({
      name: `${selectedBatch.value?.name || selectedBatchId.value} 自动迭代`,
      source_batch_id: selectedBatchId.value,
    }))
    loopMessage.value = `已从当前实验启动 Loop：${created.loop_id}`
    await loadLoops()
    await selectLoop(created.loop_id)
    if (selectedBatchId.value) {
      await selectBatch(selectedBatchId.value)
    }
  } catch (error) {
    loopMessage.value = formatApiError(error, '启动 Loop 失败')
  } finally {
    loopSubmitting.value = false
  }
}

async function pauseSelectedLoop() {
  if (!selectedLoopId.value) return
  loopSubmitting.value = true
  loopMessage.value = ''
  try {
    await pauseLoop(selectedLoopId.value)
    loopMessage.value = 'Loop 已暂停'
    await refreshSelectedLoop()
    await loadLoops()
  } catch (error) {
    loopMessage.value = formatApiError(error, '暂停失败')
  } finally {
    loopSubmitting.value = false
  }
}

async function resumeSelectedLoop() {
  if (!selectedLoopId.value) return
  loopSubmitting.value = true
  loopMessage.value = ''
  try {
    await resumeLoop(selectedLoopId.value)
    loopMessage.value = 'Loop 已继续'
    await refreshSelectedLoop()
    await loadLoops()
  } catch (error) {
    loopMessage.value = formatApiError(error, '继续失败')
  } finally {
    loopSubmitting.value = false
  }
}

async function cancelSelectedLoop() {
  if (!selectedLoopId.value) return
  const ok = window.confirm('确定取消该自动迭代 Loop 吗？进行中的调度将不再推进。')
  if (!ok) return
  loopSubmitting.value = true
  loopMessage.value = ''
  try {
    await cancelLoop(selectedLoopId.value)
    loopMessage.value = 'Loop 已取消'
    stopLoopSummaryPoll()
    await refreshSelectedLoop()
    await loadLoops()
  } catch (error) {
    loopMessage.value = formatApiError(error, '取消失败')
  } finally {
    loopSubmitting.value = false
  }
}

function deleteSelectedLoop() {
  if (!selectedLoopId.value || !selectedLoop.value) {
    loopMessage.value = '请先选中一个 Loop'
    return
  }
  if (!canDeleteSelectedLoop.value) {
    pendingDeleteLoop.value = null
    loopMessage.value = `当前 Loop 状态为 ${selectedLoop.value.status || '未知'}，只能删除 completed / failed / cancelled 的历史 Loop。请先取消或等待流程结束。`
    return
  }
  const loopName = selectedLoop.value?.name || selectedLoopId.value
  pendingDeleteLoop.value = {
    loop_id: selectedLoopId.value,
    name: loopName,
  }
  loopMessage.value = '请确认删除历史 Loop'
}

async function confirmDeleteSelectedLoop() {
  if (!pendingDeleteLoop.value || loopSubmitting.value) return
  loopSubmitting.value = true
  loopMessage.value = ''
  try {
    const deletingLoopId = pendingDeleteLoop.value.loop_id
    const result = await deleteLoop(deletingLoopId)
    loopMessage.value = `已删除历史 Loop（保留 ${result?.detached_batches ?? 0} 个关联实验）`
    pendingDeleteLoop.value = null
    selectedLoopId.value = ''
    selectedLoop.value = null
    loopSummary.value = null
    stopLoopSummaryPoll()
    await loadLoops()
    await loadBatches()
  } catch (error) {
    loopMessage.value = formatApiError(error, '删除历史 Loop 失败')
  } finally {
    loopSubmitting.value = false
  }
}

async function advanceSelectedLoop() {
  if (!selectedLoopId.value || !canAdvanceLoop.value) return
  loopSubmitting.value = true
  loopMessage.value = ''
  try {
    const result = await advanceLoop(selectedLoopId.value)
    loopMessage.value = `手动推进：${formatAdvanceAction(result)}`
    await refreshSelectedLoop()
    await loadLoops()
    const batchId = selectedLoop.value?.current_batch_id
    if (batchId) {
      await selectBatch(batchId)
    }
  } catch (error) {
    loopMessage.value = formatApiError(error, '手动推进失败')
  } finally {
    loopSubmitting.value = false
  }
}

async function createNextExperiment(paramsOverride = null, nameOverride = '') {
  if (!selectedBatchId.value || !canCreateNextExperiment.value) return
  batchActionSubmitting.value = true
  batchMessage.value = ''
  try {
    const strategyParams = getBatchNextParamsForSubmit(
      isPlainParamsObject(paramsOverride) ? paramsOverride : null
    )
    const experimentName =
      typeof nameOverride === 'string' && nameOverride
        ? nameOverride
        : batchDraft.name || buildStructuredBatchName(selectedBatch.value, {
          strategy_key: batchDraft.strategy_key,
          preset: batchDraft.preset,
        })
    const result = await rerunBatch(selectedBatchId.value, {
      name: experimentName,
      strategy_key: batchDraft.strategy_key || selectedBatch.value?.strategy_key,
      preset: batchDraft.preset || null,
      strategy_params: strategyParams,
      start_date: selectedBatch.value?.start_date,
      end_date: selectedBatch.value?.end_date,
      initial_cash: selectedBatch.value?.initial_cash,
    })
    batchMessage.value = `下一轮实验已创建：${result.batch_id}`
    await loadBatches()
    await selectBatch(result.batch_id)
  } catch (error) {
    batchMessage.value = formatApiError(error, '创建下一轮实验失败')
  } finally {
    batchActionSubmitting.value = false
  }
}

watch(() => form.strategy_key, () => {
  if (suppressPresetApply.value) return
  const defaultPreset = selectedPresets.value.find((item) => item.is_default) || selectedPresets.value[0]
  form.preset = defaultPreset?.preset || ''
  applyPresetParams()
})

watch(() => form.target_mode, (mode) => {
  if (mode === 'index') {
    form.asset_type = 'stock'
    form.universe_type = 'index'
    if (!form.universe_value || form.universe_value.includes('.')) form.universe_value = 'csi1000'
  } else if (mode === 'single_etf') {
    form.asset_type = 'etf'
    form.universe_type = 'manual'
    loadEtfOptions()
  } else if (mode === 'manual') {
    form.universe_type = 'manual'
    if (form.universe_value === 'csi1000') form.universe_value = ''
  } else if (mode === 'strategy_pool') {
    form.asset_type = 'stock'
    form.universe_type = 'strategy_pool'
    if (form.universe_value === 'csi1000' || form.universe_value.includes('.')) form.universe_value = ''
  }
})

watch(() => form.preset, () => {
  if (suppressPresetApply.value) return
  applyPresetParams()
})

onMounted(async () => {
  await loadStrategyMeta()
  await refreshAll()
  startLoopHealthPoll()
})

onUnmounted(() => {
  stopLoopSummaryPoll()
  stopLoopHealthPoll()
})
</script>

<style scoped>
.strategy-lab {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.lab-header,
.detail-header,
.actions,
.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.eyebrow {
  color: #64748b;
  font-size: 12px;
  letter-spacing: 0.08em;
  margin: 0;
  text-transform: uppercase;
}

h2,
h3,
p {
  margin: 0;
}

.subtitle {
  color: #64748b;
  margin-top: 6px;
}

.section-title-row {
  align-items: flex-start;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.section-title-row.compact {
  align-items: center;
}

.section-kicker {
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  margin: 0 0 4px;
}

.type-badge,
.row-type {
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  padding: 5px 8px;
  white-space: nowrap;
}

.loop-badge,
.loop-row .row-type {
  background: #e0e7ff;
  color: #3730a3;
}

.batch-badge,
.experiment-row .row-type {
  background: #dcfce7;
  color: #166534;
}

.list-caption {
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-bottom: 8px;
}

.list-caption span {
  color: #64748b;
  font-size: 12px;
}

.loop-health-panel {
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
  padding: 12px;
}

.loop-health-panel.unhealthy {
  background: #fff7ed;
  border-color: #fed7aa;
}

.loop-wait-panel {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 12px;
  margin: 12px 0;
  padding: 12px;
}

.loop-wait-panel strong {
  color: #9a3412;
}

.loop-wait-panel p {
  color: #475569;
  font-size: 13px;
  margin-top: 6px;
}

.loop-review-task-box {
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid #fed7aa;
  border-radius: 10px;
  margin-top: 10px;
  padding: 10px;
}

.loop-health-panel strong {
  color: #0f172a;
  display: block;
  margin-bottom: 4px;
}

.loop-health-panel span {
  color: #475569;
  font-size: 13px;
}

.loop-health-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
}

.list-action-block {
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 4px;
  padding-bottom: 10px;
}

.loop-panel .loop-layout {
  display: grid;
  gap: 12px;
  grid-template-columns: 240px 1fr;
  margin-top: 12px;
}

.loop-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.loop-timeline {
  margin: 12px 0 0;
  padding-left: 18px;
  color: #334155;
  font-size: 13px;
}

.muted {
  color: #64748b;
  font-size: 13px;
  margin-top: 8px;
}

.card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
  padding: 16px;
}

.form-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  margin-top: 12px;
}

label {
  color: #334155;
  display: flex;
  flex-direction: column;
  font-size: 13px;
  gap: 6px;
}

input,
select,
textarea {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
}

.full {
  margin-top: 12px;
}

button {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  padding: 8px 12px;
}

.primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

.danger {
  color: #b91c1c;
}

.layout {
  display: grid;
  gap: 16px;
  grid-template-columns: 300px minmax(0, 1fr);
}

.batch-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.batch-row {
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
}

.loop-row {
  border-color: #c7d2fe;
  background: #f8faff;
}

.experiment-row {
  border-color: #bbf7d0;
  background: #fbfefc;
}

.experiment-row.loop-iteration-batch {
  border-color: #c7d2fe;
  background: #f8faff;
}

.batch-row.active {
  border-color: #2563eb;
  background: #eff6ff;
}

.batch-row span,
.batch-row small {
  color: #64748b;
}

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.metrics {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  margin: 16px 0;
}

.metrics div {
  background: #f8fafc;
  border-radius: 10px;
  padding: 10px;
}

.metrics span {
  color: #64748b;
  display: block;
  font-size: 12px;
}

.inline-confirm {
  border-radius: 12px;
  margin: 12px 0;
  padding: 12px;
}

.danger-confirm {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.danger-confirm strong {
  color: #991b1b;
}

.danger-confirm p {
  color: #7f1d1d;
  font-size: 13px;
  margin-top: 6px;
}

.confirm-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.table-wrap {
  margin-top: 12px;
  overflow: auto;
}

.batch-config-panel {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-top: 16px;
  padding: 12px;
}

.batch-config-panel h4 {
  margin-bottom: 4px;
}

.collapsible-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.collapse-toggle {
  align-items: center;
  background: transparent;
  border: none;
  color: #334155;
  cursor: pointer;
  display: inline-flex;
  gap: 8px;
  padding: 0;
  text-align: left;
  width: fit-content;
}

.collapse-toggle:hover {
  color: #2563eb;
}

.collapse-toggle strong {
  font-weight: 600;
}

.collapse-chevron {
  color: #64748b;
  display: inline-block;
  font-size: 12px;
  line-height: 1;
  transition: transform 0.15s ease;
}

.collapse-chevron.expanded {
  transform: rotate(90deg);
}

.collapse-body {
  margin-top: 4px;
}

.params-table-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.params-table {
  border-collapse: collapse;
  font-size: 13px;
  width: 100%;
}

.params-table th,
.params-table td {
  border-bottom: 1px solid #e2e8f0;
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
}

.params-table th {
  background: #f1f5f9;
  color: #475569;
  font-weight: 600;
}

.param-name {
  min-width: 140px;
}

.param-key {
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.param-desc {
  color: #64748b;
  display: block;
  margin-top: 2px;
}

.param-current {
  color: #475569;
  min-width: 100px;
}

.param-next input {
  width: 100%;
}

.param-row-changed {
  background: #fffbeb;
}

.param-row-changed .param-next input {
  border-color: #f59e0b;
}

.param-row-new {
  background: #eff6ff;
}

.param-row-new .param-next input {
  border-color: #2563eb;
}

.review-panel {
  background: #f8fafc;
  border-radius: 12px;
  margin-top: 16px;
  padding: 12px;
}

.trade-panel {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 12px;
  margin-top: 16px;
  padding: 12px;
}

.trade-table-wrap {
  margin-top: 8px;
}

.result-action-hint {
  margin: 12px 0 0;
}

.review-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin-top: 10px;
}

.param-diff {
  background: #f8fafc;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  margin-top: 12px;
  padding: 12px;
}

.param-diff-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.diff-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.diff-summary.muted {
  color: #64748b;
}

.diff-chip {
  border-radius: 999px;
  font-size: 12px;
  padding: 4px 8px;
}

.diff-chip.added {
  background: #dcfce7;
  color: #166534;
}

.diff-chip.changed {
  background: #fef3c7;
  color: #92400e;
}

.diff-chip.removed {
  background: #fee2e2;
  color: #991b1b;
}

.diff-panels {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  margin-top: 12px;
}

.diff-panels h4 {
  color: #334155;
  margin: 0 0 6px;
}

.diff-panels pre {
  background: #0f172a;
  border-radius: 10px;
  color: #e2e8f0;
  font-size: 12px;
  margin: 0;
  max-height: 260px;
  overflow: auto;
  padding: 10px;
}

table {
  border-collapse: collapse;
  min-width: 900px;
  width: 100%;
}

th,
td {
  border-bottom: 1px solid #e2e8f0;
  padding: 8px;
  text-align: left;
}

th {
  color: #475569;
  font-size: 12px;
}

.error {
  color: #b91c1c;
  max-width: 320px;
}

.mini-btn {
  font-size: 12px;
  padding: 4px 8px;
}

.danger-mini {
  border-color: #fecaca;
  color: #b91c1c;
}

.danger-mini:disabled {
  color: #94a3b8;
  border-color: #e2e8f0;
  cursor: not-allowed;
}

.empty {
  color: #64748b;
}

.message {
  color: #2563eb;
}

.loop-final-report-panel {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  margin: 12px 0;
  padding: 14px;
}

.loop-final-report-panel h4 {
  margin: 0 0 10px;
  color: #1e3a8a;
}

.report-lead {
  font-size: 15px;
  line-height: 1.55;
  margin: 0 0 12px;
}

.report-block {
  margin-top: 10px;
  font-size: 13px;
}

.report-block ul {
  margin: 6px 0 0;
  padding-left: 1.2rem;
}

.loop-summary-panel {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin: 12px 0;
  padding: 12px;
}

.loop-summary-panel h4 {
  margin: 0 0 8px;
}

.loop-summary-table .review-snippet {
  max-width: 280px;
  font-size: 13px;
  line-height: 1.4;
}

.loop-final-box {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 10px;
  font-size: 13px;
}

.link-btn {
  background: none;
  border: none;
  color: #2563eb;
  cursor: pointer;
  font-size: inherit;
  padding: 0;
  text-decoration: underline;
}

.link-btn:hover {
  color: #1d4ed8;
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
