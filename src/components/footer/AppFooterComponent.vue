<template>
  <FooterWrapperComponent>
    <q-toolbar style="max-width: 1201px" class="q-mx-auto">
      <div class="col row q-py-lg">
        <div class="col-12 col-md-4 q-pb-md q-pa-sm">
          <HeaderLogoComponent />
          <p class="text-body2 q-mt-md">Connect, share, and grow with like-minded people. Join our community today!</p>
          <div class="q-gutter-md q-mt-md">
            <ShareComponent/>
          </div>
        </div>
        <div class="col-12 col-md-4 q-pb-md q-pa-sm">
          <div class="text-h6 q-mb-md">Quick Links</div>
          <q-list dense>
            <MenuItemComponent label="Home" @click="navigateTo('/')"/>
            <MenuItemComponent label="About Us" @click="openSocialLink('https://openmeet.net/about')"/>
            <MenuItemComponent label="Groups" @click="navigateTo('/groups')"/>
            <MenuItemComponent label="Events" @click="navigateTo('/events')"/>
            <MenuItemComponent v-if="supportUrl" label="Support Us" @click="navigateTo('/support')"/>
          </q-list>
        </div>
        <div class="col-12 col-md-4 q-pb-md q-pa-sm">
          <div class="text-h6 q-mb-md">Stay Connected</div>
          <p class="text-body2 q-mb-sm">Subscribe to our newsletter for updates</p>
          <FooterHubspotComponent/>
        </div>

      </div>
    </q-toolbar>
    <q-separator />
    <q-toolbar style="max-width: 1201px" class="q-mx-auto">
      <div class="col row items-center justify-between q-py-sm">
        <div class="text-left">
          <div class="text-body2">© {{ currentYear }} <a target="_blank" style="color: inherit" href="https://openmeet.net">OpenMeet</a>. All rights reserved.</div>
          <VersionComponent/>
        </div>
        <div>
          <q-btn size="md" class="q-mr-md" padding="none" flat dense no-caps label="Terms of Service" @click="navigateTo('/terms')" />
          <q-btn size="md" padding="none" flat dense no-caps label="Privacy Policy" @click="navigateTo('/privacy')" />
        </div>
      </div>
    </q-toolbar>
  </FooterWrapperComponent>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import FooterWrapperComponent from './FooterWrapperComponent.vue'
import FooterHubspotComponent from '../footer/FooterHubspotComponent.vue'
import MenuItemComponent from '../common/MenuItemComponent.vue'
import ShareComponent from '../common/ShareComponent.vue'
import VersionComponent from '../common/VersionComponent.vue'
import HeaderLogoComponent from '../header/HeaderLogoComponent.vue'
const router = useRouter()

const currentYear = computed(() => new Date().getFullYear())
const supportUrl = computed(() => window.APP_CONFIG?.APP_SUPPORT_URL)

const openSocialLink = (link: string) => {
  window.open(link, '_blank')
}

const navigateTo = (route: string) => {
  router.push(route)
}

</script>

<style scoped>
</style>
