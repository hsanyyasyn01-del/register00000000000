import { ref, onMounted, onUnmounted } from 'vue'

const hidden = ref(typeof document !== 'undefined' ? document.hidden : false)
const watchers = new Set()

function handleChange() {
  hidden.value = document.hidden
  for (const fn of Array.from(watchers)) {
    try {
      fn(document.hidden)
    } catch (e) {}
  }
}

export function usePageVisibility(onChange) {
  if (typeof onChange === 'function') watchers.add(onChange)
  onMounted(() => document.addEventListener('visibilitychange', handleChange))
  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleChange)
    if (typeof onChange === 'function') watchers.delete(onChange)
  })
  return { hidden }
}
