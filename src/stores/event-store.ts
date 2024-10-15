import { defineStore } from 'pinia'
import { EventAttendeeEntity, EventEntity } from 'src/types'
import { useNotification } from 'src/composables/useNotification.ts'
import { eventsApi } from 'src/api/events.ts'
const { error } = useNotification()
export const useEventStore = defineStore('event', {
  state: () => ({
    event: null as EventEntity | null
  }),

  getters: {},

  actions: {
    async actionGetEventById (id: string) {
      try {
        const res = await eventsApi.getById(id)
        this.event = res.data
      } catch (err) {
        console.log(err)
        error('Failed to fetch event data')
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
