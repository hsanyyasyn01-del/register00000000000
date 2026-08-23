import { track } from './telemetryService'

let reported = false

export function collectAndReport() {
  if (reported) return
  reported = true
  const metrics = {}
  try {
    const nav = performance.getEntriesByType('navigation')[0]
    if (nav) {
      metrics.ttfb = Math.round(nav.responseStart)
      metrics.domInteractive = Math.round(nav.domInteractive)
      metrics.domComplete = Math.round(nav.domComplete)
      metrics.loadEvent = Math.round(nav.loadEventEnd)
      metrics.transferSize = nav.transferSize || 0
      metrics.encodedBodySize = nav.encodedBodySize || 0
    }
  } catch (e) {}
  try {
    const paints = performance.getEntriesByType('paint')
    for (const p of paints) {
      if (p.name === 'first-paint') metrics.firstPaint = Math.round(p.startTime)
      if (p.name === 'first-contentful-paint') metrics.fcp = Math.round(p.startTime)
    }
  } catch (e) {}
  try {
    const resources = performance.getEntriesByType('resource')
    metrics.resourceCount = resources.length
    metrics.resourceBytes = resources.reduce((sum, r) => sum + (r.encodedBodySize || 0), 0)
  } catch (e) {}
  track('restriction_perf', metrics)
}

export function observeLcp() {
  try {
    if (typeof PerformanceObserver === 'undefined') return
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const last = entries[entries.length - 1]
      if (last) track('restriction_lcp', { value: Math.round(last.startTime) })
    })
    observer.observe({ type: 'largest-contentful-paint', buffered: true })
    setTimeout(() => { try { observer.disconnect() } catch (e) {} }, 15000)
  } catch (e) {}
}

export function observeCls() {
  try {
    if (typeof PerformanceObserver === 'undefined') return
    let cls = 0
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) cls += entry.value
      }
    })
    observer.observe({ type: 'layout-shift', buffered: true })
    setTimeout(() => {
      try { observer.disconnect() } catch (e) {}
      track('restriction_cls', { value: Math.round(cls * 1000) / 1000 })
    }, 12000)
  } catch (e) {}
}
