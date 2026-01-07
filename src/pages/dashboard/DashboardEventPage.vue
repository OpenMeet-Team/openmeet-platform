<template>
  <q-page data-cy="dashboard-event-page" padding class="c-dashboard-event-page q-pb-xl q-mx-auto" style="max-width: 1200px;">
    <div class="q-mx-auto">
      <DashboardTitle :default-back="true" label="Edit Event">
        <q-btn
          v-if="isDraft"
          flat
          no-caps
          color="negative"
          icon="sym_r_delete"
          label="Delete Draft"
          @click="onDeleteDraft"
          data-cy="delete-draft-btn"
        />
      </DashboardTitle>

      <EventFormBasicComponent class="q-mt-md"
        ref="eventFormRef"
        @updated="navigateToEvent($event)"
        @created="navigateToEvent($event)"
        :edit-event-slug="route.params.slug as string"
        @close="goBack" />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useNavigation } from '../../composables/useNavigation'
import EventFormBasicComponent from '../../components/event/EventFormBasicComponent.vue'
import DashboardTitle from '../../components/dashboard/DashboardTitle.vue'
import { ref, computed, onMounted } from 'vue'
import { eventsApi } from '../../api/events'
import { useQuasar } from 'quasar'
import { useNotification } from '../../composables/useNotification'
import { useHomeStore } from '../../stores/home-store'
import { EventEntity, EventStatus } from '../../types'

const { navigateToEvent } = useNavigation()
const router = useRouter()
const route = useRoute()
const $q = useQuasar()
const { success } = useNotification()

const eventFormRef = ref<InstanceType<typeof EventFormBasicComponent> | null>(null)
const eventData = ref<EventEntity | null>(null)

const isDraft = computed(() => {
  return eventData.value?.status === EventStatus.Draft
})

onMounted(async () => {
  // Load event data to check if it's a draft
  const slug = route.params.slug as string
  if (slug) {
    try {
      const res = await eventsApi.edit(slug)
      eventData.value = res.data
    } catch (err) {
      console.error('Failed to load event:', err)
    }
  }
})

const goBack = () => {
  // Use browser history to go back
  if (window.history.length > 1) {
    router.back()
  } else {
    // Fallback if no history
    router.push({ name: 'DashboardEventsPage' })
  }
}

const onDeleteDraft = () => {
  if (!eventData.value) return

  $q.dialog({
    title: 'Delete Draft',
    message: `Are you sure you want to delete the draft '${eventData.value.name}'? This action cannot be undone.`,
    cancel: true,
    persistent: true
  }).onOk(async () => {
    try {
      await eventsApi.delete(eventData.value!.slug)
      success('Draft deleted!')
      // Refresh home state in case user came from home page
      useHomeStore().actionGetUserHomeState()
      // Navigate back
      goBack()
    } catch (err) {
      console.error('Failed to delete draft:', err)
    }
  })
}
</script>
