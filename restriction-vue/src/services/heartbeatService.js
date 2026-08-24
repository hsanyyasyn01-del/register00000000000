import { read as storageRead, write as storageWrite } from './storageService'

const DISABLE_KEY = 'status-poll-disabled'
const MAX_FAILURES = 2

let timer = null
let lastBeat = null
let failures = 0

export function startHeartbeat(intervalMs, pollFn, onBeat) {
  stopHeartbeat()
  if (storageRead(DISABLE_KEY) === true) return
  if (typeof pollFn !== 'function') return
  failures = 0
  const ms = Math.max(10000, intervalMs || 25000)
  const beat = async () => {
    let result = null
    try {
      result = await pollFn()
    } catch (e) {
      result = null
    }
    if (result && result.ok) {
      failures = 0
      lastBeat = { at: Date.now(), ok: true }
    } else {
      failures += 1
      lastBeat = { at: Date.now(), ok: false }
    }
    if (failures >= MAX_FAILURES) {
      try { storageWrite(DISABLE_KEY, true) } catch (e) {}
      stopHeartbeat()
      return
    }
    if (typeof onBeat === 'function') onBeat(lastBeat, result)
  }
  beat()
  timer = setInterval(() => {
    if (document.hidden) return
    beat()
  }, ms)
}

export function stopHeartbeat() {
  if (timer) clearInterval(timer)
  timer = null
}

export function getLastBeat() {
  return lastBeat
}
