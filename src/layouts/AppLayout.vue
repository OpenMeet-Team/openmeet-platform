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
import AppHeaderComponent from 'components/header/AppHeaderComponent.vue'
import AppFooterComponent from 'components/footer/AppFooterComponent.vue'

defineOptions({
  name: 'AppLayout'
})
</script>
