<template>
  <nav
    id="main-nav"
    :class="['nav-sidebar', { 'drawer-open': drawerOpen }]"
    data-testid="nav-sidebar"
    aria-label="主导航"
  >
    <div
      v-for="group in groups"
      :key="group.id"
      class="nav-group"
    >
      <button
        type="button"
        class="nav-group-header"
        :class="{
          'is-current': group.id === activeGroup,
          'is-expanded': group.id === expandedGroup,
        }"
        :aria-expanded="group.id === expandedGroup"
        :data-testid="`nav-group-${group.id}`"
        @click="openGroup(group.id)"
      >
        <span class="nav-group-label">{{ group.label }}</span>
        <span class="nav-group-chevron" aria-hidden="true">
          {{ group.id === expandedGroup ? '▾' : '▸' }}
        </span>
      </button>

      <ul v-if="group.id === expandedGroup" class="nav-group-items">
        <li v-for="tab in group.tabs" :key="tab.id">
          <a
            :href="hrefFor(tab.id)"
            :class="['nav-item', { active: tab.id === activeTab }]"
            :aria-current="tab.id === activeTab ? 'page' : undefined"
            :data-testid="`nav-tab-${tab.id}`"
            @click="onLeafClick($event, tab.id)"
          >
            {{ tab.name }}
          </a>
        </li>
        <li
          v-if="group.id === 'stock' && activeTab === 'chart'"
          class="nav-item nav-item--transient active"
          data-testid="nav-tab-chart"
        >
          <span>图表{{ chartSymbol ? ` · ${chartSymbol}` : '' }}</span>
        </li>
      </ul>
    </div>
  </nav>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { buildDeepLinkHref, isModifiedClick } from '../utils/appDeepLinks.js'
import { buildNavGroups, groupForTab } from '../utils/navCatalog.js'

const props = defineProps({
  tabs: {
    type: Array,
    default: () => [],
  },
  activeTab: {
    type: String,
    default: '',
  },
  chartSymbol: {
    type: String,
    default: '',
  },
  drawerOpen: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select'])

const groups = computed(() => buildNavGroups(props.tabs))
const activeGroup = computed(() => groupForTab(props.activeTab))
const expandedGroup = ref('')

watch(
  activeGroup,
  (group) => {
    if (group) expandedGroup.value = group
  },
  { immediate: true },
)

watch(
  groups,
  (nextGroups) => {
    if (nextGroups.some((group) => group.id === expandedGroup.value)) return
    expandedGroup.value = activeGroup.value || ''
  },
  { immediate: true },
)

function openGroup(groupId) {
  // Group headers only fold/unfold; they never navigate. Clicking the open
  // group again collapses it.
  expandedGroup.value = expandedGroup.value === groupId ? '' : groupId
}

function hrefFor(tabId) {
  return buildDeepLinkHref(tabId)
}

function onLeafClick(event, tabId) {
  // Right/middle/Ctrl/Cmd clicks must fall through to the browser so the
  // user can open several tabs from the sidebar.
  if (isModifiedClick(event)) return
  event.preventDefault()
  emit('select', tabId)
}
</script>

<style scoped>
.nav-sidebar {
  grid-area: sidebar;
  align-self: start;
  position: sticky;
  top: var(--app-header-height, 68px);
  z-index: 10;
  box-sizing: border-box;
  width: 100%;
  min-height: calc(100vh - var(--app-header-height, 68px) - 36px);
  max-height: calc(100vh - var(--app-header-height, 68px) - 36px);
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding: 12px 10px 28px;
  border-right: 1px solid rgba(138, 43, 226, 0.22);
  background: rgba(15, 23, 42, 0.38);
}

.nav-group + .nav-group {
  margin-top: 2px;
}

.nav-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 9px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #b19cd9;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
  text-align: left;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}

.nav-group-header:hover {
  color: #e6e6fa;
  background: rgba(138, 43, 226, 0.10);
}

.nav-group-header.is-expanded {
  color: #ffffff;
  background: rgba(138, 43, 226, 0.16);
}

.nav-group-header.is-current .nav-group-label {
  color: #ffffff;
  box-shadow: inset 2px 0 0 #a855f7;
  padding-left: 8px;
}

.nav-group-chevron {
  flex: 0 0 auto;
  font-size: 13px;
  opacity: 0.7;
}

.nav-group-items {
  margin: 2px 0 6px;
  padding: 0 0 0 8px;
  list-style: none;
}

.nav-item {
  display: block;
  padding: 9px 12px 9px 22px;
  border-radius: 6px;
  color: #cbd5e1;
  font-size: 15px;
  line-height: 1.4;
  text-decoration: none;
  transition: color 0.15s ease, background 0.15s ease;
}

.nav-item:hover {
  color: #ffffff;
  background: rgba(138, 43, 226, 0.10);
}

.nav-item.active {
  color: #ffffff;
  background: linear-gradient(
    135deg,
    rgba(138, 43, 226, 0.30) 0%,
    rgba(147, 112, 219, 0.22) 100%
  );
  box-shadow: inset 2px 0 0 #a855f7;
}

.nav-item--transient {
  font-style: italic;
  opacity: 0.92;
}

@media (max-width: 1200px) {
  .nav-sidebar {
    position: fixed;
    top: var(--app-header-height, 68px);
    bottom: 36px;
    left: 0;
    width: 280px;
    min-height: 0;
    max-height: none;
    z-index: 40;
    background: #1e1e3f;
    box-shadow: 18px 0 40px rgba(0, 0, 0, 0.35);
    transform: translateX(-100%);
    transition: transform 0.22s ease;
  }

  .nav-sidebar.drawer-open {
    transform: translateX(0);
  }
}
</style>
