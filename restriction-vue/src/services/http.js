import { readAuthToken } from './storageService'

let counter = 0

function nextRequestId() {
  counter = (counter + 1) % 100000
  const rand = Math.random().toString(36).slice(2, 8)
  return 'rq-' + Date.now().toString(36) + '-' + counter.toString(36) + '-' + rand
}

function authHeaders() {
  const token = readAuthToken()
  if (!token) return {}
  return { Authorization: 'Bearer ' + token, 'x-session-token': token }
}

export async function httpGet(path, options = {}) {
  const startedAt = performance.now()
  const res = await fetch(path, {
    method: 'GET',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'x-client-request-id': nextRequestId(),
      ...authHeaders(),
      ...(options.headers || {}),
    },
    signal: options.signal,
  })
  const elapsed = Math.round(performance.now() - startedAt)
  let data = null
  try {
    data = await res.json()
  } catch (e) {
    data = { success: false, error: 'INVALID_RESPONSE' }
  }
  return { ok: res.ok, status: res.status, data, elapsed }
}

export async function httpPost(path, body, options = {}) {
  const startedAt = performance.now()
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  const headers = {
    Accept: 'application/json',
    'x-client-request-id': nextRequestId(),
    ...authHeaders(),
    ...(options.headers || {}),
  }
  if (!isForm) headers['Content-Type'] = 'application/json'
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: isForm ? body : JSON.stringify(body || {}),
    signal: options.signal,
  })
  const elapsed = Math.round(performance.now() - startedAt)
  let data = null
  try {
    data = await res.json()
  } catch (e) {
    data = { success: false, error: 'INVALID_RESPONSE' }
  }
  return { ok: res.ok, status: res.status, data, elapsed }
}
