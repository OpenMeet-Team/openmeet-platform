<template>
    <SubtitleComponent label="Attendees" class="q-mt-lg q-px-md c-event-attendees-component"
        @click="onAttendeesClick" />
    <q-card flat bordered class="c-event-attendees-component">
        <q-card-section v-if="event?.attendees?.length">
            <div class="row q-gutter-md">
                <q-item v-for="attendee in event.attendees" :key="attendee.id" clickable class="q-px-sm"
                    @click="router.push({ name: 'MemberPage', params: { ulid: attendee.user?.ulid } })">
                    <q-avatar avatar rounded>
                        <q-img :src="getImageSrc(attendee.user?.photo)" :ratio="1" :alt="attendee.user?.name" />
                        <q-badge floating color="teal" v-if="attendee.role">{{ attendee.role.name }}</q-badge>
                    </q-avatar>
                </q-item>
            </div>
        </q-card-section>
        <q-card-section v-else>
            <NoContentComponent icon="sym_r_group" label="No attendees yet" />
        </q-card-section>
    </q-card>
</template>

<script setup lang="ts">
import { useAuthDialog } from 'src/composables/useAuthDialog'
import { useAuthStore } from 'src/stores/auth-store'
import { useEventStore } from 'src/stores/event-store'
import { getImageSrc } from 'src/utils/imageUtils'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SubtitleComponent from '../common/SubtitleComponent.vue'

const event = computed(() => useEventStore().event)
const { openLoginDialog } = useAuthDialog()
const route = useRoute()
const router = useRouter()

const onAttendeesClick = () => {
  if (!useAuthStore().isAuthenticated) {
    openLoginDialog()
  } else {
    router.push({ name: 'EventAttendeesPage', params: { id: route.params.id } })
  }
}
</script>
