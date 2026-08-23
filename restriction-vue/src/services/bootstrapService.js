import { httpGet } from './http'
import { ENDPOINTS } from './endpoints'
import { calibrateServerTime } from './clockService'

const FALLBACK = {
  success: true,
  brand: { name: 'Hassani GPT', logo: '/1234.png' },
  captcha: { siteKey: 'ea14e556-79e8-46a4-a59e-21d8653267be', enabled: true },
  features: { appealEnabled: true, cameraEnabled: true, heartbeatMs: 25000, telemetryEnabled: true },
  links: { help: '/help.html', terms: '/terms.html', privacy: '/privacy.html', about: '/about.html', login: '/login.html', home: '/messenger1.html' },
  serverTime: null,
}

export async function fetchBootstrap(timeoutMs = 8000) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const { ok, data, elapsed } = await httpGet(ENDPOINTS.bootstrap, { signal: controller.signal })
    clearTimeout(timer)
    if (!ok || !data || data.success !== true) return { ...FALLBACK, source: 'fallback' }
    if (data.serverTime) calibrateServerTime(data.serverTime, elapsed || 0)
    return { ...FALLBACK, ...data, source: 'remote' }
  } catch (e) {
    return { ...FALLBACK, source: 'fallback' }
  }
}
