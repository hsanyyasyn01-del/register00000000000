import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/main.css'
import { configureTelemetry, track, flushWithBeacon, flush } from './services/telemetryService'
import { collectAndReport, observeLcp, observeCls } from './services/performanceService'
import { createLogger } from './services/loggerService'

const logger = createLogger('boot')
const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

configureTelemetry({ enabled: true, context: { surface: 'restriction', appVersion: '2.0.0' } })
track('restriction_page_view', { referrer: document.referrer || null })

app.config.errorHandler = (err) => {
  track('restriction_error', { message: String(err && err.message ? err.message : err).slice(0, 200) })
  logger.error('unhandledvue', String(err))
}

window.addEventListener('error', (event) => {
  track('restriction_error', { message: String(event.message || '').slice(0, 200) })
})

window.addEventListener('unhandledrejection', (event) => {
  track('restriction_error', { message: String(event.reason || '').slice(0, 200) })
})

window.addEventListener('pagehide', () => {
  flushWithBeacon()
})

document.addEventListener('visibilitychange', () => {
  if (document.hidden) flushWithBeacon()
})

app.mount('#app')

observeLcp()
observeCls()

window.addEventListener('load', () => {
  setTimeout(() => collectAndReport(), 400)
})

scheduleModuleWarmup()

function scheduleModuleWarmup() {
  const queue = [
    () => import('./components/AppHeader.vue'),
    () => import('./components/AppFooter.vue'),
    () => import('./components/OfflineBanner.vue'),
    () => import('./components/AccountSummaryCard.vue'),
    () => import('./components/RestrictionNotice.vue'),
    () => import('./components/RestrictionMetaList.vue'),
    () => import('./components/ReasonPanel.vue'),
    () => import('./components/PolicyLinks.vue'),
    () => import('./components/StepNavigator.vue'),
    () => import('./components/CaptchaChallenge.vue'),
    () => import('./components/OtpChallenge.vue'),
    () => import('./components/SelfieCapture.vue'),
    () => import('./components/AppealSubmitted.vue'),
    () => import('./components/SessionExpired.vue'),
    () => import('./components/ErrorState.vue'),
  ]
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 350))
  const runNext = () => {
    const task = queue.shift()
    if (!task) return
    task().catch((e) => logger.debug('warmup failed', String(e))).finally(() => idle(runNext))
  }
  idle(runNext)
}

setInterval(() => { flush() }, 30000)
