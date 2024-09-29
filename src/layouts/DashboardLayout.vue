<template>
  <q-layout view="hHh lpR fFf">
    <AppHeaderComponent/>
    <DashboardDrawerComponent/>
    <q-page-container>
      <router-view/>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import DashboardDrawerComponent from 'components/dashboard/DashboardDrawerComponent.vue'
import AppHeaderComponent from 'components/layout/AppHeaderComponent.vue'

defineOptions({
  name: 'DashboardLayout'
})
</script>
