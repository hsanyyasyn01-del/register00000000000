import { httpGet } from './http'
import { ENDPOINTS } from './endpoints'
import { read as storageRead, write as storageWrite } from './storageService'
import ar from '../i18n/ar'
import en from '../i18n/en'

const LOCALES = { ar, en }
const DISABLE_KEY = 'i18n-disabled'

export function resolveLocale(explicit) {
  if (explicit && LOCALES[explicit]) return explicit
  try {
    const stored = localStorage.getItem('userLang') || localStorage.getItem('Cosmos-language')
    if (stored && LOCALES[stored]) return stored
  } catch (e) {}
  const nav = (navigator.language || '').slice(0, 2).toLowerCase()
  if (LOCALES[nav]) return nav
  return 'ar'
}

export function localBundle(code) {
  return LOCALES[code] || LOCALES.ar
}

export async function fetchRemoteMessages(code) {
  try {
    if (storageRead(DISABLE_KEY) === true) return null
    const { ok, status, data } = await httpGet(ENDPOINTS.i18n(code))
    if (status === 401 || status === 403) {
      try { storageWrite(DISABLE_KEY, true) } catch (e) {}
      return null
    }
    if (!ok || !data || data.success !== true || !data.messages) return null
    return data.messages
  } catch (e) {
    return null
  }
}
