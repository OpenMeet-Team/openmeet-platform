import { Dialog } from 'quasar'
import ContactAdminsDialogComponent from '../components/group/ContactAdminsDialogComponent.vue'
import type { GroupEntity } from '../types'

export function useContactAdminsDialog () {
  const openContactAdminsDialog = (group: GroupEntity) => {
    return Dialog.create({
      component: ContactAdminsDialogComponent,
      componentProps: {
        group
      }
    })
  }

  return {
    openContactAdminsDialog
  }
}
