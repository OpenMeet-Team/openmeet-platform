<template>
  <q-page class="messages-page">
    <DashboardTitle
      title="Messages"
      subtitle="Stay connected with your communities"
      icon="fas fa-comments"
    />

    <div class="messages-container">
      <UnifiedChatComponent
        context-type="all"
        mode="dashboard"
        :show-info-sidebar="$q.screen.gt.md"
      />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import DashboardTitle from '../components/dashboard/DashboardTitle.vue'
import UnifiedChatComponent from '../components/chat/UnifiedChatComponent.vue'
</script>

<style scoped>
.messages-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.messages-container {
  flex: 1;
  overflow: hidden;
  margin: 0 16px 16px 16px;
}

@media (max-width: 599px) {
  .messages-container {
    margin: 0;
  }
}
</style>
