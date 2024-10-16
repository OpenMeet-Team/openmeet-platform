import { defineStore } from 'pinia'
import { EventAttendeeEntity, EventEntity } from 'src/types'
import { useNotification } from 'src/composables/useNotification.ts'
import { eventsApi } from 'src/api/events.ts'
import { AxiosError } from 'axios'
const { error } = useNotification()
export const useEventStore = defineStore('event', {
  state: () => ({
    event: null as EventEntity | null,
    errorMessage: null as string | null,
    isLoading: false
  }),

  getters: {},

  actions: {
    handleAxiosError (err: AxiosError) {
      if (err.response) {
        // Server-side errors
        switch (err.response.status) {
          case 404:
            this.errorMessage = 'Event not found.'
            break
          case 403:
            this.errorMessage = 'Access denied. You may not have permission to view this event.'
            break
          case 500:
            this.errorMessage = 'Server error. Please try again later.'
            break
          default:
            this.errorMessage = 'An unexpected error occurred.'
        }
      } else if (err.request) {
        // Network errors
        this.errorMessage = 'Network error. Please check your internet connection.'
      } else {
        // Other errors (e.g., Axios configuration)
        this.errorMessage = 'An unexpected error occurred. Please try again.'
      }
      // Optionally, log the error details for debugging
      console.error('Error details:', err)
    },
    async actionGetEventById (id: string) {
      this.isLoading = true
      this.errorMessage = null

      try {
        const res = await eventsApi.getById(id)
        this.event = res.data
      } catch (err) {
        this.handleAxiosError(err as AxiosError)
      }
    },

    async actionGetEventAttendeesById (id: string) {
      try {
        const res = await eventsApi.getById(id)
        this.event = res.data
      } catch (err) {
        this.handleAxiosError(err as AxiosError)
      }
    },

    async actionAttendEvent (eventId: number, rsvpStatus: string, isHost: boolean) {
      try {
        const res = await eventsApi.attend({ eventId, rsvpStatus, isHost })
        if (this.event) {
          this.event.attendees = this.event.attendees ? [...this.event.attendees, res.data] : [res.data]
        }
      } catch (err) {
        console.log(err)
        error('Failed to join event')
      }
    },

    async actionLeaveEvent (userId: number, eventId: number) {
      try {
        await eventsApi.leave(userId, eventId)
        if (this.event) {
          this.event.attendees = this.event.attendees?.filter((member: EventAttendeeEntity) => member)
        }
      } catch (err) {
        console.log(err)
        error('Failed to leave event')
      }
    }
  }
})
