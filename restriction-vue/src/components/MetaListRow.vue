<template>
  <div class="flex items-center justify-between gap-3 px-4 py-3.5 text-[13px]" :class="{ 'border-b border-hairline': !last }">
    <span class="text-txt-dim flex items-center gap-2">
      <i :class="icon + ' text-[11px] w-[16px] text-center'" />
      {{ label }}
    </span>
    <span class="font-semibold text-left" :class="valueClass" :dir="dir">{{ value }}</span>
  </div>
</template>

<script setup>
defineProps({
  icon: { type: String, default: 'fas fa-circle' },
  label: { type: String, required: true },
  value: { type: String, required: true },
  last: { type: Boolean, default: false },
  valueClass: { type: String, default: '' },
  dir: { type: String, default: 'auto' },
})
</script>
