/* eslint-disable */

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: string;
    VUE_ROUTER_MODE: 'hash' | 'history' | 'abstract' | undefined;
    VUE_ROUTER_BASE: string | undefined;
    APP_API_URL: string | undefined
    DEV_SERVER_OPEN: boolean | false
    DEV_SERVER_PORT: number | undefined
  }
}
