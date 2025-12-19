<template>
  <div v-if="group" style="max-width: 800px; margin: 0 auto;" class="c-group-members-page q-pb-xl">
    <SpinnerComponent v-if="isLoading"/>
    <div data-cy="group-members-page" v-if="!isLoading && group && hasPermission">
      <SubtitleComponent class="q-mt-md" label="All group members" :count="group.groupMembers?.length" hide-link />
      <div class="row q-col-gutter-md q-mb-md">
        <div class="col-12 col-sm-6">
          <q-input
            v-model="searchQuery"
            label="Search members"
            outlined
          />
        </div>

        <div class="col-12 col-sm-3">
          <q-select
            v-model="sortMode"
            :options="sortOptions"
            map-options
            emit-value
            label="Sort by"
            outlined
          />
        </div>

        <div class="col-12 col-sm-3">
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
      <q-list bordered separator class="members-list">
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
            <q-btn color="primary" :disable="member.user.slug === useAuthStore().user?.slug" size="md" @click="navigateToChat({ user: member.user.slug })" round flat icon="sym_r_chat" />
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
import { useGroupStore } from '../../stores/group-store'
import SpinnerComponent from '../../components/common/SpinnerComponent.vue'
import { getImageSrc } from '../../utils/imageUtils'
import { formatDate } from '../../utils/dateUtils'
import SubtitleComponent from '../../components/common/SubtitleComponent.vue'
import MenuItemComponent from '../../components/common/MenuItemComponent.vue'
import { useNavigation } from '../../composables/useNavigation'
import { useGroupDialog } from '../../composables/useGroupDialog'
import { GroupPermission, GroupRole } from '../../types'
import { useAuthStore } from '../../stores/auth-store'

const group = computed(() => useGroupStore().group)
const groupMembers = computed(() => useGroupStore().group?.groupMembers)
const isLoading = ref<boolean>(false)
const searchQuery = ref('')
const roleFilter = ref<GroupRole | ''>('')
const sortMode = ref<'firstName' | 'lastName' | ''>('')

const { navigateToMember, navigateToChat } = useNavigation()
const { openGroupMemberRoleDialog, openGroupMemberDeleteDialog } = useGroupDialog()

const roleOptions = [
  { label: 'All', value: '' },
  { label: 'Organizer', value: 'owner' },
  { label: 'Moderator', value: 'moderator' },
  { label: 'Admin', value: 'admin' },
  { label: 'Member', value: 'member' },
  { label: 'Guest', value: 'guest' }
]

const sortOptions = [
  { label: 'First Name', value: 'firstName' },
  { label: 'Last Name', value: 'lastName' }
]

const filteredMembers = computed(() => {
  return groupMembers.value?.filter(member => {
    const nameMatch = member.user?.name?.toLowerCase().includes(searchQuery.value.toLowerCase())
    const roleMatch = !roleFilter.value || member.groupRole.name.toLowerCase() === roleFilter.value.toLowerCase()

    return nameMatch && roleMatch
  }).sort((a, b) => {
    if (sortMode.value === 'lastName') {
      return a.user?.lastName?.localeCompare(b.user?.lastName || '') || 0
    } else if (sortMode.value === 'firstName') {
      return a.user?.firstName?.localeCompare(b.user?.firstName || '') || 0
    }
    return 0
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

<style scoped>
.members-list {
  /* Handle large member lists properly on mobile */
  max-height: none;
  overflow: visible;
}

/* Ensure proper spacing and layout flow on mobile */
@media (max-width: 768px) {
  .c-group-members-page {
    /* Ensure the container has enough space */
    min-height: auto;
    margin-bottom: 6rem; /* Large margin to separate from similar events */
  }

  .members-list {
    /* Allow the list to flow naturally */
    margin-bottom: 4rem;
  }
}
</style>
