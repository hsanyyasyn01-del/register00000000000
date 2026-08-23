<template>
  <div class="animate-fade-in">
    <AccountSummaryCard :profile="profile" />

    <HeroHeadline
      :title="t('restrictedTitle')"
      :subtitle="t('restrictedOn', { date: restrictionDate })"
      :body="t('restrictedBody')"
    />

    <ReasonPanel :profile="profile" />
    <RestrictionMetaList :profile="profile" />
    <PolicyLinks />

    <BaseButton variant="primary" icon="fas fa-gavel" :disabled="ui.offline === false" @click="startAppeal">
      {{ t('appealCta') }}
    </BaseButton>
    <BaseButton variant="secondary" icon="fas fa-arrow-right-from-bracket" :busy="appeal.loading.key === 'logout'" @click="appeal.logout()">
      {{ t('logoutCta') }}
    </BaseButton>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { useI18nStore } from '../stores/i18n'
import { useAppealStore } from '../stores/appeal'
import { useUiStore } from '../stores/ui'
import { formatDate } from '../services/datetimeService'
import { track } from '../services/telemetryService'
import AccountSummaryCard from './AccountSummaryCard.vue'
import ReasonPanel from './ReasonPanel.vue'
import RestrictionMetaList from './RestrictionMetaList.vue'
import PolicyLinks from './PolicyLinks.vue'
import BaseButton from './BaseButton.vue'

const HeroHeadline = defineAsyncComponent(() => import('./HeroHeadline.vue'))

const props = defineProps({
  profile: { type: Object, default: null },
})

const i18n = useI18nStore()
const appeal = useAppealStore()
const ui = useUiStore()

const restrictionDate = computed(() => {
  const raw = props.profile && props.profile.restrictedAt
  return raw ? formatDate(raw, i18n.locale) : '—'
})

function startAppeal() {
  track('restriction_appeal_start', {})
  appeal.nextStep()
}

function t(key, params) {
  return i18n.t(key, params)
}
</script>
