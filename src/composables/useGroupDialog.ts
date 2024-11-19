import { useQuasar } from 'quasar'
import GroupFormDialogComponent from 'src/components/group/GroupFormDialogComponent.vue'
import { GroupEntity, GroupMemberEntity } from 'src/types'
import { groupsApi } from 'src/api/groups.ts'
import { useNotification } from 'src/composables/useNotification.ts'
import GroupWelcomeDialogComponent from 'components/group/GroupWelcomeDialogComponent.vue'
import GroupMemberRoleDialogComponent from 'src/components/group/GroupMemberRoleDialogComponent.vue'
import GroupMemberDeleteDialogComponent from 'src/components/group/GroupMemberDeleteDialogComponent.vue'

export function useGroupDialog () {
  const $q = useQuasar()
  const { success } = useNotification()

  const openCreateGroupDialog = () => {
    return $q.dialog({
      component: GroupFormDialogComponent
    })
  }

  const openGroupMemberRoleDialog = (group: GroupEntity, member: GroupMemberEntity) => {
    return $q.dialog({
      component: GroupMemberRoleDialogComponent,
      componentProps: {
        group,
        member
      }
    })
  }

  const openGroupMemberDeleteDialog = (group: GroupEntity, member: GroupMemberEntity) => {
    return $q.dialog({
      component: GroupMemberDeleteDialogComponent,
      componentProps: {
        group,
        member
      }
    })
  }

  const openWelcomeGroupDialog = (group: GroupEntity) => {
    return $q.dialog({
      component: GroupWelcomeDialogComponent,
      componentProps: {
        group
      }
    })
  }

  const openDeleteGroupDialog = (group: GroupEntity) => {
    return $q.dialog({
      title: 'Delete Group',
      message: `Are you sure you want to delete the group '${group.name}'? This action cannot be undone.`,
      cancel: true,
      ok: {
        label: 'Delete Group',
        color: 'negative'
      },
      persistent: true
    }).onOk(() => {
      return groupsApi.delete(group.ulid).then(() => {
        return success('Group deleted')
      })
    })
  }

  const openLeaveGroupDialog = () => {
    return $q.dialog({
      title: 'Leave Group',
      message: 'Are you sure you want to leave this group?',
      cancel: true,
      ok: {
        label: 'Leave Group',
        color: 'primary'
      },
      persistent: true
    })
  }

  return {
    openCreateGroupDialog,
    openDeleteGroupDialog,
    openLeaveGroupDialog,
    openWelcomeGroupDialog,
    openGroupMemberRoleDialog,
    openGroupMemberDeleteDialog
  }
}
