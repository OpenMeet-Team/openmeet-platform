<template>
  <!-- No email set -->
  <q-banner
    v-if="showNoEmail"
    class="bg-warning text-white q-pa-md"
    data-cy="alert-no-email"
  >
    <template v-slot:avatar>
      <q-icon name="sym_r_mail" size="md" />
    </template>
    <div class="row items-center justify-between full-width">
      <div class="col">
        <div class="text-weight-bold q-mb-xs">Add an email to your account</div>
        <div class="text-caption">An email address lets you manage RSVPs and receive event updates</div>
      </div>
      <div class="col-auto q-ml-md q-gutter-x-sm">
        <q-btn flat no-caps label="Dismiss" color="white" data-cy="dismiss-no-email" @click="dismissedNoEmail = true" />
        <q-btn flat no-caps label="Go to Settings" color="white" @click="goToProfile" />
      </div>
    </div>
  </q-banner>

  <!-- No AT Protocol identity -->
  <q-banner
    v-if="showNoAtproto"
    class="bg-info text-white q-pa-md"
    data-cy="alert-no-atproto"
  >
    <template v-slot:avatar>
      <q-icon name="fa-solid fa-at" size="md" />
    </template>
    <div class="row items-center justify-between full-width">
      <div class="col">
        <div class="text-weight-bold q-mb-xs">Link your AT Protocol account to publish events</div>
        <div class="text-caption">Connect an AT Protocol account so your events are published to the network</div>
      </div>
      <div class="col-auto q-ml-md q-gutter-x-sm">
        <q-btn flat no-caps label="Dismiss" color="white" data-cy="dismiss-no-atproto" @click="dismissedNoAtproto = true" />
        <q-btn flat no-caps label="Go to Settings" color="white" @click="goToProfile" />
      </div>
    </div>
  </q-banner>

  <!-- AT Protocol session inactive -->
  <q-banner
    v-if="showAtprotoSession"
    class="bg-orange text-white q-pa-md"
    data-cy="alert-atproto-session"
  >
    <template v-slot:avatar>
      <q-icon name="fa-solid fa-link-slash" size="md" />
    </template>
    <div class="row items-center justify-between full-width">
      <div class="col">
        <div class="text-weight-bold q-mb-xs">Your AT Protocol session has expired</div>
        <div class="text-caption">Re-link your account so your events can be published</div>
      </div>
      <div class="col-auto q-ml-md q-gutter-x-sm">
        <q-btn flat no-caps label="Dismiss" color="white" data-cy="dismiss-atproto-session" @click="dismissedAtprotoSession = true" />
        <q-btn flat no-caps label="Go to Settings" color="white" @click="goToProfile" />
      </div>
    </div>
  </q-banner>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth-store'

const authStore = useAuthStore()
const router = useRouter()

const dismissedNoEmail = ref(false)
const dismissedNoAtproto = ref(false)
const dismissedAtprotoSession = ref(false)

const isLoggedIn = computed(() => authStore.isFullyAuthenticated)
const user = computed(() => authStore.getUser)

const showNoEmail = computed(() =>
  isLoggedIn.value &&
  !dismissedNoEmail.value &&
  (user.value.email === null || user.value.email === undefined)
)

const showNoAtproto = computed(() =>
  isLoggedIn.value &&
  !dismissedNoAtproto.value &&
  !user.value.atprotoIdentity
)

const showAtprotoSession = computed(() =>
  isLoggedIn.value &&
  !dismissedAtprotoSession.value &&
  !!user.value.atprotoIdentity &&
  !user.value.atprotoIdentity.hasActiveSession
)

const goToProfile = () => {
  router.push({ name: 'DashboardProfilePage' })
}
</script>
