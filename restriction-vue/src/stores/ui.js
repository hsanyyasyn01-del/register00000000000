import { defineStore } from 'pinia'

let toastSeq = 0

export const useUiStore = defineStore('ui', {
  state: () => ({
    toast: { id: 0, show: false, msg: '', type: 'success' },
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    lastHeartbeat: null,
  }),

  actions: {
    showToast(msg, type = 'success') {
      toastSeq += 1
      this.toast = { id: toastSeq, show: true, msg, type }
      setTimeout(() => {
        if (this.toast.id === toastSeq) {
          this.toast = { ...this.toast, show: false }
        }
      }, 3200)
    },

    setOnline(value) {
      this.online = !!value
    },

    setHeartbeat(info) {
      this.lastHeartbeat = info
    },
  },
})
