<script setup lang="ts">
import { Dark } from 'quasar'
import { useAuthStore } from '../../stores/auth-store'
import { useAuthDialog } from '../../composables/useAuthDialog'
import { useGroupStore } from '../../stores/group-store'
import MenuItemComponent from '../../components/common/MenuItemComponent.vue'
import { computed, ref } from 'vue'
import { useGroupDialog } from '../../composables/useGroupDialog'
import { useNotification } from '../../composables/useNotification'
import { useRouter } from 'vue-router'
import { useEventDialog } from '../../composables/useEventDialog'
import { useAdminMessageDialog } from '../../composables/useAdminMessageDialog'
import { useContactAdminsDialog } from '../../composables/useContactAdminsDialog'
import { GroupEntity, GroupPermission, GroupRole } from '../../types'

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
    useGroupStore().actionJoinGroup(group.value.slug).finally(() => (isJoining.value = false)).then(() => {
      if (group.value?.groupMember) openWelcomeGroupDialog(group.value)
    })
  } else {
    openLoginDialog()
  }
}
const { openCreateEventDialog, openDeleteGroupDialog } = useEventDialog()
const { openAdminMessageDialog } = useAdminMessageDialog()
const { openContactAdminsDialog } = useContactAdminsDialog()

const onSendAdminMessage = async () => {
  if (group.value) {
    await openAdminMessageDialog(group.value)
  }
}

const onContactAdmins = async () => {
  if (group.value) {
    await openContactAdminsDialog(group.value)
  }
}

const onDeleteGroup = () => {
  openDeleteGroupDialog().onOk(() => {
    useGroupStore().actionDeleteGroup(group.value?.slug as string).then(() => {
      success(`You have deleted the group: ${group.value?.name}`)
      router.push({ name: 'GroupsPage' })
    })
  })
}
const onLeaveGroup = () => {
  openLeaveGroupDialog().onOk(() => {
    useGroupStore().actionLeaveGroup(group.value?.slug as string).then(() => {
      success(`You have left the group: ${group.value?.name}`)
      router.push({ name: 'GroupsPage' })
    })
  })
}
</script>

<template>
  <div :class="[Dark.isActive ? 'bg-dark' : 'bg-grey-2', 'q-mt-lg rounded-borders']"
    style="position: sticky; top: 0; z-index: 1001">
    <div class="row">
      <div class="col-12 col-sm-6 q-pa-sm">
        <q-tabs align="justify" no-caps narrow-indicator>
          <q-route-tab :to="{ name: 'GroupAboutPage', params: { slug: group?.slug } }" label="About" />
          <q-route-tab :to="{ name: 'GroupEventsPage', params: { slug: group?.slug } }" name="events" label="Events" />
          <q-route-tab :to="{ name: 'GroupMembersPage', params: { slug: group?.slug } }" name="members" label="Members" />
          <q-route-tab :to="{ name: 'GroupDiscussionsPage', params: { slug: group?.slug } }" name="discussions" label="Discussions" />
        </q-tabs>
      </div>
      <div class="col-12 col-sm-6 q-px-lg row items-center q-gutter-md">
        <q-btn data-cy="create-event-button" @click="openCreateEventDialog(group as GroupEntity)" no-caps size="md"
          label="Create event" color="primary"
          v-if="useGroupStore().getterUserHasPermission(GroupPermission.CreateEvent)" />
        <q-btn-dropdown outline size="md" data-cy="manage-group-button"
          v-if="useGroupStore().getterUserHasPermission(GroupPermission.ManageGroup)" align="center" no-caps
          label="Manage group">
          <q-list>
            <MenuItemComponent data-cy="edit-group-button"
              v-if="useGroupStore().getterUserHasPermission(GroupPermission.ManageGroup)" label="Edit group"
              icon="sym_r_settings"
              @click="router.push({ name: 'DashboardGroupPage', params: { slug: group?.slug } })" />
            <MenuItemComponent data-cy="send-admin-message-button"
              v-if="useGroupStore().getterUserHasPermission(GroupPermission.ManageMembers)"
              label="Send Message to Members"
              icon="sym_r_send"
              @click="onSendAdminMessage" />
            <MenuItemComponent data-cy="delete-group-button"
              v-if="useGroupStore().getterUserHasPermission(GroupPermission.DeleteGroup)" label="Delete group"
              icon="sym_r_delete" @click="onDeleteGroup" />
          </q-list>
        </q-btn-dropdown>
        <q-btn data-cy="join-group-button" :loading="isJoining" @click="onJoinGroup"
          v-if="!useGroupStore().getterUserIsGroupMember()" no-caps size="md" label="Join this group"
          color="primary" />
        <q-btn-dropdown outline size="md" data-cy="leave-group-button-dropdown"
          v-else-if="useGroupStore().getterUserIsGroupMember() && !useGroupStore().getterUserHasRole(GroupRole.Owner)"
          align="center" no-caps :label="`You're a ${group?.groupMember?.groupRole.name}`">
          <q-list>
            <MenuItemComponent data-cy="contact-admins-button" label="Contact Admins" icon="sym_r_mail"
              @click="onContactAdmins" />
            <MenuItemComponent data-cy="leave-group-button" label="Leave this group" icon="sym_r_report"
              @click="onLeaveGroup" />
          </q-list>
        </q-btn-dropdown>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
