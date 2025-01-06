declare module '@quasar/quasar-app-extension-testing-e2e-cypress/cct-dev-server/index.js' {
  const startDevServer: () => Promise<{
    port: number;
    close: () => Promise<void>;
  }>
  export default startDevServer
}
