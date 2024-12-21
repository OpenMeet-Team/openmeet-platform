<script setup lang="ts">
import { ref, watch } from 'vue'
import { date } from 'quasar'
import { useRoute, useRouter } from 'vue-router'

type DateRange = 'today' | 'tomorrow' | 'this-week' | 'next-week' | 'this-month' | 'next-month' | 'custom'

const dateRanges = ref([
  { label: 'Today', value: 'today' },
  { label: 'Tomorrow', value: 'tomorrow' },
  { label: 'This week', value: 'this-week' },
  { label: 'Next week', value: 'next-week' },
  { label: 'This month', value: 'this-month' },
  { label: 'Next month', value: 'next-month' },
  { label: 'Custom', value: 'custom' }
])
const route = useRoute()
const router = useRouter()
const selectedRange = ref<DateRange | null>(route.query.range as DateRange || null)
const customDateRange = ref({ fromDate: '', toDate: '' })
const isDateRangeDialogOpen = ref<boolean>(false)

// Watch for changes in the query and update selectedRange and customDateRange accordingly
watch(() => route.query, (newQuery) => {
  selectedRange.value = newQuery.range as DateRange || null
  if (newQuery.range === 'custom') {
    customDateRange.value.fromDate = newQuery.fromDate as string || ''
    customDateRange.value.toDate = newQuery.toDate as string || ''
  }
})

// Function to handle date filtering
const filterBy = (filter: DateRange) => {
  selectedRange.value = filter

  if (filter) {
    const today = new Date()
    let fromDate, toDate

    if (filter === 'today') {
      fromDate = today.toISOString()
      toDate = date.endOfDate(today, 'day').toISOString()
    } else if (filter === 'tomorrow') {
      const tomorrow = date.addToDate(today, { day: 1 })
      fromDate = date.startOfDate(tomorrow, 'day').toISOString()
      toDate = date.endOfDate(tomorrow, 'day').toISOString()
    } else if (filter === 'this-week') {
      const today = new Date()
      const thisWeekStart = today.toISOString()
      const thisWeekEnd = date.addToDate(thisWeekStart, { days: 6 }).toISOString()
      fromDate = thisWeekStart
      toDate = thisWeekEnd
    } else if (filter === 'next-week') {
      const today = new Date()
      const nextWeekStart = date.addToDate(today, { days: 7 })
      const nextWeekEnd = date.addToDate(nextWeekStart, { days: 6 })
      fromDate = date.startOfDate(nextWeekStart, 'day').toISOString()
      toDate = date.endOfDate(nextWeekEnd, 'day').toISOString()
    } else if (filter === 'this-month') {
      const today = new Date()
      const thisMonthStart = today.toISOString()
      const thisMonthEnd = date.endOfDate(today, 'month').toISOString()
      fromDate = thisMonthStart
      toDate = thisMonthEnd
    } else if (filter === 'next-month') {
      const today = new Date()
      const nextMonthStart = date.addToDate(today, { month: 1 }).toISOString()
      const nextMonthEnd = date.endOfDate(nextMonthStart, 'month').toISOString()
      fromDate = nextMonthStart
      toDate = nextMonthEnd
    }

    if (filter !== 'custom') {
      // Update query with start and end dates
      router.push({
        query: {
          ...route.query,
          range: selectedRange.value,
          fromDate,
          toDate,
          page: 1
        }
      })
    } else {
      // Open date range dialog for custom filter
      isDateRangeDialogOpen.value = true
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { fromDate, toDate, range, ...rest } = route.query // Destructure to remove location
    router.push({
      query: {
        ...rest,
        page: 1
      }
    })
  }
}

const applyCustomDateRange = () => {
  if (customDateRange.value.fromDate && customDateRange.value.toDate) {
    router.push({
      query: {
        ...route.query,
        range: 'custom',
        fromDate: new Date(customDateRange.value.fromDate).toISOString(),
        toDate: new Date(customDateRange.value.toDate).toISOString(),
        page: 1
      }
    })
    isDateRangeDialogOpen.value = false
  }
}

</script>

<template>
  <q-select
    data-cy="events-date-filter"
    :model-value="selectedRange"
    :options="dateRanges"
    label="Any day"
    outlined
    emit-value
    filled
    map-options
    clearable
    :hide-dropdown-icon="!!selectedRange"
    style="min-width: 150px;"
    @update:model-value="filterBy"
  />
  <!-- Custom Date Range Dialog -->
  <q-dialog v-model="isDateRangeDialogOpen">
    <q-card>
      <q-card-section>
        <q-input v-model="customDateRange.fromDate" label="Start Date" type="date"/>
        <q-input v-model="customDateRange.toDate" label="End Date" type="date"/>
      </q-card-section>
      <q-card-actions>
        <q-btn flat label="Cancel" @click="isDateRangeDialogOpen = false"/>
        <q-btn color="primary" label="Apply" @click="applyCustomDateRange()"/>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">

</style>
