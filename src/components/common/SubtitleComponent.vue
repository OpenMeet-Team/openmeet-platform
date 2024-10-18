<script setup lang="ts">

interface SubtitleProps {
  label: string
  count?: number
  to?: object
}

const props = defineProps<SubtitleProps>()
const emit = defineEmits(['click'])
</script>

<template>
  <div class="text-h6 text-bold row justify-between items-center q-mb-sm">
    <div>{{ label }}<span class="q-ml-sm" v-if="count">({{ count }})</span></div>
    <q-btn v-if="count" padding="none xs" no-caps flat label="See all" v-bind="props.to ? { to: props.to } : {}" @click="!props.to && emit('click')">
      <slot></slot>
    </q-btn>
  </div>
</template>

<style scoped lang="scss">

</style>
