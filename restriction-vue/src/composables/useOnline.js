import { ref, onMounted, onUnmounted } from 'vue'
import { emit } from '../services/eventBus'

const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)

function handleOnline() {
  online.value = true
  emit('connectivity', { online: true })
}

function handleOffline() {
  online.value = false
  emit('connectivity', { online: false })
}

export function useOnline() {
  onMounted(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  })
  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  })
  return { online }
}
