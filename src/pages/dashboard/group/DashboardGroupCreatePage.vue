<template>
  <q-page padding>
    <DashboardTitle :backTo="{ name: 'DashboardGroupsPage' }" label="Create New Group"/>

    <div class="row justify-center">
      <GroupFormComponent class="col" style="max-width: 500px" @close="router.push({ name: 'DashboardGroupsPage' })"/>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import GroupFormComponent from 'components/group/GroupFormComponent.vue'
import DashboardTitle from 'components/dashboard/DashboardTitle.vue'
import { useRouter } from 'vue-router'
const router = useRouter()
</script>
