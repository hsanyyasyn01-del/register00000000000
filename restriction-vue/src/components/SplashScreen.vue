<template>
  <div class="min-h-dvh flex flex-col items-center justify-center px-6">
    <BrandMark :size="64" class="mb-8 opacity-90" />
    <div class="w-full max-w-[440px] space-y-4">
      <div class="flex items-center gap-4">
        <div class="skeleton-shimmer w-[72px] h-[72px] rounded-full shrink-0" />
        <div class="flex-1 space-y-2">
          <div class="skeleton-shimmer h-4 w-2/3" />
          <div class="skeleton-shimmer h-3 w-1/3" />
        </div>
      </div>
      <div class="skeleton-shimmer h-6 w-3/4 mx-auto" />
      <div class="skeleton-shimmer h-3.5 w-full" />
      <div class="skeleton-shimmer h-3.5 w-5/6 mx-auto" />
      <div class="skeleton-shimmer h-24 w-full rounded-2xl" />
      <div class="skeleton-shimmer h-12 w-full rounded-lg" />
    </div>
    <BaseSpinner class="mt-10" />
  </div>
</template>

<script setup>
import BrandMark from './BrandMark.vue'
import BaseSpinner from './BaseSpinner.vue'
</script>
