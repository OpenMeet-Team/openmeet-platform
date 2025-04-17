<template>
  <q-page padding>
    <div class="container q-pa-md">
      <div class="q-mb-md">
        <router-link to="/admin" class="q-pr-sm">
          <q-icon name="sym_r_arrow_back" />
          Back to Admin Dashboard
        </router-link>
      </div>

      <h1 class="text-h4 text-primary q-mb-md">Bluesky Session Reset Tool</h1>

      <div class="q-mb-lg bg-blue-1 q-pa-md rounded-borders">
        <p class="text-subtitle1 q-mb-none">
          <q-icon name="sym_r_info" color="info" class="q-mr-sm" />
          This tool resets a Bluesky user's session when they're experiencing authentication issues.
          The user will need to reconnect their Bluesky account after the reset.
        </p>
      </div>

      <q-card class="q-mb-lg">
        <q-card-section>
          <div class="text-h6">Reset Bluesky Session</div>
        </q-card-section>

        <q-card-section>
          <q-form @submit="resetSession" class="q-gutter-md">
            <q-input
              v-model="did"
              label="Bluesky DID"
              placeholder="did:plc:user123"
              outlined
              :error="!!didError"
              :error-message="didError"
            >
              <template v-slot:prepend>
                <q-icon name="sym_r_verified_user" />
              </template>
            </q-input>

            <div>
              <q-btn
                type="submit"
                color="primary"
                label="Reset Session"
                :loading="loading"
                :disable="loading || !did"
              />
            </div>
          </q-form>
        </q-card-section>
      </q-card>

      <q-dialog v-model="resultDialog">
        <q-card style="min-width: 350px">
          <q-card-section :class="resultSuccess ? 'bg-positive text-white' : 'bg-negative text-white'">
            <div class="text-h6">{{ resultSuccess ? 'Success' : 'Error' }}</div>
          </q-card-section>

          <q-card-section class="q-pt-md">
            {{ resultMessage }}
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat label="Close" color="primary" v-close-popup />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth-store'
import { UserRole } from '../../types'
import { blueskyApi } from '../../api/bluesky'

const router = useRouter()
const authStore = useAuthStore()

const did = ref('')
const didError = ref('')
const loading = ref(false)
const resultDialog = ref(false)
const resultSuccess = ref(false)
const resultMessage = ref('')

// Check if user is an admin
onMounted(() => {
  if (!authStore.hasRole(UserRole.Admin)) {
    // Redirect non-admin users to home page
    router.push('/')
  }
})

async function resetSession () {
  // Validate input
  didError.value = ''
  if (!did.value) {
    didError.value = 'Please enter a valid Bluesky DID'
    return
  }

  try {
    loading.value = true

    // Call the API to reset the session using the blueskyApi service
    const response = await blueskyApi.adminResetSession(did.value)

    if (response.status >= 200 && response.status < 300) {
      resultSuccess.value = true
      resultMessage.value = response.data?.message || 'Session reset successfully. User will need to reconnect their account.'
    } else {
      resultSuccess.value = false
      resultMessage.value = response.data?.message || 'Failed to reset session'
    }

    resultDialog.value = true
  } catch (error) {
    console.error('Error resetting session:', error)
    resultSuccess.value = false
    resultMessage.value = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    resultDialog.value = true
  } finally {
    loading.value = false
  }
}

defineOptions({
  name: 'BlueskyResetPage'
})
</script>

<style scoped lang="scss">
.container {
  max-width: 800px;
  margin: 0 auto;
}

a {
  text-decoration: none;
  color: $primary;
  display: inline-flex;
  align-items: center;
}
</style>
