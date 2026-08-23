import { watch, onMounted } from 'vue'

export function useDocumentTitle(titleGetter) {
  const apply = () => {
    try {
      const value = typeof titleGetter === 'function' ? titleGetter() : String(titleGetter || '')
      if (value) document.title = value
    } catch (e) {}
  }
  onMounted(apply)
  if (typeof titleGetter === 'function') {
    watch(titleGetter, apply)
  }
  return { apply }
}
