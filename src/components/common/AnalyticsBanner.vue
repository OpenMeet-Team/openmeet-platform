<template>
  <q-banner
    v-if="shouldShowBanner"
    class="bg-grey-2 text-grey-9 q-pa-md"
    data-cy="analytics-banner"
  >
    <template v-slot:avatar>
      <q-icon name="sym_r_analytics" size="md" color="primary" />
    </template>

    <div class="row items-center justify-between full-width">
      <div class="col">
        <div class="text-body2">
          We use analytics to improve OpenMeet. You can opt out at any time.
        </div>
        <div v-if="isAuthenticated" class="text-caption text-grey-7 q-mt-xs">
          You can also change this in your profile settings.
        </div>
      </div>

      <div class="col-auto q-ml-md q-gutter-x-sm">
        <q-btn
          flat
          no-caps
          label="Opt out"
          color="grey-8"
          data-cy="analytics-banner-optout"
          @click="onOptOut"
        />
        <q-btn
          flat
          no-caps
          label="Got it"
          color="primary"
          data-cy="analytics-banner-dismiss"
          @click="onDismiss"
        />
      </div>
    </div>
  </q-banner>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '../../stores/auth-store'
import analyticsService from '../../services/analyticsService'

const COOKIE_NAME = 'om_analytics_banner_dismissed'

const authStore = useAuthStore()

const isAuthenticated = computed(() => authStore.isAuthenticated)

function getCookieDomain (): string {
  return window.APP_CONFIG?.APP_POSTHOG_COOKIE_DOMAIN || ''
}

function isBannerDismissed (): boolean {
  return document.cookie.split(';').some(c => c.trim().startsWith(COOKIE_NAME + '='))
}

function setBannerDismissed (): void {
  const domain = getCookieDomain()
  const domainPart = domain ? `; domain=${domain}` : ''
  document.cookie = `${COOKIE_NAME}=true; path=/; max-age=31536000; SameSite=Lax${domainPart}`
}

const dismissed = ref(isBannerDismissed())
const shouldShowBanner = computed(() => !dismissed.value && !analyticsService.hasOptedOut())

const onDismiss = () => {
  setBannerDismissed()
  dismissed.value = true
}

const onOptOut = () => {
  analyticsService.optOut()
  setBannerDismissed()
  dismissed.value = true
}
</script>
