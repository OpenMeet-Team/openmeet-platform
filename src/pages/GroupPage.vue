<template>
  <q-page v-if="group" class="q-pa-md">
    <!-- Lead block -->
    <GroupLeadComponent/>

    <!-- Nav sticky block -->
    <GroupStickyComponent/>

    <!-- Secondary blocks -->
    <router-view/>

    <GroupSimilarEventsComponent/>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { LoadingBar } from 'quasar'
import { useRoute } from 'vue-router'
import { useGroupStore } from 'stores/group-store.ts'
import GroupStickyComponent from 'components/group/GroupStickyComponent.vue'
import GroupLeadComponent from 'components/group/GroupLeadComponent.vue'
import GroupSimilarEventsComponent from 'components/group/GroupSimilarEventsComponent.vue'

const route = useRoute()

const group = computed(() => {
  return useGroupStore().group
})

onMounted(async () => {
  LoadingBar.start()

  Promise.all([
    useGroupStore().actionGetGroupById(route.params.id as string)
    // useUserStore().actionGetGroupRights(route.params.id as string)
  ]).finally(LoadingBar.stop)
})
</script>

<style scoped>

</style>
