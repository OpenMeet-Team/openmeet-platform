<template>
  <q-page padding style="max-width: 1201px" class="q-mx-auto">
    <HomeAuthorizedComponent v-if="useAuthStore().isAuthenticated"/>
    <HomeNonAuthorizedComponent v-else/>
  </q-page>
</template>

<script setup lang="ts">
import { useMeta } from 'quasar'
import { useAuthStore } from 'stores/auth-store.ts'
import HomeAuthorizedComponent from 'src/pages/home/HomeUserPage.vue'
import HomeNonAuthorizedComponent from 'src/pages/home/HomeGuestPage.vue'
import { useHomeStore } from 'src/stores/home-store'
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
