<template>
  <q-page class="matrix-test-page">
    <div class="row justify-center">
      <div class="col-12">
        <div class="text-h4 q-mb-md text-center">
          Unified Chat Component Test
        </div>

        <div class="text-body1 q-mb-lg text-center text-grey-7">
          This page demonstrates the unified chat architecture with mobile-first responsive design.
          Test the Matrix integration, chat functionality, and responsive layout.
        </div>

        <!-- Unified Chat Demo -->
        <div class="chat-demo-container">
          <UnifiedChatComponent
            context-type="all"
            mode="dashboard"
            :show-info-sidebar="false"
          />
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import UnifiedChatComponent from '../../components/chat/UnifiedChatComponent.vue'
</script>

<style scoped>
.matrix-test-page {
  padding: 1rem;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.chat-demo-container {
  flex: 1;
  min-height: 600px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

@media (max-width: 599px) {
  .matrix-test-page {
    padding: 0.5rem;
  }

  .chat-demo-container {
    min-height: calc(100vh - 120px);
  }
}
</style>
