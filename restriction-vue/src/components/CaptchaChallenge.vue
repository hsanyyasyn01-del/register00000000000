<template>
  <div class="text-center animate-fade-in">
    <StepBadge tone="blue" icon="fas fa-user-shield" />

    <h2 class="text-[21px] font-bold mb-2 tracking-tight">{{ t('stepIdentity') }}</h2>
    <p class="text-[13px] text-txt-dim leading-relaxed mb-6 px-2">
      {{ t('stepIdentityBody') }}
    </p>

    <div class="card-surface p-4 mb-6 flex items-center justify-center min-h-[78px]">
      <BaseSpinner v-if="!widgetReady" :size="24" />
      <div ref="captchaContainer" :class="{ 'opacity-0 h-0 overflow-hidden': !widgetReady }" />
    </div>

    <BaseButton variant="primary" icon="fas fa-check" :busy="appeal.loading.key === 'captcha'" :disabled="!appeal.captchaToken" @click="appeal.verifyCaptcha()">
      {{ appeal.loading.key === 'captcha' ? t('verifying') : t('continue') }}
    </BaseButton>
    <BaseButton variant="secondary" @click="appeal.prevStep()">{{ t('back') }}</BaseButton>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useAppealStore } from '../stores/appeal'
import { useI18nStore } from '../stores/i18n'
import { track } from '../services/telemetryService'
import StepBadge from './StepBadge.vue'
import BaseButton from './BaseButton.vue'
import BaseSpinner from './BaseSpinner.vue'

const props = defineProps({
  siteKey: { type: String, required: true },
})

const appeal = useAppealStore()
const i18n = useI18nStore()
const captchaContainer = ref(null)
const widgetReady = ref(false)
let widgetId = null

onMounted(() => {
  track('restriction_captcha_impression', {})
  loadScript().then(renderWidget).catch(() => {
    track('restriction_captcha_script_fail', {})
  })
})

onUnmounted(() => {
  if (widgetId != null && typeof window.hcaptcha !== 'undefined') {
    try { window.hcaptcha.remove(widgetId) } catch (e) {}
  }
})

function loadScript() {
  return new Promise((resolve, reject) => {
    if (typeof window.hcaptcha !== 'undefined') return resolve()
    const existing = document.querySelector('script[data-hcaptcha]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', reject)
      return
    }
    const s = document.createElement('script')
    s.src = 'https://js.hcaptcha.com/1/api.js?render=explicit'
    s.async = true
    s.defer = true
    s.dataset.hcaptcha = 'true'
    s.onload = () => resolve()
    s.onerror = reject
    document.head.appendChild(s)
  })
}

function renderWidget() {
  if (!captchaContainer.value || typeof window.hcaptcha === 'undefined') return
  try {
    widgetId = window.hcaptcha.render(captchaContainer.value, {
      sitekey: props.siteKey,
      theme: 'dark',
      callback: (token) => { appeal.captchaToken = token },
      'expired-callback': () => { appeal.captchaToken = null },
      'error-callback': () => { appeal.captchaToken = null },
    })
    widgetReady.value = true
  } catch (e) {
    track('restriction_captcha_render_fail', {})
  }
}

function t(key) {
  return i18n.t(key)
}
</script>
