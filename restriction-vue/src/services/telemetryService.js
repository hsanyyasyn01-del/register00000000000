import { collectFingerprint, fingerprintHash } from './fingerprintService'

const queue = []
const emitted = []
const MAX_QUEUE = 100
const MAX_HISTORY = 40
let enabled = true
let context = {}

export function configureTelemetry(options = {}) {
  if (options.enabled === false) enabled = false
  context = { ...context, ...(options.context || {}) }
}

export function track(event, payload = {}) {
  if (!enabled) return
  if (queue.length >= MAX_QUEUE) queue.shift()
  queue.push({
    event,
    payload,
    ts: new Date().toISOString(),
    page: window.location.pathname,
  })
}

export function flush() {
  if (!enabled || !queue.length) return 0
  const snapshot = queue.slice(0, 20)
  for (const item of snapshot) {
    if (emitted.length >= MAX_HISTORY) emitted.shift()
    emitted.push({ ...item, fingerprint: fingerprintHash(collectFingerprint()) })
  }
  queue.length = 0
  return snapshot.length
}

export function disableTelemetry() {
  enabled = false
  queue.length = 0
}

export function flushWithBeacon() {
  return flush()
}

export function telemetrySnapshot() {
  return { context: { ...context }, history: emitted.slice(), pending: queue.length }
}
