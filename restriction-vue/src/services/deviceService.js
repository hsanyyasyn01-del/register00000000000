export function describeDevice() {
  const ua = navigator.userAgent || ''
  let browser = 'Browser'
  const chromeMatch = ua.match(/Chrome\/(\d+)/)
  const firefoxMatch = ua.match(/Firefox\/(\d+)/)
  const safariMatch = ua.match(/Version\/(\d+).*Safari/)
  const edgeMatch = ua.match(/Edg\/(\d+)/)
  if (edgeMatch) browser = 'Edge ' + edgeMatch[1]
  else if (chromeMatch && !/OPR\//.test(ua)) browser = 'Chrome ' + chromeMatch[1]
  else if (firefoxMatch) browser = 'Firefox ' + firefoxMatch[1]
  else if (safariMatch) browser = 'Safari ' + safariMatch[1]
  let os = 'Unknown OS'
  if (/Windows NT 10/.test(ua)) os = 'Windows 10'
  else if (/Windows NT 11/.test(ua)) os = 'Windows 11'
  else if (/Windows/.test(ua)) os = 'Windows'
  else if (/iPhone|iPad/.test(ua)) os = 'iOS'
  else if (/Mac OS X/.test(ua)) os = 'macOS'
  else if (/Android/.test(ua)) os = 'Android'
  else if (/Linux/.test(ua)) os = 'Linux'
  const mobile = /Mobi|Android|iPhone|iPad/.test(ua)
  return { browser, os, mobile, label: os + ' · ' + browser }
}

export function isTouchDevice() {
  return (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window
}
