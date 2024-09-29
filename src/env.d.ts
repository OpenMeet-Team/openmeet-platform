declare namespace NodeJS {
  interface ProcessEnv {
    APP_API_URL: string | undefined;
    DEV_SERVER_OPEN: string | undefined
    DEV_SERVER_PORT: string | undefined
    APP_TENANT_ID: string;
  }
}
