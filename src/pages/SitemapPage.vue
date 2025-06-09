<template>
  <div></div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { api } from '../boot/axios'

// This component acts as a proxy to fetch and serve the sitemap
onMounted(async () => {
  try {
    // Get tenant ID from global config or localStorage
    const tenantId = window.APP_CONFIG?.APP_TENANT_ID || 
                     localStorage.getItem('tenantId')
    
    if (!tenantId) {
      throw new Error('No tenant ID available')
    }
    
    // Get sitemap XML from API
    const response = await api.get('/api/sitemap/sitemap.xml', {
      params: {
        tenantId: tenantId
      },
      headers: {
        'Accept': 'application/xml'
      },
      responseType: 'text'
    })

    // Create a new XML document
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(response.data, 'application/xml')
    
    // Serialize back to string to ensure it's valid XML
    const serializer = new XMLSerializer()
    const xmlString = serializer.serializeToString(xmlDoc)
    
    // Create a blob with proper MIME type
    const blob = new Blob([xmlString], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    
    // Replace current page with the XML content
    window.location.replace(url)
    
  } catch (error) {
    console.error('Error fetching sitemap:', error)
    // Let the API handle errors - no fallback
  }
})
</script>