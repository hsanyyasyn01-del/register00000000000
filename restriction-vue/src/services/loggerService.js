const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 }
let minLevel = LEVELS.info
const buffer = []
const MAX_BUFFER = 200

export function setLogLevel(level) {
  if (LEVELS[level]) minLevel = LEVELS[level]
}

function write(level, scope, message, data) {
  if (LEVELS[level] < minLevel) return
  const entry = { level, scope, message, data: data || null, ts: Date.now() }
  if (buffer.length >= MAX_BUFFER) buffer.shift()
  buffer.push(entry)
  const fn = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'debug'
  try {
    console[fn]('[restriction:' + scope + ']', message, data !== undefined ? data : '')
  } catch (e) {}
}

export function createLogger(scope) {
  return {
    debug: (m, d) => write('debug', scope, m, d),
    info: (m, d) => write('info', scope, m, d),
    warn: (m, d) => write('warn', scope, m, d),
    error: (m, d) => write('error', scope, m, d),
  }
}

export function getLogBuffer() {
  return buffer.slice()
}
