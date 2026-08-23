<template>
  <div class="text-center animate-fade-in pt-10">
    <StepBadge tone="red" icon="fas fa-cloud-bolt" />
    <h2 class="text-[21px] font-bold mb-2 tracking-tight">{{ t('genericError') }}</h2>
    <p class="text-[13px] text-txt-dim leading-relaxed mb-8 px-3">
      {{ t('offline') }}
    </p>
    <BaseButton variant="primary" icon="fas fa-rotate-right" @click="$emit('retry')">
      {{ t('retryCta') }}
    </BaseButton>
  </div>
</template>

<script setup>
import { useI18nStore } from '../stores/i18n'
import StepBadge from './StepBadge.vue'
import BaseButton from './BaseButton.vue'

defineEmits(['retry'])

const i18n = useI18nStore()

function t(key) {
  return i18n.t(key)
}
</script>
