<template>
  <q-page padding>
    <div class="row justify-center">
      <div class="col-12 col-md-8 col-lg-6">
        <q-card flat>
          <q-card-section>
            <h1 class="text-h4 q-mb-md">Terms and Conditions</h1>
            <p class="text-caption text-grey q-mb-lg">Last updated: September 15, 2024</p>
            <p class="q-mb-lg">Please read these terms and conditions carefully before using Our Service.</p>

            <div class="terms-content">
              <h2 class="text-h6 q-mt-lg q-mb-sm">1. Introduction</h2>
              <p>Welcome to OpenMeet! These Terms of Service govern your use of the OpenMeet platform. By accessing or using OpenMeet, you agree to be bound by these terms. If you do not agree with any part of these terms, please do not use the platform.</p>

              <h2 class="text-h6 q-mt-lg q-mb-sm">2. Definitions</h2>
              <ul>
                <li><strong>Platform</strong> refers to OpenMeet, including all features, tools, and services provided.</li>
                <li><strong>User</strong> refers to anyone using the platform, including individuals, groups, organizations, and administrators.</li>
                <li><strong>Content</strong> refers to any text, images, video, audio, or other material uploaded or shared by users.</li>
              </ul>

              <h2 class="text-h6 q-mt-lg q-mb-sm">3. Account Registration and Security</h2>
              <ul>
                <li>You must provide accurate and complete information when creating an account.</li>
                <li>You are responsible for safeguarding your account credentials and ensuring the security of your account. You must notify OpenMeet immediately of any unauthorized use of your account.</li>
              </ul>

              <h2 class="text-h6 q-mt-lg q-mb-sm">4. Use of the Platform</h2>
              <ul>
                <li>You agree to use the platform in accordance with all applicable laws and these Terms of Service.</li>
                <li>You may not use OpenMeet for illegal or harmful activities, including but not limited to harassment, hate speech, or the promotion of illegal content.</li>
              </ul>

              <h2 class="text-h6 q-mt-lg q-mb-sm">5. User-Generated Content</h2>
              <ul>
                <li>You retain ownership of any content you post on the platform. However, by posting content, you grant OpenMeet a non-exclusive, worldwide, royalty-free license to use, distribute, and display your content within the platform.</li>
                <li>You are responsible for ensuring that the content you post does not violate the rights of any third party.</li>
              </ul>

              <h2 class="text-h6 q-mt-lg q-mb-sm">6. In-Product Marketing and Promotional Features</h2>
              <ul>
                <li>OpenMeet offers in-product marketing tools, such as event promotion and content boosting, to enhance visibility within the platform. These tools are optional, and users retain control over their participation in promotional activities.</li>
                <li>Any data collected for these purposes is governed by our Privacy Policy, which ensures your data is not sold or shared with third parties.</li>
              </ul>

              <h2 class="text-h6 q-mt-lg q-mb-sm">7. Payment and Billing</h2>
              <ul>
                <li>Certain features of OpenMeet may require payment. By choosing to make a purchase, you agree to provide accurate payment information and comply with any applicable payment terms.</li>
                <li>All payments are non-refundable unless otherwise stated.</li>
              </ul>

              <h2 class="text-h6 q-mt-lg q-mb-sm">8. Intellectual Property</h2>
              <ul>
                <li>All trademarks, logos, and service marks displayed on OpenMeet are the property of their respective owners. You may not use them without prior written permission from the owner.</li>
                <li>OpenMeet retains all rights to its software, design, and other intellectual property related to the platform.</li>
              </ul>

              <h2 class="text-h6 q-mt-lg q-mb-sm">9. Termination</h2>
              <ul>
                <li>OpenMeet reserves the right to suspend or terminate your access to the platform at any time, for any reason, including violation of these Terms of Service.</li>
                <li>You may terminate your account at any time by contacting OpenMeet support.</li>
              </ul>

              <h2 class="text-h6 q-mt-lg q-mb-sm">10. Limitation of Liability</h2>
              <p>OpenMeet is provided "as is," without any warranties, express or implied. OpenMeet will not be liable for any damages arising from your use of the platform, including but not limited to direct, indirect, incidental, punitive, or consequential damages.</p>

              <h2 class="text-h6 q-mt-lg q-mb-sm">11. Indemnification</h2>
              <p>You agree to indemnify and hold OpenMeet harmless from any claims, damages, or losses arising from your use of the platform or your violation of these Terms of Service.</p>

              <h2 class="text-h6 q-mt-lg q-mb-sm">12. Changes to Terms</h2>
              <p>OpenMeet may update these terms from time to time. You will be notified of significant changes, and continued use of the platform constitutes acceptance of the revised terms.</p>

              <h2 class="text-h6 q-mt-lg q-mb-sm">13. Contact Information</h2>
              <p>For any questions about these terms, please contact us at: <a href="mailto:support@openmeet.net">support@openmeet.net</a>.</p>
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
  title: 'Terms of Service - OpenMeet',
  meta: {
    description: {
      name: 'description',
      content: 'OpenMeet Terms of Service - Terms and conditions for using the OpenMeet platform'
    }
  }
})
</script>

<style scoped>
.terms-content {
  line-height: 1.6;
}

.terms-content ul {
  margin-left: 20px;
  margin-bottom: 16px;
}

.terms-content li {
  margin-bottom: 8px;
}
</style>
