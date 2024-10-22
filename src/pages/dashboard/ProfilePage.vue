<script setup lang="ts">
import DashboardProfileForm from 'components/dashboard/DashboardProfileForm.vue'
import { useMeta } from 'quasar'
import DashboardTitle from 'src/components/dashboard/DashboardTitle.vue'
useMeta({
  title: 'Profile'
})
</script>

<template>
  <q-page padding>
    <DashboardTitle defaultBack label="Profile settings"/>

    <div class="row justify-center">
      <DashboardProfileForm class="q-mt-md col"/>
    </div>
  </q-page>
</template>

<style scoped lang="scss">

</style>
