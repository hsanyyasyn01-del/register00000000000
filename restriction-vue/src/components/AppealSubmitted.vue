<template>
  <div class="text-center animate-fade-in">
    <StepBadge tone="green" icon="fas fa-check" />

    <div class="inline-flex items-center gap-1.5 bg-success/10 border border-success/25 text-success text-[11.5px] font-bold px-3 py-1.5 rounded-full mb-4">
      <i class="fas fa-clock" />
      {{ t('submittedBadge') }}
    </div>

    <h2 class="text-[21px] font-bold mb-2 tracking-tight">{{ t('submittedTitle') }}</h2>
    <p class="text-[13px] text-txt-dim leading-relaxed mb-6 px-2">
      {{ t('submittedBody') }}
    </p>

    <div class="card-surface overflow-hidden mb-6 text-start">
      <MetaListRow icon="fas fa-calendar-check" :label="t('submittedDate')" :value="appealDateText" />
      <MetaListRow icon="fas fa-hourglass-half" :label="t('submittedStatus')" :value="t('submittedStatusValue')" value-class="text-warn" />
      <MetaListRow icon="fas fa-trash-can" :label="t('submittedPurge')" :value="purgeDateText" :last="true" />
    </div>

    <div class="bg-primary/5 border border-primary/20 rounded-xl p-3.5 mb-6 text-start flex items-start gap-2.5">
      <i class="fas fa-lock text-primary text-[13px] mt-[3px] shrink-0" />
      <p class="text-[12px] text-txt-dim leading-relaxed">{{ t('privacyNote') }}</p>
    </div>

    <BaseButton variant="secondary" icon="fas fa-arrow-right-from-bracket" :busy="appeal.loading.key === 'logout'" @click="appeal.logout()">
      {{ t('logoutCta') }}
    </BaseButton>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAppealStore } from '../stores/appeal'
import { useSessionStore } from '../stores/session'
import { useI18nStore } from '../stores/i18n'
import { formatDateTime } from '../services/datetimeService'
import { nowIso, isCalibrated } from '../services/clockService'
import StepBadge from './StepBadge.vue'
import BaseButton from './BaseButton.vue'
import MetaListRow from './MetaListRow.vue'

const appeal = useAppealStore()
const session = useSessionStore()
const i18n = useI18nStore()

const appealDateText = computed(() => {
  const raw = appeal.appealDate || (session.profile && session.profile.appealDate) || (isCalibrated() ? nowIso() : null)
  return raw ? formatDateTime(raw, i18n.locale) : '—'
})

const purgeDateText = computed(() => {
  const raw = appeal.photoExpiresAt || (session.profile && session.profile.photoExpiresAt)
  return raw ? formatDateTime(raw, i18n.locale) : '—'
})

function t(key) {
  return i18n.t(key)
}
</script>
