<template>
  <button :class="buttonClass" :disabled="disabled || busy">
    <i v-if="busy" class="fas fa-circle-notch fa-spin" />
    <i v-else-if="icon" :class="icon" />
    <slot />
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: { type: String, default: 'primary' },
  icon: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const buttonClass = computed(() => (props.variant === 'secondary' ? 'btn-secondary' : 'btn-primary'))
</script>
