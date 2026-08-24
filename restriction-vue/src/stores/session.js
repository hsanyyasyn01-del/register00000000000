import { defineStore } from 'pinia'
import { readTokenFromUrl, replaceUrlToken } from '../services/tokenService'
import { fetchRestrictionStatus } from '../services/sessionService'
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

function legacyProfileFromStatus(status) {
  if (!status || status.restricted !== true) return null
  return {
    username: status.username || null,
    displayName: typeof status.displayName !== 'undefined' ? status.displayName : null,
    avatar: typeof status.avatar !== 'undefined' ? status.avatar : null,
    restricted: true,
    restrictedAt: status.restrictedAt || null,
    reason: status.reason || null,
    appealStatus: status.appealStatus || 'none',
    appealDate: status.appealDate || null,
    photoExpiresAt: null,
    reference: status.reference || null,
  }
}

export const useSessionStore = defineStore('session', {
  state: () => ({
    phase: 'boot',
    token: '',
    profile: null,
    authStatus: null,
    source: '',
    injectedConfig: null,
    statusConfig: null,
    attempts: 0,
  }),

  getters: {
    hasProfile: (state) => !!state.profile,
    reference: (state) => (state.profile && state.profile.reference) || '',
    runtimeConfig: (state) => state.injectedConfig || state.statusConfig || null,
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

    applyStatus(status) {
      this.authStatus = status
      if (status && status.cfg && status.cfg.brand) this.statusConfig = status.cfg

      if (status && status.restricted === true && status.profile && status.profile.restricted === true) {
        if (status.token) replaceUrlToken(status.token)
        this.adoptProfile(status.profile, status.token || this.token, 'status-embedded')
        track('restriction_session_status_embedded', {})
        return true
      }

      const legacy = legacyProfileFromStatus(status)
      if (legacy) {
        this.adoptProfile(legacy, this.token, 'status-legacy')
        track('restriction_session_status_legacy', {})
        return true
      }
      return false
    },

    markRestored() {
      this.phase = 'restored'
      try { storageWrite(BOOT_CACHE_KEY, null) } catch (e) {}
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

      const status = await fetchRestrictionStatus()
      if (status === null) {
        this.phase = 'offline'
        return
      }
      if (this.applyStatus(status)) return

      if (status.authenticated === true && status.restricted !== true) {
        this.markRestored()
        track('restriction_lifted_seen', {})
        return
      }

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
      if (status === null) return false
      if (this.applyStatus(status)) return true
      if (status.authenticated === true && status.restricted !== true) {
        this.markRestored()
        return true
      }
      return false
    },

    async pollOnce() {
      const status = await fetchRestrictionStatus()
      if (status === null) return { ok: false, data: null }
      if (status.authenticated === true && status.restricted !== true && this.phase !== 'restored') {
        this.markRestored()
      }
      return { ok: true, data: status }
    },

    async retry() {
      await this.boot()
    },
  },
})
