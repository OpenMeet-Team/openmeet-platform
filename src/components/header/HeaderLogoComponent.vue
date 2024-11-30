<script setup lang="ts">

</script>

<template>
  <q-toolbar-title class="c-header-logo-component row no-wrap items-center" data-cy="header-logo-component">
    <router-link style="color: inherit; text-decoration: none" to="/" class="inline row no-wrap items-center router-link-inherit">
      <q-img class="q-mr-xs" left src="~assets/openmeet/logo.svg" style="height: 35px; width: 35px" />
      <div class="text-bold gt-sm">OpenMeet</div>
    </router-link>
  </q-toolbar-title>
</template>

<style scoped lang="scss">
.q-toolbar__title {
  flex: none;
}
</style>
