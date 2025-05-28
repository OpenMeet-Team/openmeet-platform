import { Dialog } from 'quasar'
import ContactEventOrganizersDialogComponent from '../components/event/ContactEventOrganizersDialogComponent.vue'

interface ContactEventOrganizersOptions {
  event: {
    slug: string
    name: string
  }
}

export function useContactEventOrganizersDialog () {
  const showContactDialog = (options: ContactEventOrganizersOptions) => {
    return Dialog.create({
      component: ContactEventOrganizersDialogComponent,
      componentProps: {
        event: options.event
      }
    })
  }

  return {
    showContactDialog
  }
}
