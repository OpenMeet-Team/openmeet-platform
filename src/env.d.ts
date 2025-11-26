declare namespace NodeJS {
  interface ProcessEnv {
    APP_API_URL: string | undefined
    APP_DEV_SERVER_OPEN: string | undefined
    APP_DEV_SERVER_PORT: string | undefined
    APP_TENANT_ID: string
    APP_HUBSPOT_FORM_ID: string
    APP_HUBSPOT_PORTAL_ID: string
    APP_GOOGLE_CLIENT_ID: string
    APP_GITHUB_CLIENT_ID: string
    APP_VERSION: string
  }
}

interface AppConfig {
  APP_API_URL?: string
  APP_TENANT_ID?: string
  APP_VERSION?: string
  APP_GOOGLE_CLIENT_ID?: string
  APP_GITHUB_CLIENT_ID?: string
  APP_SUPPORT_URL?: string
  [key: string]: string | undefined
}

// Global window extensions for Matrix integration
interface Window {
  __MATRIX_API_URL__?: string
  APP_CONFIG?: AppConfig
}
