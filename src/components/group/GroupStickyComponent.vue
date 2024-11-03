<script setup lang="ts">
import { Dark } from 'quasar'
import { useAuthStore } from 'stores/auth-store.ts'
import { useAuthDialog } from 'src/composables/useAuthDialog.ts'
import { useGroupStore } from 'stores/group-store.ts'
import MenuItemComponent from 'components/common/MenuItemComponent.vue'
import { computed, ref } from 'vue'
import { useGroupDialog } from 'src/composables/useGroupDialog.ts'
import { useNotification } from 'src/composables/useNotification.ts'
import { useRouter } from 'vue-router'
import { useEventDialog } from 'src/composables/useEventDialog.ts'
import { GroupEntity } from 'src/types'

const { openLoginDialog } = useAuthDialog()
const groupStore = useGroupStore()
const group = computed(() => groupStore.group)
const isJoining = ref<boolean>(false)
const { openWelcomeGroupDialog, openLeaveGroupDialog } = useGroupDialog()
const router = useRouter()
const { success } = useNotification()
const onJoinGroup = () => {
  if (useAuthStore().isAuthenticated && group.value) {
    isJoining.value = true
    useGroupStore().actionJoinGroup(String(group.value.id)).finally(() => (isJoining.value = false)).then(() => {
      if (group.value) openWelcomeGroupDialog(group.value)
    })
  } else {
    openLoginDialog()
  }
}
const { openCreateEventDialog, openDeleteGroupDialog } = useEventDialog()

const onDeleteGroup = () => {
  openDeleteGroupDialog().onOk(() => {
    useGroupStore().actionDeleteGroup(group.value?.id as number).then(() => {
      success(`You have deleted the group: ${group.value?.name}`)
      router.push({ name: 'GroupsPage' })
    })
  })
}
const onLeaveGroup = () => {
  openLeaveGroupDialog().onOk(() => {
    useGroupStore().actionLeaveGroup(String(group.value?.id)).then(() => {
      success(`You have left the group: ${group.value?.name}`)
      router.push({ name: 'GroupsPage' })
    })
  })
}
</script>

<template>
  <div :class="[Dark.isActive ? 'bg-dark' : 'bg-grey-2', 'q-mt-lg rounded-borders']" style="position: sticky; top: 54px; z-index: 1001">
    <div class="row">
      <div class="col-12 col-sm-6 q-pa-sm">
        <q-tabs align="justify" no-caps narrow-indicator>
          <q-route-tab :to="{name: 'GroupPage'}" label="About"/>
          <q-route-tab :to="{name: 'GroupEventsPage'}" name="events" label="Events"/>
          <q-route-tab :to="{name: 'GroupMembersPage'}" name="members"
                       label="Members"/>
          <q-route-tab :to="{name: 'GroupDiscussionsPage'}" name="discussions"
                       label="Discussions"/>
        </q-tabs>
      </div>
      <div class="col-12 col-sm-6 q-px-lg row items-center q-gutter-md" v-if="useGroupStore().getterUserGroupRole('owner') || useGroupStore().getterUserGroupRole('manager')">
        <q-btn @click="openCreateEventDialog(group as GroupEntity)" no-caps size="md"
               label="Create event" color="primary"/>
        <q-btn-dropdown outline size="md" v-if="useGroupStore().getterGroupHasGroupMember()" align="center" no-caps label="Manage group">
          <q-list>
            <MenuItemComponent v-if="useGroupStore().getterUserGroupRole('owner') || useGroupStore().getterUserGroupPermission('groupSettings')" label="Edit group" icon="sym_r_settings" @click="router.push({ name: 'DashboardGroupPage', params: { id: String(group?.id) } })"/>
            <MenuItemComponent v-if="useGroupStore().getterUserGroupRole('owner') || useGroupStore().getterUserGroupPermission('deleteGroups')" label="Delete group" icon="sym_r_delete" @click="onDeleteGroup"/>
          </q-list>
        </q-btn-dropdown>
      </div>
      <div class="col-12 col-sm-6 q-px-lg row items-center" v-else>
        <q-btn :loading="isJoining" @click="onJoinGroup" v-if="!useGroupStore().getterGroupHasGroupMember()" no-caps size="md"
               label="Join this group" color="primary"/>
        <q-btn-dropdown outline size="md" v-else-if="useGroupStore().getterGroupHasGroupMember()" align="center" no-caps label="You're a member">
          <q-list>
            <MenuItemComponent label="Leave this group" icon="sym_r_report" @click="onLeaveGroup"/>
          </q-list>
        </q-btn-dropdown>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">

</style>
