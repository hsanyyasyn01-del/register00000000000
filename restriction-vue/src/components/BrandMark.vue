<template>
  <div class="flex items-center justify-center" :style="{ width: size + 'px', height: size + 'px' }">
    <svg :width="size" :height="size" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="logo">
      <rect x="2" y="2" width="44" height="44" rx="12" stroke="url(#bm-g)" stroke-width="2.5" />
      <circle cx="24" cy="24" r="11" stroke="url(#bm-g)" stroke-width="2.5" />
      <circle cx="35.5" cy="12.5" r="2.5" fill="url(#bm-g)" />
      <defs>
        <linearGradient id="bm-g" x1="0" y1="48" x2="48" y2="0" gradientUnits="userSpaceOnUse">
          <stop stop-color="#feda75" />
          <stop offset="0.35" stop-color="#fa7e1e" />
          <stop offset="0.65" stop-color="#d62976" />
          <stop offset="1" stop-color="#4f5bd5" />
        </linearGradient>
      </defs>
    </svg>
  </div>
</template>

<script setup>
defineProps({
  size: { type: Number, default: 40 },
})
</script>
