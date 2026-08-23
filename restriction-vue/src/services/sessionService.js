import { httpGet, httpPost } from './http'
import { ENDPOINTS } from './endpoints'

export async function fetchSessionProfile(token) {
  if (!token) return { ok: false, reason: 'NO_TOKEN' }
  try {
    const res = await httpGet(ENDPOINTS.session(token))
    if (res.status === 404) return { ok: false, reason: 'EXPIRED' }
    if (!res.ok || !res.data || res.data.success !== true) return { ok: false, reason: 'ERROR' }
    return { ok: true, profile: res.data.profile, restricted: res.data.restricted === true }
  } catch (e) {
    return { ok: false, reason: 'NETWORK' }
  }
}

export async function mintSessionToken() {
  try {
    const res = await httpPost(ENDPOINTS.token, {})
    if (!res.ok || !res.data || res.data.success !== true || !res.data.token) {
      return { ok: false, reason: res.data && res.data.error ? res.data.error : 'ERROR' }
    }
    return { ok: true, token: res.data.token, url: res.data.url || null }
  } catch (e) {
    return { ok: false, reason: 'NETWORK' }
  }
}

export async function fetchRestrictionStatus() {
  try {
    const res = await httpGet(ENDPOINTS.status)
    if (!res.ok || !res.data) return null
    return res.data
  } catch (e) {
    return null
  }
}
