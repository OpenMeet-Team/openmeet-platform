<script setup lang="ts">
import { useGroupStore } from 'stores/group-store.ts'
import { computed } from 'vue'
import GroupAboutMembersComponent from 'components/group/GroupAboutMembersComponent.vue'
import GroupAboutDiscussionsComponent from 'components/group/GroupAboutDiscussionsComponent.vue'
import GroupAboutEventsComponent from 'components/group/GroupAboutEventsComponent.vue'

const group = computed(() => useGroupStore().group)
</script>

<template>
  <div v-if="group" class="row q-col-gutter-md q-mt-md">

    <div class="col-12 col-md-6 col-lg-4">
      <!-- Description -->
      <q-card class="shadow-0">
        <q-card-section>
          <div class="text-h5">What we’re about</div>
        </q-card-section>
        <q-card-section>
          <div class="text-body1">{{ group.description }}</div>
        </q-card-section>
      </q-card>

      <!-- Events List Section -->
      <GroupAboutEventsComponent :events="group.events"/>

      <!-- Discussions section -->
      <GroupAboutDiscussionsComponent :discussion="group.discussions" />
    </div>

    <!-- Members List -->
    <GroupAboutMembersComponent :groupMembers="group.groupMembers"/>
  </div>
</template>

<style scoped lang="scss">

</style>
