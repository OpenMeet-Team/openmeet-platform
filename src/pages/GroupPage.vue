<template>
  <q-page class="q-pa-md q-pb-xl q-mx-auto" style="max-width: 1201px">
    <SpinnerComponent v-if="useGroupStore().isLoading" />

    <template v-else-if="group">
      <!-- Lead block -->
      <GroupLeadComponent v-if="group" />

      <!-- Nav sticky block -->
      <GroupStickyComponent v-if="group" />

      <!-- Secondary blocks -->
      <router-view v-if="group && (group.visibility === GroupVisibility.Public || (group.visibility === GroupVisibility.Authenticated && useAuthStore().isAuthenticated)) || useGroupStore().getterUserGroupPermission(GroupPermission.SeeGroup)" />

      <!-- Private group content -->
      <NoContentComponent v-if="group && group.visibility === GroupVisibility.Private && !useGroupStore().getterUserGroupPermission(GroupPermission.SeeGroup)" icon="sym_r_error" data-cy="private-group-content" label="It's a private group, join to see the content" />

      <!-- Auth group content -->
      <NoContentComponent v-if="group && group.visibility === GroupVisibility.Authenticated && !useAuthStore().isAuthenticated" icon="sym_r_error" data-cy="auth-group-content" label="You need to be logged in to see the content" />
    </template>
    <NoContentComponent v-else data-cy="no-group-content" icon="sym_r_error" label="Group not found" :to="{ name: 'GroupsPage' }" buttonLabel="Go to groups" />

    <GroupSimilarEventsComponent v-if="!useGroupStore().isLoading" :group="group" />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { LoadingBar, useMeta } from 'quasar'
import { useRoute } from 'vue-router'
import { useGroupStore } from 'stores/group-store.ts'
import GroupStickyComponent from 'components/group/GroupStickyComponent.vue'
import GroupLeadComponent from 'components/group/GroupLeadComponent.vue'
import GroupSimilarEventsComponent from 'components/group/GroupSimilarEventsComponent.vue'
import { decodeLowercaseStringToNumber } from 'src/utils/encoder.ts'
import { getImageSrc } from 'src/utils/imageUtils.ts'
import SpinnerComponent from 'src/components/common/SpinnerComponent.vue'
import NoContentComponent from 'src/components/global/NoContentComponent.vue'
import { GroupPermission, GroupVisibility } from 'src/types'
import { useAuthStore } from 'src/stores/auth-store'

const route = useRoute()

const group = computed(() => {
  return useGroupStore().group
})

onBeforeUnmount(() => {
  useGroupStore().$reset()
})

onMounted(async () => {
  LoadingBar.start()
  const groupId = decodeLowercaseStringToNumber(route.params.id as string)
  useGroupStore().actionGetGroup(String(groupId)).finally(LoadingBar.stop).then(() => {
    const group = useGroupStore().group

    if (group) {
      useMeta({
        title: group.name,
        meta: {
          description: { content: group.description },
          'og:image': { content: getImageSrc(group.image) }
        }
      })
    }
  })
})

onBeforeUnmount(() => {
  useGroupStore().$reset()
})
</script>

<style scoped></style>
