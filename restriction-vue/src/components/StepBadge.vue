<template>
  <div class="flex justify-center mb-5">
    <div class="relative w-[76px] h-[76px] rounded-full flex items-center justify-center" :class="ringClass">
      <div class="absolute inset-[3px] rounded-full bg-black flex items-center justify-center">
        <i :class="icon + ' text-[26px] ' + iconClass" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  icon: { type: String, default: 'fas fa-shield-halved' },
  tone: { type: String, default: 'blue' },
})

const ringClass = computed(() => {
  if (props.tone === 'red') return 'bg-gradient-to-tr from-danger/60 via-danger to-danger/60'
  if (props.tone === 'green') return 'bg-gradient-to-tr from-success/60 via-success to-success/60'
  return 'bg-gradient-to-tr from-primary/60 via-primary to-primary/60'
})

const iconClass = computed(() => {
  if (props.tone === 'red') return 'text-danger'
  if (props.tone === 'green') return 'text-success'
  return 'text-primary'
})
</script>
