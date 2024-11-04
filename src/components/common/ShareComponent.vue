<template>
  <q-btn-dropdown
    no-caps
    color="secondary"
    text-color="black"
    icon="sym_r_share"
    spread
    label="Share"
    data-cy="share-button"
  >
    <q-list>
      <MenuItemComponent label="Facebook" icon="fab fa-facebook" icon-color="blue" @click="shareTo('facebook')"/>
      <MenuItemComponent label="X" icon="fab fa-square-x-twitter" icon-color="black" @click="shareTo('x')"/>
      <MenuItemComponent label="LinkedIn" icon="fab fa-linkedin" icon-color="blue-8" @click="shareTo('linkedin')"/>
      <MenuItemComponent label="WhatsApp" icon="fab fa-whatsapp" icon-color="green" @click="shareTo('whatsapp')"/>
      <MenuItemComponent label="Email" icon="sym_r_mail" icon-color="red" @click="shareToEmail"/>
    </q-list>
  </q-btn-dropdown>
</template>

<script setup lang="ts">
import { Notify } from 'quasar'
import MenuItemComponent from 'components/common/MenuItemComponent.vue'

// Define the URLs for each social media platform
const shareUrls = {
  facebook: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  x: (url: string, text: string) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  linkedin: (url: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  whatsapp: (url: string) => `https://api.whatsapp.com/send?text=${encodeURIComponent(url)}`
}

// Function to share content based on the selected platform
const shareTo = (platform: keyof typeof shareUrls) => {
  const url = window.location.href // Share the current page URL
  const text = 'Check this out!' // Share message text (can be customized)

  const shareUrl = shareUrls[platform](url, text)
  try {
    window.open(shareUrl, '_blank')
  } catch (error) {
    Notify.create({ type: 'negative', message: 'Failed to share content.' })
  }
}

// Function for sharing via email
const shareToEmail = () => {
  const subject = encodeURIComponent('Check this out!')
  const body = encodeURIComponent(`I found this interesting: ${window.location.href}`)

  try {
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  } catch (error) {
    Notify.create({ type: 'negative', message: 'Failed to share via email.' })
  }
}
</script>

<style scoped>
/* Optional custom styles */
</style>
