<template>
  <q-page class="q-pa-md">
    <DashboardTitle label="My Messages"/>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-4" v-for="category in categories" :key="category.id">
        <q-card class="message-category">
          <q-card-section>
            <div class="text-h5">{{ category.name }}</div>
          </q-card-section>

          <q-separator />

          <q-card-section>
            <q-list separator>
              <q-item v-for="message in category.messages" :key="message.id" clickable v-ripple>
                <q-item-section avatar>
                  <q-avatar>
                    <img :src="message.avatar">
                  </q-avatar>
                </q-item-section>

                <q-item-section>
                  <q-item-label>{{ message.sender }}</q-item-label>
                  <q-item-label caption>{{ message.subject }}</q-item-label>
                </q-item-section>

                <q-item-section side>
                  {{ formatDate(message.date) }}
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat color="primary" label="View All" @click="viewAll(category.id)" />
          </q-card-actions>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { date } from 'quasar'
import DashboardTitle from 'components/dashboard/DashboardTitle.vue'

interface Message {
  id: number;
  sender: string;
  subject: string;
  date: Date;
  avatar: string;
}

interface Category {
  id: string;
  name: string;
  messages: Message[];
}

const categories = ref<Category[]>([
  {
    id: 'group',
    name: 'Group Messages',
    messages: [
      { id: 1, sender: 'Tech Group', subject: 'New project idea', date: new Date('2023-05-15T10:30:00'), avatar: 'https://cdn.quasar.dev/img/avatar1.jpg' },
      { id: 2, sender: 'Book Club', subject: 'Next month\'s book', date: new Date('2023-05-14T15:45:00'), avatar: 'https://cdn.quasar.dev/img/avatar2.jpg' },
      { id: 3, sender: 'Hiking Group', subject: 'Weekend trip plan', date: new Date('2023-05-13T09:00:00'), avatar: 'https://cdn.quasar.dev/img/avatar3.jpg' }
    ]
  },
  {
    id: 'events',
    name: 'Event Messages',
    messages: [
      { id: 4, sender: 'Conference Organizer', subject: 'Speaker confirmation', date: new Date('2023-05-15T11:20:00'), avatar: 'https://cdn.quasar.dev/img/avatar4.jpg' },
      { id: 5, sender: 'Meetup.com', subject: 'New event in your area', date: new Date('2023-05-14T16:30:00'), avatar: 'https://cdn.quasar.dev/img/avatar5.jpg' },
      { id: 6, sender: 'Local Theater', subject: 'Upcoming performance', date: new Date('2023-05-13T14:15:00'), avatar: 'https://cdn.quasar.dev/img/avatar6.jpg' }
    ]
  },
  {
    id: 'personal',
    name: 'Personal Messages',
    messages: [
      { id: 7, sender: 'John Doe', subject: 'Lunch next week?', date: new Date('2023-05-15T08:45:00'), avatar: 'https://cdn.quasar.dev/img/boy-avatar.png' },
      { id: 8, sender: 'Jane Smith', subject: 'Project update', date: new Date('2023-05-14T17:00:00'), avatar: 'https://cdn.quasar.dev/img/girl-avatar.jpg' },
      { id: 9, sender: 'Mike Johnson', subject: 'Happy birthday!', date: new Date('2023-05-13T00:01:00'), avatar: 'https://cdn.quasar.dev/img/linux-avatar.png' }
    ]
  }
])

const formatDate = (dateString: Date) => {
  return date.formatDate(dateString, 'MMM D, YYYY')
}

const viewAll = (categoryId: string) => {
  // This function would typically navigate to a full list view for the category
  console.log(`View all messages for category: ${categoryId}`)
}
</script>

<style scoped>
.message-category {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.message-category .q-card-section:nth-child(3) {
  flex-grow: 1;
  overflow-y: auto;
}
</style>
