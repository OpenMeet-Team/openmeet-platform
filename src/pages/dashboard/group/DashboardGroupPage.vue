<template>
  <q-page padding>
    <DashboardTitle :backTo="{ name: 'DashboardGroupsPage' }" label="Edit Group"/>

    <div class="row justify-center">
      <GroupFormComponent class="col" style="max-width: 500px" :edit-group-ulid="route.params.ulid as string" @close="router.push({ name: 'DashboardGroupsPage' })"/>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import DashboardTitle from 'components/dashboard/DashboardTitle.vue'
import GroupFormComponent from 'src/components/group/GroupFormComponent.vue'

const route = useRoute()
const router = useRouter()

</script>
