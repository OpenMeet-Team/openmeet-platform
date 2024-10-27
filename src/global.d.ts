declare global {
    interface Window {
      APP_CONFIG?: {
        APP_API_URL?: string;
        APP_TENANT_ID?: string;
        NODE_ENV?: string;
      APP_POSTHOG_KEY?: string;
    }
  }
}

export {}
