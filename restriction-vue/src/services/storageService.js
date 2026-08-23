const PREFIX = 'restriction:'

export function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    return JSON.parse(raw)
  } catch (e) {
    return fallback
  }
}

export function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
    return true
  } catch (e) {
    return false
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch (e) {}
}

export function readAuthToken() {
  const keys = ['sessionToken', 'hassani_token', 'session_token', 'Cosmos_session']
  for (const k of keys) {
    try {
      const v = localStorage.getItem(k)
      if (v) return v
    } catch (e) {}
  }
  return ''
}
