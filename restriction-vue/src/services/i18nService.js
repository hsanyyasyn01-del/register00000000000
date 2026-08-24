import ar from '../i18n/ar'
import en from '../i18n/en'

const LOCALES = { ar, en }

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

export function supportedLocales() {
  return Object.keys(LOCALES)
}
