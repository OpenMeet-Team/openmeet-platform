<template>
  <div class="chat-passphrase-unlock">
    <q-page class="flex flex-center q-pa-md">
      <div class="unlock-content" style="max-width: 500px; width: 100%;">
        <!-- Header -->
        <div class="text-center q-mb-xl">
          <q-icon
            name="fas fa-key"
            size="64px"
            color="primary"
            class="q-mb-md"
          />
          <div class="text-h4 text-weight-medium q-mb-sm">Enter Your Passphrase</div>
          <div class="text-subtitle1 text-grey-7">
            Your chat encryption is already set up. Enter your passphrase to unlock your encrypted messages.
          </div>
        </div>

        <!-- Passphrase Form -->
        <q-form @submit="handleUnlock" class="q-gutter-md">
          <q-input
            v-model="passphrase"
            type="password"
            label="Encryption Passphrase"
            placeholder="Enter your existing passphrase"
            filled
            class="q-mb-md"
            :rules="[val => !!val || 'Passphrase is required']"
            autofocus
          >
            <template v-slot:prepend>
              <q-icon name="fas fa-lock" />
            </template>
          </q-input>

          <!-- Error Message -->
          <q-banner v-if="errorMessage" class="bg-negative text-white q-mb-md">
            <template v-slot:avatar>
              <q-icon name="fas fa-exclamation-triangle" />
            </template>
            {{ errorMessage }}
          </q-banner>

          <!-- Action Buttons -->
          <div class="row q-gutter-sm">
            <q-btn
              unelevated
              color="primary"
              size="lg"
              class="col"
              type="submit"
              :loading="loading"
            >
              <q-icon name="fas fa-unlock-alt" class="q-mr-sm" />
              Unlock Encryption
            </q-btn>
          </div>

          <div class="row q-gutter-sm q-mt-md">
            <q-btn
              flat
              color="grey-7"
              size="md"
              class="col"
              @click="handleForgotPassphrase"
              :disable="loading"
            >
              Forgot Passphrase?
            </q-btn>

            <q-btn
              flat
              color="grey-7"
              size="md"
              class="col"
              @click="handleBack"
              :disable="loading"
            >
              Back
            </q-btn>
          </div>
        </q-form>
      </div>
    </q-page>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { logger } from '../../../utils/logger'

const emit = defineEmits<{
  continue: [passphrase: string]
  back: []
  reset: [] // For forgot passphrase flow
}>()

// State
const passphrase = ref('')
const loading = ref(false)
const errorMessage = ref('')

const handleUnlock = async () => {
  if (!passphrase.value.trim()) {
    errorMessage.value = 'Please enter your passphrase'
    return
  }

  try {
    loading.value = true
    errorMessage.value = ''

    logger.debug('🔓 User attempting to unlock with existing passphrase')

    // Emit the passphrase for validation
    emit('continue', passphrase.value)
  } catch (error) {
    logger.error('Failed to unlock encryption:', error)
    errorMessage.value = 'Failed to unlock encryption. Please try again.'
  } finally {
    loading.value = false
  }
}

const handleBack = () => {
  emit('back')
}

const handleForgotPassphrase = () => {
  if (confirm('This will reset your encryption and you will lose access to previously encrypted messages. Continue?')) {
    emit('reset')
  }
}
</script>

<style lang="scss" scoped>
.chat-passphrase-unlock {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.unlock-content {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}
</style>
