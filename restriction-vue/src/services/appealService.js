import { httpPost, httpGet } from './http'
import { ENDPOINTS } from './endpoints'

export async function submitCaptcha(captchaToken) {
  const res = await httpPost(ENDPOINTS.verifyCaptcha, { captchaToken })
  return res.data
}

export async function requestOtp(sessionToken, username) {
  const res = await httpPost(ENDPOINTS.sendOtp, { sessionToken, username })
  return res.data
}

export async function submitOtp(sessionToken, otp) {
  const res = await httpPost(ENDPOINTS.verifyOtp, { sessionToken, otp })
  return res.data
}

export async function submitSelfie(sessionToken, blob) {
  const fd = new FormData()
  fd.append('selfie', blob, 'selfie-' + Date.now() + '.jpg')
  fd.append('sessionToken', sessionToken)
  const res = await httpPost(ENDPOINTS.uploadPhoto, fd)
  return res.data
}

export async function fetchAppealStatus() {
  try {
    const res = await httpGet(ENDPOINTS.appealStatus)
    return res.data
  } catch (e) {
    return null
  }
}

export async function logoutRestricted() {
  try {
    await httpPost(ENDPOINTS.logout, {})
  } catch (e) {}
}
