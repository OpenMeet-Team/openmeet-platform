<script setup lang="ts">

import ZulipChatComponent from 'components/ZulipChatComponent.vue'
</script>

<template>
  <q-page padding>
    Chat here
    <ZulipChatComponent api-key="tms2szYlkBwYpesbweKxXfEbtjNDid88" zulip-api-url="https://khatko.zulipchat.com/api/v1" topic="greetings" stream-name="general" email="test-bot@khatko.zulipchat.com"/>
<!--    <iframe src="https://khatko.zulipchat.com" style="width:100%; height:600px;"></iframe>-->
<!--    <iframe src="https://chat.zulip.org" style="width:100%; height:600px;"></iframe>-->
  </q-page>
</template>

<style scoped lang="scss">

</style>
