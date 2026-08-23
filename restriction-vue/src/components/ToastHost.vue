<template>
  <Transition name="toast">
    <div v-if="ui.toast.show" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] max-w-[92vw]" :class="toastClass">
      <i :class="toastIcon" />
      <span class="whitespace-pre-line">{{ ui.toast.msg }}</span>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { useUiStore } from '../stores/ui'

const ui = useUiStore()

const toastClass = computed(() => {
  const base = 'bg-panel text-[#f5f5f5] px-5 py-3.5 rounded-lg text-sm font-semibold flex items-center gap-2.5 shadow-xl border-b-2'
  return ui.toast.type === 'error' ? base + ' border-danger' : base + ' border-[#4cb5f9]'
})

const toastIcon = computed(() => (ui.toast.type === 'error' ? 'fas fa-circle-exclamation' : 'fas fa-circle-check'))
</script>

<style scoped>
.toast-enter-active { animation: toastSlide 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.toast-leave-active { animation: toastSlide 0.3s ease reverse; }
@keyframes toastSlide {
  from { transform: translate(-50%, 24px); opacity: 0; }
  to { transform: translate(-50%, 0); opacity: 1; }
}
</style>
