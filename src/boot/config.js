export default async ({ app }) => {
  const config = {
    // Build-time values
    APP_HUBSPOT_PORTAL_ID: process.env.APP_HUBSPOT_PORTAL_ID,
    APP_HUBSPOT_FORM_ID: process.env.APP_HUBSPOT_FORM_ID,

    // Runtime values - prioritize window.APP_CONFIG over process.env
    APP_API_URL: window.APP_CONFIG?.APP_API_URL || process.env.APP_API_URL,
    NODE_ENV: window.APP_CONFIG?.NODE_ENV || process.env.NODE_ENV,
    APP_TENANT_ID: window.APP_CONFIG?.APP_TENANT_ID || process.env.APP_TENANT_ID
  }
  app.config.globalProperties.$config = config
  app.provide('config', config)
}
