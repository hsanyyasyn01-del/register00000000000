<template>
  <Transition name="banner">
    <div v-if="!online" class="w-full bg-danger/95 text-white text-center text-[12.5px] font-semibold py-2 px-4 z-50 sticky top-0">
      <i class="fas fa-triangle-exclamation ml-1" />
      {{ t('offline') }}
    </div>
  </Transition>
</template>

<script setup>
import { useOnline } from '../composables/useOnline'
import { useI18nStore } from '../stores/i18n'

const { online } = useOnline()
const i18n = useI18nStore()

function t(key) {
  return i18n.t(key)
}
</script>

<style scoped>
.banner-enter-active,
.banner-leave-active { transition: all 0.3s ease; }
.banner-enter-from,
.banner-leave-to { opacity: 0; transform: translateY(-100%); }
</style>
