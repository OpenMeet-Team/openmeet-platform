import { defineStore } from 'pinia'
import { EventAttendeeEntity, EventAttendeePermission, EventAttendeeRole, EventEntity, EventVisibility, GroupPermission, EventAttendeeStatus } from '../types'
import { useNotification } from '../composables/useNotification'
import { api } from '../boot/axios'
import { AxiosError } from 'axios'
import { eventsApi } from '../api/events'
import { EventSeriesService } from '../services/eventSeriesService'
import { matrixClientManager } from '../services/MatrixClientManager'
import { logger } from '../utils/logger'
const { error, success } = useNotification()
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
      return state.event?.visibility === EventVisibility.Unlisted
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
      // Log error details for debugging
      logger.error('Event store error details:', err)
    },
    async actionGetEventBySlug (slug: string) {
      this.isLoading = true
      this.errorMessage = null

      try {
        // Fetching event details
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
        const response = await eventsApi.attend(slug, data)

        // IMPORTANT FIX: DIRECTLY UPDATE THE LOCAL STORE WITH ATTENDEE DATA
        // Since the API doesn't seem to return attendee data in the event refresh,
        // we'll use the attend API response to update the local state
        if (this.event && response.data) {
          // Update the local store with attendee data
          this.event = {
            ...this.event,
            attendee: response.data
          }

          // Also increment the attendees count
          if (this.event.attendeesCount !== undefined) {
            this.event.attendeesCount += 1
          }
        }

        return response.data
      } catch (error) {
        logger.error('Error in actionAttendEvent:', error)
        throw error
      }
    },

    async actionCancelAttending (event: EventEntity) {
      try {
        const response = await eventsApi.cancelAttending(event.slug)

        // IMPORTANT FIX: DIRECTLY UPDATE THE LOCAL STORE WITH CANCELLED STATUS
        if (this.event && response.data) {
          // Update store with cancelled status

          // Make sure the response contains a valid attendee with Cancelled status
          if (response.data.status === EventAttendeeStatus.Cancelled) {
            // Update attendee with the cancelled status
            this.event = {
              ...this.event,
              attendee: response.data
            }
            // Updated event store with cancelled attendee data

            // Also update attendees count if applicable
            if (this.event.attendeesCount !== undefined && this.event.attendeesCount > 0) {
              this.event.attendeesCount -= 1
            }
          } else {
            logger.warn('Received response without Cancelled status:', response.data.status)
          }
        } else {
          logger.warn('Unable to update store - missing event or response data')
        }

        return response.data
      } catch (error) {
        logger.error('Error in actionCancelAttending:', error)
        throw error
      }
    },

    async actionJoinEventChatRoom () {
      try {
        if (this.event?.slug) {
          const joinResult = await matrixClientManager.joinEventChatRoom(this.event.slug)
          return joinResult.roomInfo
        }
        return null
      } catch (error) {
        logger.error('Error joining event chat room:', error)
        throw error
      }
    },

    /**
     * Centralized function to materialize an event occurrence
     *
     * This function handles the materialization logic across the application to ensure
     * consistent behavior. Materialization should happen when:
     * - A user tries to edit the event details
     * - A user tries to attend/join the event
     * - A user adds attendees to the event
     * - Any other action that would modify the event's state
     *
     * @param seriesSlug - The slug of the event series
     * @param occurrenceDate - The date of the occurrence to materialize (ISO string)
     * @param navigateToEvent - Whether to navigate to the newly materialized event (using window.location)
     * @returns The materialized event entity
     */
    async actionMaterializeOccurrence (
      seriesSlug: string,
      occurrenceDate: string,
      navigateToEvent: boolean = true
    ): Promise<EventEntity> {
      this.isLoading = true

      try {
        // Materializing occurrence

        // Call the API to materialize the occurrence
        const event = await EventSeriesService.getOccurrence(seriesSlug, occurrenceDate)

        // Show success message
        success('Event was successfully scheduled')

        // Navigate to the materialized event if requested
        // Use window.location instead of router to avoid injection context issues
        if (navigateToEvent && event.slug) {
          window.location.href = `/events/${event.slug}`
        }

        return event
      } catch (err) {
        logger.error('Error materializing occurrence:', err)
        error('Failed to materialize event: ' + (err.message || 'Unknown error'))
        throw err
      } finally {
        this.isLoading = false
      }
    },

    async actionContactOrganizers (
      slug: string,
      contactType: 'question' | 'report' | 'feedback',
      subject: string,
      message: string
    ) {
      try {
        const res = await eventsApi.contactOrganizers(slug, {
          contactType,
          subject,
          message
        })

        success(`Message sent successfully to ${res.data.deliveredCount} organizer(s)`)

        return res.data
      } catch (err) {
        logger.error('Failed to send contact message to organizers:', err)
        error('Failed to send contact message to organizers')
        throw err
      }
    }
  }
})
