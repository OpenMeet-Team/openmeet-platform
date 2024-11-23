<template>
  <div class="">
    <q-btn no-caps color="secondary" text-color="black" spread label="Generate QR Code" data-cy="share-button"
      style="width: 240px;" @click="showQRCodePopup = true">
    </q-btn>
    <q-dialog class="q-pa-lg" v-model="showQRCodePopup" @show="onDialogShow">
      <q-card class="custom-width">
        <div class="flex row justify-between items-center">
          <q-card-section class="text-h6 flex justify-center">
            QR Code
          </q-card-section>
          <q-card-actions align="center" class="justify-center">
            <q-btn flat icon="sym_r_close" color="primary" @click="showQRCodePopup = false" />
          </q-card-actions>
        </div>

        <q-card-section class="q-pa-md">
          <div class="q-mb-md">
            <!-- Render canvas only when dialog is open -->
            <canvas v-if="showQRCodePopup" ref="qrCanvas" class="qr-code-canvas" />
          </div>

          <q-input v-model="qrLink" label="Link" outlined readonly />
          <q-btn label="Copy link" color="primary" class="q-mt-md center" @click="copyToClipboard" />

          <!-- Share Buttons Section -->
          <div class="q-mt-md flex justify-center">
            <q-btn icon="fab fa-facebook" color="blue" flat @click="shareOnPlatform('facebook')" />
            <q-btn icon="fab fa-twitter" color="blue" flat @click="shareOnPlatform('twitter')" />
            <q-btn icon="fab fa-linkedin" color="blue" flat @click="shareOnPlatform('linkedin')" />
            <q-btn icon="fab fa-whatsapp" color="green" flat @click="shareOnPlatform('whatsapp')" />
            <q-btn icon="fas fa-envelope" color="red" flat @click="shareOnPlatform('email')" />
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import QRCode from 'qrcode'
import { useNotification } from 'src/composables/useNotification'

const showQRCodePopup = ref(false)
const qrLink = ref<string>('')
const qrCanvas = ref<HTMLCanvasElement | null>(null)

onMounted(() => {
  qrLink.value = window.location.href
})

const generateQRCode = () => {
  const canvas = qrCanvas.value
  if (canvas) {
    QRCode.toCanvas(canvas, qrLink.value, { width: 200 }, (error) => {
      if (error) console.error(error)
    })
  } else {
    console.error('Canvas element is not available.')
  }
}

// Run QR code generation when dialog shows
const onDialogShow = () => {
  nextTick(() => {
    generateQRCode()
  })
}

const { success, error } = useNotification()

const copyToClipboard = () => {
  navigator.clipboard.writeText(qrLink.value).then(() => {
    success('Link copied to clipboard!')
  }).catch(() => {
    error('Failed to copy link.')
  })
}

const shareOnPlatform = (platform: string) => {
  const encodedLink = encodeURIComponent(qrLink.value)
  let url = ''
  switch (platform) {
    case 'facebook':
      url = `https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`
      break
    case 'twitter':
      url = `https://twitter.com/intent/tweet?url=${encodedLink}`
      break
    case 'linkedin':
      url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedLink}`
      break
    case 'whatsapp':
      url = `https://wa.me/?text=${encodedLink}`
      break
    case 'email':
      url = `mailto:?subject=Check%20this%20out&body=${encodedLink}`
      break
  }
  window.open(url, '_blank')
}
</script>

<style scoped>
.custom-width {
  width: 400px;
  max-width: 90vw;
  border-radius: 15px;
}

.qr-code-canvas {
  width: 100%;
  max-width: 300px;
  height: auto;
  display: block;
  margin: 0 auto;
}

.center {
  width: 100%;
}
</style>
