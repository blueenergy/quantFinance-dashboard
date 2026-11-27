<template>
  <div class="hot-topic-tree">
    <!-- 工具条 -->
    <div class="tree-toolbar">
      <v-chip-group v-model="mode" mandatory density="compact" selected-class="text-primary">
        <v-chip size="small" variant="outlined" value="auto">自动</v-chip>
        <v-chip size="small" variant="outlined" value="eod">收盘定稿</v-chip>
        <v-chip size="small" variant="outlined" value="intraday">盘中</v-chip>
      </v-chip-group>

      <div class="tree-stats">
        <v-chip v-if="stats.total_limit_up" size="x-small" variant="tonal" color="primary">
          涨停 {{ stats.total_limit_up }}
        </v-chip>
        <v-chip v-if="stats.max_streak" size="x-small" variant="tonal" color="secondary">
          最高 {{ stats.max_streak }} 板
        </v-chip>
        <v-chip v-if="stats.sentiment_score" size="x-small" variant="tonal" color="warning">
          情绪分 {{ stats.sentiment_score }}
        </v-chip>
        <v-chip v-if="stats.promotion_rate_1to2 != null" size="x-small" variant="tonal">
          首板晋级 {{ (stats.promotion_rate_1to2 * 100).toFixed(1) }}%
        </v-chip>
      </div>

      <v-spacer />

      <span class="tree-meta">
        <template v-if="resolvedMode === 'eod'">东方财富概念口径 · 收盘定稿</template>
        <template v-else>申万行业口径 · 盘中快照</template>
        <template v-if="tradeDate"> · {{ formatDate(tradeDate) }}</template>
      </span>
      <v-btn size="x-small" variant="text" :loading="loading" @click="load">刷新</v-btn>
    </div>

    <v-alert v-if="fallbackReason" type="info" variant="tonal" density="compact" class="mb-2">
      {{ fallbackReason }}
    </v-alert>

    <!-- 加载 / 错误 / 空 -->
    <div v-if="loading" class="tree-state">
      <v-progress-circular indeterminate color="primary" size="40" />
      <span class="text-caption mt-2">加载题材树…</span>
    </div>
    <v-alert v-else-if="error" type="error" variant="tonal" density="compact">{{ error }}</v-alert>
    <div v-else-if="!branches.length" class="tree-state">
      <v-icon icon="mdi-tree-outline" size="34" color="grey" />
      <span class="text-caption mt-2">当日暂无题材树数据</span>
    </div>

    <!-- 树 -->
    <div v-else class="tree-scroll">
      <div class="tree-canvas" :style="{ height: layout.height + 'px', width: layout.width + 'px' }">
        <svg class="tree-links" :width="layout.width" :height="layout.height">
          <path
            v-for="(link, i) in layout.links"
            :key="i"
            :d="link.d"
            :stroke="link.color"
            :stroke-width="link.width || 2"
            fill="none"
          />
        </svg>

        <!-- 根 -->
        <div class="tree-node tree-root" :style="{ left: '0px', top: layout.rootY + 'px' }">
          热点题材
        </div>

        <!-- 分支 -->
        <div
          v-for="(br, i) in layout.branches"
          :key="`br-${i}`"
          class="tree-node tree-branch"
          :style="{ left: COL.br + 'px', top: br.y + 'px', background: br.color }"
        >
          {{ br.name }}
        </div>

        <!-- 叶子 + 事件 -->
        <template v-for="(row, i) in layout.rows" :key="`row-${i}`">
          <div
            class="tree-node tree-leaf"
            :style="{
              left: COL.leaf + 'px',
              top: row.nodeY + 'px',
              width: COL.leafW + 'px',
              background: row.tintBg,
              borderColor: row.tintBorder,
            }"
          >
            <span class="leaf-name">{{ row.name }}</span>
            <span class="leaf-meta">{{ row.meta }}</span>
          </div>

          <div
            v-for="(ev, j) in row.events"
            :key="`ev-${i}-${j}`"
            class="tree-node tree-event"
            :style="{ left: COL.ev + 'px', top: (row.evY + j * EV_STEP) + 'px', background: row.color }"
          >
            <b>{{ ev.date }}</b> {{ ev.title }}
          </div>

          <div
            v-if="row.events.length"
            class="tree-fact"
            :style="{ left: COL.ev + 'px', top: (row.evY + row.events.length * EV_STEP + 4) + 'px' }"
          >
            {{ row.factsText }}
          </div>
          <div
            v-else
            class="tree-node tree-event tree-fact-ghost"
            :style="{ left: COL.ev + 'px', top: row.evY + 'px' }"
          >
            {{ row.factsText }}
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { getHotTopicTree } from '../api/sectorConcept'

const props = defineProps({
  date: { type: String, default: '' },
})

const mode = ref('auto')
const loading = ref(false)
const error = ref('')
const branches = ref([])
const stats = ref({})
const meta = ref({})
const tradeDate = ref('')
const fallbackReason = ref('')
const initialized = ref(false)

const COL = { br: 210, brW: 104, leaf: 388, leafW: 156, ev: 596 }
const EV_H = 24
const EV_STEP = 28
const NODE_H = 46
const ROOT_W = 120

const PALETTE = {
  电子: '#e53935', 计算机: '#fb8c00', 国防军工: '#2e9e4f', 机械设备: '#1e88e5',
  基础化工: '#8e24aa', 有色金属: '#d81b60', 电力设备: '#00acc1', 农林牧渔: '#8d6e63',
  环保: '#7cb342', 汽车: '#5e35b1', 通信: '#00897b', 石油石化: '#5d4037',
  非银金融: '#c0ca33', 建筑装饰: '#78909c', 传媒: '#ec407a', 家用电器: '#42a5f5',
  轻工制造: '#8d6e63', 医药生物: '#26a69a', 食品饮料: '#ab47bc', 银行: '#7e57c2',
  煤炭: '#546e7a', 商贸零售: '#ffa726', 公用事业: '#0097a7', 交通运输: '#66bb6a',
  钢铁: '#78909c', 房地产: '#bdbdbd', 建筑材料: '#a1887f', 社会服务: '#d81b60',
  纺织服饰: '#e57373', 美容护理: '#f06292', 综合: '#90a4ae', 未分类: '#78909c',
}

const resolvedMode = computed(() => meta.value?.mode || 'intraday')

function tint(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function formatDate(v) {
  const s = String(v || '')
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return s
}

const layout = computed(() => {
  const list = branches.value || []
  const rows = []
  const branchBlocks = []
  const links = []
  let y = 12

  list.forEach((br, bi) => {
    const color = PALETTE[br.name] || '#546e7a'
    const blockY = y
    const kids = br.children || []
    kids.forEach((k) => {
      const events = k.events || []
      const nEvents = Math.max(events.length, 1)
      const contentH = 4 + nEvents * EV_STEP + (events.length ? EV_H + 6 : 0)
      const facts = (k.facts || []).filter(Boolean)
      rows.push({
        ...k,
        color,
        tintBg: tint(color, 0.16),
        tintBorder: tint(color, 0.5),
        evY: y,
        contentH,
        nodeY: y + contentH / 2 - NODE_H / 2,
        meta: `${k.limit_up_count ?? 0}涨停 · 最高${k.max_streak || 1}板${
          k.broken_count ? ` · 炸${k.broken_count}` : ''
        }${k.pct_change != null ? ` · ${k.pct_change > 0 ? '+' : ''}${k.pct_change.toFixed(1)}%` : ''}`,
        factsText: facts.join(' ｜ '),
      })
      y += contentH + 10
    })
    const blockH = y - blockY
    branchBlocks.push({ name: br.name, color, y: blockY + blockH / 2 - 20, h: blockH })
    y += 28
  })

  const height = y + 20
  const rootY = height / 2 - 24
  const trunkX = ROOT_W + 26

  // 根 -> 主干
  links.push({
    d: `M ${ROOT_W} ${rootY + 24} L ${trunkX} ${rootY + 24}`,
    color: '#37474f',
    width: 2.5,
  })
  if (branchBlocks.length) {
    links.push({
      d: `M ${trunkX} ${branchBlocks[0].y + 20} L ${trunkX} ${branchBlocks[branchBlocks.length - 1].y + 20}`,
      color: '#37474f',
      width: 2.5,
    })
  }
  // 主干 -> 分支
  branchBlocks.forEach((br) => {
    links.push({
      d: `M ${trunkX} ${br.y + 20} C ${trunkX + 34} ${br.y + 20}, ${COL.br - 34} ${br.y + 20}, ${COL.br} ${br.y + 20}`,
      color: br.color,
      width: 2.5,
    })
  })
  // 叶子 -> 事件
  rows.forEach((row) => {
    const ny = row.nodeY + NODE_H / 2
    links.push({
      d: `M ${COL.leaf + COL.leafW} ${ny} C ${COL.leaf + COL.leafW + 30} ${ny}, ${COL.ev - 30} ${row.evY + EV_H / 2}, ${COL.ev} ${row.evY + EV_H / 2}`,
      color: row.color,
      width: 2,
    })
    for (let j = 1; j < row.events.length; j++) {
      const ey = row.evY + j * EV_STEP
      links.push({
        d: `M ${COL.ev + 10} ${ey - 3} L ${COL.ev + 10} ${ey + EV_H}`,
        color: row.color,
        width: 1.5,
      })
    }
  })

  return {
    rows,
    branches: branchBlocks,
    links,
    height,
    rootY,
    width: 1180,
  }
})

async function load() {
  loading.value = true
  error.value = ''
  fallbackReason.value = ''
  try {
    const res = await getHotTopicTree(mode.value, props.date || null)
    if (!res?.success) {
      branches.value = []
      stats.value = {}
      error.value = res?.error || '加载失败'
      return
    }
    branches.value = res.branches || []
    stats.value = res.stats || {}
    meta.value = res.meta || {}
    tradeDate.value = res.trade_date || ''
    fallbackReason.value = res.fallback_reason || ''
  } catch (e) {
    error.value = `加载题材树失败: ${e.message}`
  } finally {
    loading.value = false
  }
}

watch(mode, () => {
  if (initialized.value) load()
})

watch(() => props.date, () => {
  if (initialized.value) load()
})

onMounted(async () => {
  initialized.value = true
  await load()
})
</script>

<style scoped>
.hot-topic-tree {
  width: 100%;
}

.tree-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.tree-stats {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tree-meta {
  font-size: 12px;
  color: var(--text-muted, #78909c);
}

.tree-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 34px 0;
}

.tree-scroll {
  overflow-x: auto;
  overflow-y: hidden;
}

.tree-canvas {
  position: relative;
  min-width: 1180px;
}

.tree-links {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
}

.tree-node {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-weight: 700;
}

.tree-root {
  left: 0;
  width: 120px;
  height: 48px;
  background: #1b1b3d;
  color: #fff;
  font-size: 17px;
  letter-spacing: 1px;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);
}

.tree-branch {
  width: 104px;
  height: 40px;
  color: #fff;
  font-size: 16px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.14);
}

.tree-leaf {
  height: 46px;
  flex-direction: column;
  color: #263238;
  font-size: 14px;
  line-height: 1.2;
  border: 1.5px solid transparent;
}

.leaf-name {
  font-weight: 700;
}

.leaf-meta {
  font-size: 10.5px;
  font-weight: 500;
  color: #546e7a;
  margin-top: 2px;
}

.tree-event {
  height: 24px;
  padding: 0 10px;
  border-radius: 5px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  justify-content: flex-start;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}

.tree-event b {
  font-weight: 800;
  margin-right: 5px;
  opacity: 0.95;
}

.tree-fact-ghost {
  background: #eceff1 !important;
  color: #78909c;
  font-weight: 500;
  font-size: 11px;
  box-shadow: none;
}

.tree-fact {
  position: absolute;
  font-size: 11px;
  color: #78909c;
  white-space: nowrap;
  background: #eceff1;
  border-radius: 5px;
  padding: 3px 8px;
}
</style>
