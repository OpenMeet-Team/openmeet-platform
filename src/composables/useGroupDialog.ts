import { useQuasar } from 'quasar'
// import { defineAsyncComponent } from 'vue'
import GroupFormDialogComponent from 'src/components/group/GroupFormDialogComponent.vue'
import { GroupEntity } from 'src/types'
import { groupsApi } from 'src/api/groups.ts'
import { useNotification } from 'src/composables/useNotification.ts'
// const CreateGroupForm = defineAsyncComponent(() => import('./../components/group/GroupFormComponent.vue'))
// const GroupFormComponent = defineAsyncComponent(() => import('./../components/group/GroupFormComponent.vue'))

export function useGroupDialog () {
  const $q = useQuasar()
  const { success } = useNotification()

  const openCreateGroupDialog = () => {
    return $q.dialog({
      component: GroupFormDialogComponent
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
      return groupsApi.delete(group.id).then(() => {
        return success('Group deleted')
      })
    })
  }

  const openLeaveGroupDialog = (group: GroupEntity) => {
    return $q.dialog({
      title: 'Leave Group',
      message: 'Are you sure you want to leave this group?',
      cancel: true,
      ok: {
        label: 'Leave Group',
        color: 'primary'
      },
      persistent: true
    }).onOk(() => {
      return groupsApi.leave(group.id).then(() => {
        return success(`You have left the group: ${group.name}`)
      })
    })
  }

  return {
    openCreateGroupDialog,
    openDeleteGroupDialog,
    openLeaveGroupDialog
  }
}
