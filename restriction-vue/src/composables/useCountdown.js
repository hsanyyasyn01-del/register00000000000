import { ref, computed, onUnmounted } from 'vue'

export function useCountdown() {
  const remaining = ref(0)
  let timer = null

  const active = computed(() => remaining.value > 0)

  function start(seconds) {
    stop()
    remaining.value = seconds
    timer = setInterval(() => {
      remaining.value = Math.max(0, remaining.value - 1)
      if (remaining.value === 0) stop()
    }, 1000)
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
  }

  onUnmounted(stop)

  return { remaining, active, start, stop }
}
