<template>
  <q-page class="chats-page">
    <DashboardTitle
      title="Chats"
      subtitle="Stay connected with your communities"
      icon="fas fa-comments"
    />

    <div class="chats-container">
      <UnifiedChatComponent
        context-type="all"
        mode="dashboard"
        :show-info-sidebar="$q.screen.gt.md"
      />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import DashboardTitle from '../../components/dashboard/DashboardTitle.vue'
import UnifiedChatComponent from '../../components/chat/UnifiedChatComponent.vue'
</script>

<style scoped>
.chats-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.chats-container {
  flex: 1;
  overflow: hidden;
  margin: 0 16px 16px 16px;
}

@media (max-width: 599px) {
  .chats-container {
    margin: 0;
  }
}
</style>
