<template>
  <q-page padding>
    <div class="row items-center justify-between q-mb-xl">
      <h1 class="text-h4 q-my-none">Create New Group</h1>
    </div>

    <GroupFormComponent style="max-width: 500px"/>

  </q-page>
</template>

<script setup lang="ts">
import GroupFormComponent from 'components/group/GroupFormBasicComponent.vue'
import { onMounted } from 'vue'
import { groupsApi } from 'src/api/dashboard.ts'
import { LoadingBar } from 'quasar'

onMounted(() => {
  LoadingBar.start()
  groupsApi.getAll().finally(LoadingBar.stop)
})
</script>
