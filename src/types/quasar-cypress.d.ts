declare module '@quasar/quasar-app-extension-testing-e2e-cypress/cct-dev-server/index.js' {
  import type { ConfigOptions, DevServerConfig } from 'cypress'
  const devServer: (
    on: ConfigOptions['setupNodeEvents'],
    config: ConfigOptions
  ) => ConfigOptions
  const injectQuasarDevServerConfig: () => DevServerConfig
  export { devServer, injectQuasarDevServerConfig }
}
