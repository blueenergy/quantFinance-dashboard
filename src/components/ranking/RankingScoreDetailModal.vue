<template>
  <div
    v-if="show"
    class="modal-overlay score-detail-modal-overlay"
    :class="{ 'score-detail-modal-overlay--raised': maximized }"
    role="presentation"
    @click="handleOverlayClick"
  >
    <section
      class="modal-content score-detail-modal"
      :class="{ 'score-detail-modal--maximized': maximized }"
      role="dialog"
      aria-modal="true"
      :aria-label="dialogTitle"
      @click.stop
    >
      <div class="score-detail-modal-toolbar">
        <h4 class="score-detail-modal-title">
          <span>{{ dialogTitle }}</span>
          <span v-if="category" class="category-chip">{{ categoryLabel }}</span>
        </h4>
        <button
          type="button"
          class="btn-base btn-sm btn-gradient-teal score-detail-fullscreen-btn"
          @click="maximized = !maximized"
        >
          {{ maximized ? '退出全屏' : '全屏' }}
        </button>
      </div>

      <div class="score-detail-content">
        <ScoreDetailView
          :category="category"
          :details="details"
          :weights="weights"
          :dimensions="dimensions"
          :loading="loading"
          :maximized="maximized"
        />
        <div class="score-detail-actions">
          <AppLink
            v-if="stock?.symbol"
            tab="stock-workbench"
            :params="{ symbol: stock.symbol }"
            class="btn-base btn-md btn-gradient-blue"
          >
            打开工作台
          </AppLink>
          <button
            type="button"
            class="btn-base btn-md btn-gradient-teal"
            :disabled="!stock?.symbol"
            @click="emit('view-chart', stock?.symbol)"
          >
            查看走势图
          </button>
          <button
            type="button"
            class="btn-base btn-md btn-gradient-green"
            :disabled="!stock?.symbol"
            @click="emit('toggle-watchlist', stock?.symbol)"
          >
            {{ inWatchlist ? '从自选股移除' : '添加到自选股' }}
          </button>
        </div>
      </div>

      <button
        type="button"
        class="btn-base btn-md btn-gradient-gray score-detail-close-footer"
        @click="emit('close')"
      >
        关闭
      </button>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import AppLink from '../common/AppLink.vue'
import ScoreDetailView from './ScoreDetailView.vue'
import { translateScoreCategory } from '../../utils/scoreDetail.js'

const props = defineProps({
  show: { type: Boolean, default: false },
  stock: { type: Object, default: null },
  category: { type: String, default: '' },
  details: { type: Object, default: null },
  weights: { type: Object, default: () => ({}) },
  dimensions: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  inWatchlist: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'view-chart', 'toggle-watchlist'])
const maximized = ref(false)

const categoryLabel = computed(() => translateScoreCategory(props.category))
const dialogTitle = computed(() => {
  const identity = [props.stock?.symbol, props.stock?.name].filter(Boolean).join(' - ')
  return `${identity ? `${identity} ` : ''}评分详情`
})

function handleOverlayClick() {
  if (maximized.value) {
    maximized.value = false
    return
  }
  emit('close')
}

function lockPageScroll() {
  const targets = [document.documentElement, document.body]
  const app = document.querySelector('.v-application')
  if (app) targets.push(app)
  const previous = targets.map(element => ({ element, overflow: element.style.overflow }))
  targets.forEach(element => {
    element.style.overflow = 'hidden'
  })
  return () => {
    previous.forEach(({ element, overflow }) => {
      element.style.overflow = overflow
    })
  }
}

watch(
  () => props.show,
  (show, _previous, onCleanup) => {
    if (!show) {
      maximized.value = false
      return
    }

    const unlockScroll = lockPageScroll()
    const handleKeydown = event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (maximized.value) maximized.value = false
      else emit('close')
    }
    window.addEventListener('keydown', handleKeydown)
    onCleanup(() => {
      window.removeEventListener('keydown', handleKeydown)
      unlockScroll()
    })
  },
  { immediate: true }
)
</script>

<style scoped>
.score-detail-modal-overlay {
  overflow: hidden;
  overscroll-behavior: contain;
}

.score-detail-modal-overlay--raised {
  z-index: 2990;
  background-color: rgba(0, 0, 0, 0.78);
}

.score-detail-modal {
  display: flex;
  max-width: 760px;
  max-height: min(90vh, 920px);
  flex-direction: column;
  overflow: hidden;
}

.score-detail-modal-toolbar {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 4px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.score-detail-modal-title {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.score-detail-fullscreen-btn,
.score-detail-close-footer {
  flex-shrink: 0;
}

.score-detail-modal--maximized {
  position: fixed;
  z-index: 3000;
  top: 50%;
  left: 50%;
  display: flex;
  width: min(96vw, 1400px);
  max-width: none;
  height: min(92vh, 960px);
  max-height: none;
  margin: 0;
  padding: 16px 20px;
  flex-direction: column;
  border-radius: 10px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.45);
  transform: translate(-50%, -50%);
}

.score-detail-content {
  min-height: 0;
  flex: 1;
  margin: 12px 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.score-detail-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #ddd;
}

.category-chip {
  padding: 4px 10px;
  border-radius: 16px;
  background: linear-gradient(135deg, #ff9800, #f57c00);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

@media (max-width: 768px) {
  .score-detail-modal {
    width: 95%;
  }

  .score-detail-modal--maximized {
    width: 98vw;
    height: 96vh;
    padding: 12px;
  }

  .score-detail-actions {
    flex-direction: column;
  }
}
</style>
