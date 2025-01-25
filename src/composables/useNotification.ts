import { Notify } from 'quasar'

type Position = 'top-right' | 'top-left' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom' | 'left' | 'right' | 'center' | undefined

export function useNotification () {
  const success = (message: string, title?: string) => {
    Notify.create({
      type: 'positive',
      message,
      icon: 'sym_r_check_circle',
      caption: title || 'Success',
      timeout: 3000
    })
  }

  const error = (message: string, title?: string) => {
    Notify.create({
      textColor: 'black',
      type: 'negative',
      message,
      icon: 'sym_r_error',
      caption: title || 'Error',
      timeout: 3000
    })
  }

  const warning = (message: string, title?: string) => {
    Notify.create({
      type: 'warning',
      message,
      icon: 'sym_r_warning',
      caption: title || 'Warning',
      timeout: 3000
    })
  }

  const info = (message: string, title?: string) => {
    Notify.create({
      type: 'info',
      message,
      caption: title || 'Info',
      timeout: 3000
    })
  }

  const notify = (message: string, type: string = 'positive', title: string = '', position: Position = 'top-right', timeout: number = 3000) => {
    Notify.create({
      type,
      message,
      caption: title,
      position,
      timeout
    })
  }

  return {
    notify,
    success,
    error,
    warning,
    info
  }
}
