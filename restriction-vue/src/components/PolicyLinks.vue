<template>
  <div class="bg-primary/5 border border-primary/20 rounded-xl p-3.5 mb-6 flex items-start gap-2.5">
    <i class="fas fa-circle-info text-primary text-[13px] mt-[3px] shrink-0" />
    <p class="text-[12px] text-txt-dim leading-relaxed">{{ t('deadlineNote') }}</p>
  </div>
</template>

<script setup>
import { useI18nStore } from '../stores/i18n'

const i18n = useI18nStore()

function t(key) {
  return i18n.t(key)
}
</script>
