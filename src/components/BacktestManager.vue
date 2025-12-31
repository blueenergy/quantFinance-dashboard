<template>
  <div class="backtest-manager">
    <div class="header">
      <h2>📊 回测管理</h2>
      <button class="create-btn" @click="showCreateModal = true">
        ➕ 创建回测任务
      </button>
    </div>

    <!-- 任务列表 -->
    <div class="tasks-section">
      <div class="section-header">
        <h3>回测任务列表</h3>
        <div class="filters">
          <select v-model="statusFilter" @change="loadTasks">
            <option value="">全部状态</option>
            <option value="pending">等待中</option>
            <option value="claimed">已认领</option>
            <option value="running">运行中</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
            <option value="cancelled">已取消</option>
          </select>
          <button class="refresh-btn" @click="loadTasks">🔄 刷新</button>
        </div>
      </div>

      <div v-if="loading" class="loading">加载中...</div>
      
      <div v-else-if="tasks.length === 0" class="empty">
        暂无回测任务
      </div>

      <div v-else class="tasks-list">
        <div 
          v-for="task in tasks" 
          :key="task.task_id"
          class="task-card"
          :class="[`status-${task.status}`]"
          @click="selectTask(task)"
        >
          <div class="task-header">
            <div class="task-title">
              <span class="symbol">{{ task.symbol }}</span>
              <span class="strategy">{{ task.strategy_key }}</span>
            </div>
            <span class="status-badge" :class="`status-${task.status}`">
              {{ getStatusText(task.status) }}
            </span>
          </div>
          
          <div class="task-details">
            <div class="detail-item">
              <span class="label">时间范围:</span>
              <span class="value">{{ formatDate(task.start_date) }} ~ {{ formatDate(task.end_date) }}</span>
            </div>
            <div class="detail-item">
              <span class="label">初始资金:</span>
              <span class="value">{{ formatCurrency(task.initial_cash) }}</span>
            </div>
            <div class="detail-item">
              <span class="label">创建时间:</span>
              <span class="value">{{ formatDateTime(task.created_at) }}</span>
            </div>
          </div>

          <div class="task-actions" @click.stop>
            <button 
              v-if="task.status === 'completed'" 
              class="view-btn"
              @click="viewResult(task.task_id)"
            >
              📈 查看结果
            </button>
            <button 
              v-if="['pending', 'claimed', 'running'].includes(task.status)"
              class="cancel-btn"
              @click="cancelTask(task.task_id)"
            >
              ❌ 取消
            </button>
            <button 
              v-if="['completed', 'failed', 'cancelled'].includes(task.status)"
              class="delete-btn"
              @click="deleteTask(task.task_id)"
            >
              🗑️ 删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建任务模态框 -->
    <div v-if="showCreateModal" class="modal" @click.self="showCreateModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>创建回测任务</h3>
          <button class="close-btn" @click="showCreateModal = false">✕</button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label>股票代码 *</label>
            <input 
              v-model="newTask.symbol" 
              type="text" 
              placeholder="例如: 000858 或 000858.SZ"
              @blur="normalizeSymbol"
            />
            <small v-if="normalizedSymbol" class="hint">
              将使用: {{ normalizedSymbol }}
            </small>
          </div>

          <div class="form-group">
            <label>策略 *</label>
            <select v-model="newTask.strategy_key">
              <option value="">请选择策略</option>
              <option value="turtle">海龟策略</option>
              <option value="grid">网格策略</option>
              <option value="mean_reversion">均值回归</option>
              <option value="momentum">动量策略</option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>开始日期 *</label>
              <input 
                v-model="newTask.start_date" 
                type="text" 
                placeholder="YYYYMMDD"
                maxlength="8"
              />
            </div>
            <div class="form-group">
              <label>结束日期 *</label>
              <input 
                v-model="newTask.end_date" 
                type="text" 
                placeholder="YYYYMMDD"
                maxlength="8"
              />
            </div>
          </div>

          <div class="form-group">
            <label>初始资金</label>
            <input 
              v-model.number="newTask.initial_cash" 
              type="number" 
              step="10000"
              min="10000"
            />
          </div>

          <div class="form-group">
            <label>策略参数 (JSON)</label>
            <textarea 
              v-model="strategyParamsText"
              rows="4"
              placeholder='例如: {"period": 20, "atr_period": 20}'
            ></textarea>
          </div>

          <div v-if="createError" class="error-message">
            {{ createError }}
          </div>
        </div>

        <div class="modal-footer">
          <button class="cancel-btn" @click="showCreateModal = false">取消</button>
          <button class="submit-btn" @click="createTask" :disabled="creating">
            {{ creating ? '创建中...' : '创建任务' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 结果查看模态框 -->
    <div v-if="showResultModal" class="modal" @click.self="showResultModal = false">
      <div class="modal-content large">
        <div class="modal-header">
          <h3>回测结果 - {{ selectedTask?.symbol }}</h3>
          <button class="close-btn" @click="showResultModal = false">✕</button>
        </div>
        
        <div class="modal-body">
          <div v-if="loadingResult" class="loading">加载结果中...</div>
          
          <div v-else-if="result" class="result-content">
            <!-- 关键指标雷达图 -->
            <div class="metrics-section">
              <MetricsRadarChart :metrics="result.metrics" />
            </div>

            <!-- 关键指标卡片 -->
            <div class="metrics-section">
              <h4>📊 关键指标</h4>
              <div class="metrics-grid">
                <div class="metric-card">
                  <div class="metric-label">总收益</div>
                  <div class="metric-value" :class="calculateTotalProfit() >= 0 ? 'positive' : 'negative'">
                    {{ formatCurrency(calculateTotalProfit()) }}
                  </div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">总收益率</div>
                  <div class="metric-value" :class="result.metrics.total_return >= 0 ? 'positive' : 'negative'">
                    {{ formatPercent(result.metrics.total_return) }}
                  </div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">夏普比率</div>
                  <div class="metric-value">{{ result.metrics.sharpe_ratio?.toFixed(2) || 'N/A' }}</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">最大回撤</div>
                  <div class="metric-value negative">{{ formatPercent(result.metrics.max_drawdown) }}</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">胜率</div>
                  <div class="metric-value">{{ formatPercent(result.metrics.win_rate) }}</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">交易次数</div>
                  <div class="metric-value">{{ result.metrics.total_trades || 0 }}</div>
                </div>
              </div>
            </div>

            <!-- 交易记录 -->
            <div class="trades-section">
              <h4>📝 交易记录 (最近20条)</h4>
              <div class="table-wrapper">
                <table class="trades-table">
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>操作</th>
                      <th>价格</th>
                      <th>数量</th>
                      <th>手续费</th>
                      <th>盈亏</th>
                      <th>累计盈亏</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(trade, idx) in result.trades.slice(0, 20)" :key="idx">
                      <td>{{ trade.datetime }}</td>
                      <td>
                        <span class="trade-action" :class="trade.action">
                          {{ trade.action === 'buy' ? '买入' : '卖出' }}
                        </span>
                      </td>
                      <td>{{ trade.price.toFixed(2) }}</td>
                      <td>{{ trade.quantity }}</td>
                      <td>{{ trade.commission.toFixed(2) }}</td>
                      <td :class="trade.pnl >= 0 ? 'positive' : 'negative'">
                        {{ trade.pnl.toFixed(2) }}
                      </td>
                      <td :class="trade.cumulative_pnl >= 0 ? 'positive' : 'negative'">
                        {{ trade.cumulative_pnl.toFixed(2) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- 净值曲线 -->
            <div class="equity-section">
              <h4>📈 净值曲线</h4>
              <EquityCurveChart 
                v-if="result.equity_curve && result.equity_curve.length > 0"
                :equity-curve="result.equity_curve"
                :initial-cash="selectedTask?.initial_cash || 1000000"
              />
              <div v-else class="empty">暂无净值数据</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import EquityCurveChart from './EquityCurveChart.vue'
import MetricsRadarChart from './MetricsRadarChart.vue'

export default {
  name: 'BacktestManager',
  components: {
    EquityCurveChart,
    MetricsRadarChart
  },
  setup() {
    const API_BASE = import.meta.env.VITE_API_BASE || '/api'
    
    // State
    const tasks = ref([])
    const loading = ref(false)
    const statusFilter = ref('')
    
    const showCreateModal = ref(false)
    const newTask = ref({
      symbol: '',
      strategy_key: '',
      start_date: '',
      end_date: '',
      initial_cash: 1000000,
      strategy_params: {}
    })
    const strategyParamsText = ref('{}')
    const creating = ref(false)
    const createError = ref('')
    const normalizedSymbol = ref('')
    
    const showResultModal = ref(false)
    const selectedTask = ref(null)
    const result = ref(null)
    const loadingResult = ref(false)

    // Methods
    const normalizeSymbol = () => {
      if (!newTask.value.symbol) {
        normalizedSymbol.value = ''
        return
      }
      
      let symbol = newTask.value.symbol.trim().toUpperCase()
      
      // 如果已经带有后缀，直接使用
      if (symbol.includes('.')) {
        normalizedSymbol.value = symbol
        return
      }
      
      // 根据代码开头自动补全后缀
      if (symbol.startsWith('6')) {
        // 6开头是上海主板
        normalizedSymbol.value = symbol + '.SH'
      } else if (symbol.startsWith('0') || symbol.startsWith('3')) {
        // 0和3开头是深圳
        normalizedSymbol.value = symbol + '.SZ'
      } else if (symbol.startsWith('8') || symbol.startsWith('4')) {
        // 8和4开头是北交所
        normalizedSymbol.value = symbol + '.BJ'
      } else {
        // 其他情况，默认不加后缀
        normalizedSymbol.value = symbol
      }
    }
    
    const loadTasks = async () => {
      loading.value = true
      try {
        const token = localStorage.getItem('access_token')
        const url = statusFilter.value 
          ? `${API_BASE}/backtest/tasks?status=${statusFilter.value}`
          : `${API_BASE}/backtest/tasks`
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (!response.ok) throw new Error('Failed to load tasks')
        
        tasks.value = await response.json()
      } catch (error) {
        console.error('Error loading tasks:', error)
        alert('加载任务列表失败')
      } finally {
        loading.value = false
      }
    }

    const createTask = async () => {
      createError.value = ''
      
      // Validate
      if (!newTask.value.symbol || !newTask.value.strategy_key || 
          !newTask.value.start_date || !newTask.value.end_date) {
        createError.value = '请填写所有必填字段'
        return
      }
      
      // Normalize symbol before submitting
      normalizeSymbol()
      if (!normalizedSymbol.value) {
        createError.value = '股票代码格式不正确'
        return
      }

      // Parse strategy params
      try {
        newTask.value.strategy_params = JSON.parse(strategyParamsText.value)
      } catch (e) {
        createError.value = '策略参数JSON格式错误'
        return
      }

      creating.value = true
      try {
        const token = localStorage.getItem('access_token')
        
        // Use normalized symbol
        const taskData = {
          ...newTask.value,
          symbol: normalizedSymbol.value
        }
        
        const response = await fetch(`${API_BASE}/backtest/tasks`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(taskData)
        })
        
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.detail || 'Failed to create task')
        }
        
        showCreateModal.value = false
        resetNewTask()
        await loadTasks()
      } catch (error) {
        createError.value = error.message
      } finally {
        creating.value = false
      }
    }

    const resetNewTask = () => {
      newTask.value = {
        symbol: '',
        strategy_key: '',
        start_date: '',
        end_date: '',
        initial_cash: 1000000,
        strategy_params: {}
      }
      strategyParamsText.value = '{}'
      normalizedSymbol.value = ''
    }

    const selectTask = (task) => {
      selectedTask.value = task
    }

    const viewResult = async (taskId) => {
      // 先找到对应的 task
      const task = tasks.value.find(t => t.task_id === taskId)
      if (task) {
        selectedTask.value = task
      }
      
      showResultModal.value = true
      loadingResult.value = true
      result.value = null
      
      try {
        const token = localStorage.getItem('access_token')
        const response = await fetch(`${API_BASE}/backtest/results/${taskId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (!response.ok) throw new Error('Failed to load result')
        
        result.value = await response.json()
        
        // 调试日志：查看后端返回的数据
        console.log('=== 回测结果调试信息 ===');
        console.log('Metrics:', result.value.metrics);
        console.log('Total Return:', result.value.metrics.total_return);
        console.log('Equity Curve Length:', result.value.equity_curve?.length);
        if (result.value.equity_curve && result.value.equity_curve.length > 0) {
          console.log('Initial Value:', result.value.equity_curve[0].value);
          console.log('Final Value:', result.value.equity_curve[result.value.equity_curve.length - 1].value);
          console.log('Initial Cash:', selectedTask.value?.initial_cash);
          const profit = result.value.equity_curve[result.value.equity_curve.length - 1].value - (selectedTask.value?.initial_cash || 1000000);
          console.log('Calculated Profit:', profit);
          console.log('Calculated Return:', profit / (selectedTask.value?.initial_cash || 1000000));
        }
        console.log('=========================');
      } catch (error) {
        console.error('Error loading result:', error)
        alert('加载结果失败')
        showResultModal.value = false
      } finally {
        loadingResult.value = false
      }
    }

    const cancelTask = async (taskId) => {
      if (!confirm('确定要取消这个任务吗？')) return
      
      try {
        const token = localStorage.getItem('access_token')
        const response = await fetch(`${API_BASE}/backtest/tasks/${taskId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (!response.ok) throw new Error('Failed to cancel task')
        
        await loadTasks()
      } catch (error) {
        console.error('Error cancelling task:', error)
        alert('取消任务失败')
      }
    }

    const deleteTask = async (taskId) => {
      if (!confirm('确定要删除这个任务吗？')) return
      
      try {
        const token = localStorage.getItem('access_token')
        const response = await fetch(`${API_BASE}/backtest/tasks/${taskId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (!response.ok) throw new Error('Failed to delete task')
        
        await loadTasks()
      } catch (error) {
        console.error('Error deleting task:', error)
        alert('删除任务失败')
      }
    }

    // Formatters
    const getStatusText = (status) => {
      const map = {
        pending: '等待中',
        claimed: '已认领',
        running: '运行中',
        completed: '已完成',
        failed: '失败',
        cancelled: '已取消'
      }
      return map[status] || status
    }

    const formatDate = (dateStr) => {
      if (!dateStr || dateStr.length !== 8) return dateStr
      return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
    }

    const formatDateTime = (datetimeStr) => {
      if (!datetimeStr) return ''
      const date = new Date(datetimeStr)
      return date.toLocaleString('zh-CN')
    }

    const formatCurrency = (value) => {
      if (value === null || value === undefined) return 'N/A'
      return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    const formatPercent = (value) => {
      if (value === null || value === undefined) return 'N/A'
      return `${(value * 100).toFixed(2)}%`
    }

    const calculateTotalProfit = () => {
      if (!result.value?.equity_curve || result.value.equity_curve.length === 0) return 0
      const initialCash = selectedTask.value?.initial_cash || 1000000
      const finalValue = result.value.equity_curve[result.value.equity_curve.length - 1]?.value || initialCash
      return finalValue - initialCash
    }

    // Lifecycle
    onMounted(() => {
      loadTasks()
    })

    return {
      tasks,
      loading,
      statusFilter,
      showCreateModal,
      newTask,
      strategyParamsText,
      creating,
      createError,
      normalizedSymbol,
      showResultModal,
      selectedTask,
      result,
      loadingResult,
      normalizeSymbol,
      loadTasks,
      createTask,
      selectTask,
      viewResult,
      cancelTask,
      deleteTask,
      getStatusText,
      formatDate,
      formatDateTime,
      formatCurrency,
      formatPercent,
      calculateTotalProfit
    }
  }
}
</script>

<style scoped>
.backtest-manager {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.header h2 {
  margin: 0;
  color: #2c3e50;
}

.create-btn {
  padding: 10px 20px;
  background: #409eff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.3s;
}

.create-btn:hover {
  background: #66b1ff;
}

.tasks-section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h3 {
  margin: 0;
  color: #2c3e50;
}

.filters {
  display: flex;
  gap: 10px;
}

.filters select {
  padding: 8px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
}

.refresh-btn {
  padding: 8px 16px;
  background: #f4f4f5;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.3s;
}

.refresh-btn:hover {
  background: #e9e9eb;
}

.loading, .empty {
  text-align: center;
  padding: 40px;
  color: #909399;
}

.tasks-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
}

.task-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s;
}

.task-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.task-title {
  display: flex;
  gap: 10px;
  align-items: center;
}

.symbol {
  font-size: 18px;
  font-weight: bold;
  color: #303133;
}

.strategy {
  font-size: 14px;
  color: #606266;
  background: #f4f4f5;
  padding: 2px 8px;
  border-radius: 4px;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-pending {
  background: #e6f7ff;
  color: #1890ff;
}

.status-claimed {
  background: #fff7e6;
  color: #fa8c16;
}

.status-running {
  background: #e6fffb;
  color: #13c2c2;
}

.status-completed {
  background: #f6ffed;
  color: #52c41a;
}

.status-failed {
  background: #fff1f0;
  color: #f5222d;
}

.status-cancelled {
  background: #f5f5f5;
  color: #8c8c8c;
}

.task-details {
  margin-bottom: 12px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
}

.detail-item .label {
  color: #909399;
}

.detail-item .value {
  color: #606266;
}

.task-actions {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.task-actions button {
  flex: 1;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: opacity 0.3s;
}

.task-actions button:hover {
  opacity: 0.8;
}

.view-btn {
  background: #409eff;
  color: white;
}

.cancel-btn {
  background: #f56c6c;
  color: white;
}

.delete-btn {
  background: #909399;
  color: white;
}

/* Modal Styles */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-content.large {
  max-width: 1000px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e4e7ed;
}

.modal-header h3 {
  margin: 0;
  color: #2c3e50;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #909399;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  line-height: 1;
}

.close-btn:hover {
  color: #606266;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  color: #606266;
  font-size: 14px;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #409eff;
}

.form-group .hint {
  display: block;
  margin-top: 4px;
  color: #409eff;
  font-size: 12px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.error-message {
  padding: 10px;
  background: #fef0f0;
  color: #f56c6c;
  border-radius: 4px;
  font-size: 13px;
  margin-top: 10px;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid #e4e7ed;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.modal-footer .cancel-btn {
  padding: 10px 20px;
  background: white;
  color: #606266;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
}

.modal-footer .submit-btn {
  padding: 10px 20px;
  background: #409eff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.modal-footer .submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Result Styles */
.result-content {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.metrics-section h4,
.trades-section h4,
.equity-section h4 {
  margin: 0 0 16px 0;
  color: #2c3e50;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.metric-card {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  text-align: center;
}

.metric-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}

.metric-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}

.metric-value.positive {
  color: #67c23a;
}

.metric-value.negative {
  color: #f56c6c;
}

.table-wrapper {
  overflow-x: auto;
}

.trades-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.trades-table th {
  background: #f4f4f5;
  padding: 10px;
  text-align: left;
  font-weight: 500;
  color: #606266;
  border-bottom: 2px solid #e4e7ed;
}

.trades-table td {
  padding: 10px;
  border-bottom: 1px solid #f0f0f0;
}

.trade-action {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.trade-action.buy {
  background: #f0f9ff;
  color: #1890ff;
}

.trade-action.sell {
  background: #fff1f0;
  color: #f5222d;
}

.trades-table .positive {
  color: #67c23a;
}

.trades-table .negative {
  color: #f56c6c;
}

.equity-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
}

.equity-section h4 {
  margin: 0 0 16px 0;
  color: #2c3e50;
}

.equity-section .empty {
  text-align: center;
  padding: 40px;
  color: #909399;
}
</style>
