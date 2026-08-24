<template>
  <div class="text-center animate-fade-in pt-10">
    <StepBadge tone="green" icon="fas fa-circle-check" />
    <h2 class="text-[21px] font-bold mb-2 tracking-tight">{{ t('restoredTitle') }}</h2>
    <p class="text-[13px] text-txt-dim leading-relaxed mb-8 px-3">
      {{ t('restoredBody') }}
    </p>
    <BaseButton variant="primary" icon="fas fa-house" @click="goHome">
      {{ t('homeCta') }}
    </BaseButton>
    <BaseButton variant="secondary" icon="fas fa-rotate-right" @click="session.retry()">
      {{ t('retryCta') }}
    </BaseButton>
  </div>
</template>

<script setup>
import { useSessionStore } from '../stores/session'
import { useI18nStore } from '../stores/i18n'
import { track } from '../services/telemetryService'
import StepBadge from './StepBadge.vue'
import BaseButton from './BaseButton.vue'

const props = defineProps({
  homeUrl: { type: String, default: '/messenger1.html' },
})

const session = useSessionStore()
const i18n = useI18nStore()

function goHome() {
  track('restriction_home_redirect', {})
  window.location.href = props.homeUrl
}

function t(key) {
  return i18n.t(key)
}
</script>
