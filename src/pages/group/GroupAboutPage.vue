<script setup lang="ts">
import { useGroupStore } from 'stores/group-store.ts'
import { computed } from 'vue'
import GroupAboutMembersComponent from 'components/group/GroupAboutMembersComponent.vue'
import GroupAboutDiscussionsComponent from 'components/group/GroupAboutDiscussionsComponent.vue'
import GroupAboutEventsComponent from 'components/group/GroupAboutEventsComponent.vue'
import SubtitleComponent from 'src/components/common/SubtitleComponent.vue'

const group = computed(() => useGroupStore().group)
</script>

<template>
  <div v-if="group" class="row q-col-gutter-lg q-mt-md">

    <div class="col-12 col-sm-6">

      <!-- Description -->
      <SubtitleComponent class="q-px-md" hideLink label="What we’re about" />
      <q-card flat>
        <q-card-section>
          <div class="text-body1" v-html="group.description"></div>
        </q-card-section>
      </q-card>

      <!-- Events List Section -->
      <GroupAboutEventsComponent :events="group.events" />

      <!-- Discussions section -->
      <GroupAboutDiscussionsComponent :discussion="group.discussions" />
    </div>

    <!-- Members List -->
    <div class="col-12 col-sm-6">
      <GroupAboutMembersComponent :groupMembers="group.groupMembers" />
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
