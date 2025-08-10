<template>
  <div class="matrix-setup-explainer">
    <div class="explainer-wrapper q-pa-md">
      <div class="explainer-content" style="max-width: 500px; width: 100%; margin: 0 auto;">

        <!-- Header -->
        <div class="text-center q-mb-md">
          <q-icon name="fas fa-cog" size="48px" color="primary" class="q-mb-xs" />
          <div class="text-h6 text-weight-medium">Setting Up Secure Chat</div>
          <div class="text-body2 text-grey-7">
            We need to configure a few things first
          </div>
        </div>

        <!-- Steps Preview -->
        <div class="steps-preview q-mb-md">
          <div class="step-item row items-center q-mb-sm">
            <div class="step-number">
              <q-avatar size="24px" color="primary" text-color="white" class="q-mr-sm">
                1
              </q-avatar>
            </div>
            <div class="col">
              <div class="text-body1 text-weight-medium">Choose Encryption Key</div>
              <div class="text-caption text-grey-6">Create a passphrase to secure your messages</div>
            </div>
          </div>

          <div class="step-item row items-center q-mb-sm">
            <div class="step-number">
              <q-avatar size="24px" color="primary" text-color="white" class="q-mr-sm">
                2
              </q-avatar>
            </div>
            <div class="col">
              <div class="text-body1 text-weight-medium">Connect to Matrix</div>
              <div class="text-caption text-grey-6">Authorize {{ appName }} to use secure messaging</div>
            </div>
          </div>

          <div class="step-item row items-center q-mb-xs">
            <div class="step-number">
              <q-avatar size="24px" color="primary" text-color="white" class="q-mr-sm">
                3
              </q-avatar>
            </div>
            <div class="col">
              <div class="text-body1 text-weight-medium">Finalize Setup</div>
              <div class="text-caption text-grey-6">Complete encryption configuration automatically</div>
            </div>
          </div>
        </div>

        <!-- Important Info -->
        <q-card flat bordered class="info-card q-mb-sm">
          <q-card-section class="q-pa-sm">
            <div class="row items-start">
              <q-icon name="fas fa-info-circle" color="blue" size="16px" class="q-mr-xs q-mt-xs" />
              <div class="col">
                <div class="text-body2 text-weight-medium q-mb-xs">About consent screens</div>
                <div class="text-caption text-grey-7">
                  You'll see permission screens asking to authorize {{ appName }}.
                  These may appear periodically for security - this is normal.
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>

        <!-- Action Buttons -->
        <div class="action-buttons">
          <q-btn
            unelevated
            color="primary"
            size="lg"
            class="full-width q-mb-md"
            @click="handleContinue"
            :loading="loading"
          >
            Let's Get Started
            <q-icon name="fas fa-arrow-right" class="q-ml-sm" />
          </q-btn>

          <q-btn
            flat
            color="grey-7"
            size="md"
            class="full-width"
            @click="handleBack"
            :disable="loading"
          >
            <q-icon name="fas fa-arrow-left" class="q-mr-sm" />
            Back
          </q-btn>
        </div>

        <!-- Time Estimate -->
        <div class="time-estimate text-center q-mt-lg">
          <div class="text-caption text-grey-6">
            <q-icon name="fas fa-clock" class="q-mr-xs" />
            This should take about 2 minutes
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import getEnv from '../../../utils/env'

interface Props {
  homeserverUrl?: string
}

withDefaults(defineProps<Props>(), {
  homeserverUrl: (getEnv('APP_MATRIX_HOMESERVER_URL') as string) || 'https://matrix.openmeet.net'
})

const emit = defineEmits<{
  continue: []
  back: []
}>()

const loading = ref(false)

const appName = computed(() => {
  return getEnv('APP_TENANT_NAME') || 'OpenMeet'
})

// homeserverUrl computed property removed as it's unused

const handleContinue = async () => {
  loading.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 500))
    emit('continue')
  } finally {
    loading.value = false
  }
}

const handleBack = () => {
  emit('back')
}
</script>

<style scoped>
.matrix-setup-explainer {
  height: 100%;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0.5rem;
}

.q-dark .matrix-setup-explainer {
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
}

.explainer-wrapper {
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
  flex: 0 0 auto;
}

.explainer-content {
  background: white;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.q-dark .explainer-content {
  background: #1e1e1e;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.step-item {
  padding: 8px 0;
  transition: transform 0.2s ease;
}

.step-item:hover {
  transform: translateX(4px);
}

.info-card {
  background: #f8f9ff;
  border: 1px solid #e3e8ff;
}

.q-dark .info-card {
  background: #1a1a2e;
  border-color: #2a2a4e;
}

.action-buttons .q-btn {
  border-radius: 12px;
  font-weight: 500;
}

.time-estimate {
  opacity: 0.8;
}

@media (max-width: 599px) {
  .matrix-setup-explainer {
    padding: 0.25rem;
  }

  .explainer-content {
    padding: 16px 12px;
    margin: 8px auto;
  }

  .explainer-wrapper {
    padding: 0.5rem;
  }

  .step-item {
    margin-bottom: 8px !important;
    padding: 4px 0;
  }
}
</style>
