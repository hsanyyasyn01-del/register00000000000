<template>
  <SplashScreen v-if="session.phase === 'boot'" />
  <div v-else class="min-h-dvh flex flex-col relative z-10">
    <OfflineBanner />
    <AppHeader :brand="brandName" :logo="brandLogo" />
    <main class="flex-1 flex items-start justify-center px-4 pt-6 pb-10 w-full">
      <div class="w-full max-w-[440px]">
        <SessionExpired v-if="session.phase === 'invalid'" :login-url="loginUrl" />
        <ErrorState v-else-if="session.phase === 'offline'" @retry="session.retry()" />
        <template v-else-if="session.phase === 'ready'">
          <StepNavigator :current="appeal.step" :total="TOTAL_STEPS" />
          <div class="relative min-h-[420px]">
            <Transition name="step" mode="out-in">
              <RestrictionNotice v-if="appeal.step === 1" key="s1" :profile="session.profile" />
              <CaptchaChallenge v-else-if="appeal.step === 2" key="s2" :site-key="captchaSiteKey" />
              <OtpChallenge v-else-if="appeal.step === 3" key="s3" />
              <SelfieCapture v-else-if="appeal.step === 4" key="s4" />
              <AppealSubmitted v-else-if="appeal.step === 5" key="s5" />
            </Transition>
          </div>
        </template>
      </div>
    </main>
    <AppFooter :links="footerLinks" :copyright="copyrightText" />
    <LegalDisclaimer v-if="session.phase === 'ready'" />
    <ToastHost />
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, reactive } from 'vue'
import { useSessionStore } from './stores/session'
import { useAppealStore, TOTAL_STEPS } from './stores/appeal'
import { useI18nStore } from './stores/i18n'
import { useUiStore } from './stores/ui'
import { fetchBootstrap } from './services/bootstrapService'
import { startHeartbeat, stopHeartbeat } from './services/heartbeatService'
import { configureTelemetry, track } from './services/telemetryService'
import { on as onBus } from './services/eventBus'
import { useDocumentTitle } from './composables/useDocumentTitle'
import SplashScreen from './components/SplashScreen.vue'
import ToastHost from './components/ToastHost.vue'

const AppHeader = defineAsyncComponent(() => import('./components/AppHeader.vue'))
const AppFooter = defineAsyncComponent(() => import('./components/AppFooter.vue'))
const OfflineBanner = defineAsyncComponent(() => import('./components/OfflineBanner.vue'))
const StepNavigator = defineAsyncComponent(() => import('./components/StepNavigator.vue'))
const RestrictionNotice = defineAsyncComponent(() => import('./components/RestrictionNotice.vue'))
const CaptchaChallenge = defineAsyncComponent(() => import('./components/CaptchaChallenge.vue'))
const OtpChallenge = defineAsyncComponent(() => import('./components/OtpChallenge.vue'))
const SelfieCapture = defineAsyncComponent(() => import('./components/SelfieCapture.vue'))
const AppealSubmitted = defineAsyncComponent(() => import('./components/AppealSubmitted.vue'))
const SessionExpired = defineAsyncComponent(() => import('./components/SessionExpired.vue'))
const ErrorState = defineAsyncComponent(() => import('./components/ErrorState.vue'))
const LegalDisclaimer = defineAsyncComponent(() => import('./components/LegalDisclaimer.vue'))

const session = useSessionStore()
const appeal = useAppealStore()
const i18n = useI18nStore()
const ui = useUiStore()

const config = reactive({
  brand: { name: 'Hassani GPT', logo: '/1234.png' },
  captcha: { siteKey: 'ea14e556-79e8-46a4-a59e-21d8653267be' },
  features: { heartbeatMs: 25000, telemetryEnabled: true },
  links: {},
})

const brandName = computed(() => config.brand.name || 'Hassani GPT')
const brandLogo = computed(() => config.brand.logo || '/1234.png')
const captchaSiteKey = computed(() => config.captcha.siteKey || 'ea14e556-79e8-46a4-a59e-21d8653267be')
const loginUrl = computed(() => (config.links && config.links.login) || '/login.html')

const footerLinks = computed(() => {
  const L = config.links || {}
  return [
    { key: 'footerAbout', href: L.about || '/about.html' },
    { key: 'footerHelp', href: L.help || '/help.html' },
    { key: 'footerTerms', href: L.terms || '/terms.html' },
    { key: 'footerPrivacy', href: L.privacy || '/privacy.html' },
  ]
})

const copyrightText = computed(() => i18n.t('footerCopyright'))

useDocumentTitle(() => i18n.t('appTitle') + ' - ' + config.brand.name)

onMounted(async () => {
  const unsub = onBus('connectivity', ({ online }) => {
    ui.setOnline(online)
    if (!online) track('restriction_offline', {})
    else track('restriction_online', {})
  })

  const boot = await fetchBootstrap()
  if (boot && boot.brand) config.brand = { ...config.brand, ...boot.brand }
  if (boot && boot.captcha) config.captcha = { ...config.captcha, ...boot.captcha }
  if (boot && boot.features) config.features = { ...config.features, ...boot.features }
  if (boot && boot.links) config.links = { ...config.links, ...boot.links }

  configureTelemetry({ enabled: !boot.features || boot.features.telemetryEnabled !== false })

  await i18n.init(readLangHint())

  await session.boot()

  if (session.phase === 'ready' && session.profile) {
    appeal.syncFromProfile(session.profile)
    track('restriction_profile_view', { appealStatus: session.profile.appealStatus || 'none' })
  }

  if (session.source !== 'injected') {
    startHeartbeat(config.features.heartbeatMs || 25000, (info) => ui.setHeartbeat(info))
  }

  window.addEventListener('beforeunload', () => {
    stopHeartbeat()
    unsub()
  })
})

function readLangHint() {
  try {
    const params = new URLSearchParams(window.location.search)
    const lang = params.get('lang')
    if (lang) return lang
  } catch (e) {}
  return null
}
</script>

<style>
.step-enter-active { animation: stepIn 0.38s ease; }
.step-leave-active { animation: stepIn 0.22s ease reverse; }
@keyframes stepIn {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
