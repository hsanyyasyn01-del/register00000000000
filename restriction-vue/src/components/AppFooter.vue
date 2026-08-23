<template>
  <footer class="w-full border-t border-hairline">
    <div class="max-w-[980px] mx-auto px-4 py-6 flex flex-col items-center gap-3">
      <nav class="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <a
          v-for="link in links"
          :key="link.key"
          :href="link.href"
          class="text-[12px] text-txt-faint hover:text-txt-dim transition-colors"
        >{{ t(link.key) }}</a>
      </nav>
      <p class="text-[11px] text-[#4a4a4a]">{{ copyright }}</p>
    </div>
  </footer>
</template>

<script setup>
import { useI18nStore } from '../stores/i18n'

defineProps({
  links: { type: Array, default: () => [] },
  copyright: { type: String, default: '' },
})

const i18n = useI18nStore()

function t(key) {
  return i18n.t(key)
}
</script>
