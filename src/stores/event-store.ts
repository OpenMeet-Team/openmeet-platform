import { defineStore } from 'pinia'
import { EventAttendeeEntity, EventAttendeePermission, EventAttendeeRole, EventEntity, EventVisibility, GroupPermission } from '../types'
import { useNotification } from '../composables/useNotification'
import { api } from '../boot/axios'
import { AxiosError } from 'axios'
import { eventsApi } from '../api/events'
const { error } = useNotification()
export const useEventStore = defineStore('event', {
  state: () => ({
    event: null as EventEntity | null,
    errorMessage: null as string | null,
    isLoading: false
  }),

  getters: {
    getterGroupMemberHasPermission: (state) => (permission: GroupPermission) => {
      return !!(state.event?.groupMember?.groupRole?.groupPermissions.some(p => p.name === permission))
    },
    getterUserIsAttendee: (state) => (): EventAttendeeEntity | undefined => {
      return state.event?.attendee
    },
    getterUserHasRole: (state) => (role: EventAttendeeRole) => {
      return state.event?.attendee?.role?.name === role
    },
    getterUserHasPermission: (state) => (permission: EventAttendeePermission) => {
      return state.event?.attendee?.role?.permissions?.some(p => p.name === permission)
    },
    getterIsPublicEvent: (state) => {
      return state.event?.visibility === EventVisibility.Public
    },
    getterIsPrivateEvent: (state) => {
      return state.event?.visibility === EventVisibility.Private
    },
    getterIsAuthenticatedEvent: (state) => {
      return state.event?.visibility === EventVisibility.Authenticated
    }
  },

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
    async actionGetEventBySlug (slug: string) {
      this.isLoading = true
      this.errorMessage = null

      try {
        const res = await api.get(`/api/events/${slug}`)
        this.event = res.data
      } catch (err) {
        this.handleAxiosError(err as AxiosError)
      } finally {
        this.isLoading = false
      }
    },

    async actionAttendEvent (slug: string, data: Partial<EventAttendeeEntity>) {
      try {
        console.log('Sending attend request with data:', data)
        const response = await eventsApi.attend(slug, data)
        console.log('Received attend response:', response.data)

        // Refresh the event data to get the updated attendance status
        await this.actionGetEventBySlug(slug)

        return response.data
      } catch (error) {
        console.error('Error in actionAttendEvent:', error)
        throw error
      }
    },

    async actionCancelAttending (event: EventEntity) {
      try {
        console.log('Sending cancel attending request for event:', event.slug)
        const response = await eventsApi.cancelAttending(event.slug)
        console.log('Received cancel attending response:', response.data)

        // Refresh the event data to get the updated attendance status
        await this.actionGetEventBySlug(event.slug)

        return true
      } catch (error) {
        console.error('Error in actionCancelAttending:', error)
        throw error
      }
    },

    async actionSendEventDiscussionMessage (message: string, topicName: string): Promise<number | undefined> {
      try {
        if (this.event?.slug) {
          const res = await api.post(`/api/events/${this.event.slug}/discussion`, { message, topicName })
          return res.data.id
        }
      } catch (err) {
        console.log(err)
        error('Failed to send event discussion message')
      }
    },

    async actionUpdateEventDiscussionMessage (messageId: number, newText: string): Promise<number | undefined> {
      try {
        if (this.event?.slug) {
          const res = await api.put(`/api/events/${this.event.slug}/discussion/${messageId}`, { newText })
          return res.data.id
        }
      } catch (err) {
        console.log(err)
        error('Failed to update event discussion message')
      }
    },

    async actionDeleteEventDiscussionMessage (messageId: number): Promise<number | undefined> {
      try {
        if (this.event?.slug) {
          const res = await api.delete(`/api/events/${this.event.slug}/discussion/${messageId}`)
          return res.data.id
        }
      } catch (err) {
        console.log(err)
        error('Failed to delete event discussion message')
      }
    }
  }
})
