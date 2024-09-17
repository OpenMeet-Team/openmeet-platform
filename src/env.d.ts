declare namespace NodeJS {
  interface ProcessEnv {
    APP_API_URL: string | undefined
    DEV_SERVER_OPEN: boolean | undefined
    DEV_SERVER_PORT: number | undefined
    APP_TENANT_ID: string
  }
}
