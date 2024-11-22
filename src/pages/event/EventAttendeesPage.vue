<template>
  <q-page style="max-width: 600px;" class="q-mx-auto">
    <SpinnerComponent v-if="isLoading" />

    <h1 v-else>Attendees</h1>
  </q-page>
</template>

<script setup lang="ts">
import { LoadingBar } from 'quasar'
import { useEventStore } from 'src/stores/event-store'
import { onBeforeMount, onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isLoading = ref(false)

onBeforeMount(async () => {
  LoadingBar.start()
  isLoading.value = true
  useEventStore().actionGetEventAttendees(route.params.slug as string).finally(() => {
    isLoading.value = false
    LoadingBar.stop()
  })
})
onBeforeUnmount(() => {
  useEventStore().$reset()
})
</script>
