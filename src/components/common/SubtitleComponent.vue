<script setup lang="ts">
import { RouteLocationRaw } from 'vue-router'
interface SubtitleProps {
  label: string
  count?: number
  to?: RouteLocationRaw
  hideLink?: boolean
  linkText?: string
}

withDefaults(defineProps<SubtitleProps>(), {
  hideLink: false,
  linkText: 'See all'
})

const emit = defineEmits(['click'])
</script>

<template>
  <div class="text-h6 text-bold row justify-between items-center q-mb-sm">
    <div>{{ label }}<span class="q-ml-sm" v-if="count">({{ count }})</span></div>
    <router-link v-if="!hideLink" class="router-link-inherit" :to="to || {}" @click="!to && emit('click')">
      <slot>{{ linkText }}</slot>
    </router-link>
  </div>
</template>

<style scoped lang="scss">

</style>
