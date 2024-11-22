import { useQuasar } from 'quasar'

export function useDiscussionDialog () {
  const $q = useQuasar()

  const openDeleteMessageDialog = () => {
    return $q.dialog({
      title: 'Delete Message',
      message: 'Are you sure you want to delete this message?',
      cancel: true,
      persistent: true
    })
  }

  return {
    openDeleteMessageDialog
  }
}
