<template>
  <q-layout view="lHh Lpr lff">
    <AppHeaderComponent/>
    <q-page-container>
      <router-view/>
    </q-page-container>
    <AppFooterComponent/>
  </q-layout>
</template>

<script setup lang="ts">
import AppHeaderComponent from 'components/layout/AppHeaderComponent.vue'
import AppFooterComponent from 'components/layout/AppFooterComponent.vue'
import { onMounted } from 'vue'
import { useAuthStore } from 'stores/auth-store.ts'

defineOptions({
  name: 'AppLayout'
})

onMounted(async () => {
  if (useAuthStore().isAuthenticated) {
    await useAuthStore().actionGetRights()
  }
})
</script>
