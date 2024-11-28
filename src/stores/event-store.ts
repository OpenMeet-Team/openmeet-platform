import { defineStore } from 'pinia'
import { EventAttendeeEntity, EventAttendeeRole, EventEntity } from 'src/types'
import { useNotification } from 'src/composables/useNotification.ts'
import { eventsApi } from 'src/api/events.ts'
import { AxiosError } from 'axios'
import analyticsService from 'src/services/analyticsService'
const { error } = useNotification()
export const useEventStore = defineStore('event', {
  state: () => ({
    event: null as EventEntity | null,
    errorMessage: null as string | null,
    isLoading: false
  }),

  getters: {
    getterGroupMemberHasPermission: (state) => (permission: string): boolean => {
      return !!(state.event?.groupMember?.groupRole?.groupPermissions.some(p => p.name === permission))
    },
    getterEventAttendeeHasRole: (state) => (role: EventAttendeeRole): boolean => {
      return state.event?.attendee?.role?.name === role
    },
    getterEventAttendeeHasPermission: (state) => (permission: string): boolean => {
      return state.event?.attendee?.role?.permissions.some(p => p.name === permission) ?? false
      // return permission === 'test' && state.event?.attendee?.role?.name === EventAttendeeRole.Host // TODO: replace with actual permission check
    },
    getterUserIsAttendee: (state) => (): boolean => {
      return !!state.event?.attendee
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
        const res = await eventsApi.getBySlug(slug)
        this.event = res.data
      } catch (err) {
        this.handleAxiosError(err as AxiosError)
      } finally {
        this.isLoading = false
      }
    },

    async actionGetEventAttendees (slug: string) {
      try {
        const res = await eventsApi.getAttendees(slug)
        this.event = res.data
      } catch (err) {
        this.handleAxiosError(err as AxiosError)
      }
    },

    async actionAttendEvent (slug: string, data: Partial<EventAttendeeEntity>) {
      try {
        const res = await eventsApi.attend(slug, data)
        if (this.event) {
          this.event.attendees = this.event.attendees ? [...this.event.attendees, res.data] : [res.data]
          this.event.attendee = res.data
          analyticsService.trackEvent('event_attended', { event_id: this.event.id, name: this.event.name })
        }
        return res.data
      } catch (err) {
        console.log(err)
        error('Failed to join event')
      }
    },

    async actionUpdateAttendee (ulid: string, data: Partial<EventAttendeeEntity>) {
      try {
        const res = await eventsApi.updateAteendee(ulid, data)
        if (this.event) {
          this.event.attendees = this.event.attendees ? [...this.event.attendees, res.data] : [res.data]
          this.event.attendee = res.data
        }
      } catch (err) {
        console.log(err)
        error('Failed to update attendee')
      }
    },

    async actionCancelAttending (event: EventEntity) {
      if (event.attendee) {
        return await eventsApi.cancelAttending(event.slug).then((res) => {
          if (this.event) {
            this.event.attendees = this.event.attendees?.filter((attendee) => attendee.id !== event.attendee?.id)
            this.event.attendee = res.data
          }
          analyticsService.trackEvent('event_unattended', { event_id: event.id, name: event.name })
          return true
        })
      }
    },

    async actionSendEventDiscussionMessage (message: string, topicName: string): Promise<number | undefined> {
      try {
        if (this.event?.slug) {
          const res = await eventsApi.sendDiscussionMessage(this.event.slug, message, topicName)
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
          const res = await eventsApi.updateDiscussionMessage(this.event.slug, messageId, newText)
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
          const res = await eventsApi.deleteDiscussionMessage(this.event.slug, messageId)
          return res.data.id
        }
      } catch (err) {
        console.log(err)
        error('Failed to delete event discussion message')
      }
    }
  }
})
