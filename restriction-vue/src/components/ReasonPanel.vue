<template>
  <div class="card-surface p-4 mb-6">
    <div class="flex items-center gap-2.5 mb-2">
      <div class="w-[30px] h-[30px] rounded-lg bg-danger/10 border border-danger/25 flex items-center justify-center">
        <i class="fas fa-scale-balanced text-danger text-[12px]" />
      </div>
      <p class="text-[13px] font-bold">{{ t('whyTitle') }}</p>
    </div>
    <p class="text-[13px] text-txt-dim leading-relaxed">{{ reason }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18nStore } from '../stores/i18n'

const props = defineProps({
  profile: { type: Object, default: null },
})

const i18n = useI18nStore()

const reason = computed(() => {
  const r = props.profile && props.profile.reason
  return r && String(r).trim() ? String(r) : i18n.t('defaultReason')
})

function t(key) {
  return i18n.t(key)
}
</script>
