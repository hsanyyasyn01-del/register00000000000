let offsetMs = 0
let calibrated = false

export function calibrateServerTime(serverTimeIso, rttMs = 0) {
  const serverMs = new Date(serverTimeIso).getTime()
  if (Number.isNaN(serverMs)) return false
  offsetMs = serverMs + Math.round(rttMs / 2) - Date.now()
  calibrated = true
  return true
}

export function now() {
  return Date.now() + (calibrated ? offsetMs : 0)
}

export function nowIso() {
  return new Date(now()).toISOString()
}

export function isCalibrated() {
  return calibrated
}

export function clockSkewMs() {
  return calibrated ? offsetMs : 0
}
