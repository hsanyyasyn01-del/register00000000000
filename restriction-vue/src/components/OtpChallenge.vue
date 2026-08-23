<template>
  <div class="text-center animate-fade-in">
    <StepBadge tone="blue" icon="fas fa-envelope-open-text" />

    <h2 class="text-[21px] font-bold mb-2 tracking-tight">{{ t('stepOtpTitle') }}</h2>
    <p class="text-[13px] text-txt-dim leading-relaxed mb-6 px-2">
      {{ otpVisible ? t('stepOtpSent') : t('stepOtpBody') }}
    </p>

    <div v-if="!otpVisible" class="relative mb-5">
      <input
        type="text"
        class="input-field ps-10"
        :placeholder="t('usernamePlaceholder')"
        v-model="appeal.username"
        autocomplete="username"
        autocapitalize="none"
        spellcheck="false"
        @keyup.enter="handleSend"
      >
      <i class="fas fa-at absolute top-1/2 start-3.5 -translate-y-1/2 text-txt-faint pointer-events-none" />
    </div>

    <Transition name="otpzone" mode="out-in">
      <div v-if="!otpVisible" key="send">
        <BaseButton variant="primary" icon="fas fa-paper-plane" :busy="appeal.loading.key === 'otpSend'" :disabled="!canSend" @click="handleSend">
          {{ appeal.loading.key === 'otpSend' ? t('sendingCode') : t('sendCode') }}
        </BaseButton>
      </div>

      <div v-else key="verify">
        <div class="flex justify-center gap-2 mb-5" dir="ltr" @paste.prevent="handlePaste">
          <input
            v-for="(_, idx) in 6"
            :key="idx"
            :ref="(el) => { if (el) inputs[idx] = el }"
            type="text"
            class="otp-box"
            :class="{ 'otp-filled': otp[idx] }"
            maxlength="1"
            inputmode="numeric"
            autocomplete="one-time-code"
            v-model="otp[idx]"
            @input="(e) => handleOtpInput(idx, e)"
            @keydown="(e) => handleOtpKeydown(idx, e)"
          >
        </div>
        <BaseButton variant="primary" icon="fas fa-check" :busy="appeal.loading.key === 'otpVerify'" :disabled="code.length !== 6" @click="handleVerify">
          {{ appeal.loading.key === 'otpVerify' ? t('confirming') : t('confirm') }}
        </BaseButton>
        <button class="text-[12.5px] font-semibold mb-4 transition-colors" :class="countdown.active.value ? 'text-txt-faint cursor-default' : 'text-primary hover:text-[#f5f5f5]'" :disabled="countdown.active.value" @click="handleResend">
          {{ countdown.active.value ? t('resendIn', { s: countdown.remaining.value }) : t('resendCode') }}
        </button>
      </div>
    </Transition>

    <BaseButton variant="secondary" @click="appeal.prevStep()">{{ t('back') }}</BaseButton>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick } from 'vue'
import { useAppealStore } from '../stores/appeal'
import { useI18nStore } from '../stores/i18n'
import { useCountdown } from '../composables/useCountdown'
import { isValidUsername, sanitizeOtpChar } from '../services/validatorService'
import { track } from '../services/telemetryService'
import StepBadge from './StepBadge.vue'
import BaseButton from './BaseButton.vue'

const appeal = useAppealStore()
const i18n = useI18nStore()
const countdown = useCountdown()

const otpVisible = ref(false)
const otp = reactive(Array(6).fill(''))
const inputs = reactive({})

const code = computed(() => otp.join(''))
const canSend = computed(() => isValidUsername(appeal.username))

async function handleSend() {
  if (!canSend.value) return appeal.toast(t('toastUsernameRequired'), 'error')
  const sent = await appeal.sendOtp()
  if (sent) {
    otpVisible.value = true
    countdown.start(45)
    await nextTick()
    focusInput(0)
  }
}

async function handleResend() {
  const sent = await appeal.sendOtp()
  if (sent) countdown.start(45)
}

function focusInput(i) {
  const el = inputs[i]
  if (el && typeof el.focus === 'function') el.focus()
}

function handleOtpInput(idx, e) {
  otp[idx] = sanitizeOtpChar(e.target.value)
  e.target.value = otp[idx]
  if (otp[idx] && idx < 5) focusInput(idx + 1)
  if (code.value.length === 6) setTimeout(handleVerify, 180)
}

function handleOtpKeydown(idx, e) {
  if (e.key === 'Backspace' && !otp[idx] && idx > 0) focusInput(idx - 1)
  if (e.key === 'ArrowRight' && idx > 0) focusInput(idx - 1)
  if (e.key === 'ArrowLeft' && idx < 5) focusInput(idx + 1)
}

function handlePaste(e) {
  const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6)
  digits.split('').forEach((d, i) => {
    otp[i] = d
    if (inputs[i]) inputs[i].value = d
  })
  if (digits.length === 6) setTimeout(handleVerify, 180)
}

async function handleVerify() {
  if (code.value.length !== 6) return appeal.toast(t('toastCodeIncomplete'), 'error')
  const ok = await appeal.verifyOtp(code.value)
  if (!ok) {
    track('restriction_otp_retry', {})
    otp.fill('')
    await nextTick()
    focusInput(0)
  }
}

function t(key, params) {
  return i18n.t(key, params)
}
</script>

<style scoped>
.otpzone-enter-active,
.otpzone-leave-active { transition: all 0.3s ease; }
.otpzone-enter-from,
.otpzone-leave-to { opacity: 0; transform: translateY(8px); }

.otp-box {
  width: 46px;
  height: 56px;
  background: #262626;
  border: 1px solid #363636;
  border-radius: 10px;
  color: #f5f5f5;
  font-family: inherit;
  font-size: 24px;
  font-weight: 700;
  text-align: center;
  transition: all 0.2s;
  outline: none;
}
.otp-box:focus {
  border-color: #0095f6;
  background: #000;
  box-shadow: 0 0 0 3px rgba(0, 149, 246, 0.18);
}
.otp-filled { border-color: #a8a8a8; }

@media (max-width: 480px) {
  .otp-box { width: 40px; height: 50px; font-size: 20px; }
}
</style>
