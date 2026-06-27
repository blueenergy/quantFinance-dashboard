<template>
  <div v-if="visible" class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-card modal-wide">
      <h3>{{ title }}</h3>
      <p v-if="summaryText" class="muted">{{ summaryText }}</p>
      <p v-if="stalePriceSymbols.length" class="watermark-warning">
        以下标的按昨收定价（实时未就绪）：{{ stalePriceSymbols.join(', ') }}
      </p>
      <p v-if="blockerMessages.length" class="watermark-warning">
        {{ blockerMessages.slice(0, 8).join(' / ') }}
      </p>

      <PlanItemsTable
        v-if="repriceRows.length"
        mode="reprice"
        :items="repriceRows"
        compact
      />

      <div v-if="riskRows.length" class="table-wrap compact risk-report-table">
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
              v-for="item in riskRows"
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
                <span v-if="!item.blockers?.length && !(item.warnings || []).length">可发布</span>
                <span
                  v-for="warning in (item.warnings || [])"
                  :key="`${item.order_id}-warn-${warning}`"
                  class="risk-chip warn"
                  :title="blockerText(warning)"
                >
                  {{ blockerText(warning) }}
                </span>
                <span
                  v-for="blocker in item.blockers"
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

      <div v-if="signalPreview.length" class="table-wrap compact">
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
            <tr v-for="signal in signalPreview" :key="signal.order_id">
              <td>{{ signalDisplayName(signal) }}</td>
              <td>{{ signal.action }}</td>
              <td>{{ signal.size }}</td>
              <td>{{ num(signal.price) }}</td>
              <td class="truncate" :title="signal.order_id">{{ signal.order_id }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="modal-actions">
        <button type="button" @click="$emit('close')">关闭</button>
        <button
          v-if="showConfirm"
          type="button"
          :disabled="loading || confirmDisabled"
          @click="$emit('confirm')"
        >
          {{ loading ? '提交中…' : confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import PlanItemsTable from './PlanItemsTable.vue'
import { blockerText, money, num } from '../../composables/usePortfolioPlanFormat'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '实盘发布预检' },
  preview: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  showConfirm: { type: Boolean, default: true },
  confirmLabel: { type: String, default: '确认发布' },
  confirmDisabled: { type: Boolean, default: false },
  blockerMessages: { type: Array, default: () => [] },
})

defineEmits(['close', 'confirm'])

const summaryText = computed(() => {
  const preview = props.preview
  if (!preview) return ''
  return `待写入 ${preview.new_signals?.length ?? 0} 条，已有 ${preview.existing_count ?? 0} 条，阻断 ${preview.risk_report?.blocked_count ?? 0} 条`
})

const stalePriceSymbols = computed(() => props.preview?.reprice_summary?.stale_price_symbols || [])
const repriceRows = computed(() => props.preview?.reprice_summary?.items || [])
const riskRows = computed(() => props.preview?.risk_report?.items || [])
const signalPreview = computed(() => (props.preview?.new_signals || []).slice(0, 8))

function signalDisplayName(signal) {
  return signal?.name || signal?.stock_name || signal?.symbol || '-'
}
</script>

<style scoped>
.modal-backdrop {
  align-items: flex-start;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  inset: 0;
  justify-content: center;
  overflow-y: auto;
  padding: 48px 16px;
  position: fixed;
  z-index: 1000;
}

.modal-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.18);
  max-width: 960px;
  padding: 20px 24px;
  width: 100%;
}

.modal-wide {
  max-width: 1080px;
}

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
}

.watermark-warning {
  color: #9a6700;
  font-size: 13px;
}

.risk-chip {
  background: #fee2e2;
  border: 1px solid #fca5a5;
  border-radius: 4px;
  color: #991b1b;
  display: inline-block;
  font-size: 11px;
  margin-right: 4px;
  padding: 1px 4px;
}

.risk-chip.warn {
  background: #fff7e6;
  border-color: #e08e0b;
  color: #9a6700;
}

.risk-reasons {
  white-space: normal;
}

tr.blocked {
  background: #fff5f5;
}

.truncate {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
