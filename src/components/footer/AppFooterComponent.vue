<template>
  <q-footer bordered :class="[Dark.isActive ? 'bg-dark-gray text-white' : 'bg-white text-black']" style="z-index: auto">
    <q-toolbar>
      <div class="col row q-py-lg">
        <div class="col-12 col-md-4 q-pb-md q-pa-sm">
          <h6 class="text-h6 q-mb-md">OpenMeet</h6>
          <p class="text-body2">Connect, share, and grow with like-minded people. Join our community today!</p>
          <div class="q-gutter-md q-mt-md">
            <ShareComponent/>
          </div>
        </div>
        <div class="col-12 col-md-4 q-pb-md q-pa-sm">
          <h6 class="text-h6 q-mb-md">Quick Links</h6>
          <q-list dense>
            <MenuItemComponent label="Home" @click="navigateTo('/')"/>
            <MenuItemComponent label="About Us" @click="openSocialLink('https://biz.openmeet.net/about')"/>
            <MenuItemComponent label="Groups" @click="navigateTo('/groups')"/>
            <MenuItemComponent label="Events" @click="navigateTo('/events')"/>
          </q-list>
        </div>
        <div class="col-12 col-md-4 q-pb-md q-pa-sm">
          <h6 class="text-h6 q-mb-md">Stay Connected</h6>
          <p class="text-body2 q-mb-sm">Subscribe to our newsletter for updates</p>
          <FooterHubspotComponent/>
        </div>

      </div>
    </q-toolbar>
      <q-separator dark />
    <q-toolbar>
      <div class="col row items-center justify-between q-py-sm">
        <div>
          <div class="text-caption text-bold">© {{ currentYear }} <a target="_blank" style="color: inherit" href="https://biz.openmeet.net">OpenMeet</a>. All rights reserved.</div>
          <VersionComponent/>
        </div>
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
import MenuItemComponent from 'components/common/MenuItemComponent.vue'
import ShareComponent from 'components/common/ShareComponent.vue'
import VersionComponent from '../common/VersionComponent.vue'
const router = useRouter()

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
