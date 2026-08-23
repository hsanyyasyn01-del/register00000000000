import { httpGet } from './http'
import { ENDPOINTS } from './endpoints'
import { read as storageRead, write as storageWrite } from './storageService'

const DISABLE_KEY = 'heartbeat-disabled'
const MAX_FAILURES = 2

let timer = null
let lastBeat = null
let failures = 0

export function startHeartbeat(intervalMs, onBeat) {
  stopHeartbeat()
  if (storageRead(DISABLE_KEY) === true) return
  failures = 0
  const ms = Math.max(10000, intervalMs || 25000)
  const beat = async () => {
    try {
      const res = await httpGet(ENDPOINTS.heartbeat)
      if (res.ok) {
        failures = 0
        lastBeat = { at: Date.now(), ok: true, serverTime: res.data && res.data.serverTime ? res.data.serverTime : null }
      } else {
        failures += 1
        lastBeat = { at: Date.now(), ok: false, serverTime: null }
      }
    } catch (e) {
      failures += 1
      lastBeat = { at: Date.now(), ok: false, serverTime: null }
    }
    if (failures >= MAX_FAILURES) {
      try { storageWrite(DISABLE_KEY, true) } catch (e) {}
      stopHeartbeat()
      return
    }
    if (typeof onBeat === 'function') onBeat(lastBeat)
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
