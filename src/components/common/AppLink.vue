<template>
  <a :href="href" class="app-link" @click="onClick">
    <slot />
  </a>
</template>

<script setup>
import { computed } from 'vue'
import { buildDeepLinkHref, isModifiedClick } from '../../utils/appDeepLinks'

const props = defineProps({
  tab: { type: String, required: true },
  params: { type: Object, default: () => ({}) },
})

const href = computed(() => buildDeepLinkHref(props.tab, props.params))

function onClick(event) {
  if (isModifiedClick(event)) return
  event.preventDefault()
  window.dispatchEvent(new CustomEvent('app:navigate', {
    detail: { tab: props.tab, params: { ...props.params } },
  }))
}
</script>

<style scoped>
/* Keep defaults minimal: do not set color here, otherwise the scoped
   selector (which Vue rewrites to .app-link[data-v-*]) would outrank
   consumer utility classes like .btn-gradient-blue and break their text
   color. Consumers control color via their own class; a bare AppLink
   falls back to the browser default link color. */
.app-link {
  text-decoration: none;
}
</style>
