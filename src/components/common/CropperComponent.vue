<template>
  <Cropper
    ref="cropper"
    :src="imageSrc"
    @change="onChange"
    :stencil-props="options"
  style="width: 100%; height: 300px;"
  />
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { Cropper, CropperResult } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'

const props = defineProps({
  src: {
    type: String,
    required: true
  },
  options: {
    type: Object,
    required: false,
    default: () => ({
      autoZoom: true
    })
  }
})

const emit = defineEmits(['change'])

const imageSrc = ref<string>(props.src)
const cropper = ref<InstanceType<typeof Cropper> | null>(null)

const onChange = (result: CropperResult) => {
  emit('change', result.canvas?.toDataURL() || null)
}
</script>

<style scoped>

</style>
