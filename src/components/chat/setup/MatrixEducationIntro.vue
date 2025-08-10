<template>
  <div class="matrix-education-intro">
    <q-page class="flex flex-center q-pa-md">
      <div class="intro-content" style="max-width: 500px; width: 100%;">

        <!-- Header -->
        <div class="text-center q-mb-xl">
          <q-icon name="fas fa-comments" size="64px" color="primary" class="q-mb-md" />
          <div class="text-h4 text-weight-medium q-mb-sm">Welcome to Secure Chat</div>
          <div class="text-subtitle1 text-grey-7">
            Connect securely with your community
          </div>
        </div>

        <!-- Benefits List -->
        <div class="benefits-list q-mb-xl">
          <div class="benefit-item row items-center q-mb-md">
            <q-icon name="fas fa-lock" color="green" size="24px" class="q-mr-md" />
            <div class="col">
              <div class="text-subtitle2">Encrypted Direct Messages</div>
              <div class="text-caption text-grey-6">Private conversations stay private</div>
            </div>
          </div>

          <div class="benefit-item row items-center q-mb-md">
            <q-icon name="fas fa-mobile-alt" color="blue" size="24px" class="q-mr-md" />
            <div class="col">
              <div class="text-subtitle2">Works Across All Devices</div>
              <div class="text-caption text-grey-6">Continue conversations anywhere</div>
            </div>
          </div>

          <div class="benefit-item row items-center q-mb-md">
            <q-icon name="fas fa-history" color="purple" size="24px" class="q-mr-md" />
            <div class="col">
              <div class="text-subtitle2">Message History Backup</div>
              <div class="text-caption text-grey-6">Never lose your conversations</div>
            </div>
          </div>
        </div>

        <!-- Options -->
        <div class="options-section">
          <q-btn
            unelevated
            color="primary"
            size="lg"
            class="full-width q-mb-md"
            @click="handleSetupEncryption"
            :loading="loading"
          >
            <q-icon name="fas fa-lock" class="q-mr-sm" />
            Set Up Secure Chat
          </q-btn>

          <q-btn
            flat
            color="grey-7"
            size="md"
            class="full-width"
            @click="handleUseBasicChat"
            :disable="loading"
          >
            Use Basic Chat Only
          </q-btn>

          <div class="text-center q-mt-md">
            <div class="text-caption text-grey-6">
              Basic chat: Public rooms only<br>
              Secure chat: Includes private messages
            </div>
          </div>
        </div>

        <!-- Info Footer -->
        <div class="info-footer q-mt-xl">
          <q-expansion-item
            icon="fas fa-info-circle"
            label="How does this work?"
            class="text-grey-7"
            header-style="padding: 8px 0;"
          >
            <div class="text-body2 text-grey-7 q-pa-sm">
              We use Matrix, an open-source messaging protocol, to provide secure
              communication. Your messages are encrypted end-to-end, meaning only
              you and your conversation partners can read them.
            </div>
          </q-expansion-item>
        </div>
      </div>
    </q-page>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  continue: []
  skip: []
}>()

const loading = ref(false)

const handleSetupEncryption = async () => {
  loading.value = true
  try {
    // Brief delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 500))
    emit('continue')
  } finally {
    loading.value = false
  }
}

const handleUseBasicChat = () => {
  // User chose to skip encryption setup and use basic chat
  emit('skip')
}
</script>

<style scoped>
.matrix-education-intro {
  height: 100%;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0.5rem;
}

.q-dark .matrix-education-intro {
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
}

.intro-content {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.q-dark .intro-content {
  background: #1e1e1e;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.benefit-item {
  padding: 12px 0;
  border-radius: 8px;
  transition: background-color 0.2s ease;
}

.benefit-item:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

.q-dark .benefit-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.options-section .q-btn {
  border-radius: 12px;
  font-weight: 500;
}

.info-footer {
  border-top: 1px solid #e0e0e0;
  padding-top: 16px;
}

.q-dark .info-footer {
  border-top-color: #3a3a3a;
}

@media (max-width: 599px) {
  .intro-content {
    padding: 24px 20px;
    margin: 16px;
  }

  .matrix-education-intro {
    height: 100%;
    padding: 0.25rem;
  }

  .intro-content {
    padding: 16px 12px !important;
    margin: 8px !important;
  }
}
</style>
