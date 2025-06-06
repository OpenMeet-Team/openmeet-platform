<script setup lang="ts">
import { useGroupStore } from '../../stores/group-store'
import { computed, onMounted, ref } from 'vue'
import GroupAboutMembersComponent from '../../components/group/GroupAboutMembersComponent.vue'
import GroupAboutDiscussionsComponent from '../../components/group/GroupAboutDiscussionsComponent.vue'
import GroupAboutEventsComponent from '../../components/group/GroupAboutEventsComponent.vue'
import SubtitleComponent from '../../components/common/SubtitleComponent.vue'
import { GroupPermission } from '../../types'
import { useAuthStore } from '../../stores/auth-store'
import { useRoute } from 'vue-router'

const group = computed(() => useGroupStore().group)
const route = useRoute()
const isLoading = ref<boolean>(false)
const hasPermission = computed(() => {
  return group.value && (useGroupStore().getterIsPublicGroup || (useGroupStore().getterIsAuthenticatedGroup && useAuthStore().isAuthenticated) || useGroupStore().getterUserHasPermission(GroupPermission.SeeEvents))
})

// No longer need to decode HTML entities with markdown

onMounted(() => {
  if (hasPermission.value) {
    isLoading.value = true
    useGroupStore().actionGetGroupAbout(route.params.slug as string).finally(() => (isLoading.value = false))
  }
})

</script>

<template>
  <div v-if="group && !isLoading" class="row q-col-gutter-lg q-mt-md q-pb-xl">
    <div class="col-12 col-sm-6">

      <!-- Description -->
      <SubtitleComponent class="q-px-md" hideLink label="What we're about" />
      <q-card flat>
        <q-card-section>
          <div class="text-body1 bio-content">
            <q-markdown v-if="group.description" :src="group.description" />
            <div v-else class="text-grey-6 text-italic">No description provided</div>
          </div>
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

<style scoped lang="scss">
.bio-content {
  max-width: 100%;

  :deep(a) {
    color: var(--q-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }

    &::after {
      display: none;
    }
  }

  :deep(img) {
    max-width: 100%;
    border-radius: 4px;
  }

  :deep(code) {
    background-color: rgba(0, 0, 0, 0.05);
    padding: 2px 4px;
    border-radius: 4px;
    font-family: monospace;
  }

  :deep(blockquote) {
    border-left: 4px solid var(--q-primary);
    margin-left: 0;
    padding-left: 16px;
    color: rgba(0, 0, 0, 0.7);
  }
}
</style>
