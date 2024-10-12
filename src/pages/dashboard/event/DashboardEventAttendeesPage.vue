<template>
  <q-form padding v-if="loaded">
    <q-input
      v-model="searchTerm"
      debounce="300"
      placeholder="Search attendees"
      filled
      prepend-icon="search"
    />

    <div class="row q-col-gutter-md">
      <!-- Going List -->
      <div class="col">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-h6">Going</div>
          </q-card-section>
          <q-list>
            <q-item
              v-for="attendee in filteredGoing"
              :key="attendee.id"
              clickable
              v-ripple
            >
              <q-item-section>{{ attendee.name }}</q-item-section>
              <q-item-section side>
                <q-btn
                  icon="sym_r_remove_circle"
                  color="red"
                  flat
                  @click="toggleAttendance(attendee.id)"
                />
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>

      <!-- Not Going List -->
      <div class="col">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-h6">Not Going</div>
          </q-card-section>
          <q-list>
            <q-item
              v-for="attendee in filteredNotGoing"
              :key="attendee.id"
              clickable
              v-ripple
            >
              <q-item-section>{{ attendee.name }}</q-item-section>
              <q-item-section side>
                <q-btn
                  icon="sym_r_add_circle"
                  color="green"
                  flat
                  @click="toggleAttendance(attendee.id)"
                />
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>
    </div>
  </q-form>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { eventsApi } from 'src/api/dashboard.ts'
import { LoadingBar } from 'quasar'
import { useRoute } from 'vue-router'

// Define attendee structure
interface Attendee {
  id: number;
  name: string;
  going: boolean;
}

// Mock data
const attendees = ref<Attendee[]>([
  { id: 1, name: 'John Doe', going: true },
  { id: 2, name: 'Jane Smith', going: false },
  { id: 3, name: 'Bob Johnson', going: true },
  { id: 4, name: 'Alice Williams', going: false }
])
const loaded = ref<boolean>(false)

// Search term state
const searchTerm = ref('')

// Filter attendees who are going
const filteredGoing = computed(() =>
  attendees.value.filter(
    (attendee) =>
      attendee.going && attendee.name.toLowerCase().includes(searchTerm.value.toLowerCase())
  )
)

// Filter attendees who are not going
const filteredNotGoing = computed(() =>
  attendees.value.filter(
    (attendee) =>
      !attendee.going && attendee.name.toLowerCase().includes(searchTerm.value.toLowerCase())
  )
)

// Function to toggle an attendee's attendance status
const toggleAttendance = (id: number) => {
  const attendee = attendees.value.find((attendee) => attendee.id === id)
  if (attendee) {
    attendee.going = !attendee.going
  }
}

const route = useRoute()

onMounted(() => {
  LoadingBar.start()
  eventsApi.getAttendees(route.params.id as string).then(() => {
    console.log('todo')
  }).finally(() => {
    LoadingBar.stop()
    loaded.value = true
  })
})
</script>

<style scoped>
/* Custom styles for the page */
.q-page {
  max-width: 1200px;
  margin: auto;
}

.q-list {
  max-height: 400px;
  overflow-y: auto;
}
</style>
