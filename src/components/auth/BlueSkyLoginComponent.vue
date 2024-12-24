<!-- platform/src/components/auth/BlueskyLoginComponent.vue -->
<template>
  <div class="c-bluesky-login-component row justify-center">
    <q-btn
      :loading="isLoading"
      :disable="isLoading"
      no-caps
      @click="handleBlueskyLogin"
    >
      <template v-slot:default>
        <div class="row items-center no-wrap">
          <q-icon name="img:/bluesky-logo.svg" size="18px" class="q-mr-sm" />
          <span>{{ buttonText }}</span>
        </div>
      </template>

      <template v-slot:loading>
        <q-spinner-dots color="white" size="24px" />
      </template>
    </q-btn>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth-store'

const props = withDefaults(defineProps<{
  text?: 'join_with' | 'signin_with' | 'signup_with' | 'continue_with'
}>(), {
  text: 'join_with'
})

const isLoading = ref(false)
const $q = useQuasar()
const authStore = useAuthStore()

const buttonText = computed(() => {
  const textMap = {
    join_with: 'Join with Bluesky',
    signin_with: 'Sign in with Bluesky',
    signup_with: 'Sign up with Bluesky',
    continue_with: 'Continue with Bluesky'
  }
  return textMap[props.text]
})

const handleBlueskyLogin = async () => {
  try {
    isLoading.value = true
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
      isLoading.value = false
    })
  } catch (error) {
    console.error('Bluesky auth error:', error)
    $q.notify({
      type: 'negative',
      message: 'Bluesky authentication failed'
    })
    isLoading.value = false
  }
}
</script>

<style scoped>

</style>
