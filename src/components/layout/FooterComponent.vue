<template>
  <q-footer class="bg-primary text-white">
    <q-toolbar>
      <div class="col row q-py-lg">
        <div class="col-12 col-md-4 q-pb-md">
          <h6 class="text-h6 q-mb-md">OpenMeet</h6>
          <p class="text-body2">Connect, share, and grow with like-minded people. Join our community today!</p>
          <div class="q-gutter-md q-mt-md">
            <q-btn v-for="icon in socialIcons" :key="icon.name" :icon="icon.name" flat round @click="openSocialLink(icon.link)" />
          </div>
        </div>
        <div class="col-12 col-md-4 q-pb-md">
          <h6 class="text-h6 q-mb-md">Quick Links</h6>
          <q-list dense>
            <q-item v-for="link in quickLinks" :key="link.name" clickable v-ripple @click="navigateTo(link.route)">
              <q-item-section>{{ link.name }}</q-item-section>
            </q-item>
          </q-list>
        </div>
        <div class="col-12 col-md-4 q-pb-md">
          <h6 class="text-h6 q-mb-md">Stay Connected</h6>
          <p class="text-body2 q-mb-sm">Subscribe to our newsletter for updates</p>
          <q-form @submit="onSubmit" class="q-gutter-md">
            <q-input v-model="email" filled type="email" label="Your email" :rules="[val => validateEmail(val) || 'Please enter a valid email']">
              <template v-slot:append>
                <q-btn round dense flat icon="send" type="submit" />
              </template>
            </q-input>
          </q-form>
        </div>
      </div>
    </q-toolbar>
      <q-separator dark />
    <q-toolbar>
      <div class="col row items-center justify-between q-py-sm">
        <div class="text-caption">© {{ currentYear }} OpenMeet. All rights reserved.</div>
        <div>
          <q-btn flat dense no-caps label="Privacy Policy" @click="navigateTo('/privacy')" />
          <q-btn flat dense no-caps label="Terms of Service" @click="navigateTo('/terms')" />
        </div>
      </div>
    </q-toolbar>

  </q-footer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'

const $q = useQuasar()
const router = useRouter()

const email = ref('')

const socialIcons = [
  { name: 'fab fa-facebook', link: 'https://facebook.com/openmeet' },
  { name: 'fab fa-twitter', link: 'https://twitter.com/openmeet' },
  { name: 'fab fa-instagram', link: 'https://instagram.com/openmeet' },
  { name: 'fab fa-linkedin', link: 'https://linkedin.com/company/openmeet' }
]

const quickLinks = [
  { name: 'Home', route: '/' },
  { name: 'About Us', route: '/about' },
  { name: 'Find Groups', route: '/groups' },
  { name: 'Events', route: '/events' },
  { name: 'Contact', route: '/contact' }
]

const currentYear = computed(() => new Date().getFullYear())

const validateEmail = (email: string): boolean => {
  const emailPattern = /^(?=[a-zA-Z0-9@._%+-]{6,254}$)[a-zA-Z0-9._%+-]{1,64}@(?:[a-zA-Z0-9-]{1,63}\.){1,8}[a-zA-Z]{2,63}$/
  return emailPattern.test(email)
}

const openSocialLink = (link: string) => {
  window.open(link, '_blank')
}

const navigateTo = (route: string) => {
  router.push(route)
}

const onSubmit = () => {
  if (validateEmail(email.value)) {
    // Here you would typically make an API call to subscribe the user
    console.log('Subscribing email:', email.value)
    $q.notify({
      color: 'positive',
      textColor: 'white',
      icon: 'check_circle',
      message: 'Thank you for subscribing to our newsletter!'
    })
    email.value = '' // Clear the input after successful submission
  } else {
    $q.notify({
      color: 'negative',
      textColor: 'white',
      icon: 'warning',
      message: 'Please enter a valid email address.'
    })
  }
}
</script>

<style scoped>
.q-footer {
  padding-top: 20px;
  padding-bottom: 20px;
}

@media (max-width: 599px) {
  .q-footer {
    text-align: center;
  }
}
</style>
