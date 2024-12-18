<script setup lang="ts">
interface CalendarEvent {
  title: string
  date: string
  bgColor: string
}

interface Props {
  mode: 'month' | 'day'
  events?: CalendarEvent[]
  selectedDates?: string[]
}

defineProps<Props>()
</script>
<template>
  <!-- <q-calendar :events="events" :mode="mode" /> -->
  <q-calendar-month :events="events" :selected-dates="selectedDates" />
</template>

<style src="@quasar/quasar-ui-qcalendar/dist/index.css">

</style>
