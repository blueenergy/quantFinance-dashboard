<template>
  <div class="entitlements-matrix">
    <h3>权益配置矩阵</h3>
    <p class="matrix-intro">
      按<strong>大类 → 功能模块 → Tab/页内操作</strong>分组。每个主导航模块第一行为 <strong>导航 Tab</strong>，其后为页内能力；
      <strong>子项继承父级 Tab</strong>：若某等级用户看不到该 Tab，则子操作对该用户不生效（运行时将以父级可见性为先）。
      <strong>继承默认</strong>表示矩阵暂不覆盖、仍按当前线上逻辑（自选股深度分析在「继承」时使用原配额：非 VIP 2 次/周等）。
      保存写入 <code>app_settings.entitlements_matrix</code>；其中 <strong>深度分析（自选股）</strong> 的「允许点击 + 周上限」已接入接口校验。
    </p>

    <div v-if="loadError" class="msg err">{{ loadError }}</div>
    <div v-else-if="!ready" class="msg">加载中…</div>
    <template v-else>
      <div
        v-for="cat in categories"
        :key="cat.category_id"
        class="category-block"
      >
        <h4 class="category-title">{{ cat.title }}</h4>
        <p v-if="cat.hint" class="category-hint">{{ cat.hint }}</p>

        <div
          v-for="sec in cat.sections"
          :key="sec.section_id"
          class="section-block"
        >
          <div class="section-head">
            <span class="section-title">{{ sec.title }}</span>
            <span v-if="sec.description" class="section-desc">{{ sec.description }}</span>
          </div>
          <div class="matrix-scroll">
            <table class="matrix-table">
              <thead>
                <tr>
                  <th class="col-feature">功能</th>
                  <th class="col-type">类型</th>
                  <th v-for="t in tierColumns" :key="sec.section_id + '-' + t.key" class="col-tier">{{ t.label }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in sec.rows"
                  :key="row.key"
                  :class="{ 'row-child': !!row.parent_nav_key }"
                >
                  <td class="col-feature">
                    <span class="feat-label">{{ row.label }}</span>
                    <span v-if="row.inherit_note" class="inherit-note">{{ row.inherit_note }}</span>
                  </td>
                  <td class="col-type">{{ row.row_type === 'tab' ? '导航 Tab' : '页内操作' }}</td>
                  <td v-for="t in tierColumns" :key="row.key + '-' + t.key" class="col-tier">
                    <template v-if="row.row_type === 'tab'">
                      <select
                        v-model="cells[row.key][t.key].visibility"
                        class="cell-select"
                      >
                        <option value="inherit">继承默认</option>
                        <option value="hidden">矩阵隐藏</option>
                        <option value="visible">矩阵可见</option>
                      </select>
                    </template>
                    <template v-else>
                      <select
                        v-model="cells[row.key][t.key].click"
                        class="cell-select"
                      >
                        <option value="inherit">继承默认</option>
                        <option value="blocked">禁止点击</option>
                        <option value="allowed">允许点击</option>
                      </select>
                      <div
                        v-if="cells[row.key][t.key].click === 'allowed'"
                        class="weekly-wrap"
                      >
                        <label>周上限</label>
                        <input
                          v-model.number="cells[row.key][t.key].weekly_limit"
                          type="number"
                          min="0"
                          step="1"
                          placeholder="空=不限"
                          class="weekly-input"
                        >
                      </div>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="matrix-actions">
        <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
          {{ saving ? '保存中…' : '保存矩阵' }}
        </button>
        <button type="button" class="btn btn-secondary" :disabled="saving" @click="reload">
          重新加载
        </button>
      </div>
      <div v-if="saveMsg" :class="['msg', saveOk ? 'ok' : 'err']">{{ saveMsg }}</div>
    </template>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import request from '../utils/request'

const TIER_LABELS = {
  free: '免费',
  basic: '基础',
  vip: 'VIP',
  premium: '专业',
}

export default {
  name: 'EntitlementsMatrix',
  setup() {
    const ready = ref(false)
    const loadError = ref('')
    const saveMsg = ref('')
    const saveOk = ref(false)
    const saving = ref(false)
    const registry = ref([])
    const categories = ref([])
    const cells = reactive({})

    const tierColumns = ref([])

    function deepCloneCells(src) {
      const out = {}
      for (const [k, tierMap] of Object.entries(src || {})) {
        out[k] = {}
        for (const [tier, c] of Object.entries(tierMap)) {
          if (c.visibility !== undefined) {
            out[k][tier] = { visibility: c.visibility || 'inherit' }
          } else {
            out[k][tier] = {
              click: c.click || 'inherit',
              weekly_limit:
                c.weekly_limit === undefined || c.weekly_limit === ''
                  ? null
                  : Number(c.weekly_limit),
            }
          }
        }
      }
      return out
    }

    function hydrateReactive(from) {
      Object.keys(cells).forEach((k) => delete cells[k])
      for (const [k, tierMap] of Object.entries(from)) {
        cells[k] = {}
        for (const [tier, c] of Object.entries(tierMap)) {
          if (c.visibility !== undefined) {
            cells[k][tier] = reactive({
              visibility: c.visibility || 'inherit',
            })
          } else {
            cells[k][tier] = reactive({
              click: c.click || 'inherit',
              weekly_limit:
                c.weekly_limit === null || c.weekly_limit === undefined
                  ? null
                  : c.weekly_limit,
            })
          }
        }
      }
    }

    function payloadFromCells() {
      const out = {}
      for (const row of registry.value) {
        out[row.key] = {}
        for (const t of tierColumns.value) {
          const c = cells[row.key]?.[t.key]
          if (!c) continue
          if (row.row_type === 'tab') {
            out[row.key][t.key] = { visibility: c.visibility }
          } else {
            let wl = null
            if (c.click === 'allowed') {
              const n = Number(c.weekly_limit)
              if (Number.isFinite(n) && n >= 0) {
                wl = Math.floor(n)
              }
            }
            out[row.key][t.key] = {
              click: c.click,
              weekly_limit: wl,
            }
          }
        }
      }
      return out
    }

    async function load() {
      loadError.value = ''
      ready.value = false
      saveMsg.value = ''
      try {
        const body = await request({
          method: 'get',
          url: '/admin/entitlements-matrix',
        })
        if (!body.success || !body.data?.registry || !body.data?.categories) {
          loadError.value = '响应格式异常'
          return
        }
        registry.value = body.data.registry
        categories.value = body.data.categories
        tierColumns.value = (body.data.tiers || []).map((key) => ({
          key,
          label: TIER_LABELS[key] || key,
        }))
        const merged = deepCloneCells(body.data.cells)
        hydrateReactive(merged)
        ready.value = true
      } catch (e) {
        if (e.response?.status) {
          loadError.value = `加载失败 (${e.response.status})`
        } else {
          loadError.value = e.message || '加载失败'
        }
      }
    }

    async function save() {
      saveMsg.value = ''
      saving.value = true
      try {
        const body = await request({
          method: 'put',
          url: '/admin/entitlements-matrix',
          data: { cells: payloadFromCells() },
        })
        if (!body.success) {
          saveOk.value = false
          saveMsg.value = body.message || '保存失败'
          return
        }
        saveOk.value = true
        saveMsg.value = '已保存。自选股「深度分析」已按本矩阵生效；其它项将逐步接入运行时。'
        if (body.data?.cells) hydrateReactive(deepCloneCells(body.data.cells))
      } catch (e) {
        saveOk.value = false
        const data = e.response?.data || {}
        saveMsg.value =
          (typeof data.detail === 'string' ? data.detail : null) ||
          data.message ||
          (e.response?.status ? `保存失败 (${e.response.status})` : null) ||
          e.message ||
          '保存失败'
      } finally {
        saving.value = false
      }
    }

    async function reload() {
      await load()
    }

    onMounted(() => {
      load()
    })

    return {
      ready,
      loadError,
      registry,
      categories,
      cells,
      tierColumns,
      saving,
      saveMsg,
      saveOk,
      save,
      reload,
    }
  },
}
</script>

<style scoped>
.entitlements-matrix {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid #e0e0e0;
}

.entitlements-matrix h3 {
  margin-top: 0;
  color: #1a1a2e;
}

.matrix-intro {
  font-size: 13px;
  color: #555;
  line-height: 1.55;
  margin-bottom: 16px;
  max-width: 960px;
}

.matrix-scroll {
  overflow-x: auto;
  margin-bottom: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fff;
}

.matrix-table {
  border-collapse: collapse;
  min-width: 920px;
  font-size: 13px;
}

.matrix-table th,
.matrix-table td {
  border: 1px solid #e8e8e8;
  padding: 8px 10px;
  vertical-align: top;
}

.matrix-table thead th {
  background: #f0f4f8;
  font-weight: 600;
  text-align: left;
  position: sticky;
  top: 0;
  z-index: 1;
}

.col-feature {
  min-width: 200px;
  max-width: 260px;
  position: sticky;
  left: 0;
  background: #fafbfc;
  z-index: 2;
  box-shadow: 2px 0 4px rgba(0, 0, 0, 0.04);
}

.matrix-table thead .col-feature {
  z-index: 3;
  background: #e8eef4;
}

.col-type {
  white-space: nowrap;
  color: #666;
  width: 88px;
}

.col-tier {
  min-width: 148px;
}

.feat-label {
  display: block;
  font-weight: 500;
  color: #222;
}

.category-block {
  margin-bottom: 28px;
}

.category-title {
  margin: 0 0 6px;
  font-size: 16px;
  color: #1a1a2e;
  border-left: 4px solid #007bff;
  padding-left: 10px;
}

.category-hint {
  margin: 0 0 16px;
  font-size: 12px;
  color: #666;
  line-height: 1.5;
  max-width: 960px;
}

.section-block {
  margin-bottom: 20px;
}

.section-head {
  margin-bottom: 8px;
}

.section-title {
  font-weight: 600;
  font-size: 14px;
  color: #333;
  margin-right: 8px;
}

.section-desc {
  font-size: 12px;
  color: #888;
}

.row-child .col-feature {
  padding-left: 22px !important;
  background: #f5f7fa;
}

.row-child .feat-label::before {
  content: '└ ';
  color: #94a3b8;
  font-weight: normal;
}

.inherit-note {
  display: block;
  font-size: 11px;
  color: #64748b;
  line-height: 1.4;
  margin-top: 4px;
}

.cell-select {
  width: 100%;
  max-width: 130px;
  padding: 4px 6px;
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid #ccc;
}

.weekly-wrap {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.weekly-wrap label {
  font-size: 11px;
  color: #666;
}

.weekly-input {
  width: 100%;
  max-width: 88px;
  padding: 4px 6px;
  font-size: 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.matrix-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-primary {
  background: #007bff;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: #fff;
}

.btn-secondary:hover:not(:disabled) {
  background: #545b62;
}

.btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.msg {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 4px;
  font-size: 13px;
}

.msg.ok {
  background: #e9f7ef;
  border: 1px solid #28a745;
  color: #155724;
}

.msg.err {
  background: #fdecea;
  border: 1px solid #e74c3c;
  color: #c0392b;
}
</style>
