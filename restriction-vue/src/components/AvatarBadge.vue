<template>
  <div class="relative shrink-0" :style="{ width: size + 'px', height: size + 'px' }">
    <div class="absolute inset-0 rounded-full p-[3px]" :style="ringStyle">
      <div class="w-full h-full rounded-full bg-black p-[3px]">
        <img
          v-if="src && !failed"
          :src="src"
          :alt="alt"
          class="w-full h-full rounded-full object-cover"
          referrerpolicy="no-referrer"
          @error="failed = true"
        >
        <div v-else class="w-full h-full rounded-full flex items-center justify-center text-white font-bold" :style="[{ background: fallbackStyle.background }, { fontSize: size * 0.38 + 'px' }]">
          {{ initial }}
        </div>
      </div>
    </div>
    <div v-if="restricted" class="absolute -bottom-1 -end-1 w-[22px] h-[22px] rounded-full bg-danger border-[3px] border-black flex items-center justify-center">
      <i class="fas fa-ban text-[9px] text-white" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { resolveAvatarUrl, gradientFor, initialsOf } from '../services/avatarService'

const props = defineProps({
  profile: { type: Object, default: null },
  size: { type: Number, default: 88 },
  restricted: { type: Boolean, default: true },
})

const failed = ref(false)

const src = computed(() => resolveAvatarUrl(props.profile && props.profile.avatar))
const alt = computed(() => (props.profile && (props.profile.displayName || props.profile.username)) || 'avatar')
const initial = computed(() => initialsOf(props.profile))
const fallbackStyle = computed(() => gradientFor(props.profile && props.profile.username))

const ringStyle = {
  background: 'conic-gradient(from 210deg, #feda75, #fa7e1e, #d62976, #962fbf, #4f5bd5, #feda75)',
}
</script>
