import { httpGet } from './http'
import { ENDPOINTS } from './endpoints'

export async function fetchRestrictionStatus() {
  try {
    const res = await httpGet(ENDPOINTS.status)
    if (!res.ok || !res.data) return null
    return res.data
  } catch (e) {
    return null
  }
}
