<script setup lang="ts">
import DashboardProfileForm from 'components/dashboard/DashboardProfileForm.vue'
import { useMeta } from 'quasar'
useMeta({
  title: 'Profile'
})
</script>

<template>
  <q-page padding>
    <div class="row text-h4">
      <router-link class="router-link-inherit" active-class="text-bold" :to="{ name: 'DashboardProfilePage' }">Profile settings</router-link>
    </div>
    <DashboardProfileForm class="q-mt-md"/>
  </q-page>
</template>

<style scoped lang="scss">

</style>
