import { httpGet } from './http'
import { ENDPOINTS } from './endpoints'

let timer = null
let lastBeat = null

export function startHeartbeat(intervalMs, onBeat) {
  stopHeartbeat()
  const ms = Math.max(10000, intervalMs || 25000)
  const beat = async () => {
    try {
      const res = await httpGet(ENDPOINTS.heartbeat)
      lastBeat = { at: Date.now(), ok: res.ok, serverTime: res.data && res.data.serverTime ? res.data.serverTime : null }
      if (typeof onBeat === 'function') onBeat(lastBeat)
    } catch (e) {
      lastBeat = { at: Date.now(), ok: false, serverTime: null }
      if (typeof onBeat === 'function') onBeat(lastBeat)
    }
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
