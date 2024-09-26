import { useQuasar } from 'quasar'
// import { defineAsyncComponent } from 'vue'
import GroupFormDialogComponent from 'src/components/group/GroupFormDialogComponent.vue'
// const CreateGroupForm = defineAsyncComponent(() => import('./../components/group/GroupFormComponent.vue'))
// const GroupFormComponent = defineAsyncComponent(() => import('./../components/group/GroupFormComponent.vue'))

export function useCreateGroupDialog () {
  const $q = useQuasar()

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

  return {
    openCreateGroupDialog
  }
}
