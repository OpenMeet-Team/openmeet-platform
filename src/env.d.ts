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
  APP_POSTHOG_KEY?: string
  APP_POSTHOG_COOKIE_DOMAIN?: string
  // SEO: set to false in prod to allow indexing (blocks by default)
  APP_NOINDEX?: boolean
  // Valid domains for deep links (OAuth callbacks in native apps)
  // Matches domain exactly or as suffix (e.g., "openmeet.net" matches "platform.openmeet.net")
  APP_VALID_DEEP_LINK_DOMAINS?: string[]
  // Custom URL scheme for mobile OAuth callbacks (e.g., "net.openmeet.platform")
  // Must match the scheme registered in AndroidManifest.xml and iOS Info.plist
  APP_CUSTOM_URL_SCHEME?: string
  [key: string]: string | string[] | boolean | undefined
}

// Global window extensions for Matrix integration
interface Window {
  __MATRIX_API_URL__?: string
  APP_CONFIG?: AppConfig
}
