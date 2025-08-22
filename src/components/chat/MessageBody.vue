<!--
Message Body Component - Following Element Web patterns

This component handles rendering different message types (text, image, file, etc.)
from Matrix events, similar to Element Web's body component routing.
-->

<template>
  <div class="message-body">
    <!-- Text Messages -->
    <div v-if="isTextMessage" class="text-message">
      <div class="message-text" v-html="formattedMessageText"></div>
    </div>

    <!-- Image Messages -->
    <div v-else-if="isImageMessage" class="image-message">
      <div class="image-container">
        <img
          v-if="imageUrl"
          :src="imageUrl"
          :alt="content.body || 'Image'"
          class="message-image"
          @load="onImageLoad"
          @error="onImageError"
          @click="viewFullImage"
        />
        <div v-else-if="imageLoading" class="image-placeholder">
          <q-spinner size="2rem" />
          <div class="text-caption q-mt-sm">Loading image...</div>
        </div>
        <div v-else class="image-placeholder">
          <q-icon name="fas fa-image" size="2rem" />
          <div class="text-caption q-mt-sm">{{ content.body || 'Image' }}</div>
        </div>
      </div>
    </div>

    <!-- File Messages -->
    <div v-else-if="isFileMessage" class="file-message">
      <div class="file-container row items-center q-gutter-sm q-pa-sm">
        <q-icon name="fas fa-file" size="1.5rem" color="primary" />
        <div class="file-info">
          <div class="file-name text-weight-medium">{{ fileName }}</div>
          <div v-if="fileSize" class="file-size text-caption">{{ formatFileSize(fileSize) }}</div>
        </div>
        <q-btn
          v-if="fileUrl"
          icon="fas fa-download"
          size="sm"
          flat
          round
          @click="downloadFile"
          title="Download file"
        />
      </div>
    </div>

    <!-- Audio Messages -->
    <div v-else-if="isAudioMessage" class="audio-message">
      <audio v-if="audioUrl" controls class="message-audio">
        <source :src="audioUrl" :type="content.info?.mimetype || 'audio/mpeg'">
        Your browser does not support the audio element.
      </audio>
      <div v-else class="audio-placeholder">
        <q-icon name="fas fa-volume-up" size="1.5rem" />
        <span class="q-ml-sm">{{ content.body || 'Audio message' }}</span>
      </div>
    </div>

    <!-- Video Messages -->
    <div v-else-if="isVideoMessage" class="video-message">
      <video v-if="videoUrl" controls class="message-video">
        <source :src="videoUrl" :type="content.info?.mimetype || 'video/mp4'">
        Your browser does not support the video element.
      </video>
      <div v-else class="video-placeholder">
        <q-icon name="fas fa-play" size="2rem" />
        <div class="text-caption q-mt-sm">{{ content.body || 'Video' }}</div>
      </div>
    </div>

    <!-- Emote Messages -->
    <div v-else-if="isEmoteMessage" class="emote-message">
      <span class="emote-text">* {{ formattedMessageText }}</span>
    </div>

    <!-- Notice Messages -->
    <div v-else-if="isNoticeMessage" class="notice-message">
      <div class="notice-text" v-html="formattedMessageText"></div>
    </div>

    <!-- Unsupported Message Types -->
    <div v-else class="unsupported-message">
      <div class="text-caption text-grey-6">
        <q-icon name="fas fa-question-circle" class="q-mr-xs" />
        Unsupported message type: {{ msgtype }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { type MatrixEvent } from 'matrix-js-sdk'
import { matrixClientService } from '../../services/matrixClientService'

interface Props {
  mxEvent: MatrixEvent
  content: Record<string, any>
  msgtype?: string
}

const props = defineProps<Props>()

// Message type detection following Element Web patterns
const isTextMessage = computed(() => props.msgtype === 'm.text')
const isImageMessage = computed(() => props.msgtype === 'm.image')
const isFileMessage = computed(() => props.msgtype === 'm.file')
const isAudioMessage = computed(() => props.msgtype === 'm.audio')
const isVideoMessage = computed(() => props.msgtype === 'm.video')
const isEmoteMessage = computed(() => props.msgtype === 'm.emote')
const isNoticeMessage = computed(() => props.msgtype === 'm.notice')

// Text formatting
const formattedMessageText = computed(() => {
  const body = props.content.body || ''

  // Use formatted_body if available (HTML)
  if (props.content.formatted_body && props.content.format === 'org.matrix.custom.html') {
    return props.content.formatted_body
  }

  // Basic text formatting for plain text
  return body
    .replace(/\n/g, '<br>')
    .replace(/https?:\/\/[^\s]+/g, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`)
})

// File handling
const fileName = computed(() => props.content.filename || props.content.body || 'Unnamed file')
const fileSize = computed(() => props.content.info?.size)
const fileUrl = computed(() => {
  if (!props.content.url) return null
  return matrixClientService.getContentUrl(props.content.url)
})

// Media URLs (images, audio, video)
const imageUrl = ref<string | null>(null)
const imageLoading = ref(false)

// Load authenticated image
const loadImage = async () => {
  if (!props.content.url || imageLoading.value) return
  
  imageLoading.value = true
  try {
    // Get the authenticated thumbnail URL
    const thumbnailUrl = matrixClientService.getContentUrl(props.content.url, 400, 300)
    
    // Fetch with authentication headers
    const client = matrixClientService.getClient()
    if (!client) return
    
    const response = await fetch(thumbnailUrl, {
      headers: {
        'Authorization': `Bearer ${client.getAccessToken()}`
      }
    })
    
    if (!response.ok) {
      console.error('Failed to fetch image thumbnail:', response.status, response.statusText)
      return
    }
    
    // Create blob URL for inline display
    const blob = await response.blob()
    imageUrl.value = URL.createObjectURL(blob)
  } catch (error) {
    console.error('Error loading image:', error)
  } finally {
    imageLoading.value = false
  }
}

const audioUrl = computed(() => {
  if (!props.content.url) return null
  return matrixClientService.getContentUrl(props.content.url)
})

const videoUrl = computed(() => {
  if (!props.content.url) return null
  return matrixClientService.getContentUrl(props.content.url)
})

// Event handlers
const onImageLoad = () => {
  // TODO: Handle image load events
}

const onImageError = () => {
  // TODO: Handle image load errors
}

const downloadFile = async () => {
  if (props.content.url) {
    try {
      // Get the authenticated URL
      const fileUrl = matrixClientService.getContentUrl(props.content.url)
      
      // Fetch with authentication headers
      const client = matrixClientService.getClient()
      if (!client) return
      
      const response = await fetch(fileUrl, {
        headers: {
          'Authorization': `Bearer ${client.getAccessToken()}`
        }
      })
      
      if (!response.ok) {
        console.error('Failed to fetch file:', response.status, response.statusText)
        return
      }
      
      // Create blob and download
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      
      // Create download link
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = fileName.value
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Clean up blob URL
      URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error('Error downloading file:', error)
    }
  }
}

const viewFullImage = async () => {
  if (props.content.url) {
    try {
      // Get the authenticated URL
      const fullImageUrl = matrixClientService.getContentUrl(props.content.url)
      
      // Fetch with authentication headers
      const client = matrixClientService.getClient()
      if (!client) return
      
      const response = await fetch(fullImageUrl, {
        headers: {
          'Authorization': `Bearer ${client.getAccessToken()}`
        }
      })
      
      if (!response.ok) {
        console.error('Failed to fetch image:', response.status, response.statusText)
        return
      }
      
      // Create blob URL and open in new tab
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const newWindow = window.open(blobUrl, '_blank')
      
      // Clean up blob URL after a delay
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl)
      }, 10000)
    } catch (error) {
      console.error('Error viewing image:', error)
    }
  }
}

// Utility functions
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Lifecycle hooks
onMounted(() => {
  if (isImageMessage.value) {
    loadImage()
  }
})

onUnmounted(() => {
  // Clean up blob URL when component is destroyed
  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value)
  }
})
</script>

<style scoped>
.message-body {
  word-wrap: break-word;
  word-break: break-word;
}

.text-message .message-text {
  line-height: 1.4;
}

.image-message .image-container {
  max-width: 300px;
}

.message-image {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  cursor: pointer;
}

.image-placeholder,
.video-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  border: 2px dashed #ddd;
  border-radius: 8px;
  color: #666;
}

.file-container {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #f9f9f9;
  max-width: 300px;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  color: #666;
}

.message-audio,
.message-video {
  max-width: 100%;
  border-radius: 8px;
}

.message-video {
  max-width: 400px;
}

.audio-placeholder {
  display: flex;
  align-items: center;
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #f9f9f9;
}

.emote-message .emote-text {
  font-style: italic;
  opacity: 0.9;
}

.notice-message .notice-text {
  font-weight: 500;
  opacity: 0.9;
}

.unsupported-message {
  padding: 0.5rem;
  background: rgba(255, 193, 7, 0.1);
  border-radius: 4px;
  border-left: 3px solid #ffc107;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .file-container,
  .audio-placeholder {
    background: #2d2d2d;
    border-color: #444;
  }

  .image-placeholder,
  .video-placeholder {
    border-color: #444;
    color: #ccc;
  }

  .file-size {
    color: #aaa;
  }

  .unsupported-message {
    background: rgba(255, 193, 7, 0.2);
  }
}

/* Links in messages */
:deep(a) {
  color: #1976d2;
  text-decoration: none;
}

:deep(a:hover) {
  text-decoration: underline;
}

@media (prefers-color-scheme: dark) {
  :deep(a) {
    color: #64b5f6;
  }
}
</style>
