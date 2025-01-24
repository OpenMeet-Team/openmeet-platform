<template>
  <q-page padding style="max-width: 1201px" class="q-mx-auto">
    <HomeUserPage v-if="useAuthStore().isAuthenticated"/>
    <HomeGuestPage v-else/>
  </q-page>
</template>

<script setup lang="ts">
import { useMeta } from 'quasar'
import { useAuthStore } from '../stores/auth-store'
import HomeUserPage from '../pages/home/HomeUserPage.vue'
import HomeGuestPage from '../pages/home/HomeGuestPage.vue'
import { useHomeStore } from '../stores/home-store'
import { onBeforeUnmount } from 'vue'

useMeta({
  title: 'Home'
})

onBeforeUnmount(() => {
  useHomeStore().$reset()
})

</script>

<style scoped>

</style>
