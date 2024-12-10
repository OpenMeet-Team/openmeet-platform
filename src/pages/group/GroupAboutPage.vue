<script setup lang="ts">
import { useGroupStore } from 'stores/group-store.ts'
import { computed, onMounted, ref } from 'vue'
import GroupAboutMembersComponent from 'components/group/GroupAboutMembersComponent.vue'
import GroupAboutDiscussionsComponent from 'components/group/GroupAboutDiscussionsComponent.vue'
import GroupAboutEventsComponent from 'components/group/GroupAboutEventsComponent.vue'
import SubtitleComponent from 'src/components/common/SubtitleComponent.vue'
import { GroupPermission } from 'src/types'
import { useAuthStore } from 'src/stores/auth-store'
import { useRoute } from 'vue-router'

const group = computed(() => useGroupStore().group)
const route = useRoute()
const isLoading = ref<boolean>(false)
const hasPermission = computed(() => {
  return group.value && (useGroupStore().getterIsPublicGroup || (useGroupStore().getterIsAuthenticatedGroup && useAuthStore().isAuthenticated) || useGroupStore().getterUserHasPermission(GroupPermission.SeeEvents))
})

onMounted(() => {
  if (hasPermission.value) {
    isLoading.value = true
    useGroupStore().actionGetGroupAbout(route.params.slug as string).finally(() => (isLoading.value = false))
  }
})

</script>

<template>
  <div v-if="group && !isLoading" class="row q-col-gutter-lg q-mt-md">
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
      <GroupAboutDiscussionsComponent :group="group" />
    </div>

    <!-- Members List -->
    <div class="col-12 col-sm-6">
      <GroupAboutMembersComponent />
    </div>
  </div>
  <SpinnerComponent v-else />
</template>

<style scoped lang="scss"></style>
