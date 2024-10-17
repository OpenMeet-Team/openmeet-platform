<script setup lang="ts">
import { ref, watch } from 'vue'
import { date } from 'quasar'
import { useRoute, useRouter } from 'vue-router'

type DateRange = 'today' | 'tomorrow' | 'custom'

const dateRanges = ref([
  { label: 'Today', value: 'today' },
  { label: 'Tomorrow', value: 'tomorrow' },
  // { label: 'This week', value: 'this-week' },
  // { label: 'Next week', value: 'next-week' },
  { label: 'Custom', value: 'custom' }
])
const route = useRoute()
const router = useRouter()
const selectedRange = ref<DateRange | null>(route.query.range as DateRange || null)
const customDateRange = ref({ start: '', end: '' })
const isDateRangeDialogOpen = ref<boolean>(false)

// Watch for changes in the query and update selectedRange and customDateRange accordingly
watch(() => route.query, (newQuery) => {
  selectedRange.value = newQuery.range as DateRange || null
  if (newQuery.range === 'custom') {
    customDateRange.value.start = newQuery.start as string || ''
    customDateRange.value.end = newQuery.end as string || ''
  }
})

// Function to handle date filtering
const filterBy = (filter: DateRange) => {
  selectedRange.value = filter

  if (filter) {
    const today = new Date()
    let start, end

    if (filter === 'today') {
      start = today.toISOString()
      end = date.endOfDate(today, 'day').toISOString()
    } else if (filter === 'tomorrow') {
      const tomorrow = date.addToDate(today, { day: 1 })
      start = date.startOfDate(tomorrow, 'day').toISOString()
      end = date.endOfDate(tomorrow, 'day').toISOString()
    }

    if (filter !== 'custom') {
      // Update query with start and end dates
      router.push({
        query: {
          ...route.query,
          range: selectedRange.value,
          start,
          end,
          page: 1
        }
      })
    } else {
      // Open date range dialog for custom filter
      isDateRangeDialogOpen.value = true
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { start, end, range, ...rest } = route.query // Destructure to remove location
    router.push({
      query: {
        ...rest,
        page: 1
      }
    })
  }
}

const applyCustomDateRange = () => {
  if (customDateRange.value.start && customDateRange.value.end) {
    router.push({
      query: {
        ...route.query,
        range: 'custom',
        start: new Date(customDateRange.value.start).toISOString(),
        end: new Date(customDateRange.value.end).toISOString(),
        page: 1
      }
    })
    isDateRangeDialogOpen.value = false
  }
}

</script>

<template>
  <q-select
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
        <q-input v-model="customDateRange.start" label="Start Date" type="date"/>
        <q-input v-model="customDateRange.end" label="End Date" type="date"/>
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
