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

defineOptions({
  name: 'AppLayout'
})
</script>
