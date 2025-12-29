/* eslint-env node */

// Configuration for your app
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-js

import { configure } from 'quasar/wrappers'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'
import istanbul from 'vite-plugin-istanbul'
import { readFileSync } from 'fs'
import { join } from 'path'
import wasm from 'vite-plugin-wasm'

// Helper function to get tenant ID from config
function getTenantId () {
  // First try environment variable
  if (process.env.APP_TENANT_ID) {
    return process.env.APP_TENANT_ID
  }

  // Fallback to reading from config.json
  try {
    const configPath = join(process.cwd(), 'public/config.json')
    const config = JSON.parse(readFileSync(configPath, 'utf8'))
    return config.APP_TENANT_ID
  } catch (error) {
    return null
  }
}

// Helper function to get frontend domain from config
function getFrontendDomain () {
  try {
    const configPath = join(process.cwd(), 'public/config.json')
    const config = JSON.parse(readFileSync(configPath, 'utf8'))
    return config.frontendDomain
  } catch (error) {
    return null
  }
}

export default configure((ctx) => {
  const frontendDomain = getFrontendDomain()

  return {
    // https://v2.quasar.dev/quasar-cli-vite/prefetch-feature
    // preFetch: true,

    // app boot file (/src/boot)
    // --> boot files are part of "main.js"
    // https://v2.quasar.dev/quasar-cli-vite/boot-files
    boot: [
      'config',
      'tracing',
      'axios',
      'auth-session', // Must come after axios since it depends on axios interceptor
      'analytics',
      'global-components',
      'posthog',
      'capacitor'
    ],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#css
    css: [
      'app.scss'
    ],

    // https://github.com/quasarframework/quasar/tree/dev/extras
    extras: [
      // 'ionicons-v4',
      // 'mdi-v7',
      'fontawesome-v6',
      // 'eva-icons',
      // 'themify',
      // 'line-awesome',
      // 'roboto-font-latin-ext', // this or either 'roboto-font', NEVER both!
      // 'roboto-font', // optional, you are not bound to it
      // 'material-icons', // optional, you are not bound to it
      'material-symbols-rounded'
    ],

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#build
    build: {
      sourcemap: true,
      target: {
        browser: ['es2022', 'firefox115', 'chrome115', 'safari14'],
        node: 'node20'
      },
      env: {
        // This is place to set build time variables
        APP_VERSION: JSON.stringify(process.env.APP_VERSION || 'alpha'),
        COMMIT_SHA: JSON.stringify(process.env.COMMIT_SHA || 'not set'),
        CSP: JSON.stringify([
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://*.googleusercontent.com https://*.posthog.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
          "img-src 'self' data: https: blob: https://*.google.com https://*.googleusercontent.com",
          "media-src 'self' blob: data: https://matrix-dev.openmeet.net https://matrix.openmeet.net https://matrix.dev.openmeet.net",
          "font-src 'self' https://fonts.gstatic.com",
          "frame-src 'self' https://accounts.google.com https://play.google.com https://*.google.com https://accounts.youtube.com http://localhost:8448 https://localhost:8448 http://localhost:3000 https://localhost:3000 https://matrix-dev.openmeet.net https://matrix.openmeet.net https://api-dev.openmeet.net https://api.openmeet.net https://api.dev.openmeet.net https://mas.dev.openmeet.net https://matrix.dev.openmeet.net",
          "connect-src 'self' blob: http://localhost:* https://localhost:* http://127.0.0.1:* https://127.0.0.1:* http://0.0.0.0:* https://0.0.0.0:* https://accounts.google.com https://*.google.com https://play.google.com https://api-dev.openmeet.net https://api.openmeet.net wss://api-dev.openmeet.net wss://api.openmeet.net https://*.amazonaws.com https://*.openstreetmap.org https://*.posthog.com https://api.hsforms.com https://api.dev.openmeet.net https://mas.dev.openmeet.net https://matrix.dev.openmeet.net https://matrix-dev.openmeet.net wss://matrix-dev.openmeet.net *",
          "object-src 'none'",
          "base-uri 'self'"
        ].join('; '))
      },

      vueRouterMode: 'history', // available values: 'hash', 'history'
      // vueRouterBase,
      // vueDevtools,
      // vueOptionsAPI: false,

      // rebuildCache: true, // rebuilds Vite/linter/etc cache on startup

      // publicPath: '/',
      // analyze: true,
      // env: {},
      // rawDefine: {},
      // ignorePublicFolder: true,
      // minify: false,
      // polyfillModulePreload: true,
      // distDir

      extendViteConf (viteConf) {
        // Configure Vite dev server to open custom URL
        if (viteConf.server) {
          viteConf.server.open = frontendDomain || true
        }

        // Configure WASM handling using vite-plugin-wasm
        viteConf.plugins = viteConf.plugins || []
        viteConf.plugins.push(wasm())

        // Configure dependency optimization for Matrix SDK and related modules
        viteConf.optimizeDeps = viteConf.optimizeDeps || {}
        viteConf.optimizeDeps.exclude = viteConf.optimizeDeps.exclude || []
        // Only exclude the WASM crypto module to avoid bundling issues
        viteConf.optimizeDeps.exclude.push('@matrix-org/matrix-sdk-crypto-wasm')

        // Let Vite handle matrix-js-sdk and its dependencies normally
        // This should resolve CommonJS/ESM compatibility issues automatically
      },
      // viteVuePluginOptions: {},

      vitePlugins: [
        ['@intlify/unplugin-vue-i18n/vite', {
          // if you want to use Vue I18n Legacy API, you need to set `compositionOnly: false`
          // compositionOnly: false,

          // if you want to use named tokens in your Vue I18n messages, such as 'Hello {name}',
          // you need to set `runtimeOnly: false`
          // runtimeOnly: false,

          ssr: ctx.modeName === 'ssr',

          // you need to set i18n resource including paths !
          include: [fileURLToPath(new URL('./src/i18n', import.meta.url))]
        }],
        ['vite-plugin-checker', {
          vueTsc: {
            tsconfigPath: 'tsconfig.vue-tsc.json'
          },
          eslint: {
            lintCommand: 'eslint "./**/*.{js,ts,mjs,cjs,vue}"'
          }
        }, { server: false }],
        istanbul({
          include: 'src/*',
          exclude: ['node_modules', 'test/'],
          extension: ['.js', '.ts', '.vue'],
          requireEnv: false
        })
      ]
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#devServer
    devServer: {
      // https: Boolean(process.env.DEV_SERVER_HTTPS),
      port: Number(process.env.APP_DEV_SERVER_PORT) || 8080,
      open: false, // opens browser window automatically
      host: '0.0.0.0', // Allow external connections
      allowedHosts: ['localhost', '127.0.0.1', 'platform.dev.openmeet.net'],
      proxy: {
        '/sitemap.xml': {
          target: process.env.APP_API_URL || 'http://localhost:3000',
          changeOrigin: true,
          rewrite: () => {
            const tenantId = getTenantId()
            if (!tenantId) {
              throw new Error('APP_TENANT_ID not found in environment variables or config.json')
            }

            return `/api/sitemap/sitemap.xml?tenantId=${tenantId}`
          },
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              const tenantId = getTenantId()
              if (!tenantId) {
                throw new Error('APP_TENANT_ID not found in environment variables or config.json')
              }

              proxyReq.setHeader('x-tenant-id', tenantId)
            })
          }
        }
      }
    },

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#framework
    framework: {
      config: {
        dark: 'auto',
        loadingBar: {
          skipHijack: true
        }
      },

      iconSet: 'material-symbols-rounded', // Quasar icon set
      // lang: 'en-US', // Quasar language pack

      // For special cases outside of where the auto-import strategy can have an impact
      // (like functional components as one of the examples),
      // you can manually specify Quasar components/directives to be available everywhere:
      //
      // components: [],
      // directives: [],

      // Quasar plugins
      plugins: [
        'Notify',
        'Dialog',
        'LoadingBar',
        'Loading',
        'Meta'
      ]
    },

    // animations: 'all', // --- includes all animations
    // https://v2.quasar.dev/options/animations
    animations: [],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#sourcefiles
    // sourceFiles: {
    //   rootComponent: 'src/App.vue',
    //   router: 'src/router/index',
    //   store: 'src/store/index',
    //   pwaRegisterServiceWorker: 'src-pwa/register-service-worker',
    //   pwaServiceWorker: 'src-pwa/custom-service-worker',
    //   pwaManifestFile: 'src-pwa/manifest.json',
    //   electronMain: 'src-electron/electron-main',
    //   electronPreload: 'src-electron/electron-preload'
    //   bexManifestFile: 'src-bex/manifest.json
    // },

    // https://v2.quasar.dev/quasar-cli-vite/developing-ssr/configuring-ssr
    ssr: {
      prodPort: 3000, // The default port that the production server should use
      // (gets superseded if process.env.PORT is specified at runtime)

      middlewares: [
        'render' // keep this as last one
      ],

      // extendPackageJson (json) {},
      // extendSSRWebserverConf (esbuildConf) {},

      // manualStoreSerialization: true,
      // manualStoreSsrContextInjection: true,
      // manualStoreHydration: true,
      // manualPostHydrationTrigger: true,

      pwa: false

      // pwaOfflineHtmlFilename: 'offline.html', // do NOT use index.html as name!
      // will mess up SSR

      // pwaExtendGenerateSWOptions (cfg) {},
      // pwaExtendInjectManifestOptions (cfg) {}
    },

    // https://v2.quasar.dev/quasar-cli-vite/developing-pwa/configuring-pwa
    pwa: {
      workboxMode: 'GenerateSW' // 'GenerateSW' or 'InjectManifest'
      // swFilename: 'sw.js',
      // manifestFilename: 'manifest.json'
      // extendManifestJson (json) {},
      // useCredentialsForManifestTag: true,
      // injectPwaMetaTags: false,
      // extendPWACustomSWConf (esbuildConf) {},
      // extendGenerateSWOptions (cfg) {},
      // extendInjectManifestOptions (cfg) {}
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-cordova-apps/configuring-cordova
    cordova: {
      // noIosLegacyBuildFlag: true, // uncomment only if you know what you are doing
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-capacitor-apps/configuring-capacitor
    capacitor: {
      hideSplashscreen: true
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/configuring-electron
    electron: {
      // extendElectronMainConf (esbuildConf) {},
      // extendElectronPreloadConf (esbuildConf) {},

      // extendPackageJson (json) {},

      // Electron preload scripts (if any) from /src-electron, WITHOUT file extension
      preloadScripts: ['electron-preload'],

      // specify the debugging port to use for the Electron app when running in development mode
      inspectPort: 5858,

      bundler: 'packager', // 'packager' or 'builder'

      packager: {
        // https://github.com/electron-userland/electron-packager/blob/master/docs/api.md#options

        // OS X / Mac App Store
        // appBundleId: '',
        // appCategoryType: '',
        // osxSign: '',
        // protocol: 'myapp://path',

        // Windows only
        // win32metadata: { ... }
      },

      builder: {
        // https://www.electron.build/configuration/configuration

        appId: 'openmeet'
      }
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-browser-extensions/configuring-bex
    bex: {
      // extendBexScriptsConf (esbuildConf) {},
      // extendBexManifestJson (json) {},

      contentScripts: [
        'my-content-script'
      ],
      extendBexScriptsConf: () => {}
    }
  }
})
