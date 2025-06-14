<template>
  <div class="c-event-attendees-component">
    <SubtitleComponent label="Attendees" class="q-mt-lg q-px-md" :count="event?.attendeesCount" @click="onAttendeesClick" />
    <q-card flat bordered v-if="hasPermissions">
      <q-card-section v-if="event?.attendees?.length">
        <div class="row q-gutter-md">
          <q-item v-for="attendee in event.attendees" :key="attendee.id" clickable class="q-px-sm"
            @click="router.push({ name: 'MemberPage', params: { slug: attendee.user?.slug } })">
            <q-avatar avatar rounded size="48px">
              <q-img
                :src="getImageSrc(attendee.user?.photo)"
                :ratio="1"
                :alt="attendee.user?.name"
                style="width: 48px; height: 48px"
                spinner-color="primary"
              />
              <q-badge floating color="teal" v-if="attendee.role && attendee.role.name !== EventAttendeeRole.Participant">{{ attendee.role.name }}</q-badge>
            </q-avatar>
          </q-item>
        </div>
      </q-card-section>
      <q-card-section v-else>
        <NoContentComponent icon="sym_r_group" label="No attendees yet" />
      </q-card-section>
    </q-card>
    <q-card flat bordered v-else>
      <q-card-section>
        <NoContentComponent icon="sym_r_group" v-if="useEventStore().getterIsAuthenticatedEvent && !useAuthStore().isAuthenticated" label="You don't have permission to view this" />
        <NoContentComponent icon="sym_r_group" v-if="useEventStore().getterIsPrivateEvent && !useEventStore().getterUserHasPermission(EventAttendeePermission.ViewEvent)" label="You don't have permission to view attendees" />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { useAuth } from '../../composables/useAuth'
import { useAuthStore } from '../../stores/auth-store'
import { useEventStore } from '../../stores/event-store'
import { getImageSrc } from '../../utils/imageUtils'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SubtitleComponent from '../common/SubtitleComponent.vue'
import { EventAttendeePermission, EventAttendeeRole } from '../../types'
import { useEventDialog } from '../../composables/useEventDialog'

const event = computed(() => useEventStore().event)
const { goToLogin } = useAuth()
const { openNoAttendeesRightsDialog } = useEventDialog()
const route = useRoute()
const router = useRouter()

const onAttendeesClick = () => {
  if (!useAuthStore().isAuthenticated) {
    goToLogin()
  } else if (!useEventStore().getterUserHasPermission(EventAttendeePermission.ViewEvent)) {
    openNoAttendeesRightsDialog()
  } else {
    router.push({ name: 'EventAttendeesPage', params: { slug: route.params.slug } })
  }
}

const hasPermissions = computed(() => {
  return (useEventStore().getterIsPublicEvent || (useEventStore().getterIsAuthenticatedEvent && useAuthStore().isAuthenticated) || (useEventStore().getterUserIsAttendee() && useEventStore().getterUserHasPermission(EventAttendeePermission.ViewEvent)))
})
</script>
