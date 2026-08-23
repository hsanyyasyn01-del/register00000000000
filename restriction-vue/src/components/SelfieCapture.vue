<template>
  <div class="text-center animate-fade-in">
    <StepBadge tone="blue" icon="fas fa-camera" />

    <h2 class="text-[21px] font-bold mb-2 tracking-tight">{{ t('stepSelfieTitle') }}</h2>
    <p class="text-[13px] text-txt-dim leading-relaxed mb-6 px-2">
      {{ t('stepSelfieBody') }}
    </p>

    <div class="relative w-full max-w-[280px] h-[360px] mx-auto mb-5 rounded-2xl bg-panel overflow-hidden border border-border">
      <div v-if="!captured && !cameraError" class="absolute inset-0 flex items-center justify-center z-[1]">
        <div class="text-center">
          <BaseSpinner :size="26" class="mx-auto mb-3" />
          <p class="text-txt-dim text-[12px]">{{ t('cameraWaiting') }}</p>
        </div>
      </div>

      <div v-if="cameraError" class="absolute inset-0 flex items-center justify-center z-[3] px-6">
        <div>
          <i class="fas fa-video-slash text-[36px] text-danger mb-3" />
          <p class="text-danger text-[13px] mb-3">{{ t('cameraError') }}</p>
          <BaseButton variant="primary" icon="fas fa-rotate-right" class="max-w-[180px] mx-auto text-[12px]" @click="retryCamera">
            {{ t('cameraRetry') }}
          </BaseButton>
        </div>
      </div>

      <video
        ref="videoRef"
        class="absolute inset-0 w-full h-full object-cover z-[2] -scale-x-100"
        autoplay
        playsinline
        muted
        v-show="!captured && !cameraError"
      />
      <img v-if="capturedImg" :src="capturedImg" class="absolute inset-0 w-full h-full object-cover z-[2]" alt="selfie preview">

      <canvas ref="canvasRef" class="hidden" />

      <button
        v-if="!captured && stream && !cameraError"
        class="absolute bottom-4 left-1/2 -translate-x-1/2 z-[5] w-[54px] h-[54px] rounded-full border-4 border-white bg-white/10 hover:bg-white/25 transition-all active:scale-90"
        :aria-label="t('capture')"
        @click="handleCapture"
      />
    </div>

    <Transition name="capturezone" mode="out-in">
      <BaseButton v-if="!captured" key="cap" variant="primary" icon="fas fa-camera" :disabled="!stream || !!cameraError" @click="handleCapture">
        {{ t('capture') }}
      </BaseButton>
      <div v-else key="up">
        <BaseButton variant="primary" icon="fas fa-cloud-arrow-up" :busy="appeal.loading.key === 'upload'" @click="handleUpload">
          {{ appeal.loading.key === 'upload' ? t('submitting') : t('submitReview') }}
        </BaseButton>
        <BaseButton variant="secondary" icon="fas fa-rotate-left" :disabled="appeal.loading.active" @click="handleRetake">
          {{ t('retake') }}
        </BaseButton>
      </div>
    </Transition>

    <BaseButton v-if="!captured" variant="secondary" @click="appeal.prevStep()">{{ t('back') }}</BaseButton>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useAppealStore } from '../stores/appeal'
import { useI18nStore } from '../stores/i18n'
import { startCamera, stopCamera, capturePhoto } from '../services/cameraService'
import { track } from '../services/telemetryService'
import { usePageVisibility } from '../composables/usePageVisibility'
import StepBadge from './StepBadge.vue'
import BaseButton from './BaseButton.vue'
import BaseSpinner from './BaseSpinner.vue'

const appeal = useAppealStore()
const i18n = useI18nStore()

const videoRef = ref(null)
const canvasRef = ref(null)
const stream = ref(null)
const captured = ref(false)
const capturedImg = ref(null)
const cameraError = ref(false)

usePageVisibility((isHidden) => {
  if (isHidden) {
    if (stream.value) {
      stopCamera(stream.value)
      stream.value = null
      pausedByVisibility = true
    }
  } else if (pausedByVisibility && !captured.value) {
    pausedByVisibility = false
    initCamera()
  }
})

let pausedByVisibility = false

onMounted(async () => {
  await new Promise((resolve) => setTimeout(resolve, 120))
  await initCamera()
})

onUnmounted(() => {
  stopCamera(stream.value)
})

async function initCamera() {
  try {
    cameraError.value = false
    stream.value = await startCamera(videoRef.value)
    track('restriction_camera_ready', {})
  } catch (e) {
    cameraError.value = true
    track('restriction_camera_denied', { name: e && e.name ? e.name : 'unknown' })
  }
}

async function retryCamera() {
  stopCamera(stream.value)
  stream.value = null
  captured.value = false
  clearPreview()
  await initCamera()
}

async function handleCapture() {
  try {
    const blob = await capturePhoto(videoRef.value, canvasRef.value)
    appeal.capturedBlob = blob
    captured.value = true
    capturedImg.value = URL.createObjectURL(blob)
    stopCamera(stream.value)
    stream.value = null
    track('restriction_camera_capture', { bytes: blob.size })
  } catch (e) {
    appeal.toast(t('genericError'), 'error')
  }
}

function clearPreview() {
  if (capturedImg.value) {
    try { URL.revokeObjectURL(capturedImg.value) } catch (e) {}
    capturedImg.value = null
  }
}

async function handleRetake() {
  captured.value = false
  appeal.capturedBlob = null
  clearPreview()
  await initCamera()
}

async function handleUpload() {
  await appeal.uploadSelfie()
  if (appeal.step === 5) clearPreview()
}

function t(key) {
  return i18n.t(key)
}
</script>

<style scoped>
.capturezone-enter-active,
.capturezone-leave-active { transition: all 0.3s ease; }
.capturezone-enter-from,
.capturezone-leave-to { opacity: 0; transform: translateY(8px); }
</style>
