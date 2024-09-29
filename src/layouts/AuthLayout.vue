<template>
  <q-layout view="lHh Lpr lFf">
    <AuthHeaderComponent/>
    <q-page-container>
      <router-view/>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import AuthHeaderComponent from 'components/layout/AuthHeaderComponent.vue'

defineOptions({
  name: 'AuthLayout'
})
</script>
