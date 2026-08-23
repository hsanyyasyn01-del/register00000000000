import { onMounted, onUnmounted } from 'vue'

export function useInterval(fn, ms, options = {}) {
  let timer = null
  const start = () => {
    stop()
    timer = setInterval(fn, ms)
    if (options.immediate) fn()
  }
  const stop = () => {
    if (timer) clearInterval(timer)
    timer = null
  }
  onMounted(start)
  onUnmounted(stop)
  return { start, stop }
}
