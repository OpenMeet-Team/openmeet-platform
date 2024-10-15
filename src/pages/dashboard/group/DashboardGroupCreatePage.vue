<template>
  <q-page padding>
    <DashboardTitle :backTo="{ name: 'DashboardGroupsPage' }" label="Create New Group"/>

    <GroupFormComponent style="max-width: 500px" @created="router.push({ name: 'DashboardGroupPage', params: { id: $event.id }})" @close="router.push({ name: 'DashboardGroupsPage' })"/>
  </q-page>
</template>

<script setup lang="ts">
import GroupFormComponent from 'components/group/GroupFormBasicComponent.vue'
import DashboardTitle from 'components/dashboard/DashboardTitle.vue'
import { useRouter } from 'vue-router'
const router = useRouter()
</script>
