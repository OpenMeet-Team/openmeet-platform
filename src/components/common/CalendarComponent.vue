<script setup lang="ts">
interface CalendarEvent {
  title: string
  date: string
  bgColor: string
}

interface Props {
  events?: CalendarEvent[]
}

defineProps<Props>()
</script>
<template>
  <q-calendar :events="events" />
</template>

<style src="@quasar/quasar-ui-qcalendar/dist/index.css">

</style>
