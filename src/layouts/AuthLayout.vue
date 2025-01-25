<template>
  <q-layout view="lhr lpr lfr">
    <AuthHeaderComponent/>
    <q-page-container>
      <router-view/>
    </q-page-container>
    <AppFooterComponent/>
  </q-layout>
</template>

<script setup lang="ts">
import AuthHeaderComponent from '../components/header/AuthHeaderComponent.vue'
import AppFooterComponent from '../components/footer/AppFooterComponent.vue'

defineOptions({
  name: 'AuthLayout'
})
</script>
