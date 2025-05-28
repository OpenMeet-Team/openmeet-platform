import { useQuasar } from 'quasar'
import AdminMessageDialogComponent from '../components/group/AdminMessageDialogComponent.vue'
import { GroupEntity } from '../types'
import { useGroupStore } from '../stores/group-store'

export function useAdminMessageDialog () {
  const $q = useQuasar()
  const groupStore = useGroupStore()

  const openAdminMessageDialog = async (group: GroupEntity) => {
    // Ensure we have the latest group members data
    await groupStore.actionGetGroupMembers(group.slug)

    return $q.dialog({
      component: AdminMessageDialogComponent,
      componentProps: {
        group,
        members: groupStore.group?.groupMembers || []
      }
    })
  }

  return {
    openAdminMessageDialog
  }
}
