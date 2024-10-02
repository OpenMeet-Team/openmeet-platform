<template>
  <q-page class="q-pa-md">
    <div v-if="group" class="row q-col-gutter-md">
      <div class="col-12 col-lg-8">
        <q-card>
          <q-img
            :src="group.imageUrl || 'https://cdn.quasar.dev/img/parallax2.jpg'"
            :ratio="16/9"
          >
            <div class="absolute-bottom text-subtitle1 text-center bg-black-4 full-width">
              {{ group.name }}
            </div>
          </q-img>
          <q-card-section>
            <div class="text-h4">{{ group.name }}</div>
            <div class="text-subtitle1 q-mt-sm">
              <q-icon name="sym_r_category" /> {{ group.category }}
            </div>
            <div class="text-subtitle1">
              <q-icon name="sym_r_people" /> {{ group.memberCount }} members
            </div>
            <div class="text-body1 q-mt-md">{{ group.description }}</div>
          </q-card-section>
          <q-card-section>
            <div class="text-h6">Interests</div>
            <div class="q-gutter-sm">
              <q-chip v-for="interest in group.interests" :key="interest">
                {{ interest }}
              </q-chip>
            </div>
          </q-card-section>
        </q-card>

        <!-- Events List Section -->
        <q-card class="q-mt-md">
          <q-card-section>
            <div class="text-h5">Upcoming Events</div>
          </q-card-section>
          <q-separator />
          <q-list>
            <q-item v-for="event in group.events" :key="event.id" clickable v-ripple>
              <q-item-section avatar>
                <q-icon name="sym_r_event" color="primary" size="md" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ event.title }}</q-item-label>
                <q-item-label caption>
                  {{ formatDate(event.date) }} at {{ event.time }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn flat color="primary" label="Details" @click="viewEventDetails(event.id)" />
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>

      <!-- Members and Chat Section -->
      <div class="col-12 col-lg-4">
        <!-- Members List -->
        <q-card>
          <q-card-section>
            <div class="text-h5">Members</div>
          </q-card-section>
          <q-separator />
          <q-list style="max-height: 300px" class="scroll">
            <q-item v-for="member in group.members" :key="member.id">
              <q-item-section avatar>
                <q-avatar>
                  <img :src="member.avatar">
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ member.name }}</q-item-label>
                <q-item-label caption>{{ member.role }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>

        <!-- Chat Section -->
        <q-card class="q-mt-md">
          <q-card-section>
            <div class="text-h5">Group Chat</div>
          </q-card-section>
          <q-separator />
          <q-card-section class="chat-messages scroll" style="max-height: 300px">
            <div v-for="message in chatMessages" :key="message.id" class="q-mb-sm">
              <strong>{{ message.sender }}:</strong> {{ message.text }}
            </div>
          </q-card-section>
          <q-separator />
          <q-card-section>
            <q-input
              v-model="newMessage"
              label="Type a message"
              dense
              @keyup.enter="sendMessage"
            >
              <template v-slot:after>
                <q-btn round dense flat icon="sym_r_send" @click="sendMessage" />
              </template>
            </q-input>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { date, LoadingBar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from 'stores/user-store.ts'
import { useGroupStore } from 'stores/group-store.ts'

interface Member {
  id: number;
  name: string;
  role: string;
  avatar: string;
}

interface Event {
  id: number;
  title: string;
  date: string;
  time: string;
}

interface ChatMessage {
  id: number;
  sender: string;
  text: string;
}

interface Group {
  id: number;
  name: string;
  category: string;
  description: string;
  interests: string[];
  memberCount: number;
  imageUrl?: string;
  members: Member[];
  events: Event[];
}

const group = ref<Group | null>(null)
const chatMessages = ref<ChatMessage[]>([])
const newMessage = ref('')
const router = useRouter()
const route = useRoute()

const formatDate = (dateString: string) => {
  return date.formatDate(dateString, 'MMMM D, YYYY')
}

const viewEventDetails = (eventId: number) => {
  // In a real app, you'd navigate to the event details page
  console.log('View event details:', eventId)
  router.push({ name: 'EventPage', params: { id: eventId } })
}

const sendMessage = () => {
  if (newMessage.value.trim()) {
    chatMessages.value.push({
      id: Date.now(),
      sender: 'You', // In a real app, this would be the current user's name
      text: newMessage.value.trim()
    })
    newMessage.value = ''
    // In a real app, you'd send this message to a backend service
  }
}

onMounted(async () => {
  LoadingBar.start()

  Promise.all([
    useGroupStore().actionGetGroupById(route.params.id as string),
    useUserStore().actionGetGroupRights(route.params.id as string)
  ]).finally(LoadingBar.stop)

  group.value = {
    id: 1,
    name: 'Tech Enthusiasts',
    category: 'Technology',
    description: 'A group for tech lovers to discuss the latest trends and innovations in technology. We organize regular meetups, workshops, and online discussions on various tech topics.',
    interests: ['Programming', 'AI', 'Web Development', 'Data Science', 'Cybersecurity'],
    memberCount: 1250,
    imageUrl: 'https://cdn.quasar.dev/img/mountains.jpg',
    members: [
      { id: 1, name: 'John Doe', role: 'Organizer', avatar: 'https://cdn.quasar.dev/img/boy-avatar.png' },
      { id: 2, name: 'Jane Smith', role: 'Co-organizer', avatar: 'https://cdn.quasar.dev/img/avatar.png' },
      { id: 3, name: 'Bob Johnson', role: 'Member', avatar: 'https://cdn.quasar.dev/img/avatar3.jpg' },
      { id: 4, name: 'Alice Brown', role: 'Member', avatar: 'https://cdn.quasar.dev/img/avatar2.jpg' }
    ],
    events: [
      { id: 1, title: 'AI in Healthcare Workshop', date: '2023-07-15', time: '14:00' },
      { id: 2, title: 'Web Dev Meetup', date: '2023-07-22', time: '18:30' },
      { id: 3, title: 'Cybersecurity Panel Discussion', date: '2023-07-29', time: '19:00' }
    ]
  }

  // Mock chat messages
  chatMessages.value = [
    { id: 1, sender: 'John Doe', text: 'Welcome everyone to our group chat!' },
    { id: 2, sender: 'Jane Smith', text: 'Excited for the upcoming AI workshop!' },
    { id: 3, sender: 'Bob Johnson', text: 'Does anyone have resources on getting started with cybersecurity?' }
  ]
})
</script>

<style scoped>
.chat-messages {
  display: flex;
  flex-direction: column;
}

.chat-messages > div {
  max-width: 80%;
  padding: 8px 12px;
  border-radius: 12px;
  background-color: #f0f0f0;
  align-self: flex-start;
  margin-bottom: 8px;
}

.chat-messages > div:nth-child(even) {
  background-color: #e0e0e0;
  align-self: flex-end;
}
</style>
