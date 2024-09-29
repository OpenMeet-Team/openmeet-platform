<template>
  <q-btn-dropdown
    flat
    dense
    icon="notifications"
    class="notifications-dropdown q-mr-md"
  >
    <template v-slot:label>
      <q-badge
        v-if="unreadCount > 0"
        color="red"
        floating
        transparent
      >
        {{ unreadCount }}
      </q-badge>
    </template>

    <q-list style="min-width: 300px; max-width: 300px;">
      <q-item-label header>Notifications</q-item-label>

      <template v-if="notifications.length > 0">
        <q-item
          v-for="notification in notifications"
          :key="notification.id"
          clickable
          v-ripple
          :class="{ 'bg-grey-2 text-black': !notification.read }"
          @click="markAsRead(notification.id)"
        >
          <q-item-section avatar>
            <q-avatar :icon="notification.icon" :color="notification.color" text-color="white" />
          </q-item-section>

          <q-item-section>
            <q-item-label>{{ notification.title }}</q-item-label>
            <q-item-label caption>{{ notification.message }}</q-item-label>
          </q-item-section>

          <q-item-section side>
            {{ formatTimestamp(notification.timestamp) }}
          </q-item-section>
        </q-item>
      </template>

      <q-item v-else>
        <q-item-section>
          <q-item-label>No notifications</q-item-label>
        </q-item-section>
      </q-item>

      <q-separator />

      <q-item clickable v-ripple @click="markAllAsRead" v-if="unreadCount > 0">
        <q-item-section class="text-center text-primary">
          Mark all as read
        </q-item-section>
      </q-item>
    </q-list>
  </q-btn-dropdown>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { date } from 'quasar'

interface Notification {
  id: number;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  icon: string;
  color: string;
}

const notifications = ref<Notification[]>([
  {
    id: 1,
    title: 'New Message',
    message: 'You have a new message from John',
    timestamp: new Date('2023-05-15T10:30:00'),
    read: false,
    icon: 'mail',
    color: 'primary'
  },
  {
    id: 2,
    title: 'Event Reminder',
    message: 'Your event "Team Meeting" starts in 30 minutes',
    timestamp: new Date('2023-05-15T09:45:00'),
    read: false,
    icon: 'event',
    color: 'secondary'
  },
  {
    id: 3,
    title: 'Task Completed',
    message: 'Great job! You\'ve completed all your tasks for today',
    timestamp: new Date('2023-05-14T17:00:00'),
    read: true,
    icon: 'check_circle',
    color: 'positive'
  }
])

const unreadCount = computed(() => {
  return notifications.value.filter(notification => !notification.read).length
})

const formatTimestamp = (timestamp: Date) => {
  return date.formatDate(timestamp, 'MMM D, h:mm A')
}

const markAsRead = (id: number) => {
  const notification = notifications.value.find(n => n.id === id)
  if (notification) {
    notification.read = true
  }
}

const markAllAsRead = () => {
  notifications.value.forEach(notification => {
    notification.read = true
  })
}
</script>

<style scoped>
.notifications-dropdown {
  .q-btn-dropdown__arrow {
    margin-left: 0;
  }
}
</style>
