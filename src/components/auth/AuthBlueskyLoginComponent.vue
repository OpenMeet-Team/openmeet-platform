<template>
  <q-btn
    class="full-width q-mb-md"
    color="primary"
    icon="img:https://bsky.app/static/favicon-32x32.png"
    label="Continue with Bluesky"
    :loading="loading"
    @click="handleLogin"
  />
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import { useAuthStore } from 'stores/auth-store'
import { useQuasar } from 'quasar'

export default defineComponent({
  name: 'AuthBlueskyLoginComponent',
  setup () {
    const loading = ref(false)
    const authStore = useAuthStore()
    const $q = useQuasar()

    const handleLogin = async () => {
      try {
        loading.value = true
        // Open a dialog to get the Bluesky handle
        $q.dialog({
          title: 'Enter your Bluesky handle',
          message: 'Please enter your Bluesky handle (e.g., alice.bsky.social)',
          prompt: {
            model: '',
            type: 'text'
          },
          cancel: true,
          persistent: true
        }).onOk(async (handle) => {
          await authStore.loginWithBluesky(handle)
        }).onCancel(() => {
          loading.value = false
        })
      } catch (error) {
        console.error('Bluesky login error:', error)
        $q.notify({
          type: 'negative',
          message: 'Failed to login with Bluesky'
        })
        loading.value = false
      }
    }

    return {
      loading,
      handleLogin
    }
  }
})
</script>
