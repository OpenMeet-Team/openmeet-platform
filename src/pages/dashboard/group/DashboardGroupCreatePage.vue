<template>
  <q-page padding>
    <DashboardTitle :backTo="{ name: 'DashboardGroupsPage' }" label="Create New Group"/>

    <GroupFormComponent style="max-width: 500px"/>

  </q-page>
</template>

<script setup lang="ts">
import GroupFormComponent from 'components/group/GroupFormBasicComponent.vue'
import { onMounted } from 'vue'
import { groupsApi } from 'src/api/dashboard.ts'
import { LoadingBar } from 'quasar'
import DashboardTitle from 'components/dashboard/DashboardTitle.vue'

onMounted(() => {
  LoadingBar.start()
  groupsApi.getAll().finally(LoadingBar.stop)
})
</script>
