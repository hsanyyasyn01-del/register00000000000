<template>
  <div class="text-center animate-fade-in pt-10">
    <StepBadge tone="red" icon="fas fa-link-slash" />
    <h2 class="text-[21px] font-bold mb-2 tracking-tight">{{ t('sessionExpiredTitle') }}</h2>
    <p class="text-[13px] text-txt-dim leading-relaxed mb-8 px-3">
      {{ t('sessionExpiredBody') }}
    </p>
    <BaseButton variant="primary" icon="fas fa-arrow-right-to-bracket" @click="goLogin">
      {{ t('loginCta') }}
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
  loginUrl: { type: String, default: '/login.html' },
})

const session = useSessionStore()
const i18n = useI18nStore()

function goLogin() {
  track('restriction_login_redirect', {})
  window.location.href = props.loginUrl
}

function t(key) {
  return i18n.t(key)
}
</script>
