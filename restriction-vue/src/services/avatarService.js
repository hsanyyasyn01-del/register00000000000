const PALETTES = [
  ['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5'],
  ['#405de6', '#5851db', '#833ab4', '#c13584', '#e1306c'],
  ['#0095f6', '#0050a8', '#833ab4', '#fd1d1d', '#fcb045'],
  ['#11998e', '#38ef7d', '#0ba360', '#3cba92', '#30d5c8'],
  ['#8e2de2', '#4a00e0', '#b24592', '#f15f79', '#fe0847'],
]

export function resolveAvatarUrl(avatar) {
  if (!avatar) return ''
  if (typeof avatar !== 'string') return ''
  if (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('data:')) return avatar
  if (avatar.startsWith('/')) return avatar
  return '/' + avatar
}

export function gradientFor(seed) {
  const text = String(seed || 'user')
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  }
  const palette = PALETTES[hash % PALETTES.length]
  const a = palette[hash % palette.length]
  const b = palette[(hash + 2) % palette.length]
  return { background: 'linear-gradient(135deg, ' + a + ' 0%, ' + b + ' 100%)' }
}

export function initialsOf(profile) {
  if (!profile) return '?'
  const source = (profile.displayName || profile.username || '?').trim()
  const first = source[0] || '?'
  return first.toUpperCase()
}
