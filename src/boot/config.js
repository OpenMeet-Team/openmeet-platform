export default async ({ app }) => {
  const config = {
    // Build-time values
    APP_TENANT_ID: process.env.APP_TENANT_ID,
    APP_HUBSPOT_PORTAL_ID: process.env.APP_HUBSPOT_PORTAL_ID,
    APP_HUBSPOT_FORM_ID: process.env.APP_HUBSPOT_FORM_ID,

    // Runtime values
    APP_API_URL: window.APP_CONFIG?.APP_API_URL || process.env.APP_API_URL,
    NODE_ENV: window.APP_CONFIG?.NODE_ENV || process.env.NODE_ENV
  }

  app.config.globalProperties.$config = config
}
