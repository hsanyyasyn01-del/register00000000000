import { defineStore } from 'pinia'
import { readTokenFromUrl, replaceUrlToken } from '../services/tokenService'
import { fetchSessionProfile, mintSessionToken, fetchRestrictionStatus } from '../services/sessionService'
import { read as storageRead, write as storageWrite } from '../services/storageService'
import { track } from '../services/telemetryService'

const BOOT_CACHE_KEY = 'boot-profile'
const BOOT_CACHE_TTL = 6 * 60 * 60 * 1000

function readInjectedPayload() {
  try {
    const boot = window.__RESTRICTION_BOOT__
    if (boot && boot.restricted === true && boot.profile && boot.profile.restricted === true) return boot
  } catch (e) {}
  return null
}

export const useSessionStore = defineStore('session', {
  state: () => ({
    phase: 'boot',
    token: '',
    profile: null,
    authStatus: null,
    source: '',
    injectedConfig: null,
    attempts: 0,
  }),

  getters: {
    hasProfile: (state) => !!state.profile,
    reference: (state) => (state.profile && state.profile.reference) || '',
  },

  actions: {
    adoptProfile(profile, token, source) {
      this.profile = profile
      if (token) this.token = token
      this.source = source
      this.phase = 'ready'
      try {
        storageWrite(BOOT_CACHE_KEY, { at: Date.now(), token: this.token, profile })
      } catch (e) {}
    },

    async boot() {
      this.phase = 'boot'
      this.token = readTokenFromUrl()
      track('restriction_boot', { hasToken: !!this.token })

      const injected = readInjectedPayload()
      if (injected) {
        if (injected.cfg) this.injectedConfig = injected.cfg
        if (injected.token && injected.token !== this.token) replaceUrlToken(injected.token)
        this.adoptProfile(injected.profile, injected.token || this.token, 'injected')
        track('restriction_session_injected', { reference: injected.profile.reference || '' })
        return
      }

      if (this.token) {
        const result = await fetchSessionProfile(this.token)
        if (result.ok) {
          this.adoptProfile(result.profile, this.token, 'token')
          track('restriction_session_ok', { reference: result.profile && result.profile.reference })
          return
        }
        if (result.reason === 'NETWORK') {
          this.phase = 'offline'
          return
        }
      }

      const renewed = await this.renew()
      if (renewed) return

      try {
        const cached = storageRead(BOOT_CACHE_KEY)
        if (cached && cached.profile && Date.now() - (cached.at || 0) < BOOT_CACHE_TTL) {
          if (cached.token && !this.token) replaceUrlToken(cached.token)
          this.adoptProfile(cached.profile, cached.token || this.token, 'cache')
          track('restriction_session_cached', {})
          return
        }
      } catch (e) {}

      this.phase = 'invalid'
      track('restriction_session_invalid', {})
    },

    async renew() {
      this.attempts += 1
      const status = await fetchRestrictionStatus()
      this.authStatus = status

      if (status && status.restricted === true && status.profile && status.profile.restricted === true) {
        if (status.token) replaceUrlToken(status.token)
        this.adoptProfile(status.profile, status.token || this.token, 'status-embedded')
        track('restriction_session_status_embedded', {})
        return true
      }
      if (!status || status.restricted !== true) {
        if (status && status.success) return false
      }

      const minted = await mintSessionToken()
      if (!minted.ok) return false
      this.token = minted.token
      replaceUrlToken(minted.token)
      if (minted.profile && minted.profile.restricted === true) {
        this.adoptProfile(minted.profile, minted.token, 'mint-embedded')
        track('restriction_session_renewed', {})
        return true
      }
      const result = await fetchSessionProfile(minted.token)
      if (!result.ok) return false
      this.adoptProfile(result.profile, minted.token, 'mint')
      track('restriction_session_renewed', {})
      return true
    },

    async retry() {
      await this.boot()
    },
  },
})
