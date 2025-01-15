<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { date } from 'quasar'
import { useRoute, useRouter } from 'vue-router'

type DateRange =
  | 'today'
  | 'tomorrow'
  | 'this-week'
  | 'next-week'
  | 'this-month'
  | 'next-month'
  | 'custom';

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
const selectedRange = ref<DateRange | null>(
  (route.query.range as DateRange) || null
)
const customDateRange = ref({ fromDate: '', toDate: '' })
const isDateRangeDialogOpen = ref<boolean>(false)

// Watch for changes in the query and update selectedRange and customDateRange accordingly
watch(
  () => route.query,
  (newQuery) => {
    selectedRange.value = (newQuery.range as DateRange) || null
    if (newQuery.range === 'custom') {
      customDateRange.value.fromDate = (newQuery.fromDate as string) || ''
      customDateRange.value.toDate = (newQuery.toDate as string) || ''
    }
  }
)

// Function to handle date filtering
const filterBy = (filter: DateRange) => {
  selectedRange.value = filter
  const today = new Date()

  if (filter) {
    let fromDate, toDate

    if (filter === 'today') {
      fromDate = today.toISOString()
      toDate = date.endOfDate(today, 'day').toISOString()
    } else if (filter === 'tomorrow') {
      const tomorrow = date.addToDate(today, { day: 1 })
      fromDate = date.startOfDate(tomorrow, 'day').toISOString()
      toDate = date.endOfDate(tomorrow, 'day').toISOString()
    } else if (filter === 'this-week') {
      fromDate = today.toISOString()
      const daysUntilSunday = 7 - today.getDay()
      const nextSunday = date.addToDate(today, { days: daysUntilSunday })
      toDate = date.startOfDate(nextSunday, 'day').toISOString()
    } else if (filter === 'next-week') {
      const daysUntilSunday = 7 - today.getDay()
      const nextSunday = date.addToDate(today, { days: daysUntilSunday })
      fromDate = date.startOfDate(nextSunday, 'day').toISOString()
      toDate = date.addToDate(nextSunday, { days: 6 }).toISOString()
    } else if (filter === 'this-month') {
      fromDate = today.toISOString()
      const firstOfNextMonth = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        1
      )
      toDate = date.startOfDate(firstOfNextMonth, 'day').toISOString()
    } else if (filter === 'next-month') {
      const firstOfNextMonth = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        1
      )
      fromDate = date.startOfDate(firstOfNextMonth, 'day').toISOString()
      toDate = date.endOfDate(firstOfNextMonth, 'month').toISOString()
    }

    if (filter !== 'custom') {
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
      isDateRangeDialogOpen.value = true
    }
  } else {
    const { range, fromDate, toDate, ...rest } = route.query
    router.push({
      query: {
        range,
        fromDate,
        toDate,
        ...rest,
        page: 1
      }
    })
  }
}

const applyCustomDateRange = () => {
  if (customDateRange.value.fromDate && customDateRange.value.toDate) {
    // Convert dates to start and end of day to include full days
    const fromDate = date
      .startOfDate(new Date(customDateRange.value.fromDate), 'day')
      .toISOString()
    const toDate = date
      .endOfDate(new Date(customDateRange.value.toDate), 'day')
      .toISOString()

    router.push({
      query: {
        ...route.query,
        range: 'custom',
        fromDate,
        toDate,
        page: 1
      }
    })
    isDateRangeDialogOpen.value = false
  }
}

// Ensure default fromDate is set on component mount
onMounted(() => {
  // Only apply filter if range is explicitly set
  if (route.query.range) {
    filterBy(route.query.range as DateRange)
  }
  // Don't set any default fromDate if no range is specified
})

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
    style="min-width: 150px"
    @update:model-value="filterBy"
  />
  <!-- Custom Date Range Dialog -->
  <q-dialog v-model="isDateRangeDialogOpen">
    <q-card>
      <q-card-section>
        <q-input
          v-model="customDateRange.fromDate"
          label="Start Date"
          type="date"
        />
        <q-input
          v-model="customDateRange.toDate"
          label="End Date"
          type="date"
        />
      </q-card-section>
      <q-card-actions>
        <q-btn flat label="Cancel" @click="isDateRangeDialogOpen = false" />
        <q-btn color="primary" label="Apply" @click="applyCustomDateRange()" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss"></style>
