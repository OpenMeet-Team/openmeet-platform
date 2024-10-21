<script setup lang="ts">

interface Props {
  icon?: string
  buttonLabel?: string
  label?: string
  to?: object
}

const props = defineProps<Props>()
const emit = defineEmits(['click'])

</script>

<template>
  <div class="text-center q-pa-md">
    <q-icon v-if="icon" :name="icon" size="4em" color="grey-5"/>
    <p class="text-h6 text-grey-6 q-mt-sm">{{ label }}</p>
    <q-btn v-if="buttonLabel" flat color="primary" no-caps :label="buttonLabel" v-bind="props.to ? { to: props.to } : {}" @click="!props.to && emit('click')" class="q-mt-md"/>
  </div>
</template>

<style scoped lang="scss">

</style>
