<template>
  <q-layout>
    <q-page-container>
      <q-page class="flex flex-center">
        <div class="text-center">
          <h1 class="text-negative">Authentication Error</h1>
          <p>{{ errorMessage }}</p>
          <q-btn
            color="primary"
            :to="{ name: 'HomePage' }"
            label="Return to Home"
          />
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

export default defineComponent({
  name: 'ErrorPage',
  setup () {
    const route = useRoute()
    const errorMessage = ref('')

    onMounted(() => {
      errorMessage.value = route.query.message as string || 'An unknown error occurred'
    })

    return {
      errorMessage
    }
  }
})
</script>
