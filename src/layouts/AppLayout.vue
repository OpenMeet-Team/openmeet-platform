<template>
  <q-layout view="hhh LpR ffr">
    <AppHeaderComponent />
    <q-page-container>
      <VerifyEmailBanner />
      <router-view />
    </q-page-container>
    <AppFooterComponent />
  </q-layout>
</template>

<script setup lang="ts">
import AppHeaderComponent from '../components/header/AppHeaderComponent.vue'
import AppFooterComponent from '../components/footer/AppFooterComponent.vue'
import VerifyEmailBanner from '../components/auth/VerifyEmailBanner.vue'

defineOptions({
  name: 'AppLayout'
})
</script>

<style lang="scss">
.footer {
  position: relative;
  z-index: 1;
  margin-top: 0 !important;
}

.q-page {
  padding-bottom: 0 !important;
  min-height: calc(100vh - 500px) !important;
}
</style>
