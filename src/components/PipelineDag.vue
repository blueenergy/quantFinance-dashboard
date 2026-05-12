<script setup>
import { computed } from 'vue'
import { VueFlow, Handle, Position, MarkerType } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/controls/dist/style.css'

const props = defineProps({
  dagData:     { type: Object,   default: null },
  statusColor: { type: Function, required: true },
  fmtBj:       { type: Function, required: true },
})
const emit = defineEmits(['nodeClick'])

// ── Layout constants ──────────────────────────────────────────────────────────
const GROUP_ORDER = ['probe', 'layer0', 'layer1', 'layer2', 'layer3']
const GROUP_X     = { probe: 0, layer0: 240, layer1: 480, layer2: 720, layer3: 960 }
const NODE_W = 148, NODE_H = 50, GAP_Y = 84

// ── Position helpers ──────────────────────────────────────────────────────────
function medianY(nodeId, posById, sourcesOf) {
  const ys = (sourcesOf[nodeId] || []).map(id => posById[id]?.y).filter(y => y != null)
  if (!ys.length) return 0
  ys.sort((a, b) => a - b)
  return ys[Math.floor(ys.length / 2)]
}

// ── Nodes ─────────────────────────────────────────────────────────────────────
const vfNodes = computed(() => {
  if (!props.dagData?.nodes) return []
  const { nodes, edges } = props.dagData

  const byGroup = {}
  for (const n of nodes) {
    const g = n.group || 'layer0'
    ;(byGroup[g] = byGroup[g] || []).push(n)
  }

  const groupIdx  = Object.fromEntries(GROUP_ORDER.map((g, i) => [g, i]))
  const groupById = Object.fromEntries(nodes.map(n => [n.id, n.group || 'layer0']))

  // Reverse-edge map: target → [sources]
  const sourcesOf = {}
  for (const e of edges) {
    ;(sourcesOf[e.target] = sourcesOf[e.target] || []).push(e.source)
  }

  // L0: probe-triggered nodes float to the top for cleaner fan edges
  if (byGroup['layer0']) {
    byGroup['layer0'].sort((a, b) => {
      const aP = (sourcesOf[a.id] || []).some(s => groupById[s] === 'probe') ? 0 : 1
      const bP = (sourcesOf[b.id] || []).some(s => groupById[s] === 'probe') ? 0 : 1
      return aP - bP
    })
  }

  // Assign Y left-to-right; L1+ sorted by median source Y to minimise crossings
  const posById = {}
  for (const g of GROUP_ORDER) {
    const layerNodes = byGroup[g] || []
    if (!layerNodes.length) continue
    if (groupIdx[g] >= 2) {
      layerNodes.sort((a, b) => medianY(a.id, posById, sourcesOf) - medianY(b.id, posById, sourcesOf))
    }
    layerNodes.forEach((n, i) => {
      posById[n.id] = { x: GROUP_X[g] ?? 0, y: i * (NODE_H + GAP_Y) }
    })
  }

  // Centre probe node at average Y of its direct L0 targets
  if (byGroup['probe']?.length === 1) {
    const pid = byGroup['probe'][0].id
    const ys = edges.filter(e => e.source === pid).map(e => posById[e.target]?.y).filter(y => y != null)
    if (ys.length) posById[pid] = { ...posById[pid], y: ys.reduce((s, y) => s + y, 0) / ys.length }
  }

  return nodes.map(n => ({
    id:       n.id,
    type:     n.group === 'probe' ? 'probe' : 'pipeline',
    position: posById[n.id] || { x: 0, y: 0 },
    data:     n,
  }))
})

// ── Edges ─────────────────────────────────────────────────────────────────────
const vfEdges = computed(() => {
  if (!props.dagData?.edges) return []
  const statusById = Object.fromEntries(props.dagData.nodes.map(n => [n.id, n.status]))
  return props.dagData.edges.map(e => {
    const color = props.statusColor(statusById[e.source]) || '#bbb'
    return {
      id:        `e_${e.source}_${e.target}`,
      source:    e.source,
      target:    e.target,
      type:      'smoothstep',
      style:     { stroke: color, strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
    }
  })
})
</script>

<template>
  <div class="pdg-wrap">
    <VueFlow
      v-if="dagData?.nodes?.length"
      :nodes="vfNodes"
      :edges="vfEdges"
      fit-view-on-init
      :nodes-draggable="false"
      :nodes-connectable="false"
      :zoom-on-double-click="false"
      @node-click="(e) => emit('nodeClick', e.node.data)"
    >
      <Background color="#d0d0d0" :gap="28" />
      <Controls :show-interactive="false" />

      <!-- Regular pipeline node -->
      <template #node-pipeline="{ data }">
        <Handle type="target" :position="Position.Left" class="pdg-handle" />
        <div
          class="pdg-node"
          :class="{ 'pdg-node--trigger': data.trigger_on_complete }"
          :style="{ background: statusColor(data.status), width: NODE_W + 'px', height: NODE_H + 'px' }"
          :title="data.label"
        >{{ data.label }}</div>
        <Handle type="source" :position="Position.Right" class="pdg-handle" />
      </template>

      <!-- Probe node — diamond-ish rounded, source-only -->
      <template #node-probe="{ data }">
        <div
          class="pdg-node pdg-node--probe"
          :style="{ background: statusColor(data.status), width: NODE_W + 'px', height: NODE_H + 'px' }"
          :title="data.label"
        >{{ data.label }}</div>
        <Handle type="source" :position="Position.Right" class="pdg-handle" />
      </template>
    </VueFlow>

    <div v-else class="pdg-empty">暂无数据</div>
  </div>
</template>

<style scoped>
.pdg-wrap {
  width: 100%;
  height: 820px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
  background: #fafafa;
}

.pdg-node {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  border-radius: 6px;
  border: 1.5px solid rgba(255, 255, 255, 0.25);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  padding: 0 8px;
  box-sizing: border-box;
  cursor: pointer;
  line-height: 1.35;
  box-shadow: 0 1px 3px rgba(0,0,0,0.18);
}

/* Nodes auto-triggered by dispatcher get a subtle glow outline */
.pdg-node--trigger {
  border-color: rgba(255, 255, 255, 0.65);
  box-shadow: 0 0 0 2px rgba(255,255,255,0.3), 0 1px 3px rgba(0,0,0,0.18);
}

/* Probe node: dashed rounded border */
.pdg-node--probe {
  border-style: dashed;
  border-radius: 12px;
  border-color: rgba(255, 255, 255, 0.6);
}

/* Handles are invisible — just edge anchor points */
.pdg-handle {
  opacity: 0 !important;
  pointer-events: none !important;
  width: 6px !important;
  height: 6px !important;
}

.pdg-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #aaa;
  font-size: 14px;
}
</style>
