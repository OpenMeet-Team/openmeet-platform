import { defineStore } from 'pinia'
import { EventAttendeeEntity, EventAttendeePermission, EventAttendeeRole, EventEntity, EventVisibility, GroupPermission, EventAttendeeStatus } from '../types'
import { useNotification } from '../composables/useNotification'
import { api } from '../boot/axios'
import { AxiosError } from 'axios'
import { eventsApi } from '../api/events'
import { chatApi } from '../api/chat'
import { EventSeriesService } from '../services/eventSeriesService'
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

    async actionSendEventDiscussionMessage (message: string): Promise<string | number | undefined> {
      try {
        if (this.event?.slug) {
          try {
            // Use the new chatApi endpoint instead of eventsApi
            const res = await chatApi.sendEventMessage(this.event.slug, message)

            // After sending a message, check if we can get the roomId
            if (!this.event.roomId) {
              // Slight delay to ensure backend has processed the message
              await new Promise(resolve => setTimeout(resolve, 500))

              await this.actionGetEventDiscussionMessages()
                .catch(e => logger.error('Error getting messages after send:', e))
            }

            // If we still don't have a roomId, try to use the message ID as a fallback
            if (!this.event.roomId && res.data.id) {
              const parts = String(res.data.id).split(':')
              if (parts.length > 1) {
                // Tag as constructed ID for special handling
                this.event.roomId = `constructed:${res.data.id}`
              }
            }

            return res.data.id
          } catch (apiErr) {
            // Check if this is a permissions error (403)
            if (apiErr.response && apiErr.response.status === 403) {
              logger.warn('Permission denied when sending message to event discussion')

              // Try to get messages anyway - the room might already exist
              await this.actionGetEventDiscussionMessages().catch(() => {})

              throw new Error('Permission denied: Cannot send messages to this event discussion')
            }

            // Rethrow other errors
            throw apiErr
          }
        }
      } catch (err) {
        logger.error('Failed to send event discussion message:', err)
        error('Failed to send event discussion message')

        // Rethrow for handling in the component
        throw err
      }
    },

    async actionGetEventDiscussionMessages (limit = 50, from?: string) {
      try {
        if (this.event?.slug) {
          const res = await chatApi.getEventMessages(this.event.slug, limit, from)

          // Store the roomId in the event object if it's provided
          if (res.data.roomId && this.event) {
            this.event.roomId = res.data.roomId
          }

          // If we have messages but no roomId, try to extract it from the messages
          if (!this.event.roomId && res.data.messages && res.data.messages.length > 0) {
            // Check all messages for a roomId or room_id property
            for (const message of res.data.messages) {
              // Try both property naming conventions
              const extractedRoomId = message.roomId || message.room_id
              if (extractedRoomId) {
                logger.debug('Extracted roomId from message:', extractedRoomId)
                this.event.roomId = extractedRoomId
                break
              }
            }

            // Skip hardcoded room IDs - we'll fix the actual issue

            // If still no roomId but we have event IDs, try to infer the room
            if (!this.event.roomId && (res.data.messages[0].event_id || res.data.messages[0].eventId)) {
              // Parse Matrix event IDs which follow the format '$random:server.domain'
              const eventId = res.data.messages[0].event_id || res.data.messages[0].eventId
              const parts = eventId.split(':')

              if (parts.length >= 2) {
                const serverDomain = parts[parts.length - 1]

                // Create a room ID with the event slug and server domain
                // This follows the Matrix room ID format '!random:server.domain'
                const inferredRoomId = `!event_${this.event.slug}:${serverDomain}`
                logger.debug('Inferring room ID from server domain:', inferredRoomId)
                this.event.roomId = inferredRoomId
              }
            }
          }

          logger.debug('Current event roomId after processing:', this.event.roomId)
          return res.data
        }
        return { messages: [], end: '' }
      } catch (err) {
        logger.error('Error getting event discussion messages:', err)
        error('Failed to get event discussion messages')
        return { messages: [], end: '' }
      }
    },

    async actionJoinEventChatRoom () {
      try {
        if (this.event?.slug) {
          const { matrixClientService } = await import('../services/matrixClientService')
          const joinResult = await matrixClientService.joinEventChatRoom(this.event.slug)

          // Cache the room ID for efficiency
          if (joinResult.room && this.event) {
            this.event.roomId = joinResult.room.roomId
          } else {
            logger.warn('No room returned from Matrix-native join')
          }

          return joinResult.roomInfo
        }
        return null
      } catch (error) {
        logger.error('Error joining event chat room:', error)
        throw error
      }
    },

    async actionAddMemberToEventDiscussion (userSlug: string) {
      try {
        if (this.event?.slug) {
          const response = await chatApi.addMemberToEventDiscussion(this.event.slug, userSlug)

          // Check if the response includes a roomId
          if (response.data && response.data.roomId && this.event) {
            this.event.roomId = response.data.roomId
          } else {
            logger.warn('No roomId returned from addMemberToEventDiscussion API call')
          }

          return true
        }
        return false
      } catch (err) {
        logger.error('Failed to add member to event discussion:', err)

        // Check for permission errors to provide better messaging
        if (err.response && err.response.status === 403) {
          error('You don\'t have permission to join this discussion')
        } else {
          error('Failed to add member to event discussion')
        }

        return false
      }
    },

    async actionRemoveMemberFromEventDiscussion (userSlug: string) {
      try {
        if (this.event?.slug) {
          await chatApi.removeMemberFromEventDiscussion(this.event.slug, userSlug)
          return true
        }
        return false
      } catch (err) {
        logger.debug('Error in event store:', err)
        error('Failed to remove member from event discussion')
        return false
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
