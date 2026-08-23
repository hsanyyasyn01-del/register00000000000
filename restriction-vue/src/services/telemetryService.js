import { httpPost } from './http'
import { ENDPOINTS } from './endpoints'
import { collectFingerprint, fingerprintHash } from './fingerprintService'
import { clockSkewMs } from './clockService'

const queue = []
const MAX_BATCH = 20
let flushTimer = null
let enabled = true
let context = {}

export function configureTelemetry(options = {}) {
  if (options.enabled === false) enabled = false
  context = { ...context, ...(options.context || {}) }
}

export function track(event, payload = {}) {
  if (!enabled) return
  if (queue.length >= 100) queue.shift()
  queue.push({
    event,
    payload,
    ts: new Date().toISOString(),
    page: window.location.pathname,
  })
  scheduleFlush(event === 'restriction_error' ? 0 : 1500)
}

function scheduleFlush(delay) {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(flush, delay)
}

export function disableTelemetry() {
  enabled = false
  queue.length = 0
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
}

export async function flush() {
  if (!enabled || !queue.length) return
  const events = queue.splice(0, MAX_BATCH)
  try {
    const res = await httpPost(ENDPOINTS.telemetry, { events, context: contextSnapshot() })
    if (!res || res.ok !== true) disableTelemetry()
  } catch (e) {
    disableTelemetry()
  }
}

function contextSnapshot() {
  const fingerprint = collectFingerprint()
  return {
    ...context,
    fingerprint: fingerprintHash(fingerprint),
    fingerprintDetail: fingerprint,
    clockSkewMs: clockSkewMs(),
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform || '',
    viewport: { w: window.innerWidth, h: window.innerHeight },
    screen: { w: window.screen.width, h: window.screen.height, dpr: window.devicePixelRatio || 1 },
    connection: readConnection(),
    timezone: readTimezone(),
  }
}

function readConnection() {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  if (!c) return null
  return { effectiveType: c.effectiveType || null, downlink: c.downlink || null, rtt: c.rtt || null, saveData: !!c.saveData }
}

function readTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch (e) {
    return null
  }
}

export function flushWithBeacon() {
  if (!enabled || !queue.length) return
  const events = queue.splice(0, MAX_BATCH)
  const body = JSON.stringify({ events, context: contextSnapshot() })
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' })
      navigator.sendBeacon(ENDPOINTS.telemetry, blob)
      return
    }
  } catch (e) {}
  try {
    fetch(ENDPOINTS.telemetry, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true })
  } catch (e) {}
}
