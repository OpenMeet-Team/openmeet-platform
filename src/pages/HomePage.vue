<template>
  <q-page class="q-pa-md">
    <HomeAuthorizedComponent v-if="useAuthStore().isAuthenticated"/>
    <HomeNonAuthorizedComponent v-else/>
  </q-page>
</template>

<script setup lang="ts">
import { useMeta } from 'quasar'

import { useAuthStore } from 'stores/auth-store.ts'

import HomeAuthorizedComponent from 'components/home/HomeAuthorizedComponent.vue'
import HomeNonAuthorizedComponent from 'components/home/HomeNonAuthorizedComponent.vue'

useMeta({
  title: 'Home'
})

</script>

<style scoped>

</style>
