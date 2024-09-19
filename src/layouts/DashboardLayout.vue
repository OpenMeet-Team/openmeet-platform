<template>
  <q-layout view="hHh lpR fFf">
    <HeaderComponent/>
    <DashboardDrawerComponent/>
    <q-page-container>
      <router-view/>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import HeaderComponent from 'components/layout/HeaderComponent.vue'
import DashboardDrawerComponent from 'components/dashboard/DashboardDrawerComponent.vue'

defineOptions({
  name: 'DashboardLayout'
})
</script>
