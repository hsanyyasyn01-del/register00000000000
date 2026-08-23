<template>
  <div class="text-center mb-6">
    <h1 class="hero-title text-[21px] font-bold mb-1.5 tracking-tight">{{ title }}</h1>
    <p class="text-[13px] text-txt-dim mb-3">{{ subtitle }}</p>
    <p class="text-[13px] text-txt-dim leading-relaxed px-1">{{ body }}</p>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  body: { type: String, default: '' },
})
</script>

<style scoped>
.hero-title {
  background: linear-gradient(120deg, #f5f5f5 30%, #a8a8a8 90%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>
