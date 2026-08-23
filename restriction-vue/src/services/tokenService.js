const PATH_PATTERN = /restriction\.html\/([A-Za-z0-9]+)/

export function readTokenFromUrl() {
  const match = window.location.pathname.match(PATH_PATTERN)
  if (!match) return ''
  return match[1]
}

export function replaceUrlToken(token) {
  try {
    const url = '/restriction.html/' + token
    window.history.replaceState({ restrictionToken: token }, '', url)
    return true
  } catch (e) {
    return false
  }
}

export function tokenHint(token) {
  if (!token) return ''
  return token.slice(0, 6) + '…' + token.slice(-4)
}
