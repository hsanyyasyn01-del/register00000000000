<template>
  <div class="card-surface p-5 mb-6">
    <div class="flex items-center gap-4">
      <AvatarBadge :profile="profile" :size="72" :restricted="true" />
      <div class="min-w-0 flex-1">
        <p class="text-[16px] font-bold truncate leading-snug">{{ displayName }}</p>
        <p class="text-[13px] text-txt-dim truncate" dir="ltr" style="text-align: end">@{{ username }}</p>
        <div class="mt-2">
          <StatusBadge :status="profile && profile.appealStatus" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent } from 'vue'

const AvatarBadge = defineAsyncComponent(() => import('./AvatarBadge.vue'))
const StatusBadge = defineAsyncComponent(() => import('./StatusBadge.vue'))

const props = defineProps({
  profile: { type: Object, default: null },
})

const displayName = computed(() => (props.profile && (props.profile.displayName || props.profile.username)) || '—')
const username = computed(() => (props.profile && props.profile.username) || '—')
</script>
