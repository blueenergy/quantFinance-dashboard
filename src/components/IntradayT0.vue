<template>
  <div class="intraday-t0-page">
    <div class="page-header">
      <div>
        <h3>日内T+0</h3>
        <p>基于实时日K、盘口、成交质量和大盘/板块强弱，为已有仓位或模拟仓位生成高抛低吸观察信号。</p>
      </div>
      <div class="actions">
        <select v-model="source" @change="loadAll">
          <option value="auto">auto</option>
          <option value="real">real</option>
          <option value="mock">mock</option>
          <option value="watchlist">watchlist</option>
        </select>
        <input v-model="tradeDate" type="date" />
        <button class="btn primary" :disabled="loading" @click="loadAll">刷新</button>
        <button class="btn" :disabled="loading" @click="generateSignals">生成信号</button>
        <button class="btn" :disabled="loading" @click="evaluateSignals">评估</button>
        <button class="btn" :disabled="loading" @click="exportSignalsCsv">导出信号</button>
        <button class="btn" :disabled="loading" @click="exportEvaluationsCsv">导出评估</button>
      </div>
    </div>

    <div v-if="error" class="alert error">{{ error }}</div>
    <div v-if="message" class="alert info">{{ message }}</div>

    <section class="grid">
      <div class="panel">
        <div class="panel-title">
          <h4>模拟仓位</h4>
          <button class="btn small" :disabled="loading" @click="createFromWatchlist">从自选股生成</button>
        </div>
        <div class="mock-form">
          <input v-model="mockForm.symbol" placeholder="代码，如 300750.SZ" />
          <input v-model.number="mockForm.quantity" type="number" min="0" placeholder="数量" />
          <input v-model.number="mockForm.cost_price" type="number" min="0" step="0.01" placeholder="成本价" />
          <label><input v-model="mockForm.enabled" type="checkbox" /> 启用</label>
          <button class="btn primary" :disabled="loading || !mockForm.symbol" @click="saveMockPosition">保存</button>
        </div>
      </div>

      <div class="panel market-card">
        <h4>大盘实时状态</h4>
        <div class="metric-row">
          <span>阳谱</span>
          <strong>{{ percent(market?.yang_spectrum) }}</strong>
        </div>
        <div class="metric-row">
          <span>覆盖率</span>
          <strong>{{ percent(market?.coverage_ratio) }}</strong>
        </div>
        <div class="metric-row">
          <span>快照</span>
          <strong>{{ market?.snapshot_time || '-' }}</strong>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-title">
        <h4>持仓实时态势</h4>
        <span>{{ positions.length }} 条，来源：{{ actualSource || source }}</span>
      </div>
      <div v-if="loading" class="empty">加载中...</div>
      <div v-else-if="positions.length === 0" class="empty">暂无持仓，可先从自选股生成模拟仓位。</div>
      <table v-else>
        <thead>
          <tr>
            <th>股票</th>
            <th>来源</th>
            <th>数量</th>
            <th>成本/现价</th>
            <th>盈亏</th>
            <th>涨跌幅</th>
            <th>盘口</th>
            <th>成交</th>
            <th>行业</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="pos in positions" :key="`${pos.position_source}-${pos.symbol}`">
            <td>
              <strong>{{ pos.name || pos.symbol }}</strong>
              <div class="muted">{{ pos.symbol }}</div>
            </td>
            <td>{{ pos.position_source }}</td>
            <td>{{ pos.quantity }}</td>
            <td>{{ fmt(pos.cost_price) }} / {{ fmt(pos.current_price) }}</td>
            <td :class="numClass(pos.pnl_pct)">{{ pctText(pos.pnl_pct) }}</td>
            <td :class="numClass(pos.pct_chg)">{{ pctText(pos.pct_chg) }}</td>
            <td>
              <div>买一 {{ fmt(pos.realtime_bid_price1) }} / {{ pos.realtime_bid_volume1 || 0 }}</div>
              <div>卖一 {{ fmt(pos.realtime_ask_price1) }} / {{ pos.realtime_ask_volume1 || 0 }}</div>
            </td>
            <td>
              <div>笔数 {{ pos.realtime_num || 0 }}</div>
              <div>{{ yuan(pos.realtime_amount_yuan) }}</div>
            </td>
            <td>{{ pos.sw_l1_name || '-' }}</td>
            <td>
              <button
                v-if="pos.position_source === 'mock' && pos.id"
                class="btn danger small"
                :disabled="loading"
                @click="deleteMockPosition(pos.id)"
              >删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="panel">
      <div class="panel-title">
        <h4>最新信号</h4>
        <span>{{ signals.length }} 条</span>
      </div>
      <div v-if="signals.length === 0" class="empty">暂无信号，可点击“生成信号”。</div>
      <table v-else>
        <thead>
          <tr>
            <th>时间</th>
            <th>股票</th>
            <th>信号</th>
            <th>分数</th>
            <th>价格</th>
            <th>原因</th>
            <th>关键特征</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="sig in signals" :key="sig._id || `${sig.symbol}-${sig.snapshot_time}`">
            <td>{{ formatSnapshot(sig.snapshot_time) }}</td>
            <td>{{ sig.name || sig.symbol }}<div class="muted">{{ sig.symbol }}</div></td>
            <td><span :class="['signal', sig.signal_type]">{{ sig.signal_type }}</span></td>
            <td>{{ fmt(sig.signal_score) }}</td>
            <td>{{ fmt(sig.price) }}</td>
            <td>{{ (sig.reason_codes || []).join(', ') }}</td>
            <td>
              阳谱 {{ percent(sig.features?.market_yang_spectrum) }} /
              盘口 {{ fmt(sig.features?.bid_ask_imbalance, 3) }} /
              位置 {{ percent(sig.features?.intraday_position) }}
            </td>
            <td>
              <button class="btn small" @click="fillTradeFromSignal(sig)">记账</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="panel">
      <div class="panel-title">
        <h4>人工成交记账（Phase 2）</h4>
        <button class="btn" :disabled="loading" @click="runDayCloseCheck">日终检查</button>
      </div>
      <div v-if="dayCloseAlerts.length" class="alert error">
        <div v-for="alert in dayCloseAlerts" :key="alert.pair_id">{{ alert.message }}</div>
      </div>
      <div class="trade-summary" v-if="tradeSummary">
        <span>已平仓 {{ tradeSummary.closed_pairs }} 组</span>
        <span>未回补 {{ tradeSummary.open_pairs }} 组</span>
        <span>裸露 {{ tradeSummary.naked_qty }} 股</span>
        <span :class="numClass(tradeSummary.total_net_pnl)">净盈亏 {{ yuan(tradeSummary.total_net_pnl) }}</span>
      </div>
      <div class="mock-form trade-form">
        <input v-model="tradeForm.symbol" placeholder="代码" />
        <select v-model="tradeForm.leg">
          <option value="sell">sell</option>
          <option value="buy">buy</option>
        </select>
        <input v-model.number="tradeForm.quantity" type="number" min="1" placeholder="数量" />
        <input v-model.number="tradeForm.price" type="number" min="0" step="0.01" placeholder="成交价" />
        <input v-model.number="tradeForm.fees" type="number" min="0" step="0.01" placeholder="费用" />
        <input v-model="tradeForm.pair_id" placeholder="pair_id（买入必填）" />
        <input v-model="tradeForm.signal_id" placeholder="signal_id（可选）" />
        <button class="btn" :disabled="loading" @click="previewFromSignal">预览建议</button>
        <button class="btn primary" :disabled="loading || !tradeForm.symbol" @click="saveTrade">记录成交</button>
      </div>
      <div v-if="tradePreview" class="alert info">
        建议数量 {{ tradePreview.suggested_qty }}，可卖 {{ tradePreview.available_qty }}
        <span v-if="tradePreview.warnings?.length">（{{ tradePreview.warnings.join('；') }}）</span>
      </div>
      <div v-if="openPairs.length" class="open-pairs">
        <strong>未回补配对</strong>
        <div v-for="pair in openPairs" :key="pair.pair_id" class="pair-row">
          {{ pair.symbol }} · 裸露 {{ pair.uncovered_qty }} 股 · pair {{ pair.pair_id }}
          <button class="btn small" @click="fillBuyFromPair(pair)">填入买入</button>
        </div>
      </div>
      <table v-if="tradeRows.length">
        <thead>
          <tr>
            <th>时间</th>
            <th>股票</th>
            <th>方向</th>
            <th>数量</th>
            <th>价格</th>
            <th>费用</th>
            <th>pair_id</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in tradeRows" :key="row.id || row._id">
            <td>{{ formatTradeTime(row.created_at) }}</td>
            <td>{{ row.symbol }}</td>
            <td>{{ row.leg }}</td>
            <td>{{ row.quantity }}</td>
            <td>{{ fmt(row.price) }}</td>
            <td>{{ fmt(row.fees) }}</td>
            <td class="muted">{{ row.pair_id }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">暂无成交记录。</div>
    </section>

    <section class="panel">
      <div class="panel-title">
        <h4>表现统计</h4>
        <div class="perf-tabs">
          <button
            class="btn small"
            :class="{ active: perfTab === 'overall' }"
            @click="perfTab = 'overall'"
          >总体</button>
          <button
            class="btn small"
            :class="{ active: perfTab === 'symbol' }"
            @click="perfTab = 'symbol'"
          >按股票</button>
          <button
            class="btn small"
            :class="{ active: perfTab === 'reason' }"
            @click="perfTab = 'reason'"
          >按原因</button>
          <span class="muted">{{ activePerformance.length }} 组</span>
        </div>
      </div>
      <div v-if="activePerformance.length === 0" class="empty">暂无评估结果。</div>
      <table v-else>
        <thead>
          <tr>
            <th v-if="perfTab === 'symbol'">股票</th>
            <th v-if="perfTab === 'reason'">原因</th>
            <th>信号</th>
            <th>周期</th>
            <th>样本数</th>
            <th>平均收益</th>
            <th>胜率</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in activePerformance" :key="performanceRowKey(row)">
            <td v-if="perfTab === 'symbol'">{{ row.symbol }}</td>
            <td v-if="perfTab === 'reason'">{{ row.reason_code }}</td>
            <td>{{ row.signal_type }}</td>
            <td>{{ row.horizon }}</td>
            <td>{{ row.count }}</td>
            <td :class="numClass(row.avg_return_pct)">{{ pctText(row.avg_return_pct) }}</td>
            <td>{{ percent(row.win_rate) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import axios from 'axios'
import request from '../utils/request'

const loading = ref(false)
const error = ref('')
const message = ref('')
const source = ref('auto')
const actualSource = ref('')
const positions = ref([])
const signals = ref([])
const performance = ref([])
const performanceBySymbol = ref([])
const performanceByReason = ref([])
const perfTab = ref('overall')
const market = ref(null)
const tradeDate = ref(new Date().toISOString().slice(0, 10))
const mockForm = reactive({
  symbol: '',
  quantity: 100,
  cost_price: 0,
  enabled: true,
})
const tradeRows = ref([])
const openPairs = ref([])
const tradeSummary = ref(null)
const tradePreview = ref(null)
const dayCloseAlerts = ref([])
const tradeForm = reactive({
  symbol: '',
  leg: 'sell',
  quantity: 100,
  price: 0,
  fees: 0,
  pair_id: '',
  signal_id: '',
})

function compactDate() {
  return (tradeDate.value || '').replaceAll('-', '')
}

function setError(err, fallback) {
  error.value = err?.response?.data?.detail || err?.message || fallback
}

async function loadPositions() {
  const body = await request.get('/intraday-t0/positions', {
    params: { source: source.value, trade_date: compactDate() },
  })
  positions.value = body?.data || []
  actualSource.value = body?.source || source.value
  market.value = body?.market || null
}

async function loadSignals() {
  const body = await request.get('/intraday-t0/signals', {
    params: { trade_date: compactDate(), limit: 200 },
  })
  signals.value = body?.data || []
}

async function loadPerformance() {
  const body = await request.get('/intraday-t0/signals/performance', {
    params: { trade_date: compactDate() },
  })
  performance.value = body?.data || []
  performanceBySymbol.value = body?.by_symbol || []
  performanceByReason.value = body?.by_reason || []
}

const activePerformance = computed(() => {
  if (perfTab.value === 'symbol') return performanceBySymbol.value
  if (perfTab.value === 'reason') return performanceByReason.value
  return performance.value
})

function performanceRowKey(row) {
  if (perfTab.value === 'symbol') return `${row.symbol}-${row.signal_type}-${row.horizon}`
  if (perfTab.value === 'reason') return `${row.reason_code}-${row.signal_type}-${row.horizon}`
  return `${row.signal_type}-${row.horizon}`
}

async function downloadCsv(path, filename) {
  const token = localStorage.getItem('access_token')
  const baseURL = import.meta.env.VITE_API_BASE || '/api'
  const response = await axios.get(`${baseURL}${path}`, {
    params: { trade_date: compactDate() },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    responseType: 'blob',
  })
  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function exportSignalsCsv() {
  loading.value = true
  error.value = ''
  try {
    await downloadCsv('/intraday-t0/signals/export', `intraday_t0_signals_${compactDate()}.csv`)
    message.value = '信号 CSV 已开始下载'
  } catch (err) {
    setError(err, '导出信号 CSV 失败')
  } finally {
    loading.value = false
  }
}

async function exportEvaluationsCsv() {
  loading.value = true
  error.value = ''
  try {
    await downloadCsv('/intraday-t0/signals/evaluations/export', `intraday_t0_evaluations_${compactDate()}.csv`)
    message.value = '评估 CSV 已开始下载'
  } catch (err) {
    setError(err, '导出评估 CSV 失败')
  } finally {
    loading.value = false
  }
}

async function loadAll() {
  loading.value = true
  error.value = ''
  message.value = ''
  try {
    await Promise.all([loadPositions(), loadSignals(), loadPerformance(), loadTrades(), loadTradeSummary()])
  } catch (err) {
    setError(err, '加载日内T+0数据失败')
  } finally {
    loading.value = false
  }
}

async function loadTrades() {
  const [tradesBody, openBody] = await Promise.all([
    request.get('/intraday-t0/trades', { params: { trade_date: compactDate(), limit: 200 } }),
    request.get('/intraday-t0/trades/open', { params: { trade_date: compactDate() } }),
  ])
  tradeRows.value = tradesBody?.data || []
  openPairs.value = openBody?.data || []
}

async function loadTradeSummary() {
  const body = await request.get('/intraday-t0/trades/day-summary', {
    params: { trade_date: compactDate() },
  })
  tradeSummary.value = body
}

function fillTradeFromSignal(sig) {
  tradeForm.symbol = sig.symbol || ''
  tradeForm.signal_id = sig._id || sig.id || ''
  tradeForm.price = Number(sig.price) || 0
  tradeForm.leg = sig.signal_type === 'BUY_WATCH' ? 'buy' : 'sell'
  tradePreview.value = null
}

function fillBuyFromPair(pair) {
  tradeForm.symbol = pair.symbol || ''
  tradeForm.leg = 'buy'
  tradeForm.pair_id = pair.pair_id || ''
  tradeForm.quantity = pair.uncovered_qty || 0
}

async function previewFromSignal() {
  if (!tradeForm.signal_id) {
    error.value = '请先填写 signal_id 或从信号行点「记账」'
    return
  }
  loading.value = true
  error.value = ''
  try {
    tradePreview.value = await request.get('/intraday-t0/trades/preview', {
      params: { signal_id: tradeForm.signal_id },
    })
    if (tradePreview.value?.suggested_qty) {
      tradeForm.quantity = tradePreview.value.suggested_qty
    }
    if (tradePreview.value?.symbol) {
      tradeForm.symbol = tradePreview.value.symbol
    }
  } catch (err) {
    setError(err, '预览建议失败')
  } finally {
    loading.value = false
  }
}

async function saveTrade() {
  loading.value = true
  error.value = ''
  try {
    const body = await request.post('/intraday-t0/trades', {
      symbol: tradeForm.symbol,
      leg: tradeForm.leg,
      quantity: tradeForm.quantity,
      price: tradeForm.price,
      fees: tradeForm.fees,
      trade_date: compactDate(),
      signal_id: tradeForm.signal_id || undefined,
      pair_id: tradeForm.pair_id || undefined,
    })
    message.value = `已记录 ${tradeForm.leg} ${tradeForm.quantity} 股`
    if (tradeForm.leg === 'sell' && body?.data?.pair_id) {
      tradeForm.pair_id = body.data.pair_id
    }
    await Promise.all([loadTrades(), loadTradeSummary()])
  } catch (err) {
    setError(err, '记录成交失败')
  } finally {
    loading.value = false
  }
}

async function runDayCloseCheck() {
  loading.value = true
  error.value = ''
  try {
    const body = await request.post('/intraday-t0/trades/day-close-check', null, {
      params: { trade_date: compactDate() },
    })
    dayCloseAlerts.value = body?.alerts || []
    tradeSummary.value = body?.summary || tradeSummary.value
    message.value = body?.requires_action
      ? `日终检查：${body.alert_count} 条未回补告警`
      : '日终检查：无未回补裸露'
  } catch (err) {
    setError(err, '日终检查失败')
  } finally {
    loading.value = false
  }
}

function formatTradeTime(ts) {
  const n = Number(ts)
  if (!Number.isFinite(n) || n <= 0) return '-'
  return new Date(n * 1000).toLocaleString()
}

async function saveMockPosition() {
  loading.value = true
  error.value = ''
  try {
    await request.post('/intraday-t0/mock-positions', {
      symbol: mockForm.symbol,
      quantity: mockForm.quantity,
      available_quantity: mockForm.quantity,
      cost_price: mockForm.cost_price,
      enabled: mockForm.enabled,
    })
    message.value = '模拟仓位已保存'
    mockForm.symbol = ''
    await loadAll()
  } catch (err) {
    setError(err, '保存模拟仓位失败')
  } finally {
    loading.value = false
  }
}

async function createFromWatchlist() {
  loading.value = true
  error.value = ''
  try {
    const body = await request.post('/intraday-t0/mock-positions/from-watchlist', { default_quantity: 100 })
    message.value = `已生成 ${body?.count || 0} 条模拟仓位`
    source.value = 'mock'
    await loadAll()
  } catch (err) {
    setError(err, '从自选股生成模拟仓位失败')
  } finally {
    loading.value = false
  }
}

async function deleteMockPosition(id) {
  loading.value = true
  error.value = ''
  try {
    await request.delete(`/intraday-t0/mock-positions/${id}`)
    message.value = '模拟仓位已删除'
    await loadAll()
  } catch (err) {
    setError(err, '删除模拟仓位失败')
  } finally {
    loading.value = false
  }
}

async function generateSignals() {
  loading.value = true
  error.value = ''
  try {
    const body = await request.post('/intraday-t0/signals/generate', {
      trade_date: compactDate(),
      source: source.value,
    })
    message.value = `已生成 ${body?.signals_count || 0} 条信号`
    await Promise.all([loadSignals(), loadPerformance()])
  } catch (err) {
    setError(err, '生成信号失败')
  } finally {
    loading.value = false
  }
}

async function evaluateSignals() {
  loading.value = true
  error.value = ''
  try {
    const body = await request.post('/intraday-t0/signals/evaluate', null, {
      params: { trade_date: compactDate() },
    })
    message.value = `已写入 ${body?.evaluations_written || 0} 条评估`
    await loadPerformance()
  } catch (err) {
    setError(err, '评估信号失败')
  } finally {
    loading.value = false
  }
}

function fmt(v, digits = 2) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(digits) : '-'
}

function pctText(v) {
  const n = Number(v)
  return Number.isFinite(n) ? `${n > 0 ? '+' : ''}${n.toFixed(2)}%` : '-'
}

function percent(v) {
  const n = Number(v)
  return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : '-'
}

function yuan(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '-'
  if (n >= 100000000) return `${(n / 100000000).toFixed(2)}亿`
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  return n.toFixed(0)
}

function numClass(v) {
  const n = Number(v)
  return {
    positive: Number.isFinite(n) && n > 0,
    negative: Number.isFinite(n) && n < 0,
  }
}

function formatSnapshot(snapshotTime) {
  const s = String(snapshotTime || '')
  if (s.length !== 12) return s || '-'
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(8, 10)}:${s.slice(10, 12)}`
}

onMounted(loadAll)
</script>

<style scoped>
.intraday-t0-page {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  color: #1f2937;
}
.page-header,
.panel-title,
.actions,
.mock-form,
.metric-row {
  display: flex;
  gap: 10px;
  align-items: center;
}
.page-header,
.panel-title,
.metric-row {
  justify-content: space-between;
}
.perf-tabs {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.btn.small.active {
  background: #dbeafe;
  border-color: #2563eb;
  color: #1d4ed8;
}
.page-header {
  margin-bottom: 14px;
  flex-wrap: wrap;
}
h3,
h4,
p {
  margin: 0;
}
.page-header p {
  margin-top: 4px;
  color: #64748b;
}
.actions,
.mock-form {
  flex-wrap: wrap;
}
input,
select {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 6px 8px;
}
.btn {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #f8fafc;
  padding: 6px 10px;
  cursor: pointer;
}
.btn.primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.btn.danger {
  color: #b91c1c;
}
.btn.small {
  padding: 4px 8px;
  font-size: 12px;
}
.btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.trade-summary,
.open-pairs,
.pair-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
  margin: 10px 0;
}
.trade-form {
  margin-top: 10px;
}
.grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
  gap: 12px;
}
.panel {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}
.market-card {
  min-height: 112px;
}
.alert {
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 10px;
}
.alert.error {
  background: #fee2e2;
  color: #991b1b;
}
.alert.info {
  background: #e0f2fe;
  color: #075985;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}
th,
td {
  border: 1px solid #e2e8f0;
  padding: 7px 8px;
  font-size: 13px;
  text-align: left;
  vertical-align: top;
}
th {
  background: #f8fafc;
  color: #475569;
}
.muted {
  color: #64748b;
  font-size: 12px;
}
.empty {
  padding: 18px;
  color: #64748b;
  text-align: center;
}
.positive {
  color: #dc2626;
}
.negative {
  color: #16a34a;
}
.signal {
  border-radius: 999px;
  display: inline-block;
  padding: 2px 8px;
  font-weight: 700;
}
.signal.BUY_WATCH {
  background: #fee2e2;
  color: #b91c1c;
}
.signal.SELL_WATCH {
  background: #dcfce7;
  color: #15803d;
}
.signal.HOLD {
  background: #f1f5f9;
  color: #475569;
}
@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
