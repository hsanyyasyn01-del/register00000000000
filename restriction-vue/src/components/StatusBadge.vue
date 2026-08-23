<template>
  <span class="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full" :class="badgeClass">
    <span class="w-1.5 h-1.5 rounded-full" :class="dotClass" />
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { useI18nStore } from '../stores/i18n'

const props = defineProps({
  status: { type: String, default: '' },
})

const i18n = useI18nStore()

const pending = computed(() => props.status === 'pending')

const badgeClass = computed(() =>
  pending.value ? 'bg-warn/10 text-warn border border-warn/30' : 'bg-danger/10 text-danger border border-danger/30'
)

const dotClass = computed(() => (pending.value ? 'bg-warn animate-pulse-dot' : 'bg-danger'))

const label = computed(() =>
  pending.value ? i18n.t('statusAppealPending') : i18n.t('statusRestricted')
)
</script>
