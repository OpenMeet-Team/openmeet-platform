<script setup lang="ts">
import CustomCalendar from './CustomCalendar.vue'
import type { ExternalEvent } from '../../api/calendar'

interface GroupEvent {
  ulid: string
  slug: string
  name: string
  startDate: string
  endDate?: string
  isAllDay?: boolean
}

interface CalendarEvent {
  id: string
  title: string
  date: string
  time?: string
  startDateTime?: string
  endDateTime?: string
  type: 'attending' | 'hosting' | 'external-event' | 'external-conflict'
  bgColor: string
  textColor?: string
  slug?: string
  isAllDay?: boolean
  location?: string
  description?: string
}

interface Props {
  mode?: 'month' | 'week' | 'day'
  height?: string
  showControls?: boolean
  compact?: boolean
  startDate?: string
  endDate?: string
  groupEvents?: GroupEvent[]
  externalEvents?: ExternalEvent[]
  legendType?: 'personal' | 'group'
}

withDefaults(defineProps<Props>(), {
  mode: 'month',
  height: '400px',
  showControls: true,
  compact: false,
  groupEvents: () => [] as GroupEvent[],
  externalEvents: () => [],
  legendType: 'personal'
})

const emit = defineEmits<{
  eventClick: [event: CalendarEvent]
  dateClick: [date: string]
  dateSelect: [date: string]
  externalEventsLoaded: [events: ExternalEvent[]]
}>()

function onEventClick (event: CalendarEvent) {
  emit('eventClick', event)
}

function onDateClick (date: string) {
  emit('dateClick', date)
}

function onDateSelect (date: string) {
  emit('dateSelect', date)
}

function onExternalEventsLoaded (events: ExternalEvent[]) {
  emit('externalEventsLoaded', events)
}
</script>

<template>
  <CustomCalendar
    :mode="mode"
    :height="height"
    :show-controls="showControls"
    :compact="compact"
    :start-date="startDate"
    :end-date="endDate"
    :group-events="groupEvents"
    :external-events="externalEvents"
    :legend-type="legendType"
    @event-click="onEventClick"
    @date-click="onDateClick"
    @date-select="onDateSelect"
    @external-events-loaded="onExternalEventsLoaded"
  />
</template>
