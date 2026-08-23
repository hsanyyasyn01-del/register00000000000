<template>
  <div class="mb-7">
    <div class="flex items-center justify-center gap-1 mb-2.5" dir="ltr">
      <div
        v-for="i in total"
        :key="i"
        class="h-[3px] rounded-full transition-all duration-500 ease-out"
        :class="dotClass(i)"
      />
    </div>
    <p class="text-center text-[11px] text-txt-faint font-semibold">{{ t('stepOf', { current, total }) }}</p>
  </div>
</template>

<script setup>
import { useI18nStore } from '../stores/i18n'

const props = defineProps({
  current: { type: Number, required: true },
  total: { type: Number, required: true },
})

const i18n = useI18nStore()

function dotClass(i) {
  if (i < props.current) return 'w-[26px] bg-txt-dim'
  if (i === props.current) return 'w-[34px] bg-[#f5f5f5] shadow-[0_0_6px_rgba(245,245,245,0.5)]'
  return 'w-[26px] bg-border'
}

function t(key, params) {
  return i18n.t(key, params)
}
</script>
