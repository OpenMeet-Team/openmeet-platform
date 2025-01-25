<template>
  <!-- HeroHomeComponent -->
  <div class="col-12 q-mb-xl">
    <div class="hero-container">
      <img src="../../assets/openmeet/home/loops-min.png" alt="" class="background-loops">
      <div class="floating-profiles">
        <div class="bubble-wrapper-left bubble-left">
          <q-avatar class="profile-left">
            <img src="../../assets/openmeet/home/young-woman1-min.png" alt="Profile 1">
          </q-avatar>
        </div>
        <div class="bubble-wrapper-right bubble-right">
          <q-avatar class="profile-right">
            <img src="../../assets/openmeet/home/older-gentleman-min.png" alt="Profile 2">
          </q-avatar>
        </div>
      </div>
      <div class="hero-content text-center">
        <h1 class="text-h3 q-mb-md text-white">Welcome to OpenMeet</h1>
        <p class="text-h6 text-white">Connect, Share, and Grow with Like-minded People</p>
        <q-btn
          rounded
          color="purple-300"
          label="Join Now"
          @click="onJoinNowClick"
          class="q-mt-md"
          size="lg"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthDialog } from '../../composables/useAuthDialog'

const { openLoginDialog } = useAuthDialog()

const onJoinNowClick = () => {
  openLoginDialog()
}
</script>

<style lang="scss" scoped>
@use 'sass:map';

.hero-container {
  position: relative;
  background-color: $purple-600;
  background: radial-gradient(circle at center, $purple-500 0%, $purple-600 70%);

  border-radius: 16px;
  padding: 48px;
  overflow: hidden;
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.background-loops {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
}

.bubble-wrapper-left {
  position: absolute;
  width: 160px;
  height: 160px;
  border-radius: 500px 500px 500px 0px;
  z-index: 2;
}

.bubble-wrapper-right {
  position: absolute;
  width: 160px;
  height: 160px;
  border-radius: 500px 500px 0px 500px;
  z-index: 2;
}
.bubble-left {
  left: 48px;
  bottom: 10px;
  background-color: $blue;
}

.profile-left {
  position: absolute;
  left: 0px;
  bottom: 0px;
  width: 160px;
  height: 160px;
  z-index: 2;
  :deep(.q-avatar__content) {
    border-radius: 500px 500px 500px 0px; /* Make images square instead of round */
  }
}

.bubble-right {
  right: 48px;
  top: 10px;
  background-color: $pink;
}

.profile-right {
  position: absolute;
  right: 0px;
  top: 0px;
  width: 160px;
  height: 160px;
  z-index: 3;
  :deep(.q-avatar__content) {
    border-radius: 500px 500px 0px 500px; /* Make images square instead of round */
  }
}

.hero-content {
  position: relative;
  z-index: 1;
  text-align: center;
  width: 100%;
}

:deep(.q-btn) {
  text-transform: uppercase;
  font-weight: 600;
  color: white;
  background: linear-gradient(to right, $purple-400, $purple-200);
}

</style>
