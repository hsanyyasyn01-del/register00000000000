<template>
  <div class="card-surface overflow-hidden mb-6">
    <MetaListRow icon="fas fa-calendar-xmark" :label="t('detailDate')" :value="dateValue" />
    <MetaListRow icon="fas fa-shield-halved" :label="t('detailStatus')" :value="statusValue" :value-class="pending ? 'text-warn' : 'text-danger'" />
    <MetaListRow icon="fas fa-fingerprint" :label="t('detailReference')" :value="reference" dir="ltr" :last="true" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18nStore } from '../stores/i18n'
import { formatDateTime } from '../services/datetimeService'
import MetaListRow from './MetaListRow.vue'

const props = defineProps({
  profile: { type: Object, default: null },
})

const i18n = useI18nStore()

const pending = computed(() => props.profile && props.profile.appealStatus === 'pending')

const dateValue = computed(() => {
  const raw = props.profile && props.profile.restrictedAt
  return raw ? formatDateTime(raw, i18n.locale) : '—'
})

const statusValue = computed(() =>
  pending.value ? i18n.t('statusAppealPending') : i18n.t('statusRestricted')
)

const reference = computed(() => (props.profile && props.profile.reference) || '—')

function t(key, params) {
  return i18n.t(key, params)
}
</script>
