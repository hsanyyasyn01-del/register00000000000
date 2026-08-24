import { calibrateServerTime } from './clockService'

const FALLBACK = {
  success: true,
  brand: { name: 'Hassani GPT', logo: '/1234.png' },
  captcha: { siteKey: 'ea14e556-79e8-46a4-a59e-21d8653267be', enabled: true },
  features: { appealEnabled: true, cameraEnabled: true, heartbeatMs: 25000, telemetryEnabled: true },
  links: { help: '/help.html', terms: '/terms.html', privacy: '/privacy.html', about: '/about.html', login: '/login.html', home: '/messenger1.html' },
  serverTime: null,
}

export function hasInjectedBoot() {
  try {
    return !!window.__RESTRICTION_BOOT__
  } catch (e) {
    return false
  }
}

export function readInjectedConfig() {
  try {
    const boot = window.__RESTRICTION_BOOT__
    if (boot && boot.cfg && boot.cfg.brand) return boot.cfg
  } catch (e) {}
  return null
}

export async function fetchBootstrap() {
  const injected = readInjectedConfig()
  if (injected) {
    if (injected.serverTime) calibrateServerTime(injected.serverTime, 0)
    return { ...FALLBACK, ...injected, success: true, source: 'injected' }
  }
  return { ...FALLBACK, source: 'fallback' }
}
