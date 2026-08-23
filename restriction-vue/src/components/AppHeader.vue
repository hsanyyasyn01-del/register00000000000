<template>
  <header class="w-full border-b border-hairline bg-black/80 backdrop-blur-md sticky top-0 z-40">
    <div class="max-w-[980px] mx-auto flex items-center gap-3 px-4 h-[56px]">
      <BrandMark :size="30" />
      <div class="flex flex-col leading-tight">
        <span class="text-[15px] font-bold tracking-tight">{{ brand }}</span>
        <span class="text-[11px] text-txt-faint">{{ t('accountCenter') }}</span>
      </div>
      <div class="flex-1" />
      <div class="hidden sm:flex items-center gap-1.5 text-[11px] text-txt-faint" v-if="heartbeatOk === true">
        <span class="w-1.5 h-1.5 rounded-full bg-success" />
        <span>Live</span>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useI18nStore } from '../stores/i18n'
import { useUiStore } from '../stores/ui'
import BrandMark from './BrandMark.vue'

defineProps({
  brand: { type: String, default: 'Hassani GPT' },
  logo: { type: String, default: '/1234.png' },
})

const i18n = useI18nStore()
const ui = useUiStore()

const heartbeatOk = computed(() => (ui.lastHeartbeat ? ui.lastHeartbeat.ok : null))

function t(key) {
  return i18n.t(key)
}
</script>
