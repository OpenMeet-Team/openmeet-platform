<template>
  <q-page padding class="q-mb-xl">
    <div class="q-mx-auto" style="max-width: 500px">
      <DashboardTitle :backTo="{ name: 'DashboardGroupsPage' }" label="Edit Group" />

      <div class="row justify-center">
        <GroupFormComponent class="col" style="max-width: 500px" :editGroupSlug="route.params.slug as string"
          @close="router.push({ name: 'DashboardGroupsPage' })" />
      </div>
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
