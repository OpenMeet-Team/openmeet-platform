<template>
  <q-page class="q-pa-md q-pb-xl q-mx-auto" style="max-width: 1201px">
    <!-- Loading -->
    <SpinnerComponent v-if="useGroupStore().isLoading" />

    <template v-else>
      <!-- Lead block -->
      <GroupLeadComponent v-if="group" />

      <!-- Nav sticky block -->
      <GroupStickyComponent v-if="group" />

      <!-- Secondary blocks -->
      <router-view v-if="groupMounted && hasRightPermission" />

      <!-- Auth group content -->
      <NoContentComponent v-if="group && useGroupStore().getterIsAuthenticatedGroup && !useAuthStore().isAuthenticated"
        icon="sym_r_error" data-cy="auth-group-content" label="You need to be logged in to see the content" />

      <!-- Private group content -->
      <NoContentComponent
        v-if="group && useGroupStore().getterIsPrivateGroup && !useGroupStore().getterUserHasPermission(GroupPermission.SeeGroup)"
        icon="sym_r_error" data-cy="private-group-content" label="It's a private group, join to see the content" />

      <!-- No group content -->
      <NoContentComponent v-if="!group" data-cy="no-group-content" icon="sym_r_error" label="Group not found"
        :to="{ name: 'GroupsPage' }" buttonLabel="Go to groups" />

    </template>

    <GroupSimilarEventsComponent />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { LoadingBar, useMeta } from 'quasar'
import { useRoute } from 'vue-router'
import { useGroupStore } from 'stores/group-store.ts'
import GroupStickyComponent from 'components/group/GroupStickyComponent.vue'
import GroupLeadComponent from 'components/group/GroupLeadComponent.vue'
import GroupSimilarEventsComponent from 'components/group/GroupSimilarEventsComponent.vue'
import { getImageSrc } from 'src/utils/imageUtils.ts'
import SpinnerComponent from 'src/components/common/SpinnerComponent.vue'
import NoContentComponent from 'src/components/global/NoContentComponent.vue'
import { GroupPermission } from 'src/types'
import { useAuthStore } from 'src/stores/auth-store'
import { storeToRefs } from 'pinia'

const route = useRoute()

const { group } = storeToRefs(useGroupStore())
const groupMounted = ref<boolean>(false)

onBeforeUnmount(() => {
  useGroupStore().$reset()
})

const hasRightPermission = computed(() => {
  return group.value && (useGroupStore().getterIsPublicGroup || (useGroupStore().getterIsAuthenticatedGroup && useAuthStore().isAuthenticated) || useGroupStore().getterUserHasPermission(GroupPermission.SeeGroup))
})

useMeta({
  title: group.value?.name,
  meta: {
    description: { content: group.value?.description },
    'og:image': { content: getImageSrc(group.value?.image) }
  }
})

onMounted(() => {
  LoadingBar.start()
  useGroupStore().actionGetGroup(route.params.slug as string).finally(() => {
    LoadingBar.stop()
    groupMounted.value = true
  })
})

// const hasPermission = computed(() => {
//   return group.value && (useGroupStore().getterIsPublicGroup || (useGroupStore().getterIsAuthenticatedGroup && useAuthStore().isAuthenticated) || useGroupStore().getterUserHasPermission(GroupPermission.SeeGroup))
// })

onBeforeUnmount(() => {
  useGroupStore().$reset()
})
</script>

<style scoped></style>
