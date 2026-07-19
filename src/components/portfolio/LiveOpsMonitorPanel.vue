<template>
  <section class="card live-ops-card">
    <div class="task-list-header">
      <div>
        <h3>实盘执行监控</h3>
        <p class="muted">
          <span v-if="planId">当前 plan：{{ planId }} · </span>
          signals {{ signalSummary }} · executions {{ executionSummary }}
          <span v-if="latestHeartbeat"> · quantTrader {{ latestHeartbeat.status }} / {{ latestHeartbeat.last_seen_at || '-' }}</span>
        </p>
      </div>
      <div class="task-list-actions">
        <select :value="accountId" @change="$emit('update:accountId', $event.target.value); $emit('refresh')">
          <option value="">全部账户</option>
          <option v-for="account in accountOptions" :key="account.id" :value="account.id">{{ account.label }}</option>
        </select>
        <button :disabled="loading" @click="$emit('refresh')">刷新实盘状态</button>
        <button @click="$emit('toggle')">{{ expanded ? '收起详情' : '展开详情' }}</button>
      </div>
    </div>
    <p v-if="loading && expanded" class="muted">正在加载实盘状态...</p>
    <div v-else-if="expanded" class="live-ops-grid">
      <div>
        <h4>quantTrader heartbeat</h4>
        <p v-if="!heartbeats.length" class="muted">暂无 heartbeat。</p>
        <p v-for="heartbeat in heartbeats" :key="heartbeat.worker_id" class="ops-line">
          <strong>{{ heartbeat.status }}</strong><span>{{ heartbeat.worker_id }}</span><small>{{ heartbeat.last_seen_at || '-' }}</small>
        </p>
      </div>
      <div>
        <h4>Live signals</h4>
        <p v-if="!signals.length" class="muted">暂无 live signals。</p>
        <p v-for="signal in signals.slice(0, 20)" :key="signal.order_id" class="ops-line">
          <strong>{{ signal.status }}</strong><span>{{ signal.action }} {{ signalDisplayName(signal) }} x {{ signal.size }}</span>
          <small>{{ signal.execution_time || signal.created_at || signal.timestamp || '-' }}</small>
        </p>
      </div>
      <div>
        <h4>Executions</h4>
        <p v-if="!executions.length" class="muted">暂无 execution。</p>
        <p v-for="execution in executions.slice(0, 5)" :key="`${execution.order_id}-${execution.status}-${execution.timestamp}`" class="ops-line">
          <strong>{{ execution.status }}</strong><span>{{ execution.action }} {{ execution.symbol }} filled {{ execution.filled_size ?? '-' }}</span>
          <small>{{ execution.execution_time || execution.timestamp || '-' }}</small>
        </p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { signalDisplayName } from '../../composables/usePortfolioPlanFormat'

defineProps({
  planId: { type: String, default: '' },
  signalSummary: { type: String, default: '' },
  executionSummary: { type: String, default: '' },
  latestHeartbeat: { type: Object, default: null },
  accountId: { type: String, default: '' },
  accountOptions: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  expanded: { type: Boolean, default: false },
  heartbeats: { type: Array, default: () => [] },
  signals: { type: Array, default: () => [] },
  executions: { type: Array, default: () => [] },
})

defineEmits(['update:accountId', 'refresh', 'toggle'])
</script>
