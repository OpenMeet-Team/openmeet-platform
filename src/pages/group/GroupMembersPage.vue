<template>
  <div v-if="group" style="max-width: 600px; margin: 0 auto;" class="c-group-members-page">
    <SpinnerComponent v-if="isLoading"/>
    <template v-if="!isLoading && group && useGroupStore().getterUserGroupPermission(GroupPermission.SeeMembers)">
      <SubtitleComponent label="All group members" :count="group.groupMembers?.length" hide-link />
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
          <q-item-section class="cursor-pointer" avatar @click="navigateToMember(member.user.id)">
            <q-avatar>
              <img :src="getImageSrc(member.user?.photo)" :alt="member.user?.name" />
            </q-avatar>
          </q-item-section>
          <q-item-section class="cursor-pointer" @click="navigateToMember(member.user.id)">
            <q-item-label>{{ member.user.name }}</q-item-label>
            <q-item-label caption>
              {{ capitalizeFirstLetter(member.groupRole.name) }} • <span v-if="member.createdAt">Joined {{ formatDate(member.createdAt, 'DD MMM YYYY') }}</span>
            </q-item-label>
          </q-item-section>
          <q-item-section top side>
          <div class="text-grey-8 q-gutter-xs">
            <q-btn size="md" @click="navigateToChat({ member: member.user.shortId || '' })" round flat icon="sym_r_chat" />
            <q-btn size="md" round flat icon="sym_r_more_vert" :disable="!((useGroupStore().getterUserGroupRole(GroupRole.Owner) || useGroupStore().getterUserGroupPermission(GroupPermission.ManageMembers)) && member.groupRole.name !== GroupRole.Owner)">
              <q-menu>
                <q-list>
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
    </template>
    <NoContentComponent v-else label="You don't have permission to see this page" icon="sym_r_group"/>
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

onMounted(() => {
  isLoading.value = true
  if (useGroupStore().getterUserGroupPermission(GroupPermission.SeeMembers)) {
    if (group.value) useGroupStore().actionGetGroupMembers(String(group.value.id)).finally(() => (isLoading.value = false))
  } else {
    isLoading.value = false
  }
})

const capitalizeFirstLetter = (string: string) => {
  return string.charAt(0).toUpperCase() + string.slice(1)
}
</script>
