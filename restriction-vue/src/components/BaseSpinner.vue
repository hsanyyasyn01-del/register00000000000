<template>
  <div class="flex items-center justify-center" :style="{ width: size + 'px', height: size + 'px' }">
    <div class="spinner-ring" :style="{ width: size + 'px', height: size + 'px', borderWidth: Math.max(2, size / 10) + 'px' }" />
  </div>
</template>

<script setup>
defineProps({
  size: { type: Number, default: 28 },
})
</script>

<style scoped>
.spinner-ring {
  border-style: solid;
  border-color: #363636;
  border-top-color: #a8a8a8;
  border-radius: 50%;
  animation: spinRing 0.8s linear infinite;
}
@keyframes spinRing {
  to { transform: rotate(360deg); }
}
</style>
