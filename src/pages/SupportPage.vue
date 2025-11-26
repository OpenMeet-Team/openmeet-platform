<template>
  <q-page padding>
    <div class="row justify-center">
      <div class="col-12 col-md-8 col-lg-6">
        <q-card flat>
          <q-card-section class="text-center">
            <q-icon name="sym_r_favorite" color="pink" size="48px" class="q-mb-md" />
            <h1 class="text-h4 q-mb-md">Support OpenMeet</h1>
            <p class="text-body1 text-grey-8 q-mb-lg">
              We believe everyone deserves meaningful social connection. OpenMeet
              helps people find and participate in interest-based groups and events
              in their communities—without fees or ads. Your support keeps the
              platform free for those who need it most.
            </p>
          </q-card-section>

          <q-separator />

          <q-card-section>
            <div class="text-h6 q-mb-sm">Where Your Money Goes</div>
            <q-list dense>
              <q-item>
                <q-item-section avatar>
                  <q-icon name="sym_r_cloud" color="primary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Cloud Infrastructure</q-item-label>
                  <q-item-label caption>Servers, databases, and keeping the site up</q-item-label>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section avatar>
                  <q-icon name="sym_r_code" color="primary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Development</q-item-label>
                  <q-item-label caption>New features and improvements</q-item-label>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section avatar>
                  <q-icon name="sym_r_support_agent" color="primary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Support</q-item-label>
                  <q-item-label caption>Helping communities succeed</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>

          <q-separator />

          <q-card-section class="text-center">
            <p class="text-body2 text-grey-6 q-mb-md">
              Choose your amount in $5 increments on the next page.
            </p>
            <q-btn
              v-if="supportUrl"
              color="primary"
              size="lg"
              label="Continue to Payment"
              icon-right="sym_r_arrow_forward"
              @click="openPayment"
              unelevated
            />
            <p class="text-caption text-grey q-mt-lg">
              Secure payment powered by Stripe.<br>
              OpenMeet is an LLC. Contributions are not tax-deductible.
            </p>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMeta } from 'quasar'

useMeta({
  title: 'Support OpenMeet',
  meta: {
    description: {
      name: 'description',
      content: 'Support OpenMeet - Help keep the platform free for communities everywhere'
    }
  }
})

const supportUrl = computed(() => window.APP_CONFIG?.APP_SUPPORT_URL)

const openPayment = () => {
  if (supportUrl.value) {
    window.open(supportUrl.value, '_blank')
  }
}
</script>
