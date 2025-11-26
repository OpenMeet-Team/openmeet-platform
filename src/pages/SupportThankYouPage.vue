<template>
  <q-page padding>
    <div class="row justify-center">
      <div class="col-12 col-md-8 col-lg-6">
        <q-card flat class="text-center q-pa-lg">
          <q-card-section>
            <q-icon name="favorite" color="pink" size="64px" class="q-mb-md" />
            <h1 class="text-h4 q-mb-md">Thank You for Supporting OpenMeet!</h1>
            <p class="text-body1 text-grey-8 q-mb-lg">
              Your contribution helps keep OpenMeet free for communities everywhere.
              We truly appreciate your support.
            </p>
            <p class="text-body2 text-grey-6 q-mb-xl">
              A receipt has been sent to your email address.
            </p>
            <div class="q-gutter-md">
              <q-btn
                color="primary"
                label="Return Home"
                @click="navigateTo('/')"
                unelevated
              />
              <q-btn
                outline
                color="primary"
                label="Explore Groups"
                @click="navigateTo('/groups')"
              />
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { useMeta } from 'quasar'
import { useRouter } from 'vue-router'

const router = useRouter()

useMeta({
  title: 'Thank You - OpenMeet',
  meta: {
    description: {
      name: 'description',
      content: 'Thank you for supporting OpenMeet'
    }
  }
})

const navigateTo = (route: string) => {
  router.push(route)
}
</script>
