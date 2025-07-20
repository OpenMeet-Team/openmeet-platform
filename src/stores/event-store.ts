import { defineStore } from 'pinia'
import { EventAttendeeEntity, EventAttendeePermission, EventAttendeeRole, EventEntity, EventVisibility, GroupPermission, EventAttendeeStatus } from '../types'
import { useNotification } from '../composables/useNotification'
import { api } from '../boot/axios'
import { AxiosError } from 'axios'
import { eventsApi } from '../api/events'
import { chatApi } from '../api/chat'
import { EventSeriesService } from '../services/eventSeriesService'
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
      // Optionally, log the error details for debugging
      console.error('Error details:', err)
    },
    async actionGetEventBySlug (slug: string) {
      this.isLoading = true
      this.errorMessage = null

      try {
        console.log(`Fetching event details for slug: ${slug}`)
        const res = await api.get(`/api/events/${slug}`)

        // DEBUG: Log full API response to inspect attendance data
        console.log('API Response for event details:', res.data)

        // Specifically check for attendee data
        if (res.data.attendee) {
          console.log('Attendee data found in API response:', res.data.attendee)
          console.log('Attendee status:', res.data.attendee.status)
        } else {
          console.log('No attendee data found in API response')
        }

        this.event = res.data

        // Check what got stored in the event store
        console.log('Event store updated, attendee data:', this.event?.attendee)
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

        // Examine the attend response structure in detail
        console.log('Attend response structure:')
        console.log('- Status:', response.data.status)
        console.log('- Role:', response.data.role)
        console.log('- User ID:', response.data.user?.id)
        console.log('- Is attendee complete?', !!response.data.status && !!response.data.user)

        // IMPORTANT FIX: DIRECTLY UPDATE THE LOCAL STORE WITH ATTENDEE DATA
        // Since the API doesn't seem to return attendee data in the event refresh,
        // we'll use the attend API response to update the local state
        if (this.event && response.data) {
          console.log('Directly updating store with attendance data instead of refreshing')
          // Keep the original event data but update the attendee property
          this.event = {
            ...this.event,
            attendee: response.data
          }
          console.log('Updated event store with new attendee data:', this.event.attendee)

          // Also increment the attendees count
          if (this.event.attendeesCount !== undefined) {
            this.event.attendeesCount += 1
          }
        }

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

        // Log detailed information about the response
        console.log('Cancel attendance response details:', {
          status: response.data.status,
          userId: response.data.user?.id,
          attendeeId: response.data.id,
          responseComplete: !!response.data && !!response.data.status
        })

        // IMPORTANT FIX: DIRECTLY UPDATE THE LOCAL STORE WITH CANCELLED STATUS
        if (this.event && response.data) {
          console.log('Directly updating store with cancel data instead of refreshing')

          // Log current state before update
          console.log('Current attendee state before update:', {
            attendeeStatus: this.event.attendee?.status,
            attendeeId: this.event.attendee?.id
          })

          // Make sure the response contains a valid attendee with Cancelled status
          if (response.data.status === EventAttendeeStatus.Cancelled) {
            // Update attendee with the cancelled status
            this.event = {
              ...this.event,
              attendee: response.data
            }
            console.log('Updated event store with cancelled attendee data:', {
              status: this.event.attendee.status,
              id: this.event.attendee.id
            })

            // Also update attendees count if applicable
            if (this.event.attendeesCount !== undefined && this.event.attendeesCount > 0) {
              this.event.attendeesCount -= 1
            }
          } else {
            console.warn('Received response without Cancelled status:', response.data.status)
          }
        } else {
          console.warn('Unable to update store - missing event or response data')
        }

        return response.data
      } catch (error) {
        console.error('Error in actionCancelAttending:', error)
        throw error
      }
    },

    async actionSendEventDiscussionMessage (message: string): Promise<string | number | undefined> {
      try {
        if (this.event?.slug) {
          console.log('Sending discussion message to event:', this.event.slug, message)

          try {
            // Get current time for debugging
            console.log(`Sending message at ${new Date().toISOString()}`)

            // Use the new chatApi endpoint instead of eventsApi
            const res = await chatApi.sendEventMessage(this.event.slug, message)
            console.log('Discussion message sent successfully, ID:', res.data.id)

            // After sending a message, check if we can get the roomId
            if (!this.event.roomId) {
              // Slight delay to ensure backend has processed the message
              console.log('Waiting briefly before loading messages to get room ID')
              await new Promise(resolve => setTimeout(resolve, 500))

              console.log('Attempting to load messages to get room ID after sending message')
              await this.actionGetEventDiscussionMessages()
                .then(result => {
                  console.log('Got messages after sending:', result.messages?.length || 0)
                })
                .catch(e => console.error('Error getting messages after send:', e))
            }

            // If we still don't have a roomId, try to use the message ID as a fallback
            // Some Matrix implementations embed the roomId in the event_id
            if (!this.event.roomId && res.data.id) {
              console.log('Attempting to create fallback roomId from message ID')

              // Check if the event ID might have the room ID embedded (Matrix format)
              const parts = String(res.data.id).split(':')
              if (parts.length > 1) {
                // If the ID looks like "$event_id:server.domain", try to extract room ID
                console.log('Message ID seems to be a Matrix event ID, attempting to parse:', res.data.id)

                // TODO: Potentially implement a more sophisticated parsing mechanism
                // For now, we'll just tag it as a constructed ID for special handling
                this.event.roomId = `constructed:${res.data.id}`
                console.log('Created fallback roomId:', this.event.roomId)
              }
            }

            return res.data.id
          } catch (apiErr) {
            // Check if this is a permissions error (403)
            if (apiErr.response && apiErr.response.status === 403) {
              console.warn('Permission denied when sending message to event discussion')

              // Try to get messages anyway - the room might already exist
              await this.actionGetEventDiscussionMessages().catch(() => {})

              // Rethrow for proper handling upstream
              throw new Error('Permission denied: Cannot send messages to this event discussion')
            }

            // Rethrow other errors
            throw apiErr
          }
        }
      } catch (err) {
        console.error('Failed to send event discussion message:', err)
        error('Failed to send event discussion message')

        // Rethrow for handling in the component
        throw err
      }
    },

    async actionGetEventDiscussionMessages (limit = 50, from?: string) {
      try {
        if (this.event?.slug) {
          console.log('Getting event discussion messages for:', this.event.slug)

          // Make the API call using the new chatApi endpoint
          const res = await chatApi.getEventMessages(this.event.slug, limit, from)

          // Log the full response for debugging
          console.log('Raw API response:', res.data)

          console.log('Response from getDiscussionMessages:', {
            messageCount: res.data.messages?.length || 0,
            roomId: res.data.roomId,
            hasFirstMessage: res.data.messages?.length > 0,
            firstMessageRoomId: res.data.messages?.length > 0 ? res.data.messages[0].room_id : null
          })

          // Log a sample message if available for debugging
          if (res.data.messages && res.data.messages.length > 0) {
            console.log('Sample message from API:', JSON.stringify(res.data.messages[0], null, 2))
          }

          // Store the roomId in the event object if it's provided
          if (res.data.roomId && this.event) {
            console.log('Found roomId in API response:', res.data.roomId)
            this.event.roomId = res.data.roomId
          }

          // If we have messages but no roomId, try to extract it from the messages
          if (!this.event.roomId && res.data.messages && res.data.messages.length > 0) {
            // Check all messages for a roomId or room_id property
            for (const message of res.data.messages) {
              // Try both property naming conventions
              const extractedRoomId = message.roomId || message.room_id
              if (extractedRoomId) {
                console.log('Extracted roomId from message:', extractedRoomId)
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
                console.log('Inferring room ID from server domain:', inferredRoomId)
                this.event.roomId = inferredRoomId
              }
            }
          }

          console.log('Current event roomId after processing:', this.event.roomId)
          return res.data
        }
        return { messages: [], end: '' }
      } catch (err) {
        console.log(err)
        error('Failed to get event discussion messages')
        return { messages: [], end: '' }
      }
    },

    async actionJoinEventChatRoom () {
      try {
        if (this.event?.slug) {
          console.log(`Attempting to join chat room for event ${this.event.slug} via Matrix-native approach`)
          const { matrixClientService } = await import('../services/matrixClientService')
          const joinResult = await matrixClientService.joinEventChatRoom(this.event.slug)
          console.log('Successfully joined chat room for event via Matrix-native approach', joinResult.roomInfo)

          // The Matrix-native approach returns room info with roomId and alias
          if (joinResult.room) {
            console.log(`Received roomId from Matrix-native join: ${joinResult.room.roomId}`)
            // Save the roomId directly to the event object
            if (this.event) {
              this.event.roomId = joinResult.room.roomId
              console.log(`Updated event with roomId: ${this.event.roomId}`)
            }
          } else {
            console.warn('No roomId returned from Matrix-native join')
          }

          return joinResult.roomInfo
        }
        return null
      } catch (error) {
        console.error('Error joining event chat room:', error)
        throw error
      }
    },

    async actionAddMemberToEventDiscussion (userSlug: string) {
      try {
        if (this.event?.slug) {
          console.log(`Attempting to add user ${userSlug} to discussion for event ${this.event.slug}`)
          const response = await chatApi.addMemberToEventDiscussion(this.event.slug, userSlug)
          console.log(`Successfully added user ${userSlug} to discussion`, response.data)

          // Check if the response includes a roomId (it should from the server)
          if (response.data && response.data.roomId) {
            console.log(`Received roomId from addMemberToEventDiscussion: ${response.data.roomId}`)
            // Save the roomId directly to the event object if provided
            if (this.event) {
              this.event.roomId = response.data.roomId
              console.log(`Updated event with roomId: ${this.event.roomId}`)
            }
          } else {
            console.warn('No roomId returned from addMemberToEventDiscussion API call')
          }

          return true
        }
        return false
      } catch (err) {
        console.error('Failed to add member to event discussion:', err)

        // Check for permission errors to provide better messaging
        if (err.response && err.response.status === 403) {
          console.warn('Permission denied when adding member to event discussion - user may not have required role')
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
        console.log(err)
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
        console.log(`Materializing occurrence: series=${seriesSlug}, date=${occurrenceDate}`)

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
        console.error('Error materializing occurrence:', err)
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
        console.error('Failed to send contact message to organizers:', err)
        error('Failed to send contact message to organizers')
        throw err
      }
    }
  }
})
