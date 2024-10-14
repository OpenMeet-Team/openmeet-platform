<template>
  <q-layout view="hHh lpR fFf">
    <DashboardHeaderComponent/>
    <DashboardDrawerComponent/>
    <q-page-container>
      <router-view/>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import DashboardDrawerComponent from 'components/dashboard/DashboardDrawerComponent.vue'
import DashboardHeaderComponent from 'components/header/DashboardHeaderComponent.vue'

defineOptions({
  name: 'DashboardLayout'
})
</script>
