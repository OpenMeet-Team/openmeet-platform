<template>
  <q-layout view="lHh Lpr lFf">
    <HeaderComponent/>
    <q-page-container>
      <router-view/>
    </q-page-container>
    <FooterComponent/>
  </q-layout>
</template>

<script setup lang="ts">
import HeaderComponent from 'components/layout/HeaderComponent.vue'
import FooterComponent from 'components/layout/FooterComponent.vue'

defineOptions({
  name: 'AuthLayout'
})
</script>
