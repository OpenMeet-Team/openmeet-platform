<template>
  <div>
    <q-file
      filled
      :required="required"
      :model-value="null"
      :label="label"
      accept="image/*"
      @update:model-value="onUpload"
      data-cy="upload-component"
    >
      <template v-slot:prepend>
        <q-icon name="sym_r_attach_file" />
      </template>
    </q-file>

    <!-- Loading indicator -->
    <q-spinner v-if="loading" color="primary" size="50px" class="q-mt-md" />

    <!-- Cropper Dialog -->
    <q-dialog data-cy="cropper-dialog" v-model="showCropperDialog" persistent style="max-width: 500px">
      <q-card class="full-width">
        <q-card-section>
          <div class="row items-center justify-between q-mb-xl">
            <div class="text-h5 text-bold q-my-none">Crop Image</div>
          </div>
        </q-card-section>
        <q-card-section>
          <CropperComponent v-if="imageSrc" :src="imageSrc" @change="onCropChange" :options="cropOptions"/>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn no-caps flat label="Cancel" @click="cancelCrop" />
          <q-btn data-cy="cropper-confirm" no-caps label="Confirm" color="primary" @click="confirmCrop" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { apiUploadFileToS3 } from '../../api/files'
import { useNotification } from '../../composables/useNotification'
import CropperComponent from '../../components/common/CropperComponent.vue'

interface CropOptions {
  aspectRatio?: number // e.g., 16/9 for widescreen
  minWidth?: number
  minHeight?: number
  autoZoom?: boolean
  resizable?: boolean
}

interface Props {
  label?: string
  required?: boolean
  cropOptions?: CropOptions
}

const props = withDefaults(defineProps<Props>(), {})

const { error } = useNotification()

const emits = defineEmits(['upload'])

// Reactive variables
const loading = ref(false)
const showCropperDialog = ref(false)
const imageSrc = ref<string | null>(null)
const croppedImage = ref<string | null>(null)
const selectedFile = ref<File | null>(null)

// Show cropper dialog if cropOptions are provided, else upload immediately
const onUpload = (file: File) => {
  if (!file) return

  selectedFile.value = file

  if (props.cropOptions && Object.keys(props.cropOptions).length > 0) {
    // Show cropper dialog if options are provided
    imageSrc.value = URL.createObjectURL(file)
    showCropperDialog.value = true
  } else {
    // Upload the file directly if no cropOptions are provided
    uploadFile(file)
  }
}

// Handle crop change and get cropped image as base64
const onCropChange = (result: string) => {
  croppedImage.value = result
}

// Cancel cropping and reset
const cancelCrop = () => {
  showCropperDialog.value = false
  imageSrc.value = null
  croppedImage.value = null
}

// Confirm crop and upload the cropped image
const confirmCrop = () => {
  if (croppedImage.value) {
    const blob = dataURLtoFile(croppedImage.value, selectedFile.value!.name)
    uploadFile(blob)
  } else if (selectedFile.value) {
    uploadFile(selectedFile.value)
  }

  showCropperDialog.value = false
  croppedImage.value = null
  imageSrc.value = null
}

// Upload file to S3
const uploadFile = (file: File | Blob) => {
  loading.value = true

  apiUploadFileToS3(file as File)
    .then((response) => {
      emits('upload', response)
    })
    .catch((err) => {
      console.error('Upload error:', err.message)
      error(err.message)
    })
    .finally(() => {
      loading.value = false
    })
}

// Helper function to convert base64 data to File object
const dataURLtoFile = (dataurl: string, filename: string): File => {
  const arr = dataurl.split(',')
  const mime = arr[0].match(/:(.*?);/)![1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }

  return new File([u8arr], filename, { type: mime })
}
</script>

<style scoped>
/* Add any additional styling here */
</style>
