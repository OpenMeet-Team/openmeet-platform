<template>
  <q-page class="flex flex-center">
    <div v-if="loading" data-testid="loading" class="text-center">
      <q-spinner size="xl" color="primary" />
      <div class="q-mt-md text-body1">Resolving...</div>
    </div>
    <div v-else-if="errorMessage" data-testid="error" class="text-center">
      <div class="text-h5 q-mb-md">{{ errorMessage }}</div>
      <q-btn
        label="Go Home"
        color="primary"
        to="/"
        flat
      />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { atprotoApi } from '../api/atproto'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  const { did, collection, rkey } = route.params as {
    did: string
    collection: string
    rkey: string
  }

  try {
    const response = await atprotoApi.resolveAtUri(did, collection, rkey)
    const { type, slug } = response.data

    if (type === 'event') {
      router.replace({ name: 'EventPage', params: { slug } })
    } else {
      errorMessage.value = 'Resource not found'
      loading.value = false
    }
  } catch {
    errorMessage.value = 'Event not found'
    loading.value = false
  }
})
</script>
