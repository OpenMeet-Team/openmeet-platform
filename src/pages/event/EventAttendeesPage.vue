<template>
  <q-page data-cy="event-attendees-page" padding class="c-event-attendees-page q-mx-auto q-pb-xl"
    style="max-width: 600px;">
    <SpinnerComponent v-if="isLoading" />
    <NoContentComponent data-cy="event-not-found" v-else-if="!isLoading && !event" icon="sym_r_event"
      label="Event not found" />
    <div v-else-if="attendees && event">
      <q-btn flat no-caps color="primary" icon="sym_r_arrow_back" label="Back"
        :to="{ name: 'EventPage', params: { slug: route.params.slug } }" class="q-mb-md" />
      <div class="q-pa-md">
        <div class="row items-center justify-between q-mb-md">
          <div class="text-h5">
            Event Attendees ({{ filteredAttendees.length }})
          </div>

          <!-- Admin Actions -->
          <div v-if="canMessageAttendees">
            <q-btn
              @click="openMessageAllAttendeesDialog"
              color="primary"
              icon="sym_r_send"
              label="Send Message to All"
              no-caps
              data-cy="send-message-all-attendees"
            />
          </div>
        </div>

        <!-- Attendees add search and filter by status -->
        <div class="row justify-between q-mb-md">
          <q-input v-model="search" placeholder="Search attendees">
            <template v-slot:append>
              <q-icon name="sym_r_search" />
            </template>
          </q-input>
          <q-select style="width: 200px;" clearable v-model="status" :options="statusOptions" label="Filter by status">
            <template v-slot:append>
              <q-icon name="sym_r_filter_list" />
            </template>
          </q-select>
        </div>

        <!-- Attendees list -->
        <!-- Loading skeleton -->
        <q-list bordered separator v-if="isLoading">
          <q-item v-for="n in 5" :key="n" class="q-py-md">
            <q-item-section avatar>
              <q-skeleton type="QAvatar" size="48px" />
            </q-item-section>
            <q-item-section>
              <q-skeleton type="text" width="60%" />
              <q-skeleton type="text" width="40%" class="text-caption" />
            </q-item-section>
            <q-item-section side>
              <q-skeleton type="QBadge" />
            </q-item-section>
          </q-item>
        </q-list>

        <!-- Actual attendees list -->
        <q-list bordered separator v-else-if="filteredAttendees.length">
          <q-item v-for="attendee in filteredAttendees" :key="attendee.id"
            class="q-py-md">
            <q-item-section avatar @click="viewProfile(attendee)" class="cursor-pointer">
              <q-avatar size="48px">
                <q-img
                  :src="getImageSrc(attendee.user.photo?.path)"
                  :alt="attendee.user.name"
                  style="width: 48px; height: 48px"
                  spinner-color="primary"
                />
              </q-avatar>
            </q-item-section>

            <q-item-section @click="viewProfile(attendee)" class="cursor-pointer">
              <q-item-label>{{ attendee.user.name }}</q-item-label>
              <q-item-label caption>
                {{ attendee.role.name.charAt(0).toUpperCase() + attendee.role.name.slice(1) }}
              </q-item-label>
            </q-item-section>

            <q-item-section side>
              <q-badge :color="getStatusColor(attendee.status)" :label="attendee.status" />
            </q-item-section>

            <q-item-section side v-if="canManageAttendees">
              <q-btn :disable="!canManageAttendees" round flat no-caps color="primary" icon="sym_r_more_vert">
                <q-menu>
                  <MenuItemComponent v-if="canManageAttendees" @click="editAttendee(attendee)" label="Edit attendance"
                    icon="sym_r_edit" />
                  <!-- Send message -->
                  <MenuItemComponent v-if="canManageAttendees" @click="sendMessage(attendee)" label="Send message"
                    icon="sym_r_message" />

                  <!-- View attendee request -->
                  <MenuItemComponent v-if="false" @click="viewAttendeeRequest(attendee)" label="View attendee request"
                    icon="sym_r_visibility" />
                  <!-- Delete attendee -->
                  <MenuItemComponent icon-color="negative" v-if="canManageAttendees" @click="deleteAttendee(attendee)"
                    label="Remove attendee" icon="sym_r_delete" />
                </q-menu>
              </q-btn>
            </q-item-section>
          </q-item>
        </q-list>
        <NoContentComponent v-else icon="sym_r_person" label="No attendees found" />

        <q-infinite-scroll @load="loadMore" v-if="isMounted" :disable="isLoading || noMoreData">
          <template v-slot:loading>
            <div class="row justify-center q-my-md">
              <q-spinner color="primary" size="40px" />
            </div>
          </template>
        </q-infinite-scroll>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { LoadingBar, QSelectOption } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { useEventStore } from '../../stores/event-store'
import { eventsApi } from '../../api'
import { EventAttendeeEntity, EventAttendeePermission, EventAttendeeStatus } from '../../types'
import { getImageSrc } from '../../utils/imageUtils'
import SpinnerComponent from '../../components/common/SpinnerComponent.vue'
import NoContentComponent from '../../components/global/NoContentComponent.vue'
import MenuItemComponent from '../../components/common/MenuItemComponent.vue'
import { useEventAttendeeDialog } from '../../composables/useEventAttendeeDialog'
import { useEventAdminMessageDialog } from '../../composables/useEventAdminMessageDialog'

const route = useRoute()
const router = useRouter()
const attendees = ref<EventAttendeeEntity[]>([])
const isLoading = ref(false)
const attendeesError = ref(false)
const noMoreData = ref(false)
const isMounted = ref(false)
const page = ref(1)
const PER_PAGE = 20
const search = ref<string>('')
const status = ref<QSelectOption | null>(null)
const event = computed(() => useEventStore().event)
const canManageAttendees = computed(() => useEventStore().getterUserHasPermission(EventAttendeePermission.ManageAttendees))
const canMessageAttendees = computed(() => useEventStore().getterUserHasPermission(EventAttendeePermission.MessageAttendees))
const { openEditAttendeeDialog, openDeleteAttendeeDialog, openViewAttendeeRequestDialog } = useEventAttendeeDialog()
const { openEventAdminMessageDialog } = useEventAdminMessageDialog()

const statusOptions = computed(() => {
  return Object.values(EventAttendeeStatus).map((status) => ({
    label: status.charAt(0).toUpperCase() + status.slice(1),
    value: status
  }))
})

const filteredAttendees = computed(() => {
  return attendees.value.filter((attendee) => {
    // if search or filter otherwise return all
    if (search.value || status.value) {
      const searchMatch = attendee.user.name?.toLowerCase().includes(search.value.toLowerCase())
      const statusMatch = attendee.status === status.value?.value
      return searchMatch && statusMatch
    }
    return true
  })
})

onBeforeUnmount(() => {
  useEventStore().$reset()
})

const getStatusColor = (status: string): string => {
  const colors = {
    [EventAttendeeStatus.Confirmed]: 'positive',
    [EventAttendeeStatus.Waitlist]: 'warning',
    [EventAttendeeStatus.Rejected]: 'negative',
    [EventAttendeeStatus.Pending]: 'grey',
    [EventAttendeeStatus.Cancelled]: 'grey'
  }
  return colors[status as keyof typeof colors] || 'grey'
}

const loadAttendees = async () => {
  try {
    if (isLoading.value) return

    if (noMoreData.value) return
    if (attendeesError.value) return

    isLoading.value = true
    const res = await eventsApi.getAttendees(route.params.slug as string, {
      page: page.value,
      limit: PER_PAGE
    })

    if (page.value === 1 && res.data.data.length === 0) {
      attendees.value = []
      noMoreData.value = true
      return
    }

    // Check for no more data
    if (res.data.data.length < PER_PAGE) {
      noMoreData.value = true
    }

    // Deduplicate attendees by ID
    const uniqueAttendees = [...attendees.value]
    res.data.data.forEach((newAttendee) => {
      if (!uniqueAttendees.some(existing => existing.id === newAttendee.id)) {
        uniqueAttendees.push(newAttendee)
      }
    })

    attendees.value = uniqueAttendees
    page.value++
  } catch (error) {
    attendeesError.value = true
    console.error('Failed to load attendees:', error)
  } finally {
    isLoading.value = false
  }
}

const loadMore = async (index: number, done: () => void) => {
  await loadAttendees()
  done()
}

const editAttendee = (attendee: EventAttendeeEntity) => {
  openEditAttendeeDialog(attendee).onOk((attendee: EventAttendeeEntity) => {
    attendees.value = attendees.value.map(a => a.id === attendee.id ? attendee : a)
  })
}

const deleteAttendee = (attendee: EventAttendeeEntity) => {
  openDeleteAttendeeDialog().onOk(() => {
    eventsApi.deleteAttendee(route.params.slug as string, attendee.id).then(() => {
      attendees.value = attendees.value.filter(a => a.id !== attendee.id)
    })
  })
}

const sendMessage = (attendee: EventAttendeeEntity) => {
  router.push({ name: 'DashboardChatsPage', query: { user: attendee.user.slug } })
}

const viewProfile = (attendee: EventAttendeeEntity) => {
  window.open(`/members/${attendee.user.slug}`, '_blank')
}

const viewAttendeeRequest = (attendee: EventAttendeeEntity) => {
  openViewAttendeeRequestDialog(attendee)
}

const openMessageAllAttendeesDialog = () => {
  if (!event.value) return

  openEventAdminMessageDialog(event.value).onOk((result) => {
    console.log('Message sent:', result)
  })
}

onMounted(() => {
  LoadingBar.start()
  isLoading.value = true
  useEventStore().actionGetEventBySlug(route.params.slug as string).then(() => {
    if (useEventStore().getterIsPublicEvent || useEventStore().getterIsAuthenticatedEvent || useEventStore().getterUserIsAttendee()) {
      loadAttendees().finally(() => {
        LoadingBar.stop()
        isMounted.value = true
      })
    }
  }).finally(() => {
    LoadingBar.stop()
    isLoading.value = false
  })
})
</script>

<style scoped>
.q-item {
  transition: background-color 0.3s;
}

.q-item:hover {
  background-color: rgba(0, 0, 0, 0.03);
}
</style>
