import { defineStore } from 'pinia'
import { readTokenFromUrl, replaceUrlToken } from '../services/tokenService'
import { fetchSessionProfile, mintSessionToken, fetchRestrictionStatus } from '../services/sessionService'
import { track } from '../services/telemetryService'

export const useSessionStore = defineStore('session', {
  state: () => ({
    phase: 'boot',
    token: '',
    profile: null,
    authStatus: null,
    attempts: 0,
  }),

  getters: {
    hasProfile: (state) => !!state.profile,
    reference: (state) => (state.profile && state.profile.reference) || '',
  },

  actions: {
    async boot() {
      this.phase = 'boot'
      this.token = readTokenFromUrl()
      track('restriction_boot', { hasToken: !!this.token })

      if (this.token) {
        const result = await fetchSessionProfile(this.token)
        if (result.ok) {
          this.profile = result.profile
          this.phase = 'ready'
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
      this.phase = 'invalid'
      track('restriction_session_invalid', {})
    },

    async renew() {
      this.attempts += 1
      const status = await fetchRestrictionStatus()
      this.authStatus = status
      if (!status || status.restricted !== true) {
        if (status && status.success) return false
      }
      const minted = await mintSessionToken()
      if (!minted.ok) return false
      this.token = minted.token
      replaceUrlToken(minted.token)
      const result = await fetchSessionProfile(minted.token)
      if (!result.ok) return false
      this.profile = result.profile
      this.phase = 'ready'
      track('restriction_session_renewed', {})
      return true
    },

    async retry() {
      await this.boot()
    },
  },
})
