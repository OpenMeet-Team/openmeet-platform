<template>
  <div v-if="group" style="max-width: 600px; margin: 0 auto;" class="c-group-members-page">
    <SpinnerComponent v-if="isLoading"/>
    <div data-cy="group-members-page" v-if="!isLoading && group && hasPermission">
      <SubtitleComponent class="q-mt-md" label="All group members" :count="group.groupMembers?.length" hide-link />
      <div class="row q-col-gutter-md q-mb-md">
        <div class="col-12 col-sm-8">
          <q-input
            v-model="searchQuery"
            label="Search members"
            outlined
          />
        </div>

        <div class="col-12 col-sm-4">
          <q-select
            v-model="roleFilter"
            :options="roleOptions"
            map-options
            emit-value
            label="Filter by role"
            outlined
          />
        </div>
      </div>
      <q-list bordered separator>
        <q-item v-for="member in filteredMembers" :key="member.id">
          <q-item-section class="cursor-pointer" avatar @click="navigateToMember(member.user)">
            <q-avatar>
              <img :src="getImageSrc(member.user?.photo)" :alt="member.user?.name" />
            </q-avatar>
          </q-item-section>
          <q-item-section class="cursor-pointer" @click="navigateToMember(member.user)">
            <q-item-label>{{ member.user.name }}</q-item-label>
            <q-item-label caption>
              {{ capitalizeFirstLetter(member.groupRole.name) }} • <span v-if="member.createdAt">Joined {{ formatDate(member.createdAt, 'DD MMM YYYY') }}</span>
            </q-item-label>
          </q-item-section>
          <q-item-section top side>
          <div class="text-grey-8 q-gutter-xs">
            <q-btn color="primary" size="md" @click="navigateToChat({ member: member.user.ulid })" round flat icon="sym_r_chat" />
            <q-btn color="primary" size="md" round flat icon="sym_r_more_vert" :disable="!(useGroupStore().getterUserHasPermission(GroupPermission.ManageMembers) && member.groupRole.name !== GroupRole.Owner)">
              <q-menu>
                <q-list>
                  <!-- <MenuItemComponent v-if="member.groupRole.name === GroupRole.Guest" label="Approve" @click="openGroupMemberRoleDialog(group, member)" icon="sym_r_check"/> -->
                  <!-- <MenuItemComponent v-if="member.groupRole.name === GroupRole.Guest" label="Reject" @click="openGroupMemberRoleDialog(group, member)" icon="sym_r_close"/> -->
                  <MenuItemComponent label="Change group role" @click="openGroupMemberRoleDialog(group, member)" icon="sym_r_edit"/>
                  <MenuItemComponent label="Remove from group" @click="openGroupMemberDeleteDialog(group, member)" icon="sym_r_delete" />
                </q-list>
              </q-menu>
            </q-btn>
          </div>
        </q-item-section>
        </q-item>
      </q-list>
      <NoContentComponent v-if="!filteredMembers?.length" :label="getNoContentMessage" icon="sym_r_group"/>
    </div>
    <NoContentComponent data-cy="no-permission-group-members-page" v-if="!isLoading && group && !hasPermission" label="You don't have permission to see this page" icon="sym_r_group"/>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGroupStore } from 'stores/group-store.ts'
import SpinnerComponent from 'components/common/SpinnerComponent.vue'
import { getImageSrc } from 'src/utils/imageUtils'
import { formatDate } from 'src/utils/dateUtils'
import SubtitleComponent from 'src/components/common/SubtitleComponent.vue'
import MenuItemComponent from 'src/components/common/MenuItemComponent.vue'
import { useNavigation } from 'src/composables/useNavigation'
import { useGroupDialog } from 'src/composables/useGroupDialog'
import { GroupPermission, GroupRole } from 'src/types'
import { useAuthStore } from 'src/stores/auth-store'

const group = computed(() => useGroupStore().group)
const groupMembers = computed(() => useGroupStore().group?.groupMembers)
const isLoading = ref<boolean>(false)
const searchQuery = ref('')
const roleFilter = ref<GroupRole | ''>('')

const { navigateToMember, navigateToChat } = useNavigation()
const { openGroupMemberRoleDialog, openGroupMemberDeleteDialog } = useGroupDialog()

const roleOptions = [
  { label: 'All', value: '' },
  { label: 'Organiser', value: 'owner' },
  { label: 'Moderator', value: 'moderator' },
  { label: 'Admin', value: 'admin' },
  { label: 'Member', value: 'member' },
  { label: 'Guest', value: 'guest' }
]

const filteredMembers = computed(() => {
  return groupMembers.value?.filter(member => {
    const nameMatch = member.user?.name?.toLowerCase().includes(searchQuery.value.toLowerCase())
    const roleMatch = !roleFilter.value || member.groupRole.name.toLowerCase() === roleFilter.value.toLowerCase()

    return nameMatch && roleMatch
  })
})

const getNoContentMessage = computed(() => {
  if (searchQuery.value || roleFilter.value) {
    return 'No members found with current filters'
  }
  return 'No group members yet'
})

const hasPermission = computed(() => {
  return group.value && (useGroupStore().getterIsPublicGroup || (useGroupStore().getterIsAuthenticatedGroup && useAuthStore().isAuthenticated) || useGroupStore().getterUserHasPermission(GroupPermission.SeeMembers))
})

onMounted(() => {
  if (group.value && hasPermission.value) {
    isLoading.value = true
    useGroupStore().actionGetGroupMembers(group.value.slug).finally(() => (isLoading.value = false))
  }
})

const capitalizeFirstLetter = (string: string) => {
  return string.charAt(0).toUpperCase() + string.slice(1)
}
</script>
