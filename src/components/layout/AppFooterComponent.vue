<template>
  <q-footer bordered :class="[Dark.isActive ? 'bg-dark-gray text-white' : 'bg-white text-black']">
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
            <MenuItemComponent label="Home" @click="navigateTo('/')"/>
            <MenuItemComponent label="About Us" @click="openSocialLink('https://biz.openmeet.net')"/>
            <MenuItemComponent label="Find Groups" @click="navigateTo('/groups')"/>
            <MenuItemComponent label="Events" @click="navigateTo('/events')"/>
          </q-list>
        </div>
        <div class="col-12 col-md-4 q-pb-md">
          <h6 class="text-h6 q-mb-md">Stay Connected</h6>
          <p class="text-body2 q-mb-sm">Subscribe to our newsletter for updates</p>
          <FooterHubspotComponent/>
        </div>

      </div>
    </q-toolbar>
      <q-separator dark />
    <q-toolbar>
      <div class="col row items-center justify-between q-py-sm">
        <div class="text-caption">© {{ currentYear }} <a target="_blank" style="color: inherit" href="https://biz.openmeet.net">OpenMeet</a>. All rights reserved.</div>
        <div>
          <q-btn size="md" class="q-mr-md" padding="none" flat dense no-caps label="Privacy Policy" href="https://biz.openmeet.net/privacy" target="_blank" />
          <q-btn size="md" padding="none" flat dense no-caps label="Terms of Service" href="https://biz.openmeet.net/terms" target="_blank" />
        </div>
      </div>
    </q-toolbar>

  </q-footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Dark } from 'quasar'
import { useRouter } from 'vue-router'
import FooterHubspotComponent from 'components/footer/FooterHubspotComponent.vue'
import MenuItemComponent from 'components/general/MenuItemComponent.vue'

const router = useRouter()

const socialIcons = [
  { name: 'fab fa-facebook', link: 'https://facebook.com/openmeet' },
  { name: 'fab fa-twitter', link: 'https://twitter.com/openmeet' },
  { name: 'fab fa-instagram', link: 'https://instagram.com/openmeet' },
  { name: 'fab fa-linkedin', link: 'https://linkedin.com/company/openmeet' }
]

const currentYear = computed(() => new Date().getFullYear())

const openSocialLink = (link: string) => {
  window.open(link, '_blank')
}

const navigateTo = (route: string) => {
  router.push(route)
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
