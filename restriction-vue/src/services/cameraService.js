export async function startCamera(videoEl) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  })
  videoEl.srcObject = stream
  await videoEl.play().catch(() => {})
  return stream
}

export function stopCamera(stream) {
  if (!stream) return
  try {
    stream.getTracks().forEach((t) => t.stop())
  } catch (e) {}
}

export function capturePhoto(videoEl, canvasEl) {
  return new Promise((resolve, reject) => {
    try {
      canvasEl.width = videoEl.videoWidth || 640
      canvasEl.height = videoEl.videoHeight || 480
      const ctx = canvasEl.getContext('2d')
      ctx.translate(canvasEl.width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height)
      canvasEl.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('CAPTURE_FAILED'))
      }, 'image/jpeg', 0.85)
    } catch (e) {
      reject(e)
    }
  })
}
