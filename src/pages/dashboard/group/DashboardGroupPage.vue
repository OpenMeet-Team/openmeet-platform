<template>
  <q-page padding>
    <DashboardTitle :backTo="{ name: 'DashboardGroupsPage' }" label="Edit Group"/>

    <div class="row justify-center">
      <GroupFormBasicComponent @updated="router.push({ name: 'DashboardGroupsPage' })" :edit-group-id="route.params.id as string" style="max-width: 500px" @close="router.push({ name: 'DashboardGroupsPage' })"/>
    </div>

  </q-page>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import DashboardTitle from 'components/dashboard/DashboardTitle.vue'

const route = useRoute()
const router = useRouter()

</script>
