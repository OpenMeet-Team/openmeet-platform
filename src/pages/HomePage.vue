<template>
  <q-page padding>
    <HomeAuthorizedComponent v-if="useAuthStore().isAuthenticated"/>
    <HomeNonAuthorizedComponent v-else/>
  </q-page>
</template>

<script setup lang="ts">
import { useMeta } from 'quasar'

import { useAuthStore } from 'stores/auth-store.ts'

import HomeAuthorizedComponent from 'src/pages/home/HomeUserPage.vue'
import HomeNonAuthorizedComponent from 'src/pages/home/HomeGuestPage.vue'

useMeta({
  title: 'Home'
})

</script>

<style scoped>

</style>
