export function formatDate(value, locale = 'ar') {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(d)
  } catch (e) {
    return d.toLocaleDateString()
  }
}

export function formatDateTime(value, locale = 'ar') {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(d)
  } catch (e) {
    return d.toLocaleString()
  }
}

export function formatRelative(value, locale = 'ar') {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const diff = d.getTime() - Date.now()
  const abs = Math.abs(diff)
  const units = [
    { limit: 60000, div: 1000, unit: 'second' },
    { limit: 3600000, div: 60000, unit: 'minute' },
    { limit: 86400000, div: 3600000, unit: 'hour' },
    { limit: 2592000000, div: 86400000, unit: 'day' },
    { limit: Infinity, div: 2592000000, unit: 'month' },
  ]
  for (const u of units) {
    if (abs < u.limit) {
      const amount = Math.round(diff / u.div)
      try {
        return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(amount, u.unit)
      } catch (e) {
        return String(amount) + ' ' + u.unit
      }
    }
  }
  return ''
}

export function addDays(iso, days) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + days)
  return d.toISOString()
}
