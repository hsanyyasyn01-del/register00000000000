export function isValidUsername(value) {
  if (!value) return false
  const v = String(value).trim()
  if (v.length < 2 || v.length > 40) return false
  return /^[a-zA-Z0-9_.؀-ۿ]+$/.test(v)
}

export function isValidOtp(value) {
  return /^\d{6}$/.test(String(value || ''))
}

export function sanitizeOtpChar(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 1)
}
