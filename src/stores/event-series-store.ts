import { defineStore } from 'pinia'
import { EventSeriesService } from '../services/eventSeriesService'
import { useNotification } from '../composables/useNotification'

export const useEventSeriesStore = defineStore('eventSeries', {
  actions: {
    async deleteSeries (slug: string, deleteEvents: boolean) {
      const { success, error: notifyError } = useNotification()
      try {
        await EventSeriesService.delete(slug, deleteEvents)
        success('Event series deleted successfully')
      } catch (err) {
        notifyError('Failed to delete event series')
        throw err
      }
    }
  }
})
