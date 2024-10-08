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
    $q.dialog({
      component: GroupFormDialogComponent,
      componentProps: {
        onSubmit: (formData: never) => {
          // Here you can handle the form submission
          console.log('Group created:', formData)
          // You might want to update your app state or make an API call here
        }
      }
    })
  }

  const openDeleteGroupDialog = (group: GroupEntity) => {
    $q.dialog({
      title: 'Delete Group',
      message: `Are you sure you want to delete the group '${group.name}'? This action cannot be undone.`,
      cancel: true,
      persistent: true
    }).onOk(() => {
      return groupsApi.delete(group.id).then(() => {
        success('Group deleted')
      })
    })
  }

  return {
    openCreateGroupDialog,
    openDeleteGroupDialog
  }
}
