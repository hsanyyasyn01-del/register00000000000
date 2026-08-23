import { defineStore } from 'pinia'
import { useUiStore } from './ui'
import { useI18nStore } from './i18n'
import { useSessionStore } from './session'
import { submitCaptcha, requestOtp, submitOtp, submitSelfie, logoutRestricted } from '../services/appealService'
import { isValidOtp } from '../services/validatorService'
import { track } from '../services/telemetryService'

export const TOTAL_STEPS = 5

export const useAppealStore = defineStore('appeal', {
  state: () => ({
    step: 1,
    captchaToken: null,
    flowToken: null,
    username: '',
    capturedBlob: null,
    appealDate: null,
    photoExpiresAt: null,
    loading: { key: '', active: false },
  }),

  actions: {
    t(key, params) {
      const i18n = useI18nStore()
      return i18n.t(key, params)
    },

    toast(msg, type) {
      const ui = useUiStore()
      ui.showToast(msg, type)
    },

    goToStep(n) {
      const target = Math.min(TOTAL_STEPS, Math.max(1, n))
      if (target !== this.step) {
        this.step = target
        track('restriction_step_view', { step: target })
      }
    },

    nextStep() {
      this.goToStep(this.step + 1)
    },

    prevStep() {
      this.goToStep(this.step - 1)
    },

    syncFromProfile(profile) {
      if (!profile) return
      if (profile.username && !this.username) this.username = profile.username
      if (profile.appealStatus === 'pending') {
        this.appealDate = profile.appealDate || this.appealDate
        this.photoExpiresAt = profile.photoExpiresAt || this.photoExpiresAt
        this.goToStep(TOTAL_STEPS)
      }
    },

    setLoading(key, active) {
      this.loading = { key: active ? key : '', active: !!active }
    },

    async verifyCaptcha() {
      if (!this.captchaToken) return this.toast(this.t('toastCaptchaRequired'), 'error')
      this.setLoading('captcha', true)
      try {
        const d = await submitCaptcha(this.captchaToken)
        if (d && d.success) {
          this.flowToken = d.sessionToken
          track('restriction_captcha_ok', {})
          this.nextStep()
        } else {
          this.toast((d && d.error) || this.t('toastCaptchaFailed'), 'error')
          this.captchaToken = null
          track('restriction_captcha_fail', {})
        }
      } catch (e) {
        this.toast(this.t('toastNetwork'), 'error')
      }
      this.setLoading('captcha', false)
    },

    async sendOtp() {
      const username = (this.username || '').trim()
      if (!username) return this.toast(this.t('toastUsernameRequired'), 'error')
      this.setLoading('otpSend', true)
      let sent = false
      try {
        const d = await requestOtp(this.flowToken, username)
        if (d && d.success) {
          this.toast(this.t('toastCodeSent'))
          sent = true
          track('restriction_otp_sent', {})
        } else {
          this.toast((d && d.error) || this.t('genericError'), 'error')
        }
      } catch (e) {
        this.toast(this.t('toastNetwork'), 'error')
      }
      this.setLoading('otpSend', false)
      return sent
    },

    async verifyOtp(otp) {
      if (!isValidOtp(otp)) return this.toast(this.t('toastCodeIncomplete'), 'error')
      this.setLoading('otpVerify', true)
      let ok = false
      try {
        const d = await submitOtp(this.flowToken, otp)
        if (d && d.success) {
          track('restriction_otp_ok', {})
          this.toast(this.t('confirm'))
          this.nextStep()
          ok = true
        } else {
          this.toast((d && d.error) || this.t('toastCodeWrong'), 'error')
          track('restriction_otp_fail', {})
        }
      } catch (e) {
        this.toast(this.t('toastNetwork'), 'error')
      }
      this.setLoading('otpVerify', false)
      return ok
    },

    async uploadSelfie() {
      if (!this.capturedBlob) return this.toast(this.t('toastPhotoRequired'), 'error')
      this.setLoading('upload', true)
      try {
        const d = await submitSelfie(this.flowToken, this.capturedBlob)
        if (d && d.success) {
          this.appealDate = d.appealDate || new Date().toISOString()
          this.photoExpiresAt = d.photoExpiresAt || null
          track('restriction_appeal_submitted', {})
          this.nextStep()
          const session = useSessionStore()
          if (session.profile) session.profile.appealStatus = 'pending'
        } else {
          this.toast((d && d.error) || this.t('genericError'), 'error')
        }
      } catch (e) {
        this.toast(this.t('toastNetwork'), 'error')
      }
      this.setLoading('upload', false)
    },

    async logout() {
      this.setLoading('logout', true)
      track('restriction_logout', {})
      await logoutRestricted()
      try {
        localStorage.removeItem('sessionToken')
        localStorage.removeItem('hassani_token')
        localStorage.removeItem('session_token')
        localStorage.removeItem('Cosmos_session')
        localStorage.removeItem('pendingOnboardingToken')
      } catch (e) {}
      window.location.href = '/login.html'
    },
  },
})
