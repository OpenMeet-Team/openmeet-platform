<template>
  <q-page padding>
    <div class="row justify-center">
      <div class="col-12 col-md-8 col-lg-6">
        <q-card flat>
          <q-card-section>
            <h1 class="text-h4 q-mb-md">Privacy Policy</h1>
            <p class="text-caption text-grey q-mb-lg">Last updated: February 7, 2026</p>

            <div class="privacy-content">
              <h2 class="text-h6 q-mt-lg q-mb-sm">1. Purpose</h2>
              <p>This Privacy Policy outlines how OpenMeet collects, uses, and protects your personal data while using the platform. It also explains how we incorporate in-product marketing features to enhance user experience while prioritizing your privacy.</p>

              <h2 class="text-h6 q-mt-lg q-mb-sm">2. Data Collection</h2>
              <p>OpenMeet collects the following types of data:</p>
              <ul>
                <li><strong>Personal Information</strong>: Information you provide during account registration, such as name, email, and organization.</li>
                <li><strong>Usage Data</strong>: Data about your interactions with the platform, such as the pages you visit, groups you join, and events you attend.</li>
                <li><strong>Device Information</strong>: Information about the device and browser you use to access OpenMeet.</li>
              </ul>

              <h2 class="text-h6 q-mt-lg q-mb-sm">3. Use of Data</h2>
              <p>OpenMeet uses the data we collect for the following purposes:</p>
              <ul>
                <li>To provide and improve the platform and its features.</li>
                <li>To personalize your experience by suggesting groups or events based on your interests.</li>
                <li>To communicate with you regarding platform updates, events, or features.</li>
                <li>To enhance the visibility of user communities through in-product marketing features, such as group or event promotions.</li>
              </ul>

              <h2 class="text-h6 q-mt-lg q-mb-sm">4. In-Product Marketing</h2>
              <p>OpenMeet provides internal marketing tools to help users promote their content:</p>
              <ul>
                <li><strong>Boosting and Search Ranking</strong>: Users can increase the visibility of their content within the platform without the need for external advertising.</li>
                <li><strong>Targeted Promotions</strong>: We use interest-based data to suggest relevant groups or events. However, no data is shared with third parties. Participation in these marketing features is optional, and users can opt in or out at any time.</li>
              </ul>

              <h2 class="text-h6 q-mt-lg q-mb-sm">5. Analytics</h2>
              <p>OpenMeet uses <a href="https://posthog.com" target="_blank" rel="noopener">PostHog</a>, a product analytics platform, to understand how our platform is used and to improve the experience for our users. PostHog collects usage data such as pages visited, features used, and general interaction patterns. This data is sent to PostHog's US-based cloud infrastructure.</p>
              <ul>
                <li><strong>What is collected</strong>: Pageviews, feature usage, session data, and device/browser information. We do not track keystrokes or form input contents.</li>
                <li><strong>Identified users</strong>: If you are logged in, analytics events are associated with your account to help us understand user journeys.</li>
                <li><strong>Opt-out</strong>: You can opt out of analytics at any time in your <router-link to="/dashboard/profile">profile settings</router-link> under "Privacy &amp; Analytics." Opting out sets a cookie that applies across all OpenMeet sites.</li>
                <li><strong>No advertising</strong>: Analytics data is used solely to improve OpenMeet. We do not use it for advertising or share it with advertisers.</li>
              </ul>

              <h2 class="text-h6 q-mt-lg q-mb-sm">6. Data Sharing</h2>
              <ul>
                <li>OpenMeet does not sell or share your personal data with third parties for advertising purposes.</li>
                <li>We share limited data with trusted service providers who assist us in running the platform (such as PostHog for analytics and AWS for hosting), under strict confidentiality agreements.</li>
              </ul>

              <h2 class="text-h6 q-mt-lg q-mb-sm">7. Data Control</h2>
              <p>You maintain control of your data and can access, update, or delete your data at any time through your account settings. OpenMeet complies with GDPR, CCPA, and other data privacy regulations, providing transparency and ensuring your rights are protected.</p>

              <h2 class="text-h6 q-mt-lg q-mb-sm">8. Data Security</h2>
              <p>OpenMeet takes the following steps to ensure the security of your data:</p>
              <ul>
                <li><strong>Encryption</strong>: All data is encrypted both at rest and in transit.</li>
                <li><strong>Access Control</strong>: Only authorized personnel have access to sensitive data.</li>
                <li><strong>Regular Security Audits</strong>: We conduct regular security audits and updates to maintain the safety and integrity of the platform.</li>
              </ul>

              <h2 class="text-h6 q-mt-lg q-mb-sm">9. User Control and Transparency</h2>
              <p>Users have full control over their data and can opt in or out of marketing and analytics features:</p>
              <ul>
                <li><strong>Analytics Opt-out</strong>: You can disable analytics tracking at any time via the privacy banner or your <router-link to="/dashboard/profile">profile settings</router-link>.</li>
                <li><strong>Opt-in Features</strong>: Users can choose to participate in promotional activities and adjust their settings at any time.</li>
                <li><strong>Data Export and Deletion</strong>: Users can download their data or request its deletion via their account settings.</li>
              </ul>

              <h2 class="text-h6 q-mt-lg q-mb-sm">10. Updates to the Policy</h2>
              <p>OpenMeet may update this Privacy Policy from time to time to reflect changes in our platform or data practices. Significant updates will be communicated to users via email or in-app notifications.</p>

              <h2 class="text-h6 q-mt-lg q-mb-sm">11. Contact Information</h2>
              <p>For questions or concerns about this Privacy Policy, please contact us at <a href="mailto:support@openmeet.net">support@openmeet.net</a>.</p>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { useMeta } from 'quasar'

useMeta({
  title: 'Privacy Policy - OpenMeet',
  meta: {
    description: {
      name: 'description',
      content: 'OpenMeet Privacy Policy - Learn how we collect, use, and protect your personal data'
    }
  }
})
</script>

<style scoped>
.privacy-content {
  line-height: 1.6;
}

.privacy-content ul {
  margin-left: 20px;
  margin-bottom: 16px;
}

.privacy-content li {
  margin-bottom: 8px;
}
</style>
