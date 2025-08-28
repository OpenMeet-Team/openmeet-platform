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
          <div class="text-xs text-grey-7 q-mt-xs" v-if="!content.url">No URL found</div>
          <div class="text-xs text-grey-7 q-mt-xs" v-else-if="!imageUrl && !imageLoading">Failed to load</div>
        </div>
      </div>
    </div>

    <!-- File Messages -->
    <div v-else-if="isFileMessage" class="file-message">
      <div class="file-container row items-center q-gutter-sm q-pa-sm">
        <q-icon :name="getFileIcon()" size="1.5rem" color="primary" />
        <div class="file-info">
          <div class="file-name text-weight-medium">{{ fileName }}</div>
          <div v-if="fileSize" class="file-size text-caption">{{ formatFileSize(fileSize) }}</div>
        </div>
        <div class="file-actions row">
          <q-btn
            v-if="fileUrl && canPreviewFile()"
            icon="fas fa-eye"
            size="sm"
            flat
            round
            @click="previewFile"
            title="Preview file"
            class="q-mr-xs"
          />
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

    <!-- Redacted/Deleted Messages -->
    <div v-else-if="isRedactedMessage" class="redacted-message">
      <div class="text-caption text-grey-6">
        <q-icon name="fas fa-trash" class="q-mr-xs" />
        Message deleted
      </div>
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
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { type MatrixEvent } from 'matrix-js-sdk'
import { matrixClientService } from '../../services/matrixClientService'
import { logger } from '../../utils/logger'

interface EncryptedFile {
  url: string
  key: {
    alg: string
    ext: boolean
    k: string
    key_ops: string[]
    kty: string
  }
  iv: string
  hashes: {
    sha256: string
  }
  v: string
}

interface MediaInfo {
  mimetype?: string
  size?: number
  w?: number
  h?: number
}

interface MessageContent {
  url?: string
  file?: EncryptedFile
  msgtype?: string
  body?: string
  filename?: string
  info?: MediaInfo
  mimetype?: string
  [key: string]: unknown
}

/**
 * Decrypt an encrypted file attachment following Element Web's approach
 */
async function decryptEncryptedFile (file: EncryptedFile, info?: MediaInfo): Promise<Blob> {
  if (!file || !file.url) {
    throw new Error('No encrypted file information provided')
  }

  // Import encrypt function dynamically
  const encrypt = await import('matrix-encrypt-attachment')

  // Download the encrypted file as an array buffer
  let responseData: ArrayBuffer
  try {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('Matrix client not available')

    const response = await fetch(matrixClientService.getContentUrl(file.url), {
      headers: {
        Authorization: `Bearer ${client.getAccessToken()}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to download encrypted file: ${response.status} ${response.statusText}`)
    }

    responseData = await response.arrayBuffer()
  } catch (e) {
    throw new Error(`Download error: ${(e as Error).message}`)
  }

  // Decrypt the array buffer using the information from the file
  try {
    const dataArray = await encrypt.decryptAttachment(responseData, file)

    // Get MIME type, defaulting to safe type
    let mimetype = info?.mimetype ? info.mimetype.split(';')[0].trim() : ''
    if (!mimetype || mimetype.includes('script') || mimetype.includes('html')) {
      mimetype = 'application/octet-stream'
    }

    return new Blob([dataArray], { type: mimetype })
  } catch (e) {
    throw new Error(`Decryption error: ${(e as Error).message}`)
  }
}

interface Props {
  mxEvent: MatrixEvent
  content: MessageContent
  msgtype?: string
}

const props = defineProps<Props>()

// Message type detection following Element Web patterns
const isTextMessage = computed(() => {
  return props.msgtype === 'm.text'
})
const isImageMessage = computed(() => {
  return props.msgtype === 'm.image'
})
const isFileMessage = computed(() => {
  return props.msgtype === 'm.file'
})
const isAudioMessage = computed(() => props.msgtype === 'm.audio')
const isVideoMessage = computed(() => props.msgtype === 'm.video')
const isEmoteMessage = computed(() => props.msgtype === 'm.emote')
const isNoticeMessage = computed(() => props.msgtype === 'm.notice')
const isRedactedMessage = computed(() => {
  return props.mxEvent.isRedacted()
})

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
  // Check different possible URL properties used by different Matrix clients
  const url = props.content.url || props.content.file?.url
  if (!url) return null
  return matrixClientService.getContentUrl(url)
})

// Media URLs (images, audio, video)
const imageUrl = ref<string | null>(null)
const imageLoading = ref(false)

// Load authenticated image
const loadImage = async () => {
  // Check different possible URL properties used by different Matrix clients
  const url = props.content.url || props.content.file?.url
  const isEncrypted = !!props.content.file

  if (!url || imageLoading.value) return

  imageLoading.value = true
  try {
    const client = matrixClientService.getClient()
    if (!client) return

    if (isEncrypted) {
      // Handle encrypted files - use Element Web's approach
      try {
        // Use Element Web's decryptFile approach
        const blob = await decryptEncryptedFile(props.content.file, props.content.info)
        imageUrl.value = URL.createObjectURL(blob)
        return
      } catch (encryptedError) {
        logger.error('Failed to load encrypted image:', {
          eventId: props.mxEvent.getId(),
          error: encryptedError.message
        })
        // Fall through to try regular thumbnail approach
      }
    }

    // Handle unencrypted files - use thumbnail endpoint
    const thumbnailUrl = matrixClientService.getContentUrl(url, 400, 300)

    const response = await fetch(thumbnailUrl, {
      headers: {
        Authorization: `Bearer ${client.getAccessToken()}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error')
      logger.error('Failed to fetch image thumbnail:', {
        eventId: props.mxEvent.getId(),
        status: response.status,
        statusText: response.statusText,
        thumbnailUrl,
        error: errorText
      })
      return
    }

    // Create blob URL for inline display
    const blob = await response.blob()
    imageUrl.value = URL.createObjectURL(blob)
  } catch (error) {
    logger.error('Error loading image:', { eventId: props.mxEvent.getId(), error })
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
  const url = props.content.url || props.content.file?.url
  if (!url) return

  try {
    const client = matrixClientService.getClient()
    if (!client) return

    let blob: Blob

    if (props.content.file) {
      // Handle encrypted file

      // Import encrypt function dynamically
      const encrypt = await import('matrix-encrypt-attachment')

      // Download the encrypted file as an array buffer
      const fileUrl = matrixClientService.getContentUrl(url)
      const response = await fetch(fileUrl, {
        headers: {
          Authorization: `Bearer ${client.getAccessToken()}`
        }
      })

      if (!response.ok) {
        logger.error('Failed to fetch encrypted file:', { status: response.status, statusText: response.statusText })
        return
      }

      const responseData = await response.arrayBuffer()

      // Decrypt the array buffer
      const dataArray = await encrypt.decryptAttachment(responseData, props.content.file)

      // Get MIME type, defaulting to safe type
      let mimetype = props.content.info?.mimetype ? props.content.info.mimetype.split(';')[0].trim() : ''
      if (!mimetype || mimetype.includes('script') || mimetype.includes('html')) {
        mimetype = 'application/octet-stream'
      }

      blob = new Blob([dataArray], { type: mimetype })
    } else {
      // Handle unencrypted file

      const fileUrl = matrixClientService.getContentUrl(url)
      const response = await fetch(fileUrl, {
        headers: {
          Authorization: `Bearer ${client.getAccessToken()}`
        }
      })

      if (!response.ok) {
        logger.error('Failed to fetch file:', { status: response.status, statusText: response.statusText })
        return
      }

      blob = await response.blob()
    }

    // Create blob URL and download
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
    logger.error('Error downloading file:', error)
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
          Authorization: `Bearer ${client.getAccessToken()}`
        }
      })

      if (!response.ok) {
        logger.error('Failed to fetch image:', { status: response.status, statusText: response.statusText })
        return
      }

      // Create blob URL and open in new tab
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, '_blank')

      // Clean up blob URL after a delay
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl)
      }, 10000)
    } catch (error) {
      logger.error('Error viewing image:', error)
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

const getFileIcon = (): string => {
  const mimeType = props.content.info?.mimetype || ''
  const filename = fileName.value.toLowerCase()

  // Image files
  if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/.test(filename)) {
    return 'fas fa-image'
  }

  // Document files
  if (mimeType.includes('pdf') || filename.endsWith('.pdf')) {
    return 'fas fa-file-pdf'
  }

  if (mimeType.includes('word') || /\.(doc|docx)$/.test(filename)) {
    return 'fas fa-file-word'
  }

  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || /\.(xls|xlsx)$/.test(filename)) {
    return 'fas fa-file-excel'
  }

  if (mimeType.includes('powerpoint') || mimeType.includes('presentation') || /\.(ppt|pptx)$/.test(filename)) {
    return 'fas fa-file-powerpoint'
  }

  // Archive files
  if (mimeType.includes('zip') || mimeType.includes('rar') || /\.(zip|rar|7z|tar|gz)$/.test(filename)) {
    return 'fas fa-file-archive'
  }

  // Audio files
  if (mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/.test(filename)) {
    return 'fas fa-file-audio'
  }

  // Video files
  if (mimeType.startsWith('video/') || /\.(mp4|avi|mov|wmv|webm|mkv)$/.test(filename)) {
    return 'fas fa-file-video'
  }

  // Text files
  if (mimeType.startsWith('text/') || /\.(txt|md|json|xml|html|css|js|ts)$/.test(filename)) {
    return 'fas fa-file-alt'
  }

  // Default file icon
  return 'fas fa-file'
}

const canPreviewFile = (): boolean => {
  const mimeType = props.content.info?.mimetype || ''
  const filename = fileName.value.toLowerCase()

  // Can preview images, PDFs, and text files
  return mimeType.startsWith('image/') ||
         mimeType.includes('pdf') ||
         mimeType.startsWith('text/') ||
         /\.(jpg|jpeg|png|gif|webp|svg|pdf|txt|md|json|xml|html)$/.test(filename)
}

const previewFile = async () => {
  if (props.content.url) {
    try {
      // Get the authenticated URL
      const previewUrl = matrixClientService.getContentUrl(props.content.url)

      // Fetch with authentication headers
      const client = matrixClientService.getClient()
      if (!client) return

      const response = await fetch(previewUrl, {
        headers: {
          Authorization: `Bearer ${client.getAccessToken()}`
        }
      })

      if (!response.ok) {
        logger.error('Failed to fetch file for preview:', { status: response.status, statusText: response.statusText })
        return
      }

      // Create blob URL and open in new tab
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, '_blank')

      // Clean up blob URL after a delay
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl)
      }, 10000)
    } catch (error) {
      logger.error('Error previewing file:', error)
    }
  }
}

// Lifecycle hooks
onMounted(() => {
  const url = props.content.url || props.content.file?.url
  if (isImageMessage.value && url) {
    loadImage()
  }
})

// Watch for content changes (when messages get decrypted)
watch([() => props.content, isImageMessage], ([newContent, newIsImage]) => {
  const url = newContent.url || newContent.file?.url

  if (newIsImage && url && !imageUrl.value && !imageLoading.value) {
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
  min-width: 200px;
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

.file-actions {
  flex-shrink: 0;
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

.redacted-message {
  padding: 0.5rem;
  background: rgba(158, 158, 158, 0.1);
  border-radius: 4px;
  border-left: 3px solid #9e9e9e;
  font-style: italic;
  opacity: 0.8;
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

  .redacted-message {
    background: rgba(158, 158, 158, 0.2);
    border-color: #757575;
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
