<template>
  <q-page class="chats-page">
    <DashboardTitle
      title="Chats"
      subtitle="Stay connected with your communities"
      icon="fas fa-comments"
    />

    <div class="chats-container">
      <ChatSetupOrchestrator
        context-type="all"
        mode="dashboard"
        :show-info-sidebar="$q.screen.gt.md"
      />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import DashboardTitle from '../../components/dashboard/DashboardTitle.vue'
import ChatSetupOrchestrator from '../../components/chat/ChatSetupOrchestrator.vue'
</script>

<style scoped>
.chats-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.chats-container {
  flex: 1;
  min-height: calc(100vh - 120px); /* Account for title and margins */
  overflow: hidden;
  margin: 0 16px 16px 16px;
  display: flex;
  flex-direction: column;
}

@media (max-width: 599px) {
  .chats-container {
    margin: 0;
    min-height: calc(100vh - 100px); /* Smaller title on mobile */
  }
}
</style>
