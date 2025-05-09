<template>
  <q-page padding>
    <div class="container q-pa-md">
      <h1 class="text-h4 text-primary q-mb-md">Admin Dashboard</h1>

      <div class="q-mb-lg">
        <p class="text-subtitle1">Welcome to the OpenMeet Administration portal. This area is for administrators only.</p>
      </div>

      <div class="row q-col-gutter-md">
        <!-- Admin Tools Section -->
        <div class="col-12 col-md-6">
          <q-card class="admin-card">
            <q-card-section>
              <div class="text-h6 text-primary">System Tools</div>
            </q-card-section>

            <q-card-section>
              <q-list>
                <q-item to="/admin/bluesky-reset" clickable v-ripple>
                  <q-item-section avatar>
                    <q-icon name="sym_r_restart_alt" color="primary" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>Bluesky Session Reset Tool</q-item-label>
                    <q-item-label caption>Reset user Bluesky authentication sessions</q-item-label>
                  </q-item-section>
                </q-item>

                <q-item to="/admin/chatroom-management" clickable v-ripple>
                  <q-item-section avatar>
                    <q-icon name="sym_r_chat" color="primary" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>Chat Room Management</q-item-label>
                    <q-item-label caption>Delete and create event/group chat rooms</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>
        </div>

        <!-- System Stats Section -->
        <div class="col-12 col-md-6">
          <q-card class="admin-card">
            <q-card-section>
              <div class="text-h6 text-primary">System Status</div>
            </q-card-section>

            <q-card-section>
              <p>System status information will be displayed here in future updates.</p>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth-store'
import { UserRole } from '../../types'

const router = useRouter()
const authStore = useAuthStore()

// Check if user is an admin
onMounted(() => {
  if (!authStore.hasRole(UserRole.Admin)) {
    // Redirect non-admin users to home page
    router.push('/')
  }
})

defineOptions({
  name: 'AdminPage'
})
</script>

<style scoped lang="scss">
.admin-card {
  height: 100%;
  transition: transform 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
