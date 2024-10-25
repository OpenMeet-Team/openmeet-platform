export default async ({ app }) => {
  app.config.globalProperties.$config = window.APP_CONFIG
}
