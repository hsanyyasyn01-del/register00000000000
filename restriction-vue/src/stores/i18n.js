import { defineStore } from 'pinia'
import { resolveLocale, localBundle } from '../services/i18nService'

export const useI18nStore = defineStore('i18n', {
  state: () => ({
    locale: 'ar',
    dir: 'rtl',
    messages: {},
    remoteLoaded: false,
  }),

  actions: {
    async init(explicit) {
      const code = resolveLocale(explicit)
      const bundle = localBundle(code)
      this.locale = code
      this.dir = bundle.meta.dir
      this.messages = { ...bundle.messages }
      this.applyDocumentDirection()
    },

    applyDocumentDirection() {
      try {
        document.documentElement.setAttribute('lang', this.locale)
        document.documentElement.setAttribute('dir', this.dir)
      } catch (e) {}
    },

    t(key, params) {
      let text = this.messages[key]
      if (text === undefined || text === null) return key
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp('\\{' + k + '\\}', 'g'), String(v))
        }
      }
      return text
    },
  },
})
