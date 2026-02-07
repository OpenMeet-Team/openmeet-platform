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
import { computed } from 'vue'
import { useAuthStore } from '../../stores/auth-store'
import analyticsService from '../../services/analyticsService'

const STORAGE_KEY = 'analytics_banner_dismissed'

const authStore = useAuthStore()

const isAuthenticated = computed(() => authStore.isAuthenticated)

const shouldShowBanner = computed(() => {
  const dismissed = localStorage.getItem(STORAGE_KEY) === 'true'
  const optedOut = analyticsService.hasOptedOut()
  return !dismissed && !optedOut
})

const onDismiss = () => {
  localStorage.setItem(STORAGE_KEY, 'true')
}

const onOptOut = () => {
  analyticsService.optOut()
  localStorage.setItem(STORAGE_KEY, 'true')
}
</script>
